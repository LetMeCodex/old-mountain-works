# Master Engine Generator for The Old Mountain Works Overhaul
import os

engine_code = r'''
// ============================================================================
// THE OLD MOUNTAIN WORKS - MASTER GAME ENGINE OVERHAUL
// Handcrafted Illustrated Mountain Expedition & Physics Simulation
// ============================================================================

const Matter = u.default || u;
var d = u;
var x0 = u;

// ----------------------------------------------------------------------------
// Core Math & Physics Utilities
// ----------------------------------------------------------------------------
const b = (v, min, max) => (v < min ? min : v > max ? max : v);
const O0 = (a, b, t) => a + (b - a) * t;
const G0 = (cur, target, rate, dt) => O0(cur, target, 1 - Math.exp(-rate * (dt / 1000)));
const normalizeAngle = (angle) => {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
};
function K0(seed) {
  const L = (k) => {
    const f = Math.sin(k * 127.1 + seed * 311.7) * 43758.5453;
    return f - Math.floor(f);
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  return (k) => {
    const i = Math.floor(k);
    const f = k - i;
    return O0(L(i), L(i + 1), smooth(f)) * 2 - 1;
  };
}
const I0 = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);

// ----------------------------------------------------------------------------
// Master Configuration (Preserving and Refining Existing Baseline)
// ----------------------------------------------------------------------------
const s0 = {
  chassisWidth: 118,
  chassisHeight: 28,
  chassisMass: 7.4,
  wheelRadius: 19,
  wheelMass: 1.1,
  wheelBase: 94,
  wheelOffsetY: 38,
  engineTorque: 0.048,
  brakeTorque: 0.070,
  maxWheelSpeed: 1.20,
  suspensionStiffness: 0.12,
  suspensionDamping: 0.065,
  suspensionTravel: 22,
  tireGrip: 0.94,
  airControl: 0.0062,
  angularDamping: 0.018,
  centerOfMassOffsetY: 3.5, // Deliberately lowered center of mass for authentic vehicle stability
};

const n0 = {
  gravity: 1.35,
  fixedDelta: 1000 / 120, // 8.333ms high-precision timestep
  maxSubSteps: 5,
};

const r0 = {
  followSpeed: 0.09,
  lookAhead: 140,
  baseZoom: 0.90,
  speedZoom: 0.12,
  airborneOffset: 0.35,
  impactZoom: 0.06,
  shakeIntensity: 1,
};

const i0 = {
  dustDensity: 1,
  screenShake: true,
  reducedMotion: false,
  muted: false,
};

const x = {
  vehicle: s0,
  physics: n0,
  camera: r0,
  visual: i0,
  world: {
    length: 36000, // Expedition trail length
    sampleStep: 18,
    groundBase: 560,
    startX: 220,
  },
};

// ----------------------------------------------------------------------------
// Biome System & Surface Materials
// ----------------------------------------------------------------------------
const BIOMES = [
  {
    id: "meadow",
    name: "Alpine Meadow",
    minDist: 0,
    maxDist: 180, // ~0 - 180m
    skyTop: "#b4c7be",
    skyBottom: "#ded2be",
    sun: "#e37e3d",
    groundFill: "#2a2d27",
    groundTop: "#6e7a55",
    groundTopLight: "#8a9566",
    far: "#5c6b65",
    mid: "#48534e",
    near: "#343d39",
    accent: "#d4622a",
    fogColor: "rgba(239,231,214,0.12)",
    defaultMaterial: "grass",
    landmark: { x: 1200, name: "Base Camp Outpost", type: "shelter" },
  },
  {
    id: "ridge",
    name: "Stone Ridge",
    minDist: 180,
    maxDist: 380, // ~180m - 380m
    skyTop: "#98a8af",
    skyBottom: "#d4cebe",
    sun: "#df8a51",
    groundFill: "#242728",
    groundTop: "#565e61",
    groundTopLight: "#6e777a",
    far: "#49565f",
    mid: "#38434a",
    near: "#2a3339",
    accent: "#d4622a",
    fogColor: "rgba(212,206,190,0.15)",
    defaultMaterial: "rock",
    landmark: { x: 11000, name: "The High Crag Cairn", type: "cairn" },
  },
  {
    id: "canyon",
    name: "Canyon Gorge",
    minDist: 380,
    maxDist: 580, // ~380m - 580m
    skyTop: "#ba9f88",
    skyBottom: "#dfc7a7",
    sun: "#e66831",
    groundFill: "#2b2019",
    groundTop: "#8a533c",
    groundTopLight: "#aa694c",
    far: "#6b4d3f",
    mid: "#543a2e",
    near: "#3d2920",
    accent: "#e05820",
    fogColor: "rgba(223,199,167,0.18)",
    defaultMaterial: "dirt",
    landmark: { x: 19500, name: "Old Trestle Chasm", type: "trestle" },
  },
  {
    id: "industrial",
    name: "Industrial Works",
    minDist: 580,
    maxDist: 750, // ~580m - 750m
    skyTop: "#7a8280",
    skyBottom: "#b8b2a3",
    sun: "#d95f32",
    groundFill: "#1e2021",
    groundTop: "#484945",
    groundTopLight: "#61635d",
    far: "#3a3e3d",
    mid: "#2c302f",
    near: "#202322",
    accent: "#d4622a",
    fogColor: "rgba(184,178,163,0.20)",
    defaultMaterial: "gravel",
    landmark: { x: 26500, name: "Abandoned Mine Pithead", type: "pithead" },
  },
  {
    id: "summit",
    name: "Frozen Summit",
    minDist: 750,
    maxDist: 5000, // 750m+
    skyTop: "#8ba3b8",
    skyBottom: "#d8e1e8",
    sun: "#e28652",
    groundFill: "#20262c",
    groundTop: "#c8d6e0",
    groundTopLight: "#ecf2f7",
    far: "#4e6377",
    mid: "#394a5a",
    near: "#2a3743",
    accent: "#d4622a",
    fogColor: "rgba(216,225,232,0.22)",
    defaultMaterial: "snow",
    landmark: { x: 33000, name: "Summit Weather Beacon", type: "beacon" },
  },
];

const MATERIALS = {
  grass: {
    name: "grass",
    friction: 1.0,
    rollingResistance: 0.001,
    roughness: 0.08,
    dustKind: "grass",
    dustColors: ["#c9bda2", "#a8b888", "#8a9566"],
    soundType: "soft",
  },
  dirt: {
    name: "dirt",
    friction: 0.92,
    rollingResistance: 0.002,
    roughness: 0.12,
    dustKind: "dust",
    dustColors: ["#b6a98d", "#c9bda2", "#8c7659"],
    soundType: "soft",
  },
  rock: {
    name: "rock",
    friction: 1.05,
    rollingResistance: 0.001,
    roughness: 0.32,
    dustKind: "stone",
    dustColors: ["#dcd2be", "#a09c94", "#6e777a"],
    soundType: "hard",
  },
  gravel: {
    name: "gravel",
    friction: 0.78,
    rollingResistance: 0.004,
    roughness: 0.22,
    dustKind: "grit",
    dustColors: ["#b8b2a5", "#8c877d", "#484945"],
    soundType: "hard",
  },
  snow: {
    name: "snow",
    friction: 0.55,
    rollingResistance: 0.003,
    roughness: 0.10,
    dustKind: "snow",
    dustColors: ["#ffffff", "#eef4f8", "#d8e1e8"],
    soundType: "soft",
  },
  ice: {
    name: "ice",
    friction: 0.32,
    rollingResistance: 0.0005,
    roughness: 0.04,
    dustKind: "snow",
    dustColors: ["#ffffff", "#d0e4f2"],
    soundType: "soft",
  },
  wood: {
    name: "wood",
    friction: 0.95,
    rollingResistance: 0.0015,
    roughness: 0.14,
    dustKind: "wood",
    dustColors: ["#9c7c59", "#bca383", "#745839"],
    soundType: "hard",
  },
};

// ----------------------------------------------------------------------------
// Audio System (T0) - Layered Web Audio Synthesizer
// ----------------------------------------------------------------------------
class T0 {
  ctx = null;
  master = null;
  sfxBus = null;
  engineBus = null;
  osc = [];
  engineFilter = null;
  engineGain = null;
  noiseBuffer = null;
  windGain = null;
  windFilter = null;
  started = false;
  muted = false;

  start() {
    if (this.started) return;
    const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioCtx) return;
    this.started = true;
    const ctx = new AudioCtx();
    this.ctx = ctx;

    // Master bus
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    // SFX and Engine buses
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);

    this.engineBus = ctx.createGain();
    this.engineBus.gain.value = 0.55;
    this.engineBus.connect(this.master);

    // Multi-oscillator engine synthesis (Fundamental sawtooth, sub octave square, warm triangle harmonic)
    const oscTypes = ["sawtooth", "square", "triangle"];
    const detunes = [0, -1200, 700];
    const gains = [0.45, 0.25, 0.30];

    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 280;
    this.engineFilter.Q.value = 2.4;
    this.engineFilter.connect(this.engineBus);

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.04;
    this.engineGain.connect(this.engineFilter);

    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = oscTypes[i];
      osc.detune.value = detunes[i];
      const g = ctx.createGain();
      g.gain.value = gains[i];
      osc.connect(g);
      g.connect(this.engineGain);
      osc.start();
      this.osc.push(osc);
    }

    // Mountain wind ambient generator
    this.initWind();

    // Noise buffer for impact & tire slip
    const bufferSize = Math.floor(ctx.sampleRate * 1.5);
    this.noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const channel = this.noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      channel[i] = (last + 0.02 * white) / 1.02; // Pink noise approximation
      last = channel[i];
    }
  }

  initWind() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const windSize = Math.floor(ctx.sampleRate * 2);
    const windBuffer = ctx.createBuffer(1, windSize, ctx.sampleRate);
    const ch = windBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < windSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.05;
      b1 = 0.96 * b1 + white * 0.11;
      b2 = 0.86 * b2 + white * 0.25;
      ch[i] = (b0 + b1 + b2) * 0.2;
    }

    const windSrc = ctx.createBufferSource();
    windSrc.buffer = windBuffer;
    windSrc.loop = true;

    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.frequency.value = 320;
    this.windFilter.Q.value = 1.0;

    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.03;

    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    windSrc.start();
  }

  resume() {
    if (this.ctx?.state === "suspended") {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : 0.85;
    }
  }

  setEngine(rpm, load, airborne = false) {
    if (!this.ctx || !this.started || this.muted) return;
    const now = this.ctx.currentTime;
    const airMultiplier = airborne ? 1.25 : 1.0;
    const targetFreq = (46 + rpm * 190) * airMultiplier;

    for (const osc of this.osc) {
      osc.frequency.setTargetAtTime(targetFreq, now, 0.04);
    }

    const cutoff = 180 + rpm * 850 + load * 450 + (airborne ? 350 : 0);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);

    const gainVal = airborne ? 0.065 : 0.04 + load * 0.085 + rpm * 0.06;
    this.engineGain.gain.setTargetAtTime(gainVal, now, 0.05);
  }

  updateWind(speed, altitude) {
    if (!this.ctx || !this.windGain || this.muted) return;
    const now = this.ctx.currentTime;
    const speedNormalized = b(speed / 100, 0, 1);
    const altNormalized = b(altitude / 1000, 0, 1);
    const windLevel = 0.02 + speedNormalized * 0.08 + altNormalized * 0.05;
    this.windGain.gain.setTargetAtTime(windLevel, now, 0.1);
    this.windFilter.frequency.setTargetAtTime(260 + speedNormalized * 400, now, 0.1);
  }

  impact(intensity, materialKind = "dirt", isChassis = false) {
    if (!this.ctx || !this.started || this.muted || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vol = b(0.1 + intensity * 0.55, 0.1, 0.95);

    // Percussive body thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    const startFreq = isChassis ? 140 : 100;
    thump.frequency.setValueAtTime(startFreq, now);
    thump.frequency.exponentialRampToValueAtTime(32, now + 0.18);

    thumpGain.gain.setValueAtTime(vol * 0.8, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    thump.connect(thumpGain);
    thumpGain.connect(this.sfxBus);
    thump.start(now);
    thump.stop(now + 0.25);

    // Noise crack / crunch tailored to surface material
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();

    if (materialKind === "rock" || isChassis) {
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.value = 2.0;
    } else if (materialKind === "wood") {
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(680, now);
      filter.Q.value = 3.5;
    } else if (materialKind === "snow") {
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, now);
    } else {
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, now);
    }

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (isChassis ? 0.22 : 0.15));

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxBus);
    noise.start(now);
    noise.stop(now + 0.25);
  }

  skid(slip) {
    if (!this.ctx || !this.started || this.muted || !this.noiseBuffer || slip < 0.2) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vol = b((slip - 0.2) * 0.35, 0.02, 0.35);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200 + slip * 400, now);
    filter.Q.value = 1.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    noise.start(now);
    noise.stop(now + 0.1);
  }

  creak(deltaCompression) {
    if (!this.ctx || !this.started || this.muted || Math.abs(deltaCompression) < 0.4) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 850;
    filter.Q.value = 4.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  stuntChime(tier = 1) {
    if (!this.ctx || !this.started || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Pentatonic chord tones (C5, E5, G5, C6)
    const chord = [523.25, 659.25, 783.99, 1046.5];
    const notesToPlay = tier >= 3 ? 4 : tier >= 2 ? 3 : 2;

    for (let i = 0; i < notesToPlay; i++) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(chord[i], now + i * 0.045);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.045);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.045 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.5);
    }
  }

  dispose() {
    this.osc = [];
    this.ctx?.close();
    this.ctx = null;
    this.started = false;
  }
}

// ----------------------------------------------------------------------------
// Event Bus (Y0)
// ----------------------------------------------------------------------------
class Y0 {
  map = new Map();
  on(event, handler) {
    const set = this.map.get(event) ?? new Set();
    set.add(handler);
    this.map.set(event, set);
    return () => set.delete(handler);
  }
  emit(event, data) {
    const set = this.map.get(event);
    if (!set) return;
    for (const h of set) h(data);
  }
  clear() {
    this.map.clear();
  }
}

// ----------------------------------------------------------------------------
// Input System (M0)
// ----------------------------------------------------------------------------
class M0 {
  keys = new Set();
  touchLeft = false;
  touchRight = false;
  onReset = null;
  onDebug = null;
  onPause = null;

  handleDown = (e) => {
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) {
      e.preventDefault();
    }
    if (k === "r") this.onReset?.();
    if (e.key === "F3") {
      e.preventDefault();
      this.onDebug?.();
    }
    if (e.key === "Escape") {
      this.onPause?.();
    }
    this.keys.add(k);
  };

  handleUp = (e) => {
    this.keys.delete(e.key.toLowerCase());
  };

  attach() {
    window.addEventListener("keydown", this.handleDown);
    window.addEventListener("keyup", this.handleUp);
  }

  detach() {
    window.removeEventListener("keydown", this.handleDown);
    window.removeEventListener("keyup", this.handleUp);
    this.keys.clear();
  }

  pad(index) {
    const gamepads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : null;
    if (!gamepads) return 0;
    const gp = gamepads[0] ?? gamepads[1];
    if (!gp) return 0;
    const trigger = gp.buttons[index === 1 ? 7 : 6]?.value ?? 0;
    const stick = gp.axes[0] ?? 0;
    const stickVal = index === 1 ? Math.max(0, stick) : Math.max(0, -stick);
    const dpad = gp.buttons[index === 1 ? 15 : 14]?.value ?? 0;
    return Math.max(trigger, stickVal, dpad);
  }

  get throttle() {
    const key = this.keys.has("d") || this.keys.has("arrowright") || this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0;
    return Math.max(key, this.touchRight ? 1 : 0, this.pad(1));
  }

  get brake() {
    const key = this.keys.has("a") || this.keys.has("arrowleft") || this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0;
    return Math.max(key, this.touchLeft ? 1 : 0, this.pad(0));
  }
}

// ----------------------------------------------------------------------------
// Pooled Particle System (S0)
// ----------------------------------------------------------------------------
const MAX_PARTICLES = 650;

class S0 {
  pool = [];

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        rot: 0,
        spin: 0,
        drag: 0.98,
        gravity: 0,
        color: "#c9bda2",
        kind: "dust",
      });
    }
  }

  acquire() {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) return p;
    }
    return null;
  }

  clear() {
    for (const p of this.pool) p.active = false;
  }

  spawnWheelSpray(xPos, yPos, vx, vy, intensity, material = MATERIALS.dirt) {
    const count = Math.min(8, Math.round(intensity * 5 * xConfigVisual().dustDensity));
    const colors = material.dustColors;

    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      if (!p) break;
      p.active = true;
      p.x = xPos + (Math.random() - 0.5) * 8;
      p.y = yPos + (Math.random() - 0.5) * 4;
      p.vx = vx * 0.45 + (Math.random() - 0.5) * 2.5;
      p.vy = vy * 0.45 - Math.random() * 2.8 - 0.5;
      p.life = 0;
      p.maxLife = 220 + Math.random() * 260;
      p.size = 2.0 + Math.random() * 3.5 * intensity;
      p.rot = Math.random() * Math.PI * 2;
      p.spin = (Math.random() - 0.5) * 0.12;
      p.drag = 0.96;
      p.gravity = material.dustKind === "snow" ? 0.02 : 0.08;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.kind = material.dustKind;
    }
  }

  spawnLandingBurst(xPos, yPos, intensity, material = MATERIALS.dirt) {
    const count = Math.min(22, Math.round(intensity * 12 * xConfigVisual().dustDensity));
    const colors = material.dustColors;

    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      if (!p) break;
      p.active = true;
      p.x = xPos + (Math.random() - 0.5) * 24;
      p.y = yPos + (Math.random() - 0.5) * 6;
      const angle = (Math.random() > 0.5 ? 1 : -1) * (0.2 + Math.random() * 0.9);
      const spd = 2.0 + Math.random() * 5.5 * intensity;
      p.vx = Math.cos(angle) * spd;
      p.vy = -Math.abs(Math.sin(angle) * spd) - 1.2;
      p.life = 0;
      p.maxLife = 280 + Math.random() * 350;
      p.size = 2.5 + Math.random() * 4.5 * intensity;
      p.rot = Math.random() * Math.PI * 2;
      p.spin = (Math.random() - 0.5) * 0.18;
      p.drag = 0.95;
      p.gravity = 0.09;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.kind = material.dustKind;
    }
  }

  spawnSparks(xPos, yPos, nx, ny, count = 6) {
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      if (!p) break;
      p.active = true;
      p.x = xPos;
      p.y = yPos;
      const spread = (Math.random() - 0.5) * 1.6;
      const spd = 3.5 + Math.random() * 6.0;
      p.vx = (nx + spread) * spd;
      p.vy = (ny + spread) * spd - 2;
      p.life = 0;
      p.maxLife = 120 + Math.random() * 160;
      p.size = 1.5 + Math.random() * 1.5;
      p.rot = 0;
      p.spin = 0;
      p.drag = 0.97;
      p.gravity = 0.15;
      p.color = "#ff9a3c";
      p.kind = "spark";
    }
  }

  update(dt) {
    const factor = dt / 16.666;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.vx *= Math.pow(p.drag, factor);
      p.vy *= Math.pow(p.drag, factor);
      p.vy += p.gravity * factor;
      p.x += p.vx * factor;
      p.y += p.vy * factor;
      p.rot += p.spin * factor;
    }
  }
}

function xConfigVisual() {
  return x.visual;
}

// ----------------------------------------------------------------------------
// Dynamic Expedition Camera (X0)
// ----------------------------------------------------------------------------
class X0 {
  x = 0;
  y = 0;
  zoom = x.camera.baseZoom;
  targetZoom = x.camera.baseZoom;
  shakes = [];
  zoomPulse = 0;

  reset(xPos, yPos) {
    this.x = xPos;
    this.y = yPos;
    this.zoom = x.camera.baseZoom;
    this.targetZoom = x.camera.baseZoom;
    this.shakes.length = 0;
    this.zoomPulse = 0;
  }

  shake(intensity, duration, dirX = 0, dirY = 0) {
    if (!x.visual.screenShake || x.visual.reducedMotion) return;
    this.shakes.push({
      intensity,
      duration,
      elapsed: 0,
      dirX,
      dirY,
    });
    if (this.shakes.length > 6) this.shakes.shift();
  }

  pulseZoom(amount) {
    if (x.visual.reducedMotion) return;
    this.zoomPulse = Math.min(this.zoomPulse + amount, 0.08);
  }

  update(targetPos, targetVel, airborne, dt) {
    const camCfg = x.camera;
    const dtSeconds = dt / 1000;
    const speed = Math.hypot(targetVel.x, targetVel.y);

    const lookAheadX = b(targetVel.x * 10, -camCfg.lookAhead, camCfg.lookAhead);
    const airOffsetY = airborne ? targetVel.y * camCfg.airborneOffset * 7 : 0;

    const targetX = targetPos.x + lookAheadX;
    const targetY = targetPos.y + airOffsetY - 32;

    this.x = G0(this.x, targetX, camCfg.followSpeed * 65, dt);
    this.y = G0(this.y, targetY, camCfg.followSpeed * 65, dt);

    const speedZoomFactor = b(speed * 0.012, 0, 1) * camCfg.speedZoom;
    const airZoomFactor = airborne ? 0.04 : 0;
    this.targetZoom = camCfg.baseZoom - speedZoomFactor - airZoomFactor + this.zoomPulse;
    this.zoom = G0(this.zoom, this.targetZoom, 4.5, dt);

    this.zoomPulse = Math.max(0, this.zoomPulse - dtSeconds * 0.35);

    for (let i = this.shakes.length - 1; i >= 0; i--) {
      const s = this.shakes[i];
      s.elapsed += dt;
      if (s.elapsed >= s.duration) {
        this.shakes.splice(i, 1);
      }
    }
  }

  get shakeOffset() {
    let ox = 0, oy = 0;
    for (const s of this.shakes) {
      const progress = 1 - s.elapsed / s.duration;
      const mag = s.intensity * progress * progress * 32 * x.camera.shakeIntensity;
      const freq = s.elapsed * 0.06;
      ox += Math.sin(freq * 9.1) * mag * (0.6 + Math.abs(s.dirX));
      oy += Math.cos(freq * 7.3) * mag * (0.6 + Math.abs(s.dirY));
    }
    return { x: ox, y: oy };
  }
}

// ----------------------------------------------------------------------------
// Procedural Mountain Terrain & Grammar (P0)
// ----------------------------------------------------------------------------
class P0 {
  samples = [];
  bodies = [];
  seed;
  step = x.world.sampleStep;

  constructor(seed) {
    this.seed = seed;
    this.generateGrammarTerrain();
  }

  generateGrammarTerrain() {
    const seed = this.seed;
    const groundBase = x.world.groundBase; // 560
    const startX = x.world.startX; // 220
    const totalLength = x.world.length; // 36000

    const nRegional = K0(seed);
    const nSwell = K0(seed + 23);
    const nFeature = K0(seed + 67);
    const nDetail = K0(seed + 131);

    // Initial flat starting apron (-2500 to 550)
    for (let q = -2500; q < startX + 350; q += this.step) {
      this.samples.push({
        x: q,
        y: groundBase,
        material: "grass",
        biomeId: "meadow",
      });
    }

    // Mountain expedition trail from startX + 350 to totalLength
    for (let q = startX + 350; q <= totalLength; q += this.step) {
      const distFromStart = Math.max(0, (q - startX) / 40); // meters
      const biome = this.getBiomeAtDist(distFromStart);
      const difficulty = b(distFromStart / 900, 0, 1); // 0 to 1 normalized difficulty

      // 1. Regional Mountain Ascent: gentle climb of ~160px from base camp to summit
      const progress = Math.min(1, distFromStart / 900);
      const mountainRise = progress * 160.0;

      // 2. Broad Geographic Swells (valleys, plateaus, mountain ridges)
      const swell = nRegional(q / 1600.0) * (60.0 + difficulty * 45.0);

      // 3. Structured Segment Rhythms (rollers, climbs, launches, bowls)
      // Wave pacing creates natural difficulty waves (easy, build, jump, recover)
      const pacing = Math.sin(q / 550.0) * 0.5 + 0.5;
      let featureAmp = 25.0 + difficulty * 35.0;

      // Kicker launch ramp & landing zone pacing
      let featureOffset = 0;
      if (pacing > 0.72) {
        // Jump kicker section: ramp up then downward landing slope
        const jumpPhase = (q % 550.0) / 550.0;
        if (jumpPhase < 0.35) {
          // Kicker ramp
          featureOffset = -Math.sin(jumpPhase / 0.35 * Math.PI * 0.5) * (35.0 + difficulty * 25.0);
        } else if (jumpPhase < 0.50) {
          // Air gap depression
          featureOffset = 15.0;
        } else {
          // Landing slope catcher (downhill gradient to catch ballistic flight)
          const catchU = (jumpPhase - 0.50) / 0.50;
          featureOffset = Math.sin(catchU * Math.PI) * (20.0 + difficulty * 15.0);
        }
      } else if (pacing < 0.30) {
        // Recovery plateau / gentle rollers
        featureOffset = nFeature(q / 380.0) * 16.0;
      } else {
        // Rhythm rollers & camelbacks
        featureOffset = nFeature(q / 280.0) * featureAmp + Math.sin(q / 140.0) * 12.0;
      }

      // 4. Fine Organic Terrain Texture
      const fine = nDetail(q / 75.0) * 8.0;

      // Compute final composite height
      let y = groundBase - mountainRise - swell + featureOffset - fine;

      // Safety Validation: clamp slope derivative so wheels never hit a vertical cliff
      const prev = this.samples[this.samples.length - 1];
      const dx = q - prev.x;
      const dy = y - prev.y;
      const maxDy = dx * Math.tan(0.95); // max ~54 degrees
      if (Math.abs(dy) > maxDy) {
        y = prev.y + Math.sign(dy) * maxDy;
      }

      // Material assignment based on biome, slope, and local features
      let material = biome.defaultMaterial;
      const localSlope = Math.abs((y - prev.y) / dx);
      if (localSlope > 0.60 && biome.id !== "summit") {
        material = "rock"; // Exposed rock on steep slopes
      } else if (biome.id === "canyon" && pacing > 0.85) {
        material = "wood"; // Trestle bridge crossing
      }

      this.samples.push({
        x: q,
        y: y,
        material: material,
        biomeId: biome.id,
      });
    }

    // Build Matter.js static segment physics bodies
    for (let i = 0; i < this.samples.length - 1; i++) {
      const p1 = this.samples[i];
      const p2 = this.samples[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const mat = MATERIALS[p1.material] ?? MATERIALS.dirt;

      const body = x0.default.Bodies.rectangle(
        (p1.x + p2.x) / 2,
        (p1.y + p2.y) / 2 + 10,
        len + 2,
        22,
        {
          isStatic: true,
          angle: angle,
          friction: mat.friction,
          frictionStatic: mat.friction * 1.35,
          restitution: 0.02,
          label: "terrain",
          chamfer: { radius: 2 },
        }
      );
      body.materialKind = p1.material;
      this.bodies.push(body);
    }
  }

  getBiomeAtDist(distMeters) {
    for (const b of BIOMES) {
      if (distMeters >= b.minDist && distMeters < b.maxDist) {
        return b;
      }
    }
    return BIOMES[BIOMES.length - 1];
  }

  heightAt(xPos) {
    const firstX = this.samples[0].x;
    const idx = Math.floor((xPos - firstX) / this.step);
    const clampedIdx = Math.max(0, Math.min(this.samples.length - 2, idx));
    const p1 = this.samples[clampedIdx];
    const p2 = this.samples[clampedIdx + 1];
    if (!p1 || !p2 || p1 === p2) return p1 ? p1.y : x.world.groundBase;
    const u = (xPos - p1.x) / (p2.x - p1.x);
    return p1.y + (p2.y - p1.y) * u;
  }

  slopeAt(xPos) {
    return Math.atan2(this.heightAt(xPos + 12) - this.heightAt(xPos - 12), 24);
  }

  normalAt(xPos) {
    const slope = this.slopeAt(xPos);
    return {
      x: -Math.sin(slope),
      y: -Math.cos(slope),
    };
  }

  materialAt(xPos) {
    const firstX = this.samples[0].x;
    const idx = Math.floor((xPos - firstX) / this.step);
    const sample = this.samples[Math.max(0, Math.min(this.samples.length - 1, idx))];
    return sample ? MATERIALS[sample.material] ?? MATERIALS.dirt : MATERIALS.dirt;
  }

  biomeAt(xPos) {
    const distMeters = Math.max(0, (xPos - x.world.startX) / 40);
    return this.getBiomeAtDist(distMeters);
  }
}

// ----------------------------------------------------------------------------
// Articulated Procedural Driver
// ----------------------------------------------------------------------------
class Driver {
  lean = 0;
  targetLean = 0;
  leanVel = 0;
  jolt = 0;
  joltVel = 0;
  helmetAngle = 0;
  victory = 0;

  update(vehicle, input, dt) {
    const dtSec = dt / 1000;
    const accel = vehicle.forwardSpeed - (vehicle.lastForwardSpeed ?? vehicle.forwardSpeed);
    vehicle.lastForwardSpeed = vehicle.forwardSpeed;

    const throttleLean = -input.throttle * 0.22;
    const brakeLean = input.brake * 0.26;
    const accelLean = -b(accel * 0.35, -0.3, 0.3);
    const slopeLean = -b(vehicle.chassis.angle * 0.25, -0.25, 0.25);
    const airLean = vehicle.airborne ? -0.15 : 0;

    this.targetLean = throttleLean + brakeLean + accelLean + slopeLean + airLean;

    const springK = 18.0;
    const damping = 0.72;
    const force = (this.targetLean - this.lean) * springK;
    this.leanVel = (this.leanVel + force * dtSec) * Math.pow(damping, dtSec * 60);
    this.lean += this.leanVel * dtSec;
    this.lean = b(this.lean, -0.42, 0.42);

    const joltForce = -this.jolt * 26.0;
    this.joltVel = (this.joltVel + joltForce * dtSec) * Math.pow(0.65, dtSec * 60);
    this.jolt += this.joltVel * dtSec;

    const targetHelmet = this.lean * 0.7 + vehicle.chassis.angularVelocity * 0.4;
    this.helmetAngle = G0(this.helmetAngle, targetHelmet, 12, dt);

    this.victory = Math.max(0, this.victory - dtSec * 0.5);
  }

  applyShock(energy) {
    this.jolt += b(energy * 3.5, 0.8, 4.5);
    this.lean += (Math.random() - 0.5) * 0.25;
  }

  triggerVictory() {
    this.victory = 1.0;
  }
}

// ----------------------------------------------------------------------------
// Expedition Vehicle (f0)
// ----------------------------------------------------------------------------
class f0 {
  chassis;
  wheels = [];
  constraints = [];
  composite;
  driver = new Driver();

  constructor(xPos, yPos) {
    const vCfg = x.vehicle;

    this.chassis = d.default.Bodies.rectangle(
      xPos,
      yPos,
      vCfg.chassisWidth,
      vCfg.chassisHeight,
      {
        label: "chassis",
        collisionFilter: { group: -3 },
        density: vCfg.chassisMass / (vCfg.chassisWidth * vCfg.chassisHeight),
        friction: 0.4,
        frictionAir: 0.005,
        restitution: 0.04,
        chamfer: { radius: 8 },
      }
    );

    

    const wheelOffsets = [
      { x: -vCfg.wheelBase / 2, y: vCfg.wheelOffsetY }, // Rear wheel
      { x: vCfg.wheelBase / 2, y: vCfg.wheelOffsetY },  // Front wheel
    ];

    for (let i = 0; i < wheelOffsets.length; i++) {
      const off = wheelOffsets[i];
      const wheel = d.default.Bodies.circle(
        xPos + off.x,
        yPos + off.y,
        vCfg.wheelRadius,
        {
          label: "wheel",
          collisionFilter: { group: -3 },
          density: vCfg.wheelMass / (Math.PI * vCfg.wheelRadius * vCfg.wheelRadius),
          friction: vCfg.tireGrip,
          frictionStatic: vCfg.tireGrip * 1.35,
          frictionAir: 0.0035,
          restitution: 0.10,
          slop: 0.02,
        }
      );

      const armSpread = 18;
      const restLen = Math.hypot(armSpread, vCfg.wheelOffsetY - 2);
      const makeLink = (spreadX) =>
        d.default.Constraint.create({
          bodyA: this.chassis,
          pointA: { x: off.x + spreadX, y: 2 },
          bodyB: wheel,
          length: restLen,
          stiffness: vCfg.suspensionStiffness,
          damping: vCfg.suspensionDamping,
        });

      const linkA = makeLink(armSpread);
      const linkB = makeLink(-armSpread);
      this.constraints.push(linkA, linkB);

      this.wheels.push({
        body: wheel,
        restOffset: off,
        compression: 0,
        contact: false,
        slip: 0,
        material: "grass",
      });
    }

    this.composite = d.default.Composite.create({ label: "vehicle" });
    d.default.Composite.add(this.composite, [
      this.chassis,
      ...this.wheels.map((w) => w.body),
      ...this.constraints,
    ]);
  }

  get speed() {
    return d.default.Vector.magnitude(this.chassis.velocity);
  }

  get forwardSpeed() {
    const dir = {
      x: Math.cos(this.chassis.angle),
      y: Math.sin(this.chassis.angle),
    };
    return d.default.Vector.dot(dir, this.chassis.velocity);
  }

  get rpm() {
    const maxSpin = Math.max(...this.wheels.map((w) => Math.abs(w.body.angularVelocity)));
    return b(maxSpin / x.vehicle.maxWheelSpeed, 0, 1.4);
  }

  get airborne() {
    return !this.wheels.some((w) => w.contact);
  }

  update(input, dt) {
    const vCfg = x.vehicle;
    const throttleBrake = input.throttle - input.brake;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const isRear = i === 0;
      const torqueShare = isRear ? 0.70 : 0.30;
      const spin = w.body.angularVelocity;
      const speedRatio = b(1 - Math.abs(spin) / vCfg.maxWheelSpeed, 0, 1);

      if (throttleBrake !== 0) {
        const isDriving = Math.sign(throttleBrake) === Math.sign(spin) || Math.abs(spin) < 0.03;
        const torque = isDriving
          ? vCfg.engineTorque * speedRatio * throttleBrake
          : vCfg.brakeTorque * throttleBrake;

        w.body.torque += torque * torqueShare * w.body.mass * 13;

        // Tire longitudinal traction force directly communicating vehicle mass & grip
        if (w.contact) {
          const mat = MATERIALS[w.material] ?? MATERIALS.dirt;
          const forwardDir = {
            x: Math.cos(this.chassis.angle),
            y: Math.sin(this.chassis.angle),
          };
          const gripImpulse = torque * torqueShare * mat.friction * 0.12;
          Matter.Body.applyForce(w.body, w.body.position, {
            x: forwardDir.x * gripImpulse,
            y: forwardDir.y * gripImpulse,
          });
        }
      } else {
        d.default.Body.setAngularVelocity(w.body, spin * 0.994);
      }

      // Compression calculation
      const mountWorld = d.default.Vector.add(
        this.chassis.position,
        d.default.Vector.rotate(
          { x: w.restOffset.x, y: 2 },
          this.chassis.angle
        )
      );
      const curDist = d.default.Vector.magnitude(
        d.default.Vector.sub(w.body.position, mountWorld)
      );
      w.compression = b(
        (vCfg.wheelOffsetY - curDist) / vCfg.suspensionTravel,
        -1,
        1
      );



      w.slip = Math.abs(spin * vCfg.wheelRadius - this.forwardSpeed);
    }

    // Mid-air pitch rotation authority: throttle leans back, brake leans forward
    if (this.airborne && throttleBrake !== 0) {
      const angVel = this.chassis.angularVelocity;
      const spinLimit = b(1 - Math.abs(angVel) / 0.35, 0, 1);
      const opposing = Math.sign(throttleBrake) !== Math.sign(angVel) ? 1.0 : spinLimit;
      this.chassis.torque += throttleBrake * vCfg.airControl * opposing * this.chassis.mass * 62;
    }

    const damping = this.airborne ? vCfg.angularDamping : vCfg.angularDamping * 5.5;
    const factor = 1 - Math.min(damping * (dt / 16.666), 0.5);
    d.default.Body.setAngularVelocity(this.chassis, this.chassis.angularVelocity * factor);

    this.driver.update(this, input, dt);
  }

  markContacts(terrainSet, activePairs) {
    for (const w of this.wheels) w.contact = false;
    for (const pair of activePairs) {
      const { bodyA, bodyB } = pair;
      const w = this.wheels.find((wheel) => wheel.body === bodyA || wheel.body === bodyB);
      if (!w) continue;
      const other = bodyA === w.body ? bodyB : bodyA;
      if (terrainSet.has(other)) {
        w.contact = true;
        w.material = other.materialKind ?? "grass";
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Stunt Director & Combo System
// ----------------------------------------------------------------------------
class StuntDirector {
  bus;
  audio;
  camera;
  airtime = 0;
  airDistance = 0;
  airApexY = Infinity;
  launchX = 0;
  launchY = 0;
  launchAngle = 0;
  cumulativeAngle = 0;
  prevAngle = 0;
  backflips = 0;
  frontflips = 0;
  wheelieTime = 0;
  stoppieTime = 0;
  comboMultiplier = 1;
  comboScore = 0;
  comboTimer = 0;
  activeStuntName = "";
  activeStuntScore = 0;

  constructor(bus, audio, camera) {
    this.bus = bus;
    this.audio = audio;
    this.camera = camera;
  }

  reset() {
    this.airtime = 0;
    this.airDistance = 0;
    this.airApexY = Infinity;
    this.cumulativeAngle = 0;
    this.backflips = 0;
    this.frontflips = 0;
    this.wheelieTime = 0;
    this.stoppieTime = 0;
    this.comboMultiplier = 1;
    this.comboScore = 0;
    this.comboTimer = 0;
    this.activeStuntName = "";
  }

  update(vehicle, terrain, dt) {
    const isAirborne = vehicle.airborne;
    const chassis = vehicle.chassis;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt / 1000;
      if (this.comboTimer <= 0) {
        this.endCombo();
      }
    }

    if (isAirborne) {
      if (this.airtime === 0) {
        this.launchX = chassis.position.x;
        this.launchY = chassis.position.y;
        this.launchAngle = chassis.angle;
        this.prevAngle = chassis.angle;
        this.airApexY = chassis.position.y;
        this.cumulativeAngle = 0;
        this.backflips = 0;
        this.frontflips = 0;
      }

      this.airtime += dt;
      this.airDistance = Math.abs(chassis.position.x - this.launchX) / 40;
      this.airApexY = Math.min(this.airApexY, chassis.position.y);

      let deltaAngle = chassis.angle - this.prevAngle;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      this.cumulativeAngle += deltaAngle;
      this.prevAngle = chassis.angle;

      if (this.cumulativeAngle <= -(Math.PI * 2 * (this.backflips + 1) - 0.4)) {
        this.backflips++;
        const name = this.backflips > 1 ? `DOUBLE BACKFLIP` : `BACKFLIP`;
        const score = this.backflips > 1 ? 450 : 250;
        this.awardStunt(name, score, 2);
        vehicle.driver.triggerVictory();
      } else if (this.cumulativeAngle >= Math.PI * 2 * (this.frontflips + 1) - 0.4) {
        this.frontflips++;
        const name = this.frontflips > 1 ? `DOUBLE FRONTFLIP` : `FRONTFLIP`;
        const score = this.frontflips > 1 ? 550 : 300;
        this.awardStunt(name, score, 2);
        vehicle.driver.triggerVictory();
      }
    } else {
      this.checkGroundStunts(vehicle, terrain, dt);
    }
  }

  checkGroundStunts(vehicle, terrain, dt) {
    const rear = vehicle.wheels[0];
    const front = vehicle.wheels[1];
    const slope = terrain.slopeAt(vehicle.chassis.position.x);
    const relAngle = vehicle.chassis.angle - slope;

    if (rear.contact && !front.contact && relAngle < -0.26 && vehicle.forwardSpeed > 3.0) {
      this.wheelieTime += dt;
      if (this.wheelieTime > 450 && this.wheelieTime - dt <= 450) {
        this.awardStunt("WHEELIE", 120, 1);
      }
    } else {
      this.wheelieTime = 0;
    }

    if (front.contact && !rear.contact && relAngle > 0.26 && vehicle.forwardSpeed > 2.5) {
      this.stoppieTime += dt;
      if (this.stoppieTime > 450 && this.stoppieTime - dt <= 450) {
        this.awardStunt("STOPPIE", 150, 1);
      }
    } else {
      this.stoppieTime = 0;
    }
  }

  onLanding(vehicle, terrain) {
    if (this.airtime < 220) {
      this.airtime = 0;
      return;
    }

    const chassis = vehicle.chassis;
    const slope = terrain.slopeAt(chassis.position.x);
    const angleDiff = Math.abs(normalizeAngle(chassis.angle - slope));
    const vertSpeed = Math.abs(chassis.velocity.y);

    const apexHeight = (this.launchY - this.airApexY);
    if (this.airtime > 750 || apexHeight > 70) {
      this.awardStunt("BIG AIR", 180, 1);
    }
    if (this.airDistance > 28) {
      this.awardStunt("LONG JUMP", 200, 1);
    }

    if (angleDiff < 0.18 && vertSpeed < 14) {
      this.comboMultiplier = Math.min(this.comboMultiplier + 1, 8);
      this.awardStunt("PERFECT LANDING", 160 * this.comboMultiplier, 3);
      this.camera.pulseZoom(0.04);
      this.audio.stuntChime(3);
    } else if (angleDiff < 0.40) {
      this.awardStunt("CLEAN LANDING", 60, 1);
      this.camera.pulseZoom(0.015);
    } else if (angleDiff >= 0.70 || vertSpeed > 22) {
      this.breakCombo();
      this.camera.shake(0.28, 220);
    }

    this.airtime = 0;
  }

  awardStunt(name, score, tier = 1) {
    this.comboScore += score;
    this.comboTimer = 3.8;
    this.activeStuntName = name;
    this.activeStuntScore = score;
    this.audio.stuntChime(tier);

    this.bus.emit("stunt:awarded", {
      name: name,
      score: score,
      multiplier: this.comboMultiplier,
      totalComboScore: this.comboScore,
    });
  }

  endCombo() {
    if (this.comboScore > 0) {
      const finalScore = this.comboScore * this.comboMultiplier;
      this.bus.emit("stunt:combo_complete", {
        score: finalScore,
        multiplier: this.comboMultiplier,
      });
    }
    this.comboMultiplier = 1;
    this.comboScore = 0;
    this.comboTimer = 0;
    this.activeStuntName = "";
  }

  breakCombo() {
    this.comboMultiplier = 1;
    this.comboScore = 0;
    this.comboTimer = 0;
    this.activeStuntName = "";
    this.bus.emit("stunt:combo_broken", {});
  }
}

// ----------------------------------------------------------------------------
// Illustrated Mountain Expeditions Renderer (R0)
// ----------------------------------------------------------------------------
class R0 {
  ctx;
  terrain;
  grainNoise = K0(7);
  grainCanvas = null;

  constructor(ctx, terrain) {
    this.ctx = ctx;
    this.terrain = terrain;
  }

  setTerrain(t) {
    this.terrain = t;
  }

  render(camera, vehicle, particles, width, height, time, debug, allBodies = []) {
    const ctx = this.ctx;
    const biome = this.terrain.biomeAt(camera.x);

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    this.drawSky(width, height, camera, biome);

    const shake = camera.shakeOffset;
    ctx.translate(width / 2 + shake.x, height / 2 + shake.y);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    this.drawParallax(camera, width, height, time, biome);
    this.drawTerrain(camera, width, height, biome);
    this.drawParticles(particles, ["dust", "snow", "grass", "wood"]);
    this.drawVehicle(vehicle, biome);
    this.drawParticles(particles, ["spark", "grit", "stone"]);

    if (debug) {
      this.drawDebug(allBodies, vehicle, camera);
    }

    ctx.restore();

    this.drawGrain(width, height);
    this.drawVignette(width, height);
  }

  drawSky(w, h, cam, biome) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, biome.skyTop);
    grad.addColorStop(1, biome.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = biome.sun;
    const sunX = w * 0.72 - (cam.x * 0.008) % w;
    ctx.beginPath();
    ctx.arc(sunX, h * 0.22, 85, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = biome.fogColor;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);
    ctx.restore();
  }

  drawParallax(cam, w, h, time, biome) {
    const ctx = this.ctx;
    const layers = [
      { depth: 0.10, color: biome.far, amp: 130, base: 260, freq: 0.0014, wob: 5 },
      { depth: 0.26, color: biome.mid, amp: 160, base: 350, freq: 0.0022, wob: 4 },
      { depth: 0.50, color: biome.near, amp: 140, base: 440, freq: 0.0030, wob: 3 },
    ];

    const left = cam.x - w / cam.zoom;
    const right = cam.x + w / cam.zoom;

    layers.forEach((layer, idx) => {
      const noise = K0(31 + idx * 17);
      ctx.beginPath();
      ctx.moveTo(left, 3500);

      for (let z = left; z <= right; z += 16) {
        const parX = (z - cam.x) * layer.depth + cam.x;
        const parY =
          x.world.groundBase -
          layer.base -
          noise(parX * layer.freq) * layer.amp -
          noise(parX * layer.freq * 3.8) * layer.wob * 4;
        ctx.lineTo(z, parY);
      }

      ctx.lineTo(right, 3500);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();
    });
  }

  drawTerrain(cam, w, h, biome) {
    const ctx = this.ctx;
    const terrain = this.terrain;
    const left = cam.x - w / cam.zoom / 2 - 140;
    const right = cam.x + w / cam.zoom / 2 + 140;

    const visibleSamples = [];
    for (const s of terrain.samples) {
      if (s.x >= left && s.x <= right) {
        visibleSamples.push(s);
      }
    }
    if (visibleSamples.length < 2) return;

    // Subterranean Fill
    ctx.beginPath();
    ctx.moveTo(visibleSamples[0].x, visibleSamples[0].y);
    for (const s of visibleSamples) {
      const wobble = this.grainNoise(s.x * 0.09) * 1.5;
      ctx.lineTo(s.x, s.y + wobble);
    }
    ctx.lineTo(visibleSamples[visibleSamples.length - 1].x, 4000);
    ctx.lineTo(visibleSamples[0].x, 4000);
    ctx.closePath();
    ctx.fillStyle = biome.groundFill;
    ctx.fill();

    // Topsoil Layer with Biome Palette
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(visibleSamples[0].x, visibleSamples[0].y);
    for (const s of visibleSamples) ctx.lineTo(s.x, s.y + 1);
    for (let i = visibleSamples.length - 1; i >= 0; i--) {
      ctx.lineTo(visibleSamples[i].x, visibleSamples[i].y + 20);
    }
    ctx.closePath();
    ctx.fillStyle = biome.groundTop;
    ctx.fill();

    ctx.strokeStyle = "rgba(239,231,214,0.06)";
    ctx.lineWidth = 1;
    for (let gx = Math.floor(left / 28) * 28; gx < right; gx += 28) {
      const gy = terrain.heightAt(gx);
      ctx.beginPath();
      ctx.moveTo(gx, gy + 24);
      ctx.lineTo(gx - 20, gy + 90 + this.grainNoise(gx * 0.03) * 18);
      ctx.stroke();
    }
    ctx.restore();

    // Hand-inked Master Contour Line
    ctx.beginPath();
    ctx.moveTo(visibleSamples[0].x, visibleSamples[0].y);
    for (const s of visibleSamples) {
      const wobble = this.grainNoise(s.x * 0.09) * 1.5;
      ctx.lineTo(s.x, s.y + wobble);
    }
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.stroke();

    this.drawTerrainDetails(terrain, left, right, biome);
    this.drawLandmarks(cam, left, right);
  }

  drawTerrainDetails(terrain, left, right, biome) {
    const ctx = this.ctx;
    const step = 60;
    const startX = Math.floor(left / step) * step;

    for (let gx = startX; gx < right; gx += step) {
      const n = this.grainNoise(gx * 0.22);
      if (n < 0.25) continue;
      const gy = terrain.heightAt(gx);
      const slope = terrain.slopeAt(gx);

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(slope);

      if (biome.id === "meadow") {
        ctx.strokeStyle = "rgba(27,31,29,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(n * 4, -7 - n * 8);
        ctx.moveTo(0, 0);
        ctx.lineTo(-3 - n * 3, -5 - n * 6);
        ctx.stroke();
      } else if (biome.id === "ridge" || biome.id === "industrial") {
        ctx.fillStyle = "rgba(27,31,29,0.7)";
        ctx.fillRect(-2, -3, 3 + n * 4, 2 + n * 2);
      } else if (biome.id === "summit") {
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.ellipse(0, -1, 5 + n * 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawLandmarks(cam, left, right) {
    const ctx = this.ctx;
    for (const b of BIOMES) {
      const lm = b.landmark;
      if (!lm || lm.x < left - 60 || lm.x > right + 60) continue;
      const ly = this.terrain.heightAt(lm.x);

      ctx.save();
      ctx.translate(lm.x, ly);

      if (lm.type === "shelter") {
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -48);
        ctx.stroke();

        ctx.fillStyle = "#efe7d6";
        ctx.fillRect(-18, -46, 36, 16);
        ctx.strokeRect(-18, -46, 36, 16);

        ctx.fillStyle = "#d4622a";
        ctx.beginPath();
        ctx.arc(0, -56, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (lm.type === "cairn") {
        ctx.fillStyle = "#565e61";
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, -6, 9, 0, Math.PI * 2);
        ctx.arc(1, -18, 7, 0, Math.PI * 2);
        ctx.arc(-1, -28, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (lm.type === "trestle") {
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-12, 80);
        ctx.moveTo(12, 0);
        ctx.lineTo(12, 80);
        ctx.moveTo(-12, 25);
        ctx.lineTo(12, 55);
        ctx.moveTo(12, 25);
        ctx.lineTo(-12, 55);
        ctx.stroke();
      } else if (lm.type === "pithead") {
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(-24, 0);
        ctx.lineTo(0, -75);
        ctx.lineTo(24, 0);
        ctx.moveTo(-12, -38);
        ctx.lineTo(12, -38);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -75, 12, 0, Math.PI * 2);
        ctx.stroke();
      } else if (lm.type === "beacon") {
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -90);
        ctx.moveTo(-8, -40);
        ctx.lineTo(8, -40);
        ctx.moveTo(-12, -65);
        ctx.lineTo(12, -65);
        ctx.stroke();

        ctx.fillStyle = "#d4622a";
        ctx.beginPath();
        ctx.arc(0, -92, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  drawVehicle(vehicle, biome) {
    const ctx = this.ctx;
    const chassis = vehicle.chassis;
    const vCfg = x.vehicle;

    ctx.save();
    ctx.translate(chassis.position.x, chassis.position.y);
    ctx.rotate(chassis.angle);

    const w = vCfg.chassisWidth;
    const h = vCfg.chassisHeight;

    // Chassis Body Polygon
    ctx.fillStyle = "#c8bda6";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2 + 4);
    ctx.lineTo(-w / 2 + 12, -h / 2 - 10);
    ctx.lineTo(w / 2 - 26, -h / 2 - 10);
    ctx.lineTo(w / 2 - 8, -h / 2 + 2);
    ctx.lineTo(w / 2, h / 2 - 6);
    ctx.lineTo(-w / 2 + 4, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit
    ctx.fillStyle = "#3d4642";
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 14, -h / 2 - 8);
    ctx.lineTo(-w / 2 + 40, -h / 2 - 26);
    ctx.lineTo(-w / 2 + 58, -h / 2 - 26);
    ctx.lineTo(-w / 2 + 58, -h / 2 - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Articulated Driver
    this.drawArticulatedDriver(vehicle.driver);

    // Roll cage bar
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 18, -h / 2 - 8);
    ctx.lineTo(-w / 2 + 16, -h / 2 - 28);
    ctx.lineTo(-w / 2 + 42, -h / 2 - 28);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Radiator orange accent block
    ctx.fillStyle = "#d4622a";
    ctx.fillRect(w / 2 - 22, -h / 2 - 6, 14, 8);
    ctx.strokeRect(w / 2 - 22, -h / 2 - 6, 14, 8);

    // Rivets
    ctx.fillStyle = "#1b1f1d";
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(-w / 2 + 10 + i * 16, h / 2 - 7, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Suspension Springs
    for (const wItem of vehicle.wheels) {
      const mountX =
        chassis.position.x +
        Math.cos(chassis.angle) * wItem.restOffset.x -
        Math.sin(chassis.angle) * 4;
      const mountY =
        chassis.position.y +
        Math.sin(chassis.angle) * wItem.restOffset.x +
        Math.cos(chassis.angle) * 4;

      const dx = wItem.body.position.x - mountX;
      const dy = wItem.body.position.y - mountY;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      ctx.save();
      ctx.translate(mountX, mountY);
      ctx.rotate(angle);

      const rodStart = dist * 0.18;
      ctx.strokeStyle = "#1b1f1d";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(rodStart, 0);
      ctx.lineTo(dist, 0);
      ctx.stroke();

      const coils = 6;
      const steps = coils * 8;
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#d4622a";
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const sx = rodStart + u * (dist - rodStart);
        const sy = Math.sin(u * coils * Math.PI * 2) * 6;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Wheels
    for (const wItem of vehicle.wheels) {
      ctx.save();
      ctx.translate(wItem.body.position.x, wItem.body.position.y);
      ctx.rotate(wItem.body.angle);

      ctx.fillStyle = "#24282a";
      ctx.beginPath();
      ctx.arc(0, 0, vCfg.wheelRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1b1f1d";
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.fillStyle = "#d9cfb8";
      ctx.beginPath();
      ctx.arc(0, 0, vCfg.wheelRadius * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1b1f1d";
      ctx.lineWidth = 1.6;
      ctx.stroke();

      for (let s = 0; s < 5; s++) {
        const a = (s / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(a) * vCfg.wheelRadius * 0.46,
          Math.sin(a) * vCfg.wheelRadius * 0.46
        );
        ctx.lineTo(
          Math.cos(a) * vCfg.wheelRadius * 0.92,
          Math.sin(a) * vCfg.wheelRadius * 0.92
        );
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(239,231,214,0.38)";
      ctx.lineWidth = 2.0;
      for (let t = 0; t < 10; t++) {
        const a = (t / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(a) * (vCfg.wheelRadius - 5),
          Math.sin(a) * (vCfg.wheelRadius - 5)
        );
        ctx.lineTo(
          Math.cos(a) * vCfg.wheelRadius,
          Math.sin(a) * vCfg.wheelRadius
        );
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  drawArticulatedDriver(driver) {
    const ctx = this.ctx;
    const hipX = -12;
    const hipY = -6 + driver.jolt;

    const spineAngle = driver.lean * 0.8;
    const torsoLen = 18;
    const shoulderX = hipX + Math.sin(spineAngle) * torsoLen;
    const shoulderY = hipY - Math.cos(spineAngle) * torsoLen;

    const headX = shoulderX + Math.sin(spineAngle) * 9;
    const headY = shoulderY - Math.cos(spineAngle) * 9;

    const wheelHubX = 14;
    const wheelHubY = -14;

    const handX = wheelHubX;
    const handY = driver.victory > 0.1 ? wheelHubY - 24 : wheelHubY - 2;

    const footX = 16;
    const footY = 4;

    ctx.save();
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 6.0;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#c46b38";
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    ctx.lineWidth = 2.0;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    const legIK = this.solve2BoneIK(hipX, hipY, footX, footY, 14, 14, 1);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = "#3d4642";
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(legIK.x, legIK.y);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    const armIK = this.solve2BoneIK(shoulderX, shoulderY, handX, handY, 12, 12, -1);
    ctx.lineWidth = 4.0;
    ctx.strokeStyle = "#c46b38";
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(armIK.x, armIK.y);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(wheelHubX, wheelHubY, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(driver.helmetAngle);

    ctx.fillStyle = "#efe7d6";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#d4622a";
    ctx.fillRect(-2.5, -7.5, 5, 15);

    ctx.fillStyle = "#1b1f1d";
    ctx.beginPath();
    ctx.ellipse(3, 0, 3.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

  solve2BoneIK(p1x, p1y, p2x, p2y, l1, l2, flip = 1) {
    const dx = p2x - p1x;
    const dy = p2y - p1y;
    const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
    const baseAngle = Math.atan2(dy, dx);
    const cosAngle = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const alpha = Math.acos(b(cosAngle, -1, 1));
    const jointAngle = baseAngle + alpha * flip;

    return {
      x: p1x + Math.cos(jointAngle) * l1,
      y: p1y + Math.sin(jointAngle) * l1,
    };
  }

  drawParticles(particleSystem, kinds) {
    const ctx = this.ctx;
    const kindSet = new Set(kinds);

    for (const p of particleSystem.pool) {
      if (!p.active || !kindSet.has(p.kind)) continue;
      const progress = p.life / p.maxLife;
      const alpha = (1 - progress) * (p.kind === "spark" ? 0.95 : 0.65);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      if (p.kind === "spark") {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size * 1.5, p.size);
      } else if (p.kind === "snow") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "grass") {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size, p.size * 0.6, p.size * 1.8);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  drawDebug(bodies, vehicle, camera) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(212,98,42,0.85)";
    ctx.lineWidth = 1;

    for (const b of bodies) {
      const verts = b.vertices;
      if (!verts || verts.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (const v of verts) ctx.lineTo(v.x, v.y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.strokeStyle = "#2ea3a5";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(vehicle.chassis.position.x, vehicle.chassis.position.y);
    ctx.lineTo(
      vehicle.chassis.position.x + vehicle.chassis.velocity.x * 12,
      vehicle.chassis.position.y + vehicle.chassis.velocity.y * 12
    );
    ctx.stroke();

    ctx.fillStyle = "#d4622a";
    ctx.beginPath();
    ctx.arc(vehicle.chassis.position.x, vehicle.chassis.position.y, 4, 0, Math.PI * 2);
    ctx.fill();

    for (const w of vehicle.wheels) {
      ctx.fillStyle = w.contact ? "#2ea3a5" : "rgba(27,31,29,0.3)";
      ctx.beginPath();
      ctx.arc(w.body.position.x, w.body.position.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawGrain(w, h) {
    if (!this.grainCanvas) {
      const c = document.createElement("canvas");
      c.width = 180;
      c.height = 180;
      const gctx = c.getContext("2d");
      if (gctx) {
        const imgData = gctx.createImageData(180, 180);
        for (let i = 0; i < imgData.data.length; i += 4) {
          const val = 120 + Math.random() * 135;
          imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = val;
          imgData.data[i + 3] = 16;
        }
        gctx.putImageData(imgData, 0, 0);
      }
      this.grainCanvas = c;
    }

    const ctx = this.ctx;
    const pat = ctx.createPattern(this.grainCanvas, "repeat");
    if (!pat) return;
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawVignette(w, h) {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.35,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(24,26,22,0.36)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

// ----------------------------------------------------------------------------
// Master Expedition Orchestrator (q0)
// ----------------------------------------------------------------------------
class q0 {
  canvas;
  ctx;
  seed;
  bus = new Y0();
  input = new M0();
  audio = new T0();
  particles = new S0();
  camera = new X0();
  stunts;
  engine;
  terrain;
  terrainSet = new Set();
  vehicle;
  renderer;
  raf = 0;
  last = 0;
  accumulator = 0;
  time = 0;
  timeScale = 1;
  timeScaleTarget = 1;
  running = false;
  debug = false;
  fps = 60;
  frameSamples = [];
  startX = 0;
  maxDistance = 0;
  highestAltitude = 0;
  score = 0;
  stuckTimer = 0;

  constructor(canvas, seed = 42) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.seed = seed;
    this.stunts = new StuntDirector(this.bus, this.audio, this.camera);
    this.build();
    this.renderer = new R0(this.ctx, this.terrain);

    this.input.attach();
    this.input.onReset = () => this.reset();
    this.input.onDebug = () => {
      this.debug = !this.debug;
    };
  }

  build() {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: x.physics.gravity, scale: 0.001 },
      enableSleeping: true,
    });
    this.engine.positionIterations = 8;
    this.engine.velocityIterations = 8;

    this.terrain = new P0(this.seed);
    this.terrainSet = new Set(this.terrain.bodies);
    Matter.Composite.add(this.engine.world, this.terrain.bodies);

    this.startX = x.world.startX;
    // Spawn vehicle gently on ground
    const startY = this.terrain.heightAt(this.startX) - 58;
    this.vehicle = new f0(this.startX, startY);
    Matter.Composite.add(this.engine.world, this.vehicle.composite);

    this.camera.reset(this.startX, startY);
    this.stunts.reset();

    Matter.Events.on(this.engine, "collisionStart", (e) => this.onCollisions(e.pairs));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.loop(this.last);
  }

  reset() {
    Matter.Events.off(this.engine, "collisionStart");
    Matter.Composite.clear(this.engine.world, false, true);
    Matter.Engine.clear(this.engine);
    this.particles.clear();
    this.build();
    this.renderer.setTerrain(this.terrain);
    this.maxDistance = 0;
    this.highestAltitude = 0;
    this.score = 0;
    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.stuckTimer = 0;
    this.bus.emit("run:reset", {});
  }

  newRun(seed) {
    this.seed = seed ?? Math.floor(Math.random() * 99999);
    this.reset();
  }

  setPaused(paused) {
    this.running = !paused;
    if (!paused) {
      this.last = performance.now();
      this.loop(this.last);
    } else {
      cancelAnimationFrame(this.raf);
      this.audio.setEngine(0, 0);
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.running = false;
    this.input.detach();
    this.audio.dispose();
    Matter.Events.off(this.engine, "collisionStart");
    Matter.Composite.clear(this.engine.world, false, true);
    Matter.Engine.clear(this.engine);
    this.bus.clear();
  }

  classify(energy) {
    if (energy > 2.6) return "critical";
    if (energy > 1.3) return "heavy";
    if (energy > 0.45) return "medium";
    return "light";
  }

  onCollisions(pairs) {
    const vehicleBodies = new Set([
      this.vehicle.chassis,
      ...this.vehicle.wheels.map((w) => w.body),
    ]);

    for (const pair of pairs) {
      const { bodyA, bodyB } = pair;
      const vBody = vehicleBodies.has(bodyA) ? bodyA : vehicleBodies.has(bodyB) ? bodyB : null;
      if (!vBody) continue;
      const other = vBody === bodyA ? bodyB : bodyA;
      if (!this.terrainSet.has(other)) continue;

      const vel = vBody.velocity;
      const speed = Math.hypot(vel.x, vel.y);
      const energy = 0.5 * vBody.mass * speed * speed * 0.045;
      if (energy < 0.06) continue;

      const pt = pair.collision?.supports?.[0] ?? vBody.position;
      const normal = pair.collision?.normal ?? { x: 0, y: -1 };
      const severity = this.classify(energy);
      const isChassis = vBody === this.vehicle.chassis;
      const mat = MATERIALS[other.materialKind] ?? MATERIALS.dirt;

      this.audio.impact(b(energy / 3, 0.05, 1), other.materialKind, isChassis);
      this.particles.spawnLandingBurst(pt.x, pt.y, b(energy * 1.4, 0.4, 3.2), mat);

      if (severity !== "light") {
        if (mat.name === "rock" || isChassis) {
          this.particles.spawnSparks(pt.x, pt.y, normal.x, normal.y, Math.round(energy * 4));
        }
      }

      const shakeMags = { light: 0.05, medium: 0.14, heavy: 0.24, critical: 0.42 };
      this.camera.shake(shakeMags[severity], severity === "light" ? 140 : 280, normal.x, normal.y);
      this.camera.pulseZoom(severity === "light" ? 0.008 : 0.03);

      this.vehicle.driver.applyShock(energy);

      if (severity === "critical" && !x.visual.reducedMotion) {
        this.timeScale = 0.25;
        this.timeScaleTarget = 1;
      }

      this.score += Math.round(energy * 12);
      this.bus.emit("vehicle:impact", {
        energy,
        x: pt.x,
        y: pt.y,
        nx: normal.x,
        ny: normal.y,
        material: other.materialKind,
      });
    }
  }

  step(dt) {
    const inputState = {
      throttle: this.input.throttle,
      brake: this.input.brake,
    };

    this.vehicle.update(inputState, dt);
    Matter.Engine.update(this.engine, dt);

    const activePairs = this.engine.pairs.list.filter((p) => p.isActive);
    this.vehicle.markContacts(this.terrainSet, activePairs);

    this.safety();
  }

  safety() {
    const pos = this.vehicle.chassis.position;
    const vel = this.vehicle.chassis.velocity;

    if (!I0(pos) || !I0(vel) || Math.hypot(vel.x, vel.y) > 220 || pos.y > 5000) {
      this.respawn();
      return;
    }

    const isInverted = Math.abs(Math.sin(this.vehicle.chassis.angle)) > 0.92;
    const isStopped = Math.hypot(vel.x, vel.y) < 0.45;

    if (isInverted && isStopped) {
      this.stuckTimer += x.physics.fixedDelta;
      if (this.stuckTimer > 2200) {
        this.respawn();
      }
    } else {
      this.stuckTimer = 0;
    }
  }

  respawn() {
    const safeX = Math.max(x.world.startX, this.vehicle.chassis.position.x - 120);
    const safeY = this.terrain.heightAt(safeX) - 58;
    const allBodies = [this.vehicle.chassis, ...this.vehicle.wheels.map((w) => w.body)];

    for (const b of allBodies) {
      Matter.Body.setVelocity(b, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(b, 0);
    }

    Matter.Body.setPosition(this.vehicle.chassis, { x: safeX, y: safeY });
    Matter.Body.setAngle(this.vehicle.chassis, 0);

    this.vehicle.wheels.forEach((w) => {
      Matter.Body.setPosition(w.body, {
        x: safeX + w.restOffset.x,
        y: safeY + w.restOffset.y,
      });
    });

    this.camera.reset(safeX, safeY);
    this.stuckTimer = 0;
    this.stunts.reset();
  }

  loop = (timestamp) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);

    let dt = Math.min(50, timestamp - this.last);
    this.last = timestamp;
    this.time += dt;

    this.frameSamples.push(dt);
    if (this.frameSamples.length > 30) this.frameSamples.shift();
    this.fps = 1000 / (this.frameSamples.reduce((a, b) => a + b, 0) / this.frameSamples.length);

    this.timeScale += (this.timeScaleTarget - this.timeScale) * Math.min(1, dt / 190);
    dt *= this.timeScale;

    const fixedDelta = x.physics.fixedDelta;
    this.accumulator = Math.min(this.accumulator + dt, fixedDelta * x.physics.maxSubSteps);
    while (this.accumulator >= fixedDelta) {
      this.step(fixedDelta);
      this.accumulator -= fixedDelta;
    }

    this.postPhysics(dt);
    this.particles.update(dt);
    this.draw();
  };

  postPhysics(dt) {
    const v = this.vehicle;
    const isAirborne = v.airborne;

    this.stunts.update(v, this.terrain, dt);

    if (!isAirborne && this.wasAirborne) {
      this.stunts.onLanding(v, this.terrain);
    }
    this.wasAirborne = isAirborne;

    for (const w of v.wheels) {
      if (!w.contact) continue;
      const slip = w.slip;
      const intensity = b((slip - 1.1) * 0.4, 0, 1.8);
      if (intensity > 0.05 && Math.random() < 0.65) {
        const mat = MATERIALS[w.material] ?? MATERIALS.dirt;
        this.particles.spawnWheelSpray(
          w.body.position.x,
          w.body.position.y + x.vehicle.wheelRadius * 0.75,
          -v.chassis.velocity.x * 0.45,
          0,
          intensity,
          mat
        );
        this.audio.skid(intensity);
      }
    }

    const distMeters = Math.max(0, (v.chassis.position.x - this.startX) / 40);
    this.maxDistance = Math.max(this.maxDistance, distMeters);
    const altitudeMeters = Math.max(0, Math.round((x.world.groundBase - v.chassis.position.y) / 10));
    this.highestAltitude = Math.max(this.highestAltitude, altitudeMeters);

    const load = b((this.input.throttle + this.input.brake) * 0.65 + Math.abs(v.forwardSpeed) * 0.04, 0, 1);
    this.audio.setEngine(v.rpm, load, isAirborne);
    this.audio.updateWind(Math.abs(v.forwardSpeed) * 7.2, altitudeMeters);

    this.camera.update(
      { x: v.chassis.position.x, y: v.chassis.position.y },
      v.chassis.velocity,
      isAirborne,
      dt
    );

    const biome = this.terrain.biomeAt(v.chassis.position.x);

    this.bus.emit("stats:update", {
      distance: this.maxDistance,
      altitude: altitudeMeters,
      speed: Math.abs(v.forwardSpeed) * 7.2,
      airtime: this.stunts.airtime,
      rpm: v.rpm,
      airborne: isAirborne,
      score: this.score,
      biomeName: biome.name,
      comboMultiplier: this.stunts.comboMultiplier,
      comboTimer: this.stunts.comboTimer,
      activeStunt: this.stunts.activeStuntName,
    });
  }

  draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const allBodies = this.debug ? Matter.Composite.allBodies(this.engine.world) : [];
    this.renderer.render(
      this.camera,
      this.vehicle,
      this.particles,
      w,
      h,
      this.time,
      this.debug,
      allBodies
    );
  }

  get debugInfo() {
    return {
      fps: this.fps.toFixed(1),
      bodies: Matter.Composite.allBodies(this.engine.world).length,
      particles: this.particles.pool.filter((p) => p.active).length,
      compression: this.vehicle.wheels.map((w) => w.compression.toFixed(2)),
      contacts: this.vehicle.wheels.map((w) => w.contact),
      camera: {
        x: this.camera.x.toFixed(0),
        y: this.camera.y.toFixed(0),
        zoom: this.camera.zoom.toFixed(2),
      },
      biome: this.terrain.biomeAt(this.vehicle.chassis.position.x).name,
      seed: this.seed,
    };
  }
}

// ----------------------------------------------------------------------------
// UI Wiring & DOM Integration
// ----------------------------------------------------------------------------
const gameCanvas = document.getElementById("game");
const $el = (id) => document.getElementById(id);

const game = new q0(gameCanvas);
let hasStarted = false;
let isPaused = false;

const hudDist = $el("hud-dist");
const hudSpeed = $el("hud-speed");
const hudAlt = $el("hud-alt");
const hudZone = $el("hud-zone");
const hudScore = $el("hud-score");
const hudRpm = $el("hud-rpm");
const hudAir = $el("hud-air");
const hudStunt = $el("hud-stunt");
const hudCombo = $el("hud-combo");

let liveStats = {
  distance: 0,
  altitude: 0,
  speed: 0,
  airtime: 0,
  rpm: 0,
  airborne: false,
  score: 0,
  biomeName: "Alpine Meadow",
  comboMultiplier: 1,
  comboTimer: 0,
  activeStunt: "",
};

game.bus.on("stats:update", (stats) => {
  liveStats = stats;
});

let stuntTimeout = null;
game.bus.on("stunt:awarded", (data) => {
  if (hudStunt) {
    const multStr = data.multiplier > 1 ? ` &times;${data.multiplier}` : "";
    hudStunt.innerHTML = `<strong>${data.name}</strong> +${data.score}${multStr}`;
    hudStunt.style.opacity = "1";
    hudStunt.style.transform = "translateY(0px)";
    clearTimeout(stuntTimeout);
    stuntTimeout = setTimeout(() => {
      hudStunt.style.opacity = "0";
      hudStunt.style.transform = "translateY(-10px)";
    }, 1800);
  }
});

setInterval(() => {
  if (hudDist) hudDist.textContent = liveStats.distance.toFixed(0) + " m";
  if (hudSpeed) hudSpeed.textContent = liveStats.speed.toFixed(0) + " km/h";
  if (hudAlt) hudAlt.textContent = (liveStats.altitude || 0).toFixed(0) + " m";
  if (hudZone) hudZone.textContent = liveStats.biomeName;
  if (hudScore) hudScore.textContent = String(liveStats.score);
  if (hudRpm) hudRpm.style.width = Math.min(100, liveStats.rpm * 100).toFixed(0) + "%";

  if (hudAir) {
    hudAir.textContent = liveStats.airborne
      ? "AIR " + (liveStats.airtime / 1000).toFixed(1) + "s"
      : "";
  }

  if (hudCombo) {
    if (liveStats.comboMultiplier > 1 && liveStats.comboTimer > 0) {
      hudCombo.style.display = "block";
      hudCombo.textContent = `COMBO x${liveStats.comboMultiplier} (${liveStats.comboTimer.toFixed(1)}s)`;
    } else {
      hudCombo.style.display = "none";
    }
  }
}, 80);

function togglePause() {
  isPaused = !isPaused;
  game.setPaused(isPaused);
  const pauseOverlay = $el("pause");
  if (pauseOverlay) {
    pauseOverlay.style.display = isPaused ? "flex" : "none";
  }

  const recapDist = $el("recap-dist");
  const recapAlt = $el("recap-alt");
  const recapScore = $el("recap-score");
  if (recapDist) recapDist.textContent = game.maxDistance.toFixed(0) + " m";
  if (recapAlt) recapAlt.textContent = game.highestAltitude.toFixed(0) + " m";
  if (recapScore) recapScore.textContent = String(game.score);
}

game.input.onPause = () => {
  if (hasStarted) togglePause();
};

$el("start-btn")?.addEventListener("click", () => {
  game.audio.start();
  game.audio.resume();
  hasStarted = true;
  $el("title").style.display = "none";
  $el("hud").style.display = "block";
  const pedals = $el("pedals");
  if (pedals) pedals.style.display = "flex";
});

$el("resume-btn")?.addEventListener("click", togglePause);
$el("restart-btn")?.addEventListener("click", () => {
  game.reset();
  togglePause();
});
$el("seed-btn")?.addEventListener("click", () => {
  game.newRun();
  togglePause();
});

const optShake = $el("opt-shake");
const optMotion = $el("opt-motion");
const optMute = $el("opt-mute");

if (optShake) {
  optShake.checked = x.visual.screenShake;
  optShake.addEventListener("change", (e) => {
    x.visual.screenShake = e.target.checked;
  });
}
if (optMotion) {
  optMotion.checked = x.visual.reducedMotion;
  optMotion.addEventListener("change", (e) => {
    x.visual.reducedMotion = e.target.checked;
  });
}
if (optMute) {
  optMute.checked = x.visual.muted;
  optMute.addEventListener("change", (e) => {
    x.visual.muted = e.target.checked;
    game.audio.setMuted(e.target.checked);
  });
}

const bindTouchPedal = (id, property) => {
  const btn = $el(id);
  if (!btn) return;
  const handler = (pressed) => (evt) => {
    evt.preventDefault();
    game.input[property] = pressed;
  };
  btn.addEventListener("pointerdown", handler(true));
  btn.addEventListener("pointerup", handler(false));
  btn.addEventListener("pointerleave", handler(false));
};

bindTouchPedal("pedal-l", "touchLeft");
bindTouchPedal("pedal-r", "touchRight");

game.start();
'''

with open('game_engine.js', 'w', encoding='utf-8') as f:
    f.write(engine_code.strip() + '\n')

print('Wrote refined game_engine.js successfully!')
