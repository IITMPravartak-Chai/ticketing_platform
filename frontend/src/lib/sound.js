// Notification chime.

// Notification chime built with Web Audio (no sound file). Browsers only allow audio after the user has clicked or typed once.
export let actx=null;
export const audio=()=>{try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume()}catch{}return actx};
['pointerdown','keydown'].forEach(ev=>addEventListener(ev,audio,{once:true}));
export const soundOn=()=>{try{return localStorage.getItem('sound')!=='off'}catch{return true}};
export function chime(force){
  if(!force&&!soundOn())return;const c=audio();if(!c)return;
  [[880,0],[1318.5,0.15]].forEach(([f,t])=>{const o=c.createOscillator(),g=c.createGain(),s=c.currentTime+t;o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,s);g.gain.exponentialRampToValueAtTime(0.3,s+0.02);g.gain.exponentialRampToValueAtTime(0.0001,s+0.5);
    o.connect(g).connect(c.destination);o.start(s);o.stop(s+0.55)});
}
