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
