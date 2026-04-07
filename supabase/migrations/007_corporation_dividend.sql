-- 법인 계정 + 지분 + 배당 기능

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'STUDENT';
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_account_type_check CHECK (account_type IN ('STUDENT', 'CORPORATION'));

CREATE TABLE IF NOT EXISTS corporation_shares (
  corporation_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  share_count smallint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (corporation_id, student_id),
  CONSTRAINT corporation_shares_range_check CHECK (share_count >= 0 AND share_count <= 10)
);

CREATE INDEX IF NOT EXISTS idx_corporation_shares_corp ON corporation_shares(corporation_id);
CREATE INDEX IF NOT EXISTS idx_corporation_shares_student ON corporation_shares(student_id);

COMMENT ON COLUMN profiles.account_type IS 'STUDENT | CORPORATION';
COMMENT ON TABLE corporation_shares IS '법인별 학생 주식 보유량 (총합 10 권장)';
