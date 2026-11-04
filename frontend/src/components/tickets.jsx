// Ticket table and status summaries (cards, bar, column chart).
import {STAT,LABEL,SC,SICON} from '../lib/constants';
import {StatusBadge,Stat} from './ui';

export function ReqTable({rows,go,requester,empty='No tickets yet.'}){
  return <div className="tw"><table><thead><tr><th>ID</th><th>Title</th><th>Status</th>{requester&&<th>Requester</th>}<th>Owner</th><th>Updated</th></tr></thead><tbody>
    {rows.map(r=><tr key={r.rid}><td><a className="l" onClick={()=>go('detail',r.rid)}>{r.rid}</a></td><td>{r.title}</td><td><StatusBadge r={r}/></td>
      {requester&&<td>{r.rname}</td>}<td>{r.aname||'Unassigned'}</td><td>{r.updated_at}</td></tr>)}
    {!rows.length&&<tr><td colSpan={requester?6:5} className="empty">{empty}</td></tr>}</tbody></table></div>;
}

export function StatusCards({c,pick,total,order=['ALL',...STAT]}){
  return <div className="grid">{order.map(s=>s==='ALL'?<Stat key={s} label={total} value={c.TOTAL} icon="list" color="#4f46e5" bg="#eef2ff" onClick={()=>pick('ALL')}/>
    :<Stat key={s} label={LABEL[s]} value={c[s]} icon={SICON[s]} color={SC[s][0]} bg={SC[s][1]} onClick={()=>pick(s)}/>)}</div>;
}
export function StatusBar({c}){
  const t=c.TOTAL||0;
  return <div><div className="sbar">{t?STAT.filter(s=>c[s]).map(s=><i key={s} style={{width:(c[s]/t*100)+'%',background:SC[s][2]}} title={`${LABEL[s]}: ${c[s]}`}/>):<i style={{width:'100%',background:'#e2e8f0'}}/>}</div>
    <div className="legend">{STAT.map(s=><span key={s}><b style={{background:SC[s][2]}}/>{LABEL[s]} <strong>{c[s]}</strong> ({t?Math.round(c[s]/t*100):0}%)</span>)}</div></div>;
}
// Column chart of ticket counts per status; the y-axis has 4 even steps. Click a column to open that list.
export function StatusChart({c,pick}){
  const t=c.TOTAL||0,step=Math.max(1,Math.ceil(Math.max(...STAT.map(s=>c[s]||0))/4)),top=step*4,pct=s=>t?Math.round(c[s]/t*100):0;
  return <div className="vchart"><div className="vplot">
      {[0,1,2,3,4].map(i=><div key={i} className={'vgrid'+(i?'':' base')} style={{bottom:i*25+'%'}}><span>{i*step}</span></div>)}
      <div className="vcols">{STAT.map(s=><div key={s} className={'vcol'+(pick?' click':'')} onClick={pick&&(()=>pick(s))} title={`${LABEL[s]}: ${c[s]} (${pct(s)}%)`}>
        <b>{c[s]}</b><i style={{height:(c[s]||0)/top*100+'%',background:SC[s][2]}}/></div>)}</div></div>
    <div className="vlabels">{STAT.map(s=><span key={s}>{LABEL[s]}<small>{pct(s)}%</small></span>)}</div></div>;
}
