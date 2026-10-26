// Camada de nuvem (Supabase): login, carregamento, sincronização por registro e tempo real.
// A chave abaixo é a chave PÚBLICA (anon). Ela pode ficar no código: quem protege os dados são as regras (RLS) do banco.
import {createClient} from '@supabase/supabase-js';
import {mutate,campaignsFor} from './repo.js';
import {migrate,empty} from './storage.js';

export const SB_URL='https://axwcpvtwjvgvlxvgfnxd.supabase.co';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4d2NwdnR3anZndmx4dmdmbnhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MjI4NTcsImV4cCI6MjEwNjM5ODg1N30.AZ2Efy1gQHjGo5flqQxCo1H1s59EHVMPv5EsQJm-CVo';
export const sb=createClient(SB_URL,KEY);
export const KINDS=['sheets','rolls','notes','diary','trees'];
const J=JSON.stringify;
const pick=(o,ex)=>Object.fromEntries(Object.entries(o).filter(([k])=>!ex.includes(k)));
const UFIX=['id','name','role','active','last'];

// ---------- conversões banco <-> app ----------
const userFrom=r=>({...r.data,id:r.id,name:r.login,role:r.role,active:r.active,last:r.last});
const campFrom=r=>({...r.data,id:r.id,owner:r.owner,members:r.members||[]});
const campRow=(c,by)=>({id:c.id,owner:c.owner,members:c.members||[],data:pick(c,['id','owner','members']),updated_by:by});
const recFrom=r=>({...r.data,id:r.id,campaignId:r.campaign_id});
const recRow=(k,x,by)=>({id:x.id,campaign_id:x.campaignId,kind:k,data:x,updated_by:by,updated_at:new Date().toISOString()});
const byAtDesc=(a,b)=>String(b.at||'').localeCompare(String(a.at||''));

// ---------- estado local (espelha o banco) ----------
let cur=null,snap=null,me=null,isMaster=false;
const subs=new Set(),statSubs=new Set();
let stat={saving:false,error:''};
const emit=()=>subs.forEach(f=>f());
const setStat=s=>{stat={...stat,...s};statSubs.forEach(f=>f())};
export const getDb=()=>cur;
export const subscribe=f=>{subs.add(f);return()=>subs.delete(f)};
export const getStat=()=>stat;
export const subscribeStat=f=>{statSubs.add(f);return()=>statSubs.delete(f)};

// ---------- fila de gravação ----------
const pend=new Map();let dTimer=null,rTimer=null,dirty=false,flushing=false;
const queue=(op,table,id,row)=>{pend.set(table+':'+id,{op,table,id,row})};
export const hasPending=()=>dirty||pend.size>0||flushing;

function diffDb(a,b){
  KINDS.forEach(k=>{
    const A=new Map((a[k]||[]).map(x=>[x.id,x])),B=new Map((b[k]||[]).map(x=>[x.id,x]));
    B.forEach((x,id)=>{const o=A.get(id);if(x.campaignId&&(!o||J(o)!==J(x)))queue('up','records',id,recRow(k,x,me))});
    A.forEach((x,id)=>{if(!B.has(id))queue('del','records',id)});
  });
  const A=new Map((a.campaigns||[]).map(x=>[x.id,x])),B=new Map((b.campaigns||[]).map(x=>[x.id,x]));
  B.forEach((x,id)=>{const o=A.get(id);if(!o||J(o)!==J(x))queue('up','campaigns',id,campRow(x,me))});
  A.forEach((x,id)=>{if(!B.has(id))queue('del','campaigns',id)});
  const UA=new Map((a.users||[]).map(x=>[x.id,x]));
  (b.users||[]).forEach(u=>{const o=UA.get(u.id);if(!o)return;
    const d=J(pick(u,UFIX)),od=J(pick(o,UFIX));
    if(d===od&&o.active===u.active&&o.last===u.last)return;
    const patch={data:pick(u,UFIX),updated_by:me};
    if(o.active!==u.active)patch.active=u.active;
    if(o.last!==u.last)patch.last=u.last;
    queue('upd','profiles',u.id,patch)});
}

function runDiff(){clearTimeout(dTimer);dTimer=null;if(!dirty||!cur||!snap)return flush();diffDb(snap,cur);snap=cur;dirty=false;return flush()}
const schedule=()=>{dirty=true;clearTimeout(dTimer);dTimer=setTimeout(runDiff,400);setStat({saving:true})};
export const flushNow=()=>{if(dTimer)return runDiff();return flush()};

