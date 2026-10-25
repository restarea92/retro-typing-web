# 1999 비교 작업대

원본 DOS와 웹 재현에 **같은 정상 입력**을 보내 화면·동작을 비교하는 QA 도구입니다. 게임 상태·점수·진행도를 강제로 바꾸지 않습니다.

## 사람이 사용하기

1. 비교 작업대를 열고 **DOS 파일 열기**에서 사용 권한이 있는 원본 `.zip` 또는 `.jsdos`를 선택합니다. `HTTD.EXE`와 `APP/HNCTT/WORD.KOR`를 포함해야 합니다. 압축 파일은 32 MiB, 해제 크기는 64 MiB 이하입니다.
2. 양쪽 준비 상태를 확인한 뒤 **입력 연결**을 누릅니다. 미준비 상태에서는 연결할 수 없습니다.
3. 웹 화면에서 마우스를 움직이거나 클릭하면 같은 논리 좌표가 DOS로 전달됩니다. 실제 키보드와 가상 키보드는 공통 입력 경로를 사용합니다. 한/영 전환 버튼은 양쪽에 `Shift+Space`를 보냅니다.
4. **모든 키 해제**로 눌림 상태를 해제하고, 연결 버튼으로 일시 정지합니다. 입력 기록은 내보내기·가져오기·재생이 가능합니다.
5. **에이전트 입력 / SDK**의 JSON 입력창으로 아래 시퀀스를 실행할 수 있습니다. 사람과 에이전트가 같은 SDK를 사용합니다.

선택한 원본은 브라우저 메모리에서 처리하며 서버로 업로드하지 않습니다. 원본 실행 파일을 공개 저장소에 넣지 마세요. 입력 로그에는 입력한 키와 좌표가 포함되므로 민감한 정보를 입력하거나 로그를 공개하지 마세요.

## 비교의 범위

- 화면 좌표는 고정 **640×480**, 표시 비율은 4:3입니다. QA 웹 화면은 CRT OFF입니다.
- **난수·시드·실행 시각은 아직 동기화하지 않습니다.** 동일 입력이나 로그 재생이 동일 문제·결과를 보장하지 않습니다.
- 웹은 기존 키보드 브리지와 합성 포인터 이벤트, DOS는 에뮬레이터 입력 API를 사용합니다. 실제 하드웨어 입력이나 OS IME와 완전히 동일하지 않습니다. OS 조합 입력·Meta 단축키·지원하지 않는 키는 전달하지 않습니다.
- 입력 미리보기는 웹 관측값이며 DOS 내부 텍스트를 읽어 일치 판정하는 기능이 아닙니다.
- 입력은 양쪽 대상에 전달합니다. 개별 대상 선택·메모리 수정·숨은 정답 입력 API는 없습니다.
- 중지·포커스 이탈 시 키와 버튼을 해제합니다. DOS에서 버튼 해제가 동작을 발생시키는 경우까지 되돌리지는 않습니다.
- 자동 단위/모의 DOM 테스트 통과는 실제 DOS 실행, 게임 클리어, IME, 모든 브라우저의 검증 완료를 뜻하지 않습니다.

## JavaScript SDK

작업대 최상위 창의 `window.hancomQA`를 사용합니다. iframe 내부 전역이 아닙니다.

```js
const qa = window.hancomQA;
console.log(qa.status());
// 로컬 원본 선택 및 양쪽 준비를 먼저 마칩니다.
qa.setEnabled(true);
await qa.sequence([
  {type: 'keyDown', code: 'Space'},
  {type: 'wait', ms: 80},
  {type: 'keyUp', code: 'Space'},
]);
console.log(qa.log);
```

| 메서드 | 용도 |
|---|---|
| `status()` | 준비·연결·눌린 키/버튼·좌표·실행 중 여부와 웹/DOS 관측 상태 |
| `setEnabled(boolean)` | 양쪽 준비 후 연결, 또는 해제·일시 정지 |
| `keyDown(code 또는 packet)` / `keyUp(code 또는 {code})` | 물리 키 코드 기반 누름·뗌 |
| `mouseMove(x,y)` | 논리 좌표 이동, `0 ≤ x < 640`, `0 ≤ y < 480` |
| `mouseButton(button, pressed)` | DOM 버튼 번호 `0` 왼쪽 / `2` 오른쪽; 가운데 미지원 |
| `click(x,y,button=0)` | 이동·누름·뗌을 순서대로 전달 |
| `releaseAll(reason)` | 모든 입력 해제 및 진행 중 시퀀스 취소 |
| `sequence(steps, {delayMs=30, signal})` | 정상 입력 시퀀스; 완료/오류/취소 후 해제 |
| `replay(events, {speed=1, signal})` | 기록된 정상 입력 재생; 상태 복원 아님 |
| `cancel()` | 실행 중 시퀀스/재생 취소 및 입력 해제 |
| `log` / `clearLog()` | 최대 5,000개 기록의 복사본 / 기록 비우기 |

지원 시퀀스 타입: `keyDown`, `keyUp`, `mouseMove`, `mouseButton`, `click`, `wait`.
시퀀스 최대 10,000단계, `wait.ms`와 단계 간 지연은 0~60,000ms입니다. 재생은 최대 5,000개 기록, 속도는 `0 < speed ≤ 100`입니다.

```js
// 수정 키는 실제 누름/뗌을 명시합니다. 한/영 전환 예시.
await qa.sequence([
  {type:'keyDown', code:'ShiftLeft'},
  {type:'keyDown', code:'Space'},
  {type:'keyUp', code:'Space'},
  {type:'keyUp', code:'ShiftLeft'},
]);
// 좌표는 예시이며 버튼 위치나 의미를 보장하지 않습니다.
qa.mouseMove(320, 240);
qa.mouseButton(0, true);
qa.mouseButton(0, false);
const saved = qa.log;
await qa.replay(saved, {speed:1});
qa.releaseAll('manual-stop');
```

키 패킷은 `code`, `repeat`, `shiftKey`, `ctrlKey`, `altKey`, `metaKey`, `capsLock`, `isComposing`, `keyCode`를 받을 수 있습니다. 수정 키는 순서대로 눌러 상태를 맞추세요. 반복 입력은 이미 눌린 키에 `repeat:true`를 지정합니다. 알 수 없는 코드는 임의로 다른 키로 치환하지 않습니다.

개별 전송 결과 `{web, dos}`는 각 어댑터의 수락 여부이며 화면 결과 일치 판정이 아닙니다. 어댑터 예외 시 입력을 해제하고 연결을 멈춥니다. 재생 취소는 진행 중 지연이 끝난 후 관찰될 수 있으며 과거 입력을 되돌리지 않습니다.

## 개발자 테스트

`source/`와 형제 디렉터리 `tests/` 구조를 유지합니다.

```sh
cd tests
npm install --ignore-scripts
npm test
```

테스트는 Node 내장 테스트 러너와 LinkeDOM을 사용합니다. 원본 DOS 파일·외부 서버·에뮬레이터 vendor 파일은 이 독립 테스트에 필요하지 않습니다. 테스트 의존성, `node_modules`, 로컬 원본, 개인 로그는 배포 산출물에 포함하지 않습니다. 에뮬레이터 실행에 필요한 vendor는 별도 고정 버전/해시 절차로 준비해야 합니다.
