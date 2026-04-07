-- 사이트 문구·소수점 자릿수, 금액 numeric, 학생 삭제 시 거래 FK 완화

-- 1) vault: 브라우저/헤더용 문구 + 클로버 소수 자릿수 (0=정수만, 1=첫째, 2=둘째)
ALTER TABLE vault ADD COLUMN IF NOT EXISTS site_title text;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS site_subtitle text;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS site_meta_description text;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS decimal_places smallint NOT NULL DEFAULT 0;

ALTER TABLE vault DROP CONSTRAINT IF EXISTS vault_decimal_places_check;
ALTER TABLE vault ADD CONSTRAINT vault_decimal_places_check CHECK (decimal_places IN (0, 1, 2));

UPDATE vault SET
  site_title = COALESCE(NULLIF(trim(site_title), ''), '2100 행복 시스템'),
  site_subtitle = COALESCE(NULLIF(trim(site_subtitle), ''), '칭찬과 함께 나누는 우리 반 클로버'),
  site_meta_description = COALESCE(NULLIF(trim(site_meta_description), ''), 'Next.js + Tailwind + Supabase 기반 학급 경제 앱')
WHERE id IS NOT NULL;

-- 2) 금액 컬럼을 numeric(16,2)로 (표시 자릿수는 앱 설정으로 제한)
ALTER TABLE profiles ALTER COLUMN balance TYPE numeric(16, 2) USING round(balance::numeric, 2);
ALTER TABLE vault ALTER COLUMN central_balance TYPE numeric(16, 2) USING round(central_balance::numeric, 2);
ALTER TABLE goals ALTER COLUMN target_amount TYPE numeric(16, 2) USING round(target_amount::numeric, 2);
ALTER TABLE goals ALTER COLUMN current_amount TYPE numeric(16, 2) USING round(current_amount::numeric, 2);
ALTER TABLE transactions ALTER COLUMN amount TYPE numeric(16, 2) USING round(amount::numeric, 2);

-- 3) 학생 삭제 시 거래 행은 유지하고 프로필 참조만 NULL
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_from_profile_id_fkey;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_from_profile_id_fkey
  FOREIGN KEY (from_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_to_profile_id_fkey;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_to_profile_id_fkey
  FOREIGN KEY (to_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN vault.site_title IS '브라우저 탭 제목·메인 헤더 큰 제목';
COMMENT ON COLUMN vault.site_subtitle IS '메인 헤더 부제목';
COMMENT ON COLUMN vault.site_meta_description IS 'meta description';
COMMENT ON COLUMN vault.decimal_places IS '0=정수, 1=소수 첫째, 2=소수 둘째까지';
