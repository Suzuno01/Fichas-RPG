// Lógica pura da árvore de habilidades avançada (sem React / sem DOM): requisitos, pontos, desbloqueio, reset e migração.
// Modelo:
//  db.trees[]  (por campanha): {id,campaignId,name,icon,color,desc,nodes:[nó]}
//  nó: {id,name,desc,icon,img,color,type,cost,x,y,conn:[idsAnteriores],reqs:[{id,kind,...}],mode:'all'|'any'}
//  ficha.level, ficha.marks[{id,name,at}]  (Condições/Marcas — separadas de status/recursos)
//  ficha.treeProg: {points, trees:[idsAtribuídos], unlocked:{[nodeId]:{at,by,master,cost}}}  (progresso individual)
const rid=()=>Math.random().toString(36).slice(2,10);
const now=()=>new Date().toISOString();
const nm=s=>String(s??'').trim().toLowerCase();
export const REQ={level:'Nível mínimo',attr:'Atributo',skill:'Habilidade possuída',item:'Item possuído',mark:'Condição/Marca',node:'Habilidade anterior'};
export const STATE={done:'Desbloqueada',open:'Disponível',lock:'Bloqueada'};
export const TYPES=['Ativa','Passiva','Magia','Bônus','Técnica','Outro'];

export const getProg=s=>({points:+s?.treeProg?.points||0,trees:s?.treeProg?.trees||[],unlocked:s?.treeProg?.unlocked||{}});
export const levelOf=s=>{const l=parseInt(s?.level,10);return Number.isNaN(l)?1:l};
// Garante os campos novos na ficha (muta a ficha).
export function normProg(s){const p=(s.treeProg??={});p.points=+p.points||0;p.trees??=[];p.unlocked??={};s.level=levelOf(s);s.marks??=[];return p}

export const newNode=(x=0,y=0)=>({id:rid(),name:'Nova habilidade',desc:'',icon:'✨',img:'',color:'',type:'Ativa',cost:1,x,y,conn:[],reqs:[],mode:'all'});
export const newTree=(campaignId,name='Nova árvore')=>({id:rid(),campaignId,name,desc:'',icon:'🌳',color:'#d4a34a',nodes:[],created:now()});
export const newReq=kind=>({id:rid(),kind,...(kind==='level'?{min:1}:kind==='attr'?{name:'',min:10}:kind==='node'?{node:''}:{name:''})});

export function checkReq(s,tree,q,p=getProg(s)){
  if(q.kind==='level'){const L=levelOf(s);return {id:q.id,kind:q.kind,ok:L>=+q.min,label:`Nível ${q.min}`,hint:`Seu nível é ${L}; é preciso nível ${q.min}.`}}
  if(q.kind==='attr'){const a=(s.attrs||[]).find(x=>nm(x.name)===nm(q.name)),v=a?+a.value:null;
    return {id:q.id,kind:q.kind,ok:v!=null&&v>=+q.min,label:`${q.name} ${q.min}`,hint:a?`${q.name} é ${v}; é preciso ${q.min}.`:`Esta ficha não tem o atributo ${q.name}.`}}
  if(q.kind==='skill')return {id:q.id,kind:q.kind,ok:(s.skills||[]).some(k=>nm(k.name)===nm(q.name)&&k.on),label:`Habilidade: ${q.name}`,hint:`Você precisa possuir a habilidade ${q.name}.`};
  if(q.kind==='item')return {id:q.id,kind:q.kind,ok:(s.items||[]).some(i=>nm(i.name)===nm(q.name)&&(i.qty==null||i.qty===''||+i.qty>0)),label:`Item: ${q.name}`,hint:`Você precisa possuir o item ${q.name}.`};
  if(q.kind==='mark')return {id:q.id,kind:q.kind,ok:(s.marks||[]).some(m=>nm(m.name)===nm(q.name)),label:`Condição: ${q.name}`,hint:`Você precisa ter a condição/marca ${q.name}.`};
  if(q.kind==='node'){const n=(tree.nodes||[]).find(x=>x.id===q.node);if(!n)return null;
    return {id:q.id,kind:q.kind,ok:!!p.unlocked[n.id],label:n.name,hint:`Você precisa desbloquear ${n.name}.`}}
  return null;
}
export function evalNode(s,tree,node){
  const p=getProg(s),entry=p.unlocked[node.id]||null,checks=(node.reqs||[]).map(q=>checkReq(s,tree,q,p)).filter(Boolean);
  const mode=node.mode==='any'?'any':'all',met=!checks.length||(mode==='any'?checks.some(c=>c.ok):checks.every(c=>c.ok));
  return {state:entry?'done':met?'open':'lock',checks,mode,met,entry};
}
export const costOf=n=>Math.max(0,Math.floor(+n.cost||0));
const assigned=(s,tree)=>getProg(s).trees.includes(tree.id);

