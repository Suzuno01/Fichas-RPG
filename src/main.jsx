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

# Fichas de RPG

Sistema de fichas de RPG (React + Vite). Dados salvos no navegador (localStorage).

## Rodar localmente
```
npm install
npm run dev
```

## Build / testes
```
npm run build
npm test
```

## Deploy
Vercel: Framework Preset **Vite**, Build Command `npm run build`, Output Directory `dist`.

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

import {useState,useRef} from 'react';
import {useApp} from './ctx.js';
import {uid,now,readImage} from './storage.js';
import {calcMod} from './model.js';
import {roll,logRoll} from './dice.js';
import {guardProg} from './treeLogic.js';
import {TreeTab,ProgPanel} from './TreeView.jsx';
import {Up,Pick,Rich,Cards} from './sheetParts.jsx';
import {guardLayout,layoutOf,LAYOUT_V} from './layoutLogic.js';
import VisualCanvas from './VisualCanvas.jsx';
import VisualEditor from './VisualEditor.jsx';
export {Rich};
const SEC={fields:'dados',attrs:'atributos',status:'status',money:'dinheiro'};
const LOCK={dados:['fields'],atributos:['attrs','useMod','formula'],status:['status'],dinheiro:['money'],itens:['items'],habilidades:['skills']};

const fmt=d=>new Date(d).toLocaleDateString('pt-BR');
function Tree({s,isM,ed,notify}){
  const N=s.tree;const [sel,setSel]=useState(null);const lv={};
  const L=(n,seen=[])=>{if(lv[n.id]!=null)return lv[n.id];if(seen.includes(n.id))return 0;
    const r=n.req.map(q=>N.find(x=>x.id===q)).filter(Boolean);
    return lv[n.id]=r.length?1+Math.max(...r.map(p=>L(p,[...seen,n.id]))):0};
  N.forEach(n=>L(n));
  const rows={};N.forEach(n=>(rows[lv[n.id]]??=[]).push(n));
  const max=Math.max(0,...Object.keys(rows).map(Number)),W=Math.max(1,...Object.values(rows).map(r=>r.length))*170,H=(max+1)*110;
  const pos={};Object.entries(rows).forEach(([l,r])=>r.forEach((n,i)=>{pos[n.id]={x:(i+.5)*W/r.length,y:(max-l)*110+50}}));
  const st=n=>n.done?'done':n.req.every(r=>N.find(x=>x.id===r)?.done)?'open':'lock';
  const ico={done:'✓',open:'🔓',lock:'🔒'},lbl={done:'Liberada',open:'Disponível',lock:'Bloqueada'};
  const cur=N.find(n=>n.id===sel),ix=N.findIndex(n=>n.id===sel);
  const set=(k,v)=>ed(x=>{x.tree[ix][k]=v});
  return <div><div className="treewrap"><div className="tree" style={{width:W,height:H}}>
    <svg width={W} height={H}>{N.flatMap(n=>n.req.map(r=>pos[r]&&<line key={n.id+r} x1={pos[r].x} y1={pos[r].y} x2={pos[n.id].x} y2={pos[n.id].y} className={st(n)!=='lock'?'on':''}/>))}</svg>
    {N.map(n=><button key={n.id} className={'node '+st(n)+(sel===n.id?' sel':'')} style={{left:pos[n.id].x,top:pos[n.id].y}} onClick={()=>setSel(n.id)}>{ico[st(n)]}<span>{n.name}</span></button>)}</div></div>
    {!N.length&&<p className="empty">A árvore está vazia.</p>}
    {cur&&<div className="panel"><h3>{ico[st(cur)]} {cur.name} <small>{lbl[st(cur)]}</small></h3>
      {isM?<>
        <input value={cur.name} onChange={e=>set('name',e.target.value)}/>
        <textarea rows={3} value={cur.desc} placeholder="Descrição" onChange={e=>set('desc',e.target.value)}/>
        <b>Requisitos (dependências):</b><div className="chips">{N.filter(n=>n.id!==cur.id).map(n=><label key={n.id} className="chip"><input type="checkbox" checked={cur.req.includes(n.id)} onChange={e=>ed(x=>{const r=x.tree[ix].req;e.target.checked?r.push(n.id):r.splice(r.indexOf(n.id),1)})}/> {n.name}</label>)}</div>
        <div className="row"><button className="btn" onClick={()=>{set('done',!cur.done);!cur.done&&notify&&notify('🌳 Habilidade liberada na árvore: '+cur.name)}}>{cur.done?'🔒 Bloquear novamente':'✓ Liberar'}</button>
          <button className="x" onClick={()=>{ed(x=>{x.tree.splice(ix,1);x.tree.forEach(n=>{n.req=n.req.filter(r=>r!==cur.id)})});setSel(null)}}>🗑️</button></div></>
      :<><p className="txt">{cur.desc}</p>{cur.req.length>0&&<p className="txt"><b>Requer:</b> {cur.req.map(r=>N.find(x=>x.id===r)?.name).join(', ')}</p>}</>}</div>}
    {isM&&<button className="btn" onClick={()=>ed(x=>{x.tree.push({id:uid(),name:'Nova habilidade',desc:'',req:[],done:false})})}>＋ NOVO NÓ</button>}</div>;
}

export default function Sheet({id,tab0,back}){
  const {db,user,isM,upd}=useApp();
  const s=db.sheets.find(x=>x.id===id);
  const [tab,setTab]=useState(tab0||s?.tabs[0]?.id||'itens');
  const [toast,setToast]=useState(null);
  const [mode,setMode0]=useState(()=>{try{return localStorage.getItem('fichas-rpg-mode')==='classic'?'classic':'visual'}catch{return'visual'}}),[editing,setEditing]=useState(false),[modal,setModal]=useState(null);
  const setMode=m=>{setMode0(m);try{localStorage.setItem('fichas-rpg-mode',m)}catch{}};
  if(!s)return null;
  const mine=s.owner===user.id,PM=db.perms;
  const can=isM||(mine&&PM.editSheets);
  const canItem=can||(mine&&PM.createItems),canSkill=can||(mine&&PM.createSkills);
  // Áreas bloqueadas pelo Mestre (vis != 'edit') são restauradas aqui, mesmo que a interface permita o clique.
  const ed=fn=>upd(d=>{const x=d.sheets.find(y=>y.id===id);const old=isM?null:structuredClone(x);fn(x);
    if(!isM){Object.entries(LOCK).forEach(([k,ps])=>{if((x.vis?.[k]||'edit')!=='edit')ps.forEach(p=>{x[p]=old[p]})});guardProg(old,x,db.trees||[],{mine,allow:!!PM.unlockTree});guardLayout(old,x)}x.updated=now()});
  const add=(a,o)=>ed(x=>{x[a].push({id:uid(),...o})}),del=(a,i)=>ed(x=>{x[a].splice(i,1)});
  const F=(a,i,k,ph='',o={})=>{const en=o.en??(can&&(isM||(s.vis?.[SEC[a]]||'edit')==='edit')),v=s[a][i][k]??'';
    if(!en)return <span className={'txt '+(o.c||'')}>{v}</span>;
    const p={className:o.c,placeholder:ph,value:v,onChange:e=>ed(x=>{x[a][i][k]=o.num?+e.target.value:e.target.value})};
    return o.area?<textarea rows={3} {...p}/>:<input type={o.num?'number':'text'} {...p}/>};
  const th=s.theme,T=k=>({value:th[k],on:v=>ed(x=>{x.theme[k]=v}),en:can});
  const style={'--tx':th.text,'--ti':th.title,'--bo':th.border,'--cd':th.card,'--at':th.attr,'--bt':th.btn,fontFamily:th.font,fontSize:th.size,backgroundColor:th.bg,backgroundImage:th.bgImg?`url(${th.bgImg})`:'none'};
  const owner=db.users.find(u=>u.id===s.owner);
  const showTree=isM||PM.viewTree;
  const hid=k=>!isM&&s.vis?.[k]==='hidden'?' gone':'';
  const VisSel=({k})=>isM?<select className="vs" value={s.vis?.[k]||'edit'} onChange={e=>ed(x=>{(x.vis??={})[k]=e.target.value})}><option value="edit">✏️ Jogador edita</option><option value="view">👁️ Só Mestre edita</option><option value="hidden">🚫 Oculto</option></select>:null;
  const ntf=t=>{if(isM&&!mine)upd(d=>{(d.notes??=[]).unshift({id:uid(),to:s.owner,text:t,at:now(),read:false})})};
  const use=c=>{const m=/^\s*(\d+)\s+(.+?)\s*$/.exec(c.cost||''),si=m?s.status.findIndex(t=>t.name.toLowerCase()===m[2].toLowerCase()):-1;
    if(si>=0&&s.status[si].cur<+m[1])return setToast('❌ '+s.status[si].name+' insuficiente');
    let r={detail:'',total:''};
    if(c.dmg){try{r=roll(c.dmg,s.attrs)}catch{return setToast('❌ Fórmula inválida: '+c.dmg)}}
    const before=si>=0?s.status[si].cur:0;
    if(si>=0)ed(x=>{x.status[si].cur-=+m[1]});
    upd(d=>logRoll(d,user,id,c.name+': '+(c.dmg||'—'),r));
    setToast('🎲 '+c.name+' '+(r.detail?r.detail+' → TOTAL '+r.total:'')+(si>=0?' · '+s.status[si].name+' '+before+' → '+(before-+m[1]):''));
    setTimeout(()=>setToast(null),6000)};
  const tabs=(l=>l.filter(([k])=>isM||s.vis?.[{itens:'itens',habs:'habilidades',dinheiro:'dinheiro'}[k]]!=='hidden'))([...s.tabs.map(t=>[t.id,t.title]),['itens','🎒 Itens'],['habs','✨ Habilidades'],...(showTree?[['arvore','🌳 Árvore']]:[]),['dinheiro','💰 Dinheiro'],['galeria','🖼️ Galeria'],['visual','🎨 Visual']]);
  const ct=s.tabs.find(t=>t.id===tab);
  const newTab=()=>{const n=uid();ed(x=>{x.tabs.push({id:n,title:'Nova aba',html:''})});setTab(n)};
  const saveTpl=()=>{upd(d=>{d.sheets.push({...structuredClone(s),id:uid(),owner:user.id,isTemplate:true,isPublic:false,name:'Modelo: '+s.name,template:null,created:now(),updated:now()})});alert('Modelo criado! Veja na aba Modelos.')};
  const rm=()=>{if(confirm('Excluir esta ficha?')){upd(d=>{d.sheets=d.sheets.filter(x=>x.id!==id)});back()}};

  const TB=tab=>{const ct=s.tabs.find(t=>t.id===tab);return <>{ct&&<div><div className="row nw">{can?<input className="big" value={ct.title} onChange={e=>ed(x=>{x.tabs.find(t=>t.id===tab).title=e.target.value})}/>:<h3>{ct.title}</h3>}
            {can&&<button className="x" onClick={()=>{ed(x=>{x.tabs=x.tabs.filter(t=>t.id!==tab)});setTab('itens')}}>🗑️</button>}</div>
            <Rich key={ct.id} html={ct.html} can={can} save={h=>ed(x=>{x.tabs.find(t=>t.id===tab).html=h})}/></div>}
          {tab==='itens'&&<><VisSel k="itens"/><Cards s={s} kind="items" ed={ed} en={canItem} canAdd={canItem} isM={isM} notify={ntf} use={use}/></>}
          {tab==='habs'&&<><VisSel k="habilidades"/><Cards s={s} kind="skills" ed={ed} en={canSkill} canAdd={canSkill} isM={isM} notify={ntf} use={use}/></>}
          {tab==='arvore'&&showTree&&<TreeTab s={s} isM={isM} ed={ed} ntf={ntf} mine={mine}/>}
          {tab==='dinheiro'&&<div><VisSel k="dinheiro"/>{s.money.map((m,i)=><div className="coin" key={m.id} style={{borderColor:m.color}}>
            <span className="em">{F('money',i,'emoji','💰',{c:'ic'})}</span>{F('money',i,'name','Nome')}{F('money',i,'qty','0',{num:1,c:'n'})}
            {can&&<><input type="color" value={m.color} onChange={e=>ed(x=>{x.money[i].color=e.target.value})}/><button className="x" onClick={()=>del('money',i)}>×</button></>}</div>)}
            {can&&<button className="btn" onClick={()=>add('money',{emoji:'💰',name:'Ouro',qty:0,color:'#d4a34a'})}>＋ ADICIONAR</button>}
            {!s.money.length&&!can&&<p className="empty">Sem dinheiro.</p>}</div>}
          {tab==='galeria'&&<div className="gal">{s.images.map((im,i)=><figure key={im.id} style={{width:im.w+'%',margin:im.al==='left'?'0 auto 12px 0':im.al==='right'?'0 0 12px auto':'0 auto 12px'}}>
            <img src={im.src} alt="" style={{border:`${im.bd}px solid ${im.bc}`,borderRadius:im.shape==='round'?'50%':im.shape==='soft'?'24px':'4px',aspectRatio:im.shape==='round'?'1':'auto'}}/>
            {(im.title||can)&&<figcaption>{F('images',i,'title','Título (opcional)',{c:'b'})}</figcaption>}
            {(im.desc||can)&&F('images',i,'desc','Descrição (opcional)',{area:1})}
            {can&&<div className="row"><label className="lab">Tamanho<input type="range" min="20" max="100" value={im.w} onChange={e=>ed(x=>{x.images[i].w=+e.target.value})}/></label>
              <select value={im.al} onChange={e=>ed(x=>{x.images[i].al=e.target.value})}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select>
              <select value={im.shape} onChange={e=>ed(x=>{x.images[i].shape=e.target.value})}><option value="rect">Reto</option><option value="soft">Arredondado</option><option value="round">Círculo</option></select>
              <label className="lab">Borda<input type="range" min="0" max="10" value={im.bd} onChange={e=>ed(x=>{x.images[i].bd=+e.target.value})}/></label>
              <input type="color" value={im.bc} onChange={e=>ed(x=>{x.images[i].bc=e.target.value})}/><button className="x" onClick={()=>del('images',i)}>🗑️</button></div>}</figure>)}
            {can&&<Up label="＋ ADICIONAR IMAGEM" max={900} on={u=>add('images',{src:u,title:'',desc:'',w:60,al:'center',bd:3,bc:'#d4a34a',shape:'soft'})}/>}</div>}
          {tab==='visual'&&(can?<div className="vis">
            <Pick label="Fundo" {...T('bg')}/><Pick label="Textos" {...T('text')}/><Pick label="Títulos" {...T('title')}/><Pick label="Bordas" {...T('border')}/>
            <Pick label="Cartas/painéis" {...T('card')}/><Pick label="Atributos" {...T('attr')}/><Pick label="Botões" {...T('btn')}/>
            <div className="row"><Up label="🖼️ Imagem de fundo" max={1400} on={u=>ed(x=>{x.theme.bgImg=u})}/>{th.bgImg&&<button className="btn sm" onClick={()=>ed(x=>{x.theme.bgImg=''})}>Remover</button>}</div>
            <label className="lab">Fonte<select value={th.font} onChange={e=>ed(x=>{x.theme.font=e.target.value})}>{[['Georgia, serif','Clássica'],['"Palatino Linotype", serif','Palatino'],['system-ui, sans-serif','Moderna'],['"Courier New", monospace','Máquina'],['Impact, fantasy','Impacto'],['"Brush Script MT", cursive','Manuscrita']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
            <label className="lab">Tamanho do texto: {th.size}px<input type="range" min="12" max="24" value={th.size} onChange={e=>ed(x=>{x.theme.size=+e.target.value})}/></label></div>
            :<p className="empty">Você não tem permissão para personalizar esta ficha.</p>)}</>};
  // ---- Ficha visual: nova camada de apresentação (os dados continuam sendo os da ficha; permissões via ed/F acima) ----
  const L=layoutOf(s),commitLayout=l=>ed(x=>{x.layout=l;x.layoutV=LAYOUT_V}),others=db.sheets.filter(o=>o.id!==s.id);
  const vctx={s,isM,can,ed,F,showTree,mine,open:(k,i)=>setModal(k==='tree'?{tree:1}:{k,id:i}),openTab:t=>setModal({tab:t})};
  const modalEl=modal&&<div className="modal" onClick={()=>setModal(null)}><div className="panel nmod wide" style={{...style,backgroundImage:'none'}} onClick={e=>e.stopPropagation()}>
    <div className="row"><button className="btn sm" onClick={()=>setModal(null)}>✕ Fechar</button></div>
    {modal.k?<Cards s={s} kind={modal.k} only={modal.id} ed={ed} en={modal.k==='items'?canItem:canSkill} canAdd={false} isM={isM} notify={ntf} use={use}/>
      :modal.tab?TB(modal.tab):modal.tree?<TreeTab s={s} isM={isM} ed={ed} ntf={ntf} mine={mine}/>:modal.prog?<ProgPanel s={s} isM={isM} ed={ed} ntf={ntf}/>:null}</div></div>;
  const visual=<div className="vsheet">
    <div className="row vbar">
      {isM&&<button className={'btn sm'+(editing?' on':'')} onClick={()=>setEditing(!editing)}>{editing?'👁️ Sair do editor':'✏️ Editar layout'}</button>}
      {isM&&<button className="btn sm" onClick={()=>setModal({prog:1})}>🌳 Progressão (nível, pontos, marcas)</button>}
      {can&&<button className="btn sm" onClick={()=>setModal({tab:'visual'})}>🎨 Tema</button>}</div>
    {isM&&editing?<VisualEditor s={s} layout={L} commit={commitLayout} ctx={vctx} others={others}/>:<VisualCanvas layout={L} ctx={vctx}/>}
  </div>;
  return <div className="sheet" style={style}>
    <header className="shh"><button className="btn sm" onClick={back}>← Voltar</button>
      {can?<input className="big" value={s.name} onChange={e=>ed(x=>{x.name=e.target.value})}/>:<h2>{s.name}</h2>}
      <small>{s.isTemplate?'🧩 Modelo · ':''}👤 {owner?.name||'—'} · criada {fmt(s.created)} · alterada {fmt(s.updated)}{s.template&&` · modelo: ${s.template}`}</small>
      <div className="row">
        {isM&&s.isTemplate&&<label className="sw"><input type="checkbox" checked={s.isPublic} onChange={e=>ed(x=>{x.isPublic=e.target.checked})}/> 🌐 Disponível aos jogadores</label>}
        {(isM||(mine&&PM.createTemplates))&&!s.isTemplate&&<button className="btn sm" onClick={saveTpl}>🧩 Salvar como modelo</button>}
        {can&&<button className="btn sm danger" onClick={rm}>🗑️ Excluir</button>}</div></header>
    <div className="row modebar"><button className={'btn sm'+(mode==='visual'?' on':'')} onClick={()=>setMode('visual')}>🎴 Ficha</button><button className={'btn sm'+(mode==='classic'?' on':'')} onClick={()=>setMode('classic')}>📋 Formulário clássico</button></div>
    {mode==='classic'?<div className="shgrid">
      <div className="col">
        <section className="panel portrait">
          {can?<input className="big c" value={s.charName} onChange={e=>ed(x=>{x.charName=e.target.value})}/>:<h3 className="c">{s.charName}</h3>}
          <div className="frame" style={{'--fr':s.frame,background:s.cardBg}}>{s.cover?<img src={s.cover} alt=""/>:<span>🧙</span>}</div>
          {can&&<div className="row"><Up on={u=>ed(x=>{x.cover=u})}/><Pick label="Moldura" value={s.frame} on={v=>ed(x=>{x.frame=v})}/><Pick label="Fundo do cartão" value={s.cardBg} on={v=>ed(x=>{x.cardBg=v})}/></div>}</section>
        <section className={'panel'+hid('dados')}><h3>Dados <VisSel k="dados"/></h3>
          {s.fields.map((f,i)=><div className="row nw" key={f.id}>{F('fields',i,'k','Campo',{c:'k'})}{F('fields',i,'v','Valor')}{can&&<button className="x" onClick={()=>del('fields',i)}>×</button>}</div>)}
          {can&&<button className="btn sm" onClick={()=>add('fields',{k:'',v:''})}>＋ ADICIONAR LINHA</button>}</section>
        <section className={'panel'+hid('atributos')}><h3>Atributos <small>{s.attrs.length}/10</small> <VisSel k="atributos"/></h3>
          <div className="attrs">{s.attrs.map((a,i)=><div className="attr" key={a.id}>
            {F('attrs',i,'name','Nome',{c:'an'})}{F('attrs',i,'value','0',{num:1,c:'av'})}
            {s.useMod&&a.mod&&<b className="mod">{calcMod(s.formula,a.value)}</b>}
            {can&&<div className="mini"><label><input type="checkbox" checked={!!a.mod} onChange={e=>ed(x=>{x.attrs[i].mod=e.target.checked})}/> mod.</label><button className="x" onClick={()=>del('attrs',i)}>×</button></div>}</div>)}</div>
          {can&&s.attrs.length<10&&<button className="btn sm" onClick={()=>add('attrs',{name:'Atributo',value:10,mod:true})}>＋ ATRIBUTO</button>}
          {isM&&<div className="cfg"><label className="sw"><input type="checkbox" checked={s.useMod} onChange={e=>ed(x=>{x.useMod=e.target.checked})}/> Utilizar modificador</label>
            {s.useMod&&<label className="lab">Fórmula (a = valor do atributo) — ex.: floor(a/2) ou floor((a-10)/2)<input value={s.formula} onChange={e=>ed(x=>{x.formula=e.target.value})}/></label>}</div>}</section>
        <ProgPanel s={s} isM={isM} ed={ed} ntf={ntf}/>
        <section className={'panel'+hid('status')}><h3>Status <VisSel k="status"/></h3>
          {s.status.map((t,i)=><div className={'stat'+(t.hide&&!isM?' gone':'')} key={t.id}>{isM&&<label className="sw"><input type="checkbox" checked={!!t.hide} onChange={e=>ed(x=>{x.status[i].hide=e.target.checked})}/> 🚫 oculto ao jogador</label>}
            <div className="sh"><span>{t.icon} {F('status',i,'name','Nome')}</span><span className="nums">{F('status',i,'cur','',{num:1,c:'n'})}/{F('status',i,'max','',{num:1,c:'n'})}</span></div>
            <div className="bar"><i style={{width:Math.max(0,Math.min(100,t.max?t.cur/t.max*100:0))+'%',background:t.color}}/></div>
            {can&&<div className="row"><input className="ic" value={t.icon} onChange={e=>ed(x=>{x.status[i].icon=e.target.value})}/><Pick label="Cor" value={t.color} on={v=>ed(x=>{x.status[i].color=v})}/>{isM&&<button className="x" onClick={()=>del('status',i)}>×</button>}</div>}</div>)}
          {isM&&<button className="btn sm" onClick={()=>add('status',{name:'Novo status',cur:10,max:10,color:'#b15ae0',icon:'✨'})}>＋ STATUS</button>}</section>
      </div>
      <div className="col main">
        <nav className="tabs">{tabs.map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}{can&&<button className="newtab" onClick={newTab}>＋ NOVA ABA</button>}</nav>
        <section className="panel tabbody">{TB(tab)}</section></div></div>:visual}{modalEl}{toast&&<div className="toast">{toast}</div>}</div>;
}

// Peças reutilizadas pela ficha clássica e pela ficha visual (movidas de Sheet.jsx sem mudar o comportamento;
// única adição: a prop `only` em Cards, que mostra um único item/habilidade).
import {useRef} from 'react';
import {uid,readImage} from './storage.js';
export const clean=h=>{const d=new DOMParser().parseFromString(h||'','text/html');
  d.querySelectorAll('script,iframe,object,embed,style,link').forEach(n=>n.remove());
  d.body.querySelectorAll('*').forEach(n=>[...n.attributes].forEach(a=>{if(/^on/i.test(a.name)||/^\s*javascript:/i.test(a.value))n.removeAttribute(a.name)}));
  return d.body.innerHTML};
export const Up=({label='🖼️ Imagem',on,max})=><label className="btn sm">{label}<input hidden type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];f&&readImage(f,on,max);e.target.value=''}}/></label>;
export const Pick=({label,value,on,en=true})=><label className="pick">{label}<input type="color" disabled={!en} value={value} onChange={e=>on(e.target.value)}/></label>;

