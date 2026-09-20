# Python script to assemble the complete overhaul HTML file
import os

with open('old-mountain-works.original.html', 'r', encoding='utf-8') as f:
    orig = f.read()

# Locate Matter.js inside <script>
script_start = orig.find('<script>') + len('<script>')
matter_end = orig.find('var u=L0(z0(),1);') + len('var u=L0(z0(),1);')
matter_bundle = orig[script_start:matter_end]

with open('game_engine.js', 'r', encoding='utf-8') as f:
    game_engine = f.read()

html_head = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
<title>The Old Mountain Works — Master Physics Driving Expedition</title>
<style>
  :root {
    --ink: #1b1f1d;
    --paper: #efe7d6;
    --paper-card: rgba(239, 231, 214, 0.95);
    --hot: #d4622a;
    --hot-glow: rgba(212, 98, 42, 0.25);
    --accent: #2ea3a5;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    background: var(--paper);
    overflow: hidden;
    font-family: Georgia, 'Times New Roman', serif;
    color: var(--ink);
    user-select: none;
    -webkit-user-select: none;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100dvh;
    touch-action: none;
  }
  .mono { font-family: 'Courier New', monospace; font-weight: 600; }
  
  /* Overlays */
  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 231, 214, 0.72);
    backdrop-filter: blur(2px);
    z-index: 10;
  }
  .card {
    width: min(580px, 92vw);
    border: 1.5px solid rgba(27, 31, 29, 0.35);
    background: var(--paper-card);
    padding: 34px;
    box-shadow: 10px 10px 0 rgba(27, 31, 29, 0.16);
  }
  .kicker {
    font-size: 10px;
    letter-spacing: 0.44em;
    text-transform: uppercase;
    opacity: 0.6;
    margin-bottom: 4px;
  }
  h1 {
    font-size: 44px;
    line-height: 0.94;
    letter-spacing: -0.02em;
    margin-top: 6px;
    text-transform: uppercase;
  }
  .card p.desc {
    margin-top: 16px;
    max-width: 27rem;
    font-size: 14px;
    line-height: 1.6;
    opacity: 0.75;
  }
  dl {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid rgba(27, 31, 29, 0.2);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  dl div { display: flex; justify-content: space-between; }
  dd { font-family: 'Courier New', monospace; font-weight: bold; }
  
  .btn {
    margin-top: 26px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 2px solid var(--ink);
    background: var(--ink);
    color: var(--paper);
    padding: 13px 22px;
    font-size: 14px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .btn:hover { background: var(--hot); border-color: var(--hot); }
  
  .btn2 {
    width: 100%;
    border: 1.5px solid var(--ink);
    background: transparent;
    color: var(--ink);
    padding: 11px 18px;
    font-size: 13px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    cursor: pointer;
    text-align: left;
    margin-top: 8px;
    transition: background 0.15s, color 0.15s;
    display: flex;
    justify-content: space-between;
  }
  .btn2:hover { background: var(--ink); color: var(--paper); }
  
  /* Options toggles */
  .options-group {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid rgba(27, 31, 29, 0.18);
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }
  .option-row input[type="checkbox"] {
    accent-color: var(--hot);
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  /* HUD */
  #hud {
    display: none;
    position: fixed;
    top: 14px;
    left: 18px;
    z-index: 5;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0.9;
    line-height: 1.85;
    pointer-events: none;
  }
  #hud .rpm {
    width: 120px;
    height: 5px;
    border: 1px solid var(--ink);
    margin-top: 4px;
    background: rgba(27, 31, 29, 0.1);
  }
  #hud .rpm i {
    display: block;
    height: 100%;
    background: var(--hot);
    width: 0%;
    transition: width 0.05s ease-out;
  }
  #hud-air {
    color: var(--hot);
    font-weight: bold;
    letter-spacing: 0.2em;
  }
  #hud-combo {
    color: var(--hot);
    font-weight: bold;
    letter-spacing: 0.22em;
    font-size: 11px;
  }

  /* Stunt notification toast */
  #hud-stunt {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 6;
    pointer-events: none;
    font-size: 14px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--ink);
    background: var(--paper-card);
    border: 1.5px solid var(--ink);
    box-shadow: 6px 6px 0 rgba(27, 31, 29, 0.15);
    padding: 10px 18px;
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 0.2s ease-out, transform 0.2s ease-out;
  }
  #hud-stunt strong { color: var(--hot); font-weight: 900; }

  /* Touch Pedals for Mobile / Touch Devices */
  #pedals {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    justify-content: space-between;
    padding: 18px;
    z-index: 5;
  }
  #pedals button {
    height: 94px;
    width: 115px;
    border: 2px solid rgba(27, 31, 29, 0.6);
    background: rgba(239, 231, 214, 0.65);
    color: var(--ink);
    font-size: 26px;
    touch-action: none;
    cursor: pointer;
  }
  #pedals button:active {
    background: var(--hot-glow);
    border-color: var(--hot);
  }
  #pause { display: none; }
  @media (pointer: fine) {
    #pedals { display: none !important; }
  }
