# Supabase 마이그레이션

**Supabase Dashboard → SQL Editor**에서 아래 파일들을 **순서대로** 실행하세요.

| 순서 | 파일 | 내용 |
|------|------|------|
| 1 | `000_init.sql` | profiles, vault, transactions 테이블 생성 + RLS |
| 2 | `001_happiness_21000.sql` | vault 컬럼 추가, goals 테이블, transactions 확장 |
| 3 | `002_profiles_nfc_tag.sql` | profiles에 nfc_tag_id (선택) |
| 4 | `003_vault_fair_mode.sql` | vault에 fair_mode (장터 모드) |
| 5 | `004_profiles_password.sql` | profiles에 password_hash (학생 비밀번호) |

## 데이터 로딩 오류가 날 때

"데이터 로딩 중 오류가 발생했습니다" 메시지가 보이면:

1. **profiles** 또는 **vault** 테이블이 없는 경우 → `000_init.sql` 실행
2. **RLS 정책** 미설정 → `000_init.sql`의 RLS 섹션 실행
3. **vault에 행이 없음** → `INSERT INTO vault (central_balance) VALUES (0);` 실행
4. **학생 데이터** 추가 → `INSERT INTO profiles (name, balance) VALUES ('학생이름', 0);`
