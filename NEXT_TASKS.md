# Next Tasks

## 2026-05-09 Completed

- API 응답 장비 객체에서 원본 `Tooltip` 제거 완료.
- 장비 Tooltip 파싱/정규화 로직을 `lib/lostark/equipment.js`로 분리 완료.
- API 키 누락, 캐릭터 없음, Lostark API 장애 응답에 구분 가능한 `code` 추가 완료.
- `app/page.jsx`의 고정 API 키 에러 문구 제거 완료.
- 장비/아크패시브/스킬 표시 컴포넌트를 `components/`로 분리 완료.
- 장비 정규화 테스트와 재현용 Tooltip fixture 추가 완료.
- 검증 완료: `npm test`, `npm run lint`, `npm run build`.

## 2026-05-08 Review Follow-up

내일은 기능 추가보다 효율 개선부터 시작한다.

### 1. API 응답 슬림화

- `app/api/characters/[name]/route.js`에서 원본 `Tooltip`을 클라이언트로 내려보내지 않는다.
- 장비 화면에 필요한 필드만 반환한다.
- 필요한 필드:
  - `Type`
  - `Name`
  - `Icon`
  - `Grade`
  - `Quality`
  - `ItemLevelText`
  - `DetailSections`

완료 기준:
- `/api/characters/{name}` 응답의 장비 객체에 `Tooltip`이 없다.
- 장비 품질, 악세 상세 효과, 팔찌 상세 효과는 그대로 표시된다.

### 2. 에러 메시지 정리

- `app/page.jsx`의 고정 문구 `LOSTARK_API_KEY 설정을 확인해줘.`를 제거하거나 조건부로 바꾼다.
- 서버에서 API 키 누락일 때만 구분 가능한 `code`를 내려주는 방식이 좋다.

완료 기준:
- 캐릭터 없음, API 장애, API 키 누락이 서로 다른 메시지로 보인다.
- API 키 문제가 아닌 실패에 API 키 안내가 뜨지 않는다.

### 3. 장비 파싱 로직 분리

- Tooltip 파싱과 장비 정규화 로직을 별도 모듈로 분리한다.
- 추천 위치: `lib/lostark/equipment.js`
- 이동 대상:
  - `parseTooltip`
  - `stripMarkup`
  - `splitTooltipLines`
  - `extractDetailSections`
  - `normalizeEquipmentItem`
  - 장비 타입 Set 상수들

완료 기준:
- API route는 요청 조합과 응답 반환에 집중한다.
- 장비 파싱 규칙은 `lib/lostark/equipment.js`에서 관리한다.

### 4. UI 컴포넌트 분리

- `app/page.jsx`가 너무 커졌으므로 표시 컴포넌트를 분리한다.
- 추천 위치:
  - `components/EquipmentList.jsx`
  - `components/ArkPassivePanel.jsx`
  - `components/SkillsPanel.jsx`
  - 필요하면 `components/ArmoryView.jsx`

완료 기준:
- `app/page.jsx`는 조회 상태와 큰 레이아웃 흐름만 담당한다.
- 장비/아크패시브/스킬 표시 로직은 컴포넌트 파일로 이동한다.

### 5. Tooltip 파싱 테스트 추가

- 공식 API Tooltip 구조가 바뀌면 품질/악세 옵션/팔찌 효과가 깨질 수 있다.
- 오늘 확인한 샘플 데이터를 fixture로 저장하고 파싱 결과를 테스트한다.
- 테스트 대상:
  - 품질이 무기/방어구/악세에만 남는지
  - 어빌리티 스톤/팔찌 품질이 `null`인지
  - 나침반/부적/보주가 제거되는지
  - 악세의 `기본 효과`, `연마 효과`, `아크 패시브 포인트 효과`가 추출되는지
  - 팔찌의 `팔찌 효과`, `아크 패시브 포인트 효과`가 추출되는지

완료 기준:
- 장비 정규화 테스트가 자동으로 통과한다.
- API 변경으로 파싱이 깨질 때 테스트가 먼저 실패한다.

## Notes

- AGENT.md 기준으로 다음 작업은 "Simplicity First"와 "Surgical Changes"를 우선한다.
- 새 기능을 붙이기 전에 데이터 파싱 계층과 화면 컴포넌트 경계를 정리한다.
- `npm run lint`와 `npm run build`는 각 단계 후 확인한다.
