# 로생상담소 개발 일지

이 문서는 프로젝트의 하루 단위 변화와 작업 과정을 남기기 위한 기록이다.

## 작성 기준

- 2026-05-10 이전 작업은 Git 저장소 생성 전의 파일 상태, `NEXT_TASKS.md`, 작업 맥락을 기준으로 복원한 기록이다.
- 2026-05-10부터는 GitHub 저장소와 커밋 기록을 함께 기준으로 삼는다.
- 민감 정보가 들어간 `.env.local`은 기록하지 않고, 필요한 환경 변수 이름만 `.env.example`에 남긴다.

## 2026-05-08

### 방향 설정

- 로스트아크 캐릭터를 검색해서 장비, 아크 패시브, 스킬 정보를 한 화면에서 확인하는 Next.js 기반 프로젝트를 시작했다.
- 프로젝트의 작업명과 화면 컨셉을 `로생상담소` 방향으로 잡았다.
- Lost Ark Open API를 호출하기 위한 `.env.local` 기반 환경 구성을 준비했다.

### 구현

- 기본 Next.js 앱 구조를 구성했다.
- 캐릭터 검색 화면과 초기 장비 표시 흐름을 만들었다.
- 장비, 아크 패시브, 스킬 정보를 API 응답에서 받아 화면에 보여주는 첫 버전을 만들었다.
- 프로젝트 이미지 에셋을 `public/`에 추가했다.

### 남긴 과제

- API 응답이 너무 커지는 문제를 줄여야 했다.
- Tooltip 파싱 로직이 화면/API 코드와 섞이기 시작해서 분리가 필요했다.
- 캐릭터 없음, API 키 누락, API 장애가 같은 실패처럼 보이는 문제를 분리해야 했다.
- `app/page.jsx`가 커지고 있어 컴포넌트 분리가 필요했다.

## 2026-05-09

### 정리 작업

- API 응답의 장비 객체에서 원본 `Tooltip`을 제거하고, 화면에 필요한 정규화된 데이터만 내려주도록 정리했다.
- 장비 Tooltip 파싱과 정규화 로직을 `lib/lostark/equipment.js`로 분리했다.
- 장비/아크패시브/스킬 표시 컴포넌트를 `components/` 아래로 분리했다.
- API 키 누락, 캐릭터 없음, Lost Ark API 장애를 구분할 수 있도록 응답 `code`를 정리했다.

### 테스트

- 장비 정규화 테스트와 Tooltip fixture를 추가했다.
- 품질, 악세 상세 효과, 팔찌 효과, 아크 패시브 포인트 추출이 깨지지 않도록 회귀 테스트를 만들었다.

### 검증

- `npm test`
- `npm run lint`
- `npm run build`

## 2026-05-10

### 장비 페이지 확장

- 어빌리티 스톤의 각인 증가량과 추가 효과를 장비 페이지에서 확인할 수 있게 보강했다.
- 보석 정보를 별도 탭이 아니라 장비 영역으로 옮겼다.
- 아바타 정보를 장비 페이지에 간략히 보여주고, 덧입기 슬롯 효과는 제외하도록 정리했다.
- 무기를 제외한 장비/악세/팔찌의 주스탯을 파싱해 내부 계산용 합산값으로 보관하도록 했다.

### 스펙 계산 기반 정리

- 인벤에 정리된 로스트아크 데미지 계산 글을 참고해 `docs/lostark-damage-formula.md`를 작성했다.
- 악세사리 연마 효과의 스펙 기여도를 계산하기 시작했다.
- 목걸이의 추가 피해는 무기 품질 추가 피해와 같은 합산 버킷으로 계산하도록 반영했다.
- 달인, 뭉툭한 가시, 진화/깨달음 포인트 보너스처럼 API에 직접 수치로 오지 않는 아크 패시브 효과를 보정했다.
- 진화 6랭크 보너스는 진화형 피해 `+6%`로 반영했다.
- 깨달음 레벨 보너스는 `깨달음 레벨 x 0.1%`의 무기 공격력으로 반영했다.

### 치명타/각인 계산 보강

- 치명타 적중률, 치명타 피해, 치명타 시 적에게 주는 피해를 분리해서 계산하도록 했다.
- 예리한 둔기와 아드레날린의 효율 계산을 손봤다.
- 아드레날린은 최대 중첩 기준 공격력 증가를 계산하도록 했다.
- 달인은 항상 최대 중첩 기준으로 계산하도록 정리했다.
- 만월의 집행자 사신화, 비기 버서커 폭주, 슬레이어 폭주 계열처럼 직업 아이덴티티 기반 치명타 효과를 저장할 수 있는 구조를 만들었다.
- 포격 스킬처럼 특정 스킬군에만 적용되는 아크 패시브 효과는 전역 계산에서 제외하고 `SkillFamilySources`로 분리했다.

### 계산 구조 개선

- 공통 데미지 계산 모델을 `lib/spec/damageModel.js`로 분리했다.
- 악세 효율과 각인 효율이 같은 치명타/진화형 피해 계산식을 공유하도록 정리했다.
- 기존의 `SpecialEngravingSources` 명칭은 유지하면서, 더 넓은 의미의 `SpecialSources` 별칭을 추가했다.
- 실제 캐릭터 형태에 가까운 붐버 악세 효율 회귀 fixture를 추가했다.

