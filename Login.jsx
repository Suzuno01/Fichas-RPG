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
