# 조선 수호 장기 — 작업 안내 (Claude용)

초등 5학년 사회(세종 쓰시마 정벌·4군 6진, 임진왜란, 병자호란)를 배우는 롤토체스식 웹게임이다.
사용자는 교사다. 모든 답변은 한국어로, 학생이 읽을 글은 쉬운 말로 쓴다.

## 지금 진행 중인 일 (사용자가 "하던 거 계속해"라고 하면 이것을 한다)

브랜치: `design-wip` — 사용자 요청: "기본 필드 이미지(바다 등)랑 메인화면 디자인이 너무 구려. 역사게임답게."

이미 한 것:
- `img/bg/{sea,river,riverN,field,snow}.png` 전투장 도트 배경 (만든 코드: `art/gen-backgrounds.js`)
- `data.js` 단계마다 `bg:` 필드 (3장은 `snow`)
- `index.html` 일월오봉도 SVG 메인화면, 현판 제목(`.hyunpan`), 단청 띠(`.dancheong`), 두루마리 설명(`.howto.scroll`), 출정 버튼(`.btn.seal`)
- Google Fonts 링크: Song Myung, Gowun Batang (index.html, credits.html)
- `theme.css` 초안 (있으면 그대로 쓰고, 없으면 아래 색으로 새로 만든다)

남은 일 (차례대로):
1. `theme.css`를 `style.css` 다음에 불러오도록 `index.html`, `credits.html`에 `<link>` 추가.
   색: 옻칠 #2a1a12/#3d2618, 한지 #f4e9d0, 주칠 #b03524, 단청 초록 #2f6b57, 남색 #22405e, 금 #e7bf55.
   제목 글꼴 `"Song Myung"`, 이야기 글 `"Gowun Batang"`.
2. `game.js`
   - `boardBase()`의 `b.className = 'board ' + terrain;` → `'board ' + terrain + ' bg-' + (c.siege ? 'snow' : stage().bg)`
   - `renderChapters()`의 `b.style.background = c.color;` → `b.style.setProperty('--cc', c.color);`
   - 맨 위 `VERSION`을 `v1.001`로.
3. 출처: `credits.html`의 "글꼴" 칸과 `THIRD-PARTY-NOTICES.txt` 3번에 아래를 넣는다.
   - Song Myung © JIKJI SOFT, SIL Open Font License 1.1 (Google Fonts)
   - Gowun Batang © Yanghee Ryu, SIL Open Font License 1.1 (Google Fonts)
   - 인터넷이 없으면 기기 기본 글꼴로 보인다고 적는다.
4. 확인: 시작 화면, 장 선택, 1장 바다·강, 3장 눈 성벽 화면이 깨지지 않는지 본다.
   개발용 미리보기: `index.html?demo=prep&ch=0` (ch 0~2, `&st=` 단계 번호, `demo=battle`이면 바로 전투).
5. `design-wip`에만 커밋하고 푸시한다. **main에는 합치지 않는다.** main은 GitHub Pages로 학생들이 쓰는 주소다.
   사용자가 확인한 뒤 PC에서 합친다.

할 수 없는 일(이 PC의 도구가 필요한 일: 새 효과음, Pixelbolt·pixelfx로 새 그림)은 하지 말고 무엇을 못 했는지 알려 준다.

## 늘 지키는 규칙
- 교과서와 다른 내용이 있으면 **교과서 문장**을 따른다 (예: 쓰시마 "항복을 받았다", 병자호란 항복 원인 "추위와 배고픔").
- 그림·소리·글꼴·라이브러리를 더하거나 빼면 `credits.html`과 `THIRD-PARTY-NOTICES.txt`를 같은 작업에서 고친다.
  시작 화면과 메뉴 맨 아래 `출처와 라이선스` 링크는 지우지 않는다.
- 학생 이름·사진, 사용자 이름·이메일은 어디에도 넣지 않는다.
- 고칠 때마다 `game.js`의 `VERSION`을 0.001 올린다.
- 난이도를 바꾸면 `node tools/sim.js '<시험 목록 JSON>'`으로 확인한다 (사용법은 파일 안 참고).

## 파일
- `data.js` 유닛·필살기·아이템·장/단계·이야기·퀴즈
- `engine.js` 육각 판 자동 전투 (화면과 분리)
- `game.js` 화면·상점·레벨·아이템·이야기 흐름
- `sprites.js` 스프라이트 위치표 (자동 생성), `img/units.png`, `img/fx/*.png`
- `art/` 그림 생성 코드와 레시피 (게임 실행에는 필요 없음)
