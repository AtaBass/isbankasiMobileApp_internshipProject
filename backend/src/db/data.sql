-- İş Bankası Genç - Örnek veri (data.sql)
-- Kullanım: psql -U postgres -d isb_bank -f src/db/data.sql
-- Önce schema ve migration çalıştırılmış olmalı.

-- Şifre hash için (demo kullanıcı)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Demo kullanıcı (şifre: demo123)
INSERT INTO users (email, password_hash, full_name, main_balance)
VALUES (
  'demo@isb.com',
  crypt('demo123', gen_salt('bf', 10)),
  'Demo Kullanıcı',
  5000
)
ON CONFLICT (email) DO NOTHING;

-- Demo kullanıcı için puan kaydı (user_points)
INSERT INTO user_points (user_id, total_points, spent_points, current_streak_days)
SELECT id, 0, 0, 0 FROM users WHERE email = 'demo@isb.com'
ON CONFLICT (user_id) DO NOTHING;

-- Reels (finansal okuryazarlık videoları)
INSERT INTO reels (title, description, video_url, duration_seconds, points_reward, category, is_active)
SELECT * FROM (VALUES
  ('Bütçe Nasıl Yapılır?', 'Aylık bütçe planlama', 'https://example.com/v1', 120, 10, 'budget', true),
  ('Tasarruf İpuçları', 'Günlük tasarruf', 'https://example.com/v2', 90, 10, 'savings', true),
  ('Yatırım 101', 'Temel yatırım kavramları', 'https://example.com/v3', 180, 15, 'investment', true),
  ('Bileşik Faiz Nedir?', 'Faiz hesaplama', 'https://example.com/v4', 142, 12, 'investment', true)
) AS v(title, description, video_url, duration_seconds, points_reward, category, is_active)
WHERE NOT EXISTS (SELECT 1 FROM reels LIMIT 1);

-- Görevler (Tasks)
INSERT INTO tasks (title, description, points_reward, type, is_active)
SELECT * FROM (VALUES
  ('İlk Hedefini Oluştur', 'Bir birikim hedefi ekle', 50, 'one_time', true),
  ('3 Video İzle', 'Finansal okuryazarlık videoları', 30, 'one_time', true),
  ('Arkadaşını Davet Et', 'İş-Gen''e birini davet et', 500, 'one_time', true)
) AS v(title, description, points_reward, type, is_active)
WHERE NOT EXISTS (SELECT 1 FROM tasks LIMIT 1);

-- Ödüller (Rewards)
INSERT INTO rewards (name, description, points_cost, type, is_active)
SELECT * FROM (VALUES
  ('%5 Cashback', 'Sonraki alışverişte %5 iade', 200, 'cashback', true),
  ('Sinema Bileti', '1 kişilik sinema', 150, 'cinema', true),
  ('Konser İndirimi', '50 TL indirim kuponu', 300, 'concert', true),
  ('50 TL Cashback', '50 TL nakit iade', 5000, 'cashback', true),
  ('Sinema Bileti (Herhangi)', 'Herhangi bir film', 3000, 'cinema', true),
  ('Özel Konser Bileti', 'Seçili konserlere erişim', 15000, 'concert', true)
) AS v(name, description, points_cost, type, is_active)
WHERE NOT EXISTS (SELECT 1 FROM rewards LIMIT 1);
