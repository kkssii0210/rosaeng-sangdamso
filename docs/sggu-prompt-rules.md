# Sggu Prompt Rules

이 문서는 슥구 이미지를 생성, inpaint, compositing, 후처리할 때 사용하는 작업용 프롬프트 규칙이다.
캐릭터 정체성의 source of truth는 [Sggu Character Guide](./sggu-character-guide.md)이며, 이 문서는 실제 생성 작업에서 그 기준을 흔들리지 않게 적용하기 위한 보조 매뉴얼이다.

## Working Principle

- 먼저 `docs/sggu-character-guide.md`를 읽고 기준 에셋을 확인한다.
- 기준 에셋은 `public/sggu-cutout.png`다.
- `public/sggu-welcome-canonical.png`와 다른 파생 이미지는 보조 참고 자료로만 사용한다.
- 텍스트 프롬프트만으로 완전히 새 슥구를 만들지 않는다.
- 가능한 경우 기존 컷아웃, 마스크, 오버레이, SVG, CSS animation, sprite frame 방식으로 해결한다.
- 새 이미지 생성이 필요하면 reference image, inpaint mask, ControlNet/IPAdapter 같은 identity-preserving 경로를 우선한다.

## Identity Lock

프롬프트를 짧게 써야 할 때도 아래 요소는 반드시 고정한다.

```text
Sggu identity lock: chibi anime mascot, oversized head, small body, pale skin, stern half-lidded bright cyan-blue eyes, sharp thick black eyebrows, small serious mouth, short spiky black hair with a central long bang and angular side tufts, gray glossy hair highlights, black formal suit or uniform, white shirt, black tie, silver chain and star pin details, calm intelligent counselor expression.
```

## Reference Image Prompt

기준 이미지를 함께 넣는 생성/편집 작업에서는 아래 문장을 프롬프트 앞에 둔다.

```text
Use the provided Sggu reference asset as the identity and style reference. Preserve the same face, hair silhouette, cyan-blue eyes, sharp black eyebrows, chibi proportions, black formal suit, silver chain/star details, clean anime line art, and soft cel shading. Change only the requested pose, prop, expression, or scene.
```

## Default Positive Prompt

```text
high-quality polished chibi anime mascot illustration, same Sggu mascot identity, oversized chibi head and small body, pale skin, short spiky black side-parted hair with a central long bang and angular tufts, thick sharp black eyebrows, bright cyan-blue eyes, small serious mouth, calm stern intelligent expression, black formal suit uniform, white shirt, black tie, silver chain and star pin details, black shoes, clean thick anime line art, soft cel shading, crisp UI asset, consistent character design
```

## Default Negative Prompt

```text
different character, realistic adult proportions, tall body, different hair color, brown hair, white hair, long hair, fluffy round hair, soft round eyebrows, thin eyebrows, purple eyes, gray eyes, dull eyes, overly happy smile, open-mouth yelling, childlike cheerful expression, fantasy armor, colorful casual clothes, hoodie, school uniform, extra characters, cluttered background, readable text, watermark, logo, low quality, blurry, bad anatomy, bad hands, extra fingers, missing fingers
```

## Pipe And Prop Rules

파이프는 슥구의 대표 소품이지만 모든 장면에 필수는 아니다.
장면상 파이프가 필요 없으면 프롬프트와 negative prompt에 모두 제거 조건을 넣는다.

```text
remove the smoking pipe completely, no pipe, no smoke, no cigarette, no cigar
```

파이프를 다른 소품으로 바꿀 때는 소품을 작고 명확하게 지정한다.

- 강의 장면: `thin classroom pointer stick` 또는 `small black laser pointer remote`
- 발표 장면: `small presentation clicker`
- 업무 장면: `pen`, `clipboard`, `laptop`, `document`
- 웰컴 장면: `one hand resting on a polished wooden desk`, `composed greeting gesture`

파이프 제거처럼 입, 손, 손가락이 겹치는 작업은 생성 모델만으로 안정적이지 않다.
먼저 파이프와 연기를 깨끗하게 지우고, 손/입 선을 복원한 뒤 포인터나 빔은 별도 레이어 또는 SVG로 올리는 방식을 우선한다.

## Inpaint Rules

국소 편집은 전체 재생성보다 보존을 우선한다.

```text
localized inpainting edit, preserve all unmasked pixels exactly, remove only the requested object, restore clean anime line art and matching cel shading, same Sggu face, same hair, same eyes, same suit, seamless edit
```

권장 흐름:

- 마스크는 바꾸려는 물체와 접촉부를 충분히 포함한다.
- 얼굴, 눈, 눈썹, 머리 실루엣은 마스크에서 최대한 제외한다.
- denoise는 낮은 값부터 시작한다. 원본 보존이 중요하면 0.35~0.50, 형태 재구성이 필요하면 0.55~0.70을 먼저 시도한다.
- 포인터 빔, UI용 작은 소품, 반짝임 같은 얇은 요소는 후처리 레이어가 더 안정적이다.
- 실패 결과는 `public/generated/`에 후보로만 두고, 실제 앱에는 검수된 최종본만 `public/`에 둔다.

## Situation Templates

### Chalkboard Teacher

```text
Create Sggu standing beside a green classroom chalkboard, explaining a lesson with one arm raised and holding a thin classroom pointer stick or small black laser pointer remote. The pointer clearly indicates the chalkboard. Preserve the same chibi face, spiky black hair, cyan-blue eyes, stern expression, black formal uniform, silver chain and star pin details. No pipe, no smoke, no readable text on the board.
```

### Welcome Counselor

```text
Create Sggu seated behind a polished wooden desk, facing forward with a calm stern counselor expression, one hand resting on the desk and the other in a composed greeting pose. Preserve the same chibi proportions, spiky black hair, cyan-blue eyes, black formal suit, white shirt, black tie, silver chain and star pin details. Dark elegant background, clean anime cel shading.
```

### Laptop Work

```text
Create Sggu working at a tidy desk with a laptop, focused and serious, with a subtle screen glow reflected in his cyan-blue eyes. Preserve the same chibi identity, black spiky hair, black formal uniform, white shirt, black tie, silver chain and star pin details. No pipe, no smoke, no readable screen text.
```

### Presentation

```text
Create Sggu standing near a clean presentation screen, holding a small presentation clicker and calmly explaining a recommendation. Preserve the same stern chibi face, cyan-blue eyes, black spiky hair, black suit uniform, silver chain and star details. No readable slide text, no extra characters.
```

### Researcher Variant

```text
Create Sggu as a chibi researcher wearing a white lab coat over his black formal suit and black tie, holding a clipboard. Preserve the stern face, cyan-blue eyes, sharp eyebrows, spiky black hair, and visible silver chain/star details. Clean lab background, no pipe, no smoke.
```

## Review Checklist

새 슥구 이미지나 프레임을 반영하기 전에 확인한다.

- `public/sggu-cutout.png`와 같은 캐릭터로 보이는가?
- 검은 각진 머리, 중앙 앞머리, 시안 블루 눈, 굵은 검은 눈썹이 유지되는가?
- 표정이 귀엽지만 진지한 상담사 인상을 유지하는가?
- 검은 정장/제복, 흰 셔츠, 검은 넥타이, 은색 장식 중 핵심 요소가 남아 있는가?
- 새 포즈나 소품이 캐릭터 정체성을 흐리지 않는가?
- 필요 없는 파이프나 연기가 들어가지 않았는가?
- 얇은 포인터, 레이저 빔, 눈 깜빡임 같은 요소를 이미지 재생성 대신 오버레이나 프레임으로 처리할 수 없는가?