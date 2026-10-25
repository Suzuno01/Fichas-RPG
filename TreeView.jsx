import {useState,useRef,useEffect,useCallback} from 'react';
import {useApp} from './ctx.js';
import {uid,now,readImage} from './storage.js';
import * as T from './treeLogic.js';

import {Ico,IconEdit,ImgUp,setImg,clearImg,icoText} from './imgtools.jsx';
const CW=176,CH=138,ICO={done:'✓',open:'🔓',lock:'🔒'},dt=d=>d?new Date(d).toLocaleString('pt-BR'):'';
const clampK=k=>Math.min(2.5,Math.max(.2,k));

function Ask({title,children,yes='SIM',danger,onYes,onNo}){
  return <div className="modal" style={{zIndex:30}} onClick={onNo}><div className="panel nmod" onClick={e=>e.stopPropagation()}><h3>{title}</h3>{children}
    <div className="row"><button className={'btn'+(danger?' danger':'')} onClick={onYes}>{yes}</button><button className="btn" onClick={onNo}>CANCELAR</button></div></div></div>;
}

// ---------- Canvas: zoom, pan (mouse/toque), pinça, arrastar nós (modo edição) ----------
function Canvas({tree,info,sel,onSel,edit,onMove}){
  const box=useRef(),[v,setV]=useState({x:30,y:30,k:1}),[drag,setDrag]=useState(null);
  const R=useRef({p:new Map(),g:null,moved:false});Object.assign(R.current,{v,onMove,tree});
  const fit=useCallback(forceK=>{const el=box.current,N=R.current.tree.nodes;if(!el)return;if(!N.length)return setV({x:30,y:30,k:1});
    const x0=Math.min(...N.map(n=>n.x)),x1=Math.max(...N.map(n=>n.x+CW)),y0=Math.min(...N.map(n=>n.y)),y1=Math.max(...N.map(n=>n.y+CH)),W=el.clientWidth,H=el.clientHeight;
    const k=forceK||clampK(Math.min(1.1,(W-40)/(x1-x0),(H-40)/(y1-y0)));setV({k,x:(W-(x1-x0)*k)/2-x0*k,y:(H-(y1-y0)*k)/2-y0*k})},[]);
  const zoomAt=useCallback((f,cx,cy)=>setV(p=>{const k=clampK(p.k*f);return {k,x:cx-(cx-p.x)/p.k*k,y:cy-(cy-p.y)/p.k*k}}),[]);
  useEffect(()=>{fit()},[]);
  useEffect(()=>{const el=box.current;const wh=e=>{e.preventDefault();const r=el.getBoundingClientRect();zoomAt(e.deltaY<0?1.12:1/1.12,e.clientX-r.left,e.clientY-r.top)};
    el.addEventListener('wheel',wh,{passive:false});return()=>el.removeEventListener('wheel',wh)},[zoomAt]);
  useEffect(()=>{
    const mv=e=>{const r=R.current;if(!r.p.has(e.pointerId))return;r.p.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=r.g;if(!g)return;
      if(g.t==='pinch'){const[a,b]=[...r.p.values()],k=clampK(g.v0.k*Math.hypot(a.x-b.x,a.y-b.y)/g.d0);setV({k,x:g.cx-(g.cx-g.v0.x)/g.v0.k*k,y:g.cy-(g.cy-g.v0.y)/g.v0.k*k});return}
      const dx=e.clientX-g.sx,dy=e.clientY-g.sy;if(Math.hypot(dx,dy)>5)r.moved=true;
      if(g.t==='pan'&&r.moved)setV({...g.v0,x:g.v0.x+dx,y:g.v0.y+dy});
      if(g.t==='node'&&r.moved)setDrag({id:g.id,x:g.n0.x+dx/r.v.k,y:g.n0.y+dy/r.v.k})};
    const up=e=>{const r=R.current;if(!r.p.has(e.pointerId))return;r.p.delete(e.pointerId);const g=r.g;
      if(g?.t==='node'&&r.moved&&r.p.size===0){const sn=q=>Math.round(q/10)*10;r.onMove&&r.onMove(g.id,sn(g.n0.x+(e.clientX-g.sx)/r.v.k),sn(g.n0.y+(e.clientY-g.sy)/r.v.k));setDrag(null)}
      if(r.p.size===0||g?.t==='pinch'){r.g=null;if(r.p.size===0)setDrag(null)}};
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
    return()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up)}},[]);
  const start=(e,id)=>{if(e.button!==0)return;const r=R.current;r.p.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(r.p.size===1){r.moved=false;const n=id&&r.tree.nodes.find(q=>q.id===id);
      r.g=n?{t:'node',id,sx:e.clientX,sy:e.clientY,n0:{x:n.x,y:n.y}}:{t:'pan',sx:e.clientX,sy:e.clientY,v0:r.v}}
    else if(r.p.size===2){const[a,b]=[...r.p.values()],rc=box.current.getBoundingClientRect();
      r.g={t:'pinch',d0:Math.hypot(a.x-b.x,a.y-b.y)||1,v0:r.v,cx:(a.x+b.x)/2-rc.left,cy:(a.y+b.y)/2-rc.top};r.moved=true;setDrag(null)}};
  const N=tree.nodes,P=n=>drag&&drag.id===n.id?drag:n,byId=Object.fromEntries(N.map(n=>[n.id,n]));
  const lines=N.flatMap(n=>(n.conn||[]).map(c=>{const a=byId[c];if(!a)return null;const pa=P(a),pb=P(n),x1=pa.x+CW/2,y1=pa.y+CH,x2=pb.x+CW/2,y2=pb.y,dy=Math.max(40,Math.abs(y2-y1)/2);
    const on=edit||info(a).state==='done';return <path key={n.id+c} d={`M${x1} ${y1}C${x1} ${y1+dy} ${x2} ${y2-dy} ${x2} ${y2}`} className={'tl'+(on?' on':'')}/>}));
  const ctr=()=>[box.current.clientWidth/2,box.current.clientHeight/2];
  return <div className="tvbox" ref={box} onPointerDown={e=>start(e,null)}>
    <div className="tvworld" style={{transform:`translate(${v.x}px,${v.y}px) scale(${v.k})`}}>
      <svg className="tvlines" width="1" height="1">{lines}</svg>
      {N.map(n=>{const p=P(n),e=edit?null:info(n),st=e?e.state:'edit',col=n.color||undefined;
        return <button key={n.id} className={'tn '+st+(sel===n.id?' sel':'')} style={{left:p.x,top:p.y,width:CW,height:CH,'--nc':col}}
          onPointerDown={edit?ev=>{ev.stopPropagation();start(ev,n.id)}:undefined} onClick={()=>{if(!R.current.moved)onSel(n)}}>
          <div className="tni">{n.img?<img src={n.img} alt=""/>:<Ico v={n.icon||'✨'}/>}</div><b>{n.name}</b>
          {e?<ul>{e.checks.slice(0,3).map(c=><li key={c.id} className={c.ok?'ok':'no'}>{c.ok?'✓':'✗'} {c.label}</li>)}{e.checks.length>3&&<li>+{e.checks.length-3}…</li>}</ul>
            :<small>{n.type} · {(n.reqs||[]).length} req.</small>}
          <em>{T.costOf(n)} {T.costOf(n)===1?'ponto':'pontos'}</em><span className="tns">{e?ICO[st]:'✎'}</span></button>})}</div>
    {!N.length&&<p className="empty tvempty">Esta árvore ainda não tem habilidades.</p>}
    <div className="tvctl" onPointerDown={e=>e.stopPropagation()}>
      <button title="Aproximar" onClick={()=>zoomAt(1.25,...ctr())}>＋</button><button title="Afastar" onClick={()=>zoomAt(1/1.25,...ctr())}>－</button>
      <button title="Centralizar tudo" onClick={()=>fit()}>⌖</button><button title="Resetar zoom (100%)" onClick={()=>fit(1)}>1:1</button></div></div>;
}

