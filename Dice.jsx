import {useState} from 'react';
import {useApp} from './ctx.js';
import {roll,logRoll,ago} from './dice.js';
export default function Dice(){
  const {db,user,isM,upd}=useApp();
  const sheets=db.sheets.filter(s=>!s.isTemplate&&(isM||s.owner===user.id));
  const [sid,setSid]=useState(sheets[0]?.id||''),[ex,setEx]=useState('1d20'),[res,setRes]=useState(null);
  const attrs=sheets.find(s=>s.id===sid)?.attrs||[];
  const go=()=>{try{const r=roll(ex,attrs);setRes(r);upd(d=>logRoll(d,user,sid,ex,r))}catch{setRes({err:1})}};
  const hist=(db.rolls||[]).filter(r=>isM||r.user===user.id).slice(0,30);
  return <div><h2>🎲 Rolador de dados</h2><div className="panel">
    <div className="chips">{[4,6,8,10,12,20,100].map(n=><button key={n} className="btn sm" onClick={()=>setEx(e=>(e.trim()?e+' + ':'')+'1d'+n)}>d{n}</button>)}
      <button className="btn sm danger" onClick={()=>setEx('')}>Limpar</button></div>
    <label className="lab">Ficha (fornece os atributos){attrs.length>0&&<small>: {attrs.map(a=>a.name).join(', ')}</small>}
      <select value={sid} onChange={e=>setSid(e.target.value)}><option value="">Nenhuma</option>{sheets.map(s=><option key={s.id} value={s.id}>{s.charName}</option>)}</select></label>
    <div className="row nw"><input value={ex} placeholder="1d20 + Força" onChange={e=>setEx(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()}/><button className="btn" onClick={go}>🎲 ROLAR</button></div>
    {res&&(res.err?<p className="err">Fórmula inválida. Use dados (2d6), números e nomes de atributos da ficha.</p>:<div className="result" key={Math.random()}><small>🎲 {res.detail}</small><b>TOTAL: {res.total}</b></div>)}</div>
    <h3>Rolagens recentes</h3>
    {hist.map(r=><div className="panel hrow" key={r.id}><span>🎲 {isM&&r.user!==user.id&&<b>{db.users.find(u=>u.id===r.user)?.name}: </b>}{r.expr}</span><b>{r.total}</b><small>{ago(r.at)}</small></div>)}
    {!hist.length&&<p className="empty">Nenhuma rolagem ainda.</p>}</div>;
}
