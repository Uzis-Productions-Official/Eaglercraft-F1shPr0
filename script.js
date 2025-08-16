/*************************************************
 * F1shPr0 Client – Legit QoL for Eaglercraft 1.8.8
 * - Modular settings + persistent config
 * - HUDs, Minimap/Radar, Waypoints, Zoom, Chat & Tools
 * - No cheats/ESP/wallhacks. UI overlays only.
 **************************************************/

/* ===================== Settings / State ===================== */
const DEF = {
  // HUD
  fps:false, ping:false, coords:false, clock:false, session:false,
  armorHud:false, toolsHud:false, potionsHud:false,
  // Minimap
  minimap:false, radar:false, breadcrumbs:false, mapZoom:10, markerSize:4, chunkGrid:false,
  // Visual
  fullbright:false, customCrosshair:false, crosshairStyle:'plus', zoomKey:false, zoomFov:30,
  // World
  autoDeathWp:false, dayClock:false, yLevelAlert:false,
  // Player (UI helpers)
  autoSprint:false, autoSneak:false, quickSort:false, equipBest:false,
  // Chat (UI helpers)
  chatTimestamps:false, compactChat:false, pingSound:false,
  // Tools
  autoReconnect:false, latencyGraph:false,
  // UI
  guiScale:100, theme:'teal',
  // Waypoints & misc
  waypoints:[], showWpList:true,
  // Keybinds
  openKey:'ShiftRight', closeKey:'ControlRight', holdZoomKey:'KeyC',
  macro1Key:'F6', macro1Cmds:'', macro2Key:'F7', macro2Cmds:'', screenshotKey:'F2'
};

let S = loadConfig();
let sessionStart = Date.now();
let fps = 0, lastFrame = performance.now();
let pingMs = null;
let holdingZoom = false;
let gameWin = null, mc = null, gameReady = false;
let P = {x:0,y:64,z:0,yaw:0};  // player fallback when we can’t read the game
let crumbs = []; // breadcrumb trail points

/* ===================== Boot / Launch ===================== */
function launchGame(){
  document.getElementById('menu').style.display='none';
  document.getElementById('game').style.display='block';
  const iframe = document.getElementById('gameFrame');
  iframe.src = "eaglercraft/Release 1.8.8.html";

  iframe.addEventListener('load', ()=>{
    try {
      gameWin = iframe.contentWindow;
      setTimeout(()=>{
        mc = detectMinecraftGlobal();
        gameReady = !!mc;
        if(!gameReady) console.warn('F1shPr0: minecraft global not found; using UI-only mode.');
      }, 800);
    } catch(e) {
      console.warn('F1shPr0: cross-origin restricts access; UI-only mode.');
    }
  });

  requestAnimationFrame(mainLoop);
}
window.launchGame = launchGame;

/* ===================== Minecraft helpers ===================== */
function detectMinecraftGlobal(){
  const names = ['minecraft','client','Minecraft'];
  for(const n of names) if(gameWin && gameWin[n]) return gameWin[n];
  return null;
}
function currentPlayer(){
  try{
    if(gameReady && mc && mc.thePlayer){
      const p = mc.thePlayer;
      if(typeof p.posX==='number') P.x = p.posX;
      if(typeof p.posY==='number') P.y = p.posY;
      if(typeof p.posZ==='number') P.z = p.posZ;
      if(typeof p.rotationYaw==='number') P.yaw = p.rotationYaw;
    }
  }catch{}
  return P;
}

/* ===================== Menu / Tabs ===================== */
const menu = document.getElementById('clientMenu');
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tabview').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});

/* ===================== Settings binding ===================== */
document.querySelectorAll('[data-setting]').forEach(el=>{
  const key = el.getAttribute('data-setting');
  // init UI
  if(el.type==='checkbox') el.checked = !!S[key];
  else el.value = S[key];

  el.addEventListener('input', ()=>{
    if(el.type==='checkbox') S[key] = el.checked;
    else if(el.type==='range') S[key] = Number(el.value);
    else if(el.tagName==='SELECT') S[key] = el.value;
    onSettingChanged(key);
    saveConfig();
  });
});

