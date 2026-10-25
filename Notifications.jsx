import {useApp} from './ctx.js';
import {ago} from './dice.js';
export default function Notifications(){
  const {db,user,upd}=useApp();
  const L=(db.notes||[]).filter(n=>n.to===user.id);
  const mark=id=>upd(d=>{d.notes.forEach(n=>{if(n.to===user.id&&(!id||n.id===id))n.read=true})});
  return <div><h2>🔔 Notificações</h2>
    {L.some(n=>!n.read)&&<button className="btn sm" onClick={()=>mark()}>Marcar todas como lidas</button>}
    {L.map(n=><div key={n.id} className={'panel note'+(n.read?' read':'')} onClick={()=>mark(n.id)}><span>{n.read?'○':'●'} {n.text}</span><small>{ago(n.at)}</small></div>)}
    {!L.length&&<p className="empty">Sem notificações. O Mestre avisa aqui quando liberar habilidades ou entregar itens.</p>}</div>;
}
