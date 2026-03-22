-- 장터 모드 On/Off: On이면 P2P 송금 한도 100%로 해제
ALTER TABLE vault ADD COLUMN IF NOT EXISTS fair_mode boolean DEFAULT false;
COMMENT ON COLUMN vault.fair_mode IS '장터 모드. true면 P2P 송금 한도 100% 해제';
