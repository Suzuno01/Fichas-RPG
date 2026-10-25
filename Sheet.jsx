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
import {Ico,IconEdit,ImgUp,setImg,clearImg,icoText} from './imgtools.jsx';
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
  const enS=a=>can&&(isM||(s.vis?.[SEC[a]]||'edit')==='edit');
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
            <span className="em"><IconEdit value={m.emoji} en={enS('money')} on={v=>ed(x=>{x.money[i].emoji=v})}/></span>{F('money',i,'name','Nome')}{F('money',i,'qty','0',{num:1,c:'n'})}
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
              <input type="color" value={im.bc} onChange={e=>ed(x=>{x.images[i].bc=e.target.value})}/><ImgUp adjustOnly obj={im} field="src" shape={im.shape} free out={900} on={r=>ed(x=>{setImg(x.images[i],'src',r)})}/><button className="x" onClick={()=>del('images',i)}>🗑️</button></div>}</figure>)}
            {can&&<ImgUp label="＋ ADICIONAR IMAGEM" free out={900} on={r=>add('images',{src:r.img,srcO:r.orig,srcC:r.crop,title:'',desc:'',w:60,al:'center',bd:3,bc:'#d4a34a',shape:'soft'})}/>}</div>}
          {tab==='visual'&&(can?<div className="vis">
            <Pick label="Fundo" {...T('bg')}/><Pick label="Textos" {...T('text')}/><Pick label="Títulos" {...T('title')}/><Pick label="Bordas" {...T('border')}/>
            <Pick label="Cartas/painéis" {...T('card')}/><Pick label="Atributos" {...T('attr')}/><Pick label="Botões" {...T('btn')}/>
            <div className="row"><Up label="🖼️ Imagem de fundo" max={1400} on={u=>ed(x=>{x.theme.bgImg=u})}/>{th.bgImg&&<button className="btn sm" onClick={()=>ed(x=>{x.theme.bgImg=''})}>Remover</button>}</div>
            <label className="lab">Fonte<select value={th.font} onChange={e=>ed(x=>{x.theme.font=e.target.value})}>{[['Georgia, serif','Clássica'],['"Palatino Linotype", serif','Palatino'],['system-ui, sans-serif','Moderna'],['"Courier New", monospace','Máquina'],['Impact, fantasy','Impacto'],['"Brush Script MT", cursive','Manuscrita']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
            <label className="lab">Tamanho do texto: {th.size}px<input type="range" min="12" max="24" value={th.size} onChange={e=>ed(x=>{x.theme.size=+e.target.value})}/></label></div>
            :<p className="empty">Você não tem permissão para personalizar esta ficha.</p>)}</>};
  // ---- Ficha visual: nova camada de apresentação (os dados continuam sendo os da ficha; permissões via ed/F acima) ----
  const L=layoutOf(s),commitLayout=l=>ed(x=>{x.layout=l;x.layoutV=LAYOUT_V}),others=db.sheets.filter(o=>o.id!==s.id);
  const vctx={s,isM,can,ed,F,enS,showTree,mine,open:(k,i)=>setModal(k==='tree'?{tree:1}:{k,id:i}),openTab:t=>setModal({tab:t})};
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
          {can&&<div className="row"><ImgUp obj={s} field="cover" ratio={3/4} out={640} on={r=>ed(x=>{setImg(x,'cover',r)})}/><Pick label="Moldura" value={s.frame} on={v=>ed(x=>{x.frame=v})}/><Pick label="Fundo do cartão" value={s.cardBg} on={v=>ed(x=>{x.cardBg=v})}/></div>}</section>
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
            <div className="sh"><span><Ico v={t.icon}/> {F('status',i,'name','Nome')}</span><span className="nums">{F('status',i,'cur','',{num:1,c:'n'})}/{F('status',i,'max','',{num:1,c:'n'})}</span></div>
            <div className="bar"><i style={{width:Math.max(0,Math.min(100,t.max?t.cur/t.max*100:0))+'%',background:t.color}}/></div>
            {can&&<div className="row"><IconEdit value={t.icon} on={v=>ed(x=>{x.status[i].icon=v})}/><Pick label="Cor" value={t.color} on={v=>ed(x=>{x.status[i].color=v})}/>{isM&&<button className="x" onClick={()=>del('status',i)}>×</button>}</div>}</div>)}
          {isM&&<button className="btn sm" onClick={()=>add('status',{name:'Novo status',cur:10,max:10,color:'#b15ae0',icon:'✨'})}>＋ STATUS</button>}</section>
      </div>
      <div className="col main">
        <nav className="tabs">{tabs.map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}{can&&<button className="newtab" onClick={newTab}>＋ NOVA ABA</button>}</nav>
        <section className="panel tabbody">{TB(tab)}</section></div></div>:visual}{modalEl}{toast&&<div className="toast">{toast}</div>}</div>;
}