export function Rich({html,can,save}){
  const r=useRef();const cmd=(c,v)=>{r.current.focus();document.execCommand(c,false,v)};
  if(!can)return <div className="rich" dangerouslySetInnerHTML={{__html:clean(html)}}/>;
  return <><div className="tb" onMouseDown={e=>e.target.tagName==='BUTTON'&&e.preventDefault()}>
    <button onClick={()=>cmd('formatBlock','h3')}>Título</button><button onClick={()=>cmd('formatBlock','p')}>Parágrafo</button>
    <button onClick={()=>cmd('bold')}><b>B</b></button>
    <label className="pick">Cor<input type="color" defaultValue="#f0c66a" onChange={e=>cmd('foreColor',e.target.value)}/></label>
    <select defaultValue="3" onChange={e=>cmd('fontSize',e.target.value)}>{[1,2,3,4,5,6,7].map(n=><option key={n}>{n}</option>)}</select>
    <Up label="🖼️" on={u=>cmd('insertImage',u)}/></div>
    <div ref={r} className="rich edit" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{__html:clean(html)}} onBlur={()=>save(clean(r.current.innerHTML))}/></>;
}

export function Cards({s,kind,ed,en,canAdd,isM,notify,use,only}){
  const sk=kind==='skills';
  const fl=sk?[['desc','Descrição',1],['cost','Custo'],['dmg','Dano'],['bonus','Bônus'],['req','Requisitos']]:[['desc','Descrição',1],['bonus','Bônus'],['qty','Quantidade']];
  const set=(i,k,v)=>ed(x=>{x[kind][i][k]=v});
  const setE=(i,j,k,v)=>ed(x=>{x[kind][i].extra[j][k]=v});
  return <div className="cards">{s[kind].map((c,i)=>{
    if(only&&c.id!==only)return null;
    if(c.hide&&!isM)return null;
    if(sk&&!c.on&&!isM)return <div className="gcard lockc" key={c.id}>🔒<br/>Bloqueada</div>;
    return <div className="gcard" key={c.id} style={{background:c.bg,borderColor:c.bc}}>
      {en?<div className="row"><input className="ic" value={c.icon} onChange={e=>set(i,'icon',e.target.value)}/><input className="nm" value={c.name} onChange={e=>set(i,'name',e.target.value)}/></div>:<h4>{c.icon} {c.name}</h4>}
      <div className="cimg">{c.img?<img src={c.img} alt=""/>:<span>🖼️</span>}</div>
      {en&&<Up on={u=>set(i,'img',u)}/>}
      {fl.map(([k,l,a])=>en?<label key={k} className="lab">{l}{a?<textarea rows={3} value={c[k]||''} onChange={e=>set(i,k,e.target.value)}/>:<input value={c[k]||''} onChange={e=>set(i,k,e.target.value)}/>}</label>:c[k]?<p key={k} className="txt"><b>{l}:</b> {c[k]}</p>:null)}
      {(c.extra||[]).map((x,j)=>en?<div className="row" key={j}><input value={x.k} placeholder="Campo" onChange={e=>setE(i,j,'k',e.target.value)}/><input value={x.v} placeholder="Valor" onChange={e=>setE(i,j,'v',e.target.value)}/><button className="x" onClick={()=>ed(d=>{d[kind][i].extra.splice(j,1)})}>×</button></div>:<p key={j} className="txt"><b>{x.k}:</b> {x.v}</p>)}
      {en&&<><button className="btn sm" onClick={()=>ed(d=>{(d[kind][i].extra??=[]).push({k:'',v:''})})}>＋ Campo</button>
        <div className="row"><Pick label="Carta" value={c.bg} on={v=>set(i,'bg',v)}/><Pick label="Borda" value={c.bc} on={v=>set(i,'bc',v)}/><button className="x" onClick={()=>ed(d=>{d[kind].splice(i,1)})}>🗑️</button></div></>}
      {use&&(c.dmg||c.cost)&&<button className="btn sm" onClick={()=>use(c)}>⚔️ USAR</button>}
      {sk&&isM&&<label className="sw"><input type="checkbox" checked={!!c.on} onChange={e=>{set(i,'on',e.target.checked);e.target.checked&&notify&&notify('✨ O Mestre liberou: '+c.name)}}/> Liberada aos jogadores</label>}
      {isM&&<label className="sw"><input type="checkbox" checked={!!c.hide} onChange={e=>set(i,'hide',e.target.checked)}/> 🚫 Oculto ao jogador</label>}
    </div>})}
    {canAdd&&<button className="gcard newc" onClick={()=>{notify&&!sk&&notify('🎒 Novo item recebido');ed(d=>{d[kind].push({id:uid(),name:sk?'Nova habilidade':'Novo item',icon:sk?'✨':'🗡️',img:'',desc:'',bonus:'',qty:1,cost:'',dmg:'',req:'',bg:'#2a2145',bc:'#d4a34a',extra:[],on:isM})})}}>＋ {sk?'NOVA HABILIDADE':'NOVO ITEM'}</button>}</div>;
}


// Camada de persistência. Para usar um banco real, troque loadDB/saveDB por chamadas a uma API.
import {migrateTrees} from './treeLogic.js';
import {migrateLayouts} from './layoutLogic.js';
const KEY='fichas-rpg-v1';
export const uid=()=>Math.random().toString(36).slice(2,10);
export const now=()=>new Date().toISOString();
const empty=()=>({users:[],sheets:[],session:null,campaign:{name:'Minha Campanha',notes:''},
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
export const loadDB=()=>{try{return migrate({...empty(),...JSON.parse(localStorage.getItem(KEY))})}catch{return migrate(empty())}};
let t;
export const saveDB=db=>{clearTimeout(t);t=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(db))}catch{alert('Armazenamento cheio: use imagens menores ou exporte um backup.')}},250)};
export const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
export function readImage(file,cb,max=640){const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height));const c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',.82))};i.src=r.result};r.readAsDataURL(file)}

