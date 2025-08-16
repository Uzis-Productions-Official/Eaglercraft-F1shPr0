/*************************************************
 * F1shPr0 Client – Legit QoL for Eaglercraft 1.8.8
 * - Input focus fixes (no blocking)
 * - Render-scale FPS boost (huge on Chromebooks)
 * - Best-effort in-game settings tweak if API is accessible
 * - Minimap/waypoints/radar/breadcrumbs (UI-level)
 **************************************************/

/* ===================== Settings / State ===================== */
const DEF = {
  // HUD
  fps:true, ping:true, coords:true, clock:false, session:true,
  armorHud:false, toolsHud:false, potionsHud:false,
  pauseOverlays:true,
  // Minimap
  minimap:true, radar:true, breadcrumbs:false, mapZoom:10, markerSize:4, chunkGrid:false,
  // Visual
  fullbright:false, customCrosshair:false, crosshairStyle:'plus', zoomKey:true, zoomFov:30,
  // World
  autoDeathWp:false, dayClock:false, yLevelAlert:false, showWpList:true, waypoints:[],
  // Player (UI helpers)
  autoSprint:false, autoSneak:false, hideCursor:false,
  // Chat (UI helpers)
  chatTimestamps:false, compactChat:false, pingSound:false,
  // Tools
  autoReconnect:false, latencyGraph:false,
  // UI
  guiScale:100, theme:'teal',
  // Keybinds
  openKey:'ShiftRight', closeKey:'ControlRight', holdZoomKey:'KeyC',
  macro1Key:'F6', macro1Cmds:'', macro2Key:'F7', macro2Cmds:'', screenshotKey:'F2',
  // FPS
  renderScale:100, limit60:false, pauseWhenHidden:true, fpsPreset:'balanced'
};
let S = loadConfig();

let sessionStart = Date.now();
let fps = 0, lastFrame = performance.now();
let pingMs = null;
let holdingZoom = false;
let gameWin = null, gameDoc = null, mc = null, gameReady = false;
let P = {x:0,y:64,z:0,yaw:0}; // fallback if we can’t read from game
let crumbs = [];
let gameFocused = false;

/* ===================== Launch ===================== */
function launchGame(){
  document.getElementById('menu').style.display='none';
  document.getElementById('game').style.display='block';

  const iframe = document.getElementById('gameFrame');
  iframe.src = "eaglercraft/Release 1.8.8.html";

  // Prepare render scale
  applyRenderScale();  // uses S.renderScale

  // focus hint handling
  const focusHint = document.getElementById('focusHint');
  const stage = document.getElementById('gameStage');

  iframe.addEventListener('load', ()=>{
    try {
      gameWin = iframe.contentWindow;
      gameDoc = iframe.contentDocument;
      setTimeout(()=>{
        mc = detectMinecraftGlobal();
        gameReady = !!mc;
        if(gameReady) {
          bestEffortBindDeathWaypoint();
          applyFpsPreset(); // apply initial preset
        }
      }, 800);
    } catch(e) { console.warn('F1shPr0: cross-origin; UI-only mode.'); }
  });

  // click to focus the iframe
  stage.addEventListener('mousedown', ()=>{
    iframe.focus();
    gameFocused = true;
    focusHint.style.display = 'none';
    if(S.hideCursor) document.body.style.cursor='none';
  });
  window.addEventListener('blur', ()=>{ gameFocused=false; if(S.hideCursor) document.body.style.cursor='auto'; });

  requestAnimationFrame(mainLoop);
}
window.launchGame = launchGame;

