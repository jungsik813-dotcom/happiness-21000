# 2100 행복 시스템 (Boilerplate)

Next.js + Tailwind CSS + Supabase로 시작하는 학급 경제 앱 기본 템플릿입니다.

## 포함된 것

- Next.js App Router + TypeScript
- Tailwind CSS 기반 다크 모드 UI
- 비트코인 오렌지 포인트 컬러
- 메인 타이틀: `2100 행복 시스템`
- Supabase 브라우저/서버 클라이언트 유틸

## 시작 방법

1. Node.js 20+ 설치
2. 의존성 설치
   - `npm install`
3. 환경 변수 파일 생성
   - `.env.example` 복사해서 `.env.local` 생성
4. Supabase 값 입력
5. 개발 서버 실행
   - `npm run dev`

## 기본 구조

```txt
src/
  app/
    globals.css
    layout.tsx
    page.tsx
  components/
    layout/
      main-header.tsx
  lib/
    supabase/
      client.ts
      server.ts
```
