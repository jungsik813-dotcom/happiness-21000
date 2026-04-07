-- 법인 삭제 정책: 잔액/지분 소각 후 삭제 허용
-- 지분 총합 10 트리거와 충돌하지 않도록 삭제 트랜잭션 내에서 검사 스킵

DROP FUNCTION IF EXISTS admin_delete_corporation_burn(uuid);

CREATE OR REPLACE FUNCTION admin_delete_corporation_burn(
  p_corporation_id uuid
)
RETURNS TABLE(ok boolean, message text, burned_amount numeric)
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF p_corporation_id IS NULL THEN
    RETURN QUERY SELECT false, '법인 ID 오류', 0::numeric;
    RETURN;
  END IF;

  SELECT balance
  INTO v_balance
  FROM profiles
  WHERE id = p_corporation_id
    AND account_type = 'CORPORATION'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '법인 계정을 찾을 수 없습니다.', 0::numeric;
    RETURN;
  END IF;

  v_balance := COALESCE(v_balance, 0);

  -- 법인 삭제 시 지분 10강제 트리거를 우회 (해당 트랜잭션에서만)
  PERFORM set_config('app.skip_share_total_check', 'on', true);

  DELETE FROM profiles
  WHERE id = p_corporation_id
    AND account_type = 'CORPORATION';

  RETURN QUERY SELECT true, '법인이 제거되었습니다.', v_balance;
END;
$$;

NOTIFY pgrst, 'reload schema';