/* ===================== Detect game / player ===================== */
function detectMinecraftGlobal(){
  // Common globals in Eaglercraft builds
  const candidates = [
    'minecraft', 'client', 'Minecraft', 'mc', 'game', '_mc'
  ];
  for(const n of candidates){
    try{
      if(gameWin && gameWin[n] && (gameWin[n].thePlayer || gameWin[n].theWorld)) {
        return gameWin[n];
      }
    }catch{}
  }
  // Fallback: scan window for objects with thePlayer
  try{
    for(const k in gameWin){
      const v = gameWin[k];
      if(v && typeof v === 'object' && (v.thePlayer || v.theWorld)) return v;
    }
  }catch{}
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

/* ===================== Tabs ===================== */
const menu = document.getElementById('clientMenu');
const backdrop = document.getElementById('menuBackdrop');
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tabview').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});

/* ===================== Menu open/close ===================== */
function openMenu(){
  menu.classList.add('show');
  backdrop.classList.add('show');
}
function closeMenu(){
  if(menu.dataset.pinned === '1') return; // allow pin
  menu.classList.remove('show');
  backdrop.classList.remove('show');
  focusGame();
}
function focusGame(){
  const iframe = document.getElementById('gameFrame');
  iframe.focus();
  gameFocused = true;
}
backdrop.addEventListener('click', closeMenu);
document.getElementById('pinMenuBtn').addEventListener('click', ()=>{
  const pinned = menu.dataset.pinned === '1';
  menu.dataset.pinned = pinned ? '0' : '1';
  document.getElementById('pinMenuBtn').textContent = pinned ? 'Pin' : 'Pinned';
});

/* ===================== Settings bind ===================== */
document.querySelectorAll('[data-setting]').forEach(el=>{
  const key = el.getAttribute('data-setting');
  if(el.type==='checkbox') el.checked = !!S[key];
  else el.value = S[key];
  el.addEventListener('input', ()=>{
    if(el.type==='checkbox') S[key] = el.checked;
    else if(el.type==='range') S[key] = Number(el.value);
    else if(el.tagName==='SELECT') S[key] = el.value;
    onSettingChanged(key); saveConfig();
  });
});
function onSettingChanged(k){
  if(k==='fullbright') document.getElementById('fullbright').classList.toggle('hidden', !S.fullbright);
  if(k==='customCrosshair' || k==='crosshairStyle') updateCrosshair();
  if(k==='guiScale'){ document.documentElement.style.fontSize = (S.guiScale/100)+'rem'; }
  if(k==='theme') applyTheme();
  if(k==='showWpList') renderWaypointOverlay();
  if(k==='hideCursor' && gameFocused) document.body.style.cursor = S.hideCursor ? 'none' : 'auto';
  if(k==='renderScale') applyRenderScale();
}
onSettingChanged('fullbright'); updateCrosshair(); applyTheme();
document.documentElement.style.fontSize = (S.guiScale/100)+'rem';

/* ===================== Preset & FPS Apply ===================== */
document.getElementById('applyFpsBtn').addEventListener('click', applyFpsPreset);
document.getElementById('fpsPreset').value = S.fpsPreset;
document.getElementById('fpsPreset').addEventListener('input', e=>{
  S.fpsPreset = e.target.value; saveConfig(); applyFpsPreset();
});

/* ===================== Keybind capture inputs ===================== */
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
captureKeyFor(document.getElementById('screenshotKey'), 'screenshotKey');

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
  const name = prompt('Waypoint name:', 'Waypoint'); if(!name) return;
  let color = prompt('Hex color (e.g. #00eaff):', '#00eaff'); if(!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) color='#00eaff';
  S.waypoints.push({name, x:cur.x, y:cur.y, z:cur.z, color, enabled:true});
  renderWpList(); renderWaypointOverlay(); saveConfig();
}
function removeWaypoint(i){ S.waypoints.splice(i,1); renderWpList(); renderWaypointOverlay(); saveConfig(); }
function toggleWaypoint(i){ S.waypoints[i].enabled = !S.waypoints[i].enabled; renderWpList(); renderWaypointOverlay(); saveConfig(); }
function recolorWaypoint(i){
  let color = prompt('Hex color:', S.waypoints[i].color || '#00eaff'); 
  if(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)){ S.waypoints[i].color=color; renderWpList(); saveConfig(); }
}
function renderWpList(){
  const list = document.getElementById('wpList'); list.innerHTML='';
  S.waypoints.forEach((w,i)=>{
    const item = document.createElement('div'); item.className='wp-item';
    item.textContent = `${w.name} [${w.x|0},${w.y|0},${w.z|0}]`;
    const controls = document.createElement('div');
    const bShow = btn(w.enabled?'Hide':'Show', ()=>toggleWaypoint(i));
    const bCol  = btn('Color', ()=>recolorWaypoint(i));
    const bDel  = btn('Del', ()=>removeWaypoint(i));
    controls.append(bShow,bCol,bDel);
    list.appendChild(item); list.appendChild(controls);
  });
}
function renderWaypointOverlay(){
  const div = document.getElementById('overlay-waypoints');
  if(!S.showWpList){ div.textContent=''; return; }
  div.innerHTML = S.waypoints.filter(w=>w.enabled).map(w =>
    `<span style="color:${w.color||'#00eaff'}">${w.name}</span>: [${w.x|0}, ${w.y|0}, ${w.z|0}]`
  ).join('<br>');
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

/* ===================== Saved servers (Front Menu+) ===================== */
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

/* ===================== Global keys (do not block game) ===================== */
document.addEventListener('keydown', e=>{
  // Toggle menu open
  if(e.code===S.openKey){ openMenu(); e.preventDefault(); return; }
  // Toggle menu close
  if(e.code===S.closeKey){ closeMenu(); e.preventDefault(); return; }

  // If menu is open, let it use keys; do not block the game otherwise
  if(menu.classList.contains('show')) return;

  if(e.code==='KeyB'){ addWaypointFromPlayer(); }
  if(e.code==='KeyL'){ S.showWpList = !S.showWpList; renderWaypointOverlay(); saveConfig(); }

  if(e.code===S.holdZoomKey){ holdingZoom = true; }

  if(e.code===S.screenshotKey) doScreenshot();
}, false);

document.addEventListener('keyup', e=>{
  if(e.code===S.holdZoomKey){
    holdingZoom = false;
    document.getElementById('zoomIndicator').textContent='';
  }
}, false);

/* ===================== Main loop ===================== */
function mainLoop(){
  const now = performance.now();
  fps = Math.max(1, Math.round(1000 / Math.max(1, (now - lastFrame))));
  lastFrame = now;

  // Pause overlays if unfocused (optional)
  if(S.pauseOverlays && !gameFocused){
    requestAnimationFrame(mainLoop); return;
  }

  // Ping (best-effort HEAD once/sec)
  if(S.ping){
    if(pingMs==null || (now|0)%1000 < 16){
      const t0 = performance.now();
      fetch('.', {method:'HEAD', cache:'no-store'}).then(()=> {
        pingMs = Math.round(performance.now()-t0);
      }).catch(()=> pingMs = null);
    }
  }

  // Player update
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

  // UI example readouts
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

  // Minimap / radar / breadcrumbs
  drawMinimap(pl);
  drawBreadcrumbs(pl);

  // Waypoints overlay
  renderWaypointOverlay();

  // Try best-effort zoom (if we can see mc)
  bestEffortZoom(holdingZoom ? S.zoomFov : null);

  // Best-effort movement helpers
  bestEffortAutoSprint();

  requestAnimationFrame(mainLoop);
}

/* ===================== Minimap / Radar (UI) ===================== */
function drawMinimap(pl){
  const cvs = document.getElementById('minimap');
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0,0,cvs.width,cvs.height);
  if(!S.minimap && !S.radar) return;

  const size = cvs.width, c = size/2;
  ctx.save(); ctx.translate(c,c);

  if(S.radar){
    ctx.globalAlpha = .8;
    ctx.beginPath(); ctx.arc(0,0,c-6,0,Math.PI*2); ctx.strokeStyle = css('--teal'); ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
    for(let a=0;a<360;a+=30){
      const r = a*Math.PI/180;
      line(ctx, Math.cos(r)*(c-14), Math.sin(r)*(c-14), Math.cos(r)*(c-8), Math.sin(r)*(c-8), '#00eaff55', 2);
    }
  }

  if(S.minimap){
    ctx.save();
    ctx.rotate(-(pl.yaw||0) * Math.PI/180);
    // fine grid
    for(let y=-c; y<=c; y+=16) line(ctx,-c,y,c,y,'#00eaff15',1);
    for(let x=-c; x<=c; x+=16) line(ctx,x,-c,x,c,'#00eaff15',1);
    if(S.chunkGrid){
      for(let y=-c; y<=c; y+= S.mapZoom*2) line(ctx,-c,y,c,y,'#00eaff35',1.5);
      for(let x=-c; x<=c; x+= S.mapZoom*2) line(ctx,x,-c,x,c,'#00eaff35',1.5);
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

/* ===================== Visuals / Crosshair ===================== */
function updateCrosshair(){
  const ch = document.getElementById('crosshair');
  ch.className = 'crosshair';
  if(!S.customCrosshair){ ch.classList.add('hidden'); return; }
  ch.classList.add(S.crosshairStyle || 'plus');
}

/* ===================== Chat / Macros (UI level placeholders) ===================== */
function doScreenshot(){ flash('Use your OS/Browser screenshot tool.'); }

/* ===================== Utility helpers ===================== */
function text(id, s){ const el = document.getElementById(id); if(el) el.textContent = s || ''; }
function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v) || '#00eaff'; }
function line(ctx,x1,y1,x2,y2,stroke,w){ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.strokeStyle=stroke; ctx.lineWidth=w; ctx.stroke(); }
function dot(ctx,x,y,r,color){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); }
function label(ctx, t, x, y){ ctx.fillStyle='#cfffff'; ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillText(t,x,y); }
function fmtTime(s){ const h=(s/3600|0), m=((s%3600)/60|0), ss=(s%60|0); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function dist2(a,b){ const dx=a.x-b.x, dz=a.z-b.z; return dx*dx+dz*dz; }
function btn(txt, fn){ const b=document.createElement('button'); b.className='btn'; b.textContent=txt; b.onclick=fn; return b; }

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
  ['openKey','closeKey','holdZoomKey','screenshotKey'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value = S[id];
  });
  onSettingChanged('fullbright'); updateCrosshair(); applyTheme();
  renderWpList(); renderWaypointOverlay();
  document.documentElement.style.fontSize = (S.guiScale/100)+'rem';
}

