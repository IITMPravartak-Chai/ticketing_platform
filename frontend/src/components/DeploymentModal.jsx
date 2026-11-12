// Full deployment record pop-up (admins only).
import {useState,useEffect} from 'react';
import {ROLE_NAME} from '../lib/constants';
import {api} from '../lib/api';
import {Badge,Row,Url} from './ui';

export const depBadge=t=><Badge v={t==='CI/CD'?'CICD':'MANUAL'} t={t}/>;

// Full deployment record (admins only; the API refuses everyone else)
export function DeploymentModal({id,close,go}){
  const [d,setD]=useState(null),[err,setErr]=useState('');
  useEffect(()=>{api('/deployments/'+id).then(setD).catch(e=>setErr(e.message))},[id]);
  useEffect(()=>{const k=e=>{if(e.key==='Escape')close()};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[]);
  return <div className="modal" onClick={e=>{if(e.target===e.currentTarget)close()}}><div className="mbox" role="dialog" aria-label="Deployment record">
    {!d?<p>{err||'Loading…'}</p>:<>
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}><h3 style={{margin:0}}>Deployment of {d.app_name}</h3>{depBadge(d.deployment_type)}<Badge v="CLOSED" t={d.status}/></div>
    <p className="sub" style={{marginTop:6}}>Ticket <a className="l" onClick={()=>{close();go('detail',d.rid)}}>{d.rid}</a> · {d.title}</p>
    <h4>Application and server</h4><table className="kv"><tbody>
      <Row k="Application Name">{d.app_name}</Row><Row k="Application URL"><Url u={d.app_url}/></Row><Row k="Server Name">{d.server_name}</Row>
      <Row k="Server IP / Host"><code>{d.server_ip}</code></Row><Row k="Server Type">{d.server_type||'-'}</Row><Row k="Environment">{d.environment}</Row>{d.method?<Row k="Deployment Method">{d.method}</Row>:null}
      <Row k="Deployed At">{d.deployed_at}</Row><Row k="Version">{d.version||'-'}</Row></tbody></table>
    {d.deployment_type==='CI/CD'?<><h4>CI/CD pipeline</h4><table className="kv"><tbody>
      {d.cicd_tool?<Row k="CI/CD Tool">{d.cicd_tool}</Row>:null}<Row k="Pipeline Name">{d.pipeline_name}</Row><Row k="Pipeline Run ID"><code>{d.pipeline_run_id}</code></Row>
      {d.repo_url?<Row k="Repository"><Url u={d.repo_url}/></Row>:null}<Row k="Commit ID">{d.commit_id?<code>{d.commit_id}</code>:'-'}</Row></tbody></table></>
    :d.manual_steps?<><h4>Manual deployment</h4><table className="kv"><tbody><Row k="Steps Performed"><div style={{whiteSpace:'pre-wrap'}}>{d.manual_steps}</div></Row></tbody></table></>:null}
    <h4>Notes and audit</h4><table className="kv"><tbody>
      <Row k="Notes"><div style={{whiteSpace:'pre-wrap'}}>{d.notes||'-'}</div></Row>
      <Row k="Deployed By">{`${d.deployed_by_name} <${d.deployed_by_email}>`} · {ROLE_NAME[d.deployed_by_role]||d.deployed_by_role}</Row>
      <Row k="Submitted At">{d.submitted_at}</Row></tbody></table></>}
    <div className="actions" style={{marginTop:16}}><button className="btn ghost" onClick={close}>Close</button></div></div></div>;
}