// Jogador desbloqueando com pontos. Muta a ficha só se ok.
export function unlock(s,tree,node,by){
  if(!assigned(s,tree))return {ok:false,reason:'Esta árvore não está atribuída à ficha.'};
  const e=evalNode(s,tree,node),cost=costOf(node);
  if(e.entry)return {ok:false,reason:'Esta habilidade já está desbloqueada.'};
  if(!e.met)return {ok:false,reason:'Requisitos não cumpridos.'};
  const p=normProg(s);if(p.points<cost)return {ok:false,reason:'Pontos insuficientes.'};
  p.points-=cost;p.unlocked[node.id]={at:now(),by,master:false,cost};return {ok:true,cost};
}
// Mestre libera ignorando requisitos e pontos.
export function release(s,tree,node,by){
  if(!assigned(s,tree))return {ok:false,reason:'Esta árvore não está atribuída à ficha.'};
  const p=normProg(s);if(p.unlocked[node.id])return {ok:false,reason:'Esta habilidade já está desbloqueada.'};
  p.unlocked[node.id]={at:now(),by,master:true,cost:0};return {ok:true};
}
// Bloqueia uma habilidade; devolve os pontos gastos (liberações do Mestre não custaram pontos).
export function lock(s,tree,node){
  const p=normProg(s),e=p.unlocked[node.id];if(!e)return {ok:false,reason:'Esta habilidade não está desbloqueada.'};
  const refund=e.master?0:(+e.cost||0);p.points+=refund;delete p.unlocked[node.id];
  const deps=tree.nodes.filter(n=>p.unlocked[n.id]&&(n.reqs||[]).some(q=>q.kind==='node'&&q.node===node.id)).map(n=>n.name);
  return {ok:true,refund,deps};
}
export function previewReset(s,tree){
  const p=getProg(s),nodes=tree.nodes.filter(n=>p.unlocked[n.id]);
  return {nodes,refund:nodes.reduce((a,n)=>a+(p.unlocked[n.id].master?0:(+p.unlocked[n.id].cost||0)),0)};
}
export function resetTree(s,tree){const pv=previewReset(s,tree),p=normProg(s);pv.nodes.forEach(n=>delete p.unlocked[n.id]);p.points+=pv.refund;return pv}
export const progressCount=(s,tree)=>{const p=getProg(s);return {done:tree.nodes.filter(n=>p.unlocked[n.id]).length,total:tree.nodes.length}};
// Remove nós/árvores apagados dos progressos das fichas (devolvendo pontos gastos). Retorna {sheets,refund}.
export function purgeNodes(sheets,nodeIds){
  const ids=new Set(nodeIds);let sh=0,refund=0;
  sheets.forEach(s=>{const p=s.treeProg;if(!p?.unlocked)return;let hit=false;
    Object.keys(p.unlocked).forEach(k=>{if(ids.has(k)){const e=p.unlocked[k];if(!e.master){p.points=(+p.points||0)+(+e.cost||0);refund+=+e.cost||0}delete p.unlocked[k];hit=true}});if(hit)sh++});
  return {sheets:sh,refund};
}
export const countUnlocked=(sheets,nodeIds)=>{const ids=new Set(nodeIds);return sheets.filter(s=>Object.keys(s.treeProg?.unlocked||{}).some(k=>ids.has(k))).length};

