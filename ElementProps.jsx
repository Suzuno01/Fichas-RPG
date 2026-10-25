// Painéis laterais do editor: propriedades do elemento selecionado e propriedades da ficha (fundo, borda, altura, cópia de layout).
import {useState,useEffect,useRef} from 'react';
import {TYPES,FONTS,COLL,GROUP,CORE,setElement,setBg,setBorder,setCanvasHeight,layerOp,duplicateElement,removeElement,defaultLayout,copyLayout} from './layoutLogic.js';
import {Up} from './sheetParts.jsx';

import {Ico,IconEdit,ImgUp,setImg,clearImg,icoText} from './imgtools.jsx';
// Número: edita localmente e confirma ao sair do campo / Enter (evita uma gravação por tecla).
function Num({label,value,on,min,max,ph}){
  const [v,setV]=useState(String(value));useEffect(()=>setV(String(value)),[value]);
  const done=()=>{const n=Math.round(+v);if(v!==''&&Number.isFinite(n)&&n!==value)on(n);else setV(String(value))};
  return <label className="lab">{label}<input type="number" value={v} min={min} max={max} placeholder={ph} onChange={e=>setV(e.target.value)} onBlur={done} onKeyDown={e=>e.key==='Enter'&&e.target.blur()}/></label>;
}
// Cor: debounce de 150 ms (o seletor dispara continuamente enquanto arrasta). "↺" volta ao padrão do tema.
function Col({label,value,on,fallback='#888888'}){
  const [v,setV]=useState(value||fallback),t=useRef();useEffect(()=>setV(value||fallback),[value,fallback]);
  const ch=x=>{setV(x);clearTimeout(t.current);t.current=setTimeout(()=>on(x),150)};
  return <label className="pick">{label}<input type="color" value={v} onChange={e=>ch(e.target.value)}/>{value?<button type="button" className="x" title="Usar a cor padrão" onClick={()=>on('')}>↺</button>:<small className="empty">padrão</small>}</label>;
}

const bindValue=b=>!b?'':b.kind==='core'?'c:'+b.key:b.kind==='tab'?'t:'+b.id:b.id?'i:'+b.id:'g';
function bindFrom(type,v){
  if(v==='')return null;if(v==='g')return {kind:GROUP[type]};
  const [k,id]=[v.slice(0,1),v.slice(2)];
  return k==='c'?{kind:'core',key:id}:k==='t'?{kind:'tab',id}:{kind:type,id};
}

