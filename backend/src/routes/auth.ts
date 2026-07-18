import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { signToken } from '../auth';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const ALLOWED_PAY_SCHEDULES = ['weekly', 'biweekly', 'semi-monthly'];

// POST /api/auth/signup
router.post('/signup', (req: Request, res: Response): void => {
  const { email, password, name, pay_schedule } = req.body;

  // Validate input
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  // Validate pay_schedule if provided
  let schedule = 'biweekly';
  if (pay_schedule !== undefined) {
    if (!ALLOWED_PAY_SCHEDULES.includes(pay_schedule)) {
      res.status(400).json({
        error: `Invalid pay_schedule. Must be one of: ${ALLOWED_PAY_SCHEDULES.join(', ')}`,
      });
      return;
    }
    schedule = pay_schedule;
  }

  const db = getDb();

  // Check if email already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  // Hash password and insert user
  const passwordHash = bcrypt.hashSync(password, 10);

  const result = db.prepare(
    'INSERT INTO users (email, password_hash, name, pay_schedule) VALUES (?, ?, ?, ?)'
  ).run(email, passwordHash, name.trim(), schedule);

  const userId = result.lastInsertRowid as number;

  // Generate token
  const token = signToken({ userId, email });

  res.status(201).json({
    token,
    user: {
      id: userId,
      email,
      name: name.trim(),
      pay_schedule: schedule,
    },
  });
});

// POST /api/auth/login
router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const db = getDb();

  const user = db.prepare(
    'SELECT id, email, password_hash, name FROM users WHERE email = ?'
  ).get(email) as { id: number; email: string; password_hash: string; name: string } | undefined;

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getDb();

  const user = db.prepare(
    'SELECT id, email, name, pay_schedule FROM users WHERE id = ?'
  ).get(req.userId) as { id: number; email: string; name: string; pay_schedule: string } | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      pay_schedule: user.pay_schedule,
    },
  });
});

// PUT /api/auth/settings — Update user settings (e.g. pay_schedule)
router.put('/settings', authMiddleware, (req: AuthRequest, res: Response): void => {
  const { pay_schedule } = req.body;

  if (!pay_schedule || !ALLOWED_PAY_SCHEDULES.includes(pay_schedule)) {
    res.status(400).json({
      error: `Invalid pay_schedule. Must be one of: ${ALLOWED_PAY_SCHEDULES.join(', ')}`,
    });
    return;
  }

  const db = getDb();

  db.prepare('UPDATE users SET pay_schedule = ? WHERE id = ?').run(pay_schedule, req.userId!);

  const user = db.prepare(
    'SELECT id, email, name, pay_schedule FROM users WHERE id = ?'
  ).get(req.userId!) as { id: number; email: string; name: string; pay_schedule: string };

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      pay_schedule: user.pay_schedule,
    },
  });
});

export default router;