### 개발 편의

- 개발 서버를 쉽게 재시작할 수 있도록 `npm run dev:restart` 스크립트를 추가했다.
- WSL과 Windows 환경의 Git 설치 상태를 확인하고, Windows Git for Windows를 설치했다.
- GitHub CLI 인증을 완료하고 `kkssii0210` 계정과 연동했다.
- 첫 Git 저장소를 초기화하고 GitHub private repo에 push했다.
- 프로젝트 로컬 Codex skill로 `devbrother2024/skills`의 `deep-interview`를 `.agents/skills/deep-interview`에 설치했다.
- `deep-interview`는 모호한 기능 요청을 바로 구현하지 않고 목표, 범위, 제약, 완료 기준을 한 번에 하나씩 질문해 정리하는 용도로 사용한다.

### 웰컴 페이지와 슥구 에셋

- 첫 방문 시 바로 상담 화면으로 들어가지 않고, 밤 숲길 끝의 오두막으로 접근하는 짧은 웰컴 애니메이션을 추가했다.
- 풀벌레 소리, 부엉이 소리, 문이 열리는 효과음을 Web Audio 기반으로 구성했다.
- `imagegen`으로 밤 숲의 오두막 배경과 오두막 내부 배경을 생성해 `public/welcome-forest-cabin.webp`, `public/welcome-cabin-interior.webp`로 저장했다.
- 기존 슥구를 참고해 책상 앞에 앉아있는 상담원 슥구를 생성하고, 피부톤과 눈매를 새 기준에 맞게 다시 보정했다.
- 웰컴 페이지에서 사용하는 최종 앉은 슥구 에셋은 `public/sggu-seated.png`로 저장했다.
- 앞으로의 후보 캐릭터 방향을 보기 위해 서서 설명하는 슥구 에셋을 `public/sggu-standing.png`에 추가했다. 이 파일은 아직 화면에 연결하지 않은 검토용 에셋이다.
- 생성 원본 파일은 추적하지 않도록 `public/generated/`를 `.gitignore`에 추가했다.

### GitHub

- GitHub repo: `kkssii0210/rosaeng-sangdamso`
- 설명: `로생상담소`
- 첫 커밋: `Initial project snapshot`
- `.env.local`, `.next`, `node_modules`, 임시 패키지 파일은 Git에서 제외했다.

### 검증

- `npm test`
- `npm run lint`
- `npm run build`
- 실제 캐릭터 `붐버` API 응답으로 악세/각인 계산 컨텍스트를 확인했다.

### 남은 문제점

- 스킬군 전용 효과 표시: `포격 스킬`처럼 특정 스킬군에만 적용되는 치명/치피 효과는 전역 계산에서 분리했지만, 아직 UI에서 "전역 기준"과 "특정 스킬군 기준" 효율을 선택해 비교하는 기능은 없다.
- API 미제공 수치 보정: 카드 수집 효과, 펫 목장 추가 피해, 일부 직업 아이덴티티/아크 패시브 효과처럼 Lost Ark API로 직접 오지 않는 값은 수동 보정이 필요하다. 보정값의 출처와 적용 조건을 계속 문서화해야 한다.
- 계산 검증 범위 부족: 붐버 중심 회귀 fixture는 추가했지만, 직업/각인/아크 패시브 조합별 케이스가 아직 적다. 실제 캐릭터 샘플을 늘려 로스트빌드류 계산 결과와 차이를 비교하는 검증 데이터가 필요하다.

## 2026-05-15

### 목표

- 로스트아크 전투력 표기값을 실제 측정값에 맞춰 검산할 수 있게 전투력 모델을 분리하고 보강했다.
- 붐버를 기준으로 무기 only, 보주, 장신구, 보석, 각인, 아크패시브/카르마 케이스를 하나씩 대조했다.

### 변경

- 전투력 계산 모델을 `lib/spec/combatPowerModel.js`에 추가하고 API 응답에 `combatPowerAnalysis`를 내려주도록 연결했다.
- 인게임 전투력은 내부 소수 계산값과 화면 내림 표기값을 분리해 `Estimate`, `EstimateFloor`, `OfficialCombatPowerFloor`로 확인하게 했다.
- 보주 툴팁에서 시즌2 최대 낙원력을 추출하고 공격형/보조형 보주 전투력 계수를 적용했다.
- 엘릭서/초월 전투력 반영을 제거하고, 아크패시브 포인트는 선택 노드가 있을 때만 전투력에 넣도록 고쳤다.
- 카르마는 진화 랭크 `0.6%`, 도약 레벨 `0.02%`만 독립 전투력 배율로 남기고, 깨달음 레벨 무기공은 기본공 산출 전 무기공 버킷에 넣었다.
- 깨달음 무기공%, 장신구 연마 `무기 공격력 +%`가 같은 합산 버킷으로 적용되도록 수정했다.
- 보석은 기본공%와 4티어 레벨별 순수 전투력 계수를 분리해 반영했다.
- 각인은 딜러 전투력 기여 표를 별도 계수로 추가했고, 장신구 연마효과와 아크그리드 코어/젬 진단값을 전투력 모델에 연결했다.
- 전투력 검산 패널과 업그레이드 효율 패널을 추가하고, 시장 시세 스냅샷 API 기반 효율 계산 구조를 붙였다.
- 공식 문서 `docs/lostark-damage-formula.md`에 전투력 표시 모델, 보주, 보석, 아크패시브, 카르마, 장신구/무기공 합산 규칙을 정리했다.

