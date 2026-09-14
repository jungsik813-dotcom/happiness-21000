-- vault에 가이드 HTML 저장 컬럼 추가
ALTER TABLE vault ADD COLUMN IF NOT EXISTS guide_html text;

COMMENT ON COLUMN vault.guide_html IS '학급화폐 가이드 페이지 HTML (관리자 편집)';