// ---------- Detalhes da habilidade (visão da ficha) ----------
function NodeModal({s,tree,node,close,isM,self,run}){
  const {db}=useApp(),[ask,setAsk]=useState(null),e=T.evalNode(s,tree,node),p=T.getProg(s),cost=T.costOf(node),en=e.entry;
  const who=en&&(en.legacy?'Mestre (árvore antiga)':db.users.find(u=>u.id===en.by)?.display||db.users.find(u=>u.id===en.by)?.name||'—');
  const miss=e.checks.filter(c=>!c.ok);
  const go=()=>{const a=ask;setAsk(null);run(a,node);close()};
  return <div className="modal" onClick={close}><div className="panel nmod" onClick={x=>x.stopPropagation()} style={{borderColor:node.color||undefined}}>
    <div className="tmh"><div className="tni big">{node.img?<img src={node.img} alt=""/>:<Ico v={node.icon||'✨'}/>}</div>
      <div><h3>{node.name}</h3><small>{node.type} · {cost} {cost===1?'ponto':'pontos'}</small><div><span className={'badge '+e.state}>{ICO[e.state]} {T.STATE[e.state]}</span>{en?.master&&<span className="badge master">👑 Liberada pelo Mestre</span>}</div></div></div>
    {node.desc&&<p className="txt">{node.desc}</p>}
    <h4>Requisitos {e.checks.length>1&&<small>({e.mode==='any'?'cumpra qualquer um':'cumpra todos'})</small>}</h4>
    {!e.checks.length&&<p className="empty">Nenhum requisito.</p>}
    <ul className="rq">{e.checks.map(c=><li key={c.id} className={c.ok?'ok':'no'}>{c.ok?'✓':'✗'} {c.label}</li>)}</ul>
    {e.state==='lock'&&<div className="why"><b>Por que está bloqueada?</b>{e.mode==='any'?<p>Você precisa cumprir pelo menos um destes requisitos:</p>:null}{miss.map(c=><p key={c.id}>{c.hint}</p>)}</div>}
    {e.state==='open'&&<p className="txt">Pontos de habilidade: <b>{p.points}</b> · custo: <b>{cost}</b>{p.points<cost&&<span className="err"> — Pontos insuficientes.</span>}</p>}
    {en&&<p className="txt">🗓️ Desbloqueada em {dt(en.at)}<br/>👤 Por: {who}{en.master?' (liberação do Mestre)':en.cost?` · custou ${en.cost} pontos`:''}</p>}
    <div className="row">
      {e.state==='open'&&self&&<button className="btn" disabled={p.points<cost} onClick={()=>setAsk('unlock')}>🔓 DESBLOQUEAR</button>}
      {e.state==='open'&&!self&&!isM&&<small className="empty">O Mestre ainda não permitiu desbloquear por conta própria.</small>}
      {isM&&!en&&<button className="btn" onClick={()=>setAsk('release')}>👑 LIBERAR HABILIDADE</button>}
      {isM&&en&&<button className="btn danger" onClick={()=>setAsk('lock')}>🔒 BLOQUEAR / RESETAR</button>}
      <button className="btn" onClick={close}>FECHAR</button></div>
    {ask==='unlock'&&<Ask title="Desbloquear" onYes={go} onNo={()=>setAsk(null)}><p>{cost?`Desbloquear esta habilidade por ${cost} ${cost===1?'ponto':'pontos'}?`:'Desbloquear esta habilidade (sem custo)?'}</p><p className="sub">Pontos: {p.points} → {p.points-cost}</p></Ask>}
    {ask==='release'&&<Ask title="Liberar habilidade" onYes={go} onNo={()=>setAsk(null)}><p>Liberar <b>{node.name}</b> para esta ficha, ignorando requisitos e sem gastar pontos?</p></Ask>}
    {ask==='lock'&&<Ask title="Bloquear habilidade" danger yes="BLOQUEAR" onYes={go} onNo={()=>setAsk(null)}><p>Bloquear <b>{node.name}</b> nesta ficha?</p>
      <p className="sub">{en.master?'Foi uma liberação do Mestre: nenhum ponto será devolvido.':`Serão devolvidos ${en.cost||0} pontos.`}</p>
      {tree.nodes.some(n=>p.unlocked[n.id]&&(n.reqs||[]).some(q=>q.kind==='node'&&q.node===node.id))&&<p className="err">Atenção: há habilidades desbloqueadas que dependem desta; elas continuam desbloqueadas.</p>}</Ask>}
  </div></div>;
}

