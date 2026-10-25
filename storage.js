// Utilitários de dados. A persistência agora é feita no Supabase (cloud.js).
import {migrateTrees} from './treeLogic.js';
import {migrateLayouts} from './layoutLogic.js';
export const uid=()=>Math.random().toString(36).slice(2,10);
export const now=()=>new Date().toISOString();
export const empty=()=>({users:[],sheets:[],session:null,campaign:{name:'Minha Campanha',notes:''},
  perms:{createSheets:true,editSheets:true,useTemplates:true,createTemplates:false,createItems:true,createSkills:false,viewTree:true,unlockTree:true}});
export const newPerms=()=>structuredClone(empty().perms);
// Migração: dados da V1/V2 (sem campanhas) viram a primeira campanha do Mestre.
export function migrate(d){migrateCampaigns(d);migrateTrees(d);migrateLayouts(d);return d}
function migrateCampaigns(d){
  if(d.campaigns)return d;
  const m=d.users.find(u=>u.role==='master'),old=d.campaign||{};d.campaigns=[];
  if(m){const id=uid();d.campaigns.push({id,owner:m.id,name:old.name||'Minha Campanha',desc:'',cover:'',color:'#b8862b',color2:'#3b2a6b',notes:old.notes||'',
    members:d.users.filter(u=>u.role==='player').map(u=>u.id),perms:d.perms||newPerms(),created:now()});
    ['sheets','rolls','notes','diary'].forEach(k=>(d[k]||[]).forEach(x=>{x.campaignId=id}))}
  delete d.campaign;d.active=null;return d}
export function readImage(file,cb,max=640){const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height));const c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let al=false;if(file.type!=='image/jpeg')for(let j=3;j<d.length;j+=4)if(d[j]<250){al=true;break}cb(al?c.toDataURL('image/png'):c.toDataURL('image/jpeg',.82))}};i.src=r.result};r.readAsDataURL(file)}
