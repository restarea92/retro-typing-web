/** Display-only simulation. Game/layout coordinates always remain 640 x 480. */
export const DISPLAY_WIDTH=640, DISPLAY_HEIGHT=480;
export const CRT_STORAGE_KEY='retro-typing-crt-v1';
export function displayGeometry(width,height,fullscreen=false,dpr=1){
  const scale=fullscreen?Math.max(1,height)/480:Math.min(1,Math.max(1,width)/640);
  return {scale,width:640*scale,height:480*scale,left:fullscreen?(width-640*scale)/2:0,
    maskPixel:1/Math.max(1,dpr),scanlineOpacity:Math.min(.18,Math.max(0,(scale*Math.max(1,dpr)-1)*.14))};
}
export function readCrtPreference(storage){try{return storage.getItem(CRT_STORAGE_KEY)!=='off';}catch{return true;}}
export function installDisplay(doc=document,win=window){
  const viewport=doc.querySelector('#display-viewport'),frame=doc.querySelector('#frame-box');
  if(!viewport||!frame)return null;
  const overlay=doc.createElement('div');overlay.className='crt-overlay';overlay.setAttribute('aria-hidden','true');viewport.append(overlay);
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','crt-filter-definitions');svg.setAttribute('aria-hidden','true');
  svg.innerHTML='<defs><filter id="crt-phosphor-bloom" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB"><feComponentTransfer in="SourceGraphic" result="highlights"><feFuncR type="linear" slope="2" intercept="-1"/><feFuncG type="linear" slope="2" intercept="-1"/><feFuncB type="linear" slope="2" intercept="-1"/></feComponentTransfer><feGaussianBlur in="highlights" stdDeviation="0.6" result="glow"/><feComposite in="SourceGraphic" in2="glow" operator="arithmetic" k1="0" k2="1" k3="0.12" k4="0"/></filter></defs>';
  doc.body.append(svg);
  let storage;try{storage=win.localStorage;}catch{}
  let enabled=readCrtPreference(storage);
  const crtButtons=[...doc.querySelectorAll('[data-crt-toggle]')];
  function apply(){viewport.classList.toggle('crt-enabled',enabled);for(const button of crtButtons){button.setAttribute('aria-pressed',String(enabled));button.textContent=`CRT ${enabled?'켜짐':'꺼짐'}`;}}
  function resize(){const fullscreen=doc.fullscreenElement===viewport;
    const g=displayGeometry(fullscreen?win.innerWidth:viewport.clientWidth,win.innerHeight,fullscreen,win.devicePixelRatio||1);
    viewport.classList.toggle('is-fullscreen',fullscreen);viewport.style.height=fullscreen?'100%':`${g.height}px`;
    frame.style.transform=`scale(${g.scale})`;frame.style.left=`${g.left}px`;frame.style.marginBottom='0px';
    overlay.style.cssText=`left:${g.left}px;width:${g.width}px;height:${g.height}px;--scanline-period:${g.scale}px;--mask-pixel:${g.maskPixel}px;--scanline-opacity:${g.scanlineOpacity};--mask-opacity:${g.scanlineOpacity?'.055':'0'}`;
    const button=doc.querySelector('#fullscreen');if(button){button.textContent=fullscreen?'전체 화면 나가기':'전체 화면';button.setAttribute('aria-pressed',String(fullscreen));}
  }
  async function toggleFullscreen(){try{if(doc.fullscreenElement)await doc.exitFullscreen();else await viewport.requestFullscreen();}catch{const help=doc.querySelector('#outside-help');if(help){help.hidden=false;help.textContent='이 브라우저에서는 전체 화면을 지원하지 않습니다. 일반 화면에서 이용해 주세요.';}}resize();}
  for(const button of crtButtons)button.addEventListener('click',()=>{enabled=!enabled;apply();try{storage?.setItem(CRT_STORAGE_KEY,enabled?'on':'off');}catch{}});
  for(const controls of doc.querySelectorAll('.fullscreen-display-controls'))for(const type of ['keydown','keyup'])controls.addEventListener(type,event=>event.stopPropagation());
  doc.querySelector('#fullscreen')?.addEventListener('click',toggleFullscreen);
  doc.querySelector('[data-fullscreen-exit]')?.addEventListener('click',toggleFullscreen);
  doc.addEventListener('fullscreenchange',resize);win.addEventListener('resize',resize);
  apply();resize();return {resize,get enabled(){return enabled;}};
}
