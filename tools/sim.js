// 난이도 확인용 전투 시뮬레이터 (게임에는 쓰지 않음)
// 우리 군사도 「자동」 버튼과 같은 생각으로 움직임. 사람이 직접 하면 보통 이보다 조금 더 잘해요.
// 추가옵션 예: {"pass":"hill"} (2-1에서 고개를 고른 경우), {"startMana":20}
// 사용법: node tools/sim.js '[["이름", 장번호(0~2), 단계(또는 3장은 날-1), "유닛,열,행,별,아이템+아이템 ...", 추가옵션]]'
//   예) node tools/sim.js '[["1-1 기본",0,0,"leeJM,3,4 spear,2,3 archer,3,5"]]'
const fs=require('fs'),vm=require('vm'),path=require('path');
const ctx={console,Math,module:undefined};vm.createContext(ctx);
for(const f of ['data.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^const (\w+)/gm,'var $1'),ctx);
const {CHAPTERS,createBattle,autoTurn,stageCells,stageEnemies}=ctx;
function run(players,enemies,opts,n=300,amb){let w=0,t=0;for(let i=0;i<n;i++){const b=createBattle(players,enemies,opts);while(!b.over){autoTurn(b,'p');if(b.over)break;if(amb&&b.round===amb.round)amb.units.forEach(([ty,x,y])=>b.spawn(ty,x,y));autoTurn(b,'e');}if(b.result==='win')w++;t+=b.round;}return [(w/n*100).toFixed(0)+'%','평균차례',(t/n).toFixed(1)];}
const P=(s)=>s.split(' ').map(x=>{const [t,c,r,st,it]=x.split(',');return {type:t,x:+c,y:+r,star:+(st||1),items:it?it.split('+'):[]}});
const st=(ch,i)=>CHAPTERS[ch].stages[i];
const tests=JSON.parse(process.argv[2]);
for(const [label,ch,i,army,extra] of tests){
  let enemies, opts={}, players=P(army);
  const C=CHAPTERS[ch];
  if(C.siege){enemies=C.waves[i];opts={surviveRounds:C.surviveRounds,castleHpMul:C.cannonDay&&i+1>=C.cannonDay?C.cannonHp:0,...(extra||{})};players.push({type:'castle',x:3,y:5,star:1,items:[]});}
  else {const S_=st(ch,i);enemies=stageEnemies(S_);opts={mult:S_.mult,cells:stageCells(S_,(extra&&extra.pass)||'field'),leader:S_.leader,weak:S_.weak,...(extra||{})};}
  console.log(label.padEnd(28),run(players,enemies,opts,300,!C.siege&&st(ch,i).ambush).join(' '));
}
