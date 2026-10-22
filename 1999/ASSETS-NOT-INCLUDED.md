# 포함하지 않은 자료

다음 파일은 원본 자료 또는 직접 추출한 데이터가 들어 있어 공개하지 않았습니다. 호환 자료를 별도로 제공한다면 import에 필요한 이름과 구조는 아래와 같습니다. 원본 자료의 재배포 권리가 있다는 의미는 아닙니다.

| 파일 | 구현에서 필요한 역할 |
| --- | --- |
| `practice-texts.js` | `PRACTICE_TEXTS`, `PRACTICE_SOURCE_FILES`: 언어별 낱말·짧은 글 연습 데이터 |
| `long-texts.js` | `LONG_TEXTS`, `LONG_TEXT_INVENTORY`: 긴 글 목록과 본문 |
| `help-pages.js` | `ORIGINAL_HELP`: 도움말 페이지·문구·배치 |
| `original-compounds.js` | `ORIGINAL_COMPOUNDS`: 입력 조합 표 |
| `original-keyboard-maps.js` | `ORIGINAL_KEYBOARD_MAPS`: 자판별 글쇠 매핑 |
| `original-finger-tables.js` | `ORIGINAL_FINGER_TABLES`: 손가락 통계용 표 |
| `original-key-stage-pools.js` | `ORIGINAL_KEY_STAGE_POOLS`: 단계별 자리 연습 데이터 |
| `original-progression.js` | `ORIGINAL_PROGRESSION`: 단계 진행 표 |
| `original-word-stage-rules.js` | `ORIGINAL_WORD_STAGE_RULES`, `originalWordEligible`, `originalWordLine`: 추출 표와 관련 함수가 섞여 있어 전체 모듈 제외 |
| `httd-original-pixel.woff` | 원본에서 추출한 글꼴 |
| `welcome-card.png` | 시작 화면 그림 |

또한 CSS 내부의 모든 이미지·폰트 데이터 URL을 `none`으로 바꿨습니다. 여기에는 추출한 아이콘·글리프뿐 아니라 출처를 개별 확정하지 않은 도형 데이터도 포함됩니다. 기존 리소스를 되살리는 자동 다운로드나 추출 스크립트는 제공하지 않습니다.

호환 리소스를 로컬에 준비한 경우에도 현재 파일의 소비 코드를 확인하여 데이터 구조를 맞춰야 합니다. 루트 `.gitignore`는 위 원본 자료가 실수로 올라가지 않도록 제외하지만, 새로운 이름이나 내장 데이터까지 막지는 못하므로 공개 전에 반드시 다시 검토하세요.
