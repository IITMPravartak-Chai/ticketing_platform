// App frame: left sidebar, top bar and profile menu.
import {useState,useEffect,useRef} from 'react';
import {ROLE_NAME} from '../lib/constants';
import {soundOn,chime} from '../lib/sound';
import {Ic} from '../components/Icon';
import {Badge} from '../components/ui';

export function Shell({me,page,go,logout,children}){
  const [open,setOpen]=useState(false),[snd,setSnd]=useState(soundOn()),[pm,setPm]=useState(false),pfRef=useRef(null);
  // Close the profile menu on a click outside it or on Escape
  useEffect(()=>{if(!pm)return;const h=e=>{if(pfRef.current&&!pfRef.current.contains(e.target))setPm(false)},k=e=>{if(e.key==='Escape')setPm(false)};
    document.addEventListener('mousedown',h);document.addEventListener('keydown',k);return()=>{document.removeEventListener('mousedown',h);document.removeEventListener('keydown',k)}},[pm]);
  const toggleSnd=()=>{const v=!snd;setSnd(v);try{localStorage.setItem('sound',v?'on':'off')}catch{}if(v)chime(true)};
  const isA=me.role==='admin';
  const nav=[['dashboard','dash','Dashboard'],
    ...(isA?[['queue','queue','All Tickets'],['assigned','user','My Owned Tickets'],['users','users','Users & Roles']]
    :me.role==='engineer'?[['assigned','user','Assigned to Me'],['raise','plus','Raise Request'],['my','list','My Requests']]
    :[['raise','plus','Raise Request'],['my','list','My Requests']]),
    ['notifs','bell','Notifications'],...(isA?[['deployments','server','Deployment Details']]:[])];
  const home=isA?'queue':me.role==='engineer'?'assigned':'my';
  const active=(page.n==='detail'||page.n==='submitted')?home:page.n;
  const titles={dashboard:isA?'Admin Dashboard':'Dashboard',raise:'Raise Request',my:'My Requests',assigned:isA?'My Owned Tickets':'Assigned to Me',queue:'All Tickets',users:'Users & Roles',notifs:'Notifications',settings:'Settings',account:'My Account',deployments:'Deployment Details',detail:'Ticket '+(page.a||''),submitted:'Request Submitted'};
  const ini=me.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const nav2=k=>{setOpen(false);setPm(false);go(k)};
  return <div className="app"><div className={'shade '+(open?'on':'')} onClick={()=>setOpen(false)}/>
    <aside className={'side '+(open?'open':'')}>
      <div className="brand" role="link" tabIndex="0" title="Go to Dashboard" onClick={()=>nav2('dashboard')} onKeyDown={e=>{if(e.key==='Enter')nav2('dashboard')}}><img className="logo" src="/logo.png" alt="CHAI MLOps Service Desk"/></div>
      <div className="menu">{nav.map(([k,ic,l])=><div key={k} className={'nl '+(active===k?'on':'')} onClick={()=>nav2(k)}><Ic n={ic}/>{l}
        {k==='notifs'&&me.unread>0&&<span className="cnt">{me.unread}</span>}</div>)}</div>
    </aside>
    <div className="main"><div className="top"><button className="burger" onClick={()=>setOpen(true)}><Ic n="menu"/></button><h1>{titles[page.n]||''}</h1>
      <button className="btn ghost" style={{marginLeft:'auto',padding:'8px 12px'}} onClick={toggleSnd} title={snd?'Turn off the notification sound':'Turn on the notification sound'}><Ic n={snd?'vol':'mute'} s={18}/><span className="sndt">{snd?'Notification on':'Notification off'}</span></button>
      <div className="pf" ref={pfRef}><button className="pfbtn" onClick={()=>setPm(!pm)} aria-haspopup="menu" aria-expanded={pm} title={`${me.name} (${ROLE_NAME[me.role]})`}>
        <span className="av sm">{ini}</span><span className="pfn"><b>{me.name}</b><small>{ROLE_NAME[me.role]}</small></span></button>
        {pm&&<div className="pmenu" role="menu"><div className="pmh"><div className="av">{ini}</div><div><b>{me.name}</b><small>{me.email}</small><Badge v={me.role} t={ROLE_NAME[me.role]}/></div></div>
          <button className={'mi '+(active==='account'?'on':'')} role="menuitem" onClick={()=>nav2('account')}><Ic n="user" s={18}/>My Account</button>
          <button className={'mi '+(active==='settings'?'on':'')} role="menuitem" onClick={()=>nav2('settings')}><Ic n="gear" s={18}/>Settings</button>
          <button className="mi lo" role="menuitem" onClick={()=>{setPm(false);logout()}}><Ic n="out" s={18}/>Logout</button></div>}</div></div>
      <div className="content">{children}</div></div></div>;
}