async function flush(){
  if(flushing)return;
  const items=[...pend.values()];pend.clear();
  if(!items.length){setStat({saving:false});return}
  flushing=true;const failed=[];
  const of=(op,t)=>items.filter(i=>i.op===op&&i.table===t);
  const upsert=async(table,list)=>{
    if(!list.length)return;
    const r=await sb.from(table).upsert(list.map(i=>i.row));
    if(!r.error)return;
    for(const i of list){const x=await sb.from(table).upsert(i.row);if(x.error)failed.push([i,x.error])}};
  try{
    await upsert('campaigns',of('up','campaigns'));
    for(const i of of('upd','profiles')){const r=await sb.from('profiles').update(i.row).eq('id',i.id);if(r.error)failed.push([i,r.error])}
    await upsert('records',of('up','records'));
    for(const t of ['records','campaigns']){
      const ids=of('del',t).map(i=>i.id);
      if(ids.length){const r=await sb.from(t).delete().in('id',ids);if(r.error)failed.push([of('del',t)[0],r.error])}}
  }catch(e){items.forEach(i=>failed.push([i,e]))}
  flushing=false;
  let msg='';
  failed.forEach(([i,e])=>{
    const permanent=e.code&&!String(e.code).startsWith('5')&&e.code!=='PGRST301'&&e.code!=='PGRST000';
    if(permanent){msg='Alguma alteração não foi salva ('+(e.message||e.code)+').'}
    else if(!pend.has(i.table+':'+i.id)){pend.set(i.table+':'+i.id,i);msg='Sem conexão com o servidor. Tentando salvar de novo…'}});
  if(pend.size){clearTimeout(rTimer);rTimer=setTimeout(flush,5000)}
  setStat({saving:pend.size>0||dirty,error:msg});
}

// ---------- alteração local (usada por todas as telas) ----------
export function update(fn){
  if(!cur)return;
  const n=structuredClone(cur);mutate(n,fn);
  if(n.active!==cur.active&&me){try{n.active?localStorage.setItem('fichas-ativa-'+me,n.active):localStorage.removeItem('fichas-ativa-'+me)}catch{}}
  cur=n;emit();schedule();
}
// Alteração que veio do servidor: entra no espelho e no instantâneo, sem voltar para o banco.
function patchRemote(fn){
  const same=snap===cur,a=structuredClone(cur);fn(a);
  if(same){cur=snap=a}else{const b=structuredClone(snap);fn(b);cur=a;snap=b}
  emit();
}

// ---------- carregamento ----------
async function all(table){
  let out=[],from=0;
  for(;;){const {data,error}=await sb.from(table).select('*').order('id').range(from,from+999);
    if(error)throw error;out=out.concat(data);if(data.length<1000)break;from+=1000}
  return out;
}
async function loadRaw(uid){
  const [pr,ca,re]=await Promise.all([all('profiles'),all('campaigns'),all('records')]);
  const db=empty();delete db.campaign;
  db.users=pr.map(userFrom);db.campaigns=ca.map(campFrom);db.session=uid;db.active=null;
  KINDS.forEach(k=>{db[k]=[]});
  re.forEach(r=>(db[r.kind]||(db[r.kind]=[])).push(recFrom(r)));
  db.rolls.sort(byAtDesc);db.notes.sort(byAtDesc);
  return db;
}
function boot(raw,uid,master,active){
  me=uid;isMaster=master;
  const m=migrate(structuredClone(raw));
  const u=m.users.find(x=>x.id===uid);
  if(u)m.active=active??null;
  if(m.active&&!campaignsFor(m,u).some(c=>c.id===m.active))m.active=null;
  if(!m.active&&u){
    let saved=null;try{saved=localStorage.getItem('fichas-ativa-'+uid)}catch{}
    const cs=campaignsFor(m,u);
    m.active=cs.find(c=>c.id===saved)?.id??((u.role==='player'&&cs.length===1)?cs[0].id:null);
  }
  cur=m;snap=master?raw:m;     // Mestre: migrações do app (ex.: layouts) também são enviadas ao banco
  emit();if(master){dirty=true;schedule()}
}
export async function initCloud(user){
  const raw=await loadRaw(user.id);
  const u=raw.users.find(x=>x.id===user.id);
  if(!u)throw new Error('Seu perfil não foi encontrado. Fale com o Mestre.');
  if(!u.active)return {blocked:true};
  boot(raw,user.id,u.role==='master');
  const t=new Date().toISOString();
  patchRemote(d=>{const x=d.users.find(y=>y.id===user.id);if(x)x.last=t});
  sb.from('profiles').update({last:t,updated_by:user.id}).eq('id',user.id).then(()=>{});
  startRealtime();
  return {};
}
async function resync(){
  if(!me||hasPending())return;
  try{const raw=await loadRaw(me);if(hasPending())return;boot(raw,me,isMaster,cur?.active)}catch{}
}

