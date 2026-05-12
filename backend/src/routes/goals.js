const express = require('express');
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Hedefler listesi
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT g.*, 
        (SELECT COALESCE(SUM(percentage), 0) FROM automatic_splits WHERE user_id = $1 AND goal_id = g.id AND is_active) AS split_percentage
       FROM goals g WHERE g.user_id = $1 AND g.is_active = true ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Yeni hedef
router.post('/', async (req, res, next) => {
  try {
    const { name, type, target_amount, icon, color } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO goals (user_id, name, type, target_amount, icon, color) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, name || 'Yeni Hedef', type || 'savings', target_amount || null, icon || null, color || '#003399']
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Otomatik dağıtım kuralları (Automatic Splitter)
router.get('/splits', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, g.name AS goal_name, g.type AS goal_type FROM automatic_splits s
       JOIN goals g ON g.id = s.goal_id WHERE s.user_id = $1 AND s.is_active ORDER BY s.priority, s.id`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/splits', async (req, res, next) => {
  try {
    const { goal_id, percentage, priority } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO automatic_splits (user_id, goal_id, percentage, priority)
       VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, goal_id) DO UPDATE SET percentage = $3, priority = $4, is_active = true
       RETURNING *`,
      [req.user.id, goal_id, percentage, priority ?? 0]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Hedef güncelle / sil
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, target_amount, current_amount, is_active } = req.body;
    const updates = [];
    const values = [req.params.id, req.user.id];
    let i = 3;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (target_amount !== undefined) { updates.push(`target_amount = $${i++}`); values.push(target_amount); }
    if (current_amount !== undefined) { updates.push(`current_amount = $${i++}`); values.push(current_amount); }
    if (is_active !== undefined) { updates.push(`is_active = $${i++}`); values.push(is_active); }
    if (!updates.length) return res.status(400).json({ error: 'Güncellenecek alan yok' });
    updates.push('updated_at = CURRENT_TIMESTAMP');
    const { rows } = await pool.query(
      `UPDATE goals SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Hedef bulunamadı' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('UPDATE goals SET is_active = false WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

module.exports = router;
