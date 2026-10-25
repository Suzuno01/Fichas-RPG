import {useState} from 'react';
import {useApp} from './ctx.js';
import {uid,now,readImage,newPerms} from './storage.js';
import {campaignsFor,PER_CAMPAIGN} from './repo.js';

import {Ico,IconEdit,ImgUp,setImg,clearImg,icoText} from './imgtools.jsx';
const Fields=({v,on})=><>
  <label className="lab">Nome da campanha<input value={v.name} onChange={e=>on('name',e.target.value)}/></label>
  <label className="lab">Descrição<textarea rows={3} value={v.desc||''} onChange={e=>on('desc',e.target.value)}/></label>
  <div className="row"><ImgUp label="🖼️ Capa" obj={v} field="cover" ratio={7/3} out={700} on={r=>{on('cover',r.img);on('coverO',r.orig);on('coverC',r.crop)}}/>
    {v.cover&&<button className="btn sm danger" onClick={()=>{on('cover','');on('coverO','');on('coverC',null)}}>Remover capa</button>}
    <label className="pick">Cor principal<input type="color" value={v.color} onChange={e=>on('color',e.target.value)}/></label>
    <label className="pick">Cor secundária<input type="color" value={v.color2} onChange={e=>on('color2',e.target.value)}/></label></div></>;

function Card({c,go}){
  const {raw,isM}=useApp();const n=raw.sheets.filter(s=>s.campaignId===c.id&&!s.isTemplate).length;
  return <div className="wcard" style={{'--c1':c.color,'--c2':c.color2,background:`linear-gradient(160deg,${c.color}55,${c.color2}aa),#15111f`}}>
    <div className="wcover" style={c.cover?{backgroundImage:`url(${c.cover})`}:null}>{!c.cover&&'🌍'}</div>
    <h3>{c.name}</h3><p className="txt">{c.desc}</p><p>👥 {c.members.length} jogadores</p><p>📜 {n} fichas</p>
    <button className="btn big" onClick={go}>{isM?'ENTRAR':'ENTRAR NA CAMPANHA'}</button></div>;
}

function Create({close}){
  const {user,upd}=useApp();const [f,setF]=useState({name:'',desc:'',cover:'',color:'#b8862b',color2:'#3b2a6b'});
  const create=()=>{if(!f.name.trim())return alert('Dê um nome à campanha.');const id=uid();
    upd(d=>{d.campaigns.push({id,owner:user.id,...f,name:f.name.trim(),notes:'',members:[],perms:newPerms(),created:now()});d.active=id});close()};
  return <div className="modal" onClick={close}><div className="panel" onClick={e=>e.stopPropagation()}><h3>🌍 Nova campanha</h3>
    <Fields v={f} on={(k,x)=>setF(p=>({...p,[k]:x}))}/><button className="btn big" onClick={create}>CRIAR CAMPANHA</button></div></div>;
}

export function CampaignSelect(){
  const {db,user,isM,upd,signOut}=useApp();const [dlg,setDlg]=useState(false);const list=campaignsFor(db,user);
  return <div className="worlds"><header className="row"><h1>🌍 {isM?'Minhas campanhas':'Escolha sua campanha'}</h1>
    <span>{isM?'👑':'🛡️'} {user.display||user.name}</span><button className="btn sm" onClick={signOut}>Sair</button></header>
    <div className="grid wgrid">{list.map(c=><Card key={c.id} c={c} go={()=>upd(d=>{d.active=c.id})}/>)}
      {isM&&<button className="wcard newc" onClick={()=>setDlg(true)}>＋<br/>NOVA CAMPANHA</button>}</div>
    {!list.length&&!isM&&<p className="empty">Você ainda não foi adicionado a nenhuma campanha. Peça ao Mestre.</p>}
    {dlg&&<Create close={()=>setDlg(false)}/>}</div>;
}

export function CampaignSettings(){
  const {camp,upd}=useApp();
  const on=(k,v)=>upd(d=>{d.campaign[k]=v});
  const del=()=>confirm('Excluir esta campanha e TODOS os dados dela (fichas, diário, rolagens...)?')&&upd(d=>{const id=d.campaign.id;
    d.campaigns=d.campaigns.filter(x=>x.id!==id);PER_CAMPAIGN.forEach(k=>{d[k]=(d[k]||[]).filter(x=>x.campaignId!==id)});d.active=null});
  return <div><h2>⚙️ Configurações da campanha</h2><div className="panel"><Fields v={camp} on={on}/>
    <label className="lab">Anotações / mensagem aos jogadores (aparece no Início)<textarea rows={5} value={camp.notes||''} onChange={e=>on('notes',e.target.value)}/></label></div>
    <div className="panel"><h3>Em breve</h3><div className="chips">{['🛡️ Permissões avançadas','✉️ Convites','🗄️ Banco de dados','🔧 Configurações avançadas'].map(t=><span className="chip" style={{opacity:.5}} key={t}>{t}</span>)}</div></div>
    <div className="panel"><button className="btn danger" onClick={del}>🗑️ Excluir campanha</button></div></div>;
}

export function AddExisting(){
  const {raw,camp,upd}=useApp();const [open,setO]=useState(false),[sel,setS]=useState([]);
  const avail=raw.users.filter(u=>u.role==='player'&&!camp.members.includes(u.id));
  const add=()=>{upd(d=>{sel.forEach(i=>d.campaign.members.includes(i)||d.campaign.members.push(i))});setS([]);setO(false)};
  return <div className="panel"><button className="btn" onClick={()=>setO(!open)}>＋ ADICIONAR JOGADOR EXISTENTE</button>
    {open&&<div>{!avail.length&&<p className="empty">Todos os jogadores já estão nesta campanha. Para criar uma conta nova, use "Criar jogador".</p>}
      <div className="chips">{avail.map(u=><label className="chip" key={u.id}><input type="checkbox" checked={sel.includes(u.id)} onChange={e=>setS(s=>e.target.checked?[...s,u.id]:s.filter(i=>i!==u.id))}/> {u.display||u.name}</label>)}</div>
      {sel.length>0&&<button className="btn" onClick={add}>ADICIONAR À CAMPANHA</button>}</div>}</div>;
}
