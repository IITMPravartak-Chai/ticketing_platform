// Display helpers: dates, durations and ticket owner text.

export const nowLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
export const owner=r=>r.assignee_id?`${r.aname} <${r.aemail}>`:'Unassigned';
export const ownership=r=>r.ownership==='owned'?'Taken by admin':r.ownership==='assigned'?`Assigned by ${r.assigned_by_name}`:'-';

export const fmtDur=s=>s==null?'–':s<3600?`${Math.max(1,Math.round(s/60))} min`:s<172800?`${(s/3600).toFixed(1)} h`:`${(s/86400).toFixed(1)} days`;

export const ago=(ts,now)=>{const s=Math.max(0,now-ts);return s<60?'just now':s<3600?`${Math.floor(s/60)} min ago`:s<86400?`${Math.floor(s/3600)} h ago`:s<172800?'yesterday':`${Math.floor(s/86400)} days ago`};

export const dur=s=>{s=Math.max(0,Math.round(s));const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
  return d?`${d}d ${h}h`:h?`${h}h ${m}m`:m?`${m}m${s%60?` ${s%60}s`:''}`:`${s}s`};
