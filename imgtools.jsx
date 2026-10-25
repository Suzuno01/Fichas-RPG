// Ferramentas de imagem: ícones (emoji OU PNG) e editor de enquadramento (mover, ampliar, escolher como a imagem fica no quadro).
import {useState,useRef,useEffect} from 'react';

export const isImg=v=>typeof v==='string'&&v.startsWith('data:image');
// Mostra um ícone: texto/emoji ou imagem.
export const Ico=({v})=>isImg(v)?<img className="ico" src={v} alt=""/>:<>{v}</>;
// Versão só texto (para <option>, que não aceita imagem).
export const icoText=v=>isImg(v)?'🖼️':v;

const loadImg=(file,cb)=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>cb(i);i.src=r.result};r.readAsDataURL(file)};
const hasAlpha=c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i]<250)return true;return false};

// Ícone em PNG (mantém a transparência), reduzido para caber em ~96px.
export function readIcon(file,cb,max=96){
  loadImg(file,i=>{const k=Math.min(1,max/Math.max(i.width,i.height));const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(i.width*k));c.height=Math.max(1,Math.round(i.height*k));c.getContext('2d').drawImage(i,0,0,c.width,c.height);
    cb(c.toDataURL('image/png'))});
}
// Imagem "original" guardada para poder reajustar depois (máx. 1000px). Mantém PNG só se tiver transparência.
function readOriginal(file,cb,max=1000){
  loadImg(file,i=>{const k=Math.min(1,max/Math.max(i.width,i.height));const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(i.width*k));c.height=Math.max(1,Math.round(i.height*k));c.getContext('2d').drawImage(i,0,0,c.width,c.height);
    cb(file.type!=='image/jpeg'&&hasAlpha(c)?c.toDataURL('image/png'):c.toDataURL('image/jpeg',.88))});
}
// Grava o resultado do editor no objeto: campo final + original + ajustes.
export const setImg=(o,f,r)=>{o[f]=r.img;o[f+'O']=r.orig;o[f+'C']=r.crop};
export const clearImg=(o,f)=>{o[f]='';delete o[f+'O'];delete o[f+'C']};

// Campo de ícone: emoji (texto) ou imagem PNG.
export function IconEdit({value,on,en=true}){
  if(!en)return <span className="ic txt"><Ico v={value}/></span>;
  return <span className="icedit">
    {isImg(value)?<img className="ico big" src={value} alt=""/>:<input className="ic" value={value||''} onChange={e=>on(e.target.value)}/>}
    <label className="btn sm" title="Usar uma imagem PNG como ícone">🖼️ PNG<input hidden type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];e.target.value='';f&&readIcon(f,on)}}/></label>
    {isImg(value)&&<button type="button" className="btn sm" title="Voltar para emoji" onClick={()=>on('✨')}>↺ Emoji</button>}</span>;
}

const RATIOS=[['Quadrado',1],['Retrato 3:4',3/4],['Paisagem 4:3',4/3],['Largo 16:9',16/9],['Alto 9:16',9/16]];

// Botão de enviar imagem + botão ✂️ Ajustar. O quadro respeita o formato (ratio) e a forma (shape) do lugar onde a imagem aparece.
export function ImgUp({label='🖼️ Imagem',obj,field,ratio=1,shape='rect',out=640,free=false,on,adjustOnly=false}){
  const [dlg,setDlg]=useState(null);
  const cur=obj?.[field],orig=obj?.[field+'O'],crop=obj?.[field+'C'];
  const pick=e=>{const f=e.target.files[0];e.target.value='';f&&readOriginal(f,src=>setDlg({src,crop:null}))};
  return <>
    {!adjustOnly&&<label className="btn sm">{label}<input hidden type="file" accept="image/*" onChange={pick}/></label>}
    {cur&&<button type="button" className="btn sm" onClick={()=>setDlg({src:orig||cur,crop})}>✂️ Ajustar</button>}
    {dlg&&<CropModal src={dlg.src} crop={dlg.crop} ratio={ratio} shape={shape} out={out} free={free} onCancel={()=>setDlg(null)} onOk={r=>{setDlg(null);on(r)}}/>}
  </>;
}

