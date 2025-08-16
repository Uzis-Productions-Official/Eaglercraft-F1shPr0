/************ Settings ************/
const S = {
  // HUD
  fps:false, ping:false, coords:false, clock:false, session:false,
  // Zoom
  zoomKey:false, zoomFov:30,
  // Navigation
  minimap:false, radar:false, mapZoom:8, markerSize:4,
  // Visual
  fullbright:false, customCrosshair:false, crosshairStyle:'plus', chunkGrid:false,
  // UI
  guiScale:100, compactChat:false, chatTimestamps:false,
  // Data
  waypoints:[], showWpList:true
};

/************ Session & state ************/
let sessionStart = Date.now();
let fps = 0, lastFrame = performance.now();
let pingMs = null;
let holdingZoom = false;
let gameWin = null;      // iframe.contentWindow (same-origin)
let mc = null;           // game global (best-effort)
let gameReady = false;
let P = {x:0,y:64,z:0,yaw:0}; // player fallback if mc not available

/************ Launch ************/
function launchGame(){
  document.getElementById('menu').style.display='none';
  document.getElementById('game').style.display='block';
  const iframe = document.getElementById('gameFrame');
  iframe.src = "eaglercraft/Release 1.8.8.html";

  iframe.addEventListener('load', ()=>{
    // same-origin on GitHub Pages -> we can try to access the game window
    try {
      gameWin = iframe.contentWindow;
      // Wait a tick for globals to exist
      setTimeout(()=> {
        mc = detectMinecraftGlobal();
        gameReady = !!mc;
        if(!gameReady){
          console.warn('F1shPr0: could not find minecraft global; overlays will still work but coords may be manual.');
        }
      }, 500);
    } catch (e) {
      console.warn('F1shPr0: cross-origin access blocked; running UI overlays only.');
    }
  });

  requestAnimationFrame(mainLoop);
}
window.launchGame = launchGame;

/************ Detect Minecraft global (best effort) ************/
function detectMinecraftGlobal(){
  // Common patterns in Eaglercraft builds:
  // - window.minecraft
  // - window.client
  // - window.Minecraft
  // We probe safely.
  const candidates = ['minecraft','client','Minecraft'];
  for(const k of candidates){
    if(gameWin && gameWin[k]) return gameWin[k];
  }
  return null;
}

/************ Menu hotkeys ************/
const menu = document.getElementById('clientMenu');
document.addEventListener('keydown', e=>{
  if(e.code==='ShiftRight') menu.classList.add('show');
  if(e.code==='ControlRight') menu.classList.remove('show');

  if(e.code==='KeyB') addWaypointFromPlayer();
  if(e.code==='KeyL'){ S.showWpList = !S.showWpList; renderWaypointOverlay(); }
  if(e.code==='KeyC'){ holdingZoom = true; }
});
document.addEventListener('keyup', e=>{
  if(e.code==='KeyC'){ holdingZoom = false; document.getElementById('zoomIndicator').textContent=''; }
});

/************ Tabs ************/
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tabview').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});

