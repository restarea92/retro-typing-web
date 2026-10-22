// Newly authored practice material. No original program resources are distributed.
export const MODES = [
  { id: 'keys', title: '자리 연습' }, { id: 'words', title: '낱말 연습' },
  { id: 'sentences', title: '짧은 글 연습' }, { id: 'long', title: '긴 글 연습' }
];
export const LESSONS = {
  keys: ['ㅁ ㄴ ㅇ ㄹ ㅎ ㅗ ㅓ ㅏ ㅣ', 'ㅂ ㅈ ㄷ ㄱ ㅅ ㅛ ㅕ ㅑ ㅐ ㅔ', 'ㅋ ㅌ ㅊ ㅍ ㅠ ㅜ ㅡ', 'asdf jkl; asdf jkl;'],
  words: ['하늘 바람 구름 나무', '책상 연필 공책 지우개', '아침 햇살 작은 창문', '마음 웃음 친구 약속'],
  sentences: ['창가에 앉아 오늘의 첫 문장을 적습니다.', '천천히 익힌 손끝이 내일은 조금 더 가벼워집니다.', '작은 화면 안에 오래된 기억이 반짝입니다.'],
  long: ['아침의 창문\n\n창문을 열자 서늘한 바람이 방 안으로 들어왔습니다. 책상 위에는 어제 덮어 둔 공책이 놓여 있었습니다. 나는 새 페이지를 펴고 오늘 하고 싶은 일을 한 줄씩 적었습니다.\n\n서두르지 않아도 괜찮습니다. 짧은 문장 하나를 정확하게 쓰는 일부터 시작합니다. 손끝에서 만들어진 글자가 화면을 채울 때마다 작은 성취가 쌓입니다.']
};
export const KEY_ROWS = ['ㅂ ㅈ ㄷ ㄱ ㅅ ㅛ ㅕ ㅑ ㅐ ㅔ'.split(' '), 'ㅁ ㄴ ㅇ ㄹ ㅎ ㅗ ㅓ ㅏ ㅣ'.split(' '), 'ㅋ ㅌ ㅊ ㅍ ㅠ ㅜ ㅡ'.split(' ')];
