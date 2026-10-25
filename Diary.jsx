import {useState} from 'react';
import {useApp} from './ctx.js';
import {uid} from './storage.js';
import {Rich} from './Sheet.jsx';
export default function Diary(){
  const {db,user,isM,upd}=useApp();
  const all=db.diary||[],[sel,setSel]=useState(null),[pg,setPg]=useState(0);
  const seen=c=>isM||c.vis==='all'||(c.vis==='some'&&(c.ids||[]).includes(user.id));
  const ch=all.find(c=>c.id===sel);
  const ed=fn=>upd(d=>fn(d.diary.find(c=>c.id===sel)));
  const players=db.users.filter(u=>u.role==='player');
  return <div><h2>📖 Diário</h2><div className="diary">
    <div className="panel chs">{all.map((c,i)=>seen(c)
      ?<button key={c.id} className={'chap'+(sel===c.id?' on':'')} onClick={()=>{setSel(c.id);setPg(0)}}>📖 {c.title}{isM&&c.vis!=='all'?' 🔒':''}</button>
      :<div key={c.id} className="chap lock">🔒 Capítulo {i+1} — ???</div>)}
      {isM&&<button className="btn sm" onClick={()=>{const id=uid();upd(d=>{(d.diary??=[]).push({id,title:'Novo capítulo',pages:[''],vis:'master',ids:[],paper:'#f3e6c4',ink:'#3b2a14',font:'Georgia, serif'})});setSel(id);setPg(0)}}>＋ NOVO CAPÍTULO</button>}
      {!all.length&&<p className="empty">O livro ainda está em branco.</p>}</div>
    {ch&&seen(ch)?<div>
      {isM&&<div className="panel"><input className="big" value={ch.title} onChange={e=>ed(c=>{c.title=e.target.value})}/>
        <div className="row"><select value={ch.vis} onChange={e=>ed(c=>{c.vis=e.target.value})}><option value="all">🌐 Todos os jogadores</option><option value="some">👤 Jogadores específicos</option><option value="master">🔒 Somente Mestre</option></select>
          <label className="pick">Papel<input type="color" value={ch.paper} onChange={e=>ed(c=>{c.paper=e.target.value})}/></label>
          <label className="pick">Tinta<input type="color" value={ch.ink} onChange={e=>ed(c=>{c.ink=e.target.value})}/></label>
          <select value={ch.font} onChange={e=>ed(c=>{c.font=e.target.value})}>{[['Georgia, serif','Clássica'],['"Palatino Linotype", serif','Palatino'],['system-ui, sans-serif','Moderna'],['"Brush Script MT", cursive','Manuscrita'],['"Courier New", monospace','Máquina']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
        {ch.vis==='some'&&<div className="chips">{players.map(p=><label key={p.id} className="chip"><input type="checkbox" checked={(ch.ids||[]).includes(p.id)} onChange={e=>ed(c=>{c.ids=e.target.checked?[...(c.ids||[]),p.id]:(c.ids||[]).filter(i=>i!==p.id)})}/> {p.name}</label>)}</div>}
        <div className="row"><button className="btn sm" onClick={()=>{ed(c=>{c.pages.push('')});setPg(ch.pages.length)}}>＋ Página</button>
          {ch.pages.length>1&&<button className="btn sm danger" onClick={()=>{ed(c=>{c.pages.splice(pg,1)});setPg(Math.max(0,pg-1))}}>Excluir página</button>}
          <button className="x" onClick={()=>{if(confirm('Excluir capítulo?')){upd(d=>{d.diary=d.diary.filter(c=>c.id!==sel)});setSel(null)}}}>🗑️</button></div></div>}
      <div className="book" style={{background:ch.paper,color:ch.ink,fontFamily:ch.font}}>
        {pg===0&&<h2 style={{color:ch.ink,textAlign:'center'}}>{ch.title}</h2>}
        <Rich key={ch.id+pg} html={ch.pages[pg]||''} can={isM} save={h=>ed(c=>{c.pages[pg]=h})}/></div>
      <div className="row pager"><button className="btn sm" disabled={pg<1} onClick={()=>setPg(pg-1)}>← Página anterior</button>
        <span>Página {pg+1} / {ch.pages.length}</span>
        <button className="btn sm" disabled={pg>=ch.pages.length-1} onClick={()=>setPg(pg+1)}>Próxima página →</button></div></div>
    :<p className="empty">Escolha um capítulo para ler.</p>}</div></div>;
}
