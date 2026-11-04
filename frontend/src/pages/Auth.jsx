// Sign-in, account creation, email code and password screens.
import {useState} from 'react';
import {api} from '../lib/api';
import {Ic} from '../components/Icon';
import {F,PwField} from '../components/ui';

/* ---------- Auth screens ---------- */
export function AuthShell({children}){
  return <div className="authwrap"><div className="hero"><img className="logo" src="/logo.png" alt="CHAI MLOps Service Desk"/>
    <p>Raise, track and close deployment and access requests in one place.</p>
    <ul>{['Secure email OTP sign-up','Admin assigns or takes ownership of tickets','Email notifications at every step','Full audit trail for every ticket'].map(t=><li key={t}><span><Ic n="check" s={14}/></span>{t}</li>)}</ul></div>
    <div className="formside"><div className="formcard">{children}</div></div></div>;
}
export function Register({go,setReg,flash,reset}){
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);
    try{const d=await api(reset?'/auth/forgot':'/auth/register','POST',{name,email});setReg({email:email.trim().toLowerCase(),dev:d.dev_code,reset:!!reset});go('verify')}
    catch(x){flash(x.message)}setBusy(false)};
  return <AuthShell><h2>{reset?'Reset Password':'Create Account'}</h2><p className="sub">{reset?'Enter your email to get a verification code.':'Register with your personal or company email. If a ticket was assigned to you, use that email.'}</p>
    <form onSubmit={submit}>{!reset&&<F l="Full Name" value={name} onChange={e=>setName(e.target.value)} required placeholder="John Doe"/>}
    <F l="Email Address" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="john@example.com"/>
    <button className="btn w" disabled={busy}>Send Verification Code</button></form>
    <p style={{textAlign:'center'}}><a className="l" onClick={()=>go('login')}>Back to login</a></p></AuthShell>;
}
export function Verify({go,reg,setReg,flash}){
  const [d,setD]=useState(['','','','','','']);
  const set=(i,v)=>{v=v.replace(/\D/g,'').slice(-1);const n=[...d];n[i]=v;setD(n);if(v&&i<5)document.getElementById('o'+(i+1)).focus()};
  const paste=(i,e)=>{const v=e.clipboardData.getData('text').replace(/\D/g,'');if(!v)return;e.preventDefault();  // pasting the code from the email fills every box
    const n=[...d];[...v.slice(0,6-i)].forEach((x,j)=>n[i+j]=x);setD(n);document.getElementById('o'+Math.min(5,i+v.length)).focus()};
  const submit=async e=>{e.preventDefault();
    try{const r=await api('/auth/verify','POST',{email:reg.email,code:d.join('')});setReg({...reg,ticket:r.ticket});go('password')}catch(x){flash(x.message)}};
  const resend=async()=>{try{const r=await api('/auth/resend','POST',{email:reg.email});setReg({...reg,dev:r.dev_code});flash('A new code has been sent.')}catch(x){flash(x.message)}};
  return <AuthShell><h2>Verify your email</h2><p className="sub">We sent a 6-digit code to <b>{reg.email}</b></p>
    {reg.dev&&<div className="dev">Dev mode (no SMTP): your code is <b>{reg.dev}</b></div>}
    <form onSubmit={submit}><div className="otp">{d.map((v,i)=><input key={i} id={'o'+i} value={v} inputMode="numeric" autoComplete="one-time-code" onChange={e=>set(i,e.target.value)} onPaste={e=>paste(i,e)}
      onKeyDown={e=>{if(e.key==='Backspace'&&!d[i]&&i>0)document.getElementById('o'+(i-1)).focus()}}/>)}</div>
    <p style={{textAlign:'center',color:'var(--mu)'}}>Code expires in 10 minutes.</p><button className="btn w" disabled={d.join('').length<6}>Verify</button></form>
    <p style={{textAlign:'center'}}><a className="l" onClick={resend}>Resend Code</a></p></AuthShell>;
}
export function SetPassword({go,reg,flash}){
  const [p,setP]=useState(''),[c,setC]=useState('');
  const n=(p.length>=8)+/[A-Z]/.test(p)+/[0-9]/.test(p)+/[^A-Za-z0-9]/.test(p);
  const col=n>=4?'#16a34a':n>=3?'#65a30d':n>=2?'#d97706':'#dc2626';
  const submit=async e=>{e.preventDefault();
    if(p!==c)return flash('Passwords do not match');
    try{await api('/auth/set-password','POST',{ticket:reg.ticket,password:p});go('login');flash(reg.reset?'Password changed. Please login.':'Account ready. Please login.')}catch(x){flash(x.message)}};
  return <AuthShell><h2>{reg.reset?'New Password':'Set Password'}</h2><p className="sub">Choose a strong password for your account.</p><form onSubmit={submit}>
    <PwField l="Password" value={p} onChange={e=>setP(e.target.value)} required minLength="8" autoComplete="new-password"/>
    <div className="meter"><i style={{width:(p?n*25:0)+'%',background:col}}/></div>
    <div style={{fontWeight:700,marginBottom:12,color:col,minHeight:18}}>{p&&['Weak','Weak','Fair','Good','Strong'][n]}</div>
    <PwField l="Confirm Password" value={c} onChange={e=>setC(e.target.value)} required autoComplete="new-password"/>
    <button className="btn w">{reg.reset?'Change Password':'Create Account'}</button></form></AuthShell>;
}
export function Login({go,flash,onLogin}){
  const [email,setEmail]=useState(''),[pw,setPw]=useState(''),[rem,setRem]=useState(true);
  const submit=async e=>{e.preventDefault();
    try{const r=await api('/auth/login','POST',{email,password:pw});localStorage.removeItem('tok');sessionStorage.removeItem('tok');
      (rem?localStorage:sessionStorage).setItem('tok',r.token);onLogin()}catch(x){flash(x.message)}};
  return <AuthShell><h2>Welcome Back</h2><p className="sub">Login to your service desk account.</p><form onSubmit={submit}>
    <F l="Email Address" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="john@example.com"/>
    <PwField l="Password" value={pw} onChange={e=>setPw(e.target.value)} required autoComplete="current-password"/>
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
      <label style={{display:'flex',alignItems:'center',gap:8,fontWeight:500}}><input type="checkbox" style={{width:'auto',margin:0}} checked={rem} onChange={e=>setRem(e.target.checked)}/>Remember me</label>
      <a className="l" onClick={()=>go('forgot')}>Forgot password?</a></div>
    <button className="btn w">Login</button></form>
    <p style={{textAlign:'center'}}>New user? <a className="l" onClick={()=>go('register')}>Create account</a></p></AuthShell>;
}
