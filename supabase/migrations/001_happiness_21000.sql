-- 21,000 행복 학급 화폐 시스템 스키마
-- Supabase SQL Editor에서 순서대로 실행하세요.

-- 1. vault 테이블에 발행 관련 컬럼 추가 (기존 vault가 있는 경우)
ALTER TABLE vault ADD COLUMN IF NOT EXISTS issuance_total bigint DEFAULT 0;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS issuance_count integer DEFAULT 0;

-- 2. goals (펀딩 목표) 테이블
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_amount bigint NOT NULL DEFAULT 0,
  current_amount bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. transactions에 to_goal_id 추가 (펀딩 기부용)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_goal_id uuid REFERENCES goals(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tx_type text;
-- 기존 tx_type 컬럼이 있다면 위에서 무시됨. 없으면 생성됨.

-- 4. RLS (필요시)
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for goals" ON goals FOR ALL USING (true) WITH CHECK (true);

-- 5. 기존 vault 행에 issuance 초기값 설정
UPDATE vault SET issuance_total = COALESCE(issuance_total, 0), issuance_count = COALESCE(issuance_count, 0);
