const express = require('express');
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Gruplarım (Ortak kumbara + harcama grupları)
router.get('/groups', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT sg.*, u.full_name AS created_by_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = sg.id) AS member_count
       FROM social_groups sg
       JOIN group_members gm ON gm.group_id = sg.id
       JOIN users u ON u.id = sg.created_by
       WHERE gm.user_id = $1 ORDER BY sg.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Yeni grup (Ortak kumbara veya harcama grubu)
router.post('/groups', async (req, res, next) => {
  try {
    const { name, type, target_amount } = req.body;
    const { rows: group } = await pool.query(
      `INSERT INTO social_groups (name, type, created_by, target_amount) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name || 'Yeni Grup', type || 'piggy_bank', req.user.id, target_amount || null]
    );
    await pool.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
      [group[0].id, req.user.id, 'admin']
    );
    res.status(201).json(group[0]);
  } catch (e) {
    next(e);
  }
});

// Gruba üye ekle (email ile davet)
router.post('/groups/:groupId/members', async (req, res, next) => {
  try {
    const { email } = req.body;
    const { rows: targetUser } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!targetUser.length) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT (group_id, user_id) DO NOTHING',
      [req.params.groupId, targetUser[0].id]
    );
    res.status(201).json({ message: 'Üye eklendi' });
  } catch (e) {
    next(e);
  }
});

// Grup harcaması ekle (Splitwise)
router.post('/groups/:groupId/expenses', async (req, res, next) => {
  try {
    const { amount, description, split_type, splits } = req.body; // splits: [{ user_id, amount }]
    const { rows: expense } = await pool.query(
      `INSERT INTO group_expenses (group_id, paid_by_user_id, amount, description, split_type) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.groupId, req.user.id, amount, description || '', split_type || 'equal']
    );
    const exp = expense[0];
    if (split_type === 'custom' && Array.isArray(splits) && splits.length) {
      for (const s of splits) {
        await pool.query(
          'INSERT INTO debt_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)',
          [exp.id, s.user_id, s.amount]
        );
      }
    } else {
      const { rows: members } = await pool.query(
        'SELECT user_id FROM group_members WHERE group_id = $1',
        [req.params.groupId]
      );
      const perPerson = Number((Number(amount) / members.length).toFixed(2));
      for (const m of members) {
        if (m.user_id === req.user.id) continue; // ödeyen kendine borç yazmaz
        await pool.query(
          'INSERT INTO debt_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)',
          [exp.id, m.user_id, perPerson]
        );
      }
    }
    res.status(201).json(exp);
  } catch (e) {
    next(e);
  }
});

// Borç özeti: kim kime ne kadar borçlu
router.get('/groups/:groupId/debts', async (req, res, next) => {
  try {
    const { rows: debts } = await pool.query(
      `SELECT ds.id, ds.user_id, ds.amount, ds.is_settled, u.full_name
       FROM debt_splits ds
       JOIN group_expenses ge ON ge.id = ds.expense_id
       JOIN users u ON u.id = ds.user_id
       WHERE ge.group_id = $1 AND ds.is_settled = false`,
      [req.params.groupId]
    );
    const { rows: paidBy } = await pool.query(
      `SELECT ge.paid_by_user_id FROM group_expenses ge WHERE ge.group_id = $1`,
      [req.params.groupId]
    );
    res.json({ debts, paidBy: paidBy[0]?.paid_by_user_id });
  } catch (e) {
    next(e);
  }
});

router.post('/debts/:id/settle', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE debt_splits SET is_settled = true, settled_at = CURRENT_TIMESTAMP WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Borç kapatıldı' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
