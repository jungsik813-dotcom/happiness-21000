-- 평일 송금 시간 제한(영업시간) 적용 여부. false면 시간 제한 없이 송금 가능 (관리자 토글)
ALTER TABLE vault ADD COLUMN IF NOT EXISTS transfer_hours_enforced boolean DEFAULT true;
COMMENT ON COLUMN vault.transfer_hours_enforced IS 'true면 평일 08:30~15:30(KST)만 송금, false면 시간 제한 없음';
UPDATE vault SET transfer_hours_enforced = COALESCE(transfer_hours_enforced, true);