// ---------- Painel de progressão na ficha: Nível, Pontos, Condições/Marcas ----------
export function ProgPanel({s,isM,ed,ntf}){
  const [m,setM]=useState(''),p=T.getProg(s),marks=s.marks||[];
  const addMark=()=>{const n=m.trim();if(!n)return;if(marks.some(x=>x.name.toLowerCase()===n.toLowerCase()))return alert('Esta condição/marca já existe nesta ficha.');
    ed(x=>{(x.marks??=[]).push({id:uid(),name:n,at:now()})});ntf&&ntf('🏷️ Nova condição/marca: '+n);setM('')};
  const pts=d=>ed(x=>{const q=T.normProg(x);q.points=Math.max(0,q.points+d)});
  return <section className="panel"><h3>🌳 Progressão</h3>
    <div className="row"><b>Nível</b>{isM?<input type="number" className="n" min="1" value={T.levelOf(s)} onChange={e=>ed(x=>{x.level=Math.max(1,parseInt(e.target.value,10)||1)})}/>:<span className="txt"><b>{T.levelOf(s)}</b></span>}</div>
    <div className="row"><b>Pontos de habilidade</b>{isM?<><button className="btn sm" onClick={()=>pts(-1)}>−</button><input type="number" className="n" min="0" value={p.points} onChange={e=>ed(x=>{T.normProg(x).points=Math.max(0,parseInt(e.target.value,10)||0)})}/><button className="btn sm" onClick={()=>pts(1)}>＋</button></>:<span className="txt"><b>{p.points}</b></span>}</div>
    <h4>Condições / Marcas</h4>
    <div className="chips">{marks.map(x=><span className="chip mk" key={x.id}>🏷️ {x.name}{isM&&<button className="x" title="Remover" onClick={()=>ed(d=>{d.marks=d.marks.filter(y=>y.id!==x.id)})}>×</button>}</span>)}
      {!marks.length&&<small className="empty">Nenhuma condição/marca.</small>}</div>
    {isM&&<div className="row nw"><input placeholder="Ex.: Marca do Dragão" value={m} onChange={e=>setM(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMark()}/><button className="btn sm" onClick={addMark}>＋ CONCEDER</button></div>}
  </section>;
}

// ---------- Aba "Árvore" da ficha ----------
export function TreeTab({s,isM,ed,ntf,mine}){
  const {db,user,camp,upd,showProfile}=useApp(),prog=T.getProg(s),all=db.trees||[];
  const mineT=all.filter(t=>prog.trees.includes(t.id)),[tid,setTid]=useState(mineT[0]?.id),[node,setNode]=useState(null),[rs,setRs]=useState(false);
  const tree=mineT.find(t=>t.id===tid)||mineT[0],free=all.filter(t=>!prog.trees.includes(t.id));
  const self=mine&&!!db.perms.unlockTree&&!isM;
  const run=(act,n)=>{
    if(act==='unlock'){const r=T.unlock(structuredClone(s),tree,n,user.id);if(!r.ok)return alert(r.reason);
      ed(x=>{T.unlock(x,tree,n,user.id)});
      upd(d=>{(d.notes??=[]).unshift({id:uid(),to:camp.owner,text:`🌳 ${user.display||user.name} desbloqueou ${n.name} (${s.charName})`,at:now(),read:false})})}
    if(act==='release'){ed(x=>{T.release(x,tree,n,user.id)});ntf&&ntf('✨ Nova habilidade desbloqueada! '+n.name)}
    if(act==='lock')ed(x=>{T.lock(x,tree,n)})};
  const pv=tree&&T.previewReset(s,tree),{done,total}=tree?T.progressCount(s,tree):{done:0,total:0};
  return <div><div className="row"><b>Pontos de habilidade: {prog.points}</b><span>· Nível {T.levelOf(s)}</span></div>
    {isM&&<div className="row"><select value="" onChange={e=>{const id=e.target.value;if(id){ed(x=>{const q=T.normProg(x);q.trees.includes(id)||q.trees.push(id)});setTid(id)}}}>
        <option value="">＋ Atribuir árvore a esta ficha…</option>{free.map(t=><option key={t.id} value={t.id}>{icoText(t.icon)} {t.name}</option>)}</select>
      {!all.length&&<small className="empty">Crie árvores em 🌳 Árvore (menu).</small>}</div>}
    {mineT.length>1&&<div className="tabs">{mineT.map(t=><button key={t.id} className={t.id===tree?.id?'on':''} onClick={()=>setTid(t.id)}><Ico v={t.icon}/> {t.name}</button>)}</div>}
    {!tree&&<p className="empty">{isM?'Nenhuma árvore atribuída a esta ficha.':'O Mestre ainda não atribuiu uma árvore a esta ficha.'}</p>}
    {tree&&<><div className="row"><h3><Ico v={tree.icon}/> {tree.name}</h3><span className="chip">{done} / {total} habilidades</span>
        {isM&&<><button className="btn sm danger" onClick={()=>setRs(true)}>↺ Resetar progresso</button>
          <button className="btn sm" onClick={()=>confirm('Remover esta árvore da ficha? O progresso é mantido caso ela seja atribuída de novo.')&&ed(x=>{const q=T.normProg(x);q.trees=q.trees.filter(i=>i!==tree.id)})}>Remover da ficha</button></>}</div>
      {tree.desc&&<p className="txt sub">{tree.desc}</p>}
      <Canvas key={tree.id+s.id} tree={tree} info={n=>T.evalNode(s,tree,n)} sel={node?.id} onSel={setNode}/>
      <small className="sub">Arraste para mover · roda do mouse ou pinça para zoom · toque numa habilidade para ver detalhes.</small></>}
    {node&&tree&&<NodeModal s={s} tree={tree} node={tree.nodes.find(n=>n.id===node.id)||node} close={()=>setNode(null)} isM={isM} self={self} run={run}/>}
    {rs&&tree&&<Ask title="Resetar progresso desta árvore" danger yes="RESETAR" onNo={()=>setRs(false)} onYes={()=>{ed(x=>{T.resetTree(x,tree)});setRs(false)}}>
      <p>Tem certeza que deseja resetar o progresso desta árvore?</p>
      {pv.nodes.length?<><p className="sub">Serão bloqueadas {pv.nodes.length} habilidades:</p><div className="chips">{pv.nodes.map(n=><span className="chip" key={n.id}><Ico v={n.icon}/> {n.name}</span>)}</div>
        <p>Pontos devolvidos: <b>{pv.refund}</b> (liberações do Mestre não devolvem pontos).</p></>:<p className="sub">Nenhuma habilidade desbloqueada: nada será alterado.</p>}</Ask>}
  </div>;
}

// ---------- Editor de nó (Mestre) ----------
const Dl=({id,list})=><datalist id={id}>{[...new Set(list.filter(Boolean))].map(x=><option key={x} value={x}/>)}</datalist>;
function NodeEditor({tree,node,close,sheets}){
  const {upd}=useApp(),[ask,setAsk]=useState(false);
  const ed=fn=>upd(d=>{const t=d.trees.find(x=>x.id===tree.id),n=t.nodes.find(x=>x.id===node.id);fn(n,t,d)});
  const set=(k,v)=>ed(n=>{n[k]=v}),others=tree.nodes.filter(n=>n.id!==node.id);
  const setReq=(i,k,v)=>ed(n=>{n.reqs[i][k]=v});
  const conn=(id,on)=>ed(n=>{n.conn=(n.conn||[]).filter(c=>c!==id);n.reqs=n.reqs.filter(q=>!(q.kind==='node'&&q.node===id));if(on){n.conn.push(id);n.reqs.push({...T.newReq('node'),node:id})}});
  const nUn=T.countUnlocked(sheets,[node.id]);
  return <div className="modal" onClick={close}><div className="panel nmod" onClick={e=>e.stopPropagation()}>
    <Dl id="dl-skill" list={sheets.flatMap(s=>s.skills.map(k=>k.name))}/><Dl id="dl-item" list={sheets.flatMap(s=>s.items.map(k=>k.name))}/>
    <Dl id="dl-attr" list={sheets.flatMap(s=>s.attrs.map(k=>k.name))}/><Dl id="dl-mark" list={sheets.flatMap(s=>(s.marks||[]).map(k=>k.name))}/>
    <h3>✎ Editar habilidade</h3>
    <div className="row nw"><IconEdit value={node.icon} on={v=>set('icon',v)}/><input value={node.name} onChange={e=>set('name',e.target.value)}/></div>
    <div className="row"><ImgUp label="🖼️ Imagem" obj={node} field="img" ratio={1} shape="round" out={256} on={r=>ed(n=>{setImg(n,'img',r)})}/>
      {node.img&&<button className="btn sm danger" onClick={()=>ed(n=>{clearImg(n,'img')})}>Remover imagem</button>}
      <label className="pick">Cor<input type="color" value={node.color||'#d4a34a'} onChange={e=>set('color',e.target.value)}/></label>{node.color&&<button className="btn sm" onClick={()=>set('color','')}>Cor padrão</button>}</div>
    <div className="row"><label className="lab">Tipo<select value={node.type} onChange={e=>set('type',e.target.value)}>{[...new Set([...T.TYPES,node.type])].map(t=><option key={t}>{t}</option>)}</select></label>
      <label className="lab">Custo (pontos)<input type="number" min="0" value={node.cost} onChange={e=>set('cost',Math.max(0,parseInt(e.target.value,10)||0))}/></label></div>
    <label className="lab">Descrição / efeito<textarea rows={3} value={node.desc} onChange={e=>set('desc',e.target.value)}/></label>
    <h4>Conexões <small>(habilidades anteriores — ligar também exige a anterior)</small></h4>
    <div className="chips">{others.map(o=><label key={o.id} className="chip"><input type="checkbox" checked={(node.conn||[]).includes(o.id)} onChange={e=>conn(o.id,e.target.checked)}/> {o.name}</label>)}{!others.length&&<small className="empty">Crie outras habilidades para conectar.</small>}</div>
    <h4>Requisitos</h4>
    {node.reqs.length>1&&<label className="lab">Combinação<select value={node.mode} onChange={e=>set('mode',e.target.value)}><option value="all">E — cumprir todos</option><option value="any">OU — cumprir qualquer um</option></select></label>}
    {node.reqs.map((q,i)=><div className="row nw" key={q.id}><span className="rk">{T.REQ[q.kind]}</span>
      {q.kind==='level'&&<input type="number" min="1" value={q.min} onChange={e=>setReq(i,'min',+e.target.value)}/>}
      {q.kind==='attr'&&<><input list="dl-attr" placeholder="Atributo" value={q.name} onChange={e=>setReq(i,'name',e.target.value)}/><input type="number" className="n" value={q.min} onChange={e=>setReq(i,'min',+e.target.value)}/></>}
      {['skill','item','mark'].includes(q.kind)&&<input list={'dl-'+q.kind} placeholder="Nome exato" value={q.name} onChange={e=>setReq(i,'name',e.target.value)}/>}
      {q.kind==='node'&&<select value={q.node} onChange={e=>setReq(i,'node',e.target.value)}><option value="">—</option>{others.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>}
      <button className="x" onClick={()=>ed(n=>{n.reqs.splice(i,1)})}>×</button></div>)}
    <select value="" onChange={e=>e.target.value&&ed(n=>{n.reqs.push(T.newReq(e.target.value))})}><option value="">＋ Adicionar requisito…</option>{Object.entries(T.REQ).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
    <div className="row"><button className="btn danger" onClick={()=>setAsk(true)}>🗑️ Excluir habilidade</button><button className="btn" onClick={close}>PRONTO</button></div>
    {ask&&<Ask title="Excluir habilidade" danger yes="EXCLUIR" onNo={()=>setAsk(false)} onYes={()=>{upd(d=>{const t=d.trees.find(x=>x.id===tree.id);t.nodes=t.nodes.filter(n=>n.id!==node.id);
        t.nodes.forEach(n=>{n.conn=(n.conn||[]).filter(c=>c!==node.id);n.reqs=n.reqs.filter(q=>!(q.kind==='node'&&q.node===node.id))});T.purgeNodes(d.sheets,[node.id])});close()}}>
      <p>Excluir <b>{node.name}</b>? As conexões e requisitos que apontam para ela serão removidos.</p>{nUn>0&&<p className="err">{nUn} ficha(s) têm esta habilidade desbloqueada; o desbloqueio será removido e os pontos gastos devolvidos.</p>}</Ask>}
  </div></div>;
}

// ---------- Página Árvore (menu) ----------
function PlayerTrees(){
  const {db,user,open}=useApp();
  if(!db.perms.viewTree)return <div><h2>🌳 Árvore de habilidades</h2><p className="empty">O Mestre não liberou a visualização da árvore.</p></div>;
  const L=db.sheets.filter(s=>!s.isTemplate&&s.owner===user.id&&T.getProg(s).trees.length);
  return <div><h2>🌳 Árvore de habilidades</h2>{!L.length&&<p className="empty">Nenhuma árvore atribuída às suas fichas ainda.</p>}
    {L.map(s=><section key={s.id} className="panel"><h3>{s.charName} <small>{s.name}</small><button className="btn sm" onClick={()=>open(s.id,'arvore')}>Abrir árvore</button></h3>
      <p className="txt">Pontos de habilidade: <b>{T.getProg(s).points}</b> · Nível {T.levelOf(s)}</p>
      <div className="chips">{(db.trees||[]).filter(t=>T.getProg(s).trees.includes(t.id)).map(t=>{const c=T.progressCount(s,t);return <span key={t.id} className="chip"><Ico v={t.icon}/> {t.name}: {c.done} / {c.total}</span>})}</div></section>)}</div>;
}

export function TreesPage(){
  const {db,isM,camp,upd,open}=useApp(),trees=db.trees||[];
  const [tid,setTid]=useState(trees[0]?.id),[tab,setTab]=useState('estrutura'),[nid,setNid]=useState(null),[del,setDel]=useState(false);
  if(!isM)return <PlayerTrees/>;
  const tree=trees.find(t=>t.id===tid)||trees[0],sheets=db.sheets.filter(s=>!s.isTemplate),node=tree?.nodes.find(n=>n.id===nid);
  const edT=fn=>upd(d=>fn(d.trees.find(t=>t.id===tree.id)));
  const create=()=>{const t=T.newTree(camp.id,'Nova árvore');upd(d=>{(d.trees??=[]).push(t)});setTid(t.id);setTab('estrutura')};
  const addNode=()=>{const y=tree.nodes.length?Math.max(...tree.nodes.map(n=>n.y))+170:0,n=T.newNode(0,y);edT(t=>{t.nodes.push(n)});setNid(n.id)};
  const assign=(sid)=>upd(d=>{const s=d.sheets.find(x=>x.id===sid),q=T.normProg(s);q.trees.includes(tree.id)||q.trees.push(tree.id)});
  const rows=tree?sheets.filter(s=>T.getProg(s).trees.includes(tree.id)):[],free=tree?sheets.filter(s=>!T.getProg(s).trees.includes(tree.id)):[];
  const own=u=>db.users.find(x=>x.id===u)?.display||db.users.find(x=>x.id===u)?.name||'—';
  const ids=tree?tree.nodes.map(n=>n.id):[];
  return <div><h2>🌳 Árvores de habilidades</h2>
    <p className="sub">As árvores são compartilhadas na campanha <b>{camp.name}</b>; o progresso e os pontos são individuais de cada ficha.</p>
    <div className="tabs">{trees.map(t=><button key={t.id} className={t.id===tree?.id?'on':''} onClick={()=>{setTid(t.id);setNid(null)}}><Ico v={t.icon}/> {t.name}</button>)}<button className="newtab" onClick={create}>＋ NOVA ÁRVORE</button></div>
    {!tree&&<p className="empty">Nenhuma árvore ainda. Crie a primeira (Espadachim, Mago, Assassino...).</p>}
    {tree&&<>
      <div className="panel"><div className="row nw"><IconEdit value={tree.icon} on={v=>edT(t=>{t.icon=v})}/><input value={tree.name} onChange={e=>edT(t=>{t.name=e.target.value})}/>
        <button className="x" title="Excluir árvore" onClick={()=>setDel(true)}>🗑️</button></div>
        <input placeholder="Descrição" value={tree.desc||''} onChange={e=>edT(t=>{t.desc=e.target.value})}/>
        {tree.migratedFrom&&<p className="sub">ℹ️ Árvore criada automaticamente a partir das árvores antigas de {tree.migratedFrom.length} ficha(s). O progresso de cada ficha foi preservado e as árvores antigas continuam guardadas dentro das fichas.</p>}</div>
      <div className="tabs"><button className={tab==='estrutura'?'on':''} onClick={()=>setTab('estrutura')}>🧩 Estrutura</button><button className={tab==='progresso'?'on':''} onClick={()=>setTab('progresso')}>📊 Progresso dos jogadores</button></div>
      {tab==='estrutura'&&<><div className="row"><button className="btn" onClick={addNode}>＋ NOVA HABILIDADE</button><small className="sub">Arraste os cartões para posicionar · toque num cartão para editar.</small></div>
        <Canvas key={tree.id} tree={tree} edit sel={nid} onSel={n=>setNid(n.id)} onMove={(id,x,y)=>edT(t=>{const n=t.nodes.find(q=>q.id===id);n.x=x;n.y=y})}/></>}
      {tab==='progresso'&&<div>
        <div className="row"><select value="" onChange={e=>e.target.value&&assign(e.target.value)}><option value="">＋ Atribuir esta árvore a uma ficha…</option>{free.map(s=><option key={s.id} value={s.id}>{s.charName} ({own(s.owner)})</option>)}</select></div>
        {!rows.length&&<p className="empty">Nenhuma ficha usa esta árvore ainda.</p>}
        {rows.map(s=>{const c=T.progressCount(s,tree),p=T.getProg(s);return <div className="panel" key={s.id}>
          <div className="row"><b>{own(s.owner)}</b><span>Ficha: {s.charName}</span><span className="chip">{c.done} / {c.total} habilidades</span><span>💠 {p.points} pontos</span><span>Nível {T.levelOf(s)}</span>
            <button className="btn sm" onClick={()=>open(s.id,'arvore')}>Abrir / liberar</button></div>
          <div className="bar"><i style={{width:(c.total?c.done/c.total*100:0)+'%',background:tree.color}}/></div>
          <div className="chips">{tree.nodes.filter(n=>p.unlocked[n.id]).map(n=><span className="chip" key={n.id}><Ico v={n.icon}/> {n.name}{p.unlocked[n.id].master?' 👑':''}</span>)}{!c.done&&<small className="empty">Nada desbloqueado.</small>}</div></div>})}</div>}
      {node&&<NodeEditor key={node.id} tree={tree} node={node} sheets={sheets} close={()=>setNid(null)}/>}
      {del&&<Ask title="Excluir árvore" danger yes="EXCLUIR" onNo={()=>setDel(false)} onYes={()=>{upd(d=>{T.purgeNodes(d.sheets,ids);d.sheets.forEach(s=>{if(s.treeProg)s.treeProg.trees=s.treeProg.trees.filter(i=>i!==tree.id)});d.trees=d.trees.filter(t=>t.id!==tree.id)});setDel(false);setTid(null)}}>
        <p>Excluir a árvore <b>{tree.name}</b> ({tree.nodes.length} habilidades)?</p><p className="err">{rows.length} ficha(s) usam esta árvore. Os desbloqueios dela serão removidos e os pontos gastos devolvidos.</p></Ask>}</>}
  </div>;
}