### 검증

- `npm test`
- 붐버 무기 only 실측 `5.00`과 장신구 only 실측 `32.68`을 기준으로 무기공%, 주스탯, 카르마, 장신구 연마효과를 대조했다.
- 보주 최대 낙원력 `27,024,526` 기준 보주 착용 전투력 증가율을 검산했다.

### 다음 작업

- 프로필 기본공격력 역산과 장비식 `sqrt(주스탯 * 무기공 / 6)` 중 어떤 값을 우선할지 상황별 기준을 더 좁혀야 한다.
- 목장 추가피해, 펫/내실 주스탯처럼 API에 직접 드러나지 않는 보정값을 입력/저장할 구조가 필요하다.
- 천우희, 조조하은, 귤주세요 등 추가 캐릭터로 전투력 모델 회귀 케이스를 늘려야 한다.

## 2026-05-16

### 목표

- 붐버를 기준으로 전투력 공식을 밑바닥부터 다시 검증하고, 확정된 bucket만 코드에 남겼다.
- 전투력 시작 계수, 아크패시브, 보석, 각인, 카드, 팔찌, 보주를 단계별 실측값으로 대조했다.

### 변경

- 기본 전투력 시작식을 `sqrt(주스탯 * 무기공격력 / 6) * 0.000288`로 확정했다.
- 깨달음 전투력은 4T/사이드 별도 보너스를 제거하고 `min(포인트, 100) * 0.7%`로 단순화했다. 100P와 101P 모두 `+70%`로 처리한다.
- 진화/깨달음/도약은 같은 아크패시브 합산 bucket이 아니라 각각 별도 배율로 곱하도록 정리했다.
- 보석은 4티어 레벨별 순수 전투력 배율과 `기본 공격력 %`를 모두 반영하도록 고쳤다.
- 각인은 유각 진행도와 어빌리티 스톤 각인보너스 레벨을 함께 반영하고, 어빌리티 스톤의 `기본 공격력 +1.50%`는 `baseAttack` bucket에 합산하도록 정리했다.
- 팔찌의 민첩/특화/무기공격력은 기본공격력과 전투특성 흐름으로 들어가고, 팔찌 특수옵션만 팔찌 bucket에 남기도록 검증했다.
- 카드 효과를 정규화하는 `lib/lostark/cards.js`를 추가하고, API 응답과 전투력 분석에 정규화된 카드 효과를 연결했다.
- 전투력 분석 패널에 공격력, 추가피해, 보스피해, 카드 bucket 라벨을 추가했다.
- 전투력 공식 문서에 붐버 실측으로 확정한 계산 규칙과 남은 아크그리드 젬 분해 과제를 반영했다.
- 아크그리드 젬 `보스 피해`는 불타는 일격 기준 보정 없이 표시값 그대로 별도 곱으로 확정했다. 붐버 `5468.93 -> 5505.03` 실측은 `+0.66009%`로 젬 표시값 `+0.66%`와 일치한다.
- 아크그리드 젬 `추가 피해`는 무기 품질, 목걸이 추가 피해, 펫 목장 `+1%`와 같은 추가피해 합산 bucket으로 유지했다. 붐버 기준 `32.21% -> 33.98%`라서 실효 기여는 `1.3398 / 1.3221 = +1.33878%`다.
- 장신구 평면 `공격력 +`와 `공격력 %`는 API 공격력 툴팁 구조인 `(기본공격력 + 평면공격력) * (1 + 공격력%)`로 계산하도록 바꿨다.
- 아크그리드 젬 `공격력`은 장신구 공격력%와 `혼돈의 별 코어 : 공격`의 공격력%를 context로 둔 marginal factor로 분리했다. 붐버는 `0.80% -> 0.76140%`, 가디언인가는 `1.17% -> 1.14818%`로 계산된다.

### 검증

- `npm test`
- `git diff --check`
- 붐버 실측 단계:
  - 최소 장비 상태 `4.97`로 시작 계수 `0.000288` 확인
  - 장비+진화 `236.19`, 악세 `277.65`, 깨달음 `472.00`, 팔찌 `525.20`, 도약 `598.73`
  - 보석 `1325.25`, 각인 `3070.70`, 카드 `3531.31`, 아크그리드 `4798.70`, 보주 `4912.04`, 어빌리티 스톤 `5353.25`, 특화 160 펫 `5505.03`

### 다음 작업

- 프로필 `기본 공격력` 역산 우선 사용을 제거하고, 내부적으로 수집한 힘/민/지와 무기공격력으로 `sqrt(주스탯 * 무기공격력 / 6)`를 계산하는 경로를 기본값으로 바꿔야 한다. 음식은 프로필 공격력/무기공격력을 올릴 수 있지만 전투력에는 들어가지 않으므로, API 프로필 기본공격력을 신뢰하면 환경 상태에 흔들린다.
- 아크그리드 `혼돈의 별 코어 : 무기`가 프로필 기본공격력에 이미 포함되는지 추가 실험으로 분리해야 한다.
- 붐버 외 캐릭터에서 깨달음 `100P cap +70%`, 보석 기본공%, 어빌리티 스톤 각인보너스가 동일하게 맞는지 확인해야 한다.
- 에스더 무기 보유 캐릭터는 무기/기본공격력 경로가 일반 무기와 다른지 별도 샘플로 검증해야 한다.

