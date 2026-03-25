-- Supabase SQL Editor에 전체 복사해서 Run 실행
-- ※ 이미 학생이 있으면 맨 아래 INSERT 블록을 삭제하고 실행하세요

-- ========== 000_init ==========
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  balance bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  central_balance bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault LIMIT 1) THEN
    INSERT INTO vault (central_balance) VALUES (0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount bigint NOT NULL,
  from_profile_id uuid REFERENCES profiles(id),
  to_profile_id uuid REFERENCES profiles(id),
  memo text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all profiles" ON profiles;
CREATE POLICY "Allow anon all profiles" ON profiles FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all vault" ON vault;
CREATE POLICY "Allow anon all vault" ON vault FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all transactions" ON transactions;
CREATE POLICY "Allow anon all transactions" ON transactions FOR ALL TO anon USING (true) WITH CHECK (true);

-- ========== 001 ==========
ALTER TABLE vault ADD COLUMN IF NOT EXISTS issuance_total bigint DEFAULT 0;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS issuance_count integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_amount bigint NOT NULL DEFAULT 0,
  current_amount bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_goal_id uuid REFERENCES goals(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tx_type text;

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for goals" ON goals;
CREATE POLICY "Allow all for goals" ON goals FOR ALL USING (true) WITH CHECK (true);

UPDATE vault SET issuance_total = COALESCE(issuance_total, 0), issuance_count = COALESCE(issuance_count, 0);

-- ========== 002 ==========
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nfc_tag_id text UNIQUE;

-- ========== 003 ==========
ALTER TABLE vault ADD COLUMN IF NOT EXISTS fair_mode boolean DEFAULT false;

-- ========== 004 ==========
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash text;
UPDATE profiles SET password_hash = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0' WHERE password_hash IS NULL;

-- ========== 005 ==========
ALTER TABLE vault ADD COLUMN IF NOT EXISTS transfer_hours_enforced boolean DEFAULT true;
UPDATE vault SET transfer_hours_enforced = COALESCE(transfer_hours_enforced, true);

-- ========== 학생 추가 (이름 수정 후 사용, 최초 1회만) ==========
INSERT INTO profiles (name, balance) VALUES
  ('김철수', 0),
  ('이영희', 0),
  ('박민수', 0);
