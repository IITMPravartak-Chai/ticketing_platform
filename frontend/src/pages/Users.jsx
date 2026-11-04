// Users & Roles (admins only).
import {useState,useEffect} from 'react';
import {ROLES,ROLE_NAME} from '../lib/constants';
import {api} from '../lib/api';
import {Badge} from '../components/ui';

export function Users({me,flash}){
  const [rows,setRows]=useState([]);
  const load=()=>api('/users').then(setRows).catch(e=>flash(e.message));
  useEffect(()=>{load()},[]);
  const setRole=async(u,role)=>{try{await api(`/users/${u.id}/role`,'POST',{role});flash(`${u.email} is now ${ROLE_NAME[role]}`)}catch(e){flash(e.message)}load()};
  const del=async u=>{if(!confirm(`Delete ${u.name} (${u.email})?\n\nThey will no longer be able to sign in. Tickets they raised or worked on are kept. This cannot be undone.`))return;
    try{const d=await api(`/users/${u.id}`,'DELETE');flash(d.how==='deleted'?`${u.email} was deleted.`:`${u.email} was deleted. Their name stays on the tickets they worked on.`)}catch(e){flash(e.message)}load()};
  return <div className="card"><p className="sub">Users raise tickets. MLOps Engineers work on tickets assigned to them. Admins assign tickets, take ownership and manage roles.
    Assigning a ticket to someone makes them an MLOps Engineer automatically.</p>
    <div className="tw"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Account</th><th>Open Tickets Owned</th><th>Joined</th><th></th></tr></thead><tbody>
    {rows.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td>
      <td>{u.id===me.id?<Badge v={u.role} t={ROLE_NAME[u.role]}/>:<select value={u.role} onChange={e=>setRole(u,e.target.value)} style={{margin:0,width:'auto',padding:'6px 10px'}}>{ROLES.map(r=><option key={r} value={r}>{ROLE_NAME[r]}</option>)}</select>}</td>
      <td>{u.active?'Active':'Invited (not signed up yet)'}</td><td>{u.owned_open}</td><td>{u.created_at}</td>
      <td>{u.id!==me.id&&<button className="btn ghost sm del" onClick={()=>del(u)} title={`Delete ${u.email}`}>Delete</button>}</td></tr>)}
    {!rows.length&&<tr><td colSpan="7" className="empty">No users.</td></tr>}</tbody></table></div></div>;
}
