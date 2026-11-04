// Settings: appearance and password.
import {useState} from 'react';
import {api} from '../lib/api';
import {getTheme,applyTheme} from '../lib/theme';
import {Ic} from '../components/Icon';
import {PwField} from '../components/ui';

export function Settings({flash}){
  const [theme,setTheme]=useState(getTheme());
  const pick=t=>{setTheme(t);try{localStorage.setItem('theme',t)}catch{}applyTheme(t)};
  const [cur,setCur]=useState(''),[p,setP]=useState(''),[c,setC]=useState(''),[busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();if(p!==c)return flash('New passwords do not match');setBusy(true);
    try{await api('/auth/change-password','POST',{current:cur,password:p});setCur('');setP('');setC('');flash('Password changed.')}catch(x){flash(x.message)}setBusy(false)};
  return <div style={{maxWidth:560}}>
    <div className="card"><h3>Appearance</h3><p className="sub" style={{marginBottom:14}}>Choose how the Service Desk looks on this browser.</p>
      <div className="seg3" role="group" aria-label="Theme">{[['light','sun','Light'],['dark','moon','Dark'],['system','monitor','System']].map(([k,ic,l])=>
        <button key={k} type="button" className={theme===k?'on':''} aria-pressed={theme===k} onClick={()=>pick(k)}><Ic n={ic} s={16}/>{l}</button>)}</div>
      {theme==='system'&&<p className="ssub" style={{marginTop:10}}>Follows your computer's light or dark setting.</p>}</div>
    <div className="card"><h3>Change Password</h3><p className="sub" style={{marginBottom:14}}>Use at least 8 characters. You stay logged in on this device.</p><form onSubmit={submit}>
      <PwField l="Current Password" value={cur} onChange={e=>setCur(e.target.value)} required autoComplete="current-password"/>
      <PwField l="New Password" value={p} onChange={e=>setP(e.target.value)} required minLength="8" autoComplete="new-password"/>
      <PwField l="Confirm New Password" value={c} onChange={e=>setC(e.target.value)} required autoComplete="new-password"/>
      <button className="btn" disabled={busy}>Change Password</button></form></div>
  </div>;
}
