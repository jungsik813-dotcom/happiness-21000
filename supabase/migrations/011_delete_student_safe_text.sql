-- 숫자형/UUID 혼용 ID 환경에서도 안전하게 동작하는 학생 삭제 함수
-- 기존 함수 오버로드 충돌을 피하기 위해 새 함수명 사용

DROP FUNCTION IF EXISTS admin_delete_student_with_balance_transfer(uuid);
DROP FUNCTION IF EXISTS admin_delete_student_with_balance_transfer(text);
DROP FUNCTION IF EXISTS admin_delete_student_with_balance_transfer_safe(text);

CREATE OR REPLACE FUNCTION admin_delete_student_with_balance_transfer_safe(
  p_student_id text
)
RETURNS TABLE(ok boolean, message text, transferred_amount numeric)
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id profiles.id%TYPE;
  v_name text;
  v_balance numeric;
  v_vault_id uuid;
BEGIN
  IF p_student_id IS NULL OR length(trim(p_student_id)) = 0 THEN
    RETURN QUERY SELECT false, '올바른 학생 ID가 아닙니다.', 0::numeric;
    RETURN;
  END IF;

  SELECT id, name, balance
  INTO v_student_id, v_name, v_balance
  FROM profiles
  WHERE id::text = trim(p_student_id)
    AND account_type = 'STUDENT'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '학생 계정을 찾을 수 없습니다.', 0::numeric;
    RETURN;
  END IF;

  v_balance := COALESCE(v_balance, 0);

  IF v_balance > 0 THEN
    SELECT id INTO v_vault_id
    FROM vault
    LIMIT 1
    FOR UPDATE;

    IF v_vault_id IS NULL THEN
      RETURN QUERY SELECT false, '중앙 금고를 찾을 수 없습니다.', 0::numeric;
      RETURN;
    END IF;

    UPDATE vault
    SET central_balance = COALESCE(central_balance, 0) + v_balance
    WHERE id = v_vault_id;

    -- from_profile_id는 uuid 칼럼이므로 숫자형 ID 호환을 위해 NULL 저장
    INSERT INTO transactions (tx_type, amount, from_profile_id, to_profile_id, to_goal_id, memo)
    VALUES (
      'vault_deposit',
      v_balance,
      NULL,
      NULL,
      NULL,
      '학생 삭제 전 잔액 중앙 금고 이관 | ' || COALESCE(v_name, '이름 없음') || ' (id=' || v_student_id::text || ')'
    );
  END IF;

  DELETE FROM profiles
  WHERE id = v_student_id
    AND account_type = 'STUDENT';

  RETURN QUERY SELECT true, '학생 명단에서 제거되었습니다.', v_balance;
END;
$$;