## 2026-05-18

### 목표

- 기존 Next.js API Route를 바로 갈아엎지 않고, Java Spring Boot 기반 BFF를 별도 프로세스로 세우는 방향을 확정했다.
- 첫 백엔드 범위는 `GET /api/characters/{name}` 캐릭터 조회 endpoint로 좁혔다.
- 조회 실패, API 키 누락, Lostark API 장애를 사용자에게 구분된 코드와 메시지로 반환하도록 정리했다.

### 변경

- `docs/superpowers/specs/2026-05-18-spring-boot-bff-design.md`와 `docs/superpowers/plans/2026-05-18-spring-boot-bff.md`에 Spring Boot BFF 설계와 실행 계획을 작성했다.
- Java 21 기반 Spring Boot 4 프로젝트를 `backend/`에 추가하고 Maven wrapper, actuator, validation, webmvc 구성을 생성했다.
- `LostarkProperties`를 추가해 `LOSTARK_API_KEY`를 우선 사용하고 `LOSTARK_OPEN_API_KEY`를 fallback으로 쓰도록 했다.
- 공통 오류 응답인 `ApiErrorResponse`, `BffException`, `GlobalExceptionHandler`를 추가했다.
- `LostarkApiClient`와 `LostarkClientConfig`를 추가해 base URL, 인증 헤더, timeout, retry, Lostark API 오류 매핑을 담당하게 했다.
- `CharacterService`와 `CharacterResponse`를 추가해 Lostark armory endpoint 응답을 프론트 DTO 형태로 조립했다.
- profile 응답은 필수로 처리하고, profile이 404 또는 `null`이면 `CHARACTER_NOT_FOUND`와 `없는 캐릭터입니다.`를 반환하도록 했다.
- 장비, 아바타, 아크패시브, 아크그리드, 카드, 스킬, 각인, 보석 endpoint는 선택 응답으로 두고 404면 `null`로 매핑했다.
- `CharacterController`를 추가해 `GET /api/characters/{name}`를 열고, 공백 캐릭터명은 `INVALID_CHARACTER_NAME`으로 거절하도록 했다.
- Lostark API 키가 설정되지 않은 경우에는 `MISSING_API_KEY`와 `잠시 설정을 확인하고 있어요.`로 마스킹했다.
- JS 계산 이관이 필요한 `paradiseOrb`, `classIdentityEffects`, `criticalStats`, `combatPowerAnalysis`, `upgradeEfficiency`는 이번 단계에서 명시적 `null`로 내려주도록 했다.
- `.env.example`과 `README.md`에 Spring Boot backend 실행 명령, 8080 기본 포트, 환경 변수 설정 방식을 추가했다.

### 검증

- `backend`에서 `./mvnw test`: 22개 테스트 통과
- `backend`에서 `./mvnw spring-boot:run`: Tomcat 8080 기동 확인 후 종료
- 루트에서 `npm test`: 14개 테스트 통과
- `npm run lint`
- `npm run build`
- `git diff --check`

### 다음 작업

- Next.js 프론트가 새 Spring Boot BFF endpoint를 호출하도록 개발 환경 proxy 또는 API base URL 전략을 정해야 한다.
- 현재 Spring Boot 응답은 원본 armory payload 중심이므로, 기존 JS 계산 모듈을 Java로 옮길지 백엔드/프론트 경계를 다시 나눌지 결정해야 한다.
- 실제 Lostark API 키와 캐릭터명으로 `GET /api/characters/{name}` 통합 smoke test를 추가해야 한다.
- `spring-boot:run` 실행 시 로컬 `.env.local`을 자동으로 읽지 않는 점을 운영/개발 실행 스크립트에서 더 편하게 만들 수 있는지 검토한다.

## 2026-05-25

### 목표

- 전투력 효율 시뮬레이터가 악세사리만 보지 않고, 캐릭터 기준으로 가장 효율 좋은 스펙업 후보를 top5로 비교하게 만든다.
- 무기/방어구 강화, 각인서, 보석, 아바타 비용을 경매장/거래소 시세 기반으로 계산한다.
- 상담사 슥구에게 클라우드 LLM이 아니라 로컬 LLM을 연결하는 작은 첫 버전을 만든다.
- Python 없이 Next.js API route와 Ollama HTTP API만으로 시작한다.

### 변경

