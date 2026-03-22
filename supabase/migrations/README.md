# Supabase 마이그레이션

`001_happiness_21000.sql` 파일의 SQL을 **Supabase Dashboard → SQL Editor**에서 순서대로 실행하세요.

실행 후 다음이 추가됩니다:

- `vault`: `issuance_total`, `issuance_count` 컬럼
- `goals`: 펀딩 목표 테이블
- `transactions`: `to_goal_id` 컬럼 (펀딩 기부 시 사용)
