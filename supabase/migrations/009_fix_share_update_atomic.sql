-- 지분 변경 시 delete->insert 중간 상태(합계 0) 에러를 피하기 위한 보완

-- 트리거 함수: 내부 원자 교체 함수에서만 검사 일시 스킵 허용
CREATE OR REPLACE FUNCTION check_corporation_share_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  corp_id uuid;
  total_shares integer;
  skip_check text;
BEGIN
  skip_check := current_setting('app.skip_share_total_check', true);
  IF skip_check = 'on' THEN
    RETURN NULL;
  END IF;

  corp_id := COALESCE(NEW.corporation_id, OLD.corporation_id);
  SELECT COALESCE(SUM(share_count), 0) INTO total_shares
  FROM corporation_shares
  WHERE corporation_id = corp_id;

  IF total_shares <> 10 THEN
    RAISE EXCEPTION 'corporation_shares total must be 10 (corp %, total %)', corp_id, total_shares;
  END IF;
  RETURN NULL;
END;
$$;

-- 관리자 지분 교체 RPC (원자적)
CREATE OR REPLACE FUNCTION admin_replace_corporation_shares(
  p_corporation_id uuid,
  p_holdings jsonb
)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total integer;
  v_item jsonb;
  v_student_id uuid;
  v_share_count integer;
BEGIN
  IF p_corporation_id IS NULL THEN
    RETURN QUERY SELECT false, '법인 ID 오류';
    RETURN;
  END IF;

  IF p_holdings IS NULL OR jsonb_typeof(p_holdings) <> 'array' THEN
    RETURN QUERY SELECT false, 'holdings 형식이 올바르지 않습니다.';
    RETURN;
  END IF;

  -- 입력값 검증
  SELECT COALESCE(SUM((x->>'shareCount')::int), 0)
  INTO v_total
  FROM jsonb_array_elements(p_holdings) AS x;

  IF v_total <> 10 THEN
    RETURN QUERY SELECT false, '주식 총합은 10이어야 합니다.';
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_holdings)
  LOOP
    v_student_id := (v_item->>'studentId')::uuid;
    v_share_count := (v_item->>'shareCount')::int;
    IF v_student_id IS NULL OR v_share_count IS NULL OR v_share_count < 0 OR v_share_count > 10 THEN
      RETURN QUERY SELECT false, '주식 수는 0~10 정수여야 합니다.';
      RETURN;
    END IF;
  END LOOP;

  -- 중간 상태 검사 스킵 후 원자 교체
  PERFORM set_config('app.skip_share_total_check', 'on', true);

  DELETE FROM corporation_shares
  WHERE corporation_id = p_corporation_id;

  INSERT INTO corporation_shares (corporation_id, student_id, share_count)
  SELECT
    p_corporation_id,
    (x->>'studentId')::uuid,
    (x->>'shareCount')::int
  FROM jsonb_array_elements(p_holdings) AS x
  WHERE (x->>'shareCount')::int > 0;

  -- 최종 상태 재검증
  SELECT COALESCE(SUM(share_count), 0)
  INTO v_total
  FROM corporation_shares
  WHERE corporation_id = p_corporation_id;

  IF v_total <> 10 THEN
    RAISE EXCEPTION 'corporation_shares total must be 10 (corp %, total %)', p_corporation_id, v_total;
  END IF;

  RETURN QUERY SELECT true, '주식 보유 현황이 저장되었습니다.';
END;
$$;
