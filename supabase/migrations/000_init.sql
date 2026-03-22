-- 행복 장터 초기 스키마 (최초 1회 실행)
-- Supabase Dashboard → SQL Editor에서 이 파일을 먼저 실행하세요.
-- ※ profiles, vault, transactions가 이미 있다면 일부는 건너뛸 수 있습니다.

-- 1. profiles (학생 명단) - Supabase Auth 없이 사용하는 경우
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  balance bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. vault (중앙 금고) - 행이 없으면 주간 실행 시 오류. INSERT 한 번 필요
CREATE TABLE IF NOT EXISTS vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  central_balance bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- vault에 최소 1행 추가 (없는 경우)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault LIMIT 1) THEN
    INSERT INTO vault (central_balance) VALUES (0);
  END IF;
END $$;

-- 3. transactions (거래내역)
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount bigint NOT NULL,
  from_profile_id uuid REFERENCES profiles(id),
  to_profile_id uuid REFERENCES profiles(id),
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 4. RLS 설정 - anon 전체 권한 (이 프로젝트는 서버/클라이언트 모두 anon 키 사용)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ※ 보안 강화 시: SUPABASE_SERVICE_ROLE_KEY를 서버에 설정하고 아래 정책은 제거
DROP POLICY IF EXISTS "Allow anon all profiles" ON profiles;
CREATE POLICY "Allow anon all profiles" ON profiles FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all vault" ON vault;
CREATE POLICY "Allow anon all vault" ON vault FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all transactions" ON transactions;
CREATE POLICY "Allow anon all transactions" ON transactions FOR ALL TO anon USING (true) WITH CHECK (true);
