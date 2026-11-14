/* 조선 수호 장기 — 게임 데이터 (코드로 직접 만듦)
   교과서(초등 5학년 사회) 내용을 기준으로 함. */

// ───────── 유닛 ─────────
// side: 'p' 조선(플레이어), 'e' 적
// ch: 장기알에 쓰는 글자, cost: 군량, range: 사거리(칸), cd: 공격 간격(틱), move: 한 번에 움직이는 칸
const UNITS = {
  // 조선 — 공통
  spear:   { side:'p', name:'창병',   ch:'창', cost:1, hp:60,  atk:8,  range:1, cd:2, move:1, traits:['관군'],
             fact:'조선의 기본 군사예요. 긴 창으로 맨 앞에서 적을 막아요.' },
  archer:  { side:'p', name:'궁수',   ch:'궁', cost:1, hp:40,  atk:7,  range:3, cd:2, move:1, traits:['관군'],
             fact:'조선 사람들은 활쏘기를 잘했어요. 멀리서 화살을 쏘아요.' },
  cavalry: { side:'p', name:'기병',   ch:'기', cost:2, hp:75,  atk:10, range:1, cd:2, move:2, traits:['관군'],
             fact:'말을 탄 군사예요. 빠르게 달려가 싸워요.' },
  rocket:  { side:'p', name:'신기전', ch:'신', cost:3, hp:35,  atk:8,  range:4, cd:3, move:1, traits:['화약'], splash:true,
             fact:'세종 때 만든 로켓 화살이에요. 한 번에 여러 적을 맞혀요.' },
  ship:    { side:'p', name:'병선',   ch:'선', cost:2, hp:80,  atk:8,  range:2, cd:2, move:1, traits:['관군'],
             fact:'바다를 건너 쓰시마섬으로 간 조선의 배예요.' },
  gunner:  { side:'p', name:'포수',   ch:'포', cost:2, hp:45,  atk:12, range:3, cd:2, move:1, traits:['관군'],
             fact:'임진왜란 뒤 조선도 조총을 쓰는 군사를 길렀어요.' },
  // 조선 — 장수
  leeJM:   { side:'p', name:'이종무', ch:'장', cost:3, hp:130, atk:12, range:1, cd:2, move:1, traits:['장수'], general:true,
             fact:'세종 때 배와 군사를 이끌고 쓰시마섬을 공격한 장수예요.' },
  choiYD:  { side:'p', name:'최윤덕', ch:'장', cost:3, hp:120, atk:11, range:2, cd:2, move:1, traits:['장수'], general:true,
             fact:'압록강 쪽의 여진을 몰아내는 데 앞장선 장수예요.' },
  kimJS:   { side:'p', name:'김종서', ch:'장', cost:3, hp:135, atk:12, range:1, cd:2, move:1, traits:['장수'], general:true,
             fact:'두만강 쪽의 여진을 몰아내는 데 앞장선 장수예요.' },
  // 조선 — 임진왜란의 세 가지 힘
  panok:   { side:'p', name:'판옥선', ch:'판', cost:2, hp:95,  atk:10, range:2, cd:2, move:1, traits:['수군'],
             fact:'조선 수군의 크고 튼튼한 배예요. 대포를 쏘아요.' },
  turtle:  { side:'p', name:'거북선', ch:'귀', cost:3, hp:150, atk:13, range:1, cd:2, move:1, traits:['수군'],
             fact:'지붕을 덮어 적이 올라타기 어려운 배예요. 이순신 수군의 자랑이에요.' },
  yiSS:    { side:'p', name:'이순신', ch:'장', cost:4, hp:150, atk:15, range:3, cd:2, move:1, traits:['수군','장수'], general:true,
             fact:'수군을 이끌고 바다에서 일본군을 물리친 장수예요.' },
  militia: { side:'p', name:'의병',   ch:'의', cost:1, hp:60,  atk:9,  range:1, cd:2, move:1, traits:['의병'],
             fact:'나라를 지키려고 스스로 일어난 백성들이에요.' },
  milLead: { side:'p', name:'의병장', ch:'의', cost:3, hp:115, atk:12, range:1, cd:2, move:1, traits:['의병'], general:true,
             fact:'의병을 이끈 사람이에요. 고향 땅을 잘 알아 적을 놀라게 했어요.' },
  ming:    { side:'p', name:'명군',   ch:'명', cost:2, hp:90,  atk:10, range:1, cd:2, move:1, traits:['명군'],
             fact:'조선을 도우러 온 명나라 군사예요.' },
  mingGun: { side:'p', name:'명 포병', ch:'포', cost:3, hp:55,  atk:13, range:3, cd:3, move:1, traits:['명군'], splash:true,
             fact:'명나라 군대는 큰 대포를 가지고 왔어요.' },
  castle:  { side:'p', name:'남한산성', ch:'성', cost:0, hp:1000, atk:0, range:0, cd:99, move:0, traits:[], fixed:true,
             fact:'인조가 피신한 산성이에요. 이 성을 지켜야 해요.' },

  // 적
  wokou:   { side:'e', name:'왜구',     ch:'왜', hp:45,  atk:7,  range:1, cd:2, move:1,
             fact:'바닷가 마을을 쳐들어와 물건과 사람을 빼앗아 간 해적이에요.' },
  wokouA:  { side:'e', name:'왜구 궁수', ch:'궁', hp:35,  atk:6,  range:3, cd:2, move:1,
             fact:'멀리서 화살을 쏘는 왜구예요.' },
  wokouB:  { side:'e', name:'왜구 두목', ch:'두', hp:110, atk:10, range:1, cd:2, move:1, general:true,
             fact:'쓰시마섬 왜구를 이끄는 두목이에요.' },
  jur:     { side:'e', name:'여진 기병', ch:'여', hp:60,  atk:8,  range:1, cd:2, move:2,
             fact:'조선 북쪽에 살던 여진은 말을 잘 탔어요.' },
  jurA:    { side:'e', name:'여진 궁기병', ch:'궁', hp:45, atk:7,  range:2, cd:2, move:2,
             fact:'말을 타고 활을 쏘는 여진 군사예요.' },
  jurC:    { side:'e', name:'여진 추장', ch:'추', hp:140, atk:11, range:1, cd:2, move:1, general:true,
             fact:'여진 부족을 이끄는 우두머리예요.' },
  gun:     { side:'e', name:'조총병',   ch:'총', hp:55,  atk:15, range:3, cd:2, move:1, boom:true,
             fact:'조총은 일본군이 가진 새로운 무기예요. 멀리서 강하게 공격해요.' },
  samurai: { side:'e', name:'일본군',   ch:'일', hp:85,  atk:11, range:1, cd:2, move:1,
             fact:'칼과 창을 든 일본군이에요.' },
  jpGen:   { side:'e', name:'일본 장수', ch:'장', hp:190, atk:14, range:1, cd:2, move:1, general:true,
             fact:'많은 군사를 이끌고 조선을 침략한 일본군 장수예요.' },
  jpShip:  { side:'e', name:'일본 배',  ch:'선', hp:80,  atk:9,  range:2, cd:2, move:1,
             fact:'일본군을 싣고 바다를 건너온 배예요.' },
  qing:    { side:'e', name:'청 기병',  ch:'청', hp:80,  atk:11, range:1, cd:2, move:2,
             fact:'청은 여진이 세운 나라예요. 말을 탄 군사가 아주 강했어요.' },
  qingA:   { side:'e', name:'청 궁기병', ch:'궁', hp:60,  atk:9, range:3, cd:2, move:2,
             fact:'말을 타고 활을 쏘는 청나라 군사예요.' },
  qingG:   { side:'e', name:'청 장수',  ch:'장', hp:230, atk:16, range:1, cd:2, move:1, general:true,
             fact:'남한산성을 둘러싼 청군을 이끄는 장수예요.' },
};

