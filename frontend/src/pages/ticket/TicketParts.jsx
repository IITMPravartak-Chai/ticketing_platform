// Parts of the ticket page: secrets, PDFs, bug reports, resubmit, closure, screenshots, tracker text.
import {useState,useEffect} from 'react';
import {TRACK,LABEL} from '../../lib/constants';
import {api} from '../../lib/api';
import {dur} from '../../lib/format';
import {Ic} from '../../components/Icon';
import {Badge,F,Row,Url} from '../../components/ui';
import {DeploymentModal} from '../../components/DeploymentModal';

export function Secret({v,show}){
  const [see,setSee]=useState(!!show),[ok,setOk]=useState(false);
  const copy=()=>navigator.clipboard.writeText(v).then(()=>{setOk(true);setTimeout(()=>setOk(false),1500)});
  return <span className="secret"><code>{see?v:'••••••••'}</code>{!show&&<button type="button" className="btn ghost sm" onClick={()=>setSee(!see)}>{see?'Hide':'Show'}</button>}
    <button type="button" className="btn ghost sm" onClick={copy}>{ok?'Copied':'Copy'}</button></span>;
}
export function Pdfs({rid,files}){
  const open=async x=>{try{const d=await api(`/requests/${rid}/files/${x.id}`);const b=await (await fetch(d.src)).blob();
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=d.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}catch(e){alert(e.message)}};
  return <ul className="pdfs">{files.map(x=><li key={x.id}><Ic n="file" s={15}/>{x.name}<button type="button" className="btn ghost sm" onClick={()=>open(x)}>Download</button></li>)}</ul>;
}
export function BugReports({r}){
  return <div className="section"><h3>Deployment Bugs &amp; Fixes ({r.bugs.length})</h3>{r.bugs.map((x,i)=><div key={x.id} className={'bugrep'+(x.fixed_at?' fixed':'')}>
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:6}}><b>Attempt #{i+1} failed</b>
      {x.fixed_at?<Badge v="CLOSED" t="FIXED & RESUBMITTED"/>:<Badge v="BUG FIX" t="BUG FIX REQUIRED"/>}</div>
    <table className="kv"><tbody><Row k="Reported By">{x.reported_by_name} · {x.reported_at}</Row><Row k="Bugs / Errors">{x.description}</Row>
      {x.images.length>0&&<Row k="Screenshots"><Shots rid={r.rid} images={x.images}/></Row>}
      {x.fixed_at&&<><Row k="Fixed By">{x.fixed_by_name} · {x.fixed_at}</Row><Row k="What Was Fixed">{x.fix_notes}</Row></>}</tbody></table></div>)}</div>;
}
export function Resubmit({r,act}){
  const [f,setF]=useState({fix_notes:'',branch:r.branch||'',pr_url:r.pr_url||''}),[busy,setBusy]=useState(false);
  const u=k=>e=>setF({...f,[k]:e.target.value});
  const submit=async e=>{e.preventDefault();setBusy(true);await act('/resubmit',f,'Resubmitted. The owner has been asked to redeploy.');setBusy(false)};
  return <form className="section" onSubmit={submit} style={{maxWidth:720}}><h3>Fix the Bugs and Resubmit</h3>
    <p className="sub">Review the bugs and screenshots above, fix them, then resubmit. The deployment goes back to {r.aname||'the owner'} to redeploy.</p>
    <label>What was fixed? *<textarea rows="3" required value={f.fix_notes} onChange={u('fix_notes')} placeholder="Added scikit-learn to requirements.txt and validated empty input"/></label>
    {r.type==='Deployment Request'&&<div className="row2"><F l="Branch to Deploy" value={f.branch} onChange={u('branch')} placeholder="hotfix/v2.4.2" maxLength="200"
      pattern="[\w][\w.\/\-]*" title="Letters, numbers and _ . / - only (no spaces)"/>
      <F l="Pull Request URL" type="url" value={f.pr_url} onChange={u('pr_url')} placeholder="https://github.com/.../pull/246"/></div>}
    <button className="btn g" disabled={busy}><Ic n="send" s={16}/> Resubmit for Redeployment</button></form>;
}
export function Closure({r}){
  if(r.access)return <div className="done-box"><b>Closure Details</b><table className="kv"><tbody>
    <Row k="Closed By">{r.closed_by_name?`${r.closed_by_name} <${r.closed_by_email}>`:'-'}</Row><Row k="Closed At">{r.closed_at||'-'}</Row>
    <Row k="Result"><b>{r.deploy_status||'-'}</b></Row>{r.access.type==='Model Endpoint'&&r.deploy_status!=='Rejected'?null:<Row k={r.deploy_status==='Rejected'?'Reason':'Access Given'}>{r.deploy_notes||'-'}</Row>}
    {r.resolution?<Row k="Resolution / Instructions">{r.resolution}</Row>:null}{r.deploy_url?<Row k={r.access.type==='Model Endpoint'?'Model Endpoint URL':'Link'}><Url u={r.deploy_url}/></Row>:null}
    {r.creds?.vpn_user&&<><Row k="VPN Username"><Secret v={r.creds.vpn_user} show/></Row><Row k="VPN Password"><Secret v={r.creds.vpn_password}/></Row></>}
    {r.creds?.api_key&&<Row k="API Key / Token"><Secret v={r.creds.api_key}/></Row>}
    {r.files.length>0&&<Row k="Attached PDFs"><Pdfs rid={r.rid} files={r.files}/></Row>}</tbody></table></div>;
  return <div className="done-box"><b>Closure Details</b><table className="kv"><tbody>
    <Row k="Closed By">{r.closed_by_name?`${r.closed_by_name} <${r.closed_by_email}>`:'-'}</Row><Row k="Closed At">{r.closed_at||'-'}</Row>
    <Row k="Deployment Status"><b>{r.deploy_status||'-'}</b></Row><Row k="Deployed At">{r.deployed_at||'-'}</Row><Row k="Deployment URL"><Url u={r.deploy_url}/></Row>
    <Row k="Version">{r.version||'-'}</Row><Row k="Environment">{r.res_env||'-'}</Row>
    {r.deploy_notes?<Row k="Deployment Notes">{r.deploy_notes}</Row>:null}{r.issues&&r.issues!=='None'?<Row k="Issues Encountered">{r.issues}</Row>:null}
    {r.resolution?<Row k="Resolution">{r.resolution}</Row>:null}
  </tbody></table></div>;
}
export function Shots({rid,images}){
  const [src,setSrc]=useState({}),[big,setBig]=useState(null);
  useEffect(()=>{images.forEach(x=>api(`/requests/${rid}/images/${x.id}`).then(d=>setSrc(s=>({...s,[x.id]:d.src}))).catch(()=>{}))},[rid,images.length]);
  return <><div className="shots">{images.map(x=><div key={x.id} className="shot">{src[x.id]?<img src={src[x.id]} alt={x.name} title={x.name} onClick={()=>setBig(src[x.id])}/>:<span>Loading…</span>}</div>)}</div>
    {big&&<div className="lightbox" onClick={()=>setBig(null)}><img src={big} alt=""/></div>}</>;
}

