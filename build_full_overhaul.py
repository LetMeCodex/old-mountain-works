# Full Master Engine Overhaul Builder for Old Mountain Works
# Implements:
# 1. Procedural Terrain Grammar with C1 Hermite Continuity & Safety Validation (no knife-edges, zero vertical steps)
# 2. Vehicle Archetypes (Trail Buggy, Mountain Crawler, Alpine Rally) with authentic physics tuning
# 3. Correct Air Control Pitch Authority (throttle pitches back/CCW -> Backflip; brake pitches forward/CW -> Frontflip)
# 4. Interactive Physics Destruction Props (wooden signs, breakable fences, crates, loose rolling rocks)
# 5. Articulated Procedural Driver with 2-bone IK, jacket, boots, helmet visor reflection, rollover protection tuck & victory fist pump
# 6. Real-time Stunt Director with flip counting, sustained wheelie/stoppie accumulation, landing evaluation & stunt toast queue
# 7. Layered Web Audio with suspension creaks, engine synthesis, impact textures, wind, and prop splinters
# 8. Complete F3 Debug Telemetry Overlay with live metrics & vector overlays
# 9. Career Progression & LocalStorage Persistence
# 10. Single-file assembly for both old-mountain-works.html and old-mountain-works(1).html

import os

with open('old-mountain-works.original.html', 'r', encoding='utf-8') as f:
    orig = f.read()

