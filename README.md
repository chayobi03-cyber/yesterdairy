# 하루별 (Family Growth Diary)

우리 가족만 쓰는 프라이빗 성장 다이어리 PWA. Next.js (App Router) + Supabase.

## 설정

1. Supabase 프로젝트를 만들고 `supabase/migrations/` 안의 SQL을 순서대로 실행합니다
   (Supabase SQL Editor에 붙여넣거나 `supabase db push` 사용).
2. `.env.local.example`을 `.env.local`로 복사하고 프로젝트 URL/anon key를 채웁니다.
3. 개발 서버 실행:
   ```bash
   npm run dev
   ```
4. 가족 중 한 명이 `/signup`에서 **아이디 + 닉네임 + 비밀번호**로 가입 후
   "새 가족 만들기"로 가족을 만들면 6자리 초대 코드가 발급됩니다(가족 피드
   화면 상단에 표시). 나머지 가족은 `/signup` → "초대 코드로 참여하기"로 그
   코드를 입력해 합류합니다. 가입은 열려 있지만, 초대 코드를 모르면 남의
   가족 기록에 접근할 수 없습니다 (RLS로 private-first가 강제됨).

이메일 주소는 전혀 쓰지 않습니다 — 가입 시 내부적으로 무작위 placeholder
이메일을 만들어 Supabase Auth에 등록하고, `login_identities` 테이블이
"아이디 → 그 placeholder 이메일"을 매핑해 로그인 화면에서 아이디+비밀번호로
로그인할 수 있게 해줍니다 (`supabase/migrations/0002_name_based_auth.sql`,
`0004_separate_username_nickname.sql`). 이메일 확인(confirm email) 절차는
DB 트리거로 즉시 처리되므로 Supabase 대시보드의 이메일 인증 설정과 무관하게
항상 동작합니다.

아이디(로그인용, `login_identities.username`)와 닉네임(가족 피드 등에
보이는 이름, `profiles.name`)은 별개입니다 — 설정 탭에서 닉네임을 바꿔도
로그인 아이디는 그대로예요.

## 구조

- `src/app/(app)/` — 로그인 후 화면 (오늘/기록/달력/가족)
- `src/app/login/`, `src/app/signup/` — 로그인/가입
- `src/app/onboarding/` — 가입 직후 가족 생성/참여 화면
- `src/app/actions.ts` — 서버 액션 (기록 생성, 리액션, 가족 생성/참여, 로그아웃)
- `src/lib/supabase/` — 브라우저/서버/미들웨어용 Supabase 클라이언트
- `supabase/migrations/` — DB 스키마 + RLS (private-first) + 초대 코드 조회 함수
- `public/manifest.webmanifest`, `public/sw.js` — PWA 매니페스트 + 오프라인 셸 캐싱

## 현재 범위

포함: 로그인, 오늘 기록(카테고리 5종 + 한 줄 + 사진 최대 5장 + 공개범위), 월간 캘린더,
가족 피드 + 리액션, 가족 목표(부모/아이 누구나, 응원 카운트), 캘린더 일정(미용실/약속 등).

목표는 결과 달성 압박이 아니라 "사소한 것도 응원받는" 걸 목적으로 해서,
가족간 순위나 벌점은 없고 응원(👏) 카운트만 누적됩니다.

홈 화면에는 "🎁 모은 아이템"도 있습니다 — 기록/목표 활동에 따라 **정해진
규칙으로만** 아이템이 해금돼요 (`src/lib/items.ts`). 랜덤 뽑기는 PRD의
게임화 원칙(도파민 자극용 랜덤 보상 금지)과 맞지 않아서 의도적으로 배제
했습니다.

가족 구성원마다 `/room/[userId]` 개인 공간(미니홈피 느낌)이 있고,
설정에서 나무/별자리/행성 중 자기 세계관을 직접 고를 수 있습니다
(가족 전체가 하나로 통일할 필요 없음). 공간에는 모은 아이템과 목표가
표시되는데, 본인이 아닌 경우 그 사람이 가족에게 공개한 것만 보입니다 —
`get_item_stats`가 별도 권한 체크 없이 기존 RLS에 그대로 얹혀 동작하는
구조라, 다른 사람 공간을 봐도 그 사람의 비공개 기록은 절대 새지 않습니다.

보류 (PRD 참고): 원본/디스플레이/썸네일 리사이즈 파이프라인(현재는 원본만 업로드), 댓글 UI, Google Calendar 연동, 가족 공유 일정(현재 일정은 개인 캘린더에만 표시).
