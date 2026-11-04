// Shared React hooks.
import {useEffect} from 'react';

// Runs load() now and every 10 s while the tab is visible, so dashboards and lists follow changes made by other people
export function useLive(load,deps=[],ms=10000){
  useEffect(()=>{const run=()=>load().catch(()=>{});run();const t=setInterval(()=>{if(!document.hidden)run()},ms);return()=>clearInterval(t)},deps);
}