// Defesa no momento da gravação para jogadores (a UI já esconde, aqui é imposto de verdade):
// nível, marcas e árvores atribuídas só o Mestre muda; pontos/desbloqueios só mudam por um desbloqueio válido.
export function guardProg(old,x,trees,{mine,allow}){
  x.level=levelOf(old);x.marks=old.marks??[];const o=getProg(old),p=normProg(x);p.trees=[...o.trees];
  const added=Object.keys(p.unlocked).filter(k=>!o.unlocked[k]),removed=Object.keys(o.unlocked).filter(k=>!p.unlocked[k]);
  if(!added.length&&!removed.length&&p.points===o.points)return;
  const bad=()=>{x.treeProg=structuredClone(old.treeProg??{points:0,trees:[],unlocked:{}});normProg(x)};
  if(removed.length||added.length!==1||!mine||!allow)return bad();
  const id=added[0],tree=trees.find(t=>o.trees.includes(t.id)&&t.nodes.some(n=>n.id===id));if(!tree)return bad();
  const node=tree.nodes.find(n=>n.id===id),e=evalNode(old,tree,node),cost=costOf(node),u=p.unlocked[id];
  if(!e.met||o.points<cost||p.points!==o.points-cost||u.master||(+u.cost||0)!==cost)return bad();
  // ok: unlock legítimo
}

// ---------- Migração: ficha.tree (antiga, por ficha) -> db.trees + ficha.treeProg ----------
const sig=L=>JSON.stringify(L.map(n=>[n.id,n.name||'',n.desc||'',[...(n.req||[])].sort()]));
function layout(L){const lv={};const get=(n,seen=[])=>{if(lv[n.id]!=null)return lv[n.id];if(seen.includes(n.id))return 0;
  const r=(n.req||[]).map(q=>L.find(x=>x.id===q)).filter(Boolean);return lv[n.id]=r.length?1+Math.max(...r.map(p=>get(p,[...seen,n.id]))):0};
  L.forEach(n=>get(n));const rows={};L.forEach(n=>(rows[lv[n.id]]??=[]).push(n));const pos={};
  Object.entries(rows).forEach(([l,r])=>r.forEach((n,i)=>{pos[n.id]={x:Math.round((i-(r.length-1)/2)*200),y:l*170}}));return pos}
// Idempotente: cada ficha é marcada com treeMigV=1. A ficha antiga (s.tree) NUNCA é apagada.
// Fichas só compartilham árvore se a estrutura (ids, nomes, descrições, dependências) for idêntica; qualquer diferença => árvore separada.
export function migrateTrees(d){
  d.trees??=[];const groups=new Map();
  (d.sheets||[]).forEach(s=>{if(s.treeMigV)return;normProg(s);const L=Array.isArray(s.tree)?s.tree:[];
    if(!L.length){s.treeMigV=1;return}
    if(!s.campaignId)return; // será migrada depois que receber campanha
    const k=s.campaignId+'|'+sig(L);(groups.get(k)||groups.set(k,[]).get(k)).push(s)});
  groups.forEach(list=>{
    const s0=list[0],L=s0.tree,tpl=list.find(x=>x.isTemplate),idmap={},pos=layout(L);
    L.forEach(n=>{idmap[n.id]=rid()}); // ids novos por árvore: evita colisão entre árvores copiadas do mesmo modelo
    const tree={id:rid(),campaignId:s0.campaignId,name:'Árvore migrada — '+(tpl?tpl.name:(s0.charName||s0.name)),icon:'🌳',color:'#d4a34a',created:now(),
      desc:'Criada automaticamente a partir da árvore antiga de '+(list.length>1?list.length+' fichas idênticas':'uma ficha')+'. O progresso de cada ficha foi preservado.',
      migratedFrom:list.map(s=>s.id),
      nodes:L.map(n=>{const req=(n.req||[]).filter(r=>idmap[r]).map(r=>idmap[r]);
        return {id:idmap[n.id],name:n.name||'Habilidade',desc:n.desc||'',icon:'✨',img:'',color:'',type:'Ativa',cost:0,x:pos[n.id].x,y:pos[n.id].y,
          conn:req,reqs:req.map(r=>({id:rid(),kind:'node',node:r})),mode:'all'}})};
    d.trees.push(tree);
    list.forEach(s=>{const p=normProg(s);p.trees.push(tree.id);
      s.tree.forEach(n=>{if(n.done&&idmap[n.id])p.unlocked[idmap[n.id]]={at:s.updated||now(),by:null,master:true,cost:0,legacy:true}});s.treeMigV=1})});
  return d;
}