- 전투력 효율 시뮬레이터에 악세사리, 무기 강화, 방어구 강화, 각인서, 보석, 전설 아바타 후보를 함께 비교하는 스펙업 추천 top5 구조를 추가했다.
- 경매장/거래소 시세 snapshot에 강화 재료, 각인서, 보석, 직업별 아바타 가격을 포함하고 5분 캐시를 적용했다.
- 악세사리 검색은 품질 필터 중심에서 벗어나 현재 착용 악세의 특수옵션 단계 기준으로 검색하도록 바꿨고, 3연마 기준 `UpgradeLevel=3`을 고정했다.
- 캐릭터 분석 화면에서 전투력 효율 시뮬레이터로 넘어갈 때 검색한 캐릭터명이 유지되도록 연결하고, 돌아가기도 분석 화면으로 복귀하게 했다.
- 현재 교체 대상 악세사리 표시는 특수옵션 중심으로 정리하고, 아르데타인 캐릭터 기준 주스탯은 민첩만 보여주도록 개선했다.
- 영웅 아바타 착용 캐릭터에게만 전설 아바타 스펙업 후보가 나오도록 하고, 이미 전설 아바타를 착용한 캐릭터에는 중복 추천하지 않게 했다.
- `POST /api/consult/sggu` 상담 API를 추가했다.
- 캐릭터 장비/아크패시브/스킬/보석/스펙업 추천을 compact context로 요약하는 `lib/consultant/sgguContext.js`를 추가했다.
- 슥구 말투와 답변 제한을 관리하는 `lib/consultant/sgguPrompt.js`를 추가했다.
- Ollama `/api/chat` 호출용 `lib/llm/localLlmClient.js`를 추가했다.
- 첫 화면의 캐릭터 조회 말풍선을 `components/SgguConsultantChat.jsx`로 분리하고, 캐릭터 조회 뒤 같은 입력창에서 슥구에게 질문할 수 있게 했다.
- 전투력 효율 페이지에서 넘어온 캐릭터명은 홈 분석 화면에서 자동 조회되도록 연결했다.
- 로컬 환경에는 Windows용 Ollama `0.24.0`을 설치하고 `qwen2.5:7b` 모델을 내려받았다. WSL에서 Next.js가 Windows Ollama 서버에 붙도록 `.env.local`의 `LOCAL_LLM_BASE_URL`을 Windows host 주소로 설정했다.

### Sggu Local LLM Consultant Env

- `LOCAL_LLM_PROVIDER`: optional. Defaults to `ollama`.
- `LOCAL_LLM_BASE_URL`: optional. Defaults to `http://localhost:11434`.
- `LOCAL_LLM_MODEL`: optional. Defaults to `qwen2.5:7b`; set this to a model installed in Ollama.
- `LOCAL_LLM_TIMEOUT_MS`: optional. Defaults to `30000`.
- `LOSTARK_API_KEY` or `LOSTARK_OPEN_API_KEY`: still required for character lookup and market data.

First local run:

```bash
ollama serve
ollama pull qwen2.5:7b
npm run dev:restart
```

The LLM consultant receives a compact character/spec-up summary from the app and answers from that supplied data. It does not call Lost Ark APIs directly.

### 검증

- `npm test -- tests/sgguContext.test.js tests/sgguPrompt.test.js tests/localLlmClient.test.js tests/sgguConsultApi.test.js tests/sgguConsultantState.test.js`
- `npm test`
- `node node_modules/eslint/bin/eslint.js app/api/consult/sggu/route.js app/page.jsx components/SgguConsultantChat.jsx lib/consultant/sgguContext.js lib/consultant/sgguPrompt.js lib/llm/localLlmClient.js lib/ui/sgguConsultantState.js tests/sgguContext.test.js tests/sgguPrompt.test.js tests/localLlmClient.test.js tests/sgguConsultApi.test.js tests/sgguConsultantState.test.js`
- `npm run build`
- `curl http://127.0.0.1:3000/api/consult/sggu` 테스트 요청으로 Ollama `qwen2.5:7b` 상담 응답 확인

### 다음 작업

- 로컬 Ollama가 꺼져 있을 때 UI에서 더 짧고 명확한 안내 문구를 보여줄지 검토한다.
- 패치노트/로스트아크 용어 데이터는 다음 단계에서 RAG 형태로 붙인다.
- 상담 요청 payload는 현재 raw armory를 포함하므로, 이후 서버 세션 또는 compact context 전송으로 줄일 수 있다.
- 경매장/거래소 가격 후보가 너무 적거나 API 응답이 비어 있을 때 사용자에게 후보 제외 사유를 더 자세히 보여줄 수 있다.

## 2026-05-29

### 목표

- 로생상담소의 장기 backend 방향을 Spring Boot 중심 BFF로 확정한다.
- Next.js API Route에 커지고 있는 Lostark API 호출, 인증, 캐시, 계산, 상담 책임을 단계적으로 Spring Boot로 옮기는 이관 계획을 세운다.

### 결정

- 최종 구조는 Spring Boot가 backend BFF를 담당하고, Next.js는 UI와 정적 frontend 경험에 집중한다.
- Lostark Open API 인증, timeout, retry, 에러 매핑, 캐시, market snapshot, 도메인 정규화, 전투력/효율 계산, 상담/RAG API는 단계적으로 Spring Boot로 이동한다.
- 기존 JavaScript 계산 로직은 정확도 검증 자산이 많으므로 한 번에 옮기지 않는다. 단계별 parity test와 fixture 기반 회귀 테스트로 Java 구현을 검증한다.
- 전환 방식은 big-bang rewrite가 아니라 strangler 방식이다. Spring endpoint가 기존 Next API 응답과 동등해진 뒤 frontend routing을 Spring 쪽으로 넘기고, 마지막에 Next API Route를 제거한다.

### 이관 계획

