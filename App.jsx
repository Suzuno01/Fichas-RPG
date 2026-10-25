import {useState} from 'react';
import {Ctx} from './ctx.js';
import {loadDB,saveDB,migrate} from './storage.js';
import Login from './Login.jsx';
import {scope,mutate} from './repo.js';
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
  const [db,setDb]=useState(loadDB);
  const [view,setView]=useState('home'),[cur,setCur]=useState(null),[pid,setPid]=useState(null),[intent,setIntent]=useState(null);
  const upd=fn=>setDb(p=>{const n=structuredClone(p);mutate(n,fn);saveDB(n);return n});
  // Importar backup na tela de login (aparelho novo): carrega os dados e exige novo login.
  const replace=j=>setDb(()=>{const n=migrate({sheets:[],...j});n.session=null;n.active=null;saveDB(n);return n});
  // Conta bloqueada ou removida pelo Mestre perde o acesso na hora.
  const user=db.users.find(u=>u.id===db.session&&u.active);
  if(!user)return <Login db={db} upd={upd} replace={replace}/>;
  const isM=user.role==='master',sdb=scope(db,user);
  if(!sdb)return <Ctx.Provider value={{db,raw:db,user,isM,upd}}><CampaignSelect/></Ctx.Provider>;
  const c=sdb.campaign;
  const cv=MV.includes(view)&&!isM?'home':view; // jogador nunca renderiza telas do Mestre
  const unread=(sdb.notes||[]).filter(n=>n.to===user.id&&!n.read).length;
  const open=(id,tab)=>setCur({id,tab});
  const go=(v,i=null)=>{setCur(null);setIntent(i);setView(MV.includes(v)&&!isM?'home':v)};
  const showProfile=id=>{setPid(id);go('profile')};
  const out=()=>{setCur(null);setView('home');upd(d=>{d.active=null})};
  const page={home:<P.Home/>,sheets:<P.Library/>,templates:<P.Templates/>,skills:<P.Overview kind="skills"/>,items:<P.Overview kind="items"/>,tree:<TreesPage/>,
    dice:<Dice/>,diary:<Diary/>,notes:<Notifications/>,profile:<Profile uid={pid}/>,master:<Master/>,players:<P.Players/>,perms:<P.Perms/>,campaign:<CampaignSettings/>}[cv];
  return <Ctx.Provider value={{db:sdb,raw:db,camp:c,user,isM,upd,open,go,showProfile,intent,out}}><div className="app" style={{'--c1':c.color,'--c2':c.color2}}>
    <aside><div className="logo">⚔️ <span>Fichas</span></div>
      {[...NAV,...(isM?[['master','👑','Painel do Mestre']]:[])].map(([k,i,l])=><button key={k} className={(cv===k||(k==='master'&&MV.includes(cv)))&&!cur?'on':''} onClick={()=>{setPid(null);go(k)}}><span>{i}</span><em>{l}</em></button>)}
      <div className="me">{isM?'👑':'🛡️'} {user.display||user.name}<button onClick={()=>upd(d=>{d.session=null})}>Sair</button></div></aside>
    <main><div className="topbar"><button className="campbar" onClick={out} title="Trocar de campanha">🌍 {c.name} · trocar</button>
      <button onClick={()=>go('notes')}>🔔{unread>0&&<b>{unread}</b>}</button></div>
      {cur?<Sheet key={cur.id} id={cur.id} tab0={cur.tab} back={()=>setCur(null)}/>:page}</main></div></Ctx.Provider>;
}
