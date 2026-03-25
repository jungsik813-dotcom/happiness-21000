-- 전체 데이터 삭제 (되돌릴 수 없음)
-- Supabase SQL Editor에서 실행하세요.

-- 1. 거래내역 삭제
DELETE FROM transactions;

-- 2. 펀딩 목표 삭제
DELETE FROM goals;

-- 3. 학생 삭제
DELETE FROM profiles;

-- 4. 중앙 금고 초기화 (발행 이력 포함)
UPDATE vault SET
  central_balance = 0,
  issuance_total = 0,
  issuance_count = 0;

-- 5. 학생 다시 추가 (빈 상태로 시작하려면 이 블록 삭제하고 실행)
-- INSERT INTO profiles (name, balance) VALUES
--   ('학생1', 0),
--   ('학생2', 0);
