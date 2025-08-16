/************ Core State ************/
const S = {
  fps:false, ping:false, coords:false, clock:false, session:false,
  zoomKey:false, zoomFov:30,
  minimap:false, radar:false, mapZoom:8, markerSize:4,
  fullbright:false, customCrosshair:false, crosshairStyle:'plus',
  chunkGrid:false, guiScale:100, compactChat:false, chatTimestamps:false,
  waypoints:[], showWpList:true
};

let sessionStart = Date.now();
let lastFrame = performance.now(), fps = 0;
let pingMs = null;
let mapZoomPxPerBlock = S.mapZoom; // dynamic
let holdingZoom = false;

/************ Boot / Game ************/
function launchGame(){
  document.getElementById('menu').style.display='none';
  document.getElementById('game').style.display='block';
  document.getElementById('gameFrame').src = "eaglercraft/Release 1.8.8.html";
  requestAnimationFrame(loop);
}

window.launchGame = launchGame;

/************ Menu hotkeys & tabs ************/
const menu = document.getElementById('clientMenu');
document.addEventListener('keydown', e=>{
  if(e.code==='ShiftRight') menu.classList.add('show');
  if(e.code==='ControlRight') menu.classList.remove('show');

  // Waypoints hotkeys
  if(e.code==='KeyB') addWaypointFromPlayer();
  if(e.code==='KeyL'){ S.showWpList = !S.showWpList; renderWaypointOverlay(); }
  if(e.code==='KeyC'){ holdingZoom = true; }
});
document.addEventListener('keyup', e=>{
  if(e.code==='KeyC'){ holdingZoom = false; document.getElementById('zoomIndicator').textContent=''; }
});

document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tabview').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});

/************ Settings binding ************/
document.querySelectorAll('[data-setting]').forEach(el=>{
  const key = el.getAttribute('data-setting');
  // init values
  if(el.type==='checkbox') el.checked = !!S[key];
  else if(el.type==='range' || el.tagName==='SELECT') el.value = S[key];

  el.addEventListener('input', ()=>{
    if(el.type==='checkbox') S[key] = el.checked;
    else if(el.type==='range') S[key] = Number(el.value);
    else if(el.tagName==='SELECT') S[key] = el.value;
    onSettingChanged(key);
  });
});

function onSettingChanged(k){
  if(k==='fullbright') document.getElementById('fullbright').classList.toggle('hidden', !S.fullbright);
  if(k==='customCrosshair' || k==='crosshairStyle') updateCrosshair();
  if(k==='guiScale') document.documentElement.style.fontSize = (S.guiScale/100)+'rem';
  if(k==='mapZoom') mapZoomPxPerBlock = S.mapZoom;
}

/************ Buttons in Navigation tab ************/
document.getElementById('addWpBtn').addEventListener('click', addWaypointFromPlayer);
document.getElementById('exportWpBtn').addEventListener('click', exportWaypoints);
document.getElementById('importWpBtn').addEventListener('click', ()=>document.getElementById('importWpFile').click());
document.getElementById('importWpFile').addEventListener('change', importWaypointsFile);

/************ Overlay loop ************/
function loop(){
  const now = performance.now();
  fps = Math.max(1, Math.round(1000 / (now - lastFrame)));
  lastFrame = now;

  // HUD: FPS
  document.getElementById('overlay-fps').textContent = S.fps ? `FPS: ${fps}` : '';

  // HUD: Ping (best-effort: small HEAD to same origin)
  if(S.ping){
    if(pingMs==null || now % 1000 < 16){ // ~1s
      const t0 = performance.now();
      fetch('.', {method:'HEAD', cache:'no-store'}).then(()=> {
        pingMs = Math.round(performance.now()-t0);
        document.getElementById('overlay-ping').textContent = `Ping: ${pingMs} ms`;
      }).catch(()=> document.getElementById('overlay-ping').textContent = 'Ping: n/a');
    }
  } else document.getElementById('overlay-ping').textContent='';

  // HUD: Coords (if exposed)
  const P = getPlayer();
  if(S.coords && P){
    document.getElementById('overlay-coords').textContent = `XYZ: ${P.x.toFixed(1)} ${P.y.toFixed(1)} ${P.z.toFixed(1)} | Yaw: ${Math.round(P.yaw)}°`;
  } else document.getElementById('overlay-coords').textContent = '';

  // Clock & Session
  if(S.clock) document.getElementById('overlay-clock').textContent = new Date().toLocaleTimeString();
  else document.getElementById('overlay-clock').textContent='';
  if(S.session){
    const secs = Math.floor((Date.now()-sessionStart)/1000);
    const hh = String(Math.floor(secs/3600)).padStart(2,'0');
    const mm = String(Math.floor((secs%3600)/60)).padStart(2,'0');
    const ss = String(secs%60).padStart(2,'0');
    document.getElementById('overlay-session').textContent = `Session: ${hh}:${mm}:${ss}`;
  } else document.getElementById('overlay-session').textContent='';

  // Zoom indicator (UI only; does not modify game FOV internally)
  if(S.zoomKey && holdingZoom){
    document.getElementById('zoomIndicator').textContent = `Zoom FOV ~ ${S.zoomFov}`;
  }

  // Minimap & Radar (UI overlay, based on player pos/yaw and waypoints)
  drawMinimap(P);

  // Crosshair update (class controlled)
  updateCrosshair();

  // Waypoints overlay
  renderWaypointOverlay();

  requestAnimationFrame(loop);
}

