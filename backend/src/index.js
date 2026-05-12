require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const goalsRoutes = require('./routes/goals');
const socialRoutes = require('./routes/social');
const transactionsRoutes = require('./routes/transactions');
const reelsRoutes = require('./routes/reels');
const tasksRoutes = require('./routes/tasks');
const rewardsRoutes = require('./routes/rewards');
const dashboardRoutes = require('./routes/dashboard');
const { errorHandler } = require('./middleware/error');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/reels', reelsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`İş Bankası API http://localhost:${PORT}`));