/************ Settings wiring ************/
document.querySelectorAll('[data-setting]').forEach(el=>{
  const key = el.getAttribute('data-setting');
  // init
  if(el.type==='checkbox') el.checked = !!S[key];
  else el.value = S[key];

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
  if(k==='mapZoom'){} // handled during draw
}
onSettingChanged('fullbright');
updateCrosshair();

/************ Waypoints UI ************/
document.getElementById('addWpBtn').addEventListener('click', addWaypointFromPlayer);
document.getElementById('exportWpBtn').addEventListener('click', exportWaypoints);
document.getElementById('importWpBtn').addEventListener('click', ()=>document.getElementById('importWpFile').click());
document.getElementById('importWpFile').addEventListener('change', importWaypointsFile);
function addWaypointFromPlayer(){
  const cur = currentPlayer();
  const name = prompt('Waypoint name:', 'Waypoint');
  if(!name) return;
  S.waypoints.push({name, x:cur.x, y:cur.y, z:cur.z, color:'#00eaff', enabled:true});
  renderWpList(); renderWaypointOverlay();
}
function renderWpList(){
  const list = document.getElementById('wpList'); list.innerHTML='';
  S.waypoints.forEach((w,i)=>{
    const item = document.createElement('div'); item.className='wp-item';
    item.textContent = `${w.name} [${w.x|0},${w.y|0},${w.z|0}]`;
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent = w.enabled?'Hide':'Show';
    btn.onclick=()=>{ w.enabled=!w.enabled; renderWpList(); renderWaypointOverlay(); };
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
  fr.onload = ()=>{ try{ S.waypoints = JSON.parse(fr.result); renderWpList(); renderWaypointOverlay(); }catch{} };
  fr.readAsText(file);
}

/************ Front Menu+ saved servers (UI only) ************/
function rememberServer(){
  const v = document.getElementById('directServer').value.trim();
  if(!v) return;
  const list = JSON.parse(localStorage.getItem('f1shpr0_servers')||'[]');
  if(!list.includes(v)) list.push(v);
  localStorage.setItem('f1shpr0_servers', JSON.stringify(list));
  renderSavedServers();
}
function renderSavedServers(){
  const wrap = document.getElementById('savedServers');
  if(!wrap) return;
  const list = JSON.parse(localStorage.getItem('f1shpr0_servers')||'[]');
  wrap.innerHTML='';
  list.forEach(addr=>{
    const b = document.createElement('button'); b.className='btn'; b.textContent = addr;
    b.onclick = ()=> document.getElementById('directServer').value = addr;
    wrap.appendChild(b);
  });
}
renderSavedServers();

/************ Crosshair & Visuals ************/
function updateCrosshair(){
  const ch = document.getElementById('crosshair');
  ch.className = 'crosshair';
  if(!S.customCrosshair){ ch.classList.add('hidden'); return; }
  ch.classList.remove('hidden');
  ch.classList.add(S.crosshairStyle || 'plus');
}

/************ Player & Minecraft helpers ************/
function currentPlayer(){
  // If we have access to mc, try best-effort fields often present in 1.8.8 web ports
  try{
    if(gameReady && mc && mc.thePlayer){
      const p = mc.thePlayer;
      // common fields: posX,posY,posZ, rotationYaw
      P.x = typeof p.posX==='number'? p.posX : P.x;
      P.y = typeof p.posY==='number'? p.posY : P.y;
      P.z = typeof p.posZ==='number'? p.posZ : P.z;
      P.yaw = typeof p.rotationYaw==='number'? p.rotationYaw : P.yaw;
    }
  }catch{/* ignore */}
  return P;
}

/************ Main loop ************/
function mainLoop(){
  const now = performance.now();
  fps = Math.max(1, Math.round(1000 / (now - lastFrame)));
  lastFrame = now;

  // HUD: FPS
  document.getElementById('overlay-fps').textContent = S.fps ? `FPS: ${fps}` : '';

  // HUD: Ping (best-effort: HEAD to same origin once/sec)
  if(S.ping){
    if(pingMs==null || (now|0)%1000 < 16){
      const t0 = performance.now();
      fetch('.', {method:'HEAD', cache:'no-store'}).then(()=> {
        pingMs = Math.round(performance.now()-t0);
        document.getElementById('overlay-ping').textContent = `Ping: ${pingMs} ms`;
      }).catch(()=> document.getElementById('overlay-ping').textContent = 'Ping: n/a');
    }
  } else document.getElementById('overlay-ping').textContent='';

  // Player
  const pl = currentPlayer();

  // HUD: Coords
  if(S.coords){
    document.getElementById('overlay-coords').textContent =
      `XYZ: ${pl.x.toFixed(1)} ${pl.y.toFixed(1)} ${pl.z.toFixed(1)} | Yaw ${Math.round(pl.yaw)}°`;
  } else document.getElementById('overlay-coords').textContent = '';

  // Clock & Session
  document.getElementById('overlay-clock').textContent = S.clock ? new Date().toLocaleTimeString() : '';
  if(S.session){
    const secs = Math.floor((Date.now()-sessionStart)/1000);
    const hh = String(Math.floor(secs/3600)).padStart(2,'0');
    const mm = String(Math.floor((secs%3600)/60)).padStart(2,'0');
    const ss = String(secs%60).padStart(2,'0');
    document.getElementById('overlay-session').textContent = `Session: ${hh}:${mm}:${ss}`;
  } else document.getElementById('overlay-session').textContent='';

  // Zoom indicator (UI only)
  document.getElementById('zoomIndicator').textContent =
    (S.zoomKey && holdingZoom) ? `Zoom FOV ~ ${S.zoomFov}` : '';

  // Minimap / Radar
  drawMinimap(pl);

  // Waypoints readout
  renderWaypointOverlay();

  requestAnimationFrame(mainLoop);
}

/************ Minimap & Radar (UI overlay) ************/
function drawMinimap(pl){
  const cvs = document.getElementById('minimap');
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0,0,cvs.width,cvs.height);
  if(!S.minimap && !S.radar) return;

  const size = cvs.width;
  const center = size/2;
  const pxPerBlock = S.mapZoom; // visual scale

  ctx.save();
  ctx.translate(center, center);

  // Radar ring
  if(S.radar){
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(0,0, center-6, 0, Math.PI*2); ctx.strokeStyle = '#00eaff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
    for(let a=0;a<360;a+=30){
      const rad = a*Math.PI/180;
      ctx.beginPath();
      ctx.moveTo(Math.cos(rad)*(center-14), Math.sin(rad)*(center-14));
      ctx.lineTo(Math.cos(rad)*(center-8), Math.sin(rad)*(center-8));
      ctx.strokeStyle = '#00eaff55'; ctx.lineWidth=2; ctx.stroke();
    }
  }

  // Minimap: heading-locked grid and optional chunk grid (UI hint)
  if(S.minimap){
    ctx.save();
    ctx.rotate(-(pl.yaw||0) * Math.PI/180);
    // fine grid every 16px
    ctx.strokeStyle = '#00eaff18';
    const step = 16;
    for(let x=-center; x<=center; x+=step){ ctx.beginPath(); ctx.moveTo(x,-center); ctx.lineTo(x,center); ctx.stroke(); }
    for(let y=-center; y<=center; y+=step){ ctx.beginPath(); ctx.moveTo(-center,y); ctx.lineTo(center,y); ctx.stroke(); }
    if(S.chunkGrid){
      ctx.strokeStyle = '#00eaff33';
      const c = 16 * (pxPerBlock/2);
      for(let x=-center; x<=center; x+=c){ ctx.beginPath(); ctx.moveTo(x,-center); ctx.lineTo(x,center); ctx.stroke(); }
      for(let y=-center; y<=center; y+=c){ ctx.beginPath(); ctx.moveTo(-center,y); ctx.lineTo(center,y); ctx.stroke(); }
    }
    ctx.restore();
  }

  // Player arrow
  ctx.save();
  ctx.rotate(-(pl.yaw||0) * Math.PI/180);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0,-10); ctx.lineTo(6,6); ctx.lineTo(-6,6); ctx.closePath(); ctx.fill();
  ctx.restore();

  // Waypoints (relative & clamped to edge)
  S.waypoints.filter(w=>w.enabled).forEach(w=>{
    const dx = (w.x - pl.x), dz = (w.z - pl.z);
    const distBlocks = Math.hypot(dx,dz);
    const maxR = center-14;
    const r = Math.min(maxR, distBlocks * (pxPerBlock/32)); // tune scaling
    const ang = Math.atan2(dz, dx) - (pl.yaw * Math.PI/180) - Math.PI/2;
    const px = Math.cos(ang)*r, py = Math.sin(ang)*r;

    ctx.fillStyle = w.color || '#00eaff';
    ctx.beginPath(); ctx.arc(px, py, S.markerSize, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#cfffff';
    ctx.font = '10px monospace'; ctx.textAlign='center';
    ctx.fillText(w.name, px, py-8);
  });

  ctx.restore();
}

/************ Misc visuals ************/
document.addEventListener('keydown', e=>{
  // Optional “manual” adjust if mc not available (for quick testing)
  if(!gameReady){
    const step = (e.shiftKey?5:1);
    if(e.code==='ArrowUp') P.z -= step;
    if(e.code==='ArrowDown') P.z += step;
    if(e.code==='ArrowLeft') P.x -= step;
    if(e.code==='ArrowRight') P.x += step;
    if(e.code==='KeyQ') P.y += step;
    if(e.code==='KeyE') P.y -= step;
    if(e.code==='KeyA') P.yaw = (P.yaw-5+360)%360;
    if(e.code==='KeyD') P.yaw = (P.yaw+5)%360;
  }
});

/************ Expose S if you want console tweaks ************/
window.S = S;
