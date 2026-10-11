import { useState, useEffect, useCallback } from 'react';
import './App.css';

type Status = 'open' | 'in_progress' | 'closed';
type Priority = 'low' | 'medium' | 'high';

interface Ticket {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  created_at: string;
}

interface TicketsResponse {
  data: Ticket[];
  total: number;
  page: number;
  limit: number;
}

interface Stats {
  open: number;
  in_progress: number;
  closed: number;
}

const API_BASE = '/tickets';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StatusBadge({ status }: { status: Status }) {
  const colours: Record<Status, string> = {
    open: 'badge-blue',
    in_progress: 'badge-orange',
    closed: 'badge-grey',
  };
  return <span className={`badge ${colours[status]}`}>{status.replace('_', ' ')}</span>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const colours: Record<Priority, string> = {
    low: 'badge-green',
    medium: 'badge-yellow',
    high: 'badge-red',
  };
  return <span className={`badge ${colours[priority]}`}>{priority}</span>;
}

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | ''>('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data: Stats = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await fetch(`${API_BASE}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch tickets');
      const data: TicketsResponse = await res.json();
      setTickets(data.data);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setCreateError('Title is required');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined, priority }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create ticket');
      }
      setTitle('');
      setDescription('');
      setPriority('medium');
      await Promise.all([fetchTickets(), fetchStats()]);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: Status) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update ticket');
      await Promise.all([fetchTickets(), fetchStats()]);
    } catch (e) {
      console.error(e);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container">
      <h1>Mini Ticket Tracker</h1>

      {/* Stats Bar */}
      <section className="stats-bar" aria-label="Ticket statistics">
        <div className="stat-card stat-open">
          <span className="stat-count">{stats?.open ?? 0}</span>
          <span className="stat-label">Open</span>
        </div>
        <div className="stat-card stat-in-progress">
          <span className="stat-count">{stats?.in_progress ?? 0}</span>
          <span className="stat-label">In Progress</span>
        </div>
        <div className="stat-card stat-closed">
          <span className="stat-count">{stats?.closed ?? 0}</span>
          <span className="stat-label">Closed</span>
        </div>
      </section>

      {/* Create Ticket Form */}
      <section className="create-form" aria-label="Create new ticket">
        <h2>Create Ticket</h2>
        <form onSubmit={handleCreate} noValidate>
          <div className="form-group">
            <label htmlFor="title">Title <span aria-hidden="true">*</span></label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter ticket title"
              required
              aria-required="true"
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          {createError && <p className="error" role="alert">{createError}</p>}
          <button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create Ticket'}
          </button>
        </form>
      </section>

      {/* Ticket List */}
      <section className="ticket-list" aria-label="Ticket list">
        <div className="list-header">
          <h2>Tickets {total > 0 && <span className="total-count">({total})</span>}</h2>
          <div className="filter-group">
            <label htmlFor="status-filter">Filter by status:</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as Status | '')}
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {tickets.length === 0 ? (
          <p className="empty-state">No tickets found.</p>
        ) : (
          <div className="ticket-table-wrapper" role="region" aria-label="Tickets table">
            <table className="ticket-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Description</th>
                  <th scope="col">Status</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Created</th>
                  <th scope="col">Change Status</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td className="ticket-title">{ticket.title}</td>
                    <td className="ticket-desc">
                      {ticket.description
                        ? ticket.description.length > 80
                          ? ticket.description.slice(0, 80) + '…'
                          : ticket.description
                        : <span className="no-desc">—</span>}
                    </td>
                    <td><StatusBadge status={ticket.status} /></td>
                    <td><PriorityBadge priority={ticket.priority} /></td>
                    <td className="ticket-date">{formatDate(ticket.created_at)}</td>
                    <td>
                      <select
                        value={ticket.status}
                        onChange={e => handleStatusChange(ticket.id, e.target.value as Status)}
                        aria-label={`Change status of ${ticket.title}`}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination" role="navigation" aria-label="Pagination">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
            >
              ← Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
