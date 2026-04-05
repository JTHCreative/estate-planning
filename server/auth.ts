import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import db from './database.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'estate-planning-secret-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    _res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    _res.status(401).json({ error: 'Invalid token' });
  }
}

// Register
router.post('/register', (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const id = uuid();
  const passwordHash = bcrypt.hashSync(password, 12);
  const partnerCode = uuid().slice(0, 8).toUpperCase();

  db.prepare('INSERT INTO users (id, email, password_hash, first_name, last_name, partner_code) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, email.toLowerCase(), passwordHash, firstName, lastName, partnerCode);

  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id, email, firstName, lastName, partnerCode, partnerId: null } });
});

// Login
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      partnerCode: user.partner_code,
      partnerId: user.partner_id,
    }
  });
});

// Get current user
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  let partner = null;
  if (user.partner_id) {
    const p = db.prepare('SELECT id, email, first_name, last_name FROM users WHERE id = ?').get(user.partner_id) as any;
    if (p) partner = { id: p.id, email: p.email, firstName: p.first_name, lastName: p.last_name };
  }

  res.json({
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    partnerCode: user.partner_code,
    partnerId: user.partner_id,
    partner,
  });
});

// Link partner
router.post('/link-partner', authMiddleware, (req: AuthRequest, res: Response) => {
  const { partnerCode } = req.body;
  if (!partnerCode) {
    res.status(400).json({ error: 'Partner code is required' });
    return;
  }

  const partner = db.prepare('SELECT id, partner_id FROM users WHERE partner_code = ?').get(partnerCode) as any;
  if (!partner) {
    res.status(404).json({ error: 'Invalid partner code' });
    return;
  }

  if (partner.id === req.userId) {
    res.status(400).json({ error: 'Cannot link to yourself' });
    return;
  }

  if (partner.partner_id && partner.partner_id !== req.userId) {
    res.status(400).json({ error: 'That user is already linked to another partner' });
    return;
  }

  // Link both ways
  db.prepare('UPDATE users SET partner_id = ? WHERE id = ?').run(partner.id, req.userId);
  db.prepare('UPDATE users SET partner_id = ? WHERE id = ?').run(req.userId, partner.id);

  res.json({ message: 'Partner linked successfully' });
});

// Unlink partner
router.post('/unlink-partner', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT partner_id FROM users WHERE id = ?').get(req.userId) as any;
  if (user?.partner_id) {
    db.prepare('UPDATE users SET partner_id = NULL WHERE id = ?').run(user.partner_id);
  }
  db.prepare('UPDATE users SET partner_id = NULL WHERE id = ?').run(req.userId);
  res.json({ message: 'Partner unlinked' });
});

export default router;
