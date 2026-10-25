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
