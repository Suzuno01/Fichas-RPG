import {useApp} from './ctx.js';
export default function Master(){
  const {db,camp,go,showProfile}=useApp();
  const real=db.sheets.filter(s=>!s.isTemplate),pl=db.users.filter(u=>u.role==='player');
  const cnt=a=>real.reduce((n,s)=>n+s[a].length,0);
  const cards=[['👥','JOGADORES',pl.length+' jogadores','players'],['📜','FICHAS',real.length+' fichas','sheets'],['📚','MODELOS',(db.sheets.length-real.length)+' modelos','templates'],
    ['⚔️','HABILIDADES',cnt('skills')+' habilidades','skills'],['🌳','ÁRVORE',(db.trees||[]).reduce((n,t)=>n+t.nodes.length,0)+' nós · '+(db.trees||[]).length+' árvores','tree'],['📖','DIÁRIO',(db.diary||[]).length+' capítulos','diary'],
    ['🛡️','PERMISSÕES','Controle dos jogadores','perms'],['⚙️','CAMPANHA','Configurações','campaign']];
  const qa=[['＋ NOVA FICHA','sheets','new'],['＋ NOVO JOGADOR','players'],['＋ NOVO MODELO','templates'],['＋ NOVA HABILIDADE','skills'],['＋ NOVO CAPÍTULO','diary']];
  return <div><h2>👑 Painel do Mestre</h2><p className="sub">🌍 {camp.name}</p>
    <div className="qa">{qa.map(([l,v,i])=><button key={l} className="btn" onClick={()=>go(v,i)}>{l}</button>)}</div>
    <div className="mgrid">{cards.map(([i,t,s,v])=><div key={v} className="panel mcard" onClick={()=>go(v)}>{i} {t}<b>{s}</b></div>)}</div>
    <h3>Jogadores</h3>
    {pl.map(u=><div key={u.id} className="panel hrow"><b>{u.display||u.name}</b><span>{real.filter(s=>s.owner===u.id).length} fichas</span>
      <span>{u.active?'🟢 Ativo':'🔴 Bloqueado'}</span><small>{u.last?new Date(u.last).toLocaleString('pt-BR'):'sem acesso'}</small>
      <button className="btn sm" onClick={()=>showProfile(u.id)}>VER PERFIL</button></div>)}
    {!pl.length&&<p className="empty">Nenhum jogador nesta campanha ainda.</p>}</div>;
}
