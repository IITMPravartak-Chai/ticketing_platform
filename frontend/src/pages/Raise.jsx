// Raise Request form and its confirmation page.
import {useState,useEffect} from 'react';
import {TYPES,ENVS,ACCESS_LEVELS,ACCESS_TYPES} from '../lib/constants';
import {api} from '../lib/api';
import {chime} from '../lib/sound';
import {Ic} from '../components/Icon';
import {Badge,F,ImgPicker} from '../components/ui';

// Shown after a Deployment Request the server received outside working hours (India time). The ticket is already saved.
// period "early": 6:00-7:59 AM, "late": after 5:30 PM.
const TIMING={
  early:{title:'Request Received – Processing Update',ok:'OK, Got it',text:['Your ticket has been successfully submitted and received by the MLOps team.',
    "The MLOps team's working hours begin at 8:00 AM. Your deployment request will be reviewed and processing will begin during regular working hours, based on the team's availability and workload.",
    'Thank you for your patience and understanding.']},
  late:{title:'Submission Successful – Processing Update',ok:'OK, got it',text:["Today's ticket submission time (8:00 AM – 5:30 PM) has ended. However, your ticket has been successfully submitted and received by the MLOps team.",
    "If the MLOps team is available, your deployment request may be processed today. Otherwise, it will be reviewed and processed tomorrow based on the team's availability and workload.",
    'Thank you for your understanding.']}};
export function TimingNotice({period,close}){
  const t=TIMING[period];
  useEffect(()=>{const k=e=>{if(e.key==='Escape')close()};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[]);
  return <div className="modal" onClick={e=>{if(e.target===e.currentTarget)close()}}><div className="mbox sm" role="alertdialog" aria-modal="true" aria-labelledby="ah-t">
    <div className="ico info"><Ic n="clock" s={28}/></div><h3 id="ah-t" style={{margin:'6px 0'}}>{t.title}</h3>
    {t.text.map((x,i)=><p key={i}>{x}</p>)}
    <button className="btn" onClick={close} autoFocus>{t.ok}</button></div></div>;
}
export function Raise({go,flash}){
  const [f,setF]=useState({title:'',description:'',type:TYPES[0],env:'Production',repo:'',branch:'',pr_url:''}),[busy,setBusy]=useState(false);
  const [notice,setNotice]=useState(null);  // {rid, period} of a ticket submitted outside working hours, while its popup is open
  const [imgs,setImgs]=useState([]),[ac,setAc]=useState({type:'Git Repository',resource:'',level:'Read only',for:'',until:''});
  const u=k=>e=>setF({...f,[k]:e.target.value}),ua=k=>e=>setAc({...ac,[k]:e.target.value});
  const isAcc=f.type==='Access Request',isOther=f.type==='Other',shots=isOther,[resLabel,resHint]=ACCESS_TYPES[ac.type];
  const submit=async e=>{e.preventDefault();setBusy(true);try{const r=await api('/requests','POST',{...f,images:shots?imgs:[],access:isAcc?ac:{}});chime();
      if(TIMING[r.period])setNotice({rid:r.rid,period:r.period});else go('submitted',r.rid)}
    catch(x){setBusy(false);flash(x.message)}};
  return <div className="card" style={{maxWidth:820}}><h2>Raise Request</h2><p className="sub">Fill in the details. The admin will assign an owner.</p><form onSubmit={submit}>
    <F l="Request Title" value={f.title} onChange={u('title')} required maxLength="200" placeholder={isAcc?'Access to the ml-model-service repository':'Deploy model-service'}/>
    <label>{isAcc?'Why do you need this access?':'Description'}<textarea rows="4" value={f.description} onChange={u('description')} required
      placeholder={isAcc?'I need to push fixes to the model-service repository.':'Please deploy the model-service to production.'}/></label>
    <div className="row2"><label>Request Type<select value={f.type} onChange={u('type')}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
    <label>Environment<select value={f.env} onChange={u('env')}>{ENVS.map(t=><option key={t}>{t}</option>)}</select></label></div>
    {isAcc&&<label>Access To<select value={ac.type} onChange={ua('type')}>{Object.keys(ACCESS_TYPES).map(t=><option key={t}>{t}</option>)}</select></label>}
    {!isAcc&&!isOther&&<F l="Repository URL" type="url" required value={f.repo} onChange={u('repo')} placeholder="https://github.com/org/ml-model-service"/>}
    {isAcc?<>
      {ac.type!=='Model Endpoint'&&<F l={resLabel} required value={ac.resource} onChange={ua('resource')} placeholder={resHint} maxLength="300"/>}
      {ac.type==='Git Repository'&&<label>Access Level<select value={ac.level} onChange={ua('level')}>{ACCESS_LEVELS.map(t=><option key={t}>{t}</option>)}</select></label>}</>
    :!isOther&&<>
      {f.type==='Deployment Request'&&<F l="Branch Name" required value={f.branch} onChange={u('branch')} placeholder="release/v2.4" maxLength="200"
        pattern="[\w][\w.\/\-]*" title="Letters, numbers and _ . / - only (no spaces)"/>}
      <F l="Pull Request URL" type="url" required value={f.pr_url} onChange={u('pr_url')} placeholder="https://github.com/.../pull/245"/></>}
    {shots&&<ImgPicker imgs={imgs} set={setImgs} flash={flash}/>}
    <button className="btn" disabled={busy}>Submit Request</button></form>
    {notice&&<TimingNotice period={notice.period} close={()=>go('submitted',notice.rid)}/>}</div>;
}
export function Submitted({rid,go}){
  return <div className="card" style={{maxWidth:520,margin:'30px auto',textAlign:'center'}}><div className="ok"><Ic n="check" s={44}/></div>
    <h2>Request Submitted Successfully!</h2><p>Request ID <b>{rid}</b><br/><br/>Status <Badge v="NEW"/></p><p style={{color:'var(--mu)'}}>The admin has been notified and will assign an owner.</p>
    <button className="btn" onClick={()=>go('detail',rid)}>View Request</button></div>;
}