/* ===================== Config save/load ===================== */
function saveConfig(){ localStorage.setItem('f1shpr0_config', JSON.stringify(S)); }
function loadConfig(){
  try{ return {...DEF, ...(JSON.parse(localStorage.getItem('f1shpr0_config')||'{}'))}; }
  catch{ return {...DEF}; }
}
applyAllSettingsToUi();

/* ============================================================
   FPS BOOST SYSTEM
   1) Render-scale trick (always works): shrink iframe resolution, scale up.
   2) Best-effort in-game settings (if accessible): lower graphics, clouds off, etc.
   ============================================================ */

/* 1) Render-scale (huge FPS gains on low-end) */
function applyRenderScale(){
  const stage = document.getElementById('gameStage');
  const iframe = document.getElementById('gameFrame');
  const scale = Math.max(50, Math.min(100, S.renderScale)) / 100;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Render the game at reduced resolution (inside iframe area)…
  const targetW = Math.round(vw * scale);
  const targetH = Math.round(vh * scale);
  iframe.style.width = targetW + 'px';
  iframe.style.height = targetH + 'px';

  // …then upscale the whole iframe back to full size.
  const scaleUpX = vw / targetW;
  const scaleUpY = vh / targetH;
  const scaleUp = Math.min(scaleUpX, scaleUpY);
  iframe.style.transformOrigin = '0 0';
  iframe.style.transform = `scale(${scaleUp})`;

  // Ensure the stage occupies full viewport (so it “looks” full size)
  stage.style.width = vw + 'px';
  stage.style.height = vh + 'px';
}
window.addEventListener('resize', applyRenderScale);

