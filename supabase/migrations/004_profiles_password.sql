-- 학생 4자리 비밀번호 (해시 저장)
-- 초기 비밀번호: 0000 (SHA-256 해시)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash text;

-- 초기값: '0000'의 SHA-256 해시
UPDATE profiles SET password_hash = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0' WHERE password_hash IS NULL;

COMMENT ON COLUMN profiles.password_hash IS '학생 4자리 비밀번호 SHA-256 해시 (hex)';
