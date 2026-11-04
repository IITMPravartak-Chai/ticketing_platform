// Failed / Bug Fix Required pop-up.
import {useState} from 'react';
import {Ic} from '../../components/Icon';
import {ImgPicker} from '../../components/ui';

// Pop-up for "Failed / Bug Fix Required": describe the bugs, attach screenshots, send to the requester's team
export function FailModal({act,flash,close}){
  const [desc,setDesc]=useState(''),[imgs,setImgs]=useState([]),[busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);
    if(await act('/fail',{description:desc,images:imgs},'Marked as Failed / Bug Fix Required. The requester has been notified.'))close(true);else setBusy(false)};
  return <div className="modal" onClick={e=>{if(e.target===e.currentTarget)close()}}><form onSubmit={submit}>
    <h3 style={{marginTop:0}}>Failed / Bug Fix Required</h3><p className="sub">Describe what went wrong. The requester and the team are notified so they can fix it and resubmit.</p>
    <label>Bugs or errors encountered *<textarea rows="5" required autoFocus value={desc} onChange={e=>setDesc(e.target.value)}
      placeholder={'Pod crashes on start-up: ModuleNotFoundError: sklearn\n/predict returns 500 for empty input'}/></label>
    <ImgPicker imgs={imgs} set={setImgs} flash={flash}/>
    <div className="actions"><button className="btn" style={{background:'#dc2626'}} disabled={busy}><Ic n="send" s={16}/> Submit Bug Report</button>
      <button type="button" className="btn ghost" onClick={()=>close()}>Cancel</button></div></form></div>;
}