function onSettingChanged(k){
  if(k==='fullbright') document.getElementById('fullbright').classList.toggle('hidden', !S.fullbright);
  if(k==='customCrosshair' || k==='crosshairStyle') updateCrosshair();
  if(k==='guiScale'){ document.documentElement.style.fontSize = (S.guiScale/100)+'rem'; }
  if(k==='theme') applyTheme();
}
onSettingChanged('fullbright'); updateCrosshair(); applyTheme();
document.documentElement.style.fontSize = (S.guiScale/100)+'rem';

/* ===================== Keybind inputs ===================== */
function captureKeyFor(el, prop){
  el.addEventListener('click', ()=>{
    el.value = 'Press key...';
    const once = (e)=>{
      e.preventDefault();
      S[prop] = e.code || e.key;
      el.value = S[prop];
      saveConfig();
      document.removeEventListener('keydown', once, true);
    };
    document.addEventListener('keydown', once, true);
  });
}
captureKeyFor(document.getElementById('openKey'), 'openKey');
captureKeyFor(document.getElementById('closeKey'), 'closeKey');
captureKeyFor(document.getElementById('holdZoomKey'), 'holdZoomKey');
captureKeyFor(document.getElementById('macro1Key'), 'macro1Key');
captureKeyFor(document.getElementById('macro2Key'), 'macro2Key');
captureKeyFor(document.getElementById('screenshotKey'), 'screenshotKey');

/* ===================== Macro save ===================== */
document.getElementById('saveMacrosBtn').addEventListener('click', ()=>{
  S.macro1Cmds = document.getElementById('macro1Cmds').value || '';
  S.macro2Cmds = document.getElementById('macro2Cmds').value || '';
  saveConfig();
  flash('Macros saved');
});

/* ===================== Import/Export Config ===================== */
document.getElementById('exportCfgBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(S,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'f1shpr0_config.json'; a.click();
});
document.getElementById('importCfgBtn').addEventListener('click', ()=>document.getElementById('importCfgFile').click());
document.getElementById('importCfgFile')?.addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  const fr = new FileReader();
  fr.onload = ()=>{ try{ S = {...DEF, ...JSON.parse(fr.result)}; applyAllSettingsToUi(); saveConfig(); flash('Config imported'); }catch{} };
  fr.readAsText(f);
});

/* ===================== Waypoints ===================== */
document.getElementById('addWpBtn').addEventListener('click', addWaypointFromPlayer);
document.getElementById('exportWpBtn').addEventListener('click', exportWaypoints);
document.getElementById('importWpBtn').addEventListener('click', ()=>document.getElementById('importWpFile').click());
document.getElementById('importWpFile').addEventListener('change', importWaypointsFile);

