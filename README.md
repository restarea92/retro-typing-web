# Retro Typing Web: 1997 + 1999

1997·1999년 한컴타자연습을 참고해 만든 브라우저 재현 프로젝트의 코드와 문서를 한 곳에 정리합니다.

- `1999/`: 현재 우선 개발 중인 버전. 2026-10-22 18:23 UTC 입력 이벤트 중복 처리 수정 프리뷰의 구현 소스입니다.
- `1997/`: 기존 버전 보관. 추가 개발은 잠시 멈춘 상태입니다.
- 두 버전은 서로 독립적으로 보관하며, 이 저장소를 만들면서 기존 서비스의 배포 설정을 바꾸지 않았습니다.

## 공개 범위

이 저장소는 **코드 중심의 보관본이며, 그대로 실행할 수 있는 완성 배포본이 아닙니다.** 직접 작성한 웹 구현 코드, 스타일 구조, 문서와 공개용 검사를 포함합니다.

원본 프로그램 실행파일, 배포 압축파일, 추출 폰트·글리프, 연습문장·사전·긴 글, 도움말 원문, 직접 추출한 데이터 표, 원본 이미지와 화면 캡처는 공개하지 않습니다. CSS에 들어 있던 이미지·폰트 데이터 URL도 공개용 사본에서 제거했습니다. 제외한 모듈에 대한 import와 리소스 경로는 구현 관계를 보여 주기 위해 남아 있습니다.

따라서 현재 checkout만으로는 앱이 정상 시작되지 않을 수 있습니다. 각 버전의 `README.md`와 `ASSETS-NOT-INCLUDED.md`에 필요한 파일과 제한을 적었습니다. 실행 자료를 보완하려면 해당 자료를 적법하게 사용할 수 있는지 먼저 확인하고, 공개 저장소에는 올리지 마세요.

## 구조

```
1997/     기존 1997 버전의 공개 가능 코드
1999/     현재 우선 개발 중인 1999 버전의 공개 가능 코드
scripts/  공개 범위와 소스 구문 검사
tests/    공개용 기본 검사
1999/tests/  독립 단위 테스트와 리소스 조건부 검사
1999/qa/     게임·포커스 회귀 검사와 선택 실행용 DOM 도구
```

각 `SOURCE-MANIFEST.json`에는 원본 웹 구현 사본의 SHA-256, 공개 사본의 SHA-256, 제거한 CSS 내장 리소스 수를 기록합니다. 이 해시는 파일 추적용이며 원본 프로그램과의 완전한 일치나 권리 확인을 뜻하지 않습니다.

## 확인 방법

기본 테스트는 Node.js 20 이상에서 별도 패키지 설치 없이 실행합니다. 공개 소스 검사에는 Python 3도 필요합니다.

```
npm run verify
npm test
```

기본 검사는 공개 파일 범위·의심스러운 비밀정보 패턴·소스 구문, 공개 가능한 단위 테스트와 게임 엔진 89개 사례를 다룹니다. 현재 기본 결과는 191개 통과·422개 명시적 SKIP입니다. 리소스가 필요한 게임·워밍업·완료·표시·키보드/입력 이벤트·자판 전달·메인 포커스·헤더·시작 흐름 사례는 통과로 집계하지 않습니다. 제외된 리소스가 필요한 전체 앱 실행, 화면 일치, 실제 키보드 입력 검증을 대체하지 않습니다. 과거 내부 테스트 보고서와 원본 화면 캡처는 이 저장소에 포함하지 않았습니다.

## 선택 실행 도구

- `npm run test:resource-runtime`: 호환 리소스와 `npm install`로 준비한 LinkeDOM 0.18.14가 있을 때만 보관한 리소스 의존 사례를 실행합니다. 원본 제목 이미지 검사 1개는 공개본에서 계속 제외됩니다. 공개 사본만으로는 실행되지 않습니다.
- `npm run build:1997`, `npm run build:1999`: 필요한 호환 리소스가 로컬에 모두 있을 때만 별도 `dist/` 하위 폴더로 정적 파일을 복사합니다. 원본 자료를 다운로드하거나 추출하지 않습니다.
- 빌드 후에도 CSS 내장 이미지·폰트를 제거한 차이는 남습니다. 로컬에서 빌드했다고 배포 권리나 원본과의 화면 일치가 확인되는 것은 아닙니다.

`npm run verify`는 공개용 트리만 검사하므로, 제외 리소스를 별도로 채워 넣은 작업 사본에서는 의도적으로 실패합니다. 공개용 사본과 리소스를 추가한 로컬 실행 사본을 구분하세요.

현재는 사용자 요청에 따라 가상 키보드를 숨기고 렌더러·키 소리 초기화를 중단했습니다. 기기 한글 조합과 물리 키 입력은 유지합니다. 직접 작성한 WebGL 소스는 비활성 보관용이며, 실제 3D·소리·iPhone/Safari 입력 검증 완료를 뜻하지 않습니다. 범례에도 제외된 호환 매핑 자료가 필요합니다.

자세한 공개 테스트 범위는 `1999/TESTING.md`를 참고하세요.

## 권리와 관계

이 프로젝트는 비공식 재현 작업이며 한글과컴퓨터의 공식 제품이나 지원 서비스가 아닙니다. 제3자 자료에 대한 이용 허가를 부여하지 않습니다. 저장소 생성 시 별도의 LICENSE 파일은 추가하지 않았습니다.

## 2026-10-24 display update

1999 fullscreen now targets an outer viewport rather than the 640×480 program itself. It scales uniformly to viewport height, centers horizontally, and clips the sides on narrow screens rather than relaying out the original UI. Wide displays retain side bars. Windowed mode keeps its existing fit-down behavior.

CRT display defaults on and has persistent on/off controls outside the original screen and within fullscreen. A restrained highlight bloom preserves the sharp source; source-row scanlines track the display scale, while RGB phosphor stripes track output device pixels. Low-density displays attenuate masks to avoid aliasing. This is a lightweight DOM/SVG/CSS simulation, not a full analog CRT signal model or a claim of CRT-Royale equivalence. CRT off removes all added filters and masks.

Validation separates pure geometry/preference tests, simulated-DOM input regressions, and real browser/device evidence. Actual iPhone/DOS verification is not implied. The original-resource modules and assets remain excluded from this public source tree.

## 2026-10-26 completion parity fixes

1999 long practice now waits for its per-page five-field result, including the short final page; Enter/Space continues and Escape/close leaves. Reentering a page starts with fresh answers. Special next-stage waits in both games no longer trigger the active-game idle timeout. Exam EOF headings advance beyond the final page, while deadline headings stay on the current page. Focused synthetic DOM regressions cover these boundaries; see `1999/TESTING.md` for passed and explicitly skipped checks. No 1997 code or excluded original assets changed.
