// Raise Request form and its confirmation page.
import {useState,useEffect} from 'react';
import {TYPES,ENVS,ACCESS_LEVELS,ACCESS_TYPES} from '../lib/constants';
import {api} from '../lib/api';
import {chime} from '../lib/sound';
import {istMin,depOpen,depWhen} from '../lib/deployWindow';
import {Ic} from '../components/Icon';
import {Badge,F,ImgPicker} from '../components/ui';

export function DeployClosed({when,close}){
  useEffect(()=>{const k=e=>{if(e.key==='Escape')close()};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[]);
  return <div className="modal" onClick={e=>{if(e.target===e.currentTarget)close()}}><div className="mbox sm" role="alertdialog" aria-modal="true" aria-labelledby="dc-t">
    <div className="ico"><Ic n="clock" s={28}/></div><h3 id="dc-t" style={{margin:'6px 0'}}>Deployment Request Closed</h3>
    {when==='tomorrow'?<p>Today's ticket request time is over.<br/>You can try tomorrow between 8:00 AM and 5:30 PM.</p>
      :<p>Ticket requests have not opened yet.<br/>You can try today between 8:00 AM and 5:30 PM.</p>}
    <button className="btn" onClick={close} autoFocus>OK, got it</button></div></div>;
}
export function Raise({go,flash}){
  const [f,setF]=useState({title:'',description:'',type:TYPES[0],env:'Production',repo:'',branch:'',pr_url:''}),[busy,setBusy]=useState(false);
  const [skew,setSkew]=useState(null),[,setTick]=useState(0),[pop,setPop]=useState(false);
  const syncClock=()=>api('/deploy-window').then(w=>setSkew(w.now_ms-Date.now())).catch(()=>{});
  useEffect(()=>{syncClock();const i=setInterval(()=>setTick(x=>x+1),15000);return()=>clearInterval(i)},[]);
  const isDep=f.type==='Deployment Request',nowM=skew===null?null:istMin(Date.now()+skew),closed=isDep&&nowM!==null&&!depOpen(nowM);
  const [imgs,setImgs]=useState([]),[ac,setAc]=useState({type:'Git Repository',resource:'',level:'Read only',for:'',until:''});
  const u=k=>e=>setF({...f,[k]:e.target.value}),ua=k=>e=>setAc({...ac,[k]:e.target.value});
  const isAcc=f.type==='Access Request',isOther=f.type==='Other',shots=isOther,[resLabel,resHint]=ACCESS_TYPES[ac.type];
  const submit=async e=>{e.preventDefault();if(closed){setPop(true);return}setBusy(true);try{const r=await api('/requests','POST',{...f,images:shots?imgs:[],access:isAcc?ac:{}});chime();go('submitted',r.rid)}
    catch(x){setBusy(false);if(/^Deployment Request closed/.test(x.message)){syncClock();setPop(true)}else flash(x.message)}};
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
    {closed?<button type="button" className="btn off" aria-disabled="true" title="Deployment requests are closed now" onClick={()=>setPop(true)}>Submit Request</button>
      :<button className="btn" disabled={busy}>Submit Request</button>}</form>
    {pop&&<DeployClosed when={depWhen(nowM===null?istMin(Date.now()):nowM)} close={()=>setPop(false)}/>}</div>;
}
export function Submitted({rid,go}){
  return <div className="card" style={{maxWidth:520,margin:'30px auto',textAlign:'center'}}><div className="ok"><Ic n="check" s={44}/></div>
    <h2>Request Submitted Successfully!</h2><p>Request ID <b>{rid}</b><br/><br/>Status <Badge v="NEW"/></p><p style={{color:'var(--mu)'}}>The admin has been notified and will assign an owner.</p>
    <button className="btn" onClick={()=>go('detail',rid)}>View Request</button></div>;
}
