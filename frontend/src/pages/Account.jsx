// My Account.
import {useState,useEffect} from 'react';
import {ROLE_NAME,READ_ONLY} from '../lib/constants';
import {api} from '../lib/api';
import {Ic} from '../components/Icon';
import {Badge,Row,Stat,CardHead} from '../components/ui';

export const ROLE_INFO={user:'Raises deployment and access requests and follows them until they are closed.',
  engineer:'Works on the tickets assigned to you: starts, holds and closes them. You can also raise your own requests.',
  admin:'Assigns tickets to the team, can take ownership of any ticket, and manages users and roles.',
  admin_read_only:'Sees every ticket, the Admin Dashboard, users and deployment details, but cannot change anything.'};
export function Account({go,flash}){
  const [d,setD]=useState(null);
  useEffect(()=>{api('/account').then(setD).catch(e=>flash(e.message))},[]);
  if(!d)return <div className="card">Loading…</div>;
  const ini=d.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(),staff=d.role==='engineer'||d.role==='admin',isA=d.role==='admin',ro=d.role===READ_ONLY;
  return <div style={{maxWidth:820}}>
    <div className="card"><div className="acct"><div className="av lg">{ini}</div><div><h2>{d.name}</h2>
      <div style={{color:'var(--mu)',marginBottom:8}}>{d.email}</div><Badge v={d.role} t={ROLE_NAME[d.role]}/></div></div>
      <table className="kv"><tbody>
        <Row k="Full Name">{d.name}</Row><Row k="Login Email">{d.email}</Row>
        <Row k="Role"><Badge v={d.role} t={ROLE_NAME[d.role]}/><div className="ssub" style={{marginTop:6}}>{ROLE_INFO[d.role]}</div></Row>
        <Row k="Account Status">Active</Row><Row k="Member Since">{d.joined}</Row><Row k="Last Changed">{d.updated}</Row></tbody></table>
      <p className="ssub" style={{marginTop:14}}>{isA?'Roles are managed on the Users & Roles page.':ro?'You have read-only access. Ask an admin if your role is wrong.':'Only an admin can change your role. Ask an admin if it is wrong.'}</p>
      <div className="actions"><button className="btn" onClick={()=>go('settings')}><Ic n="key" s={16}/> Change Password</button>
        {(isA||ro)&&<button className="btn ghost" onClick={()=>go('users')}><Ic n="users" s={16}/> Users &amp; Roles</button>}</div></div>
    {!ro&&<div className="card"><CardHead title="Your Tickets"/><div className="grid" style={{marginBottom:0}}>
      {!isA&&<Stat label="Requests I Raised" value={d.raised.TOTAL} icon="list" color="#4f46e5" bg="#eef2ff" onClick={()=>go('my','ALL')} sub={`${d.raised.OPEN} still open`}/>}
      {staff&&<Stat label={isA?'Tickets I Own (open)':'Assigned to Me (open)'} value={d.owned.OPEN} icon="user" color="#0369a1" bg="#e0f2fe" onClick={()=>go('assigned','ALL')} sub={`${d.owned.TOTAL} in total`}/>}
      {staff&&<Stat label="Closed by Me" value={d.closed_by_me} icon="check" color="#16a34a" bg="#f0fdf4" onClick={()=>go('assigned','CLOSED')}/>}</div></div>}
  </div>;
}
