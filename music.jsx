// Música tema da ficha: link do YouTube, link direto de áudio ou arquivo enviado. Toca em loop; volume e mudo ficam salvos neste aparelho.
import {useState,useEffect,useRef} from 'react';
import {sb} from './cloud.js';

export function parseMusic(url){
  const u=String(url||'').trim();if(!u)return null;
  const m=u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m?{kind:'yt',id:m[1]}:{kind:'audio',url:u};
}

let ytP=null;
const loadYT=()=>ytP||(ytP=new Promise(res=>{
  if(window.YT?.Player)return res(window.YT);
  const prev=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{prev&&prev();res(window.YT)};
  const t=document.createElement('script');t.src='https://www.youtube.com/iframe_api';document.head.appendChild(t);
}));

const pref=(k,d)=>{try{const v=localStorage.getItem('fichas-'+k);return v==null?d:JSON.parse(v)}catch{return d}};
const savePref=(k,v)=>{try{localStorage.setItem('fichas-'+k,JSON.stringify(v))}catch{}};

// Barra do player: toca sozinha ao abrir a ficha (se o navegador permitir) e para ao sair.
export function ThemePlayer({music}){
  const src=parseMusic(music?.url);
  const key=src?(src.kind==='yt'?'yt:'+src.id:src.url):'';
  const [vol,setVol]=useState(()=>pref('vol',60)),[mute,setMute]=useState(()=>pref('mute',false));
  const [playing,setPlaying]=useState(false),[need,setNeed]=useState(false),[err,setErr]=useState('');
  const box=useRef(),eng=useRef(null),volR=useRef(vol),muteR=useRef(mute);
  volR.current=vol;muteR.current=mute;

  useEffect(()=>{
    if(!src)return;
    let dead=false;setPlaying(false);setNeed(false);setErr('');
    if(src.kind==='audio'){
      const a=new Audio(src.url);a.loop=true;a.preload='auto';a.volume=volR.current/100;a.muted=muteR.current;
      a.onplay=()=>setPlaying(true);a.onpause=()=>setPlaying(false);a.onerror=()=>setErr('Não foi possível tocar este áudio.');
      eng.current={play:()=>a.play().catch(()=>setNeed(true)),pause:()=>a.pause(),vol:v=>{a.volume=v/100},mute:m=>{a.muted=m}};
      a.play().catch(()=>setNeed(true));
      return()=>{dead=true;a.pause();a.src='';eng.current=null};
    }
    let p=null;
    loadYT().then(YT=>{if(dead||!box.current)return;
      const holder=document.createElement('div');box.current.innerHTML='';box.current.appendChild(holder);
      p=new YT.Player(holder,{width:'200',height:'200',videoId:src.id,
        playerVars:{autoplay:1,loop:1,playlist:src.id,controls:0,disablekb:1,modestbranding:1,playsinline:1,rel:0},
        events:{
          onReady:e=>{e.target.setVolume(volR.current);muteR.current?e.target.mute():e.target.unMute();e.target.playVideo();
            setTimeout(()=>{if(!dead&&e.target.getPlayerState&&e.target.getPlayerState()!==1)setNeed(true)},1800)},
          onStateChange:e=>{if(e.data===1){setPlaying(true);setNeed(false)}else if(e.data===2)setPlaying(false);else if(e.data===0)e.target.playVideo()},
          onError:()=>setErr('Este vídeo não pode ser tocado aqui (pode estar bloqueado para incorporação).')}});
      eng.current={play:()=>p.playVideo(),pause:()=>p.pauseVideo(),vol:v=>p.setVolume&&p.setVolume(v),mute:m=>m?p.mute():p.unMute()};
    });
    return()=>{dead=true;try{p&&p.destroy()}catch{}eng.current=null};
  },[key]);

  // Se o navegador bloqueou o início automático, o primeiro clique em qualquer lugar da página inicia a música.
  useEffect(()=>{
    if(!need)return;
    const f=()=>{eng.current?.play();setNeed(false)};
    document.addEventListener('pointerdown',f,{once:true});
    return()=>document.removeEventListener('pointerdown',f);
  },[need]);

  if(!src)return null;
  const changeVol=v=>{setVol(v);savePref('vol',v);eng.current?.vol(v);if(v>0&&mute){setMute(false);savePref('mute',false);eng.current?.mute(false)}};
  const toggleMute=()=>{const m=!mute;setMute(m);savePref('mute',m);eng.current?.mute(m)};
  const toggle=()=>{playing?eng.current?.pause():eng.current?.play()};
  return <div className="mplayer" title={music.title||'Música tema'}>
    {src.kind==='yt'&&<div className="ytwrap" ref={box}/>}
    <span className="mnote">🎵</span>
    <span className="mtitle">{music.title||'Música tema'}</span>
    {err?<small className="err">{err}</small>:<>
      <button type="button" className="btn sm" onClick={toggle}>{playing?'⏸':'▶'}</button>
      <button type="button" className="btn sm" onClick={toggleMute} title={mute?'Ativar som':'Silenciar'}>{mute||vol===0?'🔇':'🔊'}</button>
      <input type="range" min="0" max="100" value={mute?0:vol} onChange={e=>changeVol(+e.target.value)} aria-label="Volume"/></>}
    {need&&!err&&<small className="mhint">Toque na tela para iniciar a música</small>}
  </div>;
}

