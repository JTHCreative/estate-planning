import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from './database.js';
import { AuthRequest, authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

// Helper: get user IDs that this user can see (self + partner)
function getVisibleUserIds(userId: string): string[] {
  const user = db.prepare('SELECT partner_id FROM users WHERE id = ?').get(userId) as any;
  const ids = [userId];
  if (user?.partner_id) ids.push(user.partner_id);
  return ids;
}

function placeholders(arr: string[]) {
  return arr.map(() => '?').join(',');
}

// === Categories ===
router.get('/categories', (_req: AuthRequest, res: Response) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.json(categories);
});

// === Institutions ===
router.get('/institutions', (req: AuthRequest, res: Response) => {
  const ids = getVisibleUserIds(req.userId!);
  const { categoryId } = req.query;
  let query = `SELECT i.*, u.first_name || ' ' || u.last_name as owner_name
               FROM institutions i JOIN users u ON i.user_id = u.id
               WHERE i.user_id IN (${placeholders(ids)})`;
  const params: any[] = [...ids];

  if (categoryId) {
    query += ' AND i.category_id = ?';
    params.push(categoryId);
  }
  query += ' ORDER BY i.name';

  const institutions = db.prepare(query).all(...params);
  res.json(institutions);
});

router.post('/institutions', (req: AuthRequest, res: Response) => {
  const { categoryId, name, website, phone, notes } = req.body;
  if (!categoryId || !name) {
    res.status(400).json({ error: 'Category and name are required' });
    return;
  }
  const id = uuid();
  db.prepare('INSERT INTO institutions (id, user_id, category_id, name, website, phone, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, categoryId, name, website || null, phone || null, notes || null);
  const institution = db.prepare('SELECT * FROM institutions WHERE id = ?').get(id);
  res.json(institution);
});

router.put('/institutions/:id', (req: AuthRequest, res: Response) => {
  const { name, website, phone, notes } = req.body;
  const inst = db.prepare('SELECT * FROM institutions WHERE id = ?').get(req.params.id) as any;
  if (!inst) { res.status(404).json({ error: 'Not found' }); return; }

  const ids = getVisibleUserIds(req.userId!);
  if (!ids.includes(inst.user_id)) { res.status(403).json({ error: 'Forbidden' }); return; }

  db.prepare("UPDATE institutions SET name = ?, website = ?, phone = ?, notes = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name || inst.name, website ?? inst.website, phone ?? inst.phone, notes ?? inst.notes, req.params.id);
  const updated = db.prepare('SELECT * FROM institutions WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/institutions/:id', (req: AuthRequest, res: Response) => {
  const inst = db.prepare('SELECT * FROM institutions WHERE id = ?').get(req.params.id) as any;
  if (!inst) { res.status(404).json({ error: 'Not found' }); return; }
  if (inst.user_id !== req.userId) { res.status(403).json({ error: 'Can only delete your own institutions' }); return; }
  db.prepare('DELETE FROM institutions WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// === Accounts ===
router.get('/accounts', (req: AuthRequest, res: Response) => {
  const ids = getVisibleUserIds(req.userId!);
  const { institutionId } = req.query;
  let query = `SELECT a.*, u.first_name || ' ' || u.last_name as owner_name
               FROM accounts a JOIN users u ON a.user_id = u.id
               WHERE a.user_id IN (${placeholders(ids)})`;
  const params: any[] = [...ids];

  if (institutionId) {
    query += ' AND a.institution_id = ?';
    params.push(institutionId);
  }
  query += ' ORDER BY a.account_name';

  const accounts = db.prepare(query).all(...params);
  res.json(accounts);
});

router.post('/accounts', (req: AuthRequest, res: Response) => {
  const { institutionId, accountName, accountType, accountNumber, routingNumber, username, password, url, contactName, contactPhone, contactEmail, estimatedValue, beneficiary, notes } = req.body;
  if (!institutionId || !accountName) {
    res.status(400).json({ error: 'Institution and account name are required' });
    return;
  }
  const id = uuid();
  db.prepare(`INSERT INTO accounts (id, institution_id, user_id, account_name, account_type, account_number, routing_number, username, password_encrypted, url, contact_name, contact_phone, contact_email, estimated_value, beneficiary, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, institutionId, req.userId, accountName, accountType || null, accountNumber || null, routingNumber || null, username || null, password || null, url || null, contactName || null, contactPhone || null, contactEmail || null, estimatedValue || null, beneficiary || null, notes || null);
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  res.json(account);
});

router.put('/accounts/:id', (req: AuthRequest, res: Response) => {
  const acct = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id) as any;
  if (!acct) { res.status(404).json({ error: 'Not found' }); return; }

  const ids = getVisibleUserIds(req.userId!);
  if (!ids.includes(acct.user_id)) { res.status(403).json({ error: 'Forbidden' }); return; }

  const { accountName, accountType, accountNumber, routingNumber, username, password, url, contactName, contactPhone, contactEmail, estimatedValue, beneficiary, notes } = req.body;
  db.prepare(`UPDATE accounts SET account_name = ?, account_type = ?, account_number = ?, routing_number = ?, username = ?, password_encrypted = ?, url = ?, contact_name = ?, contact_phone = ?, contact_email = ?, estimated_value = ?, beneficiary = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(
      accountName ?? acct.account_name, accountType ?? acct.account_type, accountNumber ?? acct.account_number,
      routingNumber ?? acct.routing_number, username ?? acct.username, password ?? acct.password_encrypted,
      url ?? acct.url, contactName ?? acct.contact_name, contactPhone ?? acct.contact_phone,
      contactEmail ?? acct.contact_email, estimatedValue ?? acct.estimated_value, beneficiary ?? acct.beneficiary,
      notes ?? acct.notes, req.params.id
    );
  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/accounts/:id', (req: AuthRequest, res: Response) => {
  const acct = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id) as any;
  if (!acct) { res.status(404).json({ error: 'Not found' }); return; }
  if (acct.user_id !== req.userId) { res.status(403).json({ error: 'Can only delete your own accounts' }); return; }
  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// === Checklist Items ===
router.get('/checklist', (req: AuthRequest, res: Response) => {
  const ids = getVisibleUserIds(req.userId!);
  const items = db.prepare(`SELECT * FROM checklist_items WHERE user_id IN (${placeholders(ids)}) ORDER BY created_at`).all(...ids);
  res.json(items);
});

router.post('/checklist', (req: AuthRequest, res: Response) => {
  const { categoryId, label } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO checklist_items (id, user_id, category_id, label) VALUES (?, ?, ?, ?)')
    .run(id, req.userId, categoryId, label);
  const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id);
  res.json(item);
});

router.put('/checklist/:id', (req: AuthRequest, res: Response) => {
  const { completed, notes } = req.body;
  db.prepare('UPDATE checklist_items SET completed = ?, notes = ? WHERE id = ?')
    .run(completed ? 1 : 0, notes || null, req.params.id);
  const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id);
  res.json(item);
});

// === Dashboard Stats ===
router.get('/stats', (req: AuthRequest, res: Response) => {
  const ids = getVisibleUserIds(req.userId!);
  const ph = placeholders(ids);

  const totalInstitutions = (db.prepare(`SELECT COUNT(*) as c FROM institutions WHERE user_id IN (${ph})`).get(...ids) as any).c;
  const totalAccounts = (db.prepare(`SELECT COUNT(*) as c FROM accounts WHERE user_id IN (${ph})`).get(...ids) as any).c;

  const categoryCounts = db.prepare(`
    SELECT c.id, c.name, c.icon, c.sort_order,
      (SELECT COUNT(*) FROM institutions i WHERE i.category_id = c.id AND i.user_id IN (${ph})) as institution_count,
      (SELECT COUNT(*) FROM accounts a JOIN institutions i ON a.institution_id = i.id WHERE i.category_id = c.id AND a.user_id IN (${ph})) as account_count
    FROM categories c ORDER BY c.sort_order
  `).all(...ids, ...ids);

  res.json({ totalInstitutions, totalAccounts, categoryCounts });
});

export default router;
