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
