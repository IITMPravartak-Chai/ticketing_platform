// Admin actions on a ticket: assign, take ownership, mark a deployment failed.
import {useState,useEffect} from 'react';
import {api} from '../../lib/api';
import {Ic} from '../../components/Icon';
import {F,Lbl} from '../../components/ui';
import {FailModal} from './FailModal';

export function PersonPicker({value,onChange}){
  const [team,setTeam]=useState([]),[other,setOther]=useState(false);
  useEffect(()=>{api('/team').then(setTeam).catch(()=>{})},[]);
  return <>
    <label><Lbl t="Team member" req/><select required value={other?'*':value} onChange={e=>{const v=e.target.value;setOther(v==='*');onChange(v==='*'?'':v)}}>
      <option value="" disabled>Select a person</option>
      {team.map(p=><option key={p.email} value={p.email}>{p.name} ({p.email})</option>)}
      <option value="*">Someone else (type their email)</option></select></label>
    {other&&<F l="Email" type="email" required value={value} onChange={e=>onChange(e.target.value)} placeholder="name@iitmpravartak.net" autoComplete="off"/>}</>;
}
export function AdminPanel({r,act}){
  const [email,setEmail]=useState(''),[cc,setCc]=useState(r.cc||''),[busy,setBusy]=useState(false);
  const run=async(p,b,ok)=>{setBusy(true);await act(p,b,ok);setBusy(false)};
  const submit=e=>{e.preventDefault();const to=email.trim();
    run('/assign',{email:to,cc},d=>d.email_error?`Assigned to ${to}, but the email was NOT sent: ${d.email_error}`:`Assigned to ${to}. Email sent.`)};
  return <div><h3>Admin Actions</h3>
    {!r.is_owner&&<div className="ownbox"><div><b>Take Ownership</b><div style={{color:'var(--mu)'}}>Become responsible for this ticket and resolve and close it yourself.</div></div>
      <button className="btn" disabled={busy} onClick={()=>run('/take-ownership',undefined,`You now own ${r.rid}. Use Start Work when you begin.`)}><Ic n="user" s={16}/> Take Ownership</button></div>}
    <form onSubmit={submit} style={{maxWidth:560,marginTop:18}}><h4 style={{margin:'0 0 8px'}}>{r.assignee_id?'Reassign to a team member':'Assign to a team member'}</h4>
      <PersonPicker value={email} onChange={setEmail}/>
      <F l="Also notify (optional, comma-separated emails)" value={cc} onChange={e=>setCc(e.target.value)} placeholder="lead@iitmpravartak.net, qa@iitmpravartak.net"/>
      <button className="btn" disabled={busy||!email.trim()}><Ic n="send" s={16}/> Assign &amp; Send Email</button></form></div>;
}

// Admins can mark someone else's deployment as failed without taking ownership
export function AdminFail({act,flash}){
  const [open,setOpen]=useState(false);
  return <div style={{marginTop:18}}><button className="btn ghost" onClick={()=>setOpen(true)}><Ic n="send" s={16}/> Mark Failed / Bug Fix Required</button>
    {open&&<FailModal act={act} flash={flash} close={()=>setOpen(false)}/>}</div>;
}