1. API 계약과 routing 기반을 고정한다.
2. 캐릭터 조회 endpoint를 Spring Boot에서 기존 Next 응답과 동일한 수준으로 완성한다.
3. 거래소/경매장 market snapshot과 캐시를 Spring Boot로 옮긴다.
4. 전투력, 스펙업 효율, 장비/카드/보석/각인 계산 모델을 Java service로 옮긴다.
5. 슥구 상담 API, local LLM client, RAG retrieval을 Spring Boot로 옮긴다.
6. 더 이상 쓰지 않는 Next.js API Route를 제거하고 Next.js를 UI 전용으로 정리한다.

### 문서

- `docs/superpowers/specs/2026-05-29-spring-boot-migration-design.md`에 Spring Boot 이관 설계를 작성한다.

### 다음 작업

- Spring Boot 이관 설계를 기준으로 구현 계획을 작성한다.
- 1단계부터 6단계까지 각 단계마다 계약 테스트, backend 테스트, frontend 빌드 검증을 통과시키며 진행한다.

### 진행

- `spring-boot-migration` worktree를 생성해 Spring Boot 이관 작업을 격리했다.
- API endpoint별 active owner를 기록하는 `docs/backend-api-ownership.md`를 추가했다.
- Spring Boot character response top-level 계약을 `CharacterContractTest`로 고정했다.
- Next.js rewrite를 `SPRING_API_PATHS` 기반 opt-in 방식으로 추가해 endpoint 단위 strangler 전환이 가능해졌다.
- Spring Boot character 조회에서 장비, 낙원 보주, 아바타, 카드, 각인, 보석 정규화를 수행한다.
- class identity와 critical stats 계산을 Java service로 옮기고 character response에 연결했다.
- combat power와 upgrade efficiency는 Spring 응답 구조를 채우되, 현재는 공식 전투력/낙원력/critical summary 중심의 partial 분석과 market snapshot 전 unavailable 후보 상태로 둔다.
- Phase 2 범위 backend 검증은 `cd backend && ./mvnw test` 기준 45개 테스트 통과까지 확인했다.
- Spring Boot에 market snapshot API와 5분 TTL cache를 추가하고 `/api/market/snapshot` active owner를 Spring Boot로 전환했다.
- `/api/characters/{name}` active owner를 Spring Boot로 전환하고 기존 Next.js character route를 제거했다.
- Spring Boot에 `/api/consult/sggu` 상담 API, compact context builder, prompt builder, Ollama local LLM client를 추가했다.
- `/api/consult/sggu` active owner를 Spring Boot로 전환하고 기존 Next.js consult route와 JS route 테스트를 제거했다.
- Next.js에는 이관 대상 API Route가 남아 있지 않고, `/api/efficiency/*`는 아직 Next.js 소유의 별도 기능으로 유지한다.
- JS 상담 prompt/local LLM backend module은 제거했고, 브라우저에서 compact context를 만들기 위한 `sgguContext`만 `lib/ui`로 이동했다.
- 최종 검증은 `npm test` 24개, `npm run lint`, `npm run build`, `cd backend && ./mvnw test` 58개, `git diff --check` 통과까지 확인했다.
- 스펙업 효율 모델 전체 이식 설계를 `docs/superpowers/specs/2026-05-29-upgrade-efficiency-model-migration-design.md`에 추가했다.
- 구현 계획을 `docs/superpowers/plans/2026-05-29-upgrade-efficiency-model-migration.md`에 추가했다.
- Spring `UpgradeEfficiencyService`가 market snapshot 기반 cost input을 만들고 강화, 전설 아바타, 보석, 각인서 후보를 `upgradeEfficiency.Candidates`로 반환하도록 이식했다.
- 보석/각인서 후보는 Java `UpgradeCombatPowerEstimator`로 현재값과 변경 후 전투력 추정값을 비교해 gain percent를 산출한다.
- Spring market snapshot의 경매장 보석 항목에 `gemLevel`, `gemEffectType`, `gemEffectValue`, `optionDetails`를 포함해 보석 후보 계산 입력으로 쓸 수 있게 했다.
- Spring market service가 현재 각인 중 4단계 미만인 각인의 유물 각인서 5권 비용을 조회해 각인서 후보 계산 입력으로 넘긴다.
- `CharacterService`가 market snapshot을 upgrade efficiency context에 전달한다. market snapshot 로딩 실패는 캐릭터 조회 실패로 전파하지 않고 `MarketDataStatus: unavailable`로 떨어진다.
- Spring `GET /api/efficiency/spec-up/{name}`가 악세 교체 추천과 강화/보석/각인/아바타 후보를 통합해 Top 5를 반환하도록 추가했다.
- 기존 Next.js `app/api/efficiency/spec-up/[name]/route.js`는 Spring 소유권 활성화 후 제거했다.
- `/api/efficiency/accessories/recovery`는 2026-05-31 작업에서 Spring Boot로 이식해 API Route 잔여 파일을 제거했다.

### 검증

- `cd backend && ./mvnw -Dtest=CharacterServiceTest,MarketSnapshotServiceTest,UpgradeEfficiencyServiceTest test` 17개 통과.
- `cd backend && ./mvnw -Dtest=LostarkApiClientTest,CharacterServiceTest,AccessoryNormalizerTest,AccessoryAuctionSearchServiceTest,AccessoryEfficiencyServiceTest,SpecUpRecommendationServiceTest,SpecUpEfficiencyServiceTest,SpecUpEfficiencyControllerTest test` 26개 통과.
- `cd backend && ./mvnw test` 75개 통과.
- `npm test` 24개 통과.
- `npm run lint` 통과.
- `npm run build` 통과.
- `git diff --check` 통과.

