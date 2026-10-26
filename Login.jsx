import {useState,useEffect} from 'react';
import {hasMaster,signIn,bootstrapMaster} from './cloud.js';

// Tela única de entrada. O sistema reconhece sozinho se a conta é de Mestre ou de Jogador.
// Enquanto não existir nenhum Mestre no servidor, aparece a tela de primeiro acesso.
export default function Login({msg}){
  const [first,setFirst]=useState(null),[n,setN]=useState(()=>{try{return new URLSearchParams(location.search).get('login')||''}catch{return''}}),[p,setP]=useState(''),[e,setE]=useState(msg||''),[busy,setBusy]=useState(false);
  useEffect(()=>{hasMaster().then(h=>setFirst(!h)).catch(x=>{setFirst(false);setE(x.message)})},[]);
  const go=async()=>{
    setE('');
    if(first&&(n.trim().length<2||p.length<6))return setE('Login (2+) e senha (6+ caracteres).');
    if(!n.trim()||!p)return setE('Informe login e senha.');
    setBusy(true);
    try{first?await bootstrapMaster(n.trim(),p):await signIn(n.trim(),p)}
    catch(x){setE(x.message);setBusy(false)}
  };
  if(first===null)return <div className="login"><div className="panel"><h1>⚔️ Fichas de RPG</h1><p>Conectando…</p></div></div>;
  return <div className="login"><form className="panel" onSubmit={ev=>{ev.preventDefault();go()}}>
    <h1>⚔️ Fichas de RPG</h1>
    {first
      ?<><p>👑 <b>Primeiro acesso</b> — crie a conta do Mestre para começar.</p>
        <small>Jogadores não se cadastram sozinhos: o Mestre cria o login e a senha de cada um depois.</small></>
      :<><p>Entre na aventura</p>
        <small>Use seu login e senha. O sistema reconhece sozinho se você é Mestre ou Jogador.</small></>}
    <input placeholder="Login" value={n} onChange={ev=>setN(ev.target.value)} autoFocus={!n} autoComplete="username"/>
    <input type="password" placeholder="Senha" autoFocus={!!n} value={p} onChange={ev=>setP(ev.target.value)} autoComplete={first?'new-password':'current-password'}/>
    {e&&<div className="err">{e}</div>}
    <button className="btn big" disabled={busy}>{busy?'Aguarde…':first?'👑 CRIAR CONTA DE MESTRE':'ENTRAR'}</button>
    {!first&&<small>Jogadores recebem login e senha do Mestre.</small>}</form></div>;
}
