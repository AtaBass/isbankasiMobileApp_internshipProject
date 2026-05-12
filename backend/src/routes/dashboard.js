const express = require('express');
const { pool } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Ana sayfa özeti: bakiye, son işlemler, aktif hedef, günün AI tavsiyesi, puan/seri
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [userRes, txRes, goalsRes, pointsRes] = await Promise.all([
      pool.query('SELECT main_balance, full_name FROM users WHERE id = $1', [userId]),
      pool.query(
        'SELECT id, type, amount, category, description, created_at FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
        [userId]
      ),
      pool.query(
        'SELECT id, name, type, target_amount, current_amount FROM goals WHERE user_id = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 3',
        [userId]
      ),
      pool.query(
        'SELECT total_points, spent_points, current_streak_days, last_activity_date FROM user_points WHERE user_id = $1',
        [userId]
      )
    ]);

    const user = userRes.rows[0];
    const points = pointsRes.rows[0];
    const availablePoints = (points?.total_points ?? 0) - (points?.spent_points ?? 0);

    res.json({
      balance: user?.main_balance ?? 0,
      full_name: user?.full_name,
      recent_transactions: txRes.rows,
      active_goals: goalsRes.rows,
      points: {
        available: availablePoints,
        streak_days: points?.current_streak_days ?? 0,
        last_activity_date: points?.last_activity_date
      }
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
