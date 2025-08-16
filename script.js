/*************************************************
 * F1shPr0 – Fully functional overlays for iframe game
 * - No key blocking: only menu keys handled
 * - Render-scale FPS boost + low-power overlay mode
 * - CSS Zoom on iframe (hold key) — works everywhere
 * - HUD, minimap, waypoints, breadcrumbs
 **************************************************/

/* ===================== Settings / State ===================== */
const DEF = {
  // HUD
  fps:true, ping:true, coords:true, clock:false, session:true, pauseOverlays:true,
  // Minimap
  minimap:true, radar:true, breadcrumbs:false, mapZoom:10, markerSize:4, chunkGrid:false,
  // Visual
  fullbright:false, customCrosshair:false, crosshairStyle:'plus', zoomKey:true, zoomAmount:1.4,
  // Waypoints
  showWpList:true, waypoints:[],
  // Player/UI helpers
  hideCursor:false,
  // Tools
  lowPowerOverlays:true, pauseWhenHidden:true,
  // UI
  guiScale:100, theme:'teal',
  // Keys
  openKey:'ShiftRight', closeKey:'ControlRight', holdZoomKey:'KeyC',
  // FPS
  renderScale:100, fpsPreset:'balanced'
};
let S = loadConfig();

let sessionStart = Date.now();
let fps = 0, lastFrame = performance.now();
let pingMs = null;
let holdingZoom = false;
let P = {x:0,y:64,z:0,yaw:0}; // fallback coords for UI features
let crumbs = [];
let gameFocused = false;

/* ===================== Launch ===================== */
function launchGame(){
  document.getElementById('menu').style.display='none';
  document.getElementById('game').style.display='block';

  const iframe = document.getElementById('gameFrame');
  iframe.src = "eaglercraft/Release 1.8.8.html";

  // Size & scale for FPS
  applyRenderScale();

  // Focus handling
  const focusHint = document.getElementById('focusHint');
  const stage = document.getElementById('gameStage');

  stage.addEventListener('mousedown', ()=>{
    iframe.focus(); gameFocused = true; focusHint.style.display='none';
    if(S.hideCursor) document.body.style.cursor='none';
  });
  window.addEventListener('blur', ()=>{ gameFocused=false; if(S.hideCursor) document.body.style.cursor='auto'; });

  requestAnimationFrame(mainLoop);
}
window.launchGame = launchGame;

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
function openMenu(){ menu.classList.add('show'); backdrop.classList.add('show'); }
function closeMenu(){
  if(menu.dataset.pinned === '1') return;
  menu.classList.remove('show'); backdrop.classList.remove('show');
  document.getElementById('gameFrame').focus(); gameFocused=true;
}
backdrop.addEventListener('click', closeMenu);
document.getElementById('pinMenuBtn').addEventListener('click', ()=>{
  const pinned = menu.dataset.pinned === '1';
  menu.dataset.pinned = pinned ? '0' : '1';
  document.getElementById('pinMenuBtn').textContent = pinned ? 'Pin' : 'Pinned';
});

/* ===================== Non-blocking global keys ===================== */
document.addEventListener('keydown', e=>{
  if(e.code===S.openKey){ openMenu(); e.preventDefault(); return; }
  if(e.code===S.closeKey){ closeMenu(); e.preventDefault(); return; }

  // Don't steal keys if menu open
  if(menu.classList.contains('show')) return;

  if(S.zoomKey && e.code===S.holdZoomKey){ holdingZoom = true; }
  if(e.code==='KeyB'){ addWaypointFromPlayer(); }
  if(e.code==='KeyL'){ S.showWpList = !S.showWpList; renderWaypointOverlay(); saveConfig(); }
}, false);
document.addEventListener('keyup', e=>{
  if(e.code===S.holdZoomKey){ holdingZoom=false; document.getElementById('zoomIndicator').textContent=''; zoomIframe(1); }
}, false);

