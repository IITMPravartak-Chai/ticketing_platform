// Root component: sign-in state, page routing and ticket links from emails (/#/t/MLOPS-0001).
import {useState,useEffect,useRef} from 'react';
import {api} from './lib/api';
import {chime} from './lib/sound';
import {Register,Verify,SetPassword,Login} from './pages/Auth';
import {UserDash,EngineerDash,AdminDash} from './pages/Dashboards';
import {Raise,Submitted} from './pages/Raise';
import {TicketList} from './pages/TicketList';
import {Users} from './pages/Users';
import {Account} from './pages/Account';
import {Settings} from './pages/Settings';
import {Notifications} from './pages/Notifications';
import {Deployments} from './pages/Deployments';
import {Detail} from './pages/ticket/Detail';
import {Shell} from './layout/Shell';

// Build id written into index.html by the server (stays __BUILD__ under the Vite dev server, which never shows the banner)
const BUILD=document.querySelector('meta[name="app-build"]')?.content||'__BUILD__';
// Email links point to /#/t/MLOPS-0001; open that ticket once the user is signed in
export const hashRid=()=>(location.hash.match(/^#\/t\/([\w-]+)$/)||[])[1]||null;
export let deepRid=hashRid();
export function landing(u){
  if(deepRid){const a=deepRid;deepRid=null;history.replaceState(null,'',location.pathname);return {n:'detail',a}}
  return {n:'dashboard'};
}
export function App(){
  const [me,setMe]=useState(null),[page,setPage]=useState({n:'login'}),[msg,setMsg]=useState(''),[ready,setReady]=useState(false),[reg,setReg]=useState({});
  const go=(n,a)=>{setMsg('');setPage({n,a})},flash=m=>setMsg(m);
  const seen=useRef(null),[stale,setStale]=useState(false),meRef=useRef(null);meRef.current=me;
  // A ticket link opened in a tab that already has the app loaded only changes the #hash, so watch for it
  useEffect(()=>{const h=()=>{const r=hashRid();if(!r)return;history.replaceState(null,'',location.pathname);
    if(meRef.current){setMsg('');setPage({n:'detail',a:r})}else deepRid=r};
    addEventListener('hashchange',h);return()=>removeEventListener('hashchange',h)},[]);
  const loadMe=async()=>{try{if(!localStorage.getItem('tok')&&!sessionStorage.getItem('tok'))throw 0;  // not signed in: skip the call
    const u=await api('/me');
    // First load only sets the baseline; afterwards a rising unread count means a new notification arrived
    if(seen.current!==null&&u.unread>seen.current){chime();if(u.latest)setMsg('🔔 '+u.latest)}
    seen.current=u.unread;setStale(BUILD!=='__BUILD__'&&u.build!==BUILD);setMe(u);return u}catch{seen.current=null;setMe(null);return null}};
  const onLogin=async()=>{const u=await loadMe();if(u){setMsg('');setPage(landing(u))}};
  useEffect(()=>{(async()=>{const u=await loadMe();if(u)setPage(landing(u));setReady(true)})()},[]);
  useEffect(()=>{if(!me)return;const t=setInterval(loadMe,5000);return()=>clearInterval(t)},[!!me]);
  useEffect(()=>{if(!msg)return;const t=setTimeout(()=>setMsg(''),5000);return()=>clearTimeout(t)},[msg]);
  const logout=()=>{localStorage.removeItem('tok');sessionStorage.removeItem('tok');seen.current=null;setMe(null);go('login')};
  if(!ready)return <div style={{padding:40}}>Loading…</div>;
  const n=page.n,isA=me&&me.role==='admin';
  let body;
  if(!me){
    if(n==='register')body=<Register go={go} setReg={setReg} flash={flash}/>;
    else if(n==='forgot')body=<Register go={go} setReg={setReg} flash={flash} reset/>;
    else if(n==='verify')body=<Verify go={go} reg={reg} setReg={setReg} flash={flash}/>;
    else if(n==='password')body=<SetPassword go={go} reg={reg} flash={flash}/>;
    else body=<Login go={go} flash={flash} onLogin={onLogin}/>;
  }else{
    let c;
    const dash=isA?<AdminDash me={me} go={go}/>:me.role==='engineer'?<EngineerDash me={me} go={go}/>:<UserDash me={me} go={go}/>;
    if(n==='raise'&&!isA)c=<Raise go={go} flash={flash}/>;
    else if(n==='submitted')c=<Submitted rid={page.a} go={go}/>;
    else if(n==='my'&&!isA)c=<TicketList key={'my'+page.a} src="/requests" initial={page.a} go={go}/>;
    else if(n==='assigned'&&me.role!=='user')c=<TicketList key={'assigned'+page.a} src="/assigned" initial={page.a} go={go} requester/>;
    else if(n==='queue'&&isA)c=<TicketList key={'queue'+page.a} src="/queue" initial={page.a} go={go} requester/>;
    else if(n==='users'&&isA)c=<Users me={me} flash={flash}/>;
    else if(n==='notifs')c=<Notifications go={go} refresh={loadMe}/>;
    else if(n==='settings')c=<Settings flash={flash}/>;
    else if(n==='account')c=<Account go={go} flash={flash}/>;
    else if(n==='deployments'&&isA)c=<Deployments go={go}/>;
    else if(n==='detail')c=<Detail key={page.a} id={page.a} me={me} flash={flash} refresh={loadMe} go={go}/>;
    else c=dash;
    body=<Shell me={me} page={page} go={go} logout={logout}>{c}</Shell>;
  }
  return <div>{stale&&<div className="update">A new version of the Service Desk is available. <button onClick={()=>location.reload()}>Reload</button></div>}
    {msg&&<div className="toast" onClick={()=>setMsg('')}>{msg}</div>}{body}</div>;
}
