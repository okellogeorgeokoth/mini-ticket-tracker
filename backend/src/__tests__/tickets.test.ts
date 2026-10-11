import request from 'supertest';
import app from '../app';
import pool from '../db';

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(255) NOT NULL,
      description TEXT,
      status      VARCHAR(20)  NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','closed')),
      priority    VARCHAR(10)  NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high')),
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  // Clean slate for each test run
  await pool.query('TRUNCATE TABLE tickets RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('POST /tickets', () => {
  it('creates a ticket and returns 201 with the ticket data', async () => {
    const res = await request(app).post('/tickets').send({
      title: 'Test ticket',
      description: 'A description',
      priority: 'high',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Test ticket',
      description: 'A description',
      status: 'open',
      priority: 'high',
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.created_at).toBeDefined();
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/tickets').send({ priority: 'low' });
    expect(res.status).toBe(400);
  });
});

describe('GET /tickets/stats', () => {
  it('returns stats grouped by status with the correct shape', async () => {
    const res = await request(app).get('/tickets/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('open');
    expect(res.body).toHaveProperty('in_progress');
    expect(res.body).toHaveProperty('closed');
    expect(typeof res.body.open).toBe('number');
    expect(typeof res.body.in_progress).toBe('number');
    expect(typeof res.body.closed).toBe('number');
  });
});

describe('GET /tickets', () => {
  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE tickets RESTART IDENTITY CASCADE');
    // Insert a mix of tickets
    await pool.query(`
      INSERT INTO tickets (title, status, priority) VALUES
        ('Open ticket 1', 'open', 'low'),
        ('Open ticket 2', 'open', 'medium'),
        ('In progress ticket', 'in_progress', 'high'),
        ('Closed ticket', 'closed', 'low')
    `);
  });

  it('filters tickets by status=open', async () => {
    const res = await request(app).get('/tickets?status=open');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((t: { status: string }) => t.status === 'open')).toBe(true);
  });

  it('returns paginated results with total, page, and limit', async () => {
    const res = await request(app).get('/tickets?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(4);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
  });
});

describe('PATCH /tickets/:id', () => {
  let ticketId: number;

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE tickets RESTART IDENTITY CASCADE');
    const result = await pool.query<{ id: number }>(
      `INSERT INTO tickets (title, priority) VALUES ('Patch test', 'low') RETURNING id`
    );
    ticketId = result.rows[0].id;
  });

  it('updates ticket status and returns the updated ticket', async () => {
    const res = await request(app)
      .patch(`/tickets/${ticketId}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('returns 404 for a non-existent ticket', async () => {
    const res = await request(app).patch('/tickets/99999').send({ status: 'closed' });
    expect(res.status).toBe(404);
  });
});