/* ===================== Settings bind ===================== */
document.querySelectorAll('[data-setting]').forEach(el=>{
  const key = el.getAttribute('data-setting');
  if(el.type==='checkbox') el.checked = !!S[key];
  else el.value = S[key];
  el.addEventListener('input', ()=>{
    if(el.type==='checkbox') S[key] = el.checked;
    else if(el.type==='range') S[key] = (el.step && el.step.indexOf('.')>=0) ? parseFloat(el.value) : Number(el.value);
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
  if(k==='zoomAmount' && holdingZoom) zoomIframe(S.zoomAmount);
}
onSettingChanged('fullbright'); updateCrosshair(); applyTheme();
document.documentElement.style.fontSize = (S.guiScale/100)+'rem';

/* Preset & Apply */
document.getElementById('applyFpsBtn').addEventListener('click', applyFpsPreset);
document.getElementById('fpsPreset').value = S.fpsPreset;
document.getElementById('fpsPreset').addEventListener('input', e=>{
  S.fpsPreset = e.target.value; saveConfig(); applyFpsPreset();
});

/* Key capture inputs */
['openKey','closeKey','holdZoomKey'].forEach(id=>{
  const el = document.getElementById(id);
  el.addEventListener('click', ()=>{
    el.value = 'Press key...';
    const once = (e)=>{
      e.preventDefault();
      S[id==='holdZoomKey'?'holdZoomKey':id] = e.code || e.key;
      el.value = S[id];
      saveConfig();
      document.removeEventListener('keydown', once, true);
    };
    document.addEventListener('keydown', once, true);
  });
});

/* Config import/export + screenshot hint */
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
document.getElementById('shotBtn').addEventListener('click', ()=>flash('Use OS/browser screenshot (e.g., Search+[] on Chromebook).'));

/* ===================== Waypoints ===================== */
document.getElementById('addWpBtn').addEventListener('click', addWaypointFromPlayer);
document.getElementById('exportWpBtn').addEventListener('click', exportWaypoints);
document.getElementById('importWpBtn').addEventListener('click', ()=>document.getElementById('importWpFile').click());
document.getElementById('importWpFile').addEventListener('change', importWaypointsFile);

function addWaypointFromPlayer(){
  // We don’t have player coords from inside the game; use the last UI-coords (updated via manual input if you want)
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

/* ===================== Main loop (overlays only) ===================== */
function mainLoop(){
  const now = performance.now();
  const dt = now - lastFrame;
  fps = Math.max(1, Math.round(1000 / Math.max(1, dt)));
  lastFrame = now;

  // Reduce overlay work if low power is on
  const skip = S.lowPowerOverlays && !gameFocused;
  if(S.pauseOverlays && !gameFocused){ requestAnimationFrame(mainLoop); return; }

  // Ping (best-effort HEAD once/sec when active)
  if(S.ping && !skip){
    if(pingMs==null || (now|0)%1000 < 16){
      const t0 = performance.now();
      fetch('.', {method:'HEAD', cache:'no-store'}).then(()=> {
        pingMs = Math.round(performance.now()-t0);
      }).catch(()=> pingMs = null);
    }
  }

  // HUD
  text('overlay-fps', S.fps ? `FPS: ${fps}` : '');
  text('overlay-ping', S.ping ? `Ping: ${pingMs!=null? pingMs+' ms' : 'n/a'}` : '');
  text('overlay-coords', S.coords ? `XYZ: ${P.x.toFixed(1)} ${P.y.toFixed(1)} ${P.z.toFixed(1)} | Yaw ${Math.round(P.yaw)}°` : '');
  text('overlay-clock', S.clock ? new Date().toLocaleTimeString() : '');
  text('overlay-session', S.session ? `Session: ${fmtTime((Date.now()-sessionStart)/1000|0)}` : '');

  // Zoom indicator + CSS zoom
  if(S.zoomKey && holdingZoom){
    text('zoomIndicator', `Zoom x${S.zoomAmount.toFixed(2)}`);
    zoomIframe(S.zoomAmount);
  }

  // Breadcrumbs (UI pathing if you update coords manually)
  if(S.breadcrumbs && !skip){
    const last = crumbs[crumbs.length-1];
    if(!last || dist2(last, P) > 1) crumbs.push({x:P.x, z:P.z});
  } else if(crumbs.length) { crumbs = []; }

  drawMinimap(P);
  drawBreadcrumbs(P);
  renderWaypointOverlay();

  requestAnimationFrame(mainLoop);
}

/* ===================== CSS Zoom on the iframe ===================== */
function zoomIframe(f){
  const stage = document.getElementById('gameStage');
  const frame = document.getElementById('gameFrame');
  if(!f || f<=1){ // reset
    frame.style.transform = stage.dataset.baseTransform || 'scale(1)';
    frame.style.transformOrigin = '0 0';
    return;
  }
  // apply base + zoom
  const base = stage.dataset.baseTransform || '';
  frame.style.transform = `${base} scale(${f})`;
  frame.style.transformOrigin = '50% 50%';
}

/* ===================== Minimap / Radar / Breadcrumbs ===================== */
function drawMinimap(pl){
  const cvs = document.getElementById('minimap');
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0,0,cvs.width,cvs.height);
  if(!S.minimap && !S.radar) return;

  const size = cvs.width, c = size/2;
  ctx.save(); ctx.translate(c,c);

  if(S.radar){
    ctx.globalAlpha = .85;
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

/* ===================== FPS BOOST ===================== */
function applyRenderScale(){
  const stage = document.getElementById('gameStage');
  const iframe = document.getElementById('gameFrame');
  const scale = Math.max(50, Math.min(100, S.renderScale)) / 100;
  const vw = window.innerWidth, vh = window.innerHeight;

  const targetW = Math.round(vw * scale);
  const targetH = Math.round(vh * scale);

  iframe.style.width = targetW + 'px';
  iframe.style.height = targetH + 'px';

  const scaleUpX = vw / targetW;
  const scaleUpY = vh / targetH;
  const scaleUp = Math.min(scaleUpX, scaleUpY);

  iframe.style.transformOrigin = '0 0';
  iframe.style.transform = `scale(${scaleUp})`;
  stage.dataset.baseTransform = `scale(${scaleUp})`;

  stage.style.width = vw + 'px';
  stage.style.height = vh + 'px';
}
window.addEventListener('resize', applyRenderScale);

function applyFpsPreset(){
  const preset = (S.fpsPreset || 'balanced');
  if(preset==='quality') S.renderScale = Math.max(S.renderScale, 90);
  if(preset==='balanced') S.renderScale = Math.max(S.renderScale, 75);
  if(preset==='ultra') S.renderScale = Math.min(S.renderScale, 65); // go aggressive
  applyRenderScale(); saveConfig();
  flash('FPS preset applied (render-scale + overlay optimizations)');
}

/* ===================== Theme & UI apply ===================== */
function applyTheme(){
  document.body.classList.remove('theme-violet','theme-amber','theme-mono');
  if(S.theme==='violet') document.body.classList.add('theme-violet');
  if(S.theme==='amber') document.body.classList.add('theme-amber');
  if(S.theme==='mono') document.body.classList.add('theme-mono');
  document.getElementById('themeSelect').value = S.theme;
}
function applyAllSettingsToUi(){
  document.querySelectorAll('[data-setting]').forEach(el=>{
    const key = el.getAttribute('data-setting');
    if(el.type==='checkbox') el.checked = !!S[key];
    else if(el.type==='range' || el.tagName==='SELECT') el.value = S[key];
  });
  ['openKey','closeKey','holdZoomKey'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value = S[id];
  });
  onSettingChanged('fullbright'); updateCrosshair(); applyTheme();
  renderWpList(); renderWaypointOverlay();
  document.documentElement.style.fontSize = (S.guiScale/100)+'rem';
}
applyAllSettingsToUi();

/* ===================== Utils ===================== */
function text(id, s){ const el = document.getElementById(id); if(el) el.textContent = s || ''; }
function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v) || '#00eaff'; }
function line(ctx,x1,y1,x2,y2,stroke,w){ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.strokeStyle=stroke; ctx.lineWidth=w; ctx.stroke(); }
function dot(ctx,x,y,r,color){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); }
function label(ctx, t, x, y){ ctx.fillStyle='#cfffff'; ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillText(t,x,y); }
function fmtTime(s){ const h=(s/3600|0), m=((s%3600)/60|0), ss=(s%60|0); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function dist2(a,b){ const dx=a.x-b.x, dz=a.z-b.z; return dx*dx+dz*dz; }
function btn(txt, fn){ const b=document.createElement('button'); b.className='btn'; b.textContent=txt; b.onclick=fn; return b; }

/* ===================== Config ===================== */
function saveConfig(){ localStorage.setItem('f1shpr0_config', JSON.stringify(S)); }
function loadConfig(){
  try{ return {...DEF, ...(JSON.parse(localStorage.getItem('f1shpr0_config')||'{}'))}; }
  catch{ return {...DEF}; }
}

/* ===================== Open/Close menu animation & safety ===================== */
document.querySelectorAll('.tab').forEach(btn=>{
  // already wired above; keeping here so future elements also work
});
backdrop.addEventListener('click', closeMenu);

/* ===================== Theme init ===================== */
applyTheme();

/* ===================== Extra: basic coords editor (optional)
   If you want precise minimap/waypoints tied to your real position,
   open DevTools and do:
   P.x=123; P.y=64; P.z=456; P.yaw=90;
   (We can’t read game internals from the iframe for privacy/sandbox reasons)
======================================================== */

/* ===================== END ===================== */
