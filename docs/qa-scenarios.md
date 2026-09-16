# 사용 시나리오별 검증 체크리스트

이 앱의 핵심 사용 시나리오와, 그게 `tests/e2e/core-flow.spec.ts` (실제
Supabase 프로젝트에 대해 CI에서 도는 하나의 긴 플로우 테스트)의 어느
스텝으로 검증되는지 정리한 표입니다. 새 기능을 추가할 때마다 이 표를
같이 업데이트하고, 빠진 시나리오가 있으면 테스트를 추가하세요.

| 시나리오 | 기대 결과 | 검증 |
|---|---|---|
| 회원가입 | 온보딩으로 이동 | "sign up" |
| 가족 생성 | 온보딩을 벗어나 홈으로 이동 (과거 리다이렉트 버그 회귀 방지) | "create family" |
| **오늘의 미션 색 채집 (카메라)** | 홈 화면 미션 카드 → 카메라로 실시간 매치율(%)이 보이고, 채집하면 홈에 결과가 반영됨 | "hunt today's mission color with the camera" |
| **색 컬렉션 캘린더** | 채집한 날짜의 달력 칸이 그 색으로 채워짐 | "today's captured color shows up in the color collection calendar" |
| 하단 탭바 구성 | 오늘/달력/가족/앨범/설정 5개만, "기록" 탭 없음 | "bottom nav stays at the simplified 5 tabs" |
| 기록 작성 (가족 공개) | 홈 화면에 즉시 표시 | "write a family-visible entry" |
| **카테고리별 오늘의 질문** | 카테고리를 바꾸면 그 카테고리에 맞는 질문(고정 목록에서 날짜+카테고리로 결정론적 선택)으로 바뀜 | "write a family-visible entry" 안의 프롬프트 전환 체크 |
| 기록 수정 + 사진 추가 | 기존 사진에 사진이 추가되고(최대 5장), 내용이 갱신됨 | "edit today's entry, adding a photo" |
| 도전 모드 (연속 기록) | 오늘 첫 기록 후 "부화 중 · 연속 1일" 표시 | "challenge mode shows a hatching pet..." |
| 앨범 — 본인 사진 | 본인이 올린 사진이 보임 | "uploaded photo shows up in the album" |
| **기록 비공개 유지** | "나만 보기"로 쓴 기록은 가족 피드에 절대 안 보임 | "private entry is written..." + 2번째 회원 검증 |
| 캘린더 표시 | 오늘 날짜에 기록 반영 | "entry shows up on the calendar" |
| **캘린더 날짜 클릭** | 그 날의 기록(내 것 + 가족 공개)과 일정이 보이고, 그 날짜로 기록하기 링크가 있음 | "clicking today on the calendar opens the day's entries" |
| 캘린더 일정 추가 | 목록에 즉시 표시 | "add a calendar event" |
| 목표 추가 (가족 공개) | 목록에 즉시 표시 | "add a family-visible goal" |
| 가족 피드 리액션 | 클릭 시 카운트 증가 | "entry + reaction show up on the family feed" |
| 댓글 작성/삭제 | 작성 즉시 보이고, 삭제하면 사라짐 | "add and delete a comment..." |
| 초대 코드로 합류 (아이 역할) | 새 회원이 "아이" 역할로 같은 가족에 들어오고, 그렇게 표시됨 | "second family member joins..." |
| **가족 공개 → 비공개 전환 시 리액션도 같이 숨김** | 기록을 다시 비공개로 바꾸면 그 기록에 달린 리액션까지 가족 피드에서 완전히 사라짐 | "switch the family entry back to private" + "second member no longer sees..." |
| **아이디 중복 가입 에러** | 이미 쓰이는 아이디로 가입하면 명확한 에러 메시지가 뜨고 `/signup`에 그대로 머무름 | `tests/e2e/core-flow.spec.ts`의 별도 테스트 "signing up with a username that's already taken..." |
| **카메라 권한 거부 시 대체 화면** | getUserMedia가 거부되면 에러 메시지가 뜨고 채집 버튼이 비활성화됨 (크래시 없음) | `tests/e2e/color-hunt-camera-denied.spec.ts` |
| **휴대폰 화면 폭에서 가로 스크롤 없음** | 홈/기록/달력/가족/앨범/색 컬렉션/설정 각 화면이 iPhone 13 폭에서 가로로 넘치지 않음, 하단 탭바 5개 모두 보임 | `tests/e2e/mobile-responsive.spec.ts` |
| **앨범 — 가족 사진 (storage RLS)** | 다른 가족 구성원도 가족 공개 사진을 볼 수 있음 (media 테이블 권한 + storage.objects 권한 둘 다 필요) | "second family member..." 안의 앨범 이동 |
| **앨범 사진 확대/축소** | 사진을 탭하면 전체화면 뷰어가 열리고, 확대/축소 버튼(핀치 줌도 지원)으로 배율이 바뀌며, 더블탭으로 원래 배율(100%)로 돌아감 | `tests/e2e/album-zoom.spec.ts` |
| **콜라주 만들기** | 앨범에 사진이 4장 이상이면 "콜라주 만들기" 링크가 보이고, 레이아웃(2x2/3x3)을 고르고 그만큼 사진을 선택하면 한 장의 이미지로 합쳐져서 다운로드할 수 있음 | `tests/e2e/collage.spec.ts` |
| **오늘의 색 채집 지점 표시** | 카메라 화면에 실제로 색을 뽑는 정사각형 영역(뷰파인더)이 십자선과 함께 표시됨 | "hunt today's mission color with the camera" 안의 마커 체크 |
| 가족 피드 — 다른 사람 리액션 | 각자 독립적으로 카운트됨 | "second member can react too..." |
| 목표 응원 | 다른 사람이 응원하면 카운트 증가 | "and can cheer..." |
| 다른 사람 방(room) 보기 | 그 사람이 공개한 목표/아이템만 보임 | "visiting the first member's room..." |
| 세계관 전환 (별자리) | 방 화면에 "별자리 세계관" 표시 | "pick a growth world..." |
| 세계관 전환 (색모음집) | 방 화면에 "색 도감" 표시 | "switch to the color-collection world..." |
| 닉네임 변경 | 저장 메시지 표시, 로그인 아이디는 안 바뀜 | "change nickname..." |
| 로그아웃 → 재로그인 | 온보딩 아님, 바로 홈으로 이동 | "sign out and log back in..." |
| **시간대 — "오늘" 기록의 날짜** | 서버 시각(UTC)이 아니라 기기(브라우저)의 로컬 날짜로 기록됨 — UTC보다 앞선 시간대에서 자정 직후에 써도 전날로 안 밀림 | `tests/e2e/timezone.spec.ts` |

## 아직 자동화되지 않은 시나리오 (수동 확인 필요)

- 사진 삭제 (기능 자체가 아직 없음 — `docs/design-principles.md` "보류" 참고)
- 나무/행성 세계관 (별자리/색모음집만 자동화됨 — UI는 동일 패턴이라 위험도 낮음으로 판단)
- PWA 오프라인 셸 캐싱 동작
- 초대 코드가 틀렸을 때의 에러 메시지
- 목표 달성 체크 → 아이템 해금까지 이어지는 전체 흐름 (개별 로직은 `lib/items.ts`
  단위로는 검증되지만 E2E로는 아직 없음)
