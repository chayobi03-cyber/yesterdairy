# 하루별 (Family Growth Diary)

우리 가족만 쓰는 프라이빗 성장 다이어리 PWA. Next.js (App Router) + Supabase.

## 설정

1. Supabase 프로젝트를 만들고 `supabase/migrations/0001_init.sql`을 실행합니다
   (Supabase SQL Editor에 붙여넣거나 `supabase db push` 사용).
2. `.env.local.example`을 `.env.local`로 복사하고 프로젝트 URL/키를 채웁니다.
3. `scripts/seed-family.mjs`의 `MEMBERS`를 실제 가족 이메일/이름으로 수정한 뒤 한 번 실행합니다:
   ```bash
   node --env-file=.env.local scripts/seed-family.mjs
   ```
   가입 화면이 따로 없으므로(가족 전용 앱), 계정은 이 스크립트로만 생성합니다.
4. 개발 서버 실행:
   ```bash
   npm run dev
   ```

## 구조

- `src/app/(app)/` — 로그인 후 화면 (오늘/기록/달력/가족)
- `src/app/login/` — 로그인 (가입 없음, family-only)
- `src/app/actions.ts` — 서버 액션 (기록 생성, 리액션, 로그아웃)
- `src/lib/supabase/` — 브라우저/서버/미들웨어용 Supabase 클라이언트
- `supabase/migrations/` — DB 스키마 + RLS (private-first)
- `public/manifest.webmanifest`, `public/sw.js` — PWA 매니페스트 + 오프라인 셸 캐싱

## 현재 범위 (1차 MVP)

포함: 로그인, 오늘 기록(카테고리 5종 + 한 줄 + 사진 최대 5장 + 공개범위), 월간 캘린더, 가족 피드 + 리액션.

보류 (PRD 참고): 성장 시각화(나무/별자리), 배지/게임화, 원본/디스플레이/썸네일 리사이즈 파이프라인(현재는 원본만 업로드), 댓글 UI, Google Calendar 연동.