### 다음 작업

- Spring API 소유권 완료 이후에는 CI/CD, Docker Compose, 캐시/저장소 같은 운영성 포트폴리오 항목을 순서대로 보강한다.
- Spring spec-up 추천 결과를 슥구 상담 context에 연결해 Top 5 추천 이유를 대화형으로 설명하게 한다.
- 붐버 외 실제 캐릭터 fixture를 늘려 악세/보석/각인서 추천 순위의 회귀 검증 범위를 넓힌다.

## 2026-05-31

### 목표

- 로컬 LLM 기반 슥구 상담을 Spring Boot 중심 구조로 정리한다.
- 전투력 효율 시뮬레이터는 계산 결과를 먼저 보여주고, 상담 문구는 뒤에서 비동기로 생성되게 만든다.
- 첫 화면에서는 캐릭터 조회를 먼저 거치고, 조회된 캐릭터 기준으로만 효율 시뮬레이터에 진입하도록 흐름을 고정한다.
- Lost Ark 공식 API 호출이 불안정해졌을 때 효율 계산 쪽 호출량을 줄이고, 개발 서버 실행 편의성을 보강한다.

### 변경

- `docs/superpowers/specs/2026-05-31-sggu-consultation-orchestrator-design.md`와 `docs/superpowers/plans/2026-05-31-sggu-consultation-orchestrator.md`에 슥구 상담 오케스트레이터 설계와 실행 계획을 남겼다.
- Spring Boot `POST /api/consult/sggu`가 `Mode`, `Source`, `Mood`, `Empathy`, `Diagnosis`, `Recommendation`, `Caution`, `NextAction`, `DisplayText`를 갖는 구조화 응답을 반환하도록 정리했다.
- 로컬 LLM 응답이 malformed JSON이거나 계산 결과와 맞지 않으면 deterministic fallback 상담을 반환하도록 했다.
- 효율 요약 모드에서는 LLM이 1순위 스펙업 후보를 실제 추천하는지 검증한다. 후보명을 언급만 하거나 `무기 11->12보다 보석부터`처럼 다른 후보를 추천하는 문장은 fallback 처리한다.
- 상담 prompt를 `main-chat`, `efficiency-summary` 모드별로 나누고, cache key에 mode, 메시지, 대화, context를 포함했다.
- 메인 상담 UI는 구조화 응답의 `DisplayText`를 우선 사용하고, 기존 `Answer` 응답은 legacy fallback으로만 남겼다.
- 전투력 효율 페이지는 계산 중 `슥구가 생각중이다.` 문구를 보여주고, 계산 결과 렌더링 이후 상담 카드를 별도 async 요청으로 채운다.
- 효율 페이지 상담 카드에 슥구가 상담소에서 결과를 설명하는 분위기의 `public/efficiency-consult-room.png` 에셋을 추가했다.
- `scripts/smoke-sggu-consult.mjs`를 추가해 실행 중인 Next.js 서버의 `/api/consult/sggu`를 호출하고, 구조화 응답과 `Source: llm`을 검증하게 했다. smoke 요청에는 매번 nonce를 넣어 캐시된 예전 LLM 응답으로 Ollama 연결 확인이 통과하지 않게 했다.
- 악세사리 경매장 검색은 5분 cache, page cap, target 후보 수 기준 조기 종료를 적용해 같은 후보를 반복 조회하지 않게 했다.
- 장착 악세사리별 후보 검색은 virtual thread 기반 병렬 실행으로 바꿔 전체 효율 계산 대기 시간을 줄였다.
- `npm run dev:backend`와 `scripts/restart-backend.sh`를 추가해 루트 `.env.local`과 `backend/.env.local`을 읽은 뒤 Spring Boot 서버를 재시작할 수 있게 했다.
- 첫 화면 주요 내비게이션에서 전투력 효율 시뮬레이터 링크를 제거하고, 효율 페이지는 조회된 캐릭터 query가 있을 때만 진입하도록 보정했다.

### 검증

- `cd backend && ./mvnw -Dtest=SgguResponseParserTest,SgguFallbackComposerTest,SgguPromptBuilderTest,SgguConsultationServiceTest,ConsultantControllerTest test`: 22개 통과
- `cd backend && ./mvnw test`: 134개 통과
- `npm test`: 121개 통과
- `npm run lint`
- `npm run build`
- `node --check scripts/smoke-sggu-consult.mjs`
- `curl http://127.0.0.1:3000/`: 200 확인
- `curl http://127.0.0.1:8080/actuator/health`: `UP` 확인

### 다음 작업

- 상담 cache는 현재 single-flight가 아니므로, 동일 cold request가 동시에 들어올 때 local LLM 호출이 중복될 수 있다. 필요하면 request coalescing을 추가한다.
- 효율 페이지는 계산 결과가 상담보다 먼저 렌더링되는 흐름을 unit helper로 검증했지만, 실제 browser/component 수준 검증을 추가하면 더 좋다.
- LLM 응답 신뢰도는 현재 보수적 keyword grounding 기반이다. 이후 RAG와 함께 top candidate id/label을 구조적으로 echo하게 만들어 검증을 더 단단히 한다.
- 서포터 기준 상담과 효율 계산은 아직 범위 밖이다. 딜러 기준이 안정화된 뒤 support profile을 별도 mode로 확장한다.

