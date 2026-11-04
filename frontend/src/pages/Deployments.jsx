// Deployment Details (admins only).
import {useState} from 'react';
import {ROLE_NAME,DEP_ENVS} from '../lib/constants';
import {api} from '../lib/api';
import {useLive} from '../lib/hooks';
import {Ic} from '../components/Icon';
import {Badge,Url} from '../components/ui';
import {depBadge,DeploymentModal} from '../components/DeploymentModal';

export function Deployments({go}){
  const [rows,setRows]=useState(null),[f,setF]=useState({q:'',type:'ALL',env:'ALL'}),[sel,setSel]=useState(null),[err,setErr]=useState('');
  useLive(()=>api('/deployments').then(setRows).catch(e=>setErr(e.message)));
  const [dl,setDl]=useState(false);
  if(!rows)return <div className="card">{err||'Loading…'}</div>;
  const qq=f.q.trim().toLowerCase(),u=k=>e=>setF({...f,[k]:e.target.value});
  const excel=async()=>{setDl(true);try{const d=await api(`/deployments/export?q_=${encodeURIComponent(f.q)}&type=${encodeURIComponent(f.type)}&env=${encodeURIComponent(f.env)}`);
    const b=await (await fetch(d.src)).blob(),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=d.name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000)}catch(e){alert(e.message)}setDl(false)};
  const shown=rows.filter(x=>(f.type==='ALL'||x.deployment_type===f.type)&&(f.env==='ALL'||x.environment===f.env)
    &&(!qq||[x.rid,x.app_name,x.server_name,x.server_ip,x.deployed_by_name,x.app_url,x.title].join(' ').toLowerCase().includes(qq)));
  return <div className="card"><div className="dephead"><p className="sub">Every deployment recorded when a Deployment Request was closed. <b>Confidential: admins only.</b> Click a row to see the full record.</p>
    <button className="btn g" onClick={excel} disabled={dl||!shown.length} title={shown.length?`Download the ${shown.length} record(s) shown as an Excel file`:'Nothing to download'}><Ic n="download" s={16}/> {dl?'Preparing…':'Download Excel'}</button></div>
    <div className="filters"><input type="search" placeholder="Search ticket, application, server, IP or person" value={f.q} onChange={u('q')} aria-label="Search deployments"/>
      <select value={f.type} onChange={u('type')} aria-label="Deployment type"><option value="ALL">All types</option><option>Manual</option><option>CI/CD</option></select>
      <select value={f.env} onChange={u('env')} aria-label="Environment"><option value="ALL">All environments</option>{DEP_ENVS.map(t=><option key={t}>{t}</option>)}</select>
      <span className="ssub">{shown.length} of {rows.length}</span></div>
    <div className="tw"><table><thead><tr><th>Ticket ID</th><th>Application</th><th>Server</th><th>Type</th><th>Environment</th><th>Status</th><th>Deployed At</th><th>Deployed By</th><th>Application URL</th></tr></thead><tbody>
    {shown.map(x=><tr key={x.id} className="click" onClick={()=>setSel(x.id)} title="Open the full record">
      <td style={{whiteSpace:'nowrap'}}><a className="l" onClick={e=>{e.stopPropagation();go('detail',x.rid)}}>{x.rid}</a></td><td>{x.app_name}</td>
      <td>{x.server_name}<div className="ssub"><code>{x.server_ip}</code></div></td><td>{depBadge(x.deployment_type)}</td><td>{x.environment}</td>
      <td><Badge v="CLOSED" t={x.status}/></td><td style={{whiteSpace:'nowrap'}}>{x.deployed_at}</td><td>{x.deployed_by_name}<div className="ssub">{ROLE_NAME[x.deployed_by_role]||x.deployed_by_role}</div></td>
      <td onClick={e=>e.stopPropagation()}><Url u={x.app_url}/></td></tr>)}
    {!shown.length&&<tr><td colSpan="9" className="empty">{rows.length?'No deployments match these filters.':'No deployments recorded yet. They appear here when a Deployment Request is closed.'}</td></tr>}</tbody></table></div>
    {sel&&<DeploymentModal id={sel} close={()=>setSel(null)} go={go}/>}</div>;
}
