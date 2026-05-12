const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

async function seed() {
  const hashed = await bcrypt.hash('demo123', 10);

  await pool.query(`
    INSERT INTO users (email, password_hash, full_name, main_balance)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) DO NOTHING
  `, ['demo@isb.com', hashed, 'Demo Kullanıcı', 5000]);

  const { rows: reels } = await pool.query('SELECT id FROM reels LIMIT 1');

  if (reels.length === 0) {
    await pool.query(`
      INSERT INTO reels (title, description, video_url, duration_seconds, points_reward, category) VALUES
      ('Bütçe Nasıl Yapılır?', 'Aylık bütçe planlama', 'https://example.com/v1', 120, 10, 'budget'),
      ('Tasarruf İpuçları', 'Günlük tasarruf', 'https://example.com/v2', 90, 10, 'savings'),
      ('Yatırım 101', 'Temel yatırım kavramları', 'https://example.com/v3', 180, 15, 'investment')
    `);
  }

  const { rows: tasks } = await pool.query('SELECT id FROM tasks LIMIT 1');
  if (tasks.length === 0) {
    await pool.query(`
      INSERT INTO tasks (title, description, points_reward, type) VALUES
      ('İlk Hedefini Oluştur', 'Bir birikim hedefi ekle', 50, 'one_time'),
      ('3 Video İzle', 'Finansal okuryazarlık videoları', 30, 'one_time')
    `);
  }

  const { rows: rewards } = await pool.query('SELECT id FROM rewards LIMIT 1');
  if (rewards.length === 0) {
    await pool.query(`
      INSERT INTO rewards (name, description, points_cost, type) VALUES
      ('%5 Cashback', 'Sonraki alışverişte %5 iade', 200, 'cashback'),
      ('Sinema Bileti', '1 kişilik sinema', 150, 'cinema'),
      ('Konser İndirimi', '50 TL indirim kuponu', 300, 'concert')
    `);
  }

  console.log('Seed completed.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
