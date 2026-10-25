import {useState} from 'react';
import {useApp} from './ctx.js';
import {uid,now} from './storage.js';
import {newSheet} from './model.js';
import {AddExisting} from './Campaigns.jsx';
const fmt=d=>d?new Date(d).toLocaleString('pt-BR'):'nunca';

export function SheetCard({s}){
  const {db,isM,open}=useApp();
  return <div className="ccard" style={{background:s.cardBg,'--fr':s.frame}} onClick={()=>open(s.id)}>
    <h4>{s.charName}</h4><div className="frame">{s.cover?<img src={s.cover} alt=""/>:<span>🧙</span>}</div><p>{s.name}</p>
    {isM&&<small>👤 {db.users.find(u=>u.id===s.owner)?.name||'—'}</small>}</div>;
}
const visible=(db,user,isM)=>db.sheets.filter(s=>!s.isTemplate&&(isM||s.owner===user.id));

export function Home(){
  const {db,user,isM,go}=useApp();
  const mine=visible(db,user,isM).sort((a,b)=>b.updated.localeCompare(a.updated));
  return <div><h2>Bem-vindo, {user.name}!</h2><p className="sub">🗺️ {db.campaign.name}</p>
    <div className="stats"><div className="panel">📜 <b>{mine.length}</b> fichas</div>
      {isM&&<><div className="panel">👥 <b>{db.users.filter(u=>u.role==='player').length}</b> jogadores</div>
      <div className="panel">🧩 <b>{db.sheets.filter(s=>s.isTemplate).length}</b> modelos</div></>}</div>
    {db.campaign.notes&&<div className="panel txt">📖 {db.campaign.notes}</div>}
    <h3>Fichas recentes</h3><div className="grid">{mine.slice(0,4).map(s=><SheetCard key={s.id} s={s}/>)}</div>
    {!mine.length&&<button className="btn big" onClick={()=>go('sheets')}>Ir para as fichas</button>}</div>;
}

