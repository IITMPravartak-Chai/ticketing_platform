// Small building blocks: badges, tabs, form fields, rows, screenshot picker, links, stat tiles.
import {useState} from 'react';
import {readFiles} from '../lib/api';
import {Ic} from './Icon';

export const Badge=({v,t})=><span className={'b '+v.replace(' ','')}>{t||(v==='NEW'?'PENDING':v)}</span>;
// Status badge for a ticket: a failed deployment waiting for its fix shows BUG FIX REQUIRED instead of ON HOLD
export const StatusBadge=({r})=>r.fix_open?<Badge v="BUG FIX" t="BUG FIX REQUIRED"/>:<Badge v={r.status}/>;  // t: display text when it differs from the value (role names)
export const Tabs=({items,v,set})=><div className="tabs">{items.map(([k,l])=><a key={k} className={v===k?'on':''} onClick={()=>set(k)}>{l}</a>)}</div>;
// Red asterisk for a mandatory field. Lbl puts it right after the label text; F and PwField add it by themselves
// whenever the input is required, so the asterisk always matches what the form (and the server) enforces.
export const Req=()=><span className="req" aria-hidden="true">*</span>;
export const Lbl=({t,req})=><>{t}{req&&<>{' '}<Req/></>}</>;
export const F=({l,...p})=><label><Lbl t={l} req={p.required}/><input {...p}/></label>;
// Password box with an eye button that shows or hides what was typed
export function PwField({l,...p}){
  const [show,setShow]=useState(false);
  return <label><Lbl t={l} req={p.required}/><div className="pw"><input {...p} type={show?'text':'password'}/>
    <button type="button" className="eye" onClick={()=>setShow(!show)} title={show?'Hide password':'Show password'} aria-label={show?'Hide password':'Show password'}><Ic n={show?'eyeOff':'eye'} s={18}/></button></div></label>;
}
export const Row=({k,children})=><tr><td>{k}</td><td>{children}</td></tr>;
// Screenshot picker shared by the request and bug forms: up to 5 images, 5 MB each
export const pickImgs=async(e,imgs,set,flash)=>{const files=[...e.target.files];e.target.value='';
  if(imgs.length+files.length>5)return flash('You can attach up to 5 images');
  const big=files.find(x=>x.size>5*1024*1024);if(big)return flash(`${big.name} is larger than 5 MB`);
  set([...imgs,...await readFiles(files)])};
export function ImgPicker({imgs,set,flash}){
  return <><label>Screenshots (optional, up to 5 images, 5 MB each)
    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple onChange={e=>pickImgs(e,imgs,set,flash)}/></label>
    {imgs.length>0&&<div className="shots">{imgs.map((x,i)=><div key={i} className="shot"><img src={x.data} alt={x.name}/>
      <button type="button" title="Remove" onClick={()=>set(imgs.filter((_,j)=>j!==i))}>×</button></div>)}</div>}</>;
}
export const Url=({u})=>u?<a className="l" href={u} target="_blank" rel="noreferrer">{u}</a>:'-';

export const Stat=({label,value,icon,color,bg,onClick,sub})=><div className={'stat'+(onClick?' click':'')} onClick={onClick} title={onClick?'Open this list':undefined}>
  <div className="ic" style={{background:bg,color}}><Ic n={icon} s={22}/></div><div><small>{label}</small><h2>{value??'–'}</h2>{sub&&<div className="ssub">{sub}</div>}</div></div>;

export const CardHead=({title,children})=><div className="chead"><h3>{title}</h3>{children}</div>;