function CropModal({src,crop,ratio,shape,out,free,onOk,onCancel}){
  const [img,setImg0]=useState(null);
  const [rt,setRt]=useState(crop?.ratio||ratio);
  const [fit,setFit]=useState(crop?.fit||'cover');
  const [z,setZ]=useState(crop?.z||1);
  const [ox,setOx]=useState(crop?.ox||0);
  const [oy,setOy]=useState(crop?.oy||0);
  const [tr,setTr]=useState(crop?.tr??true);
  const [bg,setBg]=useState(crop?.bg||'#000000');
  const cv=useRef(),drag=useRef(null);
  useEffect(()=>{const i=new Image();i.onload=()=>{setImg0(i);if(free&&!crop?.ratio)setRt(i.width/i.height)};i.src=src},[src]);
  // Tamanho de saída (lado maior = out) e de tela (lado maior = 300px)
  const dim=m=>rt>=1?[m,Math.round(m/rt)]:[Math.round(m*rt),m];
  const [W,H]=dim(out),[DW,DH]=dim(300);
  const clamp=(x,y,zz,f)=>{
    if(!img)return [x,y];
    const base=f==='cover'?Math.max(W/img.width,H/img.height):Math.min(W/img.width,H/img.height),s=base*zz;
    const mx=f==='cover'?Math.max(0,(img.width*s-W)/(2*W)):.5,my=f==='cover'?Math.max(0,(img.height*s-H)/(2*H)):.5;
    return [Math.max(-mx,Math.min(mx,x)),Math.max(-my,Math.min(my,y))];
  };
  const paint=(c,w,h,transparent)=>{
    const g=c.getContext('2d');g.clearRect(0,0,w,h);
    if(!transparent){g.fillStyle=bg;g.fillRect(0,0,w,h)}
    const base=fit==='cover'?Math.max(w/img.width,h/img.height):Math.min(w/img.width,h/img.height),s=base*z;
    const iw=img.width*s,ih=img.height*s;
    g.drawImage(img,w/2+ox*w-iw/2,h/2+oy*h-ih/2,iw,ih);
  };
  const transparentBg=fit==='contain'&&tr;
  useEffect(()=>{if(!img||!cv.current)return;cv.current.width=DW;cv.current.height=DH;paint(cv.current,DW,DH,transparentBg)});
  const move=ev=>{if(!drag.current)return;const d=drag.current;const [x,y]=clamp(d.ox+(ev.clientX-d.x)/DW,d.oy+(ev.clientY-d.y)/DH,z,fit);setOx(x);setOy(y)};
  const setZoom=v=>{const [x,y]=clamp(ox,oy,v,fit);setZ(v);setOx(x);setOy(y)};
  const setMode=f=>{setFit(f);setZ(1);setOx(0);setOy(0)};
  const done=()=>{
    const c=document.createElement('canvas');c.width=W;c.height=H;paint(c,W,H,transparentBg);
    const png=transparentBg||(src.startsWith('data:image/png')&&hasAlpha(c));
    onOk({img:c.toDataURL(png?'image/png':'image/jpeg',.88),orig:src,crop:{ratio:rt,fit,z,ox,oy,tr,bg}});
  };
  return <div className="modal" onClick={onCancel}><div className="panel nmod" onClick={e=>e.stopPropagation()}>
    <h3>✂️ Ajustar imagem</h3>
    <small>Arraste a imagem para mover. Use o zoom para aproximar. O quadro abaixo tem o formato real do lugar onde ela vai aparecer.</small>
    {free&&<div className="row">{RATIOS.map(([n,v])=><button type="button" key={n} className={'btn sm'+(Math.abs(rt-v)<.001?' on':'')} onClick={()=>{setRt(v);setOx(0);setOy(0)}}>{n}</button>)}
      {img&&<button type="button" className={'btn sm'+(Math.abs(rt-img.width/img.height)<.001?' on':'')} onClick={()=>{setRt(img.width/img.height);setMode('cover')}}>Original</button>}</div>}
    <div className="cropbox">
      {img?<canvas ref={cv} style={{width:DW,height:DH,borderRadius:shape==='round'?'50%':shape==='soft'?'24px':'6px',touchAction:'none',cursor:'grab'}}
        onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,ox,oy}}}
        onPointerMove={move} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}
        onWheel={e=>setZoom(Math.max(fit==='cover'?1:.2,Math.min(4,z*(e.deltaY<0?1.08:.93))))}/>:<p>Carregando…</p>}
    </div>
    <div className="row"><button type="button" className={'btn sm'+(fit==='cover'?' on':'')} onClick={()=>setMode('cover')}>Preencher o quadro</button>
      <button type="button" className={'btn sm'+(fit==='contain'?' on':'')} onClick={()=>setMode('contain')}>Mostrar inteira</button></div>
    <label className="lab">Zoom: {Math.round(z*100)}%<input type="range" min={fit==='cover'?100:20} max="400" value={Math.round(z*100)} onChange={e=>setZoom(+e.target.value/100)}/></label>
    {fit==='contain'&&<div className="row"><label className="sw"><input type="checkbox" checked={tr} onChange={e=>setTr(e.target.checked)}/> Fundo transparente</label>
      {!tr&&<label className="pick">Cor do fundo<input type="color" value={bg} onChange={e=>setBg(e.target.value)}/></label>}</div>}
    <div className="row"><button type="button" className="btn sm" onClick={()=>{setZ(1);setOx(0);setOy(0)}}>↺ Centralizar</button>
      <button type="button" className="btn" onClick={done} disabled={!img}>✔ USAR ESTA IMAGEM</button>
      <button type="button" className="btn sm danger" onClick={onCancel}>Cancelar</button></div>
  </div></div>;
}