/************ Game access helpers (best effort) ************/
// These try to read from the game if it exposes a global; they fail quietly otherwise.
function getMinecraft(){
  try{
    // Some builds attach to parent/iframe contentWindow; we can’t break sandboxing, so this is UI-only.
    // We cannot access iframe internals due to cross-origin; so return null.
    return null;
  }catch{ return null; }
}
function getPlayer(){
  // Without programmatic access to the iframe, we cannot read live coords.
  // Provide a soft fallback: keep the last known waypoint as center (0,64,0) if none.
  // Users can still set waypoints manually.
  return { x: lastKnown.x, y: lastKnown.y, z: lastKnown.z, yaw: lastKnown.yaw };
}

/************ Manual position fallback (for UI demo) ************/
// Since we cannot read the game iframe for security reasons on GitHub Pages,
// we keep a “manual” position the user can bump with arrow keys to preview UI.
// Remove this block if you gain in-page access to game data.
let lastKnown = {x:0, y:64, z:0, yaw:0};
document.addEventListener('keydown', e=>{
  const step = (e.shiftKey?5:1);
  if(e.code==='ArrowUp') lastKnown.z -= step;
  if(e.code==='ArrowDown') lastKnown.z += step;
  if(e.code==='ArrowLeft') lastKnown.x -= step;
  if(e.code==='ArrowRight') lastKnown.x += step;
  if(e.code==='KeyQ') lastKnown.y += step;
  if(e.code==='KeyE') lastKnown.y -= step;
  if(e.code==='KeyA') lastKnown.yaw = (lastKnown.yaw-5+360)%360;
  if(e.code==='KeyD') lastKnown.yaw = (lastKnown.yaw+5)%360;
});

/************ Crosshair / Fullbright ************/
function updateCrosshair(){
  const ch = document.getElementById('crosshair');
  ch.className = 'crosshair';
  if(!S.customCrosshair){ ch.classList.add('hidden'); return; }
  ch.classList.remove('hidden');
  ch.classList.add(S.crosshairStyle || 'plus');
}
onSettingChanged('fullbright'); // initialize overlay

