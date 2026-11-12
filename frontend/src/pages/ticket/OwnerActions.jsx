// Owner actions: start, hold, resume and close (deployment details form, access result).
import {useState,useRef} from 'react';
import {ROLE_NAME,ENVS,DEPLOY,FAILED,ACCESS_STAT,DEP_ENVS,SERVER_TYPES} from '../../lib/constants';
import {readFiles} from '../../lib/api';
import {nowLocal} from '../../lib/format';
import {Ic} from '../../components/Icon';
import {F,Lbl} from '../../components/ui';
import {FailModal} from './FailModal';

// Server Type: required to close any ticket. Starts empty so the person closing it always makes a choice.
export const ServerType=({v,set})=><label><Lbl t="Server Type" req/><select required value={v} onChange={e=>set(e.target.value)}>
  <option value="" disabled>Select Server Type</option>{SERVER_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>;
const NEED_TYPE='Please select the Server Type before closing the ticket.';

// Closing a Deployment Request: the deployment details form (Manual or CI/CD). Confidential: only admins can read it later.
export function DeployForm({r,me,act,cancel,flash}){
  const key=useRef(`${r.rid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);  // same key on a retry, so no duplicate record
  const [fail,setFail]=useState(false),[busy,setBusy]=useState(false);
  const [d,setD]=useState({deployment_type:'Manual',app_name:'',app_url:'',server_name:'',server_ip:'',environment:r.env==='Staging'?'Testing':DEP_ENVS.includes(r.env)?r.env:'Production',
    deployed_at:nowLocal(),version:'',notes:'',manual_steps:'',pipeline_name:'',pipeline_run_id:'',commit_id:''}),[stype,setStype]=useState('');
  const u=k=>e=>setD({...d,[k]:e.target.value}),cicd=d.deployment_type==='CI/CD';
  const submit=async e=>{e.preventDefault();if(!stype)return flash(NEED_TYPE);setBusy(true);
    await act('/close',{server_type:stype,deploy_status:DEPLOY[0],deployed_at:d.deployed_at,deploy_url:d.app_url,version:d.version,env:'Production',notes:'',resolution:'',deployment:{...d,manual_steps:''},idem:key.current},
      x=>x.duplicate?'These deployment details were already saved. The ticket is closed.':'Deployment details saved. The ticket is closed and the requester has been notified.');setBusy(false)};
  const Type=({v,ic,title,sub})=><button type="button" className={d.deployment_type===v?'on':''} aria-pressed={d.deployment_type===v} onClick={()=>setD({...d,deployment_type:v})}>
    <Ic n={ic} s={22}/><span><b>{title}</b><small>{sub}</small></span></button>;
  return <><form className="depform" onSubmit={submit} style={{marginTop:16}}><h3>Deployment Details</h3>
    <p className="sub">Needed to close this ticket. Fields marked * are required.</p>
    <div className="conf"><b>Confidential.</b> Only admins can see these details. The requester only gets the status, date and application URL.</div>
    <div className="row2"><label><Lbl t="Deployment Status" req/><select value={DEPLOY[0]} onChange={e=>{if(e.target.value===FAILED)setFail(true)}}>{DEPLOY.map(t=><option key={t}>{t}</option>)}</select></label>
      <F l="Ticket ID" value={r.rid} readOnly/></div>
    <label style={{marginBottom:6}}><Lbl t="Deployment Type" req/></label>
    <div className="dtype"><Type v="Manual" ic="server" title="Manual Deployment" sub="Deployed by hand on the server"/><Type v="CI/CD" ic="git" title="CI/CD (Automated) Deployment" sub="Deployed by a pipeline"/></div>
    <h4>Application and server</h4>
    <div className="row2"><F l="Application Name" required maxLength="200" value={d.app_name} onChange={u('app_name')} placeholder="fraud-model-service"/>
      <F l="Application URL" type="url" required value={d.app_url} onChange={u('app_url')} placeholder="https://fraud.example.com"/></div>
    <div className="row2"><F l="Server Name" required maxLength="200" value={d.server_name} onChange={u('server_name')} placeholder="ml-prod-01"/>
      <F l="Server IP Address / Host" required maxLength="253" pattern="[A-Za-z0-9][A-Za-z0-9.:\-]*" title="An IP address or host name" value={d.server_ip} onChange={u('server_ip')} placeholder="10.10.5.21"/></div>
    <div className="row2"><label><Lbl t="Deployment Environment" req/><select value={d.environment} onChange={u('environment')}>{DEP_ENVS.map(t=><option key={t}>{t}</option>)}</select></label>
      <F l="Deployment Date and Time" type="datetime-local" required value={d.deployed_at} onChange={u('deployed_at')}/></div>
    <div className="row2"><ServerType v={stype} set={setStype}/>
      <F l="Version" maxLength="100" value={d.version} onChange={u('version')} placeholder="v2.4.1"/></div>
    {cicd?<><h4>CI/CD pipeline</h4>
      <div className="row2"><F l="Pipeline Name" required maxLength="200" value={d.pipeline_name} onChange={u('pipeline_name')} placeholder="deploy-prod"/>
        <F l="Pipeline Run ID" required maxLength="200" value={d.pipeline_run_id} onChange={u('pipeline_run_id')} placeholder="9876543210"/></div>
      <F l="Commit ID" pattern="[0-9a-fA-F]{7,40}" title="7 to 40 hexadecimal characters" value={d.commit_id} onChange={u('commit_id')} placeholder="3f2a9c1"/></>
    :null}
    <label>Deployment Notes / Description<textarea rows="2" maxLength="5000" value={d.notes} onChange={u('notes')} placeholder="Anything worth knowing later"/></label>
    <F l="Deployed By" value={`${me.name} (${ROLE_NAME[me.role]})`} readOnly/>
    <div className="actions"><button className="btn g" disabled={busy}><Ic n="check" s={16}/> Submit Deployment Details &amp; Close Ticket</button><button type="button" className="btn ghost" onClick={cancel}>Cancel</button></div></form>
    {fail&&<FailModal act={act} flash={flash} close={done=>{setFail(false);if(done)cancel()}}/>}</>;
}

export function CloseForm({env,acc,act,cancel,flash,r,me}){
  const [fail,setFail]=useState(false);
  const [c,setC]=useState({deploy_status:(acc?ACCESS_STAT:DEPLOY)[0],deployed_at:nowLocal(),notes:'',issues:'',resolution:'',deploy_url:'',version:'',env,vpn_user:'',vpn_password:'',api_key:'',files:[],server_type:''});
  const [busy,setBusy]=useState(false);
  const u=k=>e=>setC({...c,[k]:e.target.value});
  const vpn=acc&&acc.type==='VPN'&&c.deploy_status!=='Rejected',ep=acc&&acc.type==='Model Endpoint'&&c.deploy_status!=='Rejected';
  const addPdfs=async e=>{const files=[...e.target.files];e.target.value='';
    if(c.files.length+files.length>5)return alert('You can attach up to 5 PDF files');
    const big=files.find(x=>x.size>10*1024*1024);if(big)return alert(`${big.name} is larger than 10 MB`);
    const bad=files.find(x=>!/\.pdf$/i.test(x.name));if(bad)return alert(`${bad.name} is not a PDF file`);
    const add=await readFiles(files);setC(c=>({...c,files:[...c.files,...add]}))};
  const submit=async e=>{e.preventDefault();if(!c.server_type)return flash(NEED_TYPE);setBusy(true);await act('/close',acc?{...c,deployed_at:nowLocal(),files:vpn?c.files:[],deploy_url:ep?c.deploy_url:'',api_key:'',notes:ep?'Model endpoint URL shared':c.notes}:c,'Ticket closed. Everyone involved has been notified.');setBusy(false)};
  if(acc)return <form onSubmit={submit} style={{marginTop:16}}><h3>Close Access Request</h3><p className="sub">Fields marked * are required.</p>
    <div className="row2"><label><Lbl t="Result" req/><select value={c.deploy_status} onChange={u('deploy_status')}>{ACCESS_STAT.map(t=><option key={t}>{t}</option>)}</select></label>
      <ServerType v={c.server_type} set={v=>setC({...c,server_type:v})}/></div>
    {ep?<F l="Model Endpoint URL" type="url" required value={c.deploy_url} onChange={u('deploy_url')} placeholder="https://ml.example.com/v1/fraud-model"/>
    :<label><Lbl t={c.deploy_status==='Rejected'?'Reason for rejecting':'Access Given'} req/><textarea rows="3" required value={c.notes} onChange={u('notes')}
      placeholder={c.deploy_status==='Rejected'?'Why the request was rejected':acc.type==='VPN'?'VPN account created on the office VPN':'Added to the ml-devs group with read-write on the repository'}/></label>}
    {vpn&&<><div className="row2"><F l="VPN Username" required autoComplete="off" value={c.vpn_user} onChange={u('vpn_user')} placeholder="janani.n"/>
      <F l="VPN Password" required autoComplete="new-password" value={c.vpn_password} onChange={u('vpn_password')} placeholder="Temporary password"/></div>
    <label>Attach PDFs (optional, up to 5 files, 10 MB each), e.g. VPN config or setup guide
      <input type="file" accept="application/pdf,.pdf" multiple onChange={addPdfs}/></label>
    {c.files.length>0&&<ul className="pdfs">{c.files.map((x,i)=><li key={i}><Ic n="file" s={15}/>{x.name}
      <button type="button" className="btn ghost sm" onClick={()=>setC({...c,files:c.files.filter((_,j)=>j!==i)})}>Remove</button></li>)}</ul>}</>}
    <div className="actions"><button className="btn g" disabled={busy}><Ic n="check" s={16}/> Close Ticket</button><button type="button" className="btn ghost" onClick={cancel}>Cancel</button></div></form>;
  if(r&&r.type==='Deployment Request')return <DeployForm r={r} me={me} act={act} cancel={cancel} flash={flash}/>;
  return <><form onSubmit={submit} style={{marginTop:16}}><h3>Deployment Result</h3><p className="sub">Fields marked * are required.</p>
    <div className="row2"><label><Lbl t="Deployment Status" req/><select value={DEPLOY[0]} onChange={e=>{if(e.target.value===FAILED)setFail(true)}}>{DEPLOY.map(t=><option key={t}>{t}</option>)}</select></label>
    <F l="Deployment Date / Time" type="datetime-local" required value={c.deployed_at} onChange={u('deployed_at')}/></div>
    <F l="Deployment / Application URL" type="url" required value={c.deploy_url} onChange={u('deploy_url')} placeholder="https://ml-service.example.com"/>
    <div className="row2"><F l="Version" value={c.version} onChange={u('version')} placeholder="v2.4.1"/>
    <label><Lbl t="Environment" req/><select value={c.env} onChange={u('env')}>{ENVS.map(t=><option key={t}>{t}</option>)}</select></label></div>
    <ServerType v={c.server_type} set={v=>setC({...c,server_type:v})}/>
    <label>Deployment Notes (optional)<textarea rows="2" value={c.notes} onChange={u('notes')} placeholder="What was deployed and how"/></label>
    <div className="actions"><button className="btn g" disabled={busy}><Ic n="check" s={16}/> Mark as Deployed &amp; Close</button><button type="button" className="btn ghost" onClick={cancel}>Cancel</button></div></form>
    {fail&&<FailModal act={act} flash={flash} close={done=>{setFail(false);if(done)cancel()}}/>}</>;
}
export function OwnerPanel({r,act,flash,me}){
  const [mode,setMode]=useState(null),[reason,setReason]=useState('');
  const hold=async e=>{e.preventDefault();if(await act('/hold',{reason},'Ticket put ON HOLD')){setMode(null);setReason('')}};
  if(r.fix_open)return <div className="section"><h3>Work on this Ticket</h3><div className="note warn" style={{marginTop:0}}>This deployment is waiting for a bug fix.
    Once {r.rname} (or you) fixes it and uses <b>Resubmit for Redeployment</b>, it comes back to you to redeploy.</div></div>;
  return <div className="section"><h3>Work on this Ticket</h3><p className="sub" style={{marginBottom:14}}>You own this ticket. Only you can update its status and close it.</p>
    <div className="actions">
      {r.status==='ASSIGNED'&&<button className="btn" onClick={()=>act('/start',undefined,'Ticket moved to IN PROGRESS')}><Ic n="clock" s={16}/> Start Work</button>}
      {r.status==='IN PROGRESS'&&mode!=='hold'&&<button className="btn ghost" onClick={()=>setMode('hold')}>Put On Hold</button>}
      {r.status==='ON HOLD'&&<button className="btn" onClick={()=>act('/resume',undefined,'Work resumed')}>Resume Work</button>}
      {mode!=='close'&&<button className="btn g" onClick={()=>setMode('close')}><Ic n="check" s={16}/> {r.access?'Close Ticket':'Record Deployment Result'}</button>}</div>
    {mode==='hold'&&<form onSubmit={hold} style={{marginTop:16,maxWidth:560}}>
      <label><Lbl t="Reason for hold" req/><textarea rows="2" required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Waiting for credentials from the requester"/></label>
      <div className="actions"><button className="btn">Put On Hold</button><button type="button" className="btn ghost" onClick={()=>setMode(null)}>Cancel</button></div></form>}
    {mode==='close'&&<CloseForm env={r.env} acc={r.access} act={act} flash={flash} r={r} me={me} cancel={()=>setMode(null)}/>}</div>;
}