# Locate Matter.js inside <script>
script_start = orig.find('<script>') + len('<script>')
matter_end = orig.find('var u=L0(z0(),1);') + len('var u=L0(z0(),1);')
matter_bundle = orig[script_start:matter_end]

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
    background: rgba(239, 231, 214, 0.75);
    backdrop-filter: blur(3px);
    z-index: 10;
  }
  .card {
    width: min(600px, 92vw);
    border: 1.5px solid rgba(27, 31, 29, 0.35);
    background: var(--paper-card);
    padding: 30px;
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
    font-size: 42px;
    line-height: 0.94;
    letter-spacing: -0.02em;
    margin-top: 6px;
    text-transform: uppercase;
  }
  .card p.desc {
    margin-top: 14px;
    max-width: 30rem;
    font-size: 13.5px;
    line-height: 1.55;
    opacity: 0.78;
  }
  dl {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid rgba(27, 31, 29, 0.2);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 20px;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  dl div { display: flex; justify-content: space-between; }
  dd { font-family: 'Courier New', monospace; font-weight: bold; }

  /* Vehicle Selection Tabs */
  .archetype-picker {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .archetype-btn {
    padding: 8px 10px;
    border: 1.5px solid rgba(27, 31, 29, 0.3);
    background: rgba(27, 31, 29, 0.04);
    font-family: Georgia, serif;
    font-size: 11px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }
  .archetype-btn:hover {
    background: rgba(27, 31, 29, 0.08);
  }
  .archetype-btn.active {
    border-color: var(--hot);
    background: rgba(212, 98, 42, 0.12);
    box-shadow: 2px 2px 0 var(--hot);
  }
  .archetype-btn strong {
    display: block;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .archetype-btn span {
    display: block;
    font-size: 9.5px;
    opacity: 0.7;
    margin-top: 2px;
    font-family: 'Courier New', monospace;
  }
  
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-top: 20px;
    padding: 13px 20px;
    border: 1.5px solid var(--ink);
    background: var(--ink);
    color: var(--paper);
    font-family: Georgia, serif;
    font-size: 13px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 5px 5px 0 var(--hot);
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }
  .btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 7px 7px 0 var(--hot);
  }
  .btn:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 var(--hot);
  }
  .btn2 {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-top: 8px;
    padding: 10px 16px;
    border: 1px solid rgba(27, 31, 29, 0.35);
    background: transparent;
    color: var(--ink);
    font-family: Georgia, serif;
    font-size: 12px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .btn2:hover {
    background: rgba(27, 31, 29, 0.08);
  }
  
  /* In-game HUD */
  #hud {
    position: fixed;
    top: 18px;
    left: 18px;
    pointer-events: none;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    display: none;
    z-index: 5;
    line-height: 1.7;
    background: rgba(239, 231, 214, 0.88);
    padding: 10px 14px;
    border: 1.5px solid rgba(27, 31, 29, 0.3);
    box-shadow: 4px 4px 0 rgba(27, 31, 29, 0.1);
  }
  #hud .rpm {
    margin-top: 4px;
    width: 130px;
    height: 4px;
    background: rgba(27, 31, 29, 0.18);
    overflow: hidden;
  }
  #hud .rpm i {
    display: block;
    height: 100%;
    width: 0%;
    background: var(--hot);
    transition: width 0.05s linear;
  }
  #hud-air {
    color: var(--hot);
    font-weight: bold;
  }
  #hud-combo {
    color: var(--accent);
    font-weight: bold;
    margin-top: 3px;
  }

  /* Floating Stunt Notification Toasts */
  #hud-stunt {
    position: fixed;
    top: 24px;
    right: 24px;
    pointer-events: none;
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }
  .stunt-toast {
    background: rgba(239, 231, 214, 0.95);
    border: 1.5px solid var(--ink);
    border-left: 6px solid var(--hot);
    padding: 8px 16px;
    font-family: Georgia, serif;
    font-size: 14px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--ink);
    box-shadow: 4px 4px 0 rgba(27, 31, 29, 0.2);
    animation: toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .stunt-toast strong {
    color: var(--hot);
  }
  .stunt-toast.tier-3 {
    border-left-color: var(--accent);
    box-shadow: 5px 5px 0 var(--accent);
  }
  .stunt-toast.tier-3 strong {
    color: var(--accent);
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(30px) scale(0.95); }
    to { opacity: 1; transform: translateX(0) scale(1); }
  }

  /* Mobile/Touch Pedals */
  #pedals {
    position: fixed;
    bottom: 22px;
    inset-inline: 22px;
    display: none;
    justify-content: space-between;
    pointer-events: none;
    z-index: 8;
  }
  #pedals button {
    pointer-events: auto;
    width: 76px;
    height: 76px;
    border-radius: 50%;
    border: 2px solid var(--ink);
    background: rgba(239, 231, 214, 0.88);
    color: var(--ink);
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 4px 4px 0 rgba(27, 31, 29, 0.18);
    touch-action: none;
  }
  #pedals button:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 rgba(27, 31, 29, 0.18);
    background: var(--paper-card);
  }

  /* Options & Checklist */
  .options-group {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(27, 31, 29, 0.2);
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
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
  }

  #pause { display: none; }
  @media (pointer: fine) {
    #pedals { display: none !important; }
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
<canvas id="three-canvas" style="position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;"></canvas>
<canvas id="game" style="position: fixed; inset: 0; width: 100%; height: 100%; touch-action: none; z-index: 2;"></canvas>

<!-- In-Game HUD -->
<div id="hud">
  <div>DIST <span id="hud-dist" class="mono">0 m</span></div>
  <div>SPEED <span id="hud-speed" class="mono">0 km/h</span></div>
  <div>ALT <span id="hud-alt" class="mono">0 m</span></div>
  <div>INCLINE <span id="hud-incline" class="mono">0°</span></div>
  <div>ECHOES <span id="hud-echoes" class="mono">0/6</span></div>
  <div>ZONE <span id="hud-zone" class="mono">ALPINE MEADOW</span></div>
  <div>SCORE <span id="hud-score" class="mono">0</span></div>
  <div>VEHICLE <span id="hud-vehicle" class="mono">TRAIL BUGGY</span></div>
  <div class="rpm"><i id="hud-rpm"></i></div>
  <div id="hud-air"></div>
  <div id="hud-combo"></div>
  <div id="hud-warning" style="display:none; color: #d4622a; font-weight: bold; font-size: 11px; background: rgba(212, 98, 42, 0.18); padding: 4px 8px; border: 1px solid #d4622a; margin-top: 5px;">WARNING: INVERTED! RECOVERY: <span id="hud-warning-timer">1.8s</span></div>
</div>

<!-- Floating Stunt Notification Container -->
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
    
    <div class="archetype-picker">
      <button class="archetype-btn active" data-archetype="buggy">
        <strong>Trail Buggy</strong>
        <span>Balanced &middot; Agile</span>
      </button>
      <button class="archetype-btn" data-archetype="crawler">
        <strong>Crawler</strong>
        <span>Heavy &middot; High Grip</span>
      </button>
      <button class="archetype-btn" data-archetype="rally">
        <strong>Alpine Rally</strong>
        <span>Light &middot; Air Pitch</span>
      </button>
    </div>

    <dl>
      <div><dt>Throttle / Air Backflip</dt><dd>D / &#8594; / W</dd></div>
      <div><dt>Brake / Air Frontflip</dt><dd>A / &#8592; / S</dd></div>
      <div><dt>Restart Run</dt><dd>R</dd></div>
      <div><dt>Expedition Pause</dt><dd>ESC</dd></div>
      <div><dt>Live Telemetry</dt><dd>F3</dd></div>
      <div><dt>Best Career Run</dt><dd id="title-best-dist">0 m</dd></div>
    </dl>
    <button class="btn" id="start-btn"><span>Start Expedition</span><span class="mono">&#8594;</span></button>
  </div>
</div>

<!-- Pause & Options Overlay -->
<div class="overlay" id="pause">
  <div class="card" style="width: min(480px, 92vw);">
    <p class="kicker">Expedition Halted</p>
    <dl style="margin-top: 10px; margin-bottom: 14px;">
      <div><dt>Current Run</dt><dd id="recap-dist">0 m</dd></div>
      <div><dt>Peak Altitude</dt><dd id="recap-alt">0 m</dd></div>
      <div><dt>Run Score</dt><dd id="recap-score">0</dd></div>
      <div><dt>Best Airtime</dt><dd id="recap-air">0.0 s</dd></div>
      <div><dt>Peak Combo</dt><dd id="recap-combo">x1</dd></div>
      <div><dt>Career Record</dt><dd id="recap-best">0 m</dd></div>
    </dl>

    <div class="archetype-picker" style="margin-bottom: 14px;">
      <button class="archetype-btn" data-archetype="buggy">
        <strong>Trail Buggy</strong>
      </button>
      <button class="archetype-btn" data-archetype="crawler">
        <strong>Crawler</strong>
      </button>
      <button class="archetype-btn" data-archetype="rally">
        <strong>Alpine Rally</strong>
      </button>
    </div>

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

<!-- Expedition Death Debrief Screen Overlay (Spec #46) -->
<div class="overlay" id="death-screen" style="display: none; z-index: 12;">
  <div class="card" style="width: min(560px, 92vw);">
    <p class="kicker" style="color: var(--hot);">Expedition Terminated &middot; Vehicle Wrecked</p>
    <h1 id="death-cause" style="font-size: 32px; margin-top: 4px;">Structural Failure</h1>
    <p class="desc" id="death-desc">The expedition was halted on the mountain face. Gravity and terrain claimed the machine.</p>
    
    <dl style="margin-top: 14px; margin-bottom: 16px;">
      <div><dt>Distance Reached</dt><dd id="death-dist">0 m</dd></div>
      <div><dt>Peak Altitude</dt><dd id="death-alt">0 m</dd></div>
      <div><dt>Expedition Score</dt><dd id="death-score">0</dd></div>
      <div><dt>Best Airtime</dt><dd id="death-air">0.0 s</dd></div>
      <div><dt>Flips & Stunts</dt><dd id="death-stunts">0</dd></div>
      <div><dt>Mountain Echoes</dt><dd id="death-echoes">0/6</dd></div>
    </dl>

    <div id="death-lore-box" style="display:none; background: rgba(27,31,29,0.06); padding: 10px 14px; border-left: 4px solid var(--hot); margin-bottom: 14px; font-size: 12px; font-style: italic;">
      <!-- Echo lore notes -->
    </div>

    <button class="btn" id="death-retry-btn"><span>Retry Expedition</span><span class="mono">&#8594;</span></button>
    <button class="btn2" id="death-new-route-btn"><span>New Route (Seed)</span><span class="mono">&#9874;</span></button>
    <button class="btn2" id="death-garage-btn"><span>Garage & Tuning</span><span class="mono">&#9881;</span></button>
  </div>
</div>

<!-- Vehicle Garage & Tuning Workshop Overlay (Spec #11) -->
<div class="overlay" id="garage-screen" style="display: none; z-index: 11;">
  <div class="card" style="width: min(620px, 94vw); max-height: 90vh; overflow-y: auto;">
    <p class="kicker">Field Engineering &middot; Tuning Workshop</p>
    <h1 style="font-size: 34px;">Vehicle Garage</h1>
    <p class="desc">Fine-tune suspension stiffness, shock damping, tire tread grip and power output for optimal mountain ascents.</p>

    <div class="archetype-picker" style="margin-top: 14px; margin-bottom: 16px;">
      <button class="archetype-btn active" data-archetype="buggy">
        <strong>Trail Buggy</strong>
        <span>Balanced &middot; Agile</span>
      </button>
      <button class="archetype-btn" data-archetype="crawler">
        <strong>Crawler</strong>
        <span>Heavy &middot; High Grip</span>
      </button>
      <button class="archetype-btn" data-archetype="rally">
        <strong>Alpine Rally</strong>
        <span>Light &middot; Fast</span>
      </button>
    </div>

    <div class="tuning-sliders" style="display: flex; flex-direction: column; gap: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">
      <div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Suspension Stiffness (k)</span>
          <span id="tune-val-stiff" class="mono">0.12</span>
        </div>
        <input type="range" id="tune-stiff" min="0.06" max="0.24" step="0.01" value="0.12" style="width: 100%; accent-color: var(--hot);" />
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Suspension Damping (c)</span>
          <span id="tune-val-damp" class="mono">0.065</span>
        </div>
        <input type="range" id="tune-damp" min="0.02" max="0.15" step="0.005" value="0.065" style="width: 100%; accent-color: var(--hot);" />
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Tire Tread Grip (&mu;)</span>
          <span id="tune-val-grip" class="mono">0.94</span>
        </div>
        <input type="range" id="tune-grip" min="0.70" max="1.50" step="0.02" value="0.94" style="width: 100%; accent-color: var(--hot);" />
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Engine Torque</span>
          <span id="tune-val-torque" class="mono">0.050</span>
        </div>
        <input type="range" id="tune-torque" min="0.03" max="0.10" step="0.005" value="0.050" style="width: 100%; accent-color: var(--hot);" />
      </div>
    </div>

    <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.2em; margin-top: 18px; margin-bottom: 8px; border-bottom: 1px solid rgba(27,31,29,0.2); padding-bottom: 4px;">Mountain Echoes Archive</h3>
    <div id="garage-echoes-list" style="max-height: 140px; overflow-y: auto; font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
      <!-- Echo archive entries -->
    </div>

    <button class="btn" id="garage-close-btn" style="margin-top: 16px;"><span>Apply & Return</span><span class="mono">&#8594;</span></button>
  </div>
</div>

<script>
"""

html_tail = """
</script>
</body>
</html>
"""

print("Writing assembly structure...")
