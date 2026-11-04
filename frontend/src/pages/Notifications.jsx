// Notifications.
import {useState,useEffect} from 'react';
import {api} from '../lib/api';
import {Ic} from '../components/Icon';

export function Notifications({go,refresh}){
  const [rows,setRows]=useState([]);
  useEffect(()=>{api('/notifications').then(setRows);api('/notifications/read','POST').then(refresh)},[]);
  return <div className="card">{rows.map(n=><div className="nt" key={n.id}><div className="ic"><Ic n="bell" s={18}/></div><div>
    {n.rid&&<b><a className="l" onClick={()=>go('detail',n.rid)}>{n.rid}</a></b>} <small style={{color:'var(--mu)'}}>{n.created_at}</small>
    {n.message.split('\n').map((l,i)=><div key={i}>{l}</div>)}</div></div>)}{!rows.length&&<div className="empty">No notifications.</div>}</div>;
}
