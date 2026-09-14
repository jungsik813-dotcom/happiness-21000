-- 법인(CORPORATION) 기능 전면 제거
-- 지분/배당 RPC·테이블 삭제, 법인 계정 프로필 삭제, account_type은 STUDENT만 허용

DROP FUNCTION IF EXISTS apply_corporation_dividend(uuid, numeric, text);
DROP FUNCTION IF EXISTS admin_replace_corporation_shares(uuid, jsonb);
DROP FUNCTION IF EXISTS admin_delete_corporation_burn(uuid);

-- 테이블을 먼저 제거하면 지분 총합 트리거도 함께 사라짐 (중간 삭제 시 total≠10 오류 방지)
DROP TABLE IF EXISTS corporation_shares CASCADE;
DROP FUNCTION IF EXISTS check_corporation_share_total();

DELETE FROM profiles WHERE account_type = 'CORPORATION';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_account_type_check CHECK (account_type IN ('STUDENT'));

COMMENT ON COLUMN profiles.account_type IS 'STUDENT only (법인 기능 제거됨)';
