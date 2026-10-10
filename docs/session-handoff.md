# 세션 인수인계 (2026-10-10, 가족 여행 기능)

다음 세션은 이 문서와 `docs/design-principles.md`(CLAUDE.md로 자동 로드)를 먼저 읽고 시작한다.

## 현재 상태 (모두 운영 반영 완료)

- 저장소 `chayobi03-cyber/yesterdairy`, **기본 브랜치/운영 브랜치는 `main`**, Vercel 프로덕션도 `main`
  (`yesterdairy.vercel.app`). 마지막 배포 `cbeff0b` (PR #4).
- Supabase 프로젝트 `fsifshgsmteicjdyrced` (Northstar). 마이그레이션 `0014`(여행), `0015`(소감·별점·사진) 적용됨.
- 여행 기능 요약: `/trips` 목록 → `/trips/[id]` (지도+목록 한 페이지, 낙관적 UI, 일정 편집/드래그,
  고정 시작 시각, 하루 요약, 소감·별점·사진) → `/trips/[id]/summary` (결정론적 요약, 인쇄).
- 코드 지도: 엔진 `src/lib/trip/engine.ts`, 순수 연산 `day-ops.ts`/`view-model.ts`/`summary.ts`/`photos.ts`,
  상태 훅 `use-trip-state.ts`, 화면 `src/app/(app)/trips/[id]/*`, 서버 액션 `src/app/(app)/trips/actions.ts`.
- 테스트: 단위/컴포넌트 150개(`npm run test:unit`), E2E `tests/e2e/trips.spec.ts`(CI는 운영 DB 사용).

## 사용자에게 남은 정리 (PC에서; 이 환경에서는 권한 분류기가 막음)

1. **E2E 테스트 계정·가족**: CI가 돌 때마다 쌓인다. Supabase SQL Editor에서 (나율이네/Yobi는 영향 없음):
   ```sql
   delete from public.trips where family_id in (select id from public.families where name like 'E2E%');
   delete from auth.users where id in (select user_id from public.family_members where family_id in (select id from public.families where name like 'E2E%'));
   delete from public.families where name like 'E2E%';
   ```
   정상이면 `families`=1, `auth.users`=4 (정리 직후 상태).
2. **Storage 테스트 파일**: `trip-media` 2개, `diary-media` 약 71개 — 대시보드 Storage에서 비운다(SQL로 지우면 실제 파일이 남을 수 있음).
3. **옛 브랜치**: `claude/family-trips`, `-ui`, `-v2`, `-reviews`, `claude/webapp-analysis-khlm9s` — 모두 병합 완료(끝 커밋이
   각 PR 마지막 커밋과 같음). GitHub Branches 화면에서 삭제.
4. (선택) `.claude/settings.json`에 `permissions.allow: ["mcp__Supabase__execute_sql"]`를 직접 추가하면
   다음부터 정리를 에이전트가 할 수 있다(권한이 넓으니 정리 후 제거 권장). 에이전트가 이 파일을 만들면 분류기가 막는다.

## 아직 확인하지 못한 것

- **실기기 검증 없음**: 끌어서 순서 바꾸기(터치), 폰 카메라/HEIC 사진 업로드, 인쇄(PDF 저장) 모양, 지도 터치 조작.
  자동 테스트는 컴포넌트/데스크톱 Chromium까지.
- **전주 템플릿의 좌표(`approx`)와 영업시간/요금**은 공식 출처로 검증하지 못했다(`docs/jeonju-template-research.md`).
- 사진 삭제 후 Storage 파일이 실제로 지워지는지는 "남은 파일 수가 늘지 않음"으로만 확인(`deleteTrip` 순서 수정 후).

## 다음에 할 만한 일 (우선순위 제안)

1. **사용자 피드백 반영**: 폰으로 써 본 불편함이 최우선.
2. **E2E 전용 Supabase 프로젝트**(또는 teardown): 푸시마다 운영 DB에 계정이 쌓이는 문제의 근본 해결.
3. **영업시간 충돌 경고**: 항목 시각이 영업시간 밖이면 표시(`hours`가 문자열이라 구조화 필요, 비용 없음).
4. **숙소/좌표 입력 개선**: 지도에서 핀을 눌러 좌표 지정, 숙소 좌표(지금은 좌표 없어 핀/이동시간 없음).
5. 오프라인 지원, 요약 공유 링크/PDF, 전주예술난장 개최 확인 시 템플릿에 선택 항목으로 복원.

## 작업 규칙 (이 사용자)

- 한국어로 답하고 **시각은 한국시간(KST)** 으로 적는다. 휴대폰으로 보는 경우가 많아 짧고 눌러볼 수 있는 안내를 선호.
- 운영 DB/브랜치/배포를 바꾸는 일은 먼저 물어보고, 승인 후에 한다. 막히는 작업은 우회하지 말고 사용자 몫으로 정리해 둔다.
- 비용이 드는 것(유료 API, AI 호출, 외부 이미지)은 넣지 않는다. 요약/보상은 결정론적으로.
- PR은 초안으로 올리고, CI(운영 DB 사용)를 확인한 뒤 사용자가 말하면 병합한다. 문서만 바꾸는 커밋은 `[skip ci]`.
