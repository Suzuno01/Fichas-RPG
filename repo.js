// Camada de acesso aos dados por campanha. Na Etapa 2 (Supabase) basta trocar scope/mutate por consultas ao banco.
import {migrate} from './storage.js';
import {migrateTrees} from './treeLogic.js';
import {migrateLayouts} from './layoutLogic.js';
export const PER_CAMPAIGN=['sheets','rolls','notes','diary','trees'];
export const campaignsFor=(db,u)=>(db.campaigns||[]).filter(c=>u.role==='master'?c.owner===u.id:c.members.includes(u.id));
// Visão da campanha ativa: os componentes antigos continuam lendo db.sheets, db.perms etc. sem saber que existem campanhas.
export function scope(db,u){
  const c=campaignsFor(db,u).find(x=>x.id===db.active);if(!c)return null;
  const f=a=>(a||[]).filter(x=>x.campaignId===c.id);
  return {...db,sheets:f(db.sheets),rolls:f(db.rolls),notes:f(db.notes),diary:f(db.diary),trees:f(db.trees),perms:c.perms,campaign:c,
    users:db.users.filter(x=>x.id===c.owner||c.members.includes(x.id))};
}
// Escrita: fn enxerga d.perms/d.campaign da campanha ativa; registros novos recebem campaignId; jogadores novos entram na campanha.
export function mutate(n,fn){
  const c=(n.campaigns||[]).find(x=>x.id===n.active),gp=n.perms,had=new Set(n.users.map(u=>u.id));
  if(c){n.perms=c.perms;n.campaign=c}
  fn(n);
  if(!n.campaigns){migrate(n);return}
  if(c){if(gp)n.perms=gp;else delete n.perms;delete n.campaign;
    PER_CAMPAIGN.forEach(k=>(n[k]||[]).forEach(x=>{x.campaignId??=c.id}));
    n.users.forEach(u=>{if(!had.has(u.id)&&u.role==='player'&&!c.members.includes(u.id))c.members.push(u.id)})}
  migrateTrees(n); // idempotente; também cobre backups antigos importados
  migrateLayouts(n); // idempotente (layoutV): fichas/modelos sem layout recebem o padrão; layouts existentes são preservados
}
