/*************************************************
 * F1shPr0 Client – Legit QoL for Eaglercraft 1.8.8
 * Input fixes (no blocking), backdrop, more QoL features.
 **************************************************/

/* ===================== Settings / State ===================== */
const DEF = {
  // HUD
  fps:false, ping:false, coords:false, clock:false, session:false,
  armorHud:false, toolsHud:false, potionsHud:false,
  pauseOverlays:true,
  // Minimap
  minimap:false, radar:false, breadcrumbs:false, mapZoom:10, markerSize:4, chunkGrid:false,
  // Visual
  fullbright:false, customCrosshair:false, crosshairStyle:'plus', zoomKey:false, zoomFov:30,
  // World
  autoDeathWp:false, dayClock:false, yLevelAlert:false, showWpList:true,
  waypoints:[],
  // Player (UI helpers)
  autoSprint:false, autoSneak:false, hideCursor:false, quickSort:false, equipBest:false,
  // Chat (UI helpers)
  chatTimestamps:false, compactChat:false, pingSound:false,
  // Tools
  autoReconnect:false, latencyGraph:false,
  // UI
  guiScale:100, theme:'teal',
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
let P = {x:0,y:64,z:0,yaw:0}; // fallback
let crumbs = [];
let gameFocused = false;

/* ===================== Launch ===================== */
function launchGame(){
  document.getElementById('menu').style.display='none';
  document.getElementById('game').style.display='block';

  const iframe = document.getElementById('gameFrame');
  iframe.src = "eaglercraft/Release 1.8.8.html";

  // focus hint handling
  const focusHint = document.getElementById('focusHint');
  iframe.addEventListener('load', ()=>{
    try {
      gameWin = iframe.contentWindow;
      setTimeout(()=>{
        mc = detectMinecraftGlobal();
        gameReady = !!mc;
        console.log('F1shPr0: gameReady=',gameReady);
      }, 800);
    } catch(e) { console.warn('F1shPr0: cross-origin; UI-only mode.'); }
  });

  // clicking anywhere on game area focuses iframe
  document.getElementById('game').addEventListener('mousedown', ()=>{
    iframe.focus();
    gameFocused = true;
    focusHint.style.display = 'none';
    if(S.hideCursor) document.body.style.cursor='none';
  });
  window.addEventListener('blur', ()=>{ gameFocused=false; if(S.hideCursor) document.body.style.cursor='auto'; });

  requestAnimationFrame(mainLoop);
}
window.launchGame = launchGame;

/* ===================== Helpers ===================== */
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
}
backdrop.addEventListener('click', closeMenu);
document.getElementById('pinMenuBtn').addEventListener('click', ()=>{
  const pinned = menu.dataset.pinned === '1';
  menu.dataset.pinned = pinned ? '0' : '1';
  document.getElementById('pinMenuBtn').textContent = pinned ? 'Pin' : 'Pinned';
});

/* ===================== Settings bind ===================== */
document.querySelectorAll('[data-]()
