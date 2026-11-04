// Calls the backend REST API (/api/...) with the saved login token, and reads uploads as data: URLs.

// Reads chosen files as data: URLs, the way the API expects uploads
export const readFiles=files=>Promise.all(files.map(x=>new Promise((ok,no)=>{const fr=new FileReader();fr.onload=()=>ok({name:x.name,data:fr.result});fr.onerror=no;fr.readAsDataURL(x)})));

export async function api(path,method='GET',body){
  const t=localStorage.getItem('tok')||sessionStorage.getItem('tok');
  const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:body?JSON.stringify(body):undefined});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(typeof d.detail==='string'?d.detail:'Please check your input');
  return d;
}
