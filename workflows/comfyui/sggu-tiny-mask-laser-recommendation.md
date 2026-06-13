# Sggu 파이프 제거/레이저 포인터 대체 권장안

## 이번 ComfyUI API tiny-mask 재시도 결과
- 워크플로: `C:/새 폴더/lostark/workflows/comfyui/sggu_tiny_mask_laser_v4_1781182580.json`
- 마스크: `C:/새 폴더/lostark/public/generated/sggu-pipe-hand-mask-tiny-v4.png`
- 결과 후보: `C:/새 폴더/lostark/public/generated/sggu_tiny_mask_laser_v4_1781182580.png`
- 판정: **사용 불가**

## 사용 불가 이유
- 파이프가 제거되지 않고 더 크게/명확하게 재생성됨.
- 연기 잔상이 그대로 남아 있음.
- 손 모양도 원본 대비 변형됨.
- 작은 레이저 포인터/레이저 빔으로 바뀌지 않음.

## 권장 작업 방식
현재 SDXL inpainting만으로는 “원본 캐릭터 완전 보존 + 파이프만 제거 + 작은 포인터 추가” 조건을 안정적으로 만족하지 못했습니다. 다음 방식 권장:

1. **수동/반자동 2단계 편집**
   - 포토샵/Photopea/Krita 등에서 파이프와 연기를 먼저 수동 제거.
   - 원본 얼굴선/입선/손가락선을 가능한 직접 복원.
   - 작은 검은 레이저 포인터와 얇은 cyan 빔은 벡터/레이어로 직접 추가.

2. **ComfyUI를 계속 쓴다면**
   - 전체 캐릭터를 다시 그리는 inpaint가 아니라, 제거된 깨끗한 PSD/PNG를 기반으로 마무리 보정만 사용.
   - 마스크는 `pipe stem + bowl + hand contact + smoke`를 모두 포함하되, ControlNet 강도는 낮게 유지.
   - denoise는 0.35~0.50부터 시도해 원본 보존 우선.
   - 프롬프트는 “laser pointer 생성”보다 “remove pipe, restore face and fingers”를 우선하고, 포인터/빔은 후처리로 추가 권장.

## 추천 프롬프트
Positive:
```text
localized cleanup edit, preserve all unmasked pixels exactly, remove smoking pipe and smoke, restore clean lower face with a small stern anime mouth line, restore natural fingers, seamless matching anime line art and shading, same character, same suit, same hair, same eyes
```

Negative:
```text
pipe, smoking pipe, tobacco pipe, smoke, cigar, cigarette, cup, mug, black blob, large object, deformed hand, extra fingers, missing fingers, changed face, changed hair, changed eyes, different character
```

후처리 레이어 권장:
- 레이저 포인터: 손가락 사이에 20~35px 길이의 작은 검정/짙은 회색 막대.
- 레이저 빔: 1~2px cyan 선, opacity 60~80%, 약한 outer glow.