// ───────── 시너지 ─────────
// count: 판 위에 같은 특성 유닛이 몇 개 있어야 하는지
const TRAITS = {
  '관군': { icon:'🛡', steps:[3], desc:'관군 3명: 관군 체력 +20%' },
  '장수': { icon:'⭐', steps:[1], desc:'장수 1명: 모든 아군 공격력 +10%' },
  '수군': { icon:'⚓', steps:[2,4], desc:'수군 2명: 수군 공격력 +25% / 4명: +50%' },
  '의병': { icon:'✊', steps:[2], desc:'의병 2명: 의병 체력 +30%, 공격력 +10%' },
  '명군': { icon:'🤝', steps:[2], desc:'명군 2명: 명군 공격력 +30%' },
  '화약': { icon:'💥', steps:[], desc:'주변 적에게도 피해를 줘요' },
};
const CRISIS_DESC = '수군·의병·명군 효과가 모두 켜지면 「위기 극복」: 모든 아군 공격력·체력 +20%';

// ───────── 장(챕터)과 단계 ─────────
// enemies: [유닛 id, 열(0~5), 행(0~2)]
const CHAPTERS = [
  {
    id: 1, title: '1장. 세종, 나라를 넓히다', short: '세종 때',
    color: '#2f6f4f',
    startGold: 8, startCap: 3,
    intro: [
      { who:'이야기', text:'조선의 네 번째 임금 세종 때의 이야기예요.' },
      { who:'이야기', text:'남쪽 바다에서는 왜구가, 북쪽에서는 여진이 자주 쳐들어와 백성을 괴롭혔어요.' },
      { who:'세종', text:'백성을 지키기 위해 군사를 보내겠노라!' },
      { who:'안내', text:'상점에서 군사를 사서 장기판 아래쪽에 놓고 「전투 시작」을 누르면, 군사들이 스스로 싸워요. 같은 군사 3명을 모으면 ★2로 강해져요!' },
    ],
    stages: [
      {
        id:'1-1', title:'쓰시마섬을 공격하라', terrain:'sea', mult:0.8,
        pool:['spear','archer','ship','leeJM'],
        enemies:[['wokou',1,1],['wokou',3,1],['wokouA',2,0],['wokouB',3,0]],
        pre:[
          { who:'이야기', text:'바닷가 마을을 노략질하던 왜구의 소굴은 쓰시마섬이었어요.' },
          { who:'세종', text:'왜구의 소굴인 쓰시마섬을 공격하라!' },
          { who:'안내', text:'이번 전투는 바다 위에서 벌어져요. 「병선」과 장수 「이종무」를 써 보세요.' },
        ],
        win:[
          { who:'이야기', text:'조선군이 쓰시마섬을 공격하여 왜구로부터 항복을 받았어요!' },
          { who:'안내', text:'승리 보상: 군량 +5, 배치할 수 있는 군사 +1' },
        ],
        reward:{ gold:5, cap:1 },
        quiz:{ q:'세종 때 조선이 공격한 왜구의 소굴은 어디일까요?', a:['쓰시마섬','제주도','강화도'], ok:0,
               why:'세종 때 왜구의 소굴인 쓰시마섬을 공격하여 왜구로부터 항복을 받았어요.' },
        map:'tsushima',
      },
      {
        id:'1-2', title:'압록강의 여진을 몰아내라', terrain:'land', mult:0.85,
        pool:['spear','archer','cavalry','rocket','choiYD'],
        enemies:[['jur',0,1],['jur',2,1],['jur',4,1],['jurA',1,0],['jurA',4,0]],
        pre:[
          { who:'이야기', text:'이번에는 북쪽이에요. 서쪽으로 흐르는 큰 강, 압록강 근처에 여진이 살고 있었어요.' },
          { who:'세종', text:'압록강 유역의 여진을 몰아내라!' },
          { who:'안내', text:'여진 기병은 아주 빨라요. 창병을 앞에, 궁수와 신기전을 뒤에 놓아 보세요.' },
        ],
        win:[
          { who:'세종', text:'압록강 유역에 4군을 설치하노라!' },
          { who:'이야기', text:'여진을 몰아내고 압록강 유역에 4군을 설치했어요. 영토가 넓어졌어요!' },
          { who:'안내', text:'승리 보상: 군량 +5, 배치할 수 있는 군사 +1' },
        ],
        reward:{ gold:5, cap:1 },
        quiz:{ q:'4군을 설치한 곳은 어디일까요?', a:['압록강 유역','두만강 유역','한강 유역'], ok:0,
               why:'압록강 유역에 4군, 두만강 유역에 6진을 설치했어요. 「사(4)압, 육(6)두」로 외워 보세요!' },
        map:'4gun',
      },
      {
        id:'1-3', title:'두만강의 여진을 몰아내라', terrain:'land', mult:0.9,
        pool:['spear','archer','cavalry','rocket','kimJS','choiYD'],
        enemies:[['jur',0,1],['jur',1,1],['jur',4,1],['jur',5,1],['jurA',2,0],['jurA',3,0],['jurC',2,1]],
        pre:[
          { who:'이야기', text:'동쪽으로 흐르는 두만강 근처에도 여진이 있었어요.' },
          { who:'세종', text:'두만강 유역의 여진도 몰아내라!' },
          { who:'안내', text:'여진 추장은 체력이 많아요. ★2 군사를 만들어 보세요.' },
        ],
        win:[
          { who:'세종', text:'두만강 유역에 6진을 설치하노라!' },
          { who:'이야기', text:'여진을 몰아내고 두만강 유역에 6진을 설치했어요. 북쪽으로 영토가 넓어졌어요!' },
        ],
        reward:{ gold:0, cap:0 },
        quiz:{ q:'6진을 설치한 곳은 어디일까요?', a:['압록강 유역','두만강 유역','낙동강 유역'], ok:1,
               why:'두만강 유역에 6진을 설치했어요.' },
        map:'6jin',
      },
    ],
    outro: [
      { who:'세종', text:'압록강 유역에 4군을, 두만강 유역에 6진을 설치하노라!' },
      { who:'이야기', text:'세종 때에는 왜구의 소굴인 쓰시마섬을 공격하여 왜구로부터 항복을 받았고, 북쪽으로 여진을 몰아내어 영토를 확장했어요.' },
    ],
    summary: { text:'세종 때에는 왜구의 소굴인 [쓰시마섬]을 공격하여 항복을 받았고, 압록강 유역에 [4군]을, 두만강 유역에 [6진]을 설치했어요.' },
  },
  {
    id: 2, title: '2장. 임진왜란, 위기를 이겨 내다', short: '임진왜란',
    color: '#24507a',
    startGold: 8, startCap: 4,
    intro: [
      { who:'이야기', text:'조선이 건국된 지 약 200년 후의 일이에요.' },
      { who:'이야기', text:'일본은 많은 군사를 이끌고 조선을 침략했어요. 이 전쟁을 「임진왜란」이라고 해요.' },
    ],
    stages: [
      {
        id:'2-1', title:'일본군의 침략', terrain:'land', mult:1.0, scripted:true,
        pool:['spear','archer','cavalry'],
        enemies:[['gun',0,0],['gun',1,0],['gun',2,0],['gun',3,0],['gun',4,0],['gun',5,0],['samurai',1,1],['samurai',2,1],['samurai',3,1],['samurai',4,1],['jpGen',2,2]],
        pre:[
          { who:'이야기', text:'일본군은 「조총」이라는 새로운 무기를 가지고 있었어요.' },
          { who:'안내', text:'조총병(총)은 멀리서 아주 강하게 공격해요. 지금 가진 군사로 막아 보세요!' },
        ],
        win:[
          { who:'이야기', text:'이곳은 잘 막았지만, 다른 곳에서는 조총을 갖춘 일본군에게 잇달아 패배했어요.' },
        ],
        lose:[
          { who:'이야기', text:'조선은 조총이라는 새로운 무기를 갖춘 일본군의 공격에 잇달아 패배하며 큰 위기를 맞았어요.' },
          { who:'이야기', text:'하지만 조선에는 위기를 이겨 낼 세 가지 힘이 있었어요!' },
          { who:'안내', text:'새 군사가 생겼어요: ⚓ 수군(이순신·판옥선·거북선), ✊ 의병, 🤝 명군' },
        ],
        reward:{ gold:6, cap:1 },
        quiz:{ q:'임진왜란 때 일본군이 가지고 온 새로운 무기는 무엇일까요?', a:['조총','신기전','거북선'], ok:0,
               why:'일본군은 조총이라는 새로운 무기를 갖추고 있었어요.' },
      },
      {
        id:'2-2', title:'바다를 지켜라 — 이순신의 수군', terrain:'sea', mult:0.85,
        pool:['panok','turtle','yiSS','archer','spear'],
        enemies:[['jpShip',0,1],['jpShip',2,1],['jpShip',4,1],['gun',1,0],['gun',4,0]],
        pre:[
          { who:'이야기', text:'바다에서는 이순신이 이끄는 수군이 일본군을 막았어요.' },
          { who:'안내', text:'⚓ 수군 2명이 모이면 수군의 공격력이 올라가요. 이순신은 수군이면서 장수예요.' },
        ],
        win:[
          { who:'이야기', text:'이순신이 이끄는 수군이 바다에서 일본군을 물리쳤어요!' },
          { who:'안내', text:'승리 보상: 군량 +6, 배치할 수 있는 군사 +1' },
        ],
        reward:{ gold:6, cap:1 },
        quiz:{ q:'임진왜란 때 바다에서 활약한 수군을 이끈 사람은 누구일까요?', a:['세종','이순신','인조'], ok:1,
               why:'이순신이 이끄는 수군이 바다에서 활약했어요.' },
      },
      {
        id:'2-3', title:'의병이 일어나다', terrain:'land', mult:1.15,
        pool:['militia','milLead','panok','turtle','yiSS','spear','archer'],
        enemies:[['samurai',1,1],['samurai',2,1],['samurai',4,1],['gun',0,0],['gun',3,0],['gun',5,0],['samurai',3,1]],
        pre:[
          { who:'이야기', text:'나라를 지키려고 백성들이 스스로 군대를 만들어 일어났어요. 이들을 「의병」이라고 해요.' },
          { who:'안내', text:'✊ 의병 2명이 모이면 의병이 튼튼해져요.' },
        ],
        win:[
          { who:'이야기', text:'의병들이 곳곳에서 일본군을 무찔렀어요!' },
          { who:'안내', text:'승리 보상: 군량 +6' },
        ],
        reward:{ gold:6, cap:0 },
        quiz:{ q:'나라를 지키려고 백성들이 스스로 일어나 만든 군대를 무엇이라고 할까요?', a:['명군','수군','의병'], ok:2,
               why:'나라를 지키려고 스스로 일어난 백성의 군대를 의병이라고 해요.' },
      },
      {
        id:'2-4', title:'명군과 함께, 위기를 이겨 내라', terrain:'land', mult:1.12,
        pool:['ming','mingGun','militia','milLead','panok','turtle','yiSS'],
        enemies:[['jpGen',2,1],['samurai',0,1],['samurai',1,1],['samurai',4,1],['samurai',5,1],['gun',0,0],['gun',2,0],['gun',3,0],['gun',5,0]],
        pre:[
          { who:'이야기', text:'명나라 군대가 조선을 도우러 왔어요.' },
          { who:'안내', text:'⚓ 수군, ✊ 의병, 🤝 명군 효과를 모두 켜면 「위기 극복」! 모든 군사가 강해져요.' },
        ],
        win:[
          { who:'이야기', text:'조선은 이순신이 이끄는 수군과 의병의 활약, 명군의 도움으로 위기를 극복할 수 있었어요!' },
        ],
        reward:{ gold:0, cap:0 },
        quiz:{ q:'임진왜란의 위기를 이겨 낸 힘이 아닌 것은 무엇일까요?', a:['이순신이 이끄는 수군','의병의 활약','청나라의 도움'], ok:2,
               why:'수군과 의병의 활약, 명군의 도움으로 위기를 극복했어요. 청나라가 아니라 명나라예요!' },
      },
    ],
    outro: [
      { who:'이야기', text:'전쟁은 끝났지만, 피해는 아주 컸어요.' },
    ],
    damage: [
      { icon:'👥', text:'수많은 사람이 죽거나 일본에 포로로 끌려갔어요.' },
      { icon:'🌾', text:'땅이 황폐해졌어요.' },
      { icon:'🏯', text:'궁궐을 비롯한 수많은 국가유산이 불에 타거나 파괴됐어요.' },
    ],
    endQuiz:{ q:'임진왜란의 결과가 아닌 것은 무엇일까요?', a:['많은 사람이 죽거나 포로로 끌려갔다','영토가 북쪽으로 넓어졌다','궁궐 등 국가유산이 불에 탔다'], ok:1,
              why:'영토가 넓어진 것은 세종 때 4군과 6진을 설치한 일이에요.' },
    summary: { text:'임진왜란 때 조선은 [조총]을 갖춘 일본군에게 잇달아 패배했지만, 이순신이 이끄는 [수군]과 [의병]의 활약, [명군]의 도움으로 위기를 극복했어요.' },
  },
  {
    id: 3, title: '3장. 병자호란, 남한산성을 지켜라', short: '병자호란',
    color: '#6b3a3a',
    siege: true, days: 5, startGold: 7, startCap: 4,
    intro: [
      { who:'이야기', text:'조선의 북쪽에서 세력을 키워 나라를 세운 여진은 나라 이름을 「청」으로 바꿨어요.' },
      { who:'이야기', text:'청은 조선에 임금과 신하의 관계를 요구했어요. 조선이 이를 거부하자 청은 조선을 침략했어요. 이 전쟁을 「병자호란」이라고 해요.' },
      { who:'이야기', text:'인조는 남한산성으로 피신했으나 곧 청군에 포위됐어요.' },
      { who:'안내', text:'이번 장은 이기는 싸움이 아니라 「버티는」 싸움이에요. 남한산성(성)을 지키며 하루하루 버텨 보세요.' },
      { who:'안내', text:'날마다 🍚식량과 🔥땔감이 줄어들어요. 배고프면 공격력이, 추우면 체력이 떨어져요.' },
    ],
    waves: [
      [['qing',1,1],['qing',3,1],['qing',4,1],['qingA',2,0]],
      [['qing',0,1],['qing',2,1],['qing',3,1],['qing',5,1],['qingA',1,0],['qingA',4,0]],
      [['qing',0,1],['qing',2,1],['qing',3,1],['qing',5,1],['qingA',2,0],['qingA',3,0]],
      [['qing',0,1],['qing',2,1],['qing',4,1],['qing',5,1],['qingA',1,0],['qingA',4,0],['qingG',2,0]],
      [['qing',0,1],['qing',1,1],['qing',3,1],['qing',4,1],['qing',5,1],['qingA',0,0],['qingA',5,0],['qingG',3,0]],
    ],
    pool:['spear','archer','gunner'],
    income:[0,5,4,4,3],
    surviveTicks: 45,
    meeting: {
      after: 2,
      text:'성안의 신하들은 청과 끝까지 싸우자는 쪽과 청에 항복하고 전쟁을 끝내자는 쪽으로 의견이 나뉘었어요. 여러분이라면 어느 쪽 의견에 손을 들까요?',
      fight:{ who:'싸우자는 신하', text:'임금과 신하의 관계를 받아들일 수 없습니다. 끝까지 싸워야 합니다!', effect:'다음 전투에서 아군 공격력 +20%' },
      peace:{ who:'항복하자는 신하', text:'백성과 군사들이 춥고 배고파 쓰러지고 있습니다. 항복하고 전쟁을 끝내야 합니다!', effect:'청과 이야기하는 동안, 다음 전투의 청군이 줄어요' },
      after_text:'두 쪽 모두 나라와 백성을 걱정하는 마음이었어요. 역사에서도 의견이 팽팽하게 나뉘었답니다.',
    },
    surrender: [
      { who:'이야기', text:'추위와 배고픔 등으로 전쟁 상황이 더욱 어려워지자, 결국 인조는 청에 항복했어요.' },
    ],
    damage: [
      { icon:'👑', text:'청과 조선은 임금과 신하의 관계를 맺었어요.' },
      { icon:'⛓', text:'왕자를 비롯한 많은 백성이 청에 인질과 포로로 끌려갔어요.' },
      { icon:'🧭', text:'이후 조선은 명 대신 청의 영향을 받게 됐어요.' },
    ],
    endQuiz:{ q:'병자호란 때 인조가 피신한 곳은 어디일까요?', a:['남한산성','쓰시마섬','두만강'], ok:0,
              why:'인조는 남한산성으로 피신했으나 곧 청군에 포위됐어요.' },
    summary: { text:'청이 [임금과 신하]의 관계를 요구하며 침략하자(병자호란), 인조는 [남한산성]으로 피신했어요. [추위와 배고픔] 등으로 어려워지자 결국 청에 항복했어요.' },
  },
];
