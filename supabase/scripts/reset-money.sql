-- 돈 관련 데이터 전부 초기화
-- Supabase SQL Editor에서 실행하세요.
-- ⚠️ 실행 후 되돌릴 수 없습니다. 테스트용으로만 사용하세요.

-- 1. 거래내역 삭제
DELETE FROM transactions;

-- 2. 펀딩 목표 금액 초기화 (목표는 유지, 모인 금액만 0으로)
UPDATE goals SET current_amount = 0;

-- 3. 학생 잔액 0으로
UPDATE profiles SET balance = 0;

-- 4. 중앙 금고 + 채굴 이력 초기화
UPDATE vault SET
  central_balance = 0,
  issuance_total = 0,
  issuance_count = 0;

-- (선택) NFC 등록도 초기화하려면 아래 주석 해제
-- UPDATE profiles SET nfc_tag_id = NULL;
