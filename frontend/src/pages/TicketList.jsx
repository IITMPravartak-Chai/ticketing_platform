// Ticket list with status tabs (My Requests, Assigned to Me, All Tickets).
import {useState} from 'react';
import {STAT,LABEL} from '../lib/constants';
import {api} from '../lib/api';
import {useLive} from '../lib/hooks';
import {Tabs} from '../components/ui';
import {ReqTable} from '../components/tickets';

export function TicketList({src,go,initial,requester}){
  const [s,setS]=useState(STAT.includes(initial)?initial:'ALL'),[d,setD]=useState({rows:[],counts:{}});
  useLive(()=>api(`${src}?s=${encodeURIComponent(s)}`).then(setD),[src,s]);
  return <div className="card"><Tabs v={s} set={setS} items={[['ALL',`All (${d.counts.TOTAL||0})`],...STAT.map(k=>[k,`${LABEL[k]} (${d.counts[k]||0})`])]}/>
    <ReqTable rows={d.rows} go={go} requester={requester} empty={s==='ALL'?'No tickets yet.':`No ${LABEL[s].toLowerCase()} tickets.`}/></div>;
}
