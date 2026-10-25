// Editor visual (somente Mestre): barra de ferramentas + palco editável + painel lateral.
import {useState} from 'react';
import VisualCanvas from './VisualCanvas.jsx';
import {ElementProps,SheetProps} from './ElementProps.jsx';
import {TYPES,TYPE_ICON,addElement,defaultBind,duplicateElement,removeElement,layerOp} from './layoutLogic.js';

export default function VisualEditor({s,layout,commit,ctx,others}){
  const [sel,setSel]=useState(null),[showGrid,setShowGrid]=useState(true),[snapOn,setSnap]=useState(true),[gs,setGs]=useState(10),[menu,setMenu]=useState(false);
  const el=layout.els.find(e=>e.id===sel);
  const add=type=>{const r=addElement(layout,type,{bind:defaultBind(s,type,layout)});commit(r.layout);setSel(r.id);setMenu(false)};
  const ops=!el?null:<>
    <button className="btn sm" title="Duplicar" onClick={()=>{const r=duplicateElement(layout,el.id);commit(r.layout);setSel(r.id)}}>⧉</button>
    <button className="btn sm danger" title="Remover" onClick={()=>{if(confirm('Remover este elemento da ficha? Os dados da ficha NÃO serão apagados.')){commit(removeElement(layout,el.id));setSel(null)}}}>🗑️</button>
    <button className="btn sm" title="Trazer para frente" onClick={()=>commit(layerOp(layout,el.id,'front'))}>⏫</button>
    <button className="btn sm" title="Subir" onClick={()=>commit(layerOp(layout,el.id,'up'))}>🔼</button>
    <button className="btn sm" title="Descer" onClick={()=>commit(layerOp(layout,el.id,'down'))}>🔽</button>
    <button className="btn sm" title="Enviar para trás" onClick={()=>commit(layerOp(layout,el.id,'back'))}>⏬</button></>;
  return <div className="ve">
    <div className="vetb">
      <div className="vemenu"><button className="btn sm" onClick={()=>setMenu(!menu)}>＋ Adicionar elemento</button>
        {menu&&<div className="panel vepop">{Object.entries(TYPES).map(([k,l])=><button key={k} onClick={()=>add(k)}>{TYPE_ICON[k]} {l}</button>)}</div>}</div>
      <label className="sw"><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/> Mostrar grade</label>
      <label className="sw"><input type="checkbox" checked={snapOn} onChange={e=>setSnap(e.target.checked)}/> Encaixar na grade</label>
      <select value={gs} onChange={e=>setGs(+e.target.value)} title="Tamanho da grade"><option value={10}>10 px</option><option value={20}>20 px</option><option value={40}>40 px</option></select>
      {ops}
    </div>
    <p className="sub vehint">Arraste para mover, use os pontos para redimensionar. Para criar ou apagar atributos, status, itens etc., use o 📋 Formulário clássico — aqui você só define como eles aparecem.</p>
    <div className="vebody">
      <VisualCanvas layout={layout} ctx={ctx} edit selId={sel} onSelect={setSel} onCommit={commit} grid={gs} showGrid={showGrid} snapOn={snapOn}/>
      <div className="veside">{el?<ElementProps key={el.id} el={el} s={s} layout={layout} commit={commit} onSel={setSel}/>:<SheetProps s={s} layout={layout} commit={commit} others={others}/>}</div>
    </div>
  </div>;
}
