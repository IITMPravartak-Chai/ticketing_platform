// Ticket page: details, tracker, conversation and audit history.
import {useState,useEffect,useCallback} from 'react';
import {TRACK,ACTIVE,DESC,ROLE_NAME,ACTION,ACCESS_TYPES,READ_ONLY} from '../../lib/constants';
import {api} from '../../lib/api';
import {owner,ownership,dur} from '../../lib/format';
import {Ic} from '../../components/Icon';
import {Badge,StatusBadge,Tabs,Row,Url} from '../../components/ui';
import {AdminPanel,AdminFail} from './AdminActions';
import {OwnerPanel} from './OwnerActions';
import {BugReports,Resubmit,Closure,Shots,segText,DepPointer} from './TicketParts';

export function Detail({id,me,flash,refresh,go}){
  const [r,setR]=useState(null),[tab,setTab]=useState('details'),[body,setBody]=useState(''),[tip,setTip]=useState(null),[err,setErr]=useState('');
  const isA=me.role==='admin';
  const load=useCallback(()=>api('/requests/'+id).then(setR).catch(e=>{flash(e.message);setErr(e.message)}),[id]);
  useEffect(()=>{load()},[id]);
  // Follow changes made by other people (e.g. a failed deployment being resubmitted) without leaving the page
  useEffect(()=>{const t=setInterval(()=>{if(!document.hidden)api('/requests/'+id).then(setR).catch(()=>{})},10000);return()=>clearInterval(t)},[id]);
  // A ticket that doesn't exist or isn't yours (e.g. an old email link) says so instead of loading forever
  if(!r)return <div className="card">{err?<><h3 style={{marginTop:0}}>{id}</h3><p className="sub">{err}. It may not exist, or you may not have access to it.</p>
    <button className="btn ghost" onClick={()=>go('dashboard')}>Back to Dashboard</button></>:'Loading…'}</div>;
  const act=async(p,b,ok)=>{try{const d=await api('/requests/'+id+p,'POST',b);await load();refresh();if(ok)flash(typeof ok==='function'?ok(d):ok);return true}catch(e){flash(e.message);await load();return false}};
  const active=ACTIVE.includes(r.status);
  const send=async e=>{e.preventDefault();if(await act('/comments',{body}))setBody('')};
  const cur=TRACK.indexOf(r.status==='ON HOLD'?'IN PROGRESS':r.status);
  return <div className="card"><div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><h2 style={{margin:0}}>{r.rid}</h2><StatusBadge r={r}/></div>
    <h3 style={{margin:'6px 0 16px',color:'var(--mu)',fontWeight:500}}>{r.title}</h3>
    <Tabs v={tab} set={setTab} items={[['details','Details'],['tracker','Tracker'],['conv','Conversation'],['history','Audit History']]}/>
    {tab==='details'&&<div><table className="kv"><tbody>
      <Row k="Requester">{`${r.rname} <${r.remail}>`}</Row><Row k="Type">{r.type}</Row><Row k="Environment">{r.env}</Row>
      {r.access?<><Row k="Access To">{r.access.type}</Row>{r.access.resource?<Row k={ACCESS_TYPES[r.access.type]?.[0]||'Server / System'}><b>{r.access.resource}</b></Row>:null}
        {r.access.level?<Row k="Access Level">{r.access.level}</Row>:null}{r.access.for!==r.remail?<Row k="Access For">{r.access.for.split(',').join(', ')}</Row>:null}{r.access.until?<Row k="Needed Until">{r.access.until}</Row>:null}</>
      :r.type!=='Other'&&<><Row k="Repository">{/^https?:\/\//.test(r.repo)?<Url u={r.repo}/>:r.repo||'-'}</Row>{r.branch?<Row k="Branch"><b>{r.branch}</b></Row>:null}<Row k="Pull Request"><Url u={r.pr_url}/></Row></>}
      <Row k="Owner">{owner(r)}</Row><Row k="Ownership">{ownership(r)}{r.assigned_at?` on ${r.assigned_at}`:''}</Row>
      {r.cc?<Row k="Also Notified">{r.cc.split(',').join(', ')}</Row>:null}
      {r.status==='CLOSED'?<Row k="Closed By"><b>{`${r.closed_by_name} <${r.closed_by_email}>`}</b>{` on ${r.closed_at}`}</Row>:null}
      <Row k="Created">{r.created_at}</Row><Row k="Last Updated">{r.updated_at}</Row><Row k="Description">{r.description}</Row>
      {r.images.length>0&&<Row k="Screenshots"><Shots rid={r.rid} images={r.images}/></Row>}</tbody></table>
      {r.status==='CLOSED'&&<Closure r={r}/>}
      {r.deployment&&<DepPointer r={r} go={go}/>}
      {r.bugs.length>0&&<BugReports r={r}/>}
      {r.fix_open&&(me.id===r.requester_id||(r.requester_gone&&(me.role==='admin'||r.is_owner)))&&<Resubmit key={r.bugs.length} r={r} act={act}/>}
      {r.is_owner&&active&&<OwnerPanel r={r} act={act} flash={flash} me={me}/>}
      {!r.is_owner&&active&&<div className="note"><b>{r.aname}</b> owns this ticket and is responsible for resolving and closing it.{isA?' Use Take Ownership below to work on it yourself.':''}</div>}
      {isA&&r.status!=='CLOSED'&&<div className="section"><AdminPanel key={r.assignee_id||0} r={r} act={act}/>
        {!r.access&&!r.fix_open&&!r.is_owner&&r.assignee_id&&<AdminFail act={act} flash={flash}/>}</div>}</div>}
    {tab==='tracker'&&<div><div className="track">{TRACK.map((s,i)=><div key={s} className={'step '+(i<=cur?'done ':'')+(i===cur?'cur':'')}><div className="dot">{i<=cur?<Ic n="check" s={16}/>:i+1}</div>
      <b>{i===cur&&r.status==='ON HOLD'?(r.fix_open?'BUG FIX REQUIRED':'ON HOLD'):s==='NEW'?'PENDING':s}</b>{i===cur&&r.status==='ON HOLD'?(r.fix_open?'Waiting for the fix':DESC['ON HOLD']):DESC[s]}<br/>{i<=cur?r.ts[s]||'':''}
        {i<TRACK.length-1&&(([a,b])=><span className={'seg'+(i<cur?' done':i===cur&&r.status!=='CLOSED'?' now':'')+(tip===i?' open':'')} tabIndex="0"
          onClick={()=>setTip(tip===i?null:i)} onBlur={()=>setTip(null)}><span className="tip">{a}{b&&<small>{b}</small>}</span></span>)(segText(r,i,cur))}</div>)}</div>
      {r.tse?.NEW&&<p><b>Total time:</b> {dur((r.tse.CLOSED||r.now)-r.tse.NEW)}{r.tse.CLOSED?' (New → Closed)':' so far'}{r.hold_secs>=1?`, including ${dur(r.hold_secs)} on hold`:''}
        <span style={{color:'var(--mu)'}}> · Hover or tap a line to see the time between steps</span></p>}
      <p><b>Current Status:</b> <Badge v={r.status}/> &nbsp; <b>Owner:</b> {owner(r)}</p>{r.status==='CLOSED'&&(r.access?<p><b>Result:</b> {r.deploy_status}</p>:<p><b>Deployment URL:</b> <Url u={r.deploy_url}/></p>)}</div>}
    {tab==='conv'&&<div><div className="chat">{r.comments.map((m,i)=><div key={i} className={'msg '+(m.author_id===me.id?'me':'')}><small><b>{m.name}</b> ({ROLE_NAME[m.role]}) · {m.created_at}</small>{m.body}</div>)}
      {!r.comments.length&&<div className="empty">No messages yet.</div>}</div>
      {r.status!=='CLOSED'&&me.role===READ_ONLY&&<p className="ssub">Read-only access: you can read the conversation but not reply.</p>}
      {r.status!=='CLOSED'&&me.role!==READ_ONLY&&<form className="chatbox" onSubmit={send}><textarea rows="2" required value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a reply..."/><button className="btn"><Ic n="send" s={16}/> Send</button></form>}</div>}
    {tab==='history'&&<div><h3>Ticket Record</h3><table className="kv"><tbody>
      <Row k="Created By">{`${r.rname} <${r.remail}>`}</Row><Row k="Created At">{r.created_at}</Row>
      <Row k="Owner">{owner(r)}</Row><Row k="Ownership">{ownership(r)}</Row><Row k="Assigned / Taken At">{r.assigned_at||'-'}</Row>
      <Row k={r.access?'Result':'Deployment Status'}>{r.deploy_status||'-'}</Row><Row k={r.access?'Completed At':'Deployed At'}>{r.deployed_at||'-'}</Row><Row k="URL"><Url u={r.deploy_url}/></Row>
      <Row k="Server Type">{r.server_type||'-'}</Row>
      <Row k="Closed By">{r.closed_by_name?`${r.closed_by_name} <${r.closed_by_email}>`:'-'}</Row><Row k="Closed At">{r.closed_at||'-'}</Row></tbody></table>
      <h3 style={{marginTop:24}}>Audit Trail</h3><div className="tw"><table><thead><tr><th>When</th><th>Action</th><th>Status</th><th>By</th><th>Details</th></tr></thead><tbody>
      {r.history.map(h=><tr key={h.id}><td style={{whiteSpace:'nowrap'}}>{h.created_at}</td><td>{ACTION[h.action]||h.action}</td>
        <td style={{whiteSpace:'nowrap'}}>{h.to_status?(h.from_status&&h.from_status!==h.to_status?`${h.from_status} → ${h.to_status}`:h.to_status):''}</td><td>{h.actor||'-'}</td><td>{h.detail}</td></tr>)}</tbody></table></div></div>}
  </div>;
}