*{box-sizing:border-box}
:root{--gold:#f0c66a}
body{margin:0;font-family:Georgia,serif;background:radial-gradient(circle at 20% 0,#2b1f4d,#0d0a18 70%) fixed;color:#e9e2d0;min-height:100vh}
button,input,select,textarea{font:inherit;color:inherit;max-width:100%}
input,select,textarea{background:#0e0b1a99;border:1px solid #6b5320;border-radius:8px;padding:6px 8px;min-width:0}
input[type=color]{padding:0;width:34px;height:28px;border-radius:6px;cursor:pointer}
input[type=checkbox]{width:auto}textarea{width:100%;resize:vertical}
h2,h3,h4{margin:.3em 0;color:var(--ti,var(--gold));letter-spacing:.04em}
.txt,.rich,.gcard,.panel{overflow-wrap:anywhere;word-break:break-word}
.btn{background:var(--bt,#b8862b);border:0;border-radius:10px;padding:10px 16px;cursor:pointer;font-weight:bold;color:#1a1208;transition:.2s;display:inline-block}
.btn:hover{transform:translateY(-2px);filter:brightness(1.15);box-shadow:0 4px 14px #0008}
.btn.sm{padding:5px 10px;font-size:.85em}.btn.big{width:100%;margin-top:10px;font-size:1.1em}.btn.danger{background:#a83232;color:#fff}
.x{background:#0000;border:0;cursor:pointer;color:#e77;font-size:1.1em}
.panel{background:var(--cd,#221b38);border:1px solid var(--bo,#6b5320);border-radius:14px;padding:14px;margin:0 0 14px;box-shadow:0 6px 20px #0006;animation:in .3s}
@keyframes in{from{opacity:0;transform:translateY(8px)}}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0}.row.nw{flex-wrap:nowrap}.row.nw>input,.row.nw>.txt{flex:1;min-width:0}
.lab{display:flex;flex-direction:column;gap:3px;margin:6px 0;font-size:.85em}.pick,.sw{display:inline-flex;gap:6px;align-items:center;font-size:.85em}.sw{display:flex;margin:6px 0}
.sub,.empty{opacity:.7}.err{color:#f77;margin-top:8px}.c{text-align:center;width:100%}
/* layout */
.app{display:grid;grid-template-columns:210px 1fr;min-height:100vh}
aside{background:#0d0a18cc;border-right:2px solid #6b5320;padding:14px 10px;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:6px}
.logo{font-size:1.4em;color:var(--gold);font-weight:bold;margin-bottom:10px}
aside>button{display:flex;gap:10px;align-items:center;background:#0000;border:1px solid #0000;border-radius:10px;padding:10px;cursor:pointer;text-align:left;transition:.2s}
aside>button em{font-style:normal}aside>button:hover{background:#ffffff14}aside>button.on{background:#b8862b33;border-color:#b8862b;color:var(--gold)}
.me{margin-top:auto;font-size:.9em;display:flex;flex-direction:column;gap:6px}.me button{cursor:pointer;background:#ffffff14;border:0;border-radius:8px;padding:6px}
main{padding:22px;min-width:0}
.login{min-height:100vh;display:grid;place-items:center;padding:16px}.login form{width:min(380px,100%);display:flex;flex-direction:column;gap:10px;text-align:center}
.login h1{color:var(--gold);margin:0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:10px}.stats b{font-size:1.6em;color:var(--gold)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px;margin-bottom:16px}
.modal{position:fixed;inset:0;background:#000a;display:grid;place-items:center;z-index:9;padding:16px}.modal .panel{width:min(420px,100%)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.chip{border:1px solid var(--gold);border-radius:20px;padding:4px 12px;background:#ffffff0d}
/* character cards */
.ccard{border:3px solid var(--fr,#6b5320);border-radius:16px;padding:12px;text-align:center;cursor:pointer;transition:.25s;box-shadow:0 8px 24px #0008;color:#e9e2d0;font:inherit}
.ccard:hover{transform:translateY(-6px) scale(1.02);box-shadow:0 14px 30px #000a,0 0 18px var(--fr)}
.ccard h4{margin:0 0 8px;text-transform:uppercase}.ccard p{margin:8px 0 0;font-weight:bold}.ccard small{opacity:.7}
.frame{aspect-ratio:3/4;border:5px solid var(--fr,#d4a34a);border-radius:12px;display:grid;place-items:center;overflow:hidden;font-size:4em;box-shadow:inset 0 0 20px #000a,0 0 14px var(--fr)}
.frame img{width:100%;height:100%;object-fit:cover}
.newc{background:#ffffff0a!important;border-style:dashed;display:grid;place-items:center;min-height:220px;font-size:1.3em;font-weight:bold;color:var(--gold)}
/* sheet */
.sheet{border:2px solid var(--bo);border-radius:18px;padding:16px;background-size:cover;background-position:center;color:var(--tx)}
.sheet .btn{background:var(--bt)}.shh{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}.shh small{opacity:.75}
.big{font-size:1.3em;font-weight:bold;width:100%;color:var(--ti)}
.shgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:16px;align-items:start}
.portrait .frame{max-width:240px;margin:8px auto}
.k{max-width:38%;font-weight:bold;color:var(--ti)}
.attrs{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:8px}
.attr{border:1px solid var(--bo);border-radius:12px;padding:8px;text-align:center;background:#0004;display:flex;flex-direction:column;gap:4px;align-items:center}
.attr .an{text-align:center;width:100%}.attr .av{font-size:1.5em;font-weight:bold;color:var(--at);text-align:center;width:100%}
.mod{color:var(--at);background:#0006;border-radius:20px;padding:2px 12px}.mini{display:flex;gap:6px;font-size:.75em;align-items:center}
.stat{margin-bottom:10px}.sh{display:flex;justify-content:space-between;gap:8px;font-weight:bold}.nums{display:flex;align-items:center;gap:4px}.n{width:64px;text-align:center}
.bar{height:16px;background:#000a;border-radius:10px;overflow:hidden;border:1px solid var(--bo)}.bar i{display:block;height:100%;transition:width .4s;box-shadow:inset 0 -4px 8px #0004}
.ic{width:52px;text-align:center}
.tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.tabs button{background:var(--cd);border:1px solid var(--bo);border-radius:10px 10px 0 0;padding:8px 12px;cursor:pointer;transition:.2s;color:var(--tx)}
.tabs button:hover{transform:translateY(-2px)}.tabs button.on{background:var(--bt);color:#1a1208;font-weight:bold}.tabs .newtab{border-style:dashed}
.tb{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px}.tb>button{background:#ffffff18;border:0;border-radius:6px;padding:4px 10px;cursor:pointer}
.rich{min-height:140px;line-height:1.6}.rich.edit{background:#0004;border:1px solid var(--bo);border-radius:10px;padding:10px;outline:0}.rich img{max-width:100%;height:auto;border-radius:8px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.gcard{border:3px solid;border-radius:14px;padding:12px;transition:.2s;box-shadow:0 6px 18px #0008;color:var(--tx,#e9e2d0)}.gcard:hover{transform:translateY(-4px)}
.gcard h4,.gcard .nm{text-align:center;text-transform:uppercase;font-weight:bold}.gcard .nm{flex:1}
.cimg{aspect-ratio:16/10;background:#0005;border-radius:8px;display:grid;place-items:center;margin:8px 0;overflow:hidden;font-size:2em}.cimg img{width:100%;height:100%;object-fit:cover}
.lockc{display:grid;place-items:center;text-align:center;font-size:2em;min-height:180px;opacity:.6;background:#000a}
.gcard p{margin:4px 0}
.coin{display:flex;gap:10px;align-items:center;border:2px solid;border-radius:12px;padding:8px 12px;margin-bottom:8px;background:#0004}
.coin .em{font-size:1.6em}.coin>input:not([type=color]),.coin>.txt{flex:1;min-width:0}
.gal figure{margin:0 0 12px}.gal img{width:100%;height:auto;object-fit:cover;display:block}
.vis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.vis>.row,.vis>.lab{grid-column:1/-1}
/* skill tree */
.treewrap{overflow:auto;padding:10px 0}.tree{position:relative;margin:0 auto}.tree svg{position:absolute;inset:0}
.tree line{stroke:#555;stroke-width:3;stroke-dasharray:6 4}.tree line.on{stroke:var(--at);stroke-dasharray:none}
.node{position:absolute;transform:translate(-50%,-50%);width:140px;min-height:54px;border-radius:14px;border:2px solid #555;background:#15111f;color:var(--tx);cursor:pointer;display:flex;gap:6px;align-items:center;justify-content:center;padding:6px;transition:.2s;font-size:.85em}
.node:hover,.node.sel{transform:translate(-50%,-50%) scale(1.08)}.node.lock{opacity:.55}.node.open{border-color:var(--at);box-shadow:0 0 12px var(--at)}.node.done{background:var(--bt);border-color:var(--at);color:#1a1208}
.node span{overflow-wrap:anywhere}
@media(max-width:900px){
 .app{grid-template-columns:1fr}
 aside{position:fixed;bottom:0;left:0;right:0;top:auto;height:auto;flex-direction:row;overflow-x:auto;z-index:5;border-right:0;border-top:2px solid #6b5320;padding:6px}
 aside .logo,aside .me{display:none}aside>button{flex-direction:column;gap:2px;font-size:.7em;padding:6px 10px;min-width:64px;align-items:center}
 main{padding:12px 10px 90px}.shgrid{grid-template-columns:1fr}.grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
 .tabs{flex-wrap:nowrap;overflow-x:auto}.tabs button{white-space:nowrap}.sheet{padding:10px}}
/* V2 */
.topbar{display:flex;justify-content:flex-end;margin-bottom:8px}.topbar button{background:#ffffff14;border:1px solid #6b5320;border-radius:20px;padding:6px 14px;cursor:pointer}.topbar b{background:#d33;color:#fff;border-radius:10px;padding:0 7px;margin-left:6px;font-size:.8em}
.gone{display:none!important}.vs{font-size:.7em;margin-left:8px}
.toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#15111f;border:2px solid var(--gold);border-radius:14px;padding:12px 18px;z-index:20;max-width:92vw;box-shadow:0 8px 30px #000;animation:in .3s;overflow-wrap:anywhere}
.result{margin-top:12px;text-align:center;animation:pop .35s}.result b{display:block;font-size:2em;color:var(--gold)}@keyframes pop{from{transform:scale(.6);opacity:0}}
.hrow{display:flex;gap:12px;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px}.hrow b{color:var(--gold);font-size:1.2em}
.note{display:flex;justify-content:space-between;gap:10px;cursor:pointer}.note.read{opacity:.55}
.diary{display:grid;grid-template-columns:230px minmax(0,1fr);gap:16px;align-items:start}
.chs{display:flex;flex-direction:column;gap:6px}.chap{background:#ffffff0d;border:1px solid #6b5320;border-radius:10px;padding:8px 10px;cursor:pointer;text-align:left;transition:.2s}.chap:hover,.chap.on{background:#b8862b44}.chap.lock{opacity:.5;cursor:default}
.book{border:6px double #6b5320;border-radius:6px 16px 16px 6px;padding:24px;min-height:340px;box-shadow:inset 0 0 40px #0004,0 10px 30px #000a}.book .rich.edit{background:#0001;border-color:#0004}
.pager{justify-content:space-between;margin-top:10px}
@media(max-width:900px){.diary{grid-template-columns:1fr}.book{padding:14px}}
/* Etapa 1: campanhas, perfil, painel */
.topbar{justify-content:space-between;align-items:center;gap:8px}
.campbar{border:0!important;border-radius:20px;padding:6px 16px!important;background:linear-gradient(90deg,var(--c1,#b8862b),var(--c2,#3b2a6b))!important;color:#fff;font-weight:bold;text-shadow:0 1px 3px #000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;cursor:pointer;transition:.2s}.campbar:hover{filter:brightness(1.2)}
aside{border-right-color:var(--c1,#6b5320)}
.worlds{max-width:1100px;margin:0 auto;padding:24px 16px}.worlds header{justify-content:space-between}.worlds h1{color:var(--gold);margin:0}
.wgrid{grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.wcard{border:3px solid var(--c1,#6b5320);border-radius:18px;padding:14px;box-shadow:0 10px 28px #000a;transition:.25s;font:inherit;color:inherit;animation:in .35s}
.wcard:hover{transform:translateY(-6px);box-shadow:0 14px 34px #000c,0 0 22px var(--c1,#b8862b)}
.wcover{height:130px;border-radius:12px;background:#0006 center/cover;display:grid;place-items:center;font-size:3em;margin-bottom:8px;border:2px solid var(--c1,#6b5320)}
.wcard.newc{cursor:pointer;min-height:260px;background:#ffffff0a}
.mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin:12px 0}
.mcard{text-align:center;cursor:pointer;transition:.2s}.mcard:hover{transform:translateY(-4px);border-color:var(--gold)}.mcard b{display:block;font-size:1.2em;color:var(--gold);margin-top:4px}
.qa{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.prof{text-align:center;max-width:620px;margin:0 auto 14px}.prof .frame{max-width:200px;margin:8px auto}
/* Etapa 2: árvore avançada */
.tvbox{position:relative;height:min(68vh,620px);min-height:320px;overflow:hidden;touch-action:none;cursor:grab;user-select:none;border:2px solid var(--bo,#6b5320);border-radius:14px;margin:8px 0;
  background:radial-gradient(circle at 50% 0,#2b1f4d88,#0d0a18 75%),repeating-linear-gradient(0deg,#ffffff06 0 1px,#0000 1px 40px),repeating-linear-gradient(90deg,#ffffff06 0 1px,#0000 1px 40px)}
.tvbox:active{cursor:grabbing}.tvworld{position:absolute;left:0;top:0;transform-origin:0 0}.tvlines{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.tl{fill:none;stroke:#6b5a8a;stroke-width:3;stroke-dasharray:7 5}.tl.on{stroke:var(--at,#f0c66a);stroke-dasharray:none;filter:drop-shadow(0 0 4px var(--at,#f0c66a))}
.tn{position:absolute;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 8px 6px;border-radius:14px;border:2px solid var(--nc,#6b5a8a);background:linear-gradient(170deg,#2a2145,#15111f);color:var(--tx,#e9e2d0);cursor:pointer;overflow:hidden;text-align:center;font-size:.8em;transition:box-shadow .2s,opacity .2s}
.tn b{text-transform:uppercase;letter-spacing:.03em;line-height:1.15;max-height:2.3em;overflow:hidden;color:var(--ti,#f0c66a)}.tn small{opacity:.7}
.tn ul{list-style:none;margin:2px 0;padding:0;width:100%;text-align:left;font-size:.85em;line-height:1.3}.tn li{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tn li.ok,.rq li.ok{color:#7be08a}.tn li.no,.rq li.no{color:#ff8c8c}.tn em{font-style:normal;margin-top:auto;font-weight:bold;color:var(--at,#f0c66a)}
.tni{font-size:1.7em;line-height:1;width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:#0006;overflow:hidden}.tni img{width:100%;height:100%;object-fit:cover}.tni.big{width:64px;height:64px;font-size:2.6em;flex:none}
.tns{position:absolute;top:4px;right:6px;font-size:1.1em}
.tn.lock{opacity:.6;filter:saturate(.5)}.tn.open{border-color:var(--nc,var(--at,#f0c66a));box-shadow:0 0 14px var(--nc,var(--at,#f0c66a))}
.tn.done{background:linear-gradient(170deg,var(--nc,var(--bt,#b8862b)),#3b2a6b);border-color:var(--nc,var(--at,#f0c66a));box-shadow:0 0 10px #0009}.tn.done b,.tn.done em{color:#fff}.tn.edit{border-style:dashed}
.tn.sel{outline:3px solid #fff8;outline-offset:2px}
.tvctl{position:absolute;right:8px;bottom:8px;display:flex;flex-direction:column;gap:6px;z-index:2}
.tvctl button{width:38px;height:38px;border-radius:10px;border:1px solid var(--bo,#6b5320);background:#15111fdd;color:var(--gold);cursor:pointer;font-weight:bold}.tvctl button:hover{background:#b8862b55}
.tvempty{position:absolute;inset:0;display:grid;place-items:center;margin:0;pointer-events:none}
.nmod{width:min(520px,100%)!important;max-height:92vh;overflow:auto}.tmh{display:flex;gap:12px;align-items:center;margin-bottom:6px}
.badge{display:inline-block;border-radius:20px;padding:2px 10px;margin:4px 6px 0 0;font-size:.8em;border:1px solid var(--gold);background:#ffffff0d}.badge.done{border-color:#7be08a;color:#7be08a}.badge.lock{border-color:#ff8c8c;color:#ff8c8c}.badge.master{border-color:#c9a0ff;color:#c9a0ff}
.rq{list-style:none;padding:0;margin:6px 0}.rq li{padding:3px 0}.why{background:#a8323226;border:1px solid #a83232;border-radius:10px;padding:8px 12px;margin:8px 0}.why p{margin:4px 0}
.rk{flex:none;font-size:.8em;opacity:.8;min-width:96px}.chip.mk{display:inline-flex;align-items:center;gap:4px;border-color:#c9a0ff}
@media(max-width:900px){.tvbox{height:62vh}.tn{font-size:.75em}}
@media(max-width:900px){.shgrid{grid-template-columns:minmax(0,1fr)}}
@media(max-width:900px){.sh{flex-wrap:wrap}.sh>span{min-width:0}.stat input{min-width:0}}
.tn{max-width:none}.row.nw>input.ic{flex:none}.tabs button{color:var(--tx,#e9e2d0)}.tabs button.on{color:#1a1208}
.tabs button{background:var(--cd,#221b38);border-color:var(--bo,#6b5320)}.tabs button.on{background:var(--bt,#b8862b);color:#1a1208}
/* Etapa 3: ficha visual + editor de layout */
.modebar{margin:0 0 10px}.btn.on{outline:2px solid var(--gold);filter:brightness(1.1)}.vbar{margin:0 0 10px}
.vc-wrap{width:100%;overflow-x:auto;overflow-y:hidden}
.vc-warn{background:#a8323226;border:1px solid #a83232;border-radius:10px;padding:8px 12px;margin:0 0 8px;font-size:.85em}
.vc-size{position:relative;margin:0 auto}
.vc-stage{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden;background-clip:padding-box;user-select:none}
.vc-bgimg,.vc-grid,.vc-border{position:absolute;inset:0;pointer-events:none}
.vc-grid{background-image:linear-gradient(#ffffff14 1px,#0000 1px),linear-gradient(90deg,#ffffff14 1px,#0000 1px),linear-gradient(#ffffff26 1px,#0000 1px),linear-gradient(90deg,#ffffff26 1px,#0000 1px)}
.vc-el{position:absolute}
.vc-el.ed{cursor:move;touch-action:none;outline:1px dashed #ffffff30}
.vc-size.editing .vc-el .ev{pointer-events:none}.vc-size.editing .vc-el.ed:hover{outline-color:#4ac3ff}
.vc-sel{position:absolute;outline:solid #4ac3ff;pointer-events:none;box-shadow:0 0 0 1px #0008,0 0 12px #4ac3ff66}
.vc-tag{position:absolute;left:0;bottom:100%;transform-origin:0 100%;background:#4ac3ff;color:#06222f;font:bold 12px system-ui,sans-serif;padding:2px 8px;border-radius:6px 6px 0 0;white-space:nowrap}
.vc-h{position:absolute;transform:translate(-50%,-50%);background:#fff;border:2px solid #4ac3ff;border-radius:3px;pointer-events:auto;touch-action:none}
.ev{width:100%;height:100%;display:flex;flex-direction:column;padding:6px 8px;overflow:hidden;min-width:0;min-height:0;color:var(--tx);overflow-wrap:anywhere}
.ev.pn{background:var(--cd);border:1px solid var(--bo);border-radius:14px}
.ev.sec{padding:6px 12px}
.evt{font-weight:bold;color:var(--ti);letter-spacing:.04em;margin-bottom:4px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.evb{flex:1;min-height:0;display:flex;flex-direction:column}
.evfit{flex:1;min-height:0;overflow:hidden}.evfit.sc{overflow:auto;scrollbar-width:thin}
.evfit.col{display:flex;flex-direction:column;justify-content:center}.evfit.rw{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.evtxt{white-space:pre-wrap;overflow-wrap:anywhere}
.evlab{color:var(--ti);flex:none}
.evmiss{opacity:.8;font-size:.85em;color:#ffb0b0}
.evimg{width:100%;height:100%;display:block;flex:none}.evimg.ph{display:grid;place-items:center;font-size:3em;background:#0005}
.ev:has(>.evimg){padding:0}
.evrow{display:flex;gap:8px;align-items:center;margin:2px 0}.evrow.col{flex-direction:column;align-items:stretch;gap:0}.evrow .k{flex:none;max-width:40%}
.ev input:not([type=color]):not([type=checkbox]),.ev textarea{background:transparent;border:1px solid transparent;color:inherit;font:inherit;text-align:inherit;width:100%}
.ev input:hover,.ev input:focus,.ev textarea:hover,.ev textarea:focus{border-color:var(--bo);background:#0003}
.ev .n{width:56px;text-align:center}.ev .attrs{margin:0;grid-template-columns:repeat(auto-fill,minmax(100px,1fr))}.ev .attrs.one{grid-template-columns:1fr;height:100%}.ev .attrs.one .attr{height:100%;justify-content:center}
.ev .attr .an,.ev .attr .av{text-align:center}.ev .coin{padding:4px 8px;margin-bottom:6px}.ev .coin .ic{width:44px}
.ev .rich{min-height:0;height:100%;overflow:auto}.ev .chips{margin:0}
.evchip{cursor:pointer;color:inherit;font:inherit}.evchip.lock{opacity:.6}
.evgal{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}.evgal img{width:44px;height:44px;object-fit:cover;border-radius:6px}
.ve{margin-top:4px}.vetb{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px;position:relative}.vehint{margin:4px 0 8px;font-size:.85em}
.vemenu{position:relative}.vepop{position:absolute;top:100%;left:0;z-index:30;display:flex;flex-direction:column;gap:2px;padding:6px;min-width:190px;margin:4px 0 0}
.vepop button{background:#0000;border:0;text-align:left;padding:6px 10px;border-radius:8px;cursor:pointer;color:inherit}.vepop button:hover{background:#ffffff1a}
.vebody{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:12px;align-items:start}
.veside{background:var(--cd);border:1px solid var(--bo);border-radius:14px;padding:10px;max-height:80vh;overflow:auto;position:sticky;top:8px}
.ep h4{margin:0 0 6px}.ep h5{margin:12px 0 4px;color:var(--ti);border-bottom:1px solid var(--bo)}.ep .g2{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ep .row{margin:4px 0}.ep small.empty{font-size:.75em}
.nmod.wide{width:min(900px,100%)!important}
@media(max-width:900px){.vebody{grid-template-columns:minmax(0,1fr)}.veside{position:static;max-height:none}}

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

import {useState,useRef,useEffect,useCallback} from 'react';
import {useApp} from './ctx.js';
import {uid,now,readImage} from './storage.js';
import * as T from './treeLogic.js';

const CW=176,CH=138,ICO={done:'✓',open:'🔓',lock:'🔒'},dt=d=>d?new Date(d).toLocaleString('pt-BR'):'';
const clampK=k=>Math.min(2.5,Math.max(.2,k));

function Ask({title,children,yes='SIM',danger,onYes,onNo}){
  return <div className="modal" style={{zIndex:30}} onClick={onNo}><div className="panel nmod" onClick={e=>e.stopPropagation()}><h3>{title}</h3>{children}
    <div className="row"><button className={'btn'+(danger?' danger':'')} onClick={onYes}>{yes}</button><button className="btn" onClick={onNo}>CANCELAR</button></div></div></div>;
}

// ---------- Canvas: zoom, pan (mouse/toque), pinça, arrastar nós (modo edição) ----------
function Canvas({tree,info,sel,onSel,edit,onMove}){
  const box=useRef(),[v,setV]=useState({x:30,y:30,k:1}),[drag,setDrag]=useState(null);
  const R=useRef({p:new Map(),g:null,moved:false});Object.assign(R.current,{v,onMove,tree});
  const fit=useCallback(forceK=>{const el=box.current,N=R.current.tree.nodes;if(!el)return;if(!N.length)return setV({x:30,y:30,k:1});
    const x0=Math.min(...N.map(n=>n.x)),x1=Math.max(...N.map(n=>n.x+CW)),y0=Math.min(...N.map(n=>n.y)),y1=Math.max(...N.map(n=>n.y+CH)),W=el.clientWidth,H=el.clientHeight;
    const k=forceK||clampK(Math.min(1.1,(W-40)/(x1-x0),(H-40)/(y1-y0)));setV({k,x:(W-(x1-x0)*k)/2-x0*k,y:(H-(y1-y0)*k)/2-y0*k})},[]);
  const zoomAt=useCallback((f,cx,cy)=>setV(p=>{const k=clampK(p.k*f);return {k,x:cx-(cx-p.x)/p.k*k,y:cy-(cy-p.y)/p.k*k}}),[]);
  useEffect(()=>{fit()},[]);
  useEffect(()=>{const el=box.current;const wh=e=>{e.preventDefault();const r=el.getBoundingClientRect();zoomAt(e.deltaY<0?1.12:1/1.12,e.clientX-r.left,e.clientY-r.top)};
    el.addEventListener('wheel',wh,{passive:false});return()=>el.removeEventListener('wheel',wh)},[zoomAt]);
  useEffect(()=>{
    const mv=e=>{const r=R.current;if(!r.p.has(e.pointerId))return;r.p.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=r.g;if(!g)return;
      if(g.t==='pinch'){const[a,b]=[...r.p.values()],k=clampK(g.v0.k*Math.hypot(a.x-b.x,a.y-b.y)/g.d0);setV({k,x:g.cx-(g.cx-g.v0.x)/g.v0.k*k,y:g.cy-(g.cy-g.v0.y)/g.v0.k*k});return}
      const dx=e.clientX-g.sx,dy=e.clientY-g.sy;if(Math.hypot(dx,dy)>5)r.moved=true;
      if(g.t==='pan'&&r.moved)setV({...g.v0,x:g.v0.x+dx,y:g.v0.y+dy});
      if(g.t==='node'&&r.moved)setDrag({id:g.id,x:g.n0.x+dx/r.v.k,y:g.n0.y+dy/r.v.k})};
    const up=e=>{const r=R.current;if(!r.p.has(e.pointerId))return;r.p.delete(e.pointerId);const g=r.g;
      if(g?.t==='node'&&r.moved&&r.p.size===0){const sn=q=>Math.round(q/10)*10;r.onMove&&r.onMove(g.id,sn(g.n0.x+(e.clientX-g.sx)/r.v.k),sn(g.n0.y+(e.clientY-g.sy)/r.v.k));setDrag(null)}
      if(r.p.size===0||g?.t==='pinch'){r.g=null;if(r.p.size===0)setDrag(null)}};
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
    return()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up)}},[]);
  const start=(e,id)=>{if(e.button!==0)return;const r=R.current;r.p.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(r.p.size===1){r.moved=false;const n=id&&r.tree.nodes.find(q=>q.id===id);
      r.g=n?{t:'node',id,sx:e.clientX,sy:e.clientY,n0:{x:n.x,y:n.y}}:{t:'pan',sx:e.clientX,sy:e.clientY,v0:r.v}}
    else if(r.p.size===2){const[a,b]=[...r.p.values()],rc=box.current.getBoundingClientRect();
      r.g={t:'pinch',d0:Math.hypot(a.x-b.x,a.y-b.y)||1,v0:r.v,cx:(a.x+b.x)/2-rc.left,cy:(a.y+b.y)/2-rc.top};r.moved=true;setDrag(null)}};
  const N=tree.nodes,P=n=>drag&&drag.id===n.id?drag:n,byId=Object.fromEntries(N.map(n=>[n.id,n]));
  const lines=N.flatMap(n=>(n.conn||[]).map(c=>{const a=byId[c];if(!a)return null;const pa=P(a),pb=P(n),x1=pa.x+CW/2,y1=pa.y+CH,x2=pb.x+CW/2,y2=pb.y,dy=Math.max(40,Math.abs(y2-y1)/2);
    const on=edit||info(a).state==='done';return <path key={n.id+c} d={`M${x1} ${y1}C${x1} ${y1+dy} ${x2} ${y2-dy} ${x2} ${y2}`} className={'tl'+(on?' on':'')}/>}));
  const ctr=()=>[box.current.clientWidth/2,box.current.clientHeight/2];
  return <div className="tvbox" ref={box} onPointerDown={e=>start(e,null)}>
    <div className="tvworld" style={{transform:`translate(${v.x}px,${v.y}px) scale(${v.k})`}}>
      <svg className="tvlines" width="1" height="1">{lines}</svg>
      {N.map(n=>{const p=P(n),e=edit?null:info(n),st=e?e.state:'edit',col=n.color||undefined;
        return <button key={n.id} className={'tn '+st+(sel===n.id?' sel':'')} style={{left:p.x,top:p.y,width:CW,height:CH,'--nc':col}}
          onPointerDown={edit?ev=>{ev.stopPropagation();start(ev,n.id)}:undefined} onClick={()=>{if(!R.current.moved)onSel(n)}}>
          <div className="tni">{n.img?<img src={n.img} alt=""/>:n.icon||'✨'}</div><b>{n.name}</b>
          {e?<ul>{e.checks.slice(0,3).map(c=><li key={c.id} className={c.ok?'ok':'no'}>{c.ok?'✓':'✗'} {c.label}</li>)}{e.checks.length>3&&<li>+{e.checks.length-3}…</li>}</ul>
            :<small>{n.type} · {(n.reqs||[]).length} req.</small>}
          <em>{T.costOf(n)} {T.costOf(n)===1?'ponto':'pontos'}</em><span className="tns">{e?ICO[st]:'✎'}</span></button>})}</div>
    {!N.length&&<p className="empty tvempty">Esta árvore ainda não tem habilidades.</p>}
    <div className="tvctl" onPointerDown={e=>e.stopPropagation()}>
      <button title="Aproximar" onClick={()=>zoomAt(1.25,...ctr())}>＋</button><button title="Afastar" onClick={()=>zoomAt(1/1.25,...ctr())}>－</button>
      <button title="Centralizar tudo" onClick={()=>fit()}>⌖</button><button title="Resetar zoom (100%)" onClick={()=>fit(1)}>1:1</button></div></div>;
}

// ---------- Detalhes da habilidade (visão da ficha) ----------
function NodeModal({s,tree,node,close,isM,self,run}){
  const {db}=useApp(),[ask,setAsk]=useState(null),e=T.evalNode(s,tree,node),p=T.getProg(s),cost=T.costOf(node),en=e.entry;
  const who=en&&(en.legacy?'Mestre (árvore antiga)':db.users.find(u=>u.id===en.by)?.display||db.users.find(u=>u.id===en.by)?.name||'—');
  const miss=e.checks.filter(c=>!c.ok);
  const go=()=>{const a=ask;setAsk(null);run(a,node);close()};
  return <div className="modal" onClick={close}><div className="panel nmod" onClick={x=>x.stopPropagation()} style={{borderColor:node.color||undefined}}>
    <div className="tmh"><div className="tni big">{node.img?<img src={node.img} alt=""/>:node.icon||'✨'}</div>
      <div><h3>{node.name}</h3><small>{node.type} · {cost} {cost===1?'ponto':'pontos'}</small><div><span className={'badge '+e.state}>{ICO[e.state]} {T.STATE[e.state]}</span>{en?.master&&<span className="badge master">👑 Liberada pelo Mestre</span>}</div></div></div>
    {node.desc&&<p className="txt">{node.desc}</p>}
    <h4>Requisitos {e.checks.length>1&&<small>({e.mode==='any'?'cumpra qualquer um':'cumpra todos'})</small>}</h4>
    {!e.checks.length&&<p className="empty">Nenhum requisito.</p>}
    <ul className="rq">{e.checks.map(c=><li key={c.id} className={c.ok?'ok':'no'}>{c.ok?'✓':'✗'} {c.label}</li>)}</ul>
    {e.state==='lock'&&<div className="why"><b>Por que está bloqueada?</b>{e.mode==='any'?<p>Você precisa cumprir pelo menos um destes requisitos:</p>:null}{miss.map(c=><p key={c.id}>{c.hint}</p>)}</div>}
    {e.state==='open'&&<p className="txt">Pontos de habilidade: <b>{p.points}</b> · custo: <b>{cost}</b>{p.points<cost&&<span className="err"> — Pontos insuficientes.</span>}</p>}
    {en&&<p className="txt">🗓️ Desbloqueada em {dt(en.at)}<br/>👤 Por: {who}{en.master?' (liberação do Mestre)':en.cost?` · custou ${en.cost} pontos`:''}</p>}
    <div className="row">
      {e.state==='open'&&self&&<button className="btn" disabled={p.points<cost} onClick={()=>setAsk('unlock')}>🔓 DESBLOQUEAR</button>}
      {e.state==='open'&&!self&&!isM&&<small className="empty">O Mestre ainda não permitiu desbloquear por conta própria.</small>}
      {isM&&!en&&<button className="btn" onClick={()=>setAsk('release')}>👑 LIBERAR HABILIDADE</button>}
      {isM&&en&&<button className="btn danger" onClick={()=>setAsk('lock')}>🔒 BLOQUEAR / RESETAR</button>}
      <button className="btn" onClick={close}>FECHAR</button></div>
    {ask==='unlock'&&<Ask title="Desbloquear" onYes={go} onNo={()=>setAsk(null)}><p>{cost?`Desbloquear esta habilidade por ${cost} ${cost===1?'ponto':'pontos'}?`:'Desbloquear esta habilidade (sem custo)?'}</p><p className="sub">Pontos: {p.points} → {p.points-cost}</p></Ask>}
    {ask==='release'&&<Ask title="Liberar habilidade" onYes={go} onNo={()=>setAsk(null)}><p>Liberar <b>{node.name}</b> para esta ficha, ignorando requisitos e sem gastar pontos?</p></Ask>}
    {ask==='lock'&&<Ask title="Bloquear habilidade" danger yes="BLOQUEAR" onYes={go} onNo={()=>setAsk(null)}><p>Bloquear <b>{node.name}</b> nesta ficha?</p>
      <p className="sub">{en.master?'Foi uma liberação do Mestre: nenhum ponto será devolvido.':`Serão devolvidos ${en.cost||0} pontos.`}</p>
      {tree.nodes.some(n=>p.unlocked[n.id]&&(n.reqs||[]).some(q=>q.kind==='node'&&q.node===node.id))&&<p className="err">Atenção: há habilidades desbloqueadas que dependem desta; elas continuam desbloqueadas.</p>}</Ask>}
  </div></div>;
}

// ---------- Painel de progressão na ficha: Nível, Pontos, Condições/Marcas ----------
export function ProgPanel({s,isM,ed,ntf}){
  const [m,setM]=useState(''),p=T.getProg(s),marks=s.marks||[];
  const addMark=()=>{const n=m.trim();if(!n)return;if(marks.some(x=>x.name.toLowerCase()===n.toLowerCase()))return alert('Esta condição/marca já existe nesta ficha.');
    ed(x=>{(x.marks??=[]).push({id:uid(),name:n,at:now()})});ntf&&ntf('🏷️ Nova condição/marca: '+n);setM('')};
  const pts=d=>ed(x=>{const q=T.normProg(x);q.points=Math.max(0,q.points+d)});
  return <section className="panel"><h3>🌳 Progressão</h3>
    <div className="row"><b>Nível</b>{isM?<input type="number" className="n" min="1" value={T.levelOf(s)} onChange={e=>ed(x=>{x.level=Math.max(1,parseInt(e.target.value,10)||1)})}/>:<span className="txt"><b>{T.levelOf(s)}</b></span>}</div>
    <div className="row"><b>Pontos de habilidade</b>{isM?<><button className="btn sm" onClick={()=>pts(-1)}>−</button><input type="number" className="n" min="0" value={p.points} onChange={e=>ed(x=>{T.normProg(x).points=Math.max(0,parseInt(e.target.value,10)||0)})}/><button className="btn sm" onClick={()=>pts(1)}>＋</button></>:<span className="txt"><b>{p.points}</b></span>}</div>
    <h4>Condições / Marcas</h4>
    <div className="chips">{marks.map(x=><span className="chip mk" key={x.id}>🏷️ {x.name}{isM&&<button className="x" title="Remover" onClick={()=>ed(d=>{d.marks=d.marks.filter(y=>y.id!==x.id)})}>×</button>}</span>)}
      {!marks.length&&<small className="empty">Nenhuma condição/marca.</small>}</div>
    {isM&&<div className="row nw"><input placeholder="Ex.: Marca do Dragão" value={m} onChange={e=>setM(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMark()}/><button className="btn sm" onClick={addMark}>＋ CONCEDER</button></div>}
  </section>;
}

// ---------- Aba "Árvore" da ficha ----------
export function TreeTab({s,isM,ed,ntf,mine}){
  const {db,user,camp,upd,showProfile}=useApp(),prog=T.getProg(s),all=db.trees||[];
  const mineT=all.filter(t=>prog.trees.includes(t.id)),[tid,setTid]=useState(mineT[0]?.id),[node,setNode]=useState(null),[rs,setRs]=useState(false);
  const tree=mineT.find(t=>t.id===tid)||mineT[0],free=all.filter(t=>!prog.trees.includes(t.id));
  const self=mine&&!!db.perms.unlockTree&&!isM;
  const run=(act,n)=>{
    if(act==='unlock'){const r=T.unlock(structuredClone(s),tree,n,user.id);if(!r.ok)return alert(r.reason);
      ed(x=>{T.unlock(x,tree,n,user.id)});
      upd(d=>{(d.notes??=[]).unshift({id:uid(),to:camp.owner,text:`🌳 ${user.display||user.name} desbloqueou ${n.name} (${s.charName})`,at:now(),read:false})})}
    if(act==='release'){ed(x=>{T.release(x,tree,n,user.id)});ntf&&ntf('✨ Nova habilidade desbloqueada! '+n.name)}
    if(act==='lock')ed(x=>{T.lock(x,tree,n)})};
  const pv=tree&&T.previewReset(s,tree),{done,total}=tree?T.progressCount(s,tree):{done:0,total:0};
  return <div><div className="row"><b>Pontos de habilidade: {prog.points}</b><span>· Nível {T.levelOf(s)}</span></div>
    {isM&&<div className="row"><select value="" onChange={e=>{const id=e.target.value;if(id){ed(x=>{const q=T.normProg(x);q.trees.includes(id)||q.trees.push(id)});setTid(id)}}}>
        <option value="">＋ Atribuir árvore a esta ficha…</option>{free.map(t=><option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}</select>
      {!all.length&&<small className="empty">Crie árvores em 🌳 Árvore (menu).</small>}</div>}
    {mineT.length>1&&<div className="tabs">{mineT.map(t=><button key={t.id} className={t.id===tree?.id?'on':''} onClick={()=>setTid(t.id)}>{t.icon} {t.name}</button>)}</div>}
    {!tree&&<p className="empty">{isM?'Nenhuma árvore atribuída a esta ficha.':'O Mestre ainda não atribuiu uma árvore a esta ficha.'}</p>}
    {tree&&<><div className="row"><h3>{tree.icon} {tree.name}</h3><span className="chip">{done} / {total} habilidades</span>
        {isM&&<><button className="btn sm danger" onClick={()=>setRs(true)}>↺ Resetar progresso</button>
          <button className="btn sm" onClick={()=>confirm('Remover esta árvore da ficha? O progresso é mantido caso ela seja atribuída de novo.')&&ed(x=>{const q=T.normProg(x);q.trees=q.trees.filter(i=>i!==tree.id)})}>Remover da ficha</button></>}</div>
      {tree.desc&&<p className="txt sub">{tree.desc}</p>}
      <Canvas key={tree.id+s.id} tree={tree} info={n=>T.evalNode(s,tree,n)} sel={node?.id} onSel={setNode}/>
      <small className="sub">Arraste para mover · roda do mouse ou pinça para zoom · toque numa habilidade para ver detalhes.</small></>}
    {node&&tree&&<NodeModal s={s} tree={tree} node={tree.nodes.find(n=>n.id===node.id)||node} close={()=>setNode(null)} isM={isM} self={self} run={run}/>}
    {rs&&tree&&<Ask title="Resetar progresso desta árvore" danger yes="RESETAR" onNo={()=>setRs(false)} onYes={()=>{ed(x=>{T.resetTree(x,tree)});setRs(false)}}>
      <p>Tem certeza que deseja resetar o progresso desta árvore?</p>
      {pv.nodes.length?<><p className="sub">Serão bloqueadas {pv.nodes.length} habilidades:</p><div className="chips">{pv.nodes.map(n=><span className="chip" key={n.id}>{n.icon} {n.name}</span>)}</div>
        <p>Pontos devolvidos: <b>{pv.refund}</b> (liberações do Mestre não devolvem pontos).</p></>:<p className="sub">Nenhuma habilidade desbloqueada: nada será alterado.</p>}</Ask>}
  </div>;
}

// ---------- Editor de nó (Mestre) ----------
const Dl=({id,list})=><datalist id={id}>{[...new Set(list.filter(Boolean))].map(x=><option key={x} value={x}/>)}</datalist>;
function NodeEditor({tree,node,close,sheets}){
  const {upd}=useApp(),[ask,setAsk]=useState(false);
  const ed=fn=>upd(d=>{const t=d.trees.find(x=>x.id===tree.id),n=t.nodes.find(x=>x.id===node.id);fn(n,t,d)});
  const set=(k,v)=>ed(n=>{n[k]=v}),others=tree.nodes.filter(n=>n.id!==node.id);
  const setReq=(i,k,v)=>ed(n=>{n.reqs[i][k]=v});
  const conn=(id,on)=>ed(n=>{n.conn=(n.conn||[]).filter(c=>c!==id);n.reqs=n.reqs.filter(q=>!(q.kind==='node'&&q.node===id));if(on){n.conn.push(id);n.reqs.push({...T.newReq('node'),node:id})}});
  const nUn=T.countUnlocked(sheets,[node.id]);
  return <div className="modal" onClick={close}><div className="panel nmod" onClick={e=>e.stopPropagation()}>
    <Dl id="dl-skill" list={sheets.flatMap(s=>s.skills.map(k=>k.name))}/><Dl id="dl-item" list={sheets.flatMap(s=>s.items.map(k=>k.name))}/>
    <Dl id="dl-attr" list={sheets.flatMap(s=>s.attrs.map(k=>k.name))}/><Dl id="dl-mark" list={sheets.flatMap(s=>(s.marks||[]).map(k=>k.name))}/>
    <h3>✎ Editar habilidade</h3>
    <div className="row nw"><input className="ic" value={node.icon} onChange={e=>set('icon',e.target.value)}/><input value={node.name} onChange={e=>set('name',e.target.value)}/></div>
    <div className="row"><label className="btn sm">🖼️ Imagem<input hidden type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];f&&readImage(f,u=>set('img',u),160);e.target.value=''}}/></label>
      {node.img&&<button className="btn sm danger" onClick={()=>set('img','')}>Remover imagem</button>}
      <label className="pick">Cor<input type="color" value={node.color||'#d4a34a'} onChange={e=>set('color',e.target.value)}/></label>{node.color&&<button className="btn sm" onClick={()=>set('color','')}>Cor padrão</button>}</div>
    <div className="row"><label className="lab">Tipo<select value={node.type} onChange={e=>set('type',e.target.value)}>{[...new Set([...T.TYPES,node.type])].map(t=><option key={t}>{t}</option>)}</select></label>
      <label className="lab">Custo (pontos)<input type="number" min="0" value={node.cost} onChange={e=>set('cost',Math.max(0,parseInt(e.target.value,10)||0))}/></label></div>
    <label className="lab">Descrição / efeito<textarea rows={3} value={node.desc} onChange={e=>set('desc',e.target.value)}/></label>
    <h4>Conexões <small>(habilidades anteriores — ligar também exige a anterior)</small></h4>
    <div className="chips">{others.map(o=><label key={o.id} className="chip"><input type="checkbox" checked={(node.conn||[]).includes(o.id)} onChange={e=>conn(o.id,e.target.checked)}/> {o.name}</label>)}{!others.length&&<small className="empty">Crie outras habilidades para conectar.</small>}</div>
    <h4>Requisitos</h4>
    {node.reqs.length>1&&<label className="lab">Combinação<select value={node.mode} onChange={e=>set('mode',e.target.value)}><option value="all">E — cumprir todos</option><option value="any">OU — cumprir qualquer um</option></select></label>}
    {node.reqs.map((q,i)=><div className="row nw" key={q.id}><span className="rk">{T.REQ[q.kind]}</span>
      {q.kind==='level'&&<input type="number" min="1" value={q.min} onChange={e=>setReq(i,'min',+e.target.value)}/>}
      {q.kind==='attr'&&<><input list="dl-attr" placeholder="Atributo" value={q.name} onChange={e=>setReq(i,'name',e.target.value)}/><input type="number" className="n" value={q.min} onChange={e=>setReq(i,'min',+e.target.value)}/></>}
      {['skill','item','mark'].includes(q.kind)&&<input list={'dl-'+q.kind} placeholder="Nome exato" value={q.name} onChange={e=>setReq(i,'name',e.target.value)}/>}
      {q.kind==='node'&&<select value={q.node} onChange={e=>setReq(i,'node',e.target.value)}><option value="">—</option>{others.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>}
      <button className="x" onClick={()=>ed(n=>{n.reqs.splice(i,1)})}>×</button></div>)}
    <select value="" onChange={e=>e.target.value&&ed(n=>{n.reqs.push(T.newReq(e.target.value))})}><option value="">＋ Adicionar requisito…</option>{Object.entries(T.REQ).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
    <div className="row"><button className="btn danger" onClick={()=>setAsk(true)}>🗑️ Excluir habilidade</button><button className="btn" onClick={close}>PRONTO</button></div>
    {ask&&<Ask title="Excluir habilidade" danger yes="EXCLUIR" onNo={()=>setAsk(false)} onYes={()=>{upd(d=>{const t=d.trees.find(x=>x.id===tree.id);t.nodes=t.nodes.filter(n=>n.id!==node.id);
        t.nodes.forEach(n=>{n.conn=(n.conn||[]).filter(c=>c!==node.id);n.reqs=n.reqs.filter(q=>!(q.kind==='node'&&q.node===node.id))});T.purgeNodes(d.sheets,[node.id])});close()}}>
      <p>Excluir <b>{node.name}</b>? As conexões e requisitos que apontam para ela serão removidos.</p>{nUn>0&&<p className="err">{nUn} ficha(s) têm esta habilidade desbloqueada; o desbloqueio será removido e os pontos gastos devolvidos.</p>}</Ask>}
  </div></div>;
}

// ---------- Página Árvore (menu) ----------
function PlayerTrees(){
  const {db,user,open}=useApp();
  if(!db.perms.viewTree)return <div><h2>🌳 Árvore de habilidades</h2><p className="empty">O Mestre não liberou a visualização da árvore.</p></div>;
  const L=db.sheets.filter(s=>!s.isTemplate&&s.owner===user.id&&T.getProg(s).trees.length);
  return <div><h2>🌳 Árvore de habilidades</h2>{!L.length&&<p className="empty">Nenhuma árvore atribuída às suas fichas ainda.</p>}
    {L.map(s=><section key={s.id} className="panel"><h3>{s.charName} <small>{s.name}</small><button className="btn sm" onClick={()=>open(s.id,'arvore')}>Abrir árvore</button></h3>
      <p className="txt">Pontos de habilidade: <b>{T.getProg(s).points}</b> · Nível {T.levelOf(s)}</p>
      <div className="chips">{(db.trees||[]).filter(t=>T.getProg(s).trees.includes(t.id)).map(t=>{const c=T.progressCount(s,t);return <span key={t.id} className="chip">{t.icon} {t.name}: {c.done} / {c.total}</span>})}</div></section>)}</div>;
}

export function TreesPage(){
  const {db,isM,camp,upd,open}=useApp(),trees=db.trees||[];
  const [tid,setTid]=useState(trees[0]?.id),[tab,setTab]=useState('estrutura'),[nid,setNid]=useState(null),[del,setDel]=useState(false);
  if(!isM)return <PlayerTrees/>;
  const tree=trees.find(t=>t.id===tid)||trees[0],sheets=db.sheets.filter(s=>!s.isTemplate),node=tree?.nodes.find(n=>n.id===nid);
  const edT=fn=>upd(d=>fn(d.trees.find(t=>t.id===tree.id)));
  const create=()=>{const t=T.newTree(camp.id,'Nova árvore');upd(d=>{(d.trees??=[]).push(t)});setTid(t.id);setTab('estrutura')};
  const addNode=()=>{const y=tree.nodes.length?Math.max(...tree.nodes.map(n=>n.y))+170:0,n=T.newNode(0,y);edT(t=>{t.nodes.push(n)});setNid(n.id)};
  const assign=(sid)=>upd(d=>{const s=d.sheets.find(x=>x.id===sid),q=T.normProg(s);q.trees.includes(tree.id)||q.trees.push(tree.id)});
  const rows=tree?sheets.filter(s=>T.getProg(s).trees.includes(tree.id)):[],free=tree?sheets.filter(s=>!T.getProg(s).trees.includes(tree.id)):[];
  const own=u=>db.users.find(x=>x.id===u)?.display||db.users.find(x=>x.id===u)?.name||'—';
  const ids=tree?tree.nodes.map(n=>n.id):[];
  return <div><h2>🌳 Árvores de habilidades</h2>
    <p className="sub">As árvores são compartilhadas na campanha <b>{camp.name}</b>; o progresso e os pontos são individuais de cada ficha.</p>
    <div className="tabs">{trees.map(t=><button key={t.id} className={t.id===tree?.id?'on':''} onClick={()=>{setTid(t.id);setNid(null)}}>{t.icon} {t.name}</button>)}<button className="newtab" onClick={create}>＋ NOVA ÁRVORE</button></div>
    {!tree&&<p className="empty">Nenhuma árvore ainda. Crie a primeira (Espadachim, Mago, Assassino...).</p>}
    {tree&&<>
      <div className="panel"><div className="row nw"><input className="ic" value={tree.icon} onChange={e=>edT(t=>{t.icon=e.target.value})}/><input value={tree.name} onChange={e=>edT(t=>{t.name=e.target.value})}/>
        <button className="x" title="Excluir árvore" onClick={()=>setDel(true)}>🗑️</button></div>
        <input placeholder="Descrição" value={tree.desc||''} onChange={e=>edT(t=>{t.desc=e.target.value})}/>
        {tree.migratedFrom&&<p className="sub">ℹ️ Árvore criada automaticamente a partir das árvores antigas de {tree.migratedFrom.length} ficha(s). O progresso de cada ficha foi preservado e as árvores antigas continuam guardadas dentro das fichas.</p>}</div>
      <div className="tabs"><button className={tab==='estrutura'?'on':''} onClick={()=>setTab('estrutura')}>🧩 Estrutura</button><button className={tab==='progresso'?'on':''} onClick={()=>setTab('progresso')}>📊 Progresso dos jogadores</button></div>
      {tab==='estrutura'&&<><div className="row"><button className="btn" onClick={addNode}>＋ NOVA HABILIDADE</button><small className="sub">Arraste os cartões para posicionar · toque num cartão para editar.</small></div>
        <Canvas key={tree.id} tree={tree} edit sel={nid} onSel={n=>setNid(n.id)} onMove={(id,x,y)=>edT(t=>{const n=t.nodes.find(q=>q.id===id);n.x=x;n.y=y})}/></>}
      {tab==='progresso'&&<div>
        <div className="row"><select value="" onChange={e=>e.target.value&&assign(e.target.value)}><option value="">＋ Atribuir esta árvore a uma ficha…</option>{free.map(s=><option key={s.id} value={s.id}>{s.charName} ({own(s.owner)})</option>)}</select></div>
        {!rows.length&&<p className="empty">Nenhuma ficha usa esta árvore ainda.</p>}
        {rows.map(s=>{const c=T.progressCount(s,tree),p=T.getProg(s);return <div className="panel" key={s.id}>
          <div className="row"><b>{own(s.owner)}</b><span>Ficha: {s.charName}</span><span className="chip">{c.done} / {c.total} habilidades</span><span>💠 {p.points} pontos</span><span>Nível {T.levelOf(s)}</span>
            <button className="btn sm" onClick={()=>open(s.id,'arvore')}>Abrir / liberar</button></div>
          <div className="bar"><i style={{width:(c.total?c.done/c.total*100:0)+'%',background:tree.color}}/></div>
          <div className="chips">{tree.nodes.filter(n=>p.unlocked[n.id]).map(n=><span className="chip" key={n.id}>{n.icon} {n.name}{p.unlocked[n.id].master?' 👑':''}</span>)}{!c.done&&<small className="empty">Nada desbloqueado.</small>}</div></div>})}</div>}
      {node&&<NodeEditor key={node.id} tree={tree} node={node} sheets={sheets} close={()=>setNid(null)}/>}
      {del&&<Ask title="Excluir árvore" danger yes="EXCLUIR" onNo={()=>setDel(false)} onYes={()=>{upd(d=>{T.purgeNodes(d.sheets,ids);d.sheets.forEach(s=>{if(s.treeProg)s.treeProg.trees=s.treeProg.trees.filter(i=>i!==tree.id)});d.trees=d.trees.filter(t=>t.id!==tree.id)});setDel(false);setTid(null)}}>
        <p>Excluir a árvore <b>{tree.name}</b> ({tree.nodes.length} habilidades)?</p><p className="err">{rows.length} ficha(s) usam esta árvore. Os desbloqueios dela serão removidos e os pontos gastos devolvidos.</p></Ask>}</>}
  </div>;
}

// Palco da ficha: 900px lógicos, reduzido proporcionalmente em telas menores (mín. 0,6; abaixo disso rola na horizontal).
// Arrastar/redimensionar usam um RASCUNHO local (state); só ao soltar chama onCommit (uma gravação por operação).
import {useState,useRef,useEffect,useLayoutEffect} from 'react';
import {moveGroup,resizeBox,TYPES} from './layoutLogic.js';
import {ElementView} from './ElementView.jsx';
const HANDLES={nw:[0,0,'nwse'],n:[.5,0,'ns'],ne:[1,0,'nesw'],e:[1,.5,'ew'],se:[1,1,'nwse'],s:[.5,1,'ns'],sw:[0,1,'nesw'],w:[0,.5,'ew']};
const MINSCALE=.6;

export default function VisualCanvas({layout,ctx,edit=false,selId=null,onSelect=()=>{},onCommit=()=>{},grid=10,showGrid=false,snapOn=false}){
  const wrap=useRef(),drag=useRef(null),stop=useRef(null);
  const [cw,setCw]=useState(900),[draft,setDraft]=useState(null);
  useLayoutEffect(()=>{
    const el=wrap.current;if(!el)return;const f=()=>setCw(el.clientWidth||900);f();
    const ro=new ResizeObserver(f);ro.observe(el);return()=>ro.disconnect();
  },[]);
  useEffect(()=>()=>stop.current&&stop.current(),[]);
  const L=draft||layout,raw=cw/L.w,scale=Math.min(1,Math.max(MINSCALE,raw)),small=raw<MINSCALE;

  const start=(e,id,mode,handle)=>{
    if(!edit||e.button>0)return;
    e.stopPropagation();e.preventDefault();onSelect(id);
    drag.current={mode,id,handle,sx:e.clientX,sy:e.clientY,start:layout,moved:false,last:null};
    const mv=ev=>{
      const d=drag.current;if(!d)return;
      const dx=(ev.clientX-d.sx)/scale,dy=(ev.clientY-d.sy)/scale;
      if(!d.moved&&Math.hypot(dx,dy)*scale<3)return;     // clique simples não é arrasto
      d.moved=true;const g=snapOn?grid:0;
      d.last=d.mode==='move'?moveGroup(d.start,d.id,dx,dy,g):resizeBox(d.start,d.id,d.handle,dx,dy,g);
      setDraft(d.last);
    };
    const up=()=>{
      window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);stop.current=null;
      const d=drag.current;drag.current=null;setDraft(null);
      if(d?.moved&&d.last)onCommit(d.last);               // única gravação, ao terminar
    };
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
    stop.current=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up)};
  };

  const sel=edit&&L.els.find(e=>e.id===selId),b=L.border||{},bg=L.bg||{};
  const hs=10/scale;
  return <div className="vc-wrap" ref={wrap}>
    {small&&<div className="vc-warn">⚠️ A ficha visual ficou pequena demais para esta tela. Role para o lado ou use o <b>📋 Formulário clássico</b>.</div>}
    <div className={'vc-size'+(edit?' editing':'')} style={{width:L.w*scale,height:L.h*scale}}>
      <div className="vc-stage" style={{width:L.w,height:L.h,transform:`scale(${scale})`,backgroundColor:bg.color||undefined,borderRadius:b.radius||0}}
        onPointerDown={edit?e=>{if(e.target===e.currentTarget)onSelect(null)}:undefined}>
        {bg.img&&<div className="vc-bgimg" style={{backgroundImage:`url(${bg.img})`,opacity:bg.opacity??1,backgroundPosition:bg.pos||'center',
          backgroundSize:bg.size==='tile'?'auto':(bg.size||'cover'),backgroundRepeat:bg.size==='tile'?'repeat':'no-repeat'}}/>}
        {L.els.map(e=><div key={e.id} className={'vc-el'+(edit?' ed':'')} style={{left:e.x,top:e.y,width:e.w,height:e.h}}
          onPointerDown={edit?ev=>start(ev,e.id,'move'):undefined}><ElementView el={e} ctx={ctx}/></div>)}
        {edit&&showGrid&&<div className="vc-grid" style={{backgroundSize:`${grid}px ${grid}px,${grid}px ${grid}px,${grid*5}px ${grid*5}px,${grid*5}px ${grid*5}px`}}/>}
        {b.style&&b.style!=='none'&&b.width>0&&<div className="vc-border" style={{border:`${b.width}px ${b.style} ${b.color||'var(--bo,#6b5320)'}`,borderRadius:b.radius||0}}/>}
        {sel&&<div className="vc-sel" style={{left:sel.x,top:sel.y,width:sel.w,height:sel.h,outlineWidth:2/scale}}>
          <span className="vc-tag" style={{transform:`scale(${1/scale})`}}>{sel.name||TYPES[sel.type]||sel.type} · {sel.w}×{sel.h}</span>
          {Object.entries(HANDLES).map(([h,[px,py,cur]])=><i key={h} className="vc-h" style={{left:px*100+'%',top:py*100+'%',width:hs,height:hs,cursor:cur+'-resize'}}
            onPointerDown={ev=>start(ev,sel.id,'resize',h)}/>)}</div>}
      </div>
    </div>
  </div>;
}

// Editor visual (somente Mestre): barra de ferramentas + palco editável + painel lateral.
import {useState} from 'react';
import VisualCanvas from './VisualCanvas.jsx';
import {ElementProps,SheetProps} from './ElementProps.jsx';
import {TYPES,TYPE_ICON,addElement,defaultBind,duplicateElement,removeElement,layerOp} from './layoutLogic.js';

export default function VisualEditor({s,layout,commit,ctx,others}){
  const [sel,setSel]=useState(null),[showGrid,setShowGrid]=useState(true),[snapOn,setSnap]=useState(true),[gs,setGs]=useState(10),[menu,setMenu]=useState(false);
  const el=layout.els.find(e=>e.id===sel);
  const add=type=>{const r=addElement(layout,type,{bind:defaultBind(s,type,layout)});commit(r.layout);setSel(r.id);setMenu(false)};
  const ops=!el?null:<>
    <button className="btn sm" title="Duplicar" onClick={()=>{const r=duplicateElement(layout,el.id);commit(r.layout);setSel(r.id)}}>⧉</button>
    <button className="btn sm danger" title="Remover" onClick={()=>{if(confirm('Remover este elemento da ficha? Os dados da ficha NÃO serão apagados.')){commit(removeElement(layout,el.id));setSel(null)}}}>🗑️</button>
    <button className="btn sm" title="Trazer para frente" onClick={()=>commit(layerOp(layout,el.id,'front'))}>⏫</button>
    <button className="btn sm" title="Subir" onClick={()=>commit(layerOp(layout,el.id,'up'))}>🔼</button>
    <button className="btn sm" title="Descer" onClick={()=>commit(layerOp(layout,el.id,'down'))}>🔽</button>
    <button className="btn sm" title="Enviar para trás" onClick={()=>commit(layerOp(layout,el.id,'back'))}>⏬</button></>;
  return <div className="ve">
    <div className="vetb">
      <div className="vemenu"><button className="btn sm" onClick={()=>setMenu(!menu)}>＋ Adicionar elemento</button>
        {menu&&<div className="panel vepop">{Object.entries(TYPES).map(([k,l])=><button key={k} onClick={()=>add(k)}>{TYPE_ICON[k]} {l}</button>)}</div>}</div>
      <label className="sw"><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/> Mostrar grade</label>
      <label className="sw"><input type="checkbox" checked={snapOn} onChange={e=>setSnap(e.target.checked)}/> Encaixar na grade</label>
      <select value={gs} onChange={e=>setGs(+e.target.value)} title="Tamanho da grade"><option value={10}>10 px</option><option value={20}>20 px</option><option value={40}>40 px</option></select>
      {ops}
    </div>
    <p className="sub vehint">Arraste para mover, use os pontos para redimensionar. Para criar ou apagar atributos, status, itens etc., use o 📋 Formulário clássico — aqui você só define como eles aparecem.</p>
    <div className="vebody">
      <VisualCanvas layout={layout} ctx={ctx} edit selId={sel} onSelect={setSel} onCommit={commit} grid={gs} showGrid={showGrid} snapOn={snapOn}/>
      <div className="veside">{el?<ElementProps key={el.id} el={el} s={s} layout={layout} commit={commit} onSel={setSel}/>:<SheetProps s={s} layout={layout} commit={commit} others={others}/>}</div>
    </div>
  </div>;
}

import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()]});

node_modules
dist
.DS_Store
*.log
.env
.env.local
.vercel

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

import {useState} from 'react';
import {useApp} from './ctx.js';
import {uid,now,readImage,newPerms} from './storage.js';
import {campaignsFor,PER_CAMPAIGN} from './repo.js';

const Fields=({v,on})=><>
  <label className="lab">Nome da campanha<input value={v.name} onChange={e=>on('name',e.target.value)}/></label>
  <label className="lab">Descrição<textarea rows={3} value={v.desc||''} onChange={e=>on('desc',e.target.value)}/></label>
  <div className="row"><label className="btn sm">🖼️ Capa<input hidden type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];f&&readImage(f,u=>on('cover',u),700);e.target.value=''}}/></label>
    {v.cover&&<button className="btn sm danger" onClick={()=>on('cover','')}>Remover capa</button>}
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
  const {db,user,isM,upd}=useApp();const [dlg,setDlg]=useState(false);const list=campaignsFor(db,user);
  return <div className="worlds"><header className="row"><h1>🌍 {isM?'Minhas campanhas':'Escolha sua campanha'}</h1>
    <span>{isM?'👑':'🛡️'} {user.display||user.name}</span><button className="btn sm" onClick={()=>upd(d=>{d.session=null})}>Sair</button></header>
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

import {createContext,useContext} from 'react';
export const Ctx=createContext();
export const useApp=()=>useContext(Ctx);

import {useState} from 'react';
import {useApp} from './ctx.js';
import {uid} from './storage.js';
import {Rich} from './Sheet.jsx';
export default function Diary(){
  const {db,user,isM,upd}=useApp();
  const all=db.diary||[],[sel,setSel]=useState(null),[pg,setPg]=useState(0);
  const seen=c=>isM||c.vis==='all'||(c.vis==='some'&&(c.ids||[]).includes(user.id));
  const ch=all.find(c=>c.id===sel);
  const ed=fn=>upd(d=>fn(d.diary.find(c=>c.id===sel)));
  const players=db.users.filter(u=>u.role==='player');
  return <div><h2>📖 Diário</h2><div className="diary">
    <div className="panel chs">{all.map((c,i)=>seen(c)
      ?<button key={c.id} className={'chap'+(sel===c.id?' on':'')} onClick={()=>{setSel(c.id);setPg(0)}}>📖 {c.title}{isM&&c.vis!=='all'?' 🔒':''}</button>
      :<div key={c.id} className="chap lock">🔒 Capítulo {i+1} — ???</div>)}
      {isM&&<button className="btn sm" onClick={()=>{const id=uid();upd(d=>{(d.diary??=[]).push({id,title:'Novo capítulo',pages:[''],vis:'master',ids:[],paper:'#f3e6c4',ink:'#3b2a14',font:'Georgia, serif'})});setSel(id);setPg(0)}}>＋ NOVO CAPÍTULO</button>}
      {!all.length&&<p className="empty">O livro ainda está em branco.</p>}</div>
    {ch&&seen(ch)?<div>
      {isM&&<div className="panel"><input className="big" value={ch.title} onChange={e=>ed(c=>{c.title=e.target.value})}/>
        <div className="row"><select value={ch.vis} onChange={e=>ed(c=>{c.vis=e.target.value})}><option value="all">🌐 Todos os jogadores</option><option value="some">👤 Jogadores específicos</option><option value="master">🔒 Somente Mestre</option></select>
          <label className="pick">Papel<input type="color" value={ch.paper} onChange={e=>ed(c=>{c.paper=e.target.value})}/></label>
          <label className="pick">Tinta<input type="color" value={ch.ink} onChange={e=>ed(c=>{c.ink=e.target.value})}/></label>
          <select value={ch.font} onChange={e=>ed(c=>{c.font=e.target.value})}>{[['Georgia, serif','Clássica'],['"Palatino Linotype", serif','Palatino'],['system-ui, sans-serif','Moderna'],['"Brush Script MT", cursive','Manuscrita'],['"Courier New", monospace','Máquina']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
        {ch.vis==='some'&&<div className="chips">{players.map(p=><label key={p.id} className="chip"><input type="checkbox" checked={(ch.ids||[]).includes(p.id)} onChange={e=>ed(c=>{c.ids=e.target.checked?[...(c.ids||[]),p.id]:(c.ids||[]).filter(i=>i!==p.id)})}/> {p.name}</label>)}</div>}
        <div className="row"><button className="btn sm" onClick={()=>{ed(c=>{c.pages.push('')});setPg(ch.pages.length)}}>＋ Página</button>
          {ch.pages.length>1&&<button className="btn sm danger" onClick={()=>{ed(c=>{c.pages.splice(pg,1)});setPg(Math.max(0,pg-1))}}>Excluir página</button>}
          <button className="x" onClick={()=>{if(confirm('Excluir capítulo?')){upd(d=>{d.diary=d.diary.filter(c=>c.id!==sel)});setSel(null)}}}>🗑️</button></div></div>}
      <div className="book" style={{background:ch.paper,color:ch.ink,fontFamily:ch.font}}>
        {pg===0&&<h2 style={{color:ch.ink,textAlign:'center'}}>{ch.title}</h2>}
        <Rich key={ch.id+pg} html={ch.pages[pg]||''} can={isM} save={h=>ed(c=>{c.pages[pg]=h})}/></div>
      <div className="row pager"><button className="btn sm" disabled={pg<1} onClick={()=>setPg(pg-1)}>← Página anterior</button>
        <span>Página {pg+1} / {ch.pages.length}</span>
        <button className="btn sm" disabled={pg>=ch.pages.length-1} onClick={()=>setPg(pg+1)}>Próxima página →</button></div></div>
    :<p className="empty">Escolha um capítulo para ler.</p>}</div></div>;
}

import {uid,now} from './storage.js';
// Fórmulas: dados (2d6, d20) + números + atributos da ficha pelo nome. Ex.: "2d10 + Força * 2"
export function roll(expr,attrs=[]){
  const map={};attrs.forEach(a=>{map[String(a.name).trim().toLowerCase()]=+a.value||0});
  let s=String(expr).replace(/(\d*)d(\d+)/gi,(_,n,f)=>{n=+n||1;f=+f;if(n>100||f<1||f>1000)throw 0;
    const r=Array.from({length:n},()=>1+Math.floor(Math.random()*f));return n===1?String(r[0]):'('+r.join('+')+')'});
  s=s.replace(/[A-Za-zÀ-ÿ_]+/g,w=>{const v=map[w.toLowerCase()];if(v===undefined)throw 0;return String(v)});
  if(!/^[\d\s+\-*/().]+$/.test(s))throw 0;
  const total=Math.floor(Function('"use strict";return ('+s+')')());
  if(!Number.isFinite(total))throw 0;
  return {detail:s.replace(/\*/g,'×').replace(/\s+/g,' ').trim(),total};
}
export const logRoll=(d,user,sheet,expr,r)=>{d.rolls=[{id:uid(),user:user.id,sheet,expr,detail:r.detail,total:r.total,at:now()},...(d.rolls||[])].slice(0,100)};
export const ago=t=>{const m=Math.round((Date.now()-new Date(t))/6e4);return m<1?'agora':m<60?`há ${m} min`:m<1440?`há ${Math.round(m/60)} h`:`há ${Math.round(m/1440)} d`};

import {useState} from 'react';
import {useApp} from './ctx.js';
import {roll,logRoll,ago} from './dice.js';
export default function Dice(){
  const {db,user,isM,upd}=useApp();
  const sheets=db.sheets.filter(s=>!s.isTemplate&&(isM||s.owner===user.id));
  const [sid,setSid]=useState(sheets[0]?.id||''),[ex,setEx]=useState('1d20'),[res,setRes]=useState(null);
  const attrs=sheets.find(s=>s.id===sid)?.attrs||[];
  const go=()=>{try{const r=roll(ex,attrs);setRes(r);upd(d=>logRoll(d,user,sid,ex,r))}catch{setRes({err:1})}};
  const hist=(db.rolls||[]).filter(r=>isM||r.user===user.id).slice(0,30);
  return <div><h2>🎲 Rolador de dados</h2><div className="panel">
    <div className="chips">{[4,6,8,10,12,20,100].map(n=><button key={n} className="btn sm" onClick={()=>setEx(e=>(e.trim()?e+' + ':'')+'1d'+n)}>d{n}</button>)}
      <button className="btn sm danger" onClick={()=>setEx('')}>Limpar</button></div>
    <label className="lab">Ficha (fornece os atributos){attrs.length>0&&<small>: {attrs.map(a=>a.name).join(', ')}</small>}
      <select value={sid} onChange={e=>setSid(e.target.value)}><option value="">Nenhuma</option>{sheets.map(s=><option key={s.id} value={s.id}>{s.charName}</option>)}</select></label>
    <div className="row nw"><input value={ex} placeholder="1d20 + Força" onChange={e=>setEx(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()}/><button className="btn" onClick={go}>🎲 ROLAR</button></div>
    {res&&(res.err?<p className="err">Fórmula inválida. Use dados (2d6), números e nomes de atributos da ficha.</p>:<div className="result" key={Math.random()}><small>🎲 {res.detail}</small><b>TOTAL: {res.total}</b></div>)}</div>
    <h3>Rolagens recentes</h3>
    {hist.map(r=><div className="panel hrow" key={r.id}><span>🎲 {isM&&r.user!==user.id&&<b>{db.users.find(u=>u.id===r.user)?.name}: </b>}{r.expr}</span><b>{r.total}</b><small>{ago(r.at)}</small></div>)}
    {!hist.length&&<p className="empty">Nenhuma rolagem ainda.</p>}</div>;
}

// Painéis laterais do editor: propriedades do elemento selecionado e propriedades da ficha (fundo, borda, altura, cópia de layout).
import {useState,useEffect,useRef} from 'react';
import {TYPES,FONTS,COLL,GROUP,CORE,setElement,setBg,setBorder,setCanvasHeight,layerOp,duplicateElement,removeElement,defaultLayout,copyLayout} from './layoutLogic.js';
import {Up} from './sheetParts.jsx';

// Número: edita localmente e confirma ao sair do campo / Enter (evita uma gravação por tecla).
function Num({label,value,on,min,max,ph}){
  const [v,setV]=useState(String(value));useEffect(()=>setV(String(value)),[value]);
  const done=()=>{const n=Math.round(+v);if(v!==''&&Number.isFinite(n)&&n!==value)on(n);else setV(String(value))};
  return <label className="lab">{label}<input type="number" value={v} min={min} max={max} placeholder={ph} onChange={e=>setV(e.target.value)} onBlur={done} onKeyDown={e=>e.key==='Enter'&&e.target.blur()}/></label>;
}
// Cor: debounce de 150 ms (o seletor dispara continuamente enquanto arrasta). "↺" volta ao padrão do tema.
function Col({label,value,on,fallback='#888888'}){
  const [v,setV]=useState(value||fallback),t=useRef();useEffect(()=>setV(value||fallback),[value,fallback]);
  const ch=x=>{setV(x);clearTimeout(t.current);t.current=setTimeout(()=>on(x),150)};
  return <label className="pick">{label}<input type="color" value={v} onChange={e=>ch(e.target.value)}/>{value?<button type="button" className="x" title="Usar a cor padrão" onClick={()=>on('')}>↺</button>:<small className="empty">padrão</small>}</label>;
}

const bindValue=b=>!b?'':b.kind==='core'?'c:'+b.key:b.kind==='tab'?'t:'+b.id:b.id?'i:'+b.id:'g';
function bindFrom(type,v){
  if(v==='')return null;if(v==='g')return {kind:GROUP[type]};
  const [k,id]=[v.slice(0,1),v.slice(2)];
  return k==='c'?{kind:'core',key:id}:k==='t'?{kind:'tab',id}:{kind:type,id};
}

export function ElementProps({el,s,layout,commit,onSel}){
  const set=p=>commit(setElement(layout,el.id,p)),st=p=>set({st:p}),t=el.type,S=el.st||{};
  const opts=[];
  if(t==='text'){opts.push(['','Texto livre']);(s.tabs||[]).forEach(x=>opts.push(['t:'+x.id,'Aba: '+x.title]))}
  else if(COLL[t]){
    opts.push(['g','Todos (grupo — acompanha dados novos)']);
    if(t==='field')Object.entries(CORE).forEach(([k,l])=>opts.push(['c:'+k,l]));
    (s[COLL[t]]||[]).forEach(o=>opts.push(['i:'+o.id,t==='field'?'Campo: '+(o.k||'(sem nome)'):(o.name||'(sem nome)')]));
  }
  const cur=bindValue(el.bind);
  if(cur&&!opts.some(o=>o[0]===cur))opts.push([cur,'⚠️ dado removido']);
  if(!cur&&COLL[t])opts.unshift(['','— escolha —']);
  const del=()=>{if(confirm('Remover este elemento da ficha? Os dados da ficha NÃO serão apagados.')){commit(removeElement(layout,el.id));onSel(null)}};
  const dup=()=>{const r=duplicateElement(layout,el.id);commit(r.layout);onSel(r.id)};
  const lay=op=>commit(layerOp(layout,el.id,op));
  return <div className="ep">
    <h4>{TYPES[t]||t}</h4>
    <div className="row"><button className="btn sm" title="Duplicar" onClick={dup}>⧉ Duplicar</button><button className="btn sm danger" onClick={del}>🗑️ Remover</button></div>
    <div className="row"><small>Camada:</small><button className="btn sm" title="Trazer para frente" onClick={()=>lay('front')}>⏫</button><button className="btn sm" title="Subir" onClick={()=>lay('up')}>🔼</button>
      <button className="btn sm" title="Descer" onClick={()=>lay('down')}>🔽</button><button className="btn sm" title="Enviar para trás" onClick={()=>lay('back')}>⏬</button></div>
    <label className="lab">Nome (só no editor)<input value={el.name||''} onChange={e=>set({name:e.target.value})}/></label>
    {opts.length>0&&<label className="lab">{t==='text'?'Conteúdo':'Dado mostrado'}<select value={cur} onChange={e=>set({bind:bindFrom(t,e.target.value)})}>{opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}
    {t==='text'&&!el.bind&&<label className="lab">Texto<textarea rows={3} value={el.text||''} onChange={e=>set({text:e.target.value})}/></label>}
    {t!=='image'&&<label className="lab">Título<input value={el.title||''} onChange={e=>set({title:e.target.value})}/></label>}
    {t==='image'&&<><div className="row"><Up label="🖼️ Enviar imagem" max={900} on={u=>set({src:u,useCover:false})}/>{el.src&&<button className="btn sm" onClick={()=>set({src:''})}>Remover</button>}</div>
      <label className="sw"><input type="checkbox" checked={!!el.useCover} onChange={e=>set({useCover:e.target.checked})}/> Usar o retrato do personagem</label>
      <label className="lab">Ajuste<select value={el.imgFit||'cover'} onChange={e=>set({imgFit:e.target.value})}><option value="cover">Preencher (corta o excesso)</option><option value="contain">Conter (mostra inteira)</option><option value="center">Centralizar (tamanho original)</option></select></label></>}
    {t==='field'&&<><label className="sw"><input type="checkbox" checked={el.showLabel!==false} onChange={e=>set({showLabel:e.target.checked})}/> Mostrar rótulo</label>
      <label className="sw"><input type="checkbox" checked={!!el.stack} onChange={e=>set({stack:e.target.checked})}/> Rótulo acima do valor</label></>}
    <h5>Posição e tamanho</h5>
    <div className="g2"><Num label="X" value={el.x} on={v=>set({x:v})}/><Num label="Y" value={el.y} on={v=>set({y:v})}/><Num label="Largura" value={el.w} on={v=>set({w:v})}/><Num label="Altura" value={el.h} on={v=>set({h:v})}/></div>
    <h5>Texto</h5>
    <label className="lab">Fonte<select value={S.font||''} onChange={e=>st({font:e.target.value})}>{FONTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <div className="g2"><Num label="Tamanho (0 = padrão)" value={S.size||0} min={0} max={120} on={v=>st({size:Math.max(0,v)})}/>
      <label className="lab">Alinhamento<select value={S.al||'left'} onChange={e=>st({al:e.target.value})}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></div>
    <label className="sw"><input type="checkbox" checked={!!S.bold} onChange={e=>st({bold:e.target.checked})}/> Negrito</label>
    {(t==='text'||t==='field')&&<label className="sw"><input type="checkbox" checked={!!S.fit} onChange={e=>st({fit:e.target.checked})}/> Ajustar o texto ao espaço</label>}
    <h5>Cores e borda</h5>
    <div className="row"><Col label="Texto" value={S.color} on={v=>st({color:v})}/><Col label="Destaque" value={S.acc} on={v=>st({acc:v})}/></div>
    <div className="row"><Col label="Fundo" value={S.bg} on={v=>st({bg:v})}/><Col label="Borda" value={S.bd} on={v=>st({bd:v})}/></div>
    <label className="lab">Transparência do fundo: {Math.round((1-(S.bga??1))*100)}%<input type="range" min="0" max="100" value={Math.round((1-(S.bga??1))*100)} onChange={e=>st({bga:1-e.target.value/100})}/></label>
    <label className="lab">Opacidade do elemento: {Math.round((S.op??1)*100)}%<input type="range" min="10" max="100" value={Math.round((S.op??1)*100)} onChange={e=>st({op:e.target.value/100})}/></label>
    <div className="g2"><Num label="Espessura da borda" value={S.bw||0} min={0} max={20} on={v=>st({bw:Math.max(0,v)})}/><Num label="Arredondamento" value={S.rad||0} min={0} max={200} on={v=>st({rad:Math.max(0,v)})}/></div>
    <label className="sw"><input type="checkbox" checked={!!S.panel} onChange={e=>st({panel:e.target.checked})}/> Aparência de painel (fundo e borda do tema)</label>
  </div>;
}

export function SheetProps({s,layout,commit,others}){
  const [from,setFrom]=useState('');
  const bg=layout.bg,bd=layout.border;
  const copy=()=>{const o=others.find(x=>x.id===from);if(!o)return;
    if(confirm(`Substituir o layout desta ficha por uma CÓPIA do layout de "${o.name}"? A origem não será alterada.`))commit(copyLayout(o,s))};
  const reset=()=>{if(confirm('Restaurar o layout padrão? O layout atual será substituído (os dados da ficha não mudam).'))commit(defaultLayout(s))};
  return <div className="ep">
    <h4>Ficha</h4><p className="sub">Clique num elemento para editá-lo. Largura fixa: {layout.w}px.</p>
    <Num label="Altura da ficha (px)" value={layout.h} min={200} on={v=>commit(setCanvasHeight(layout,v))}/>
    <h5>Fundo</h5>
    <div className="row"><Col label="Cor" value={bg.color} on={v=>commit(setBg(layout,{color:v}))}/></div>
    <div className="row"><Up label="🖼️ Imagem de fundo" max={1400} on={u=>commit(setBg(layout,{img:u}))}/>{bg.img&&<button className="btn sm" onClick={()=>commit(setBg(layout,{img:''}))}>Remover</button>}</div>
    {bg.img&&<><label className="lab">Opacidade da imagem: {Math.round((bg.opacity??1)*100)}%<input type="range" min="0" max="100" value={Math.round((bg.opacity??1)*100)} onChange={e=>commit(setBg(layout,{opacity:e.target.value/100}))}/></label>
      <div className="g2"><label className="lab">Posição<select value={bg.pos} onChange={e=>commit(setBg(layout,{pos:e.target.value}))}>{[['center','Centro'],['top','Topo'],['bottom','Base'],['left','Esquerda'],['right','Direita']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="lab">Tamanho<select value={bg.size} onChange={e=>commit(setBg(layout,{size:e.target.value}))}><option value="cover">Cobrir</option><option value="contain">Conter</option><option value="tile">Repetir (textura)</option></select></label></div></>}
    <h5>Borda da ficha</h5>
    <label className="lab">Estilo<select value={bd.style} onChange={e=>commit(setBorder(layout,{style:e.target.value,width:e.target.value!=='none'&&!bd.width?(e.target.value==='double'?6:3):bd.width}))}><option value="none">Sem borda</option><option value="solid">Simples</option><option value="double">Dupla</option><option value="dashed">Tracejada</option><option value="dotted">Pontilhada</option></select></label>
    <div className="g2"><Num label="Espessura" value={bd.width||0} min={0} max={30} on={v=>commit(setBorder(layout,{width:Math.max(0,v)}))}/><Num label="Arredondamento" value={bd.radius||0} min={0} max={80} on={v=>commit(setBorder(layout,{radius:Math.max(0,v)}))}/></div>
    <div className="row"><Col label="Cor da borda" value={bd.color} on={v=>commit(setBorder(layout,{color:v}))}/></div>
    <h5>Layout</h5>
    <label className="lab">Copiar layout de…<select value={from} onChange={e=>setFrom(e.target.value)}><option value="">— escolha uma ficha ou modelo —</option>{others.map(o=><option key={o.id} value={o.id}>{o.isTemplate?'🧩':'📜'} {o.name}</option>)}</select></label>
    <div className="row"><button className="btn sm" disabled={!from} onClick={copy}>📥 Copiar</button><button className="btn sm danger" onClick={reset}>↺ Layout padrão</button></div>
  </div>;
}

// Mostra UM elemento do layout. Todo valor vem da ficha (resolveEl); o layout só decide onde/como.
// Edição de dados reaproveita ctx.F (a mesma função da ficha clássica), então permissões/vis/LOCK valem igual.
import {useLayoutEffect,useRef} from 'react';
import {calcMod} from './model.js';
import {resolveEl,rgba,CORE,TYPES} from './layoutLogic.js';
import {Rich} from './sheetParts.jsx';
import {levelOf,getProg} from './treeLogic.js';

// Texto responsivo: com `on`, reduz a fonte (mín. 9px) até caber; sem `on`, quebra linha e rola dentro da caixa.
function Fit({on,children,className=''}){
  const r=useRef();
  useLayoutEffect(()=>{
    const el=r.current;if(!el)return;el.style.fontSize='';if(!on)return;
    let fs=parseFloat(getComputedStyle(el).fontSize)||16;
    while(fs>9&&(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)){fs-=1;el.style.fontSize=fs+'px'}
  });
  return <div ref={r} className={'evfit '+(on?'':'sc ')+className}>{children}</div>;
}

export function boxStyle(el){
  const st=el.st||{},v={};
  if(st.bg)v.background=rgba(st.bg,st.bga??1);
  if(st.bw)v.border=`${st.bw}px solid ${st.bd||'var(--bo,#6b5320)'}`;else if(st.bd&&el.type==='image')v.border='0';
  if(st.rad)v.borderRadius=st.rad;
  if(st.color)v.color=st.color;
  if(st.font)v.fontFamily=st.font;
  if(st.size)v.fontSize=st.size;
  if(st.al)v.textAlign=st.al;
  if(st.bold)v.fontWeight='bold';
  if(st.op!=null&&st.op<1)v.opacity=st.op;
  if(st.acc){v['--at']=st.acc;v['--ti']=st.acc}
  return v;
}

export function ElementView({el,ctx}){
  const {s,isM,can,ed,F}=ctx,r=resolveEl(s,el,{isM}),st=el.st||{};
  if(r.hidden&&!isM)return null;
  const cls='ev'+(st.panel?' pn':'')+(el.type==='section'?' sec':'');
  const wrap=body=><div className={cls} style={boxStyle(el)}>{el.title?<div className="evt">{el.title}</div>:null}<div className="evb">{body}</div></div>;
  if(!r.ok){
    if(!isM)return null;
    return wrap(<div className="evmiss">⚠️ {r.reason==='removed'?'Dado removido da ficha':r.reason==='unknown'?'Tipo de elemento desconhecido ('+el.type+')':'Escolha o dado no painel'}</div>);
  }
  const t=el.type;
  if(t==='section')return <div className={cls} style={boxStyle(el)}>{el.title&&<div className="evt">{el.title}</div>}</div>;

  if(t==='text'){
    if(r.tab)return wrap(<Rich key={r.tab.id} html={r.tab.html} can={can} save={h=>ed(x=>{x.tabs.find(q=>q.id===r.tab.id).html=h})}/>);
    return wrap(<Fit on={st.fit}><div className="evtxt">{el.text}</div></Fit>);
  }

  if(t==='image'){
    const src=el.useCover?s.cover:el.src,fit=el.imgFit==='center'?'none':(el.imgFit||'cover');
    return <div className={cls} style={boxStyle(el)}>{src?<img className="evimg" src={src} alt="" style={{objectFit:fit}}/>:<div className="evimg ph">🖼️</div>}</div>;
  }

  if(t==='field'){
    if(r.core){
      const k=r.core,val=k==='level'?levelOf(s):(s[k]??''),edit=k==='level'?isM:can;
      const input=edit?<input value={val} type={k==='level'?'number':'text'} min={k==='level'?1:undefined} onChange={e=>ed(x=>{x[k]=k==='level'?Math.max(1,parseInt(e.target.value,10)||1):e.target.value})}/>:<span className="txt">{val}</span>;
      return wrap(<Fit on={st.fit} className={el.stack||!el.showLabel?'col':'rw'}>{el.showLabel&&<b className="evlab">{CORE[k]}</b>}{input}</Fit>);
    }
    return wrap(<Fit on={false}>{r.rows.map(({i,obj})=><div className={'evrow'+(el.stack?' col':'')} key={obj.id}><b className="k">{F('fields',i,'k','Campo',{c:'k'})}</b>{F('fields',i,'v','Valor')}</div>)}
      {!r.rows.length&&<small className="empty">Sem dados.</small>}</Fit>);
  }

  if(t==='attr')return wrap(<Fit on={false}><div className={'attrs'+(r.group?'':' one')}>{r.rows.map(({i,obj:a})=><div className="attr" key={a.id}>
    {F('attrs',i,'name','Nome',{c:'an'})}{F('attrs',i,'value','0',{num:1,c:'av'})}{s.useMod&&a.mod&&<b className="mod">{calcMod(s.formula,a.value)}</b>}</div>)}</div>
    {!r.rows.length&&<small className="empty">Sem atributos.</small>}</Fit>);

  if(t==='status')return wrap(<Fit on={false}>{r.rows.map(({i,obj:x})=><div className="stat" key={x.id}>
    <div className="sh"><span>{x.icon} {F('status',i,'name','Nome')}</span><span className="nums">{F('status',i,'cur','',{num:1,c:'n'})}/{F('status',i,'max','',{num:1,c:'n'})}</span></div>
    <div className="bar"><i style={{width:Math.max(0,Math.min(100,x.max?x.cur/x.max*100:0))+'%',background:x.color}}/></div></div>)}
    {!r.rows.length&&<small className="empty">Sem status.</small>}</Fit>);

  if(t==='money')return wrap(<Fit on={false}>{r.rows.map(({i,obj:m})=><div className="coin" key={m.id} style={{borderColor:m.color}}>
    <span className="em">{F('money',i,'emoji','💰',{c:'ic'})}</span>{F('money',i,'name','Nome')}{F('money',i,'qty','0',{num:1,c:'n'})}</div>)}
    {!r.rows.length&&<small className="empty">Sem dinheiro.</small>}</Fit>);

  if(t==='item'||t==='skill'){
    const sk=t==='skill',kind=sk?'skills':'items';
    return wrap(<Fit on={false}><div className="chips">{r.rows.map(({obj:c})=>sk&&!c.on&&!isM
      ?<span className="chip evchip lock" key={c.id}>🔒 Bloqueada</span>
      :<button className="chip evchip" key={c.id} style={{borderColor:c.bc}} onClick={()=>ctx.open(kind,c.id)}>{c.icon} {c.name}{!sk&&c.qty?` ×${c.qty}`:''}</button>)}</div>
      {!r.rows.length&&<small className="empty">{sk?'Sem habilidades.':'Sem itens.'}</small>}</Fit>);
  }

  if(t==='marks'){const m=s.marks||[];
    return wrap(<Fit on={false}><div className="chips">{m.map(x=><span className="chip mk" key={x.id}>🏷️ {x.name}</span>)}{!m.length&&<small className="empty">Nenhuma condição/marca.</small>}</div></Fit>);}

  if(t==='tree'){
    if(!ctx.showTree&&!isM)return null;
    const p=getProg(s);
    return wrap(<Fit on={false}><div className="row"><b>Nível {levelOf(s)}</b><span>· Pontos de habilidade: {p.points}</span></div>
      <button className="btn sm" onClick={()=>ctx.open('tree')}>🌳 Abrir árvore de habilidades</button></Fit>);
  }

  if(t==='gallery'){const im=s.images||[];
    return wrap(<Fit on={false}><div className="evgal">{im.slice(0,6).map(i=><img key={i.id} src={i.src} alt=""/>)}</div>
      {!im.length&&<small className="empty">Sem imagens.</small>}<button className="btn sm" onClick={()=>ctx.openTab('galeria')}>🖼️ Abrir galeria</button></Fit>);}

  return wrap(<div className="evmiss">{TYPES[t]||t}</div>);
}

<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>Fichas de RPG</title></head>
<body><div id="root"></div><script type="module" src="/main.jsx"></script></body></html>

// Lógica pura do layout visual da ficha (sem React / sem DOM). Tudo aqui é testável com `node --test`.
//
// PRINCÍPIO: o layout só guarda COMO mostrar. Os valores (Força = 15 etc.) continuam em ficha.attrs / status / fields...
// Cada elemento aponta para o dado por ID (`bind`) e nunca copia o valor.
//
// ficha.layout = {v, w:900, h, bg:{color,img,opacity,pos,size}, border:{style,width,color,radius}, els:[elemento]}
// ficha.layoutV = 1   (marcador de migração, no mesmo padrão de treeMigV)
// elemento = {id,type,name,x,y,w,h,title,bind,text,src,imgFit,useCover,stack,showLabel,st:{...estilo}}
// bind:
//   campo      -> {kind:'field',id} | {kind:'fields'} (grupo) | {kind:'core',key:'charName'|'name'|'level'}
//   atributo   -> {kind:'attr',id}  | {kind:'attrs'}
//   status     -> {kind:'status',id}| {kind:'statuses'}
//   item       -> {kind:'item',id}  | {kind:'items'}
//   habilidade -> {kind:'skill',id} | {kind:'skills'}
//   dinheiro   -> {kind:'money',id} | {kind:'moneys'}
//   texto      -> null (texto livre) | {kind:'tab',id} (mostra uma aba de texto rico)
// A ordem do array `els` é a ordem das camadas (último = na frente).
const rid=()=>Math.random().toString(36).slice(2,10);
const num=(v,d)=>(v===''||v===null||v===undefined||!Number.isFinite(+v))?d:+v;
const norm=s=>String(s??'').trim().toLowerCase();

export const LAYOUT_V=1,CANVAS_W=900,MIN_SIZE=24,MIN_H=200;
export const TYPES={text:'Texto',field:'Campo',image:'Imagem',attr:'Atributo',status:'Status/Recurso',item:'Item',skill:'Habilidade',money:'Dinheiro',marks:'Marcas',tree:'Árvore',gallery:'Galeria',section:'Seção'};
export const TYPE_ICON={text:'🔤',field:'📝',image:'🖼️',attr:'💪',status:'❤️',item:'🎒',skill:'✨',money:'💰',marks:'🏷️',tree:'🌳',gallery:'🖼️',section:'▭'};
export const FONTS=[['','Padrão da ficha'],['Inter, system-ui, sans-serif','Inter'],['Georgia, serif','Serif (Georgia)'],['"Courier New", monospace','Monospace'],
  ['"Palatino Linotype", serif','Palatino'],['system-ui, sans-serif','Moderna'],['Impact, fantasy','Impacto'],['"Brush Script MT", cursive','Manuscrita']];
export const COLL={field:'fields',attr:'attrs',status:'status',item:'items',skill:'skills',money:'money'};
export const GROUP={field:'fields',attr:'attrs',status:'statuses',item:'items',skill:'skills',money:'moneys'};
export const VISKEY={field:'dados',attr:'atributos',status:'status',item:'itens',skill:'habilidades',money:'dinheiro'};
export const CORE={charName:'Nome do personagem',name:'Nome da ficha',level:'Nível'};

export const defaultStyle=()=>({panel:false,color:'',bg:'',bga:1,bd:'',bw:0,rad:0,acc:'',font:'',size:0,al:'left',bold:false,op:1,fit:false});
export const defaultBg=()=>({color:'',img:'',opacity:1,pos:'center',size:'cover'});
export const defaultBorder=()=>({style:'none',width:0,color:'',radius:0});

const DEF={
  text:{w:300,h:80,fit:true,text:'Texto'},field:{w:300,h:56,fit:true},image:{w:200,h:200},
  attr:{w:200,h:110,panel:true},status:{w:300,h:90,panel:true},item:{w:300,h:140,panel:true},skill:{w:300,h:140,panel:true},
  money:{w:260,h:120,panel:true},marks:{w:300,h:100,panel:true,title:'Condições / Marcas'},tree:{w:260,h:110,panel:true,title:'🌳 Árvore'},
  gallery:{w:300,h:140,panel:true,title:'🖼️ Galeria'},section:{w:400,h:240,sec:true}};

export function newElement(type,over={}){
  const d=DEF[type]||DEF.text;
  const st={...defaultStyle(),...(d.panel?{panel:true}:{}),...(d.fit?{fit:true}:{}),...(d.sec?{bg:'#000000',bga:.25,bw:1,rad:14}:{}),...(over.st||{})};
  return {id:rid(),type,name:'',x:24,y:24,w:d.w,h:d.h,title:d.title||'',bind:null,text:d.text||'',src:'',imgFit:'cover',useCover:false,stack:false,showLabel:true,...over,st};
}

// ---------- geometria ----------
export const snap=(v,g)=>g>1?Math.round(v/g)*g:Math.round(v);
export function clampBox(b,L){
  const W=L.w||CANVAS_W,H=L.h;
  const w=Math.max(MIN_SIZE,Math.min(Math.round(num(b.w,100)),W)),h=Math.max(MIN_SIZE,Math.min(Math.round(num(b.h,50)),H));
  return {x:Math.max(0,Math.min(Math.round(num(b.x,0)),W-w)),y:Math.max(0,Math.min(Math.round(num(b.y,0)),H-h)),w,h};
}
const mapEl=(L,id,f)=>({...L,els:L.els.map(e=>e.id===id?f(e):e)});
export const contentBottom=L=>Math.max(0,...L.els.map(e=>e.y+e.h));

// ---------- operações (todas imutáveis: devolvem um layout novo) ----------
export function addElement(L,type,over={}){
  const k=L.els.length,e=newElement(type,{x:40+(k*24)%240,y:40+(k*24)%240,...over});
  Object.assign(e,clampBox(e,L));
  // seção nasce atrás de tudo (é uma caixa de fundo); os demais nascem na frente
  return {layout:{...L,els:type==='section'?[e,...L.els]:[...L.els,e]},id:e.id};
}
export function duplicateElement(L,id){
  const i=L.els.findIndex(e=>e.id===id);if(i<0)return {layout:L,id:null};
  const c=structuredClone(L.els[i]);c.id=rid();c.x+=20;c.y+=20;Object.assign(c,clampBox(c,L));
  const els=[...L.els];els.splice(i+1,0,c);return {layout:{...L,els},id:c.id};
}
export const removeElement=(L,id)=>({...L,els:L.els.filter(e=>e.id!==id)});
// patch pode trazer `st` parcial (mesclado ao estilo atual) e/ou x,y,w,h (sempre limitados à ficha)
export function setElement(L,id,patch){
  return mapEl(L,id,e=>{const {st,...rest}=patch,m={...e,...rest,st:{...e.st,...(st||{})}};return Object.assign(m,clampBox(m,L))});
}
export const childrenOf=(L,id)=>{
  const s=L.els.find(e=>e.id===id);if(!s||s.type!=='section')return [];
  return L.els.filter(e=>e.id!==id&&e.x>=s.x&&e.y>=s.y&&e.x+e.w<=s.x+s.w&&e.y+e.h<=s.y+s.h).map(e=>e.id);
};
// Move um elemento (e, se for seção, tudo que está inteiro dentro dela). Mantém o grupo dentro da ficha.
export function moveGroup(L,id,dx,dy,g=0){
  const m=L.els.find(e=>e.id===id);if(!m)return L;
  const ids=new Set([id,...childrenOf(L,id)]),grp=L.els.filter(e=>ids.has(e.id));
  let nx=m.x+Math.round(dx),ny=m.y+Math.round(dy);if(g>1){nx=snap(nx,g);ny=snap(ny,g)}
  dx=nx-m.x;dy=ny-m.y;
  const minX=Math.min(...grp.map(e=>e.x)),minY=Math.min(...grp.map(e=>e.y)),maxR=Math.max(...grp.map(e=>e.x+e.w)),maxB=Math.max(...grp.map(e=>e.y+e.h));
  dx=Math.max(-minX,Math.min(dx,(L.w||CANVAS_W)-maxR));dy=Math.max(-minY,Math.min(dy,L.h-maxB));
  return {...L,els:L.els.map(e=>ids.has(e.id)?{...e,x:e.x+dx,y:e.y+dy}:e)};
}
// handle: n s e w ne nw se sw. Só as bordas que se moveram são encaixadas na grade.
export function resizeBox(L,id,handle,dx,dy,g=0){
  const e=L.els.find(x=>x.id===id);if(!e)return L;
  const W=L.w||CANVAS_W;let l=e.x,t=e.y,r=e.x+e.w,b=e.y+e.h;
  const sn=v=>g>1?snap(v,g):Math.round(v);
  if(handle.includes('e'))r=sn(r+dx);if(handle.includes('w'))l=sn(l+dx);
  if(handle.includes('s'))b=sn(b+dy);if(handle.includes('n'))t=sn(t+dy);
  l=Math.max(0,l);t=Math.max(0,t);r=Math.min(W,r);b=Math.min(L.h,b);
  if(r-l<MIN_SIZE){if(handle.includes('w'))l=r-MIN_SIZE;else r=l+MIN_SIZE}
  if(b-t<MIN_SIZE){if(handle.includes('n'))t=b-MIN_SIZE;else b=t+MIN_SIZE}
  return mapEl(L,id,x=>({...x,...clampBox({x:l,y:t,w:r-l,h:b-t},L)}));
}
// op: front | back | up | down
export function layerOp(L,id,op){
  const els=[...L.els],i=els.findIndex(e=>e.id===id);if(i<0)return L;
  const [e]=els.splice(i,1);
  const j=op==='front'?els.length:op==='back'?0:op==='up'?Math.min(els.length,i+1):Math.max(0,i-1);
  els.splice(j,0,e);return {...L,els};
}
export const setBg=(L,p)=>({...L,bg:{...L.bg,...p}});
export const setBorder=(L,p)=>({...L,border:{...L.border,...p}});
// a altura não pode ficar menor que o conteúdo
export const setCanvasHeight=(L,h)=>({...L,h:Math.max(MIN_H,contentBottom(L),Math.round(num(h,L.h)))});

// ---------- dados ligados ----------
// Descobre o que o elemento mostra, SEMPRE a partir dos dados reais da ficha.
// Devolve {ok,hidden?,group?,rows?:[{i,obj}],core?,tab?,reason?}. reason: 'removed' (dado apagado) | 'unbound' (nada escolhido)
export function resolveEl(s,el,{isM=false}={}){
  const b=el.bind,t=el.type;
  if(t==='text'){
    if(b?.kind==='tab'){const tab=(s.tabs||[]).find(x=>x.id===b.id);return tab?{ok:true,tab}:{ok:false,reason:'removed'}}
    return {ok:true};
  }
  if(['image','marks','tree','section','gallery'].includes(t))return {ok:true};
  const coll=COLL[t];if(!coll)return {ok:false,reason:'unknown'};
  if(!isM&&s.vis?.[VISKEY[t]]==='hidden')return {ok:true,hidden:true,rows:[]};
  if(t==='field'&&b?.kind==='core')return CORE[b.key]?{ok:true,core:b.key}:{ok:false,reason:'removed'};
  if(!b)return {ok:false,reason:'unbound'};
  const list=s[coll]||[],show=o=>isM||!o.hide;
  if(b.kind===GROUP[t])return {ok:true,group:true,rows:list.map((obj,i)=>({i,obj})).filter(r=>show(r.obj))};
  if(b.kind===t){
    const i=list.findIndex(o=>o.id===b.id);if(i<0)return {ok:false,reason:'removed'};
    return show(list[i])?{ok:true,rows:[{i,obj:list[i]}]}:{ok:true,hidden:true,rows:[]};
  }
  return {ok:false,reason:'unbound'};
}
// Vínculo inicial de um elemento novo: o primeiro dado ainda não usado por outro elemento do mesmo tipo; sem dados, o grupo.
export function defaultBind(s,type,L){
  if(type==='field'){
    const used=new Set((L?.els||[]).filter(e=>e.type==='field'&&e.bind?.id).map(e=>e.bind.id)),f=(s.fields||[]).find(x=>!used.has(x.id))||(s.fields||[])[0];
    return f?{kind:'field',id:f.id}:{kind:'core',key:'charName'};
  }
  if(!COLL[type])return null;
  const list=s[COLL[type]]||[];if(!list.length)return {kind:GROUP[type]};
  const used=new Set((L?.els||[]).filter(e=>e.type===type&&e.bind?.id).map(e=>e.bind.id));
  return {kind:type,id:(list.find(o=>!used.has(o.id))||list[0]).id};
}

// ---------- layout padrão (reproduz aproximadamente a ficha clássica) ----------
export function defaultLayout(s){
  const th=s.theme||{},els=[],add=(type,over)=>els.push(newElement(type,over)),P={panel:true};
  add('image',{name:'Retrato',x:24,y:24,w:210,h:280,useCover:true,imgFit:'cover',st:{bd:s.frame||'#d4a34a',bw:4,rad:12}});
  add('field',{name:'Nome do personagem',x:254,y:24,w:622,h:64,bind:{kind:'core',key:'charName'},showLabel:false,st:{size:30,bold:true,color:th.title||'',fit:true}});
  add('field',{name:'Dados',title:'Dados',x:254,y:100,w:622,h:204,bind:{kind:'fields'},st:P});
  add('attr',{name:'Atributos',title:'Atributos',x:24,y:320,w:852,h:170,bind:{kind:'attrs'}});
  add('status',{name:'Status',title:'Status',x:24,y:506,w:420,h:196,bind:{kind:'statuses'}});
  add('money',{name:'Dinheiro',title:'Dinheiro',x:456,y:506,w:420,h:196,bind:{kind:'moneys'}});
  add('skill',{name:'Habilidades',title:'Habilidades',x:24,y:718,w:420,h:230,bind:{kind:'skills'}});
  add('item',{name:'Itens',title:'Itens',x:456,y:718,w:420,h:230,bind:{kind:'items'}});
  add('marks',{name:'Marcas',x:24,y:964,w:420,h:110});
  add('tree',{name:'Árvore',x:456,y:964,w:420,h:110});
  let y=1090;
  (s.tabs||[]).forEach(t=>{add('text',{name:t.title,title:t.title,x:24,y,w:852,h:280,bind:{kind:'tab',id:t.id},st:{panel:true,fit:false}});y+=296});
  const L={v:LAYOUT_V,w:CANVAS_W,h:Math.max(MIN_H,contentBottom({els})+24),bg:defaultBg(),border:defaultBorder(),els};
  return L;
}

// Completa campos que faltem (layouts vindos de backups/versões antigas) SEM apagar nada. Idempotente.
export function normalizeLayout(l){
  const src=l&&typeof l==='object'?l:{},W=num(src.w,CANVAS_W)>=100?Math.round(num(src.w,CANVAS_W)):CANVAS_W;
  const raw=(Array.isArray(src.els)?src.els:[]).filter(e=>e&&typeof e==='object');
  const tmp={w:W,h:1e9};
  const els=raw.map(e=>{
    const m={...newElement('text'),...e,id:e.id||rid(),st:{...defaultStyle(),...(e.st||{})}};
    return Object.assign(m,clampBox(m,tmp));
  });
  const h=Math.max(MIN_H,Math.round(num(src.h,MIN_H)),contentBottom({els}));
  return {v:LAYOUT_V,w:W,h,bg:{...defaultBg(),...(src.bg||{})},border:{...defaultBorder(),...(src.border||{})},els};
}

// ---------- migração (idempotente; marcador por ficha: layoutV) ----------
// Ficha sem layoutV: se já tem layout (ex.: vindo de backup), é normalizado e preservado; senão recebe o layout padrão.
// Ficha com layoutV é ignorada (nunca reescrita a cada carregamento).
export function migrateLayouts(d){
  (d.sheets||[]).forEach(s=>{
    if(s.layoutV)return;
    s.layout=s.layout&&typeof s.layout==='object'&&Array.isArray(s.layout.els)?normalizeLayout(s.layout):defaultLayout(s);
    s.layoutV=LAYOUT_V;
  });
  return d;
}
// Layout "efetivo" para exibir (defensivo: não grava nada).
export const layoutOf=s=>s.layout&&s.layoutV?s.layout:(s.layout?normalizeLayout(s.layout):defaultLayout(s));

// ---------- cópia independente ----------
export function cloneLayout(L){const c=structuredClone(L);c.els.forEach(e=>{e.id=rid()});return c}
// Copia o layout de `fromSheet` para `toSheet`: ids novos; vínculos individuais cujo dado não existe na ficha de destino
// são religados ao dado de mesmo nome (se houver). Devolve um layout novo, sem compartilhar referências com a origem.
export function copyLayout(fromSheet,toSheet){
  const L=cloneLayout(layoutOf(fromSheet));
  L.els.forEach(e=>{
    const b=e.bind;if(!b||b.kind==='core'||!b.id)return;
    const coll=b.kind==='tab'?'tabs':COLL[e.type];if(!coll)return;
    const to=toSheet[coll]||[];if(to.some(o=>o.id===b.id))return;
    const key=coll==='fields'?'k':coll==='tabs'?'title':'name',fo=(fromSheet[coll]||[]).find(o=>o.id===b.id);
    const m=fo&&to.find(o=>norm(o[key])===norm(fo[key]));if(m)e.bind={...b,id:m.id};
  });
  return L;
}

// ---------- permissão: só o Mestre altera o layout ----------
// Chamada no momento da gravação (junto de LOCK/guardProg): desfaz qualquer mudança de layout feita por não-Mestre.
export function guardLayout(old,x){
  for(const k of ['layout','layoutV']){if(old[k]===undefined)delete x[k];else x[k]=old[k]}
}

// ---------- cor com transparência ----------
export function rgba(hex,a=1){
  const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return hex||undefined;
  if(a>=1)return '#'+m[1];
  const v=parseInt(m[1],16);return `rgba(${v>>16&255},${v>>8&255},${v&255},${Math.max(0,a)})`;
}

import {useState} from 'react';
import {uid,now,hash} from './storage.js';
import {campaignsFor} from './repo.js';

// Tela única de entrada. O sistema reconhece sozinho se a conta é de Mestre ou de Jogador.
// Enquanto não existir nenhum Mestre neste navegador, aparece a tela de primeiro acesso.
export default function Login({db,upd,replace}){
  const first=!db.users.some(u=>u.role==='master');
  const blocked=db.users.some(u=>u.id===db.session&&!u.active);
  const [n,setN]=useState(''),[p,setP]=useState(''),[e,setE]=useState(blocked?'Conta bloqueada pelo Mestre.':'');
  const go=async()=>{
    setE('');
    if(first){
      if(n.trim().length<2||p.length<4)return setE('Login (2+) e senha (4+ caracteres).');
      const h=await hash(p),id=uid();
      return upd(d=>{d.users.push({id,name:n.trim(),pass:h,role:'master',active:true,last:now()});d.session=id});
    }
    const h=await hash(p);
    const u=db.users.find(x=>x.name.toLowerCase()===n.trim().toLowerCase()&&x.pass===h);
    if(!u)return setE('Login ou senha incorretos.');
    if(!u.active)return setE('Conta bloqueada pelo Mestre.');
    upd(d=>{
      d.session=u.id;d.users.find(x=>x.id===u.id).last=now();
      // Jogador com uma única campanha entra direto nela.
      const cs=campaignsFor(d,u);
      d.active=(u.role==='player'&&cs.length===1)?cs[0].id:null;
    });
  };
  const imp=ev=>{const f=ev.target.files[0];ev.target.value='';if(!f)return;
    f.text().then(t=>{try{const j=JSON.parse(t);if(!Array.isArray(j.users))throw 0;replace(j);setE('')}catch{setE('Arquivo de backup inválido.')}})};
  return <div className="login"><form className="panel" onSubmit={ev=>{ev.preventDefault();go()}}>
    <h1>⚔️ Fichas de RPG</h1>
    {first
      ?<><p>👑 <b>Primeiro acesso</b> — crie a conta do Mestre para começar.</p>
        <small>Jogadores não se cadastram sozinhos: o Mestre cria o login e a senha de cada um depois.</small></>
      :<><p>Entre na aventura</p>
        <small>Use seu login e senha. O sistema reconhece sozinho se você é Mestre ou Jogador.</small></>}
    <input placeholder="Login" value={n} onChange={ev=>setN(ev.target.value)} autoFocus autoComplete="username"/>
    <input type="password" placeholder="Senha" value={p} onChange={ev=>setP(ev.target.value)} autoComplete={first?'new-password':'current-password'}/>
    {e&&<div className="err">{e}</div>}
    <button className="btn big">{first?'👑 CRIAR CONTA DE MESTRE':'ENTRAR'}</button>
    {first&&<div className="panel" style={{marginTop:12}}>
      <small>🛡️ <b>Sou jogador</b> e o Mestre me passou um arquivo de backup: os dados ficam salvos neste navegador, então importe o arquivo aqui e depois entre com o login que o Mestre criou para você.</small>
      <label className="btn sm" style={{marginTop:8}}>⬆️ Importar backup do Mestre<input hidden type="file" accept=".json" onChange={imp}/></label></div>}
    {!first&&<small>Jogadores recebem login e senha do Mestre.</small>}</form></div>;
}

import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
createRoot(document.getElementById('root')).render(<App/>);

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

import {uid,now} from './storage.js';
export const newSheet=(owner,over={})=>({id:uid(),owner,name:'Nova Ficha',charName:'Personagem',cover:'',frame:'#d4a34a',cardBg:'#1d1830',
  created:now(),updated:now(),template:null,isTemplate:false,isPublic:false,
  fields:['Nome','Idade','Raça','Classe','Origem'].map(k=>({id:uid(),k,v:''})),
  attrs:[],useMod:true,formula:'floor(a/2)',
  status:[['HP','#e04848','❤️'],['Mana','#4a7ee0','🔷'],['Stamina','#4ab86a','⚡']].map(([name,color,icon])=>({id:uid(),name,color,icon,cur:100,max:100})),
  money:[],items:[],skills:[],tree:[],level:1,marks:[],treeProg:{points:0,trees:[],unlocked:{}},treeMigV:1,images:[],
  tabs:[{id:uid(),title:'Descrição',html:''},{id:uid(),title:'História',html:''}],
  theme:{bg:'#120f1f',bgImg:'',text:'#e9e2d0',title:'#f0c66a',border:'#6b5320',card:'#221b38',attr:'#f0c66a',btn:'#b8862b',font:'Georgia, serif',size:16},...over});
// Fórmula do modificador: "a" = valor do atributo. Ex.: floor(a/2) | floor((a-10)/2)
export const calcMod=(f,a)=>{try{if(!/^[\w\s+\-*/().,%]*$/.test(f))return'?';
  const r=Function('a','floor','ceil','round','min','max','abs','"use strict";return ('+f+')')(+a,Math.floor,Math.ceil,Math.round,Math.min,Math.max,Math.abs);
  return Number.isFinite(r)?(r>0?'+'+r:''+r):'?'}catch{return'?'}};

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

{
  "name": "fichas-rpg",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
import {useState} from 'react';
import {useApp} from './ctx.js';
import {uid,now,hash} from './storage.js';
import {newSheet} from './model.js';
import {AddExisting} from './Campaigns.jsx';
const fmt=d=>d?new Date(d).toLocaleString('pt-BR'):'nunca';

export function SheetCard({s}){
  const {db,isM,open}=useApp();
  return <div className="ccard" style={{background:s.cardBg,'--fr':s.frame}} onClick={()=>open(s.id)}>
    <h4>{s.charName}</h4><div className="frame">{s.cover?<img src={s.cover} alt=""/>:<span>🧙</span>}</div><p>{s.name}</p>
    {isM&&<small>👤 {db.users.find(u=>u.id===s.owner)?.name||'—'}</small>}</div>;
}
const visible=(db,user,isM)=>db.sheets.filter(s=>!s.isTemplate&&(isM||s.owner===user.id));

export function Home(){
  const {db,user,isM,go}=useApp();
  const mine=visible(db,user,isM).sort((a,b)=>b.updated.localeCompare(a.updated));
  return <div><h2>Bem-vindo, {user.name}!</h2><p className="sub">🗺️ {db.campaign.name}</p>
    <div className="stats"><div className="panel">📜 <b>{mine.length}</b> fichas</div>
      {isM&&<><div className="panel">👥 <b>{db.users.filter(u=>u.role==='player').length}</b> jogadores</div>
      <div className="panel">🧩 <b>{db.sheets.filter(s=>s.isTemplate).length}</b> modelos</div></>}</div>
    {db.campaign.notes&&<div className="panel txt">📖 {db.campaign.notes}</div>}
    <h3>Fichas recentes</h3><div className="grid">{mine.slice(0,4).map(s=><SheetCard key={s.id} s={s}/>)}</div>
    {!mine.length&&<button className="btn big" onClick={()=>go('sheets')}>Ir para as fichas</button>}</div>;
}

function NewDlg({close}){
  const {db,user,isM,upd,open}=useApp();
  const tpls=db.sheets.filter(s=>s.isTemplate&&(isM||s.isPublic||s.owner===user.id));
  const [t,setT]=useState(''),[o,setO]=useState(user.id);
  const players=db.users.filter(u=>u.active);
  const make=()=>{const base=tpls.find(x=>x.id===t);
    const s=base?{...structuredClone(base),id:uid(),owner:o,isTemplate:false,isPublic:false,template:base.name,created:now(),updated:now(),name:'Nova Ficha'}:newSheet(o);
    upd(d=>{d.sheets.push(s)});close();open(s.id)};
  return <div className="modal" onClick={close}><div className="panel" onClick={e=>e.stopPropagation()}>
    <h3>✨ Nova ficha</h3>
    {(isM||db.perms.useTemplates)&&<label className="lab">Modelo<select value={t} onChange={e=>setT(e.target.value)}><option value="">Ficha em branco</option>{tpls.map(x=><option key={x.id} value={x.id}>{x.isPublic?'🌐':'🔒'} {x.name}</option>)}</select></label>}
    {isM&&<label className="lab">Dono<select value={o} onChange={e=>setO(e.target.value)}>{players.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
    <button className="btn big" onClick={make}>CRIAR</button></div></div>;
}

export function Library(){
  const {db,user,isM,intent}=useApp();const [dlg,setDlg]=useState(intent==='new');
  const list=visible(db,user,isM);
  return <div><h2>📜 Fichas</h2><div className="grid">
    {list.map(s=><SheetCard key={s.id} s={s}/>)}
    {(isM||db.perms.createSheets)&&<button className="ccard newc" onClick={()=>setDlg(true)}>＋<br/>NOVA FICHA</button>}</div>
    {!list.length&&<p className="empty">Nenhuma ficha ainda.</p>}{dlg&&<NewDlg close={()=>setDlg(false)}/>}</div>;
}

export function Templates(){
  const {db,user,isM,upd,open}=useApp();
  const list=db.sheets.filter(s=>s.isTemplate&&(isM||s.isPublic||s.owner===user.id));
  const canNew=isM||db.perms.createTemplates;
  return <div><h2>🧩 Modelos de ficha</h2><div className="grid">
    {list.map(s=><div key={s.id} className="panel"><SheetCard s={s}/>
      <div className="row"><b>{s.isPublic?'🌐 Disponível':'🔒 Privado'}</b>
        {isM&&<button className="btn sm" onClick={()=>upd(d=>{const x=d.sheets.find(y=>y.id===s.id);x.isPublic=!x.isPublic})}>Alternar</button>}
        {(isM||s.owner===user.id)&&<button className="x" onClick={()=>confirm('Excluir modelo?')&&upd(d=>{d.sheets=d.sheets.filter(y=>y.id!==s.id)})}>🗑️</button>}</div></div>)}
    {canNew&&<button className="ccard newc" onClick={()=>{const s=newSheet(user.id,{isTemplate:true,name:'Novo modelo'});upd(d=>{d.sheets.push(s)});open(s.id)}}>＋<br/>NOVO MODELO</button>}</div>
    <p className="sub">Jogadores usam modelos liberados ao criar ficha: uma cópia é criada, o original não é alterado.</p></div>;
}

export function Overview({kind}){
  const {db,user,isM,open}=useApp();
  const L=visible(db,user,isM).filter(s=>s[kind].length);
  return <div><h2>{({skills:'✨ Habilidades',items:'🎒 Inventário',tree:'🌳 Árvore de habilidades'})[kind]}</h2>
    {!L.length&&<p className="empty">Nada por aqui ainda. Abra uma ficha para criar.</p>}
    {L.map(s=><section key={s.id} className="panel"><h3>{s.charName} <small>{s.name}</small>
      <button className="btn sm" onClick={()=>open(s.id,{skills:'habs',items:'itens',tree:'arvore'}[kind])}>Abrir</button></h3>
      <div className="chips">{s[kind].filter(c=>kind!=='skills'||c.on||isM).map(c=><span className="chip" style={{borderColor:c.bc}} key={c.id}>{c.icon} {c.name}{kind==='items'&&c.qty?` ×${c.qty}`:''}</span>)}</div></section>)}</div>;
}

export function Players(){
  const {db,raw,upd,showProfile}=useApp();const [n,setN]=useState(''),[p,setP]=useState(''),[made,setMade]=useState(null);
  const add=async()=>{const login=n.trim();if(login.length<2||p.length<4)return alert('Informe login (2+) e senha (4+ caracteres).');
    if(raw.users.some(u=>u.name.toLowerCase()===login.toLowerCase()))return alert('Esse login já existe.');
    const h=await hash(p);upd(d=>{d.users.push({id:uid(),name:login,pass:h,role:'player',active:true,last:null})});setMade({login,pass:p});setN('');setP('')};
  return <div><h2>👥 Jogadores</h2>
    <div className="panel row"><input placeholder="Login do jogador" value={n} onChange={e=>setN(e.target.value)}/><input placeholder="Senha" value={p} onChange={e=>setP(e.target.value)}/><button className="btn" onClick={add}>＋ CRIAR JOGADOR</button></div>
    {made&&<div className="panel row"><span>✅ Jogador criado! Passe estes dados a ele — Login: <b>{made.login}</b> · Senha: <b>{made.pass}</b></span><button className="x" onClick={()=>setMade(null)}>×</button></div>}<AddExisting/>
    <div className="grid">{db.users.filter(u=>u.role==='player').map(u=><div className="panel" key={u.id}>
      <h3>🛡️ {u.name}</h3><p>Status: {u.active?'🟢 Ativo':'🔴 Bloqueado'}</p>
      <p>Fichas: {db.sheets.filter(s=>!s.isTemplate&&s.owner===u.id).map(s=>s.charName).join(', ')||'nenhuma'}</p><p>Último acesso: {fmt(u.last)}</p>
      <div className="row"><button className="btn sm" onClick={()=>showProfile(u.id)}>👤 VER PERFIL</button><button className="btn sm" onClick={()=>upd(d=>{const x=d.users.find(y=>y.id===u.id);x.active=!x.active})}>{u.active?'Bloquear':'Liberar'}</button>
        <button className="btn sm" onClick={async()=>{const s=prompt('Nova senha (4+):');if(s&&s.length>=4){const h=await hash(s);upd(d=>{d.users.find(y=>y.id===u.id).pass=h})}}}>Nova senha</button>
        <button className="x" onClick={()=>confirm('Remover o jogador desta campanha e apagar as fichas dele nela? (a conta continua existindo)')&&upd(d=>{d.campaign.members=d.campaign.members.filter(i=>i!==u.id);d.sheets=d.sheets.filter(s=>!(s.owner===u.id&&s.campaignId===d.campaign.id))})}>🗑️</button></div></div>)}</div></div>;
}

export function Campaign(){
  const {db,upd}=useApp();const c=db.campaign;
  return <div><h2>🗺️ Controle da campanha</h2><div className="panel">
    <label className="lab">Nome da campanha<input value={c.name} onChange={e=>upd(d=>{d.campaign.name=e.target.value})}/></label>
    <label className="lab">Anotações / mensagem aos jogadores (aparece no Início)<textarea rows={6} value={c.notes} onChange={e=>upd(d=>{d.campaign.notes=e.target.value})}/></label></div></div>;
}

const PERMS={createSheets:'Criar fichas',editSheets:'Editar as próprias fichas (dados, atributos, status, abas, imagens, visual)',useTemplates:'Usar modelos liberados',createTemplates:'Criar modelos (privados)',createItems:'Criar itens',createSkills:'Criar habilidades',viewTree:'Visualizar a árvore de habilidades',unlockTree:'Desbloquear as próprias habilidades da árvore (gastando pontos)'};
export function Perms(){
  const {db,upd}=useApp();
  return <div><h2>🛡️ Permissões dos jogadores</h2><div className="panel">
    {Object.entries(PERMS).map(([k,l])=><label key={k} className="sw"><input type="checkbox" checked={!!db.perms[k]} onChange={e=>upd(d=>{d.perms[k]=e.target.checked})}/> {l}</label>)}</div></div>;
}

export function Settings(){
  const {raw:db,user,upd}=useApp();const [p,setP]=useState('');
  const exp=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db)],{type:'application/json'}));a.download='fichas-rpg-backup.json';a.click()};
  const imp=e=>{const f=e.target.files[0];if(!f)return;f.text().then(t=>{try{const j=JSON.parse(t);if(!j.users)throw 0;upd(d=>{Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,j)})}catch{alert('Arquivo inválido.')}})};
  return <div><h2>⚙️ Configurações</h2>
    <div className="panel"><h3>Alterar minha senha</h3><div className="row"><input type="password" placeholder="Nova senha" value={p} onChange={e=>setP(e.target.value)}/>
      <button className="btn" onClick={async()=>{if(p.length<4)return alert('Mínimo 4 caracteres.');const h=await hash(p);upd(d=>{d.users.find(x=>x.id===user.id).pass=h});setP('');alert('Senha alterada.')}}>Salvar</button></div></div>
    {user.role==='master'&&<div className="panel"><h3>Backup dos dados</h3><div className="row"><button className="btn" onClick={exp}>⬇️ Exportar</button>
      <label className="btn">⬆️ Importar<input hidden type="file" accept=".json" onChange={imp}/></label></div></div>}</div>;
}
