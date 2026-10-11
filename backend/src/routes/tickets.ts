import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import pool from '../db';

const router = Router();

const VALID_STATUSES = ['open', 'in_progress', 'closed'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;

type Status = typeof VALID_STATUSES[number];
type Priority = typeof VALID_PRIORITIES[number];

interface Ticket {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  created_at: Date;
}

// POST /tickets
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('priority')
      .optional()
      .isIn(VALID_PRIORITIES)
      .withMessage('Invalid priority'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { title, description, priority = 'medium' } = req.body as {
      title: string;
      description?: string;
      priority?: Priority;
    };

    try {
      const result = await pool.query<Ticket>(
        `INSERT INTO tickets (title, description, priority)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [title, description ?? null, priority]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /tickets/stats — must be before /:id
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::int AS count FROM tickets GROUP BY status`
    );

    const stats: Record<string, number> = { open: 0, in_progress: 0, closed: 0 };
    for (const row of result.rows) {
      stats[row.status] = row.count as unknown as number;
    }

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /tickets
router.get(
  '/',
  [
    query('status').optional().isIn(VALID_STATUSES).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be >= 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const status = req.query.status as Status | undefined;
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const limit = Math.min(parseInt((req.query.limit as string) ?? '10', 10), 100);
    const offset = (page - 1) * limit;

    try {
      let dataQuery: string;
      let countQuery: string;
      let params: unknown[];

      if (status) {
        dataQuery = `SELECT * FROM tickets WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
        countQuery = `SELECT COUNT(*)::int AS total FROM tickets WHERE status = $1`;
        params = [status];
      } else {
        dataQuery = `SELECT * FROM tickets ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
        countQuery = `SELECT COUNT(*)::int AS total FROM tickets`;
        params = [];
      }

      const [dataResult, countResult] = await Promise.all([
        pool.query<Ticket>(dataQuery, status ? [...params, limit, offset] : [limit, offset]),
        pool.query<{ total: number }>(countQuery, params),
      ]);

      res.json({
        data: dataResult.rows,
        total: countResult.rows[0].total,
        page,
        limit,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /tickets/:id
router.patch(
  '/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
    body('status').optional().isIn(VALID_STATUSES).withMessage('Invalid status'),
    body('priority').optional().isIn(VALID_PRIORITIES).withMessage('Invalid priority'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const id = parseInt(req.params.id, 10);
    const { status, priority } = req.body as { status?: Status; priority?: Priority };

    if (!status && !priority) {
      res.status(400).json({ error: 'At least one of status or priority is required' });
      return;
    }

    try {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (status) {
        fields.push(`status = $${idx++}`);
        values.push(status);
      }
      if (priority) {
        fields.push(`priority = $${idx++}`);
        values.push(priority);
      }
      values.push(id);

      const result = await pool.query<Ticket>(
        `UPDATE tickets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
