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
