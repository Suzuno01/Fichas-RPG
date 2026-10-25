// Peças reutilizadas pela ficha clássica e pela ficha visual (movidas de Sheet.jsx sem mudar o comportamento;
// única adição: a prop `only` em Cards, que mostra um único item/habilidade).
import {useRef} from 'react';
import {uid,readImage} from './storage.js';
import {Ico,IconEdit,ImgUp,setImg,clearImg,icoText} from './imgtools.jsx';
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
      {en?<div className="row"><IconEdit value={c.icon} on={v=>set(i,'icon',v)}/><input className="nm" value={c.name} onChange={e=>set(i,'name',e.target.value)}/></div>:<h4><Ico v={c.icon}/> {c.name}</h4>}
      <div className="cimg">{c.img?<img src={c.img} alt=""/>:<span>🖼️</span>}</div>
      {en&&<div className="row"><ImgUp obj={c} field="img" ratio={16/10} out={640} on={r=>ed(d=>{setImg(d[kind][i],'img',r)})}/>{c.img&&<button className="btn sm danger" onClick={()=>ed(d=>{clearImg(d[kind][i],'img')})}>Remover</button>}</div>}
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