</style>
</head>
<body>
<canvas id="game"></canvas>

<!-- In-Game HUD -->
<div id="hud">
  <div>DIST <span id="hud-dist" class="mono">0 m</span></div>
  <div>SPEED <span id="hud-speed" class="mono">0 km/h</span></div>
  <div>ALT <span id="hud-alt" class="mono">0 m</span></div>
  <div>ZONE <span id="hud-zone" class="mono">ALPINE MEADOW</span></div>
  <div>SCORE <span id="hud-score" class="mono">0</span></div>
  <div class="rpm"><i id="hud-rpm"></i></div>
  <div id="hud-air"></div>
  <div id="hud-combo"></div>
</div>

<!-- Floating Stunt Notification Toast -->
<div id="hud-stunt"></div>

<!-- Touch Pedals -->
<div id="pedals">
  <button id="pedal-l" aria-label="Reverse / brake">&#9664;</button>
  <button id="pedal-r" aria-label="Throttle">&#9654;</button>
</div>

<!-- Title & Expedition Launch Overlay -->
<div class="overlay" id="title">
  <div class="card">
    <p class="kicker">Field Expedition &middot; Physics Master</p>
    <h1>The Old<br/>Mountain Works</h1>
    <p class="desc">A handcrafted physical mountain expedition across changing alpine biomes. Negotiate terrain, momentum, suspension, articulated driver balance and gravity &mdash; simulated in real time with zero canned animation.</p>
    <dl>
      <div><dt>Throttle</dt><dd>D / &#8594; / W</dd></div>
      <div><dt>Brake / Air Pitch</dt><dd>A / &#8592; / S</dd></div>
      <div><dt>Restart Run</dt><dd>R</dd></div>
      <div><dt>Expedition Pause</dt><dd>ESC</dd></div>
      <div><dt>Diagnostics</dt><dd>F3</dd></div>
    </dl>
    <button class="btn" id="start-btn"><span>Start Expedition</span><span class="mono">&#8594;</span></button>
  </div>
</div>

<!-- Pause & Options Overlay -->
<div class="overlay" id="pause">
  <div class="card" style="width: min(420px, 90vw);">
    <p class="kicker">Expedition Halted</p>
    <dl style="margin-top: 12px; margin-bottom: 16px;">
      <div><dt>Distance</dt><dd id="recap-dist">0 m</dd></div>
      <div><dt>Peak Alt</dt><dd id="recap-alt">0 m</dd></div>
      <div><dt>Score</dt><dd id="recap-score">0</dd></div>
    </dl>
    <button class="btn2" id="resume-btn"><span>Resume Expedition</span><span class="mono">&#9654;</span></button>
    <button class="btn2" id="restart-btn"><span>Restart Run</span><span class="mono">&#8635;</span></button>
    <button class="btn2" id="seed-btn"><span>New Terrain Seed</span><span class="mono">&#9874;</span></button>
    
    <div class="options-group">
      <label class="option-row">
        <span>Screen Shake Feedback</span>
        <input type="checkbox" id="opt-shake" checked />
      </label>
      <label class="option-row">
        <span>Reduced Motion Mode</span>
        <input type="checkbox" id="opt-motion" />
      </label>
      <label class="option-row">
        <span>Mute Audio</span>
        <input type="checkbox" id="opt-mute" />
      </label>
    </div>
  </div>
</div>

<script>
"""

html_tail = """
</script>
</body>
</html>
"""

full_content = html_head + matter_bundle + "\n" + game_engine + html_tail

with open('old-mountain-works.html', 'w', encoding='utf-8') as f:
    f.write(full_content)

print(f"Successfully generated old-mountain-works.html! Total length: {len(full_content)} bytes")
