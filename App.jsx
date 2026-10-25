import {useState,useEffect,useSyncExternalStore} from 'react';
import {Ctx} from './ctx.js';
import {sb,initCloud,clearCloud,subscribe,getDb,update,subscribeStat,getStat,signOutCloud,addPlayerCloud,resetPlayerPassword,changeMyPassword} from './cloud.js';
import Login from './Login.jsx';
import {scope} from './repo.js';
import Sheet from './Sheet.jsx';
import Dice from './Dice.jsx';
import Diary from './Diary.jsx';
import Notifications from './Notifications.jsx';
import Profile from './Profile.jsx';
import Master from './Master.jsx';
import {TreesPage} from './TreeView.jsx';
import {CampaignSelect,CampaignSettings} from './Campaigns.jsx';
import * as P from './Pages.jsx';
const NAV=[['home','🏠','Início'],['sheets','📜','Fichas'],['dice','🎲','Dados'],['skills','⚔️','Habilid.'],['items','🎒','Itens'],['tree','🌳','Árvore'],['diary','📖','Diário'],['notes','🔔','Avisos'],['profile','👤','Perfil']];
const MV=['master','players','templates','perms','campaign'];

export default function App(){
  const [st,setSt]=useState({phase:'boot'});
  useEffect(()=>{
    let loaded=null,starting=false;
    const start=async session=>{
      if(!session){loaded=null;clearCloud();setSt(s=>({phase:'out',msg:s.msg}));return}
      if(loaded===session.user.id||starting)return;
      starting=true;setSt({phase:'loading'});
      try{
        const r=await initCloud(session.user);
        if(r.blocked){setSt({phase:'out',msg:'Conta bloqueada pelo Mestre.'});await sb.auth.signOut()}
        else{loaded=session.user.id;setSt({phase:'in'})}
      }catch(e){setSt({phase:'error',msg:e.message||'Erro ao carregar os dados.'})}
      starting=false;
    };
    sb.auth.getSession().then(({data})=>start(data.session));
    const {data:sub}=sb.auth.onAuthStateChange((ev,session)=>{if(ev==='SIGNED_OUT')start(null);else if(ev==='SIGNED_IN')start(session)});
    return()=>sub.subscription.unsubscribe();
  },[]);
  if(st.phase==='out')return <Login msg={st.msg}/>;
  if(st.phase==='error')return <div className="login"><div className="panel"><h1>⚔️ Fichas de RPG</h1><div className="err">{st.msg}</div>
    <button className="btn big" onClick={()=>location.reload()}>TENTAR DE NOVO</button><button className="btn sm" onClick={()=>signOutCloud()}>Sair</button></div></div>;
  if(st.phase!=='in')return <div className="login"><div className="panel"><h1>⚔️ Fichas de RPG</h1><p>Carregando…</p></div></div>;
  return <Main/>;
}

function Banner(){
  const s=useSyncExternalStore(subscribeStat,getStat);
  if(!s.error&&!s.saving)return null;
  return <div style={{position:'fixed',right:12,bottom:12,zIndex:99,padding:'6px 12px',borderRadius:8,fontSize:13,background:s.error?'#7a1f1f':'#222',color:'#fff',opacity:.92}}>{s.error||'☁️ Salvando…'}</div>;
}

function Main(){
  const db=useSyncExternalStore(subscribe,getDb);
  const [view,setView]=useState('home'),[cur,setCur]=useState(null),[pid,setPid]=useState(null),[intent,setIntent]=useState(null);
  const upd=fn=>update(fn);
  const user=db?.users.find(u=>u.id===db.session&&u.active);
  // Conta bloqueada (ou removida) pelo Mestre perde o acesso na hora.
  useEffect(()=>{if(db&&!user)signOutCloud()},[db,user]);
  if(!db||!user)return <div className="login"><div className="panel"><p>Carregando…</p></div></div>;
  const signOut=()=>signOutCloud();
  const extra={signOut,addPlayer:addPlayerCloud,resetPassword:resetPlayerPassword,changePassword:changeMyPassword};
  const isM=user.role==='master',sdb=scope(db,user);
  if(!sdb)return <Ctx.Provider value={{db,raw:db,user,isM,upd,...extra}}><CampaignSelect/><Banner/></Ctx.Provider>;
  const c=sdb.campaign;
  const cv=MV.includes(view)&&!isM?'home':view; // jogador nunca renderiza telas do Mestre
  const unread=(sdb.notes||[]).filter(n=>n.to===user.id&&!n.read).length;
  const open=(id,tab)=>setCur({id,tab});
  const go=(v,i=null)=>{setCur(null);setIntent(i);setView(MV.includes(v)&&!isM?'home':v)};
  const showProfile=id=>{setPid(id);go('profile')};
  const out=()=>{setCur(null);setView('home');upd(d=>{d.active=null})};
  const page={home:<P.Home/>,sheets:<P.Library/>,templates:<P.Templates/>,skills:<P.Overview kind="skills"/>,items:<P.Overview kind="items"/>,tree:<TreesPage/>,
    dice:<Dice/>,diary:<Diary/>,notes:<Notifications/>,profile:<Profile uid={pid}/>,master:<Master/>,players:<P.Players/>,perms:<P.Perms/>,campaign:<CampaignSettings/>}[cv];
  return <Ctx.Provider value={{db:sdb,raw:db,camp:c,user,isM,upd,open,go,showProfile,intent,out,...extra}}><div className="app" style={{'--c1':c.color,'--c2':c.color2}}>
    <aside><div className="logo">⚔️ <span>Fichas</span></div>
      {[...NAV,...(isM?[['master','👑','Painel do Mestre']]:[])].map(([k,i,l])=><button key={k} className={(cv===k||(k==='master'&&MV.includes(cv)))&&!cur?'on':''} onClick={()=>{setPid(null);go(k)}}><span>{i}</span><em>{l}</em></button>)}
      <div className="me">{isM?'👑':'🛡️'} {user.display||user.name}<button onClick={signOut}>Sair</button></div></aside>
    <main><div className="topbar"><button className="campbar" onClick={out} title="Trocar de campanha">🌍 {c.name} · trocar</button>
      <button onClick={()=>go('notes')}>🔔{unread>0&&<b>{unread}</b>}</button></div>
      {cur?<Sheet key={cur.id} id={cur.id} tab0={cur.tab} back={()=>setCur(null)}/>:page}</main><Banner/></div></Ctx.Provider>;
}
