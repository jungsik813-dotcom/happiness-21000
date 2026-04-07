-- 1) 감사 로그
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL DEFAULT 'ADMIN',
  actor_id text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- 2) 법인 지분 총합(10) DB 레벨 강제
CREATE OR REPLACE FUNCTION check_corporation_share_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  corp_id uuid;
  total_shares integer;
BEGIN
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

DROP TRIGGER IF EXISTS trg_check_corporation_share_total ON corporation_shares;
CREATE CONSTRAINT TRIGGER trg_check_corporation_share_total
AFTER INSERT OR UPDATE OR DELETE ON corporation_shares
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_corporation_share_total();

-- 3) 원자적 배당 RPC
CREATE OR REPLACE FUNCTION apply_corporation_dividend(
  p_corporation_id uuid,
  p_total_amount numeric,
  p_message text
)
RETURNS TABLE(ok boolean, message text, remaining_balance numeric)
LANGUAGE plpgsql
AS $$
DECLARE
  v_corp_name text;
  v_corp_balance numeric;
  v_total_cents bigint;
  v_tax_cents bigint;
  v_dist_cents bigint;
  v_tax_amount numeric;
  v_dist_amount numeric;
  v_share_total integer;
  v_goal_id uuid;
  v_goal_name text;
  v_vault_id uuid;
  v_now timestamptz;
  v_is_weekday boolean;
  v_kst_hour int;
  v_kst_min int;
  v_kst_hhmm int;
  rec record;
BEGIN
  IF p_message IS NULL OR length(trim(p_message)) < 10 THEN
    RETURN QUERY SELECT false, '배당 사유는 10자 이상 입력해주세요.', NULL::numeric;
    RETURN;
  END IF;

  -- 평일 08:30~15:30 가드 (KST)
  v_now := now() AT TIME ZONE 'Asia/Seoul';
  v_is_weekday := EXTRACT(ISODOW FROM v_now) BETWEEN 1 AND 5;
  v_kst_hour := EXTRACT(HOUR FROM v_now);
  v_kst_min := EXTRACT(MINUTE FROM v_now);
  v_kst_hhmm := v_kst_hour * 100 + v_kst_min;
  IF NOT v_is_weekday OR v_kst_hhmm < 830 OR v_kst_hhmm > 1530 THEN
    RETURN QUERY SELECT false, '현재는 거래 가능 시간이 아닙니다. (평일 08:30~15:30)', NULL::numeric;
    RETURN;
  END IF;

  SELECT name, balance INTO v_corp_name, v_corp_balance
  FROM profiles
  WHERE id = p_corporation_id AND account_type = 'CORPORATION'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '법인 계정을 찾을 수 없습니다.', NULL::numeric;
    RETURN;
  END IF;

  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RETURN QUERY SELECT false, '총 배당 금액이 올바르지 않습니다.', NULL::numeric;
    RETURN;
  END IF;

  v_total_cents := round(p_total_amount * 100);
  IF v_total_cents < 1 THEN
    RETURN QUERY SELECT false, '총 배당 금액이 너무 작습니다.', NULL::numeric;
    RETURN;
  END IF;

  IF v_corp_balance < p_total_amount THEN
    RETURN QUERY SELECT false, '법인 잔액이 부족합니다.', NULL::numeric;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(share_count), 0)::int INTO v_share_total
  FROM corporation_shares
  WHERE corporation_id = p_corporation_id;
  IF v_share_total <> 10 THEN
    RETURN QUERY SELECT false, '지분 총합이 10이 아닙니다. 관리자에게 문의하세요.', NULL::numeric;
    RETURN;
  END IF;

  v_tax_cents := floor(v_total_cents * 0.1);
  v_dist_cents := v_total_cents - v_tax_cents;
  v_tax_amount := v_tax_cents / 100.0;
  v_dist_amount := v_dist_cents / 100.0;

  -- 10% 세금: 활성 펀딩 우선, 없으면 금고
  SELECT id, name INTO v_goal_id, v_goal_name
  FROM goals
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_tax_cents > 0 THEN
    IF v_goal_id IS NOT NULL THEN
      UPDATE goals
      SET current_amount = current_amount + v_tax_amount
      WHERE id = v_goal_id;

      INSERT INTO transactions (tx_type, amount, from_profile_id, to_profile_id, to_goal_id, memo)
      VALUES ('dividend_tax', v_tax_amount, p_corporation_id, NULL, v_goal_id, '법인 배당 세금 10% → 펀딩 | ' || p_message);
    ELSE
      SELECT id INTO v_vault_id FROM vault LIMIT 1 FOR UPDATE;
      IF v_vault_id IS NULL THEN
        RETURN QUERY SELECT false, '중앙 금고를 찾을 수 없습니다.', NULL::numeric;
        RETURN;
      END IF;
      UPDATE vault
      SET central_balance = central_balance + v_tax_amount
      WHERE id = v_vault_id;

      INSERT INTO transactions (tx_type, amount, from_profile_id, to_profile_id, to_goal_id, memo)
      VALUES ('dividend_tax', v_tax_amount, p_corporation_id, NULL, NULL, '법인 배당 세금 10% → 중앙 금고 | ' || p_message);
    END IF;
  END IF;

  -- 90% 분배
  FOR rec IN
    WITH base AS (
      SELECT
        cs.student_id,
        cs.share_count,
        floor((v_dist_cents * cs.share_count) / 10.0)::bigint AS cents_base
      FROM corporation_shares cs
      JOIN profiles p ON p.id = cs.student_id
      WHERE cs.corporation_id = p_corporation_id
        AND p.account_type = 'STUDENT'
        AND cs.share_count > 0
    ),
    rem AS (
      SELECT
        (v_dist_cents - COALESCE(SUM(cents_base), 0))::bigint AS remain
      FROM base
    ),
    ranked AS (
      SELECT
        b.student_id,
        b.share_count,
        (b.cents_base + CASE
          WHEN row_number() OVER (ORDER BY b.student_id) <= (SELECT remain FROM rem) THEN 1
          ELSE 0
        END)::bigint AS cents
      FROM base b
    )
    SELECT * FROM ranked
  LOOP
    IF rec.cents > 0 THEN
      UPDATE profiles
      SET balance = balance + (rec.cents / 100.0)
      WHERE id = rec.student_id;

      INSERT INTO transactions (tx_type, amount, from_profile_id, to_profile_id, to_goal_id, memo)
      VALUES ('dividend', rec.cents / 100.0, p_corporation_id, rec.student_id, NULL, '법인 배당 (' || rec.share_count || '주) | ' || p_message);
    END IF;
  END LOOP;

  UPDATE profiles
  SET balance = balance - (v_total_cents / 100.0)
  WHERE id = p_corporation_id;

  INSERT INTO audit_logs(actor_type, actor_id, action, target_type, target_id, detail)
  VALUES (
    'CORPORATION',
    p_corporation_id::text,
    'dividend.executed',
    'corporation',
    p_corporation_id::text,
    jsonb_build_object(
      'totalAmount', p_total_amount,
      'taxAmount', v_tax_amount,
      'distributedAmount', v_dist_amount,
      'message', p_message
    )
  );

  RETURN QUERY
  SELECT true, '배당이 완료되었습니다. (10% 세금/90% 지분 분배)', (SELECT balance FROM profiles WHERE id = p_corporation_id);
END;
$$;