// Text for the line between TRACK[i] and TRACK[i+1]. A skipped step (e.g. closed without Start Work) has no time,
// so the next measured line starts from the last step that did happen.
export function segText(r,i,cur){
  const t=r.tse||{},b=TRACK[i+1];let k=i;while(k>=0&&!t[TRACK[k]])k--;
  const from=k>=0?TRACK[k]:null,st=from&&t[from],name=s=>LABEL[s]||s;
  const hold=r.hold_secs>=1&&b==='CLOSED'?`includes ${dur(r.hold_secs)} on hold`:null;
  if(t[b]&&st)return [`${name(from)} → ${name(b)}: ${dur(t[b]-st)}`,from!==TRACK[i]?`${name(TRACK[i])} was skipped`:hold];
  if(!t[b]&&i+1<=cur)return [`${name(b)} was skipped`,b==='IN PROGRESS'?'Closed without pressing Start Work':null];
  if(i===cur&&st)return [`${name(from)} for ${dur(r.now-st)} so far`,r.status==='ON HOLD'?`On hold now (${dur(r.hold_secs)} on hold in total)`:r.hold_secs>=1?`includes ${dur(r.hold_secs)} on hold`:`Waiting for ${name(b)}`];
  return ['Not reached yet',null];
}

export function DepPointer({r,go}){
  const [open,setOpen]=useState(false);
  return <div className="ownbox" style={{marginTop:16}}><div><b>Deployment record (admins only)</b><div style={{color:'var(--mu)'}}>{r.deployment.deployment_type} deployment of {r.deployment.app_name} to {r.deployment.environment}</div></div>
    <button className="btn" onClick={()=>setOpen(true)}><Ic n="server" s={16}/> View Deployment Details</button>{open&&<DeploymentModal id={r.deployment.id} close={()=>setOpen(false)} go={go}/>}</div>;
}