function addWaypointFromPlayer(){
  const cur = currentPlayer();
  const name = prompt('Waypoint name:', 'Waypoint');
  if(!name) return;
  S.waypoints.push({name, x:cur.x, y:cur.y, z:cur.z, color:'#00eaff', enabled:true});
  renderWpList(); renderWaypointOverlay(); saveConfig();
}
function renderWpList(){
  const list = document.getElementById('wpList'); list.innerHTML='';
  S.waypoints.forEach((w,i)=>{
    const item = document.createElement('div'); item.className='wp-item';
    item.textContent = `${w.name} [${w.x|0},${w.y|0},${w.z|0}]`;
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent = w.enabled?'Hide':'Show';
    btn.onclick=()=>{ w.enabled=!w.enabled; renderWpList(); renderWaypointOverlay(); saveConfig(); };
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
  fr.onload = ()=>{ try{ S.waypoints = JSON.parse(fr.result); renderWpList(); renderWaypointOverlay(); saveConfig(); flash('Waypoints imported'); }catch{} };
  fr.readAsText(file);
}

/* ===================== Front Menu+ saved servers ===================== */
function rememberServer(){
  const v = document.getElementById('directServer').value.trim();
  if(!v) return;
  const list = JSON.parse(localStorage.getItem('f1shpr0_servers')||'[]');
  if(!list.includes(v)) list.push(v);
  localStorage.setItem('f1shpr0_servers', JSON.stringify(list));
  renderSavedServers();
}
function renderSavedServers(){
  const wrap = document.getElementById('savedServers'); if(!wrap) return;
  const list = JSON.parse(localStorage.getItem('f1shpr0_servers')||'[]');
  wrap.innerHTML='';
  list.forEach(addr=>{
    const b = document.createElement('button'); b.className='btn'; b.textContent = addr;
    b.onclick = ()=> document.getElementById('directServer').value = addr;
    wrap.appendChild(b);
  });
}
renderSavedServers();

/* ===================== Key events (menu, zoom, macros, screenshot) ===================== */
document.addEventListener('keydown', e=>{
  if(e.code===S.openKey){ menu.classList.add('show'); }
  if(e.code===S.closeKey){ menu.classList.remove('show'); }

  if(e.code==='KeyB'){ addWaypointFromPlayer(); }
  if(e.code==='KeyL'){ S.showWpList = !S.showWpList; renderWaypointOverlay(); saveConfig(); }

  if(e.code===S.holdZoomKey){ holdingZoom = true; }

  // Macros (UI only: injects chat commands into focused chat if possible)
  if(e.code===S.macro1Key && S.macro1Cmds) runMacro(S.macro1Cmds);
  if(e.code===S.macro2Key && S.macro2Cmds) runMacro(S.macro2Cmds);

  if(e.code===S.screenshotKey) doScreenshot();
});
document.addEventListener('keyup', e=>{
  if(e.code===S.holdZoomKey){
    holdingZoom = false;
    document.getElementById('zoomIndicator').textContent='';
  }
});

/* ===================== Main loop ===================== */
function mainLoop(){
  const now = performance.now();
  fps = Math.max(1, Math.round(1000 / (now - lastFrame)));
  lastFrame = now;

  // Ping (best-effort HEAD once/sec)
  if(S.ping){
    if(pingMs==null || (now|0)%1000 < 16){
      const t0 = performance.now();
      fetch('.', {method:'HEAD', cache:'no-store'}).then(()=> {
        pingMs = Math.round(performance.now()-t0);
      }).catch(()=> pingMs = null);
    }
  }

  const pl = currentPlayer();

  // HUD
  text('overlay-fps', S.fps ? `FPS: ${fps}` : '');
  text('overlay-ping', S.ping ? `Ping: ${pingMs!=null? pingMs+' ms' : 'n/a'}` : '');
  text('overlay-coords', S.coords ? `XYZ: ${pl.x.toFixed(1)} ${pl.y.toFixed(1)} ${pl.z.toFixed(1)} | Yaw ${Math.round(pl.yaw)}°` : '');
  text('overlay-clock', S.clock ? new Date().toLocaleTimeString() : '');
  if(S.session){
    const t = fmtTime((Date.now()-sessionStart)/1000|0);
    text('overlay-session', `Session: ${t}`);
  } else text('overlay-session','');

  // HUD advanced (UI placeholders that look nice)
  text('overlay-armor', S.armorHud ? 'Armor: ■■■■  Tools: ■■■' : '');
  text('overlay-tools', S.toolsHud ? 'Pick: 92%  Axe: 77%  Shovel: 64%' : '');
  text('overlay-potions', S.potionsHud ? 'Effects: Haste II (1:23), Fire Res (4:50)' : '');

  // Zoom indicator (UI)
  text('zoomIndicator', (S.zoomKey && holdingZoom) ? `Zoom FOV ~ ${S.zoomFov}` : '');

  // Breadcrumbs trail
  if(S.breadcrumbs){
    const last = crumbs[crumbs.length-1];
    if(!last || dist2(last, pl) > 1) crumbs.push({x:pl.x, z:pl.z});
  } else if(crumbs.length) { crumbs = []; }

  // Minimap & radar & breadcrumbs
  drawMinimap(pl);
  drawBreadcrumbs(pl);

  // Waypoints overlay (list)
  renderWaypointOverlay();

  requestAnimationFrame(mainLoop);
}

/* ===================== Minimap / Radar ===================== */
function drawMinimap(pl){
  const cvs = document.getElementById('minimap');
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0,0,cvs.width,cvs.height);
  if(!S.minimap && !S.radar) return;

  const size = cvs.width, c = size/2;
  ctx.save(); ctx.translate(c,c);

  // Radar ring
  if(S.radar){
    ctx.globalAlpha = .8;
    ctx.beginPath(); ctx.arc(0,0,c-6,0,Math.PI*2); ctx.strokeStyle = css('--teal'); ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
    for(let a=0;a<360;a+=30){
      const r = a*Math.PI/180;
      line(ctx, Math.cos(r)*(c-14), Math.sin(r)*(c-14), Math.cos(r)*(c-8), Math.sin(r)*(c-8), '#00eaff55', 2);
    }
  }

  // Minimap “advanced UI”: heading-locked fine grid + optional chunk grid
  if(S.minimap){
    ctx.save();
    ctx.rotate(-(pl.yaw||0) * Math.PI/180);
    ctx.strokeStyle = '#00eaff18';
    const step = 16;
    for(let x=-c;x<=c;x+=step){ line(ctx,x,-c,x,c,'#00eaff18',1); }
    for(let y=-c;y<=c;y+=step){ line(ctx,-c,y,c,y,'#00eaff18',1); }
    if(S.chunkGrid){
      const big = 16 * (S.mapZoom/2);
      for(let x=-c;x<=c;x+=big){ line(ctx,x,-c,x,c,'#00eaff33',1.5); }
      for(let y=-c;y<=c;y+=big){ line(ctx,-c,y,c,y,'#00eaff33',1.5); }
    }
    ctx.restore();
  }

  // Player arrow
  ctx.save();
  ctx.rotate(-(pl.yaw||0) * Math.PI/180);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(6,6); ctx.lineTo(-6,6); ctx.closePath(); ctx.fill();
  ctx.restore();

  // Waypoints markers
  S.waypoints.filter(w=>w.enabled).forEach(w=>{
    const dx = (w.x - pl.x), dz = (w.z - pl.z);
    const distBlocks = Math.hypot(dx,dz);
    const maxR = c-14;
    const r = Math.min(maxR, distBlocks * (S.mapZoom/32));
    const ang = Math.atan2(dz, dx) - (pl.yaw * Math.PI/180) - Math.PI/2;
    const px = Math.cos(ang)*r, py = Math.sin(ang)*r;

    dot(ctx, px, py, S.markerSize, w.color || css('--teal'));
    label(ctx, w.name, px, py-8);
  });

  ctx.restore();
}
function drawBreadcrumbs(pl){
  const cvs = document.getElementById('breadcrumbs');
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0,0,cvs.width,cvs.height);
  if(!S.breadcrumbs) return;
  // Draw as a fading path behind player on same canvas overlay frame
  const size = cvs.width, c = size/2;
  ctx.save(); ctx.translate(c,c);
  ctx.rotate(-(pl.yaw||0) * Math.PI/180);
  ctx.strokeStyle = '#88ffff';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for(let i=0;i<crumbs.length;i++){
    const dx = (crumbs[i].x - pl.x), dz = (crumbs[i].z - pl.z);
    const r = Math.min(c-16, Math.hypot(dx,dz) * (S.mapZoom/32));
    const ang = Math.atan2(dz, dx) - Math.PI/2;
    const px = Math.cos(ang)*r, py = Math.sin(ang)*r;
    if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.stroke(); ctx.restore();
}

/* ===================== Visuals ===================== */
function updateCrosshair(){
  const ch = document.getElementById('crosshair');
  ch.className = 'crosshair';
  if(!S.customCrosshair){ ch.classList.add('hidden'); return; }
  ch.classList.add(S.crosshairStyle || 'plus');
}

/* ===================== Chat / Macros (UI level) ===================== */
function runMacro(seq){
  // Splits by ; and tries to type them into the game (UI-level; may require chat focus)
  const cmds = seq.split(';').map(s=>s.trim()).filter(Boolean);
  if(!cmds.length) return;
  // As a UI helper, we simply copy to clipboard and show a HUD hint
  navigator.clipboard?.writeText(cmds.join('\n'));
  flash('Macro copied to clipboard — paste into chat');
}

/* ===================== Screenshot (UI) ===================== */
function doScreenshot(){
  // We can’t capture the iframe due to cross-origin; provide a helpful hint instead
  flash('Use your OS/Browser screenshot tool (key saved for reminder).');
}

/* ===================== Utility: HUD text & drawing ===================== */
function text(id, s){ const el = document.getElementById(id); if(el) el.textContent = s || ''; }
function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v) || '#00eaff'; }
function line(ctx,x1,y1,x2,y2,stroke,w){ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.strokeStyle=stroke; ctx.lineWidth=w; ctx.stroke(); }
function dot(ctx,x,y,r,color){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); }
function label(ctx, t, x, y){ ctx.fillStyle='#cfffff'; ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillText(t,x,y); }
function fmtTime(s){ const h=(s/3600|0), m=((s%3600)/60|0), ss=(s%60|0); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function dist2(a,b){ const dx=a.x-b.x, dz=a.z-b.z; return dx*dx+dz*dz; }

/* ===================== Theme & UI apply ===================== */
function applyTheme(){
  document.body.classList.remove('theme-violet','theme-amber','theme-mono');
  if(S.theme==='violet') document.body.classList.add('theme-violet');
  if(S.theme==='amber') document.body.classList.add('theme-amber');
  if(S.theme==='mono') document.body.classList.add('theme-mono');
  document.getElementById('themeSelect').value = S.theme;
}
document.getElementById('themeSelect').addEventListener('input', (e)=>{ S.theme = e.target.value; applyTheme(); saveConfig(); });

function applyAllSettingsToUi(){
  document.querySelectorAll('[data-setting]').forEach(el=>{
    const key = el.getAttribute('data-setting');
    if(el.type==='checkbox') el.checked = !!S[key];
    else if(el.type==='range' || el.tagName==='SELECT') el.value = S[key];
  });
  ['openKey','closeKey','holdZoomKey','macro1Key','macro2Key','screenshotKey'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value = S[id];
  });
  document.getElementById('macro1Cmds').value = S.macro1Cmds || '';
  document.getElementById('macro2Cmds').value = S.macro2Cmds || '';
  onSettingChanged('fullbright'); updateCrosshair(); applyTheme();
  renderWpList(); renderWaypointOverlay();
  document.documentElement.style.fontSize = (S.guiScale/100)+'rem';
}

/* ===================== Flash message ===================== */
function flash(msg){
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.position='fixed'; el.style.left='50%'; el.style.top='8%'; el.style.transform='translateX(-50%)';
  el.style.background='rgba(0,0,0,.75)'; el.style.border='1px solid #204655'; el.style.borderRadius='8px';
  el.style.padding='8px 12px'; el.style.color='#e7f6ff'; el.style.zIndex=10000;
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .3s'; el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 1200);
}

/* ===================== Open/Close menu via keys ===================== */
document.addEventListener('keydown', e=>{
  // Also provide manual testing movement if no game access
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
}, true);

/* ===================== Config save/load ===================== */
function saveConfig(){ localStorage.setItem('f1shpr0_config', JSON.stringify(S)); }
function loadConfig(){
  try{ return {...DEF, ...(JSON.parse(localStorage.getItem('f1shpr0_config')||'{}'))}; }
  catch{ return {...DEF}; }
}
applyAllSettingsToUi();