/* 2) Best-effort in-game settings (only if APIs are visible) */
function applyFpsPreset(){
  const preset = (S.fpsPreset || 'balanced');
  // Adjust render scale presets too
  if(preset==='quality') S.renderScale = Math.max(S.renderScale, 90);
  if(preset==='balanced') S.renderScale = Math.max(S.renderScale, 75);
  if(preset==='ultra') S.renderScale = Math.min(S.renderScale, 70); // allow even lower if user drags

  applyRenderScale();
  saveConfig();

  if(!gameReady || !mc) { flash('FPS preset applied (render-scale). In-game tweaks when accessible.'); return; }

  try {
    // Many Eaglercraft builds expose gameSettings like vanilla
    const gs = mc.gameSettings || mc.settings || null;
    if(gs){
      // Safe toggles (guarded)
      if('fancyGraphics' in gs) gs.fancyGraphics = false;
      if('clouds' in gs) gs.clouds = 0; // 0: off (often)
      if('ambientOcclusion' in gs) gs.ambientOcclusion = 0;
      if('gammaSetting' in gs) gs.gammaSetting = 1.0; // keep bright-ish
      if('ofFastRender' in gs) gs.ofFastRender = true;
      if('ofFastMath' in gs) gs.ofFastMath = true;
      if('ofSmoothFps' in gs) gs.ofSmoothFps = true;
      if('ofVignette' in gs) gs.ofVignette = 0;
      if('limitFramerate' in gs) gs.limitFramerate = S.limit60 ? 60 : 260;
      if('renderDistanceChunks' in gs){
        gs.renderDistanceChunks = (preset==='quality') ? 10 : (preset==='balanced' ? 6 : 4);
      }
      if('particleSetting' in gs) gs.particleSetting = (preset==='quality') ? 1 : 2; // 0 all, 1 decreased, 2 minimal
      if('ao' in gs) gs.ao = 0;

      // Some builds need an apply/save call or a reload of video settings screen
      if(typeof gs.saveOptions === 'function') gs.saveOptions();
    }

    // Some builds keep options in localStorage (best guesses)
    try {
      const o = JSON.parse(localStorage.getItem('options') || '{}');
      if(preset!=='quality'){
        o.fancyGraphics = false; o.clouds = 0; o.ao = 0; o.entityShadows = false;
        o.particles = 2; o.mipmapLevels = 0; o.limitFramerate = S.limit60 ? 60 : 260;
      }
      localStorage.setItem('options', JSON.stringify(o));
    }catch{}

    flash('FPS preset applied (in-game settings + render-scale)');
  } catch(e){
    console.warn('FPS preset best-effort failed', e);
    flash('FPS preset applied (render-scale). In-game tweaks not accessible.');
  }
}

