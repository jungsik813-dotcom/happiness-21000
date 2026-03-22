-- profiles 테이블에 NFC 태그 ID 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nfc_tag_id text UNIQUE;

COMMENT ON COLUMN profiles.nfc_tag_id IS 'NFC 태그 시리얼 번호 (Web NFC serialNumber)';
