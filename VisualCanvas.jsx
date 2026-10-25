// Palco da ficha: 900px lógicos, reduzido proporcionalmente em telas menores (mín. 0,6; abaixo disso rola na horizontal).
// Arrastar/redimensionar usam um RASCUNHO local (state); só ao soltar chama onCommit (uma gravação por operação).
import {useState,useRef,useEffect,useLayoutEffect} from 'react';
import {moveGroup,resizeBox,TYPES} from './layoutLogic.js';
import {ElementView} from './ElementView.jsx';
const HANDLES={nw:[0,0,'nwse'],n:[.5,0,'ns'],ne:[1,0,'nesw'],e:[1,.5,'ew'],se:[1,1,'nwse'],s:[.5,1,'ns'],sw:[0,1,'nesw'],w:[0,.5,'ew']};
const MINSCALE=.6;

export default function VisualCanvas({layout,ctx,edit=false,selId=null,onSelect=()=>{},onCommit=()=>{},grid=10,showGrid=false,snapOn=false}){
  const wrap=useRef(),drag=useRef(null),stop=useRef(null);
  const [cw,setCw]=useState(900),[draft,setDraft]=useState(null);
  useLayoutEffect(()=>{
    const el=wrap.current;if(!el)return;const f=()=>setCw(el.clientWidth||900);f();
    const ro=new ResizeObserver(f);ro.observe(el);return()=>ro.disconnect();
  },[]);
  useEffect(()=>()=>stop.current&&stop.current(),[]);
  const L=draft||layout,raw=cw/L.w,scale=Math.min(1,Math.max(MINSCALE,raw)),small=raw<MINSCALE;

  const start=(e,id,mode,handle)=>{
    if(!edit||e.button>0)return;
    e.stopPropagation();e.preventDefault();onSelect(id);
    drag.current={mode,id,handle,sx:e.clientX,sy:e.clientY,start:layout,moved:false,last:null};
    const mv=ev=>{
      const d=drag.current;if(!d)return;
      const dx=(ev.clientX-d.sx)/scale,dy=(ev.clientY-d.sy)/scale;
      if(!d.moved&&Math.hypot(dx,dy)*scale<3)return;     // clique simples não é arrasto
      d.moved=true;const g=snapOn?grid:0;
      d.last=d.mode==='move'?moveGroup(d.start,d.id,dx,dy,g):resizeBox(d.start,d.id,d.handle,dx,dy,g);
      setDraft(d.last);
    };
    const up=()=>{
      window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);stop.current=null;
      const d=drag.current;drag.current=null;setDraft(null);
      if(d?.moved&&d.last)onCommit(d.last);               // única gravação, ao terminar
    };
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
    stop.current=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up)};
  };

  const sel=edit&&L.els.find(e=>e.id===selId),b=L.border||{},bg=L.bg||{};
  const hs=10/scale;
  return <div className="vc-wrap" ref={wrap}>
    {small&&<div className="vc-warn">⚠️ A ficha visual ficou pequena demais para esta tela. Role para o lado ou use o <b>📋 Formulário clássico</b>.</div>}
    <div className={'vc-size'+(edit?' editing':'')} style={{width:L.w*scale,height:L.h*scale}}>
      <div className="vc-stage" style={{width:L.w,height:L.h,transform:`scale(${scale})`,backgroundColor:bg.color||undefined,borderRadius:b.radius||0}}
        onPointerDown={edit?e=>{if(e.target===e.currentTarget)onSelect(null)}:undefined}>
        {bg.img&&<div className="vc-bgimg" style={{backgroundImage:`url(${bg.img})`,opacity:bg.opacity??1,backgroundPosition:bg.pos||'center',
          backgroundSize:bg.size==='tile'?'auto':(bg.size||'cover'),backgroundRepeat:bg.size==='tile'?'repeat':'no-repeat'}}/>}
        {L.els.map(e=><div key={e.id} className={'vc-el'+(edit?' ed':'')} style={{left:e.x,top:e.y,width:e.w,height:e.h}}
          onPointerDown={edit?ev=>start(ev,e.id,'move'):undefined}><ElementView el={e} ctx={ctx}/></div>)}
        {edit&&showGrid&&<div className="vc-grid" style={{backgroundSize:`${grid}px ${grid}px,${grid}px ${grid}px,${grid*5}px ${grid*5}px,${grid*5}px ${grid*5}px`}}/>}
        {b.style&&b.style!=='none'&&b.width>0&&<div className="vc-border" style={{border:`${b.width}px ${b.style} ${b.color||'var(--bo,#6b5320)'}`,borderRadius:b.radius||0}}/>}
        {sel&&<div className="vc-sel" style={{left:sel.x,top:sel.y,width:sel.w,height:sel.h,outlineWidth:2/scale}}>
          <span className="vc-tag" style={{transform:`scale(${1/scale})`}}>{sel.name||TYPES[sel.type]||sel.type} · {sel.w}×{sel.h}</span>
          {Object.entries(HANDLES).map(([h,[px,py,cur]])=><i key={h} className="vc-h" style={{left:px*100+'%',top:py*100+'%',width:hs,height:hs,cursor:cur+'-resize'}}
            onPointerDown={ev=>start(ev,sel.id,'resize',h)}/>)}</div>}
      </div>
    </div>
  </div>;
}