/* Optional: reduce JS/paint pressure when tab hidden */
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && S.pauseWhenHidden){
    // We can’t pause the game loop inside the iframe reliably,
    // but we can pause our overlays, which saves CPU.
    gameFocused = false;
  }
});

/* ===================== Best-effort helpers into game ===================== */
// Hold-to-zoom: if FOV exposed, set it temporarily; otherwise UI-only indicator
function bestEffortZoom(fov){
  if(!gameReady || !mc) return;
  const gs = mc.gameSettings || mc.settings || null;
  if(gs && 'fovSetting' in gs){
    if(fov==null){
      if(typeof gs.setFOV === 'function') return gs.setFOV(gs.defaultFOV || 70);
      gs.fovSetting = gs.defaultFOV || 70;
      return;
    }
    gs.fovSetting = Math.max(10, Math.min(110, fov));
  }
}
// Auto sprint: if player API is visible, simulate sprint flag
function bestEffortAutoSprint(){
  if(!S.autoSprint || !gameReady || !mc || !mc.thePlayer) return;
  try{
    const p = mc.thePlayer;
    if(typeof p.setSprinting === 'function') p.setSprinting(true);
    else if('sprinting' in p) p.sprinting = true;
  }catch{}
}

/* ===================== “Auto death waypoint” (best-effort) ===================== */
function bestEffortBindDeathWaypoint(){
  if(!gameReady || !mc || !S.autoDeathWp) return;
  try{
    const p = mc.thePlayer;
    // We don’t know event bus details; poll for health crossing 0
    let lastHealth = (p && typeof p.getHealth === 'function') ? p.getHealth() : 20;
    setInterval(()=>{
      try{
        const hp = (p && typeof p.getHealth === 'function') ? p.getHealth() : lastHealth;
        if(hp<=0 && lastHealth>0){
          S.waypoints.push({name:'Death', x:P.x, y:P.y, z:P.z, color:'#ff4d4d', enabled:true});
          renderWpList(); renderWaypointOverlay(); saveConfig(); flash('Death waypoint added');
        }
        lastHealth = hp;
      }catch{}
    }, 500);
  }catch{}
}

/* ===================== Render-scale slider live update ===================== */
function flash(msg){
  // quick toast
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;left:50%;top:10%;transform:translateX(-50%);background:#04151c;border:1px solid #1a3a46;color:#cfefff;padding:8px 12px;border-radius:10px;z-index:10000;box-shadow:0 10px 30px rgba(0,0,0,.4);font:600 12px/1.2 Inter';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 1400);
}

/* ===================== THE BIG WIN: input never blocked ===================== */
/* We NEVER preventDefault except for opening/closing menu keys above. */


/* ===================== THEME INIT ===================== */
applyTheme();

/* ===================== END ===================== */