export function ElementProps({el,s,layout,commit,onSel}){
  const set=p=>commit(setElement(layout,el.id,p)),st=p=>set({st:p}),t=el.type,S=el.st||{};
  const opts=[];
  if(t==='text'){opts.push(['','Texto livre']);(s.tabs||[]).forEach(x=>opts.push(['t:'+x.id,'Aba: '+x.title]))}
  else if(COLL[t]){
    opts.push(['g','Todos (grupo — acompanha dados novos)']);
    if(t==='field')Object.entries(CORE).forEach(([k,l])=>opts.push(['c:'+k,l]));
    (s[COLL[t]]||[]).forEach(o=>opts.push(['i:'+o.id,t==='field'?'Campo: '+(o.k||'(sem nome)'):(o.name||'(sem nome)')]));
  }
  const cur=bindValue(el.bind);
  if(cur&&!opts.some(o=>o[0]===cur))opts.push([cur,'⚠️ dado removido']);
  if(!cur&&COLL[t])opts.unshift(['','— escolha —']);
  const del=()=>{if(confirm('Remover este elemento da ficha? Os dados da ficha NÃO serão apagados.')){commit(removeElement(layout,el.id));onSel(null)}};
  const dup=()=>{const r=duplicateElement(layout,el.id);commit(r.layout);onSel(r.id)};
  const lay=op=>commit(layerOp(layout,el.id,op));
  return <div className="ep">
    <h4>{TYPES[t]||t}</h4>
    <div className="row"><button className="btn sm" title="Duplicar" onClick={dup}>⧉ Duplicar</button><button className="btn sm danger" onClick={del}>🗑️ Remover</button></div>
    <div className="row"><small>Camada:</small><button className="btn sm" title="Trazer para frente" onClick={()=>lay('front')}>⏫</button><button className="btn sm" title="Subir" onClick={()=>lay('up')}>🔼</button>
      <button className="btn sm" title="Descer" onClick={()=>lay('down')}>🔽</button><button className="btn sm" title="Enviar para trás" onClick={()=>lay('back')}>⏬</button></div>
    <label className="lab">Nome (só no editor)<input value={el.name||''} onChange={e=>set({name:e.target.value})}/></label>
    {opts.length>0&&<label className="lab">{t==='text'?'Conteúdo':'Dado mostrado'}<select value={cur} onChange={e=>set({bind:bindFrom(t,e.target.value)})}>{opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}
    {t==='text'&&!el.bind&&<label className="lab">Texto<textarea rows={3} value={el.text||''} onChange={e=>set({text:e.target.value})}/></label>}
    {t!=='image'&&<label className="lab">Título<input value={el.title||''} onChange={e=>set({title:e.target.value})}/></label>}
    {t==='image'&&<><div className="row"><ImgUp label="🖼️ Enviar imagem" obj={el} field="src" ratio={Math.max(.2,Math.min(5,el.w/el.h))} out={900} on={r=>set({src:r.img,srcO:r.orig,srcC:r.crop,useCover:false})}/>{el.src&&<button className="btn sm" onClick={()=>set({src:'',srcO:'',srcC:null})}>Remover</button>}</div>
      <label className="sw"><input type="checkbox" checked={!!el.useCover} onChange={e=>set({useCover:e.target.checked})}/> Usar o retrato do personagem</label>
      <label className="lab">Ajuste<select value={el.imgFit||'cover'} onChange={e=>set({imgFit:e.target.value})}><option value="cover">Preencher (corta o excesso)</option><option value="contain">Conter (mostra inteira)</option><option value="center">Centralizar (tamanho original)</option></select></label></>}
    {t==='field'&&<><label className="sw"><input type="checkbox" checked={el.showLabel!==false} onChange={e=>set({showLabel:e.target.checked})}/> Mostrar rótulo</label>
      <label className="sw"><input type="checkbox" checked={!!el.stack} onChange={e=>set({stack:e.target.checked})}/> Rótulo acima do valor</label></>}
    <h5>Posição e tamanho</h5>
    <div className="g2"><Num label="X" value={el.x} on={v=>set({x:v})}/><Num label="Y" value={el.y} on={v=>set({y:v})}/><Num label="Largura" value={el.w} on={v=>set({w:v})}/><Num label="Altura" value={el.h} on={v=>set({h:v})}/></div>
    <h5>Texto</h5>
    <label className="lab">Fonte<select value={S.font||''} onChange={e=>st({font:e.target.value})}>{FONTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <div className="g2"><Num label="Tamanho (0 = padrão)" value={S.size||0} min={0} max={120} on={v=>st({size:Math.max(0,v)})}/>
      <label className="lab">Alinhamento<select value={S.al||'left'} onChange={e=>st({al:e.target.value})}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></div>
    <label className="sw"><input type="checkbox" checked={!!S.bold} onChange={e=>st({bold:e.target.checked})}/> Negrito</label>
    {(t==='text'||t==='field')&&<label className="sw"><input type="checkbox" checked={!!S.fit} onChange={e=>st({fit:e.target.checked})}/> Ajustar o texto ao espaço</label>}
    <h5>Cores e borda</h5>
    <div className="row"><Col label="Texto" value={S.color} on={v=>st({color:v})}/><Col label="Destaque" value={S.acc} on={v=>st({acc:v})}/></div>
    <div className="row"><Col label="Fundo" value={S.bg} on={v=>st({bg:v})}/><Col label="Borda" value={S.bd} on={v=>st({bd:v})}/></div>
    <label className="lab">Transparência do fundo: {Math.round((1-(S.bga??1))*100)}%<input type="range" min="0" max="100" value={Math.round((1-(S.bga??1))*100)} onChange={e=>st({bga:1-e.target.value/100})}/></label>
    <label className="lab">Opacidade do elemento: {Math.round((S.op??1)*100)}%<input type="range" min="10" max="100" value={Math.round((S.op??1)*100)} onChange={e=>st({op:e.target.value/100})}/></label>
    <div className="g2"><Num label="Espessura da borda" value={S.bw||0} min={0} max={20} on={v=>st({bw:Math.max(0,v)})}/><Num label="Arredondamento" value={S.rad||0} min={0} max={200} on={v=>st({rad:Math.max(0,v)})}/></div>
    <label className="sw"><input type="checkbox" checked={!!S.panel} onChange={e=>st({panel:e.target.checked})}/> Aparência de painel (fundo e borda do tema)</label>
  </div>;
}

export function SheetProps({s,layout,commit,others}){
  const [from,setFrom]=useState('');
  const bg=layout.bg,bd=layout.border;
  const copy=()=>{const o=others.find(x=>x.id===from);if(!o)return;
    if(confirm(`Substituir o layout desta ficha por uma CÓPIA do layout de "${o.name}"? A origem não será alterada.`))commit(copyLayout(o,s))};
  const reset=()=>{if(confirm('Restaurar o layout padrão? O layout atual será substituído (os dados da ficha não mudam).'))commit(defaultLayout(s))};
  return <div className="ep">
    <h4>Ficha</h4><p className="sub">Clique num elemento para editá-lo. Largura fixa: {layout.w}px.</p>
    <Num label="Altura da ficha (px)" value={layout.h} min={200} on={v=>commit(setCanvasHeight(layout,v))}/>
    <h5>Fundo</h5>
    <div className="row"><Col label="Cor" value={bg.color} on={v=>commit(setBg(layout,{color:v}))}/></div>
    <div className="row"><Up label="🖼️ Imagem de fundo" max={1400} on={u=>commit(setBg(layout,{img:u}))}/>{bg.img&&<button className="btn sm" onClick={()=>commit(setBg(layout,{img:''}))}>Remover</button>}</div>
    {bg.img&&<><label className="lab">Opacidade da imagem: {Math.round((bg.opacity??1)*100)}%<input type="range" min="0" max="100" value={Math.round((bg.opacity??1)*100)} onChange={e=>commit(setBg(layout,{opacity:e.target.value/100}))}/></label>
      <div className="g2"><label className="lab">Posição<select value={bg.pos} onChange={e=>commit(setBg(layout,{pos:e.target.value}))}>{[['center','Centro'],['top','Topo'],['bottom','Base'],['left','Esquerda'],['right','Direita']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="lab">Tamanho<select value={bg.size} onChange={e=>commit(setBg(layout,{size:e.target.value}))}><option value="cover">Cobrir</option><option value="contain">Conter</option><option value="tile">Repetir (textura)</option></select></label></div></>}
    <h5>Borda da ficha</h5>
    <label className="lab">Estilo<select value={bd.style} onChange={e=>commit(setBorder(layout,{style:e.target.value,width:e.target.value!=='none'&&!bd.width?(e.target.value==='double'?6:3):bd.width}))}><option value="none">Sem borda</option><option value="solid">Simples</option><option value="double">Dupla</option><option value="dashed">Tracejada</option><option value="dotted">Pontilhada</option></select></label>
    <div className="g2"><Num label="Espessura" value={bd.width||0} min={0} max={30} on={v=>commit(setBorder(layout,{width:Math.max(0,v)}))}/><Num label="Arredondamento" value={bd.radius||0} min={0} max={80} on={v=>commit(setBorder(layout,{radius:Math.max(0,v)}))}/></div>
    <div className="row"><Col label="Cor da borda" value={bd.color} on={v=>commit(setBorder(layout,{color:v}))}/></div>
    <h5>Layout</h5>
    <label className="lab">Copiar layout de…<select value={from} onChange={e=>setFrom(e.target.value)}><option value="">— escolha uma ficha ou modelo —</option>{others.map(o=><option key={o.id} value={o.id}>{o.isTemplate?'🧩':'📜'} {o.name}</option>)}</select></label>
    <div className="row"><button className="btn sm" disabled={!from} onClick={copy}>📥 Copiar</button><button className="btn sm danger" onClick={reset}>↺ Layout padrão</button></div>
  </div>;
}