const MAX_MB=10;
// Aba para escolher a música (só quem pode editar a ficha vê os campos).
export function MusicTab({s,can,ed,userId}){
  const m=s.music||{},[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const set=p=>ed(x=>{x.music={...(x.music||{}),...p}});
  const upload=async f=>{
    if(!f)return;setMsg('');
    if(f.size>MAX_MB*1024*1024)return setMsg('O arquivo passa de '+MAX_MB+' MB. Use um arquivo menor ou um link do YouTube.');
    setBusy(true);
    const ext=(f.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,5)||'mp3';
    const path=userId+'/'+s.id+'-'+Date.now()+'.'+ext;
    const {error}=await sb.storage.from('musicas').upload(path,f,{contentType:f.type||'audio/mpeg',upsert:false});
    if(error){setBusy(false);return setMsg('Não foi possível enviar: '+error.message)}
    const {data}=sb.storage.from('musicas').getPublicUrl(path);
    set({url:data.publicUrl,title:m.title||f.name.replace(/\.[^.]+$/,''),file:true});
    setBusy(false);
  };
  return <div className="musictab">
    <h3>🎵 Música tema</h3>
    {m.url?<p><small>Toca em loop sempre que alguém abrir esta ficha. Cada pessoa controla o próprio volume.</small></p>
      :<p className="empty">Esta ficha ainda não tem música tema.</p>}
    {can?<>
      <label className="lab">Link do YouTube ou de um áudio (mp3, ogg, wav…)
        <input placeholder="https://www.youtube.com/watch?v=…" value={m.file?'':(m.url||'')} onChange={e=>set({url:e.target.value,file:false})}/></label>
      <div className="row"><label className="btn sm">{busy?'Enviando…':'⬆️ Enviar arquivo de áudio'}<input hidden type="file" accept="audio/*" disabled={busy} onChange={e=>{const f=e.target.files[0];e.target.value='';upload(f)}}/></label>
        {m.url&&<button type="button" className="btn sm danger" onClick={()=>ed(x=>{delete x.music})}>🗑️ Remover música</button>}</div>
      {m.file&&<small>🎧 Arquivo enviado: {m.title}</small>}
      <label className="lab">Nome exibido<input placeholder="Ex.: Tema do personagem" value={m.title||''} onChange={e=>set({title:e.target.value})}/></label>
      {msg&&<div className="err">{msg}</div>}
      <small>Arquivos de até {MAX_MB} MB. Se o YouTube não tocar, o vídeo pode estar bloqueado para uso em outros sites — tente outro link.</small></>
      :m.url&&<p>🎧 <b>{m.title||'Música tema'}</b></p>}
    {m.url&&<p><small>Use os controles ▶ ⏸ 🔊 na barra no canto da tela.</small></p>}
  </div>;
}