/************ Waypoints ************/
function addWaypointFromPlayer(){
  const P = getPlayer();
  const name = prompt('Waypoint name:', 'Waypoint');
  if(!name) return;
  S.waypoints.push({name, x:P.x, y:P.y, z:P.z, color:'#00eaff', enabled:true});
  renderWpList();
}
function renderWpList(){
  const list = document.getElementById('wpList');
  list.innerHTML = '';
  S.waypoints.forEach((w,i)=>{
    const item = document.createElement('div'); item.className='wp-item'; item.textContent = `${w.name} [${w.x|0},${w.y|0},${w.z|0}]`;
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent = w.enabled?'Hide':'Show';
    btn.onclick=()=>{ w.enabled=!w.enabled; renderWpList(); };
    list.appendChild(item); list.appendChild(btn);
  });
}
function renderWaypointOverlay(){
  const div = document.getElementById('overlay-waypoints');
  if(!S.showWpList){ div.textContent=''; return; }
  const lines = S.waypoints.filter(w=>w.enabled).map(w=>`${w.name}: [${w.x|0}, ${w.y|0}, ${w.z|0}]`);
  div.innerHTML = lines.length? ('Waypoints:<br>'+lines.join('<br>')) : '';
}
function exportWaypoints(){
  const blob = new Blob([JSON.stringify(S.waypoints,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'f1shpr0_waypoints.json'; a.click();
}
function importWaypointsFile(e){
  const file = e.target.files[0]; if(!file) return;
  const fr = new FileReader();
  fr.onload = ()=>{ try{ S.waypoints = JSON.parse(fr.result); renderWpList(); }catch{} };
  fr.readAsText(file);
}

/************ Minimap / Radar (UI) ************/
function drawMinimap(P){
  const cvs = document.getElementById('minimap');
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0,0,cvs.width,cvs.height);
  if(!S.minimap && !S.radar) return;

  const size = cvs.width;
  const center = size/2;

  // Background disc / frame
  ctx.save();
  ctx.translate(center, center);

  // Radar ring
  if(S.radar){
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(0,0, center-6, 0, Math.PI*2); ctx.strokeStyle = '#00eaff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
    // heading tick marks
    for(let a=0;a<360;a+=30){
      const rad = a*Math.PI/180;
      ctx.beginPath();
      ctx.moveTo(Math.cos(rad)*(center-14), Math.sin(rad)*(center-14));
      ctx.lineTo(Math.cos(rad)*(center-8), Math.sin(rad)*(center-8));
      ctx.strokeStyle = '#00eaff55'; ctx.lineWidth=2; ctx.stroke();
    }
  }

  // Minimap “terrain” placeholder (since we can’t read blocks across iframe):
  // draw subtle rotating grid to give spatial reference
  if(S.minimap){
    ctx.save();
    ctx.rotate(-(P?.yaw||0) * Math.PI/180); // rotate so forward is up
    const grid = 16; // block size grid
    ctx.strokeStyle = '#00eaff18';
    for(let x=-center; x<=center; x+=grid){
      ctx.beginPath(); ctx.moveTo(x,-center); ctx.lineTo(x,center); ctx.stroke();
    }
    for(let y=-center; y<=center; y+=grid){
      ctx.beginPath(); ctx.moveTo(-center,y); ctx.lineTo(center,y); ctx.stroke();
    }
    if(S.chunkGrid){
      ctx.strokeStyle = '#00eaff33';
      const c = 16*mapZoomPxPerBlock; // chunk every 16 blocks visual hint
      for(let x=-center; x<=center; x+=c){
        ctx.beginPath(); ctx.moveTo(x,-center); ctx.lineTo(x,center); ctx.stroke();
      }
      for(let y=-center; y<=center; y+=c){
        ctx.beginPath(); ctx.moveTo(-center,y); ctx.lineTo(center,y); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Player arrow
  ctx.save();
  ctx.rotate(-(P?.yaw||0) * Math.PI/180);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0,-10);
  ctx.lineTo(6,6);
  ctx.lineTo(-6,6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Waypoint markers (relative projection)
  if(P){
    S.waypoints.filter(w=>w.enabled).forEach(w=>{
      const dx = (w.x - P.x), dz = (w.z - P.z);
      const dist = Math.hypot(dx,dz);
      const ang = Math.atan2(dz, dx) - (P.yaw * Math.PI/180) - Math.PI/2;
      let r = Math.min(center-14, dist / (32/mapZoomPxPerBlock)); // scale distance -> radius
      const px = Math.cos(ang)*r, py = Math.sin(ang)*r;
      ctx.fillStyle = w.color || '#00eaff';
      ctx.beginPath(); ctx.arc(px, py, S.markerSize, 0, Math.PI*2); ctx.fill();

      // label
      ctx.fillStyle = '#cfffff';
      ctx.font = '10px monospace'; ctx.textAlign='center';
      ctx.fillText(w.name, px, py-8);
    });
  }

  ctx.restore();
}

/************ Chat/UI helpers (visual only) ************/
// Since we can’t edit the in-game chat DOM inside the iframe, these are placeholders
// for when you integrate directly inside the game build.
(function initUiHelpers(){
  // GUI scale affects root font-size; already handled in onSettingChanged
})();

/************ Export globals for inline handlers (if needed) ************/
window.S = S;
