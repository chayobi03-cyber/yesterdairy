# 하루별 (Family Growth Diary)

우리 가족만 쓰는 프라이빗 성장 다이어리 PWA. Next.js (App Router) + Supabase.

## 설정

1. Supabase 프로젝트를 만들고 `supabase/migrations/0001_init.sql`을 실행합니다
   (Supabase SQL Editor에 붙여넣거나 `supabase db push` 사용).
2. `.env.local.example`을 `.env.local`로 복사하고 프로젝트 URL/anon key를 채웁니다.
3. 개발 서버 실행:
   ```bash
   npm run dev
   ```
4. 가족 중 한 명이 `/signup`으로 가입 후 "새 가족 만들기"로 가족을 만들면
   6자리 초대 코드가 발급됩니다(가족 피드 화면 상단에 표시). 나머지 가족은
   `/signup` → "초대 코드로 참여하기"로 그 코드를 입력해 합류합니다.
   가입은 열려 있지만, 초대 코드를 모르면 남의 가족 기록에 접근할 수 없습니다
   (RLS로 private-first가 강제됨).

## 구조

- `src/app/(app)/` — 로그인 후 화면 (오늘/기록/달력/가족)
- `src/app/login/`, `src/app/signup/` — 로그인/가입
- `src/app/onboarding/` — 가입 직후 가족 생성/참여 화면
- `src/app/actions.ts` — 서버 액션 (기록 생성, 리액션, 가족 생성/참여, 로그아웃)
- `src/lib/supabase/` — 브라우저/서버/미들웨어용 Supabase 클라이언트
- `supabase/migrations/` — DB 스키마 + RLS (private-first) + 초대 코드 조회 함수
- `public/manifest.webmanifest`, `public/sw.js` — PWA 매니페스트 + 오프라인 셸 캐싱

## 현재 범위 (1차 MVP)

포함: 로그인, 오늘 기록(카테고리 5종 + 한 줄 + 사진 최대 5장 + 공개범위), 월간 캘린더, 가족 피드 + 리액션.

보류 (PRD 참고): 성장 시각화(나무/별자리), 배지/게임화, 원본/디스플레이/썸네일 리사이즈 파이프라인(현재는 원본만 업로드), 댓글 UI, Google Calendar 연동.
