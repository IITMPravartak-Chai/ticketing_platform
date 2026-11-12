// Dashboards for users, MLOps Engineers and admins.
import {useState} from 'react';
import {ROLES,ROLE_NAME,SC,READ_ONLY} from '../lib/constants';
import {api} from '../lib/api';
import {fmtDur} from '../lib/format';
import {useLive} from '../lib/hooks';
import {Ic} from '../components/Icon';
import {Badge,Row,Stat,CardHead} from '../components/ui';
import {ReqTable,StatusCards,StatusBar,StatusChart} from '../components/tickets';
import {Activity} from '../components/Activity';

// Information only: when submitted Deployment Requests are worked on. Other request types are not affected.
export const DeployTiming=()=><aside className="dtime" aria-label="Deployment Information">
  <h4><Ic n="info" s={16}/>Deployment Information<span className="for">· Applies to Deployment Requests only</span></h4>
  <dl><dt>8:00 AM – 12:00 PM</dt><dd>Prioritised for completion on the same working day.</dd>
    <dt>12:00 PM – 5:30 PM</dt><dd>May be completed the same day if the MLOps team has no other pending work or scheduled tasks. Otherwise it is scheduled for the next working day.</dd></dl>
  <p className="nb">Submitting within these hours does not guarantee same-day deployment. It depends on the team's workload and availability.</p></aside>;
