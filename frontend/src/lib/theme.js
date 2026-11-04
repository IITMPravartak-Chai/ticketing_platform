// Light / dark / system theme.

// Theme: 'light' | 'dark' | 'system' (follows the computer). Stored per browser; applied as data-theme on <html>.
export const getTheme=()=>{try{return localStorage.getItem('theme')||'light'}catch{return 'light'}};
export const applyTheme=t=>{document.documentElement.dataset.theme=(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))?'dark':'light'};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(getTheme()==='system')applyTheme('system')});