## 2026-06-03

### 목표

- 슥구 상담이 어떤 질문에도 비슷한 스펙업 추천만 반복하는 문제를 줄인다.
- 로컬 LLM 응답이 JSON 형태를 흔들어도 Spring Boot 상담 API가 안정적으로 구조화 응답을 반환하게 만든다.
- 포트폴리오 README에서 현재 구조와 목표 구조를 한눈에 설명할 수 있도록 아키텍처 그림을 갱신한다.

### 변경

- `docs/superpowers/specs/2026-06-03-sggu-llm-response-normalization-design.md`와 `docs/superpowers/plans/2026-06-03-sggu-llm-response-normalization.md`에 로컬 LLM 응답 정규화 설계와 실행 계획을 남겼다.
- `SgguResponseParser`가 Ollama 응답의 필드를 문자열로 더 안정적으로 정규화하도록 보강했다. 단순 배열은 읽을 수 있는 텍스트로 보존하고, 객체나 중첩 배열처럼 상담 UI에 바로 쓰기 어려운 값은 invalid response로 처리한다.
- 로컬 LLM prompt에서 JSON만 출력하도록 지시를 강화해, 설명 문장과 JSON이 섞여 fallback으로 떨어지는 경우를 줄였다.
- `docs/superpowers/specs/2026-06-03-sggu-intent-counselor-design.md`와 `docs/superpowers/plans/2026-06-03-sggu-intent-counselor.md`에 intent 기반 상담사 설계를 작성했다.
- `SgguIntentClassifier`를 추가해 사용자의 질문을 스펙업 우선순위, 비교, 비용/예산, 캐릭터 진단, 용어 설명, 일반 상담, 데이터 부족 상황으로 분류하게 했다.
- `SgguPromptBuilder`가 분류된 intent별 상담 지침을 prompt에 넣도록 바꿨다. 같은 character context라도 질문 의도에 맞춰 설명, 비교, 예산 안내, 진단 중심 답변이 나오도록 유도한다.
- `SgguFallbackComposer`도 intent-aware 구조로 바꿔 LLM 실패 시에도 매번 1순위 스펙업 후보만 반복하지 않게 했다.
- 슥구 말투를 존댓말 캐릭터로 고정했다. `무섭슥다` 같은 반말형 슥구체는 금지하고, `무섭슥니다`, `확인했슥니다`처럼 기본 단어 안에 자연스럽게 `슥`을 넣는 규칙을 prompt와 fallback 문구에 반영했다.
- `SgguConsultationService`가 intent를 한 번 분류한 뒤 prompt 생성과 fallback 생성 양쪽에 같은 intent를 전달하도록 오케스트레이션을 정리했다.
- README 상단 아키텍처 설명을 Spring Boot BFF, 로컬 LLM, PostgreSQL/Flyway 목표 확장 중심으로 갱신했다.
- `docs/architecture-local-llm.svg`를 새 아키텍처 원본으로 추가하고, `docs/architecture-local-llm.png`를 다시 렌더링했다.
- 아키텍처 그림은 Client, Frontend, Spring Boot Backend, External Runtime, Persistence Layer로 나누고, Spring Boot Backend 안에서 API Layer와 Service Layer를 구분하도록 정리했다.
- Client 영역에는 현재 프로젝트에서 쓰는 슥구 캐릭터 이미지를 넣고, 사용하지 않는 옛 슥구 에셋은 제거했다.

### 검증

- `cd backend && ./mvnw -Dtest=SgguResponseParserTest,SgguIntentClassifierTest,SgguPromptBuilderTest,SgguFallbackComposerTest,SgguConsultationServiceTest,ConsultantControllerTest test`
- `cd backend && ./mvnw test`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run smoke:sggu`
- `git diff --check`
- `python3 -c "import xml.etree.ElementTree as ET; ET.parse('docs/architecture-local-llm.svg')"`
- Chrome headless screenshot 렌더링으로 `docs/architecture-local-llm.png` 출력 상태를 확인했다.

### 다음 작업

- intent 분류는 현재 rule 기반이므로 실제 사용자 질문 로그가 쌓이면 오분류 사례를 fixture로 추가한다.
- LLM 응답 검증은 JSON schema와 keyword grounding 중심이다. 다음 단계에서는 추천 후보 id/label을 구조적으로 echo하게 만들어 검증 정확도를 높인다.
- PostgreSQL을 붙일 때는 캐릭터 스냅샷, 추천 실행 기록, 상담 세션을 먼저 저장 대상으로 잡고, 조회 히스토리와 RAG 문서 저장소는 후순위로 둔다.
- 포트폴리오 문서에는 Spring Boot가 실제로 담당하는 API 소유권과 목표 확장 영역을 더 짧은 발표용 문장으로 정리할 수 있다.

## 앞으로의 기록 방식

매일 작업을 마칠 때 아래 항목을 추가한다.

```md
## YYYY-MM-DD

### 목표

- 오늘 하려던 일

### 변경

- 실제로 바뀐 기능/구조

### 검증

- 실행한 테스트와 결과

### 다음 작업

- 이어서 볼 문제
```

기능 변경이 계산식에 영향을 주면 `docs/lostark-damage-formula.md`도 함께 갱신한다.