export function UserDash({me,go}){
  const [d,setD]=useState(null),[rows,setRows]=useState([]);
  useLive(()=>Promise.all([api('/dashboard').then(setD),api('/requests?s=ALL').then(x=>setRows(x.rows.slice(0,6)))]));
  if(!d)return <div className="card">Loading…</div>;
  return <div><div className="dashhead"><div><h2 className="hello">Welcome, {me.name}!</h2><p className="sub">Your requests at a glance. Click a card to open that list. Updates automatically.</p></div>
      <DeployTiming/></div>
    <StatusCards c={d.raised} pick={s=>go('my',s)} total="All My Requests"/>
    {d.fix_needed>0&&<div className="note warn" style={{marginTop:0,marginBottom:18}}><b>{d.fix_needed}</b> of your deployments failed and {d.fix_needed>1?'need':'needs'} a bug fix. Open {d.fix_needed>1?'them':'it'}, fix the issues and use Resubmit for Redeployment.</div>}
    {d.need_reply>0&&<div className="note warn" style={{marginTop:0,marginBottom:18}}><b>{d.need_reply}</b> of your open requests {d.need_reply>1?'have':'has'} a reply waiting for you. Open the ticket's Conversation tab.</div>}
    <div className="card"><CardHead title="Recent Requests"><button className="btn" onClick={()=>go('raise')}><Ic n="plus" s={16}/> Raise Request</button></CardHead>
      <ReqTable rows={rows} go={go} empty="You haven't raised any requests yet."/></div></div>;
}
export function EngineerDash({me,go}){
  const [d,setD]=useState(null),[rows,setRows]=useState([]);
  useLive(()=>Promise.all([api('/dashboard').then(setD),api('/assigned?s=ALL').then(x=>setRows(x.rows.filter(r=>r.status!=='CLOSED')))]));
  if(!d)return <div className="card">Loading…</div>;
  const o=d.owned,cb=d.closed_by_me;
  return <div><h2 className="hello">Welcome, {me.name}!</h2><p className="sub">Tickets you own as an MLOps Engineer. Click a card to open that list. Updates automatically.</p>
    <div className="grid">
      <Stat label="Total Assigned to Me" value={o.TOTAL} icon="list" color="#4f46e5" bg="#eef2ff" onClick={()=>go('assigned','ALL')}/>
      <Stat label="To Start" value={o.ASSIGNED} icon="user" color={SC.ASSIGNED[0]} bg={SC.ASSIGNED[1]} onClick={()=>go('assigned','ASSIGNED')} sub="Assigned, not started"/>
      <Stat label="In Progress" value={o['IN PROGRESS']} icon="clock" color={SC['IN PROGRESS'][0]} bg={SC['IN PROGRESS'][1]} onClick={()=>go('assigned','IN PROGRESS')}/>
      <Stat label="On Hold" value={o['ON HOLD']} icon="pause" color={SC['ON HOLD'][0]} bg={SC['ON HOLD'][1]} onClick={()=>go('assigned','ON HOLD')}/>
      <Stat label="Closed by Me" value={o.CLOSED} icon="check" color={SC.CLOSED[0]} bg={SC.CLOSED[1]} onClick={()=>go('assigned','CLOSED')} sub={`${cb.week} in the last 7 days`}/>
      <Stat label="Avg. Time to Close" value={fmtDur(cb.avg_s)} icon="clock" color="#7c3aed" bg="#f3e8ff" sub="From ticket creation"/>
      <Stat label="Replies Waiting" value={d.owned_need_reply} icon="bell" color="#dc2626" bg="#fef2f2" sub="Open tickets with a new message"/>
    </div>
    <div className="card"><CardHead title={`My Active Tickets (${rows.length})`}><button className="btn ghost" onClick={()=>go('assigned','ALL')}>View all</button></CardHead>
      <ReqTable rows={rows} go={go} requester empty="Nothing to work on right now."/></div>
    <div className="card"><CardHead title="Requests I Raised"><button className="btn ghost" onClick={()=>go('my','ALL')}>View</button></CardHead><StatusBar c={d.raised}/></div></div>;
}
export function AdminDash({me,go}){
  const [d,setD]=useState(null);
  useLive(()=>api('/dashboard').then(setD));
  if(!d)return <div className="card">Loading…</div>;
  const a=d.all,k=d.kpi;
  return <div><h2 className="hello">Admin Dashboard</h2><p className="sub">Every ticket in the service desk. Click a card to open that list. Updates automatically.</p>
    <StatusCards c={a} pick={s=>go('queue',s)} total="All Tickets" order={['NEW','ASSIGNED','IN PROGRESS','ALL','ON HOLD','CLOSED']}/>
    <div className="grid">
      <Stat label="Needs an Owner" value={a.NEW} icon="bell" color="#dc2626" bg="#fef2f2" onClick={()=>go('queue','NEW')} sub="Unassigned new tickets"/>
      <Stat label="Created (7 days)" value={k.created_7d} icon="plus" color="#4f46e5" bg="#eef2ff"/>
      <Stat label="Closed (7 days)" value={k.closed_7d} icon="check" color="#16a34a" bg="#f0fdf4"/>
      <Stat label="Avg. Time to Close" value={fmtDur(k.avg_resolution_s)} icon="clock" color="#7c3aed" bg="#f3e8ff" sub="All closed tickets"/>
      {me.role!==READ_ONLY&&<Stat label="My Owned (open)" value={d.owned.OPEN} icon="user" color="#0369a1" bg="#e0f2fe" onClick={()=>go('assigned','ALL')} sub="Tickets you took ownership of"/>}
    </div>
    <div className="cols">
      <div className="card"><CardHead title="Status Breakdown"/><StatusChart c={a} pick={s=>go('queue',s)}/></div>
      <div className="card"><CardHead title="Users"><button className="btn ghost" onClick={()=>go('users')}>{me.role===READ_ONLY?'View':'Manage'}</button></CardHead>
        <table className="kv"><tbody>{ROLES.map(r=><Row key={r} k={ROLE_NAME[r]+'s'}>{d.users[r]}</Row>)}<Row k="Invited (not signed up)">{d.users.invited}</Row></tbody></table></div>
    </div>
    <div className="card"><CardHead title="Team Workload"><span className="sub" style={{margin:0}}>Open tickets each person owns, and tickets they have closed</span></CardHead>
      <div className="tw"><table><thead><tr><th>Name</th><th>Role</th><th>Assigned</th><th>In Progress</th><th>On Hold</th><th>Open Total</th><th>Closed</th></tr></thead><tbody>
      {d.workload.map(w=><tr key={w.id}><td>{w.name}<div className="ssub">{w.email}{w.active?'':' · invited'}</div></td><td><Badge v={w.role} t={ROLE_NAME[w.role]}/></td>
        <td>{w.assigned}</td><td>{w.in_progress}</td><td>{w.on_hold}</td><td><b>{w.assigned+w.in_progress+w.on_hold}</b></td><td>{w.closed}</td></tr>)}
      {!d.workload.length&&<tr><td colSpan="7" className="empty">No MLOps Engineers yet. Assign a ticket to someone's email to add one.</td></tr>}</tbody></table></div></div>
    <div className="card"><CardHead title="Recent Activity"><span className="sub" style={{margin:0}}>The latest 15 things people did. Hover a time to see the exact date.</span></CardHead>
      {d.recent.map(h=><Activity key={h.id} h={h} now={d.now} go={go}/>)}
      {!d.recent.length&&<div className="empty">No activity yet.</div>}</div></div>;
}
