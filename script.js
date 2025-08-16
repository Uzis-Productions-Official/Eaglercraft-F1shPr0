function launchGame() {
  document.getElementById("menu").style.display = "none";
  document.getElementById("game").style.display = "block";

  // Load the Eaglercraft 1.8.8 offline build into the iframe
  document.getElementById("gameFrame").src = "eaglercraft/1.8.8_offline_en_US.html";
}

// --- Client Options System ---

const options = [
  "Show FPS Counter",
  "Show Ping",
  "Enable Dark Theme",
  "Custom Crosshair",
  "Show Armor HUD",
  "Show Potion Effects",
  "Mini-map Overlay",
  "Chunk Borders",
  "Auto-Reconnect",
  "Chat Timestamps",
  "Chat Filter",
  "Compact Chat",
  "Transparent Chat",
  "Big Inventory",
  "Fast Resource Packs",
  "Custom Skins",
  "Player Glow",
  "Show Coordinates",
  "Block Outline",
  "Dynamic FOV",
  "Toggle Animations",
  "Particles Booster",
  "Custom Hotkeys",
  "Keybind Viewer",
  "Simple Scoreboard",
  "Detailed Scoreboard",
  "Show CPS Counter",
  "Ping Graph",
  "FPS Graph",
  "Clock Overlay",
  "Session Timer",
  "Custom Menu Music",
  "Mute Music",
  "Resource Pack Selector",
  "Friends List",
  "Private Messaging",
  "Quick Server Switch",
  "Server MOTD Viewer",
  "Custom Cape Support",
  "Rainbow Text Chat",
  "Chat Background Blur",
  "Custom GUI Scaling",
  "Toggle Tooltips",
  "Zoom Key (like Optifine)",
  "Fullbright",
  "Toggle Particles",
  "Hide Hand",
  "Custom Fog Colors",
  "BossBar Overlay",
  "Damage Numbers",
  "Item Rarity Colors"
];

// Generate checkboxes dynamically
window.onload = () => {
  const list = document.getElementById("optionsList");
  options.forEach(opt => {
    const div = document.createElement("div");
    div.className = "optionItem";
    div.innerHTML = `<label><input type="checkbox" onchange="toggleOption('${opt}')"> ${opt}</label>`;
    list.appendChild(div);
  });
};

// Toggle options (placeholder functionality)
function toggleOption(option) {
  console.log(`Toggled: ${option}`);
}

// Toggle menu with Right Shift
document.addEventListener("keydown", e => {
  if (e.code === "ShiftRight") {
    const menu = document.getElementById("clientMenu");
    menu.classList.toggle("hidden");
  }
});
