import {useApp} from './ctx.js';
import {readImage} from './storage.js';
import {Settings} from './Pages.jsx';
export default function Profile({uid}){
  const {raw,user,isM,upd,camp}=useApp();
  const id=uid||user.id,u=raw.users.find(x=>x.id===id);if(!u)return null;
  const me=id===user.id;
  const camps=raw.campaigns.filter(c=>(isM?c.owner===user.id:c.members.includes(user.id))&&(c.owner===id||c.members.includes(id)));
  const ids=new Set(camps.map(c=>c.id));
  const sh=raw.sheets.filter(s=>!s.isTemplate&&s.owner===id&&ids.has(s.campaignId));
  const sum=f=>sh.reduce((a,s)=>a+f(s),0);
  const set=(k,v)=>me&&upd(d=>{d.users.find(x=>x.id===id)[k]=v});
  return <div><h2>👤 Perfil</h2><div className="panel prof" style={{borderColor:camp.color}}>
    <div className="frame" style={{'--fr':camp.color}}>{u.photo?<img src={u.photo} alt=""/>:<span>🧙</span>}</div>
    {me&&<label className="btn sm">🖼️ Foto<input hidden type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];f&&readImage(f,x=>set('photo',x),320);e.target.value=''}}/></label>}
    {me?<input className="big c" placeholder={u.name} value={u.display||''} onChange={e=>set('display',e.target.value)}/>:<h2>{u.display||u.name}</h2>}
    <small>{u.role==='master'?'👑 Mestre':'🛡️ Jogador'} · login: {u.name}</small>
    {me?<textarea rows={3} placeholder="Descrição / sobre mim" value={u.bio||''} onChange={e=>set('bio',e.target.value)}/>:<p className="txt">{u.bio||'Sem descrição.'}</p>}</div>
    <div className="stats"><div className="panel">🎭 Fichas <b>{sh.length}</b></div><div className="panel">🎒 Itens <b>{sum(s=>s.items.length)}</b></div>
      <div className="panel">⚔️ Habilidades <b>{sum(s=>s.skills.filter(k=>k.on).length)}</b></div><div className="panel">📚 Campanhas <b>{camps.length}</b></div></div>
    {me&&<Settings/>}</div>;
}