// ---------- tempo real ----------
let ch=null;
// Eventos do tempo real podem vir sem o conteúdo (registros grandes): nesse caso busca a linha completa.
async function fullRow(table,r){
  if(r&&r.data!==undefined)return r;
  const {data}=await sb.from(table).select('*').eq('id',r.id).maybeSingle();
  return data||null;
}
function startRealtime(){
  stopRealtime();
  ch=sb.channel('fichas-rpg')
    .on('postgres_changes',{event:'*',schema:'public',table:'records'},async p=>{
      if(p.eventType==='DELETE'){const id=p.old?.id;if(id)patchRemote(d=>{KINDS.forEach(k=>{d[k]=(d[k]||[]).filter(x=>x.id!==id)})});return}
      let r=p.new;if(!r||r.updated_by===me)return;
      r=await fullRow('records',r);if(!r)return;
      const x=recFrom(r);
      patchRemote(d=>{const a=(d[r.kind]??=[]),i=a.findIndex(y=>y.id===x.id);
        if(i>=0)a[i]=x;else if(r.kind==='rolls'||r.kind==='notes')a.unshift(x);else a.push(x)});
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'campaigns'},async p=>{
      if(p.eventType==='DELETE'){const id=p.old?.id;if(id)patchRemote(d=>{d.campaigns=d.campaigns.filter(c=>c.id!==id);KINDS.forEach(k=>{d[k]=(d[k]||[]).filter(x=>x.campaignId!==id)});if(d.active===id)d.active=null});return}
      let r=p.new;if(!r||r.updated_by===me)return;
      r=await fullRow('campaigns',r);if(!r)return;
      const c=campFrom(r),known=cur.campaigns.some(x=>x.id===c.id);
      patchRemote(d=>{const i=d.campaigns.findIndex(x=>x.id===c.id);if(i>=0)d.campaigns[i]=c;else d.campaigns.push(c)});
      if(!known){ // fui adicionado a uma campanha nova: busca as fichas dela
        const {data}=await sb.from('records').select('*').eq('campaign_id',c.id);
        if(data)patchRemote(d=>{data.forEach(r2=>{const a=(d[r2.kind]??=[]);if(!a.some(y=>y.id===r2.id))a.push(recFrom(r2))})})}
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},async p=>{
      if(p.eventType==='DELETE')return;
      let r=p.new;if(!r||r.updated_by===me)return;
      r=await fullRow('profiles',r);if(!r)return;
      const u=userFrom(r);
      patchRemote(d=>{const i=d.users.findIndex(x=>x.id===u.id);if(i>=0)d.users[i]=u;else d.users.push(u)});
    })
    .subscribe();
}
function stopRealtime(){if(ch){sb.removeChannel(ch);ch=null}}

// ---------- login e administração de contas ----------
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9._-]+/g,'_').slice(0,60);
const toEmail=l=>slug(l)+'@fichas-rpg.app';

export async function hasMaster(){
  const {data,error}=await sb.rpc('has_master');
  if(error)throw new Error('Não foi possível conectar ao servidor.');
  return !!data;
}
export async function signIn(login,pass){
  const {data,error}=await sb.auth.signInWithPassword({email:toEmail(login),password:pass});
  if(error)throw new Error(/network|fetch/i.test(error.message)?'Não foi possível conectar ao servidor.':'Login ou senha incorretos.');
  return data.user;
}
async function admin(body){
  const {data}=await sb.auth.getSession();
  let res;
  try{res=await fetch(SB_URL+'/functions/v1/admin-users',{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+(data.session?.access_token||KEY)},body:JSON.stringify(body)})}
  catch{throw new Error('Não foi possível conectar ao servidor.')}
  const j=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(j.error||'Erro no servidor.');
  return j;
}
export async function bootstrapMaster(login,pass){await admin({action:'bootstrap',login,password:pass});return signIn(login,pass)}
export async function addPlayerCloud(login,pass){
  const {profile}=await admin({action:'create_player',login,password:pass});
  const u=userFrom({...profile,data:profile.data||{}});
  patchRemote(d=>{if(!d.users.some(x=>x.id===u.id))d.users.push(u)});
  update(d=>{const c=d.campaign;if(c&&!c.members.includes(u.id))c.members.push(u.id)});
  return u;
}
export const resetPlayerPassword=(user_id,password)=>admin({action:'set_password',user_id,password});
export async function changeMyPassword(password){
  const {error}=await sb.auth.updateUser({password});
  if(error)throw new Error(error.message||'Não foi possível alterar a senha.');
}
export async function signOutCloud(){
  stopRealtime();
  try{await flushNow()}catch{}
  cur=snap=null;me=null;
  await sb.auth.signOut();
}
export function clearCloud(){stopRealtime();cur=snap=null;me=null;emit()}

// ---------- segurança de dados ao fechar/ocultar a aba ----------
let hiddenAt=0;
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenAt=Date.now();flushNow()}
    else if(me&&hiddenAt&&Date.now()-hiddenAt>120000)resync();
  });
  window.addEventListener('beforeunload',e=>{if(hasPending()){flushNow();e.preventDefault();e.returnValue=''}});
}
