const express = require('express');
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Son işlemler
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const { rows } = await pool.query(
      `SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [req.user.id, limit]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Gelir ekle (Automatic Split uygulanabilir)
router.post('/income', async (req, res, next) => {
  try {
    const { amount, description, category } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Geçerli tutar girin' });

    const client = await pool.connect();
    try {
      const { rows: user } = await client.query(
        'SELECT main_balance FROM users WHERE id = $1 FOR UPDATE',
        [req.user.id]
      );
      const newBalance = Number(user[0].main_balance) + amt;

      const { rows: splits } = await client.query(
        `SELECT s.goal_id, s.percentage, g.current_amount FROM automatic_splits s JOIN goals g ON g.id = s.goal_id WHERE s.user_id = $1 AND s.is_active`,
        [req.user.id]
      );

      let remaining = amt;
      const totalPct = splits.reduce((a, s) => a + Number(s.percentage), 0);
      if (totalPct > 0 && totalPct <= 100) {
        for (const s of splits) {
          const part = (amt * Number(s.percentage)) / 100;
          remaining -= part;
          await client.query(
            'UPDATE goals SET current_amount = current_amount + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [part, s.goal_id]
          );
          await client.query(
            `INSERT INTO transactions (user_id, type, amount, balance_after, category, description, goal_id, source) VALUES ($1, 'transfer', $2, $3, $4, $5, $6, 'automatic_split')`,
            [req.user.id, -part, newBalance - part, category, description || 'Otomatik dağıtım', s.goal_id]
          );
        }
      }

      await client.query(
        'UPDATE users SET main_balance = main_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [remaining, req.user.id]
      );
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, balance_after, category, description, source) VALUES ($1, 'income', $2, $3, $4, $5, 'manual')`,
        [req.user.id, amt, newBalance, category || null, description || 'Gelir']
      );
      const { rows: updated } = await client.query(
        'SELECT main_balance FROM users WHERE id = $1',
        [req.user.id]
      );
      res.status(201).json({ balance: updated[0].main_balance, message: 'Gelir eklendi' });
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
});

// Harcama ekle
router.post('/expense', async (req, res, next) => {
  try {
    const { amount, description, category } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Geçerli tutar girin' });

    const client = await pool.connect();
    try {
      const { rows: user } = await client.query(
        'SELECT main_balance FROM users WHERE id = $1 FOR UPDATE',
        [req.user.id]
      );
      const balance = Number(user[0].main_balance);
      if (balance < amt) return res.status(400).json({ error: 'Yetersiz bakiye' });

      const newBalance = balance - amt;

      await client.query(
        'UPDATE users SET main_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newBalance, req.user.id]
      );
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, balance_after, category, description, source) VALUES ($1, 'expense', $2, $3, $4, $5, 'manual')`,
        [req.user.id, -amt, newBalance, category || null, description || 'Harcama']
      );

      const { rows: updated } = await client.query(
        'SELECT main_balance FROM users WHERE id = $1',
        [req.user.id]
      );
      res.status(201).json({ balance: updated[0].main_balance });
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
});

module.exports = router;
