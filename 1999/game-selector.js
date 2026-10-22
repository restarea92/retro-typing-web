/** Original 10-row stage selector, measured from native 640x480 capture. */
export const GAME_LEVEL_LABELS=Object.freeze(Array.from({length:10},(_,i)=>i<9?`${i+1}  놀이마당`:'...놀이마당'));
export function renderGameSelector(container,kind,onSelect=()=>{},onCancel=()=>{},initialStage=1){
  let selected=Math.max(0,Math.min(9,(Math.trunc(Number(initialStage))||1)-1)),closed=false;
  container.innerHTML=`<section class="original-game-select" role="dialog" aria-modal="true" aria-labelledby="game-selector-title"><h1 id="game-selector-title">놀이마당<button type="button" class="dialog-close" aria-label="놀이마당 닫기">×</button></h1><fieldset><legend>마 당</legend><div class="original-game-levels" role="listbox" aria-label="놀이마당" tabindex="0">${GAME_LEVEL_LABELS.map((label,i)=>`<div role="option" data-stage="${i+1}" aria-selected="${i===selected}" class="${i===selected?'selected':''}">${label}</div>`).join('')}</div></fieldset><div class="original-game-select-message">놀이마당을 선택하세요</div></section>`;
  const root=container.querySelector('.original-game-select'),list=root.querySelector('[role=listbox]');
  const status=document.querySelector('#status');if(status)status.textContent='상하 화살표로 항목을 선택한 후 Enter를 누르세요';
  function paint(){[...list.children].forEach((node,i)=>{node.classList.toggle('selected',i===selected);node.setAttribute('aria-selected',String(i===selected))})}
  function choose(){if(closed)return;closed=true;onSelect(selected+1)}
  function cancel(){if(closed)return;closed=true;onCancel()}
  root.querySelector('.dialog-close').onclick=cancel;
  list.onclick=e=>{const row=e.target.closest('[data-stage]');if(row){const next=Number(row.dataset.stage)-1;if(next===selected)return choose();selected=next;paint();list.focus({preventScroll:true})}};
  root.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End','PageUp','PageDown','Enter',' ','Escape'].includes(e.key)){e.preventDefault();e.stopPropagation()}if(e.key==='ArrowDown')selected=(selected+1)%10;else if(e.key==='ArrowUp')selected=(selected+9)%10;else if(e.key==='Home'||e.key==='PageUp')selected=0;else if(e.key==='End'||e.key==='PageDown')selected=9;else if(e.key==='Enter'||e.key===' ')return choose();else if(e.key==='Escape')return cancel();paint()};
  list.focus({preventScroll:true});return {kind,get selectedStage(){return selected+1},destroy(){closed=true;root.remove()}};
}
