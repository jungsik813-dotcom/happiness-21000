# Supabase 마이그레이션 가이드

**Supabase Dashboard** (https://supabase.com/dashboard) → 프로젝트 선택 → 왼쪽 메뉴 **SQL Editor** → **New query** 에서 아래 SQL들을 **순서대로** 복사해서 실행하세요.

---

## 1단계: 000_init.sql (필수)

테이블 `profiles`, `vault`, `transactions` 생성 + RLS 설정

```sql
-- 행복 장터 초기 스키마 (최초 1회 실행)
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
```

---

## 2단계: 001_happiness_21000.sql (필수)

vault 컬럼 추가, goals 테이블, transactions 확장

```sql
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
```

---

## 3단계: 002_profiles_nfc_tag.sql (선택)

NFC 사용하지 않으면 건너뛰어도 됨

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nfc_tag_id text UNIQUE;
COMMENT ON COLUMN profiles.nfc_tag_id IS 'NFC 태그 시리얼 번호 (Web NFC serialNumber)';
```

---

## 4단계: 003_vault_fair_mode.sql (필수)

장터 모드 토글용 컬럼

```sql
ALTER TABLE vault ADD COLUMN IF NOT EXISTS fair_mode boolean DEFAULT false;
COMMENT ON COLUMN vault.fair_mode IS '장터 모드. true면 P2P 송금 한도 100% 해제';
```

---

## 5단계: 004_profiles_password.sql (필수)

학생 4자리 비밀번호용 컬럼 (초기 비번: 0000)

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash text;
UPDATE profiles SET password_hash = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0' WHERE password_hash IS NULL;
COMMENT ON COLUMN profiles.password_hash IS '학생 4자리 비밀번호 SHA-256 해시 (hex)';
```

---

## 6단계: 학생 데이터 추가 (최초 1회)

아래에서 **학생 이름**만 바꿔서 실행. 여러 명이면 여러 줄 추가.

```sql
INSERT INTO profiles (name, balance) VALUES
  ('김철수', 0),
  ('이영희', 0),
  ('박민수', 0);
```

---

## 전체 한 번에 실행 (복사 붙여넣기용)

아래 전체를 복사해서 SQL Editor에 붙여넣고 **Run** 한 번만 누르면 됩니다.

```sql
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

-- ========== 002 (NFC - 선택) ==========
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nfc_tag_id text UNIQUE;

-- ========== 003 ==========
ALTER TABLE vault ADD COLUMN IF NOT EXISTS fair_mode boolean DEFAULT false;

-- ========== 004 ==========
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash text;
UPDATE profiles SET password_hash = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0' WHERE password_hash IS NULL;

-- ========== 학생 추가 (이름 수정 후 사용) ==========
INSERT INTO profiles (name, balance) VALUES
  ('김철수', 0),
  ('이영희', 0),
  ('박민수', 0);
```

> ⚠️ **학생 추가**: 위 `INSERT`는 **한 번만** 실행하세요. 두 번 실행하면 같은 학생이 중복됩니다. 이름을 원하는 대로 수정한 뒤 실행하세요. 이미 학생이 있으면 이 블록은 삭제하고 나머지만 실행하세요.
