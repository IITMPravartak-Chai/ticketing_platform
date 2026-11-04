// Recent Activity feed on the Admin Dashboard.
import {ACTION} from '../lib/constants';
import {ago} from '../lib/format';
import {Ic} from './Icon';

// Recent Activity: one plain sentence per event. Returns [icon, colour, text before the ticket id, text after it].

export function actText(h){
  const kind=h.type==='Deployment Request'?'deployment request':h.type==='Access Request'?'access request':'request';
  const to=(h.detail.match(/^Assigned to (.+?) </)||[])[1];
  switch(h.action){
    case 'CREATED':return ['plus','#4f46e5',`raised a new ${kind}`,''];
    case 'ASSIGNED':return ['user','#d97706','assigned',to?`to ${to}`:''];
    case 'REASSIGNED':return ['user','#d97706','reassigned',to?`to ${to}`:''];
    case 'OWNERSHIP_TAKEN':return ['user','#7c3aed','took ownership of','to work on it'];
    case 'STATUS_CHANGED':
      if(h.to_status==='ON HOLD')return ['pause','#64748b','put','on hold'];
      if(h.from_status==='ON HOLD')return ['clock','#0284c7','resumed work on',''];
      return ['clock','#0284c7','started work on',''];
    case 'COMMENTED':return ['send','#0f766e','replied on',''];
    case 'DEPLOY_FAILED':return ['bell','#dc2626','reported that','failed to deploy, bug fix required'];
    case 'RESUBMITTED':return ['send','#0284c7','fixed the bugs and resubmitted','for redeployment'];
    case 'CLOSED':
      if(h.type==='Access Request')return ['check','#16a34a','closed access request',h.deploy_status?`(${h.deploy_status})`:''];
      if(h.type==='Deployment Request'&&/Success/.test(h.deploy_status||''))return ['check','#16a34a','deployed','successfully and closed it'];
      return ['check','#16a34a','closed',h.deploy_status?`(${h.deploy_status})`:''];
    default:return ['list','#64748b',(ACTION[h.action]||h.action).toLowerCase(),''];
  }
}
export function Activity({h,now,go}){
  const [ic,col,pre,post]=actText(h);
  return <div className="act"><div className="aic" style={{color:col,background:col+'1a'}}><Ic n={ic} s={16}/></div>
    <div className="atx"><div><b>{h.actor||'System'}</b> {pre} <a className="l" onClick={()=>go('detail',h.rid)}>{h.rid}</a>{post?' '+post:''}
      {h.action==='COMMENTED'&&h.detail?<>: <q>{h.detail}</q></>:null}</div>
      <div className="ssub">{h.title} · {h.type}</div></div>
    <small title={h.created_at}>{ago(h.ts,now)}</small></div>;
}
