// Deployment Request window (08:00-17:30 India time).

// Deployment window: Deployment Requests only 08:00-17:30 India time. Uses the SERVER clock (offset from /deploy-window),
// never the browser's own time; the server checks again on submit, so this is only for the user's convenience.
export const istMin=ms=>(Math.floor(ms/60000)+330)%1440;  // minute of the day in India (UTC+05:30, no daylight saving)
export const depOpen=m=>m>=480&&m<=1050,depWhen=m=>m<480?'today':'tomorrow';