function NewDlg({close}){
  const {db,user,isM,upd,open}=useApp();
  const tpls=db.sheets.filter(s=>s.isTemplate&&(isM||s.isPublic||s.owner===user.id));
  const [t,setT]=useState(''),[o,setO]=useState(user.id);
  const players=db.users.filter(u=>u.active);
  const make=()=>{const base=tpls.find(x=>x.id===t);
    const s=base?{...structuredClone(base),id:uid(),owner:o,isTemplate:false,isPublic:false,template:base.name,created:now(),updated:now(),name:'Nova Ficha'}:newSheet(o);
    upd(d=>{d.sheets.push(s)});close();open(s.id)};
  return <div className="modal" onClick={close}><div className="panel" onClick={e=>e.stopPropagation()}>
    <h3>✨ Nova ficha</h3>
    {(isM||db.perms.useTemplates)&&<label className="lab">Modelo<select value={t} onChange={e=>setT(e.target.value)}><option value="">Ficha em branco</option>{tpls.map(x=><option key={x.id} value={x.id}>{x.isPublic?'🌐':'🔒'} {x.name}</option>)}</select></label>}
    {isM&&<label className="lab">Dono<select value={o} onChange={e=>setO(e.target.value)}>{players.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
    <button className="btn big" onClick={make}>CRIAR</button></div></div>;
}

export function Library(){
  const {db,user,isM,intent}=useApp();const [dlg,setDlg]=useState(intent==='new');
  const list=visible(db,user,isM);
  return <div><h2>📜 Fichas</h2><div className="grid">
    {list.map(s=><SheetCard key={s.id} s={s}/>)}
    {(isM||db.perms.createSheets)&&<button className="ccard newc" onClick={()=>setDlg(true)}>＋<br/>NOVA FICHA</button>}</div>
    {!list.length&&<p className="empty">Nenhuma ficha ainda.</p>}{dlg&&<NewDlg close={()=>setDlg(false)}/>}</div>;
}

export function Templates(){
  const {db,user,isM,upd,open}=useApp();
  const list=db.sheets.filter(s=>s.isTemplate&&(isM||s.isPublic||s.owner===user.id));
  const canNew=isM||db.perms.createTemplates;
  return <div><h2>🧩 Modelos de ficha</h2><div className="grid">
    {list.map(s=><div key={s.id} className="panel"><SheetCard s={s}/>
      <div className="row"><b>{s.isPublic?'🌐 Disponível':'🔒 Privado'}</b>
        {isM&&<button className="btn sm" onClick={()=>upd(d=>{const x=d.sheets.find(y=>y.id===s.id);x.isPublic=!x.isPublic})}>Alternar</button>}
        {(isM||s.owner===user.id)&&<button className="x" onClick={()=>confirm('Excluir modelo?')&&upd(d=>{d.sheets=d.sheets.filter(y=>y.id!==s.id)})}>🗑️</button>}</div></div>)}
    {canNew&&<button className="ccard newc" onClick={()=>{const s=newSheet(user.id,{isTemplate:true,name:'Novo modelo'});upd(d=>{d.sheets.push(s)});open(s.id)}}>＋<br/>NOVO MODELO</button>}</div>
    <p className="sub">Jogadores usam modelos liberados ao criar ficha: uma cópia é criada, o original não é alterado.</p></div>;
}

export function Overview({kind}){
  const {db,user,isM,open}=useApp();
  const L=visible(db,user,isM).filter(s=>s[kind].length);
  return <div><h2>{({skills:'✨ Habilidades',items:'🎒 Inventário',tree:'🌳 Árvore de habilidades'})[kind]}</h2>
    {!L.length&&<p className="empty">Nada por aqui ainda. Abra uma ficha para criar.</p>}
    {L.map(s=><section key={s.id} className="panel"><h3>{s.charName} <small>{s.name}</small>
      <button className="btn sm" onClick={()=>open(s.id,{skills:'habs',items:'itens',tree:'arvore'}[kind])}>Abrir</button></h3>
      <div className="chips">{s[kind].filter(c=>kind!=='skills'||c.on||isM).map(c=><span className="chip" style={{borderColor:c.bc}} key={c.id}>{c.icon} {c.name}{kind==='items'&&c.qty?` ×${c.qty}`:''}</span>)}</div></section>)}</div>;
}

export function Players(){
  const {db,raw,upd,showProfile,addPlayer,resetPassword}=useApp();const [n,setN]=useState(''),[p,setP]=useState(''),[made,setMade]=useState(null),[busy,setBusy]=useState(false);
  const add=async()=>{const login=n.trim();if(login.length<2||p.length<6)return alert('Informe login (2+) e senha (6+ caracteres).');
    if(raw.users.some(u=>u.name.toLowerCase()===login.toLowerCase()))return alert('Esse login já existe.');
    setBusy(true);try{await addPlayer(login,p);setMade({login,pass:p});setN('');setP('')}catch(e){alert(e.message)}setBusy(false)};
  return <div><h2>👥 Jogadores</h2>
    <div className="panel row"><input placeholder="Login do jogador" value={n} onChange={e=>setN(e.target.value)}/><input placeholder="Senha" value={p} onChange={e=>setP(e.target.value)}/><button className="btn" disabled={busy} onClick={add}>{busy?'Criando…':'＋ CRIAR JOGADOR'}</button></div>
    {made&&<div className="panel row"><span>✅ Jogador criado! Passe estes dados a ele — Login: <b>{made.login}</b> · Senha: <b>{made.pass}</b></span><button className="x" onClick={()=>setMade(null)}>×</button></div>}<AddExisting/>
    <div className="grid">{db.users.filter(u=>u.role==='player').map(u=><div className="panel" key={u.id}>
      <h3>🛡️ {u.name}</h3><p>Status: {u.active?'🟢 Ativo':'🔴 Bloqueado'}</p>
      <p>Fichas: {db.sheets.filter(s=>!s.isTemplate&&s.owner===u.id).map(s=>s.charName).join(', ')||'nenhuma'}</p><p>Último acesso: {fmt(u.last)}</p>
      <div className="row"><button className="btn sm" onClick={()=>showProfile(u.id)}>👤 VER PERFIL</button><button className="btn sm" onClick={()=>upd(d=>{const x=d.users.find(y=>y.id===u.id);x.active=!x.active})}>{u.active?'Bloquear':'Liberar'}</button>
        <button className="btn sm" onClick={async()=>{const s=prompt('Nova senha (6+):');if(s&&s.length>=6){try{await resetPassword(u.id,s);alert('Senha alterada.')}catch(e){alert(e.message)}}else if(s)alert('Mínimo 6 caracteres.')}}>Nova senha</button>
        <button className="x" onClick={()=>confirm('Remover o jogador desta campanha e apagar as fichas dele nela? (a conta continua existindo)')&&upd(d=>{d.campaign.members=d.campaign.members.filter(i=>i!==u.id);d.sheets=d.sheets.filter(s=>!(s.owner===u.id&&s.campaignId===d.campaign.id))})}>🗑️</button></div></div>)}</div></div>;
}

export function Campaign(){
  const {db,upd}=useApp();const c=db.campaign;
  return <div><h2>🗺️ Controle da campanha</h2><div className="panel">
    <label className="lab">Nome da campanha<input value={c.name} onChange={e=>upd(d=>{d.campaign.name=e.target.value})}/></label>
    <label className="lab">Anotações / mensagem aos jogadores (aparece no Início)<textarea rows={6} value={c.notes} onChange={e=>upd(d=>{d.campaign.notes=e.target.value})}/></label></div></div>;
}

const PERMS={createSheets:'Criar fichas',editSheets:'Editar as próprias fichas (dados, atributos, status, abas, imagens, visual)',useTemplates:'Usar modelos liberados',createTemplates:'Criar modelos (privados)',createItems:'Criar itens',createSkills:'Criar habilidades',viewTree:'Visualizar a árvore de habilidades',unlockTree:'Desbloquear as próprias habilidades da árvore (gastando pontos)'};
export function Perms(){
  const {db,upd}=useApp();
  return <div><h2>🛡️ Permissões dos jogadores</h2><div className="panel">
    {Object.entries(PERMS).map(([k,l])=><label key={k} className="sw"><input type="checkbox" checked={!!db.perms[k]} onChange={e=>upd(d=>{d.perms[k]=e.target.checked})}/> {l}</label>)}</div></div>;
}

export function Settings(){
  const {raw:db,user,changePassword}=useApp();const [p,setP]=useState('');
  const exp=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db)],{type:'application/json'}));a.download='fichas-rpg-backup.json';a.click()};
  return <div><h2>⚙️ Configurações</h2>
    <div className="panel"><h3>Alterar minha senha</h3><div className="row"><input type="password" placeholder="Nova senha" value={p} onChange={e=>setP(e.target.value)}/>
      <button className="btn" onClick={async()=>{if(p.length<6)return alert('Mínimo 6 caracteres.');try{await changePassword(p);setP('');alert('Senha alterada.')}catch(e){alert(e.message)}}}>Salvar</button></div></div>
    {user.role==='master'&&<div className="panel"><h3>Cópia de segurança</h3><p><small>Seus dados já ficam salvos online. Este botão baixa uma cópia, só por precaução.</small></p><div className="row"><button className="btn" onClick={exp}>⬇️ Baixar cópia</button></div></div>}</div>;
}
