// ============================================================================
// THE OLD MOUNTAIN WORKS - MASTER GAME ENGINE OVERHAUL V2
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
// Vehicle Archetypes (Authentic Physics Differences)
// ----------------------------------------------------------------------------
const VEHICLE_ARCHETYPES = {
  buggy: {
    id: "buggy",
    name: "Trail Buggy",
    desc: "Balanced agile expedition chassis with progressive suspension.",
    chassisWidth: 104,
    chassisHeight: 24,
    chassisMass: 7.4,
    wheelRadius: 21,
    wheelMass: 1.1,
    wheelBase: 108,
    wheelOffsetY: 36,
    engineTorque: 0.075,
    brakeTorque: 0.095,
    maxWheelSpeed: 1.45,
    suspensionStiffness: 0.15,
    suspensionDamping: 0.045,
    suspensionTravel: 26,
    tireGrip: 1.45,
    airControl: 0.045,
    angularDamping: 0.022,
    centerOfMassOffsetY: 6.0,
    accentColor: "#d4622a",
    chassisColor: "#c8bda6",
  },
  crawler: {
    id: "crawler",
    name: "Mountain Crawler",
    desc: "Heavy reinforced frame, oversized tires, supreme grip and hill climbing torque.",
    chassisWidth: 112,
    chassisHeight: 26,
    chassisMass: 9.8,
    wheelRadius: 24,
    wheelMass: 1.5,
    wheelBase: 116,
    wheelOffsetY: 40,
    engineTorque: 0.095,
    brakeTorque: 0.120,
    maxWheelSpeed: 1.25,
    suspensionStiffness: 0.18,
    suspensionDamping: 0.050,
    suspensionTravel: 30,
    tireGrip: 1.55,
    airControl: 0.038,
    angularDamping: 0.026,
    centerOfMassOffsetY: 8.0,
    accentColor: "#357a62",
    chassisColor: "#b5a88f",
  },
  rally: {
    id: "rally",
    name: "Alpine Rally",
    desc: "Lightweight tuned racer with explosive acceleration and high airborne pitch authority.",
    chassisWidth: 98,
    chassisHeight: 22,
    chassisMass: 5.8,
    wheelRadius: 19,
    wheelMass: 0.9,
    wheelBase: 102,
    wheelOffsetY: 34,
    engineTorque: 0.085,
    brakeTorque: 0.100,
    maxWheelSpeed: 1.70,
    suspensionStiffness: 0.14,
    suspensionDamping: 0.040,
    suspensionTravel: 22,
    tireGrip: 1.40,
    airControl: 0.055,
    angularDamping: 0.020,
    centerOfMassOffsetY: 5.0,
    accentColor: "#c23a3a",
    chassisColor: "#d2c7b5",
  },
};

const n0 = {
  gravity: 1.55,
  fixedDelta: 1000 / 120, // 8.333ms high-precision timestep
  maxSubSteps: 5,
};

const r0 = {
  followSpeed: 0.09,
  lookAhead: 150,
  baseZoom: 0.88,
  speedZoom: 0.14,
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
  activeArchetype: "buggy",
  vehicle: VEHICLE_ARCHETYPES.buggy,
  physics: n0,
  camera: r0,
  visual: i0,
  world: {
    length: 36000,
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
    maxDist: 180, // 0 - 180m
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
    landmark: { x: 1400, name: "Base Camp Outpost", type: "shelter" },
  },
  {
    id: "ridge",
    name: "Stone Ridge",
    minDist: 180,
    maxDist: 380, // 180 - 380m
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
    landmark: { x: 10500, name: "The High Crag Cairn", type: "cairn" },
  },
  {
    id: "canyon",
    name: "Canyon Gorge",
    minDist: 380,
    maxDist: 580, // 380 - 580m
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
    landmark: { x: 19000, name: "Old Trestle Bridge Chasm", type: "trestle" },
  },
  {
    id: "industrial",
    name: "Industrial Works",
    minDist: 580,
    maxDist: 750, // 580 - 750m
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
    landmark: { x: 26000, name: "Abandoned Mine Pithead Derrick", type: "pithead" },
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
    landmark: { x: 33000, name: "Summit Weather Observatory", type: "beacon" },
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
    friction: 0.30,
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

const TEST_SEEDS = {
  SEED_FLAT: 1001,
  SEED_STEEP: 48192,
  SEED_JUMP: 77234,
  SEED_VALLEY: 33109,
};

const MOUNTAIN_ECHO_DEFS = [
  { id: "echo_1", x: 1450, yOffset: -50, name: "The Surveyor's Compass", lore: "Marked 1892. The brass casing is etched with altitude benchmarks leading toward the ridge." },
  { id: "echo_2", x: 4800, yOffset: -65, name: "First Ascent Expedition Log", lore: "'We abandoned the steam tractor in the scree. From here on, only momentum and iron will carry us.'" },
  { id: "echo_3", x: 11400, yOffset: -55, name: "The High Trestle Blueprint", lore: "Hand-inked schematics for the wooden chasm crossing, engineered to withstand 80-knot gales." },
  { id: "echo_4", x: 17800, yOffset: -60, name: "Miners' Carbide Lantern Fragment", lore: "Soot-stained glass salvaged from Pithead No. 4, echoing the rhythmic hiss of old acetylene." },
  { id: "echo_5", x: 24200, yOffset: -70, name: "Glacial Ice Core Capsule", lore: "Compressed firn layer trapping ancient alpine atmosphere from centuries before the roads." },
  { id: "echo_6", x: 32500, yOffset: -75, name: "The Summit Observatory Telegraph", lore: "'Trail impassable to ordinary machines. Signal received. Summit in sight.'" }
];


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

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);

    this.engineBus = ctx.createGain();
    this.engineBus.gain.value = 0.55;
    this.engineBus.connect(this.master);

    // Multi-oscillator engine synthesis
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

    this.initWind();

    const bufferSize = Math.floor(ctx.sampleRate * 1.5);
    this.noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const channel = this.noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      channel[i] = (last + 0.02 * white) / 1.02;
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

  updateWind(speed, altitude = 0) {
    if (!this.ctx || !this.windGain || this.muted) return;
    const now = this.ctx.currentTime;
    const speedNormalized = b(speed / 100, 0, 1);
    const altNormalized = b(altitude / 1000, 0, 1);
    const windLevel = 0.02 + speedNormalized * 0.08 + altNormalized * 0.05;
    this.windGain.gain.setTargetAtTime(windLevel, now, 0.1);
    this.windFilter.frequency.setTargetAtTime(260 + speedNormalized * 400, now, 0.1);
  }

  setWind(speed) {
    this.updateWind(speed, 0);
  }

  impact(intensity, materialKind = "dirt", isChassis = false) {
    if (!this.ctx || !this.started || this.muted || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vol = b(0.1 + intensity * 0.55, 0.1, 0.95);

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
    if (!this.ctx || !this.started || this.muted || Math.abs(deltaCompression) < 0.25) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.07);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 880;
    filter.Q.value = 4.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  destruct(kind = "wood") {
    if (!this.ctx || !this.started || this.muted || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(kind === "wood" ? 640 : 1200, now);
    filter.Q.value = 2.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  stuntChime(tier = 1) {
    if (!this.ctx || !this.started || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

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

  echoChime() {
    if (!this.ctx || !this.started || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freqs = [880, 1320, 1760];
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freqs[i], now + i * 0.05);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.14, now + i * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.65);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.7);
    }
  }

  warningAlarm() {
    if (!this.ctx || !this.started || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(330, now + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.18);
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
  handlers = new Map();

  on(event, fn) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(fn);
  }

  off(event, fn) {
    this.handlers.get(event)?.delete(fn);
  }

  emit(event, payload) {
    const list = this.handlers.get(event);
    if (!list) return;
    for (const fn of list) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[EventBus] Error in '${event}' handler:`, err);
      }
    }
  }

  clear() {
    this.handlers.clear();
  }
}

// ----------------------------------------------------------------------------
// Input System (M0)
// ----------------------------------------------------------------------------
class M0 {
  keys = new Set();
  touchLeft = false;
  touchRight = false;
  gamepadIndex = -1;
  onReset = null;
  onDebug = null;
  onPause = null;

  attach() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("gamepadconnected", (e) => {
      this.gamepadIndex = e.gamepad.index;
    });
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (k === "r" && this.onReset) this.onReset();
    if (k === "f3" && this.onDebug) {
      e.preventDefault();
      this.onDebug();
    }
    if ((k === "escape" || k === "p") && this.onPause) {
      e.preventDefault();
      this.onPause();
    }
  };

  onKeyUp = (e) => {
    this.keys.delete(e.key.toLowerCase());
  };

  get throttle() {
    let t = 0;
    if (this.keys.has("d") || this.keys.has("arrowright") || this.keys.has("w") || this.keys.has("arrowup")) {
      t = 1;
    }
    if (this.touchRight) t = Math.max(t, 1);
    const gp = this.pollGamepad();
    if (gp) t = Math.max(t, gp.throttle);
    return t;
  }

  get brake() {
    let bVal = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft") || this.keys.has("s") || this.keys.has("arrowdown")) {
      bVal = 1;
    }
    if (this.touchLeft) bVal = Math.max(bVal, 1);
    const gp = this.pollGamepad();
    if (gp) bVal = Math.max(bVal, gp.brake);
    return bVal;
  }

  pollGamepad() {
    if (this.gamepadIndex < 0 || !navigator.getGamepads) return null;
    const gp = navigator.getGamepads()[this.gamepadIndex];
    if (!gp) return null;
    const axisX = gp.axes[0] ?? 0;
    const triggerR = gp.buttons[7]?.value ?? (gp.buttons[7]?.pressed ? 1 : 0);
    const triggerL = gp.buttons[6]?.value ?? (gp.buttons[6]?.pressed ? 1 : 0);
    const btnRight = gp.buttons[15]?.pressed ? 1 : 0;
    const btnLeft = gp.buttons[14]?.pressed ? 1 : 0;

    return {
      throttle: b(Math.max(triggerR, btnRight, axisX > 0.15 ? axisX : 0), 0, 1),
      brake: b(Math.max(triggerL, btnLeft, axisX < -0.15 ? -axisX : 0), 0, 1),
    };
  }
}

// ----------------------------------------------------------------------------
// Particle System (S0)
// ----------------------------------------------------------------------------
class S0 {
  pool = [];
  capacity = 700;

  constructor() {
    for (let i = 0; i < this.capacity; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        color: "#c9bda2",
        alpha: 1,
        gravity: 0.25,
        kind: "dust",
        angle: 0,
        angularVelocity: 0,
      });
    }
  }

  clear() {
    for (const p of this.pool) p.active = false;
  }

  alloc() {
    for (const p of this.pool) {
      if (!p.active) return p;
    }
    return this.pool[0];
  }

  spawnWheelSpray(xPos, yPos, baseVx, baseVy, intensity, mat) {
    const count = Math.round(intensity * 4);
    for (let i = 0; i < count; i++) {
      const p = this.alloc();
      p.active = true;
      p.x = xPos + (Math.random() - 0.5) * 8;
      p.y = yPos + (Math.random() - 0.5) * 4;
      p.vx = baseVx * (0.3 + Math.random() * 0.5) + (Math.random() - 0.5) * 3;
      p.vy = -Math.random() * 3.5 - 0.5;
      p.life = 0;
      p.maxLife = 350 + Math.random() * 400;
      p.size = 2.0 + Math.random() * 2.8;
      p.color = mat.dustColors[Math.floor(Math.random() * mat.dustColors.length)];
      p.alpha = 0.85;
      p.gravity = 0.22;
      p.kind = mat.dustKind;
      p.angle = Math.random() * Math.PI * 2;
      p.angularVelocity = (Math.random() - 0.5) * 0.2;
    }
  }

  spawnLandingBurst(xPos, yPos, force, mat) {
    const count = Math.min(48, Math.round(force * 14));
    for (let i = 0; i < count; i++) {
      const p = this.alloc();
      p.active = true;
      p.x = xPos;
      p.y = yPos;
      const angle = (Math.random() * 0.8 + 0.1) * Math.PI;
      const speed = Math.random() * force * 3.8 + 1.2;
      p.vx = Math.cos(angle) * speed * (Math.random() < 0.5 ? 1 : -1);
      p.vy = -Math.sin(angle) * speed;
      p.life = 0;
      p.maxLife = 450 + Math.random() * 550;
      p.size = 2.5 + Math.random() * 3.8;
      p.color = mat.dustColors[Math.floor(Math.random() * mat.dustColors.length)];
      p.alpha = 0.95;
      p.gravity = 0.35;
      p.kind = mat.dustKind;
      p.angle = Math.random() * Math.PI * 2;
      p.angularVelocity = (Math.random() - 0.5) * 0.35;
    }
  }

  spawnSparks(xPos, yPos, nx, ny, count = 12) {
    for (let i = 0; i < count; i++) {
      const p = this.alloc();
      p.active = true;
      p.x = xPos;
      p.y = yPos;
      const spread = (Math.random() - 0.5) * 1.8;
      const speed = Math.random() * 7 + 3;
      p.vx = (nx + spread) * speed;
      p.vy = (ny - Math.random() * 0.8) * speed;
      p.life = 0;
      p.maxLife = 180 + Math.random() * 220;
      p.size = 1.8;
      p.color = Math.random() < 0.6 ? "#e37e3d" : "#efd07b";
      p.alpha = 1;
      p.gravity = 0.4;
      p.kind = "spark";
      p.angle = 0;
      p.angularVelocity = 0;
    }
  }

  spawnSplinters(xPos, yPos, count = 18, color = "#9c7c59") {
    for (let i = 0; i < count; i++) {
      const p = this.alloc();
      p.active = true;
      p.x = xPos + (Math.random() - 0.5) * 10;
      p.y = yPos + (Math.random() - 0.5) * 10;
      p.vx = (Math.random() - 0.5) * 8;
      p.vy = -Math.random() * 7 - 1;
      p.life = 0;
      p.maxLife = 500 + Math.random() * 600;
      p.size = 2.4 + Math.random() * 3.5;
      p.color = color;
      p.alpha = 0.95;
      p.gravity = 0.35;
      p.kind = "wood";
      p.angle = Math.random() * Math.PI * 2;
      p.angularVelocity = (Math.random() - 0.5) * 0.4;
    }
  }

  spawnEchoSparkles(xPos, yPos, count = 16) {
    for (let i = 0; i < count; i++) {
      const p = this.alloc();
      p.active = true;
      p.x = xPos + (Math.random() - 0.5) * 16;
      p.y = yPos + (Math.random() - 0.5) * 16;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 0.8;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 1.2;
      p.life = 0;
      p.maxLife = 400 + Math.random() * 450;
      p.size = 2.8 + Math.random() * 2.5;
      p.color = Math.random() < 0.65 ? "#d4622a" : "#2ea3a5";
      p.alpha = 1;
      p.gravity = -0.05;
      p.kind = "spark";
      p.angle = Math.random() * Math.PI * 2;
      p.angularVelocity = (Math.random() - 0.5) * 0.3;
    }
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * (dt / 16.666);
      p.y += p.vy * (dt / 16.666);
      p.vy += p.gravity * (dt / 16.666);
      p.angle += p.angularVelocity * (dt / 16.666);
      p.alpha = 1 - p.life / p.maxLife;
    }
  }
}

// ----------------------------------------------------------------------------
// Camera System (X0) - Speed Lookahead, Airborne Framing, Landing Pulse
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

  update(arg1, arg2, arg3, arg4) {
    let targetPos, targetVel, airborne, dt;
    if (arg1 && arg1.chassis) {
      targetPos = arg1.chassis.position;
      targetVel = arg1.chassis.velocity;
      airborne = Boolean(arg1.airborne);
      dt = typeof arg3 === "number" ? arg3 : (typeof arg2 === "number" ? arg2 : 16.66);
    } else {
      targetPos = arg1;
      targetVel = arg2;
      airborne = Boolean(arg3);
      dt = typeof arg4 === "number" ? arg4 : 16.66;
    }

    const camCfg = x.camera;
    const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 16.66;
    const dtSeconds = safeDt / 1000;
    const vx = Number.isFinite(targetVel?.x) ? targetVel.x : 0;
    const vy = Number.isFinite(targetVel?.y) ? targetVel.y : 0;
    const speed = Math.hypot(vx, vy);

    const lookAheadX = b(vx * 12, -camCfg.lookAhead, camCfg.lookAhead);
    const airOffsetY = airborne ? 48.0 : 0.0;

    const posX = Number.isFinite(targetPos?.x) ? targetPos.x : (Number.isFinite(this.x) ? this.x : 220);
    const posY = Number.isFinite(targetPos?.y) ? targetPos.y : (Number.isFinite(this.y) ? this.y : 500);

    const targetX = posX + lookAheadX;
    const targetY = posY + airOffsetY - 36;

    if (!Number.isFinite(this.x)) this.x = targetX;
    if (!Number.isFinite(this.y)) this.y = targetY;

    this.x = G0(this.x, targetX, camCfg.followSpeed * 65, safeDt);
    this.y = G0(this.y, targetY, camCfg.followSpeed * 65, safeDt);

    const speedZoomFactor = b(speed * 0.012, 0, 1) * camCfg.speedZoom;
    const airZoomFactor = airborne ? 0.05 : 0;
    this.targetZoom = camCfg.baseZoom - speedZoomFactor - airZoomFactor + this.zoomPulse;
    if (!Number.isFinite(this.zoom)) this.zoom = camCfg.baseZoom;
    this.zoom = G0(this.zoom, this.targetZoom, 4.5, safeDt);

    this.zoomPulse = Math.max(0, this.zoomPulse - dtSeconds * 0.35);

    for (let i = this.shakes.length - 1; i >= 0; i--) {
      const s = this.shakes[i];
      s.elapsed += safeDt;
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
// Interactive Physics Props & Destruction Manager (PropManager)
// ----------------------------------------------------------------------------
class PropManager {
  world;
  audio;
  particles;
  bus;
  defs = [];
  activeProps = new Map(); // id -> { bodies, def, smashed }

  constructor(world, audio, particles, bus) {
    this.world = world;
    this.audio = audio;
    this.particles = particles;
    this.bus = bus;
  }

  initProps(terrain, seed) {
    this.clear();
    this.defs = [];
    const noise = K0(seed + 999);

    // 1. Trail signs at scenic spots (starting after 2800m to keep opening track clear)
    const signDistances = [2800, 5100, 8500, 13800, 18400, 24200, 31500];
    for (let i = 0; i < signDistances.length; i++) {
      const sx = signDistances[i];
      const sy = terrain.heightAt(sx) - 18;
      this.defs.push({
        id: `sign_${i}`,
        type: "sign",
        x: sx,
        y: sy,
        spawned: false,
      });
    }

    // 2. Breakable wooden fences along ridges & bridges
    const fenceClusters = [3200, 7200, 12200, 19100, 27400];
    for (let c = 0; c < fenceClusters.length; c++) {
      const cx = fenceClusters[c];
      for (let f = 0; f < 4; f++) {
        const fx = cx + f * 24;
        const fy = terrain.heightAt(fx) - 14;
        this.defs.push({
          id: `fence_${c}_${f}`,
          type: "fence",
          x: fx,
          y: fy,
          spawned: false,
        });
      }
    }

    // 3. Supply crates at outposts and industrial zones (placed on plateaus, away from slopes)
    const crateStations = [3800, 7800, 14800, 25800, 26300];
    for (let c = 0; c < crateStations.length; c++) {
      const cx = crateStations[c];
      const cy = terrain.heightAt(cx) - 16;
      this.defs.push({
        id: `crate_${c}`,
        type: "crate",
        x: cx,
        y: cy,
        spawned: false,
      });
    }

    // 4. Loose rolling rocks on steep descents
    const rockStations = [5200, 9300, 15800, 22200, 28800];
    for (let r = 0; r < rockStations.length; r++) {
      const rx = rockStations[r];
      const ry = terrain.heightAt(rx) - 16;
      this.defs.push({
        id: `rock_${r}`,
        type: "rock",
        x: rx,
        y: ry,
        radius: 12 + Math.floor(Math.abs(noise(r)) * 6),
        spawned: false,
      });
    }
  }

  updateChunking(camX) {
    const minX = camX - 1200;
    const maxX = camX + 1200;

    for (let i = 0; i < this.defs.length; i++) {
      const def = this.defs[i];
      const inRange = def.x >= minX && def.x <= maxX;

      if (inRange && !def.spawned) {
        this.spawnProp(def);
        def.spawned = true;
      } else if (!inRange && def.spawned) {
        this.despawnProp(def.id);
      }
    }
  }

  spawnProp(def) {
    if (def.type === "sign") {
      const body = Matter.Bodies.rectangle(def.x, def.y, 14, 26, {
        label: "prop_sign",
        friction: 0.05,
        density: 0.00005,
        restitution: 0.05,
        collisionFilter: { group: -1 },
      });
      body.propDef = def;
      Matter.Composite.add(this.world, body);
      this.activeProps.set(def.id, { bodies: [body], def, smashed: false });
    } else if (def.type === "fence") {
      const body = Matter.Bodies.rectangle(def.x, def.y, 8, 22, {
        label: "prop_fence",
        friction: 0.05,
        density: 0.00005,
        restitution: 0.05,
        collisionFilter: { group: -1 },
      });
      body.propDef = def;
      Matter.Composite.add(this.world, body);
      this.activeProps.set(def.id, { bodies: [body], def, smashed: false });
    } else if (def.type === "crate") {
      const body = Matter.Bodies.rectangle(def.x, def.y, 22, 22, {
        label: "prop_crate",
        friction: 0.3,
        density: 0.0002,
        restitution: 0.10,
        chamfer: { radius: 2 },
      });
      body.propDef = def;
      Matter.Composite.add(this.world, body);
      this.activeProps.set(def.id, { bodies: [body], def, smashed: false });
    } else if (def.type === "rock") {
      const rad = def.radius || 14;
      const body = Matter.Bodies.polygon(def.x, def.y, 7, rad, {
        label: "prop_rock",
        friction: 0.7,
        frictionStatic: 0.9,
        density: 0.002,
        restitution: 0.15,
      });
      body.propDef = def;
      Matter.Composite.add(this.world, body);
      this.activeProps.set(def.id, { bodies: [body], def, smashed: false });
    }
  }

  despawnProp(id) {
    const item = this.activeProps.get(id);
    if (!item) return;
    for (const b of item.bodies) {
      Matter.Composite.remove(this.world, b);
    }
    this.activeProps.delete(id);
  }

  onHit(propBody, hitEnergy, hitPt) {
    const def = propBody.propDef;
    if (!def) return;
    const item = this.activeProps.get(def.id);
    if (!item || item.smashed) return;

    if (def.type === "sign" || def.type === "fence" || def.type === "crate") {
      item.smashed = true;
      this.audio.destruct("wood");
      this.particles.spawnSplinters(hitPt.x, hitPt.y, 16);
      this.bus.emit("prop:destroyed", { type: def.type, score: 75 });
      try { Matter.Composite.remove(this.world, propBody); } catch (e) {}
    } else if (def.type === "rock") {
      this.audio.destruct("rock");
      this.particles.spawnLandingBurst(hitPt.x, hitPt.y, 1.2, MATERIALS.rock);
    }
  }

  clear() {
    for (const item of this.activeProps.values()) {
      for (const b of item.bodies) {
        Matter.Composite.remove(this.world, b);
      }
    }
    this.activeProps.clear();
    this.defs = [];
  }
}

// ----------------------------------------------------------------------------
// 3D Mountain Echo Relics Manager
// Procedural Lore Collectibles (Spec #28, #29, #30)
// ----------------------------------------------------------------------------
class MountainEchoManager {
  relics = [];
  collectedIds = new Set();
  audio;
  particles;
  bus;

  constructor(audio, particles, bus) {
    this.audio = audio;
    this.particles = particles;
    this.bus = bus;
  }

  initEchoes(terrain) {
    this.relics = [];
    for (const def of MOUNTAIN_ECHO_DEFS) {
      const ty = terrain.heightAt(def.x);
      this.relics.push({
        ...def,
        y: ty + def.yOffset,
        baseY: ty + def.yOffset,
        collected: this.collectedIds.has(def.id),
        rotation: Math.random() * Math.PI * 2,
        floatPhase: Math.random() * Math.PI * 2,
        glow: 0,
        distToCar: Infinity,
      });
    }
  }

  update(vehicle, dt) {
    if (!vehicle?.chassis) return;
    const carPos = vehicle.chassis.position;
    const dtSec = dt / 1000;

    for (const relic of this.relics) {
      if (relic.collected) continue;

      relic.floatPhase += dtSec * 2.2;
      relic.rotation += dtSec * 1.8;
      relic.y = relic.baseY + Math.sin(relic.floatPhase) * 9.0;

      const dx = carPos.x - relic.x;
      const dy = carPos.y - relic.y;
      const dist = Math.hypot(dx, dy);
      relic.distToCar = dist;

      // Magnetic drift when approaching (< 140px)
      if (dist < 140) {
        relic.glow = Math.min(1.0, relic.glow + dtSec * 4.0);
        const pull = (140 - dist) / 140 * 2.8;
        relic.x += (dx / dist) * pull;
        relic.y += (dy / dist) * pull;

        if (Math.random() < 0.15) {
          this.particles.spawnEchoSparkles(relic.x, relic.y, 2);
        }
      } else {
        relic.glow = Math.max(0.0, relic.glow - dtSec * 2.0);
      }

      // Collection trigger (< 42px)
      if (dist < 42) {
        this.collect(relic);
      }
    }
  }

  collect(relic) {
    relic.collected = true;
    this.collectedIds.add(relic.id);
    this.audio?.echoChime();
    this.particles?.spawnEchoSparkles(relic.x, relic.y, 28);
    this.bus?.emit("echo:collected", relic);
  }

  get collectedCount() {
    return this.relics.filter(r => r.collected).length;
  }

  get totalCount() {
    return this.relics.length;
  }
}

// ----------------------------------------------------------------------------
// Procedural Mountain Terrain & Grammar (P0)
// C1 Hermite Spline Continuity, Authoritative Segment Library, Safety Validator
// ----------------------------------------------------------------------------
class P0 {
  samples = [];
  bodies = [];
  segments = [];
  seed;
  step = x.world.sampleStep;

  constructor(seed) {
    this.seed = seed;
    this.generateGrammarTerrain();
  }

  generateGrammarTerrain() {
    this.samples = [];
    this.bodies = [];
    this.segments = [];

    const seed = this.seed;
    const groundBase = x.world.groundBase;
    const startX = x.world.startX;
    const totalLength = x.world.length;

    const nSwell = K0(seed + 11);
    const nDetail = K0(seed + 89);

    // Initial flat starting apron (-2500 to startX + 350)
    for (let q = -2500; q < startX + 350; q += this.step) {
      this.samples.push({
        x: q,
        y: groundBase,
        material: "grass",
        biomeId: "meadow",
        slope: 0,
      });
    }

    // Authored Segment Library for Mountain Expedition Grammar
    // Each template defines relative (deltaX, deltaY, exitSlope, type, material)
    const grammarSequence = [
      { name: "Gentle Rollers", type: "rollers", dx: 600, dy: -20, exitSlope: 0.05, material: "grass" },
      { name: "Steady Climb", type: "climb", dx: 700, dy: -140, exitSlope: -0.32, material: "grass" },
      { name: "First Kicker Jump", type: "kicker", dx: 750, dy: -40, exitSlope: 0.15, material: "dirt" },
      { name: "Deep Valley Bowl", type: "bowl", dx: 650, dy: 60, exitSlope: -0.25, material: "dirt" },
      { name: "Camelback Double", type: "camelback", dx: 700, dy: -50, exitSlope: 0.0, material: "grass" },
      { name: "Base Camp Plateau", type: "plateau", dx: 550, dy: -10, exitSlope: 0.0, material: "grass" },
      { name: "Stone Ridge Ascent", type: "climb", dx: 800, dy: -210, exitSlope: -0.42, material: "rock" },
      { name: "Crag Crest Drop", type: "crest", dx: 650, dy: 70, exitSlope: 0.28, material: "rock" },
      { name: "Ridge Launch Kicker", type: "kicker", dx: 800, dy: -60, exitSlope: 0.18, material: "rock" },
      { name: "Technical Moguls", type: "scramble", dx: 700, dy: -80, exitSlope: -0.15, material: "gravel" },
      { name: "High Crag Plateau", type: "plateau", dx: 600, dy: -15, exitSlope: 0.0, material: "rock" },
      { name: "Canyon Gorge Descent", type: "descent", dx: 750, dy: 160, exitSlope: 0.38, material: "dirt" },
      { name: "Old Trestle Chasm Jump", type: "chasm", dx: 850, dy: -30, exitSlope: 0.10, material: "wood" },
      { name: "Canyon Cliff Run", type: "rollers", dx: 700, dy: -90, exitSlope: -0.22, material: "dirt" },
      { name: "Mine Pithead Approach", type: "climb", dx: 750, dy: -180, exitSlope: -0.35, material: "gravel" },
      { name: "Slag Heap Kicker", type: "kicker", dx: 800, dy: -50, exitSlope: 0.20, material: "gravel" },
      { name: "Industrial Works Plateau", type: "plateau", dx: 650, dy: -20, exitSlope: 0.0, material: "gravel" },
      { name: "Summit Ridge Climb", type: "climb", dx: 850, dy: -260, exitSlope: -0.45, material: "snow" },
      { name: "Glacier Bowl", type: "bowl", dx: 700, dy: 80, exitSlope: -0.28, material: "ice" },
      { name: "Summit Observatory Kicker", type: "kicker", dx: 900, dy: -70, exitSlope: 0.15, material: "snow" },
      { name: "Summit Panoramic Plateau", type: "plateau", dx: 800, dy: -10, exitSlope: 0.0, material: "snow" },
    ];

    let curX = startX + 350;
    let curY = groundBase;
    let curSlope = 0.0;
    let seqIdx = 0;

    // Generate consecutive segments with C1 Hermite Continuity
    while (curX < totalLength) {
      const tmpl = grammarSequence[seqIdx % grammarSequence.length];
      seqIdx++;

      const distMeters = Math.max(0, (curX - startX) / 40);
      const difficulty = b(distMeters / 1000, 0, 1);
      const biome = this.getBiomeAtDist(distMeters);

      const segLen = tmpl.dx * (0.9 + Math.abs(nSwell(curX / 900)) * 0.25);
      const segDy = tmpl.dy * (1.0 + difficulty * 0.35);
      const targetSlope = tmpl.exitSlope * (1.0 + difficulty * 0.25);

      const x0 = curX;
      const y0 = curY;
      const m0 = curSlope;
      const x1 = curX + segLen;
      const y1 = curY + segDy;
      const m1 = targetSlope;

      this.segments.push({
        name: tmpl.name,
        type: tmpl.type,
        startX: x0,
        endX: x1,
        startY: y0,
        endY: y1,
        material: tmpl.material,
      });

      // Sample along Cubic Hermite Spline
      // P(u) = (2u^3 - 3u^2 + 1)y0 + (u^3 - 2u^2 + u)L*m0 + (-2u^3 + 3u^2)y1 + (u^3 - u^2)L*m1
      const L = x1 - x0;
      for (let q = x0 + this.step; q <= x1; q += this.step) {
        const u = (q - x0) / L;
        const u2 = u * u;
        const u3 = u2 * u;

        const h00 = 2 * u3 - 3 * u2 + 1;
        const h10 = u3 - 2 * u2 + u;
        const h01 = -2 * u3 + 3 * u2;
        const h11 = u3 - u2;

        let y = h00 * y0 + h10 * L * m0 + h01 * y1 + h11 * L * m1;

        // Add fine organic micro-features based on segment type
        if (tmpl.type === "rollers" || tmpl.type === "camelback") {
          y += Math.sin(u * Math.PI * 4) * (14.0 + difficulty * 8.0);
        } else if (tmpl.type === "kicker") {
          // Sharp takeoff lip followed by dip
          if (u < 0.45) {
            y -= Math.sin(u / 0.45 * Math.PI * 0.5) * (26.0 + difficulty * 16.0);
          } else {
            y += Math.sin((u - 0.45) / 0.55 * Math.PI) * (16.0 + difficulty * 10.0);
          }
        } else if (tmpl.type === "scramble") {
          y += nDetail(q / 60.0) * (10.0 + difficulty * 6.0);
        }

        // Safety Validation: enforce max drivable slope derivative (<= 46 degrees)
        const prev = this.samples[this.samples.length - 1];
        const dx = q - prev.x;
        const dy = y - prev.y;
        const maxDy = dx * Math.tan(0.80); // ~46 degrees max
        if (Math.abs(dy) > maxDy) {
          y = prev.y + Math.sign(dy) * maxDy;
        }

        const actualSlope = (y - prev.y) / dx;
        let mat = tmpl.material;
        if (Math.abs(actualSlope) > 0.55 && biome.id !== "summit") {
          mat = "rock";
        } else if (biome.id === "summit" && Math.abs(actualSlope) < 0.2) {
          mat = "ice";
        }

        this.samples.push({
          x: q,
          y: y,
          material: mat,
          biomeId: biome.id,
          slope: actualSlope,
        });
      }

      curX = x1;
      curY = this.samples[this.samples.length - 1].y;
      curSlope = this.samples[this.samples.length - 1].slope;
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

  segmentAt(xPos) {
    for (const seg of this.segments) {
      if (xPos >= seg.startX && xPos < seg.endX) {
        return seg;
      }
    }
    return this.segments[this.segments.length - 1] ?? { name: "Trail", type: "rollers" };
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
  tuck = 0;

  update(vehicle, input, dt) {
    const dtSec = dt / 1000;
    const accel = vehicle.forwardSpeed - (vehicle.lastForwardSpeed ?? vehicle.forwardSpeed);
    vehicle.lastForwardSpeed = vehicle.forwardSpeed;

    const throttleLean = -input.throttle * 0.24;
    const brakeLean = input.brake * 0.28;
    const accelLean = -b(accel * 0.38, -0.32, 0.32);
    const slopeLean = -b(vehicle.chassis.angle * 0.25, -0.25, 0.25);
    const airLean = vehicle.airborne ? -0.12 : 0;

    // Rollover protection tuck reaction
    const isInverted = Math.abs(Math.sin(vehicle.chassis.angle)) > 0.82;
    if (isInverted) {
      this.tuck = G0(this.tuck, 1.0, 14, dt);
    } else {
      this.tuck = G0(this.tuck, 0.0, 8, dt);
    }

    this.targetLean = (throttleLean + brakeLean + accelLean + slopeLean + airLean) * (1 - this.tuck * 0.5);

    const springK = 20.0;
    const damping = 0.70;
    const force = (this.targetLean - this.lean) * springK;
    this.leanVel = (this.leanVel + force * dtSec) * Math.pow(damping, dtSec * 60);
    this.lean += this.leanVel * dtSec;
    this.lean = b(this.lean, -0.45, 0.45);

    const joltForce = -this.jolt * 28.0;
    this.joltVel = (this.joltVel + joltForce * dtSec) * Math.pow(0.62, dtSec * 60);
    this.jolt += this.joltVel * dtSec;
    this.jolt = b(this.jolt, -3.5, 3.5);

    const targetHelmet = this.lean * 0.72 + vehicle.chassis.angularVelocity * 0.35 + (this.tuck * 0.4);
    this.helmetAngle = G0(this.helmetAngle, targetHelmet, 14, dt);

    this.victory = Math.max(0, this.victory - dtSec * 0.45);
  }

  applyShock(energy) {
    this.jolt += b(energy * 0.35, 0.4, 2.0);
    this.jolt = b(this.jolt, -3.5, 3.5);
    this.lean += (Math.random() - 0.5) * 0.20;
  }

  triggerVictory() {
    this.victory = 1.2;
  }
}

// ----------------------------------------------------------------------------
// Expedition Vehicle (f0)
// ----------------------------------------------------------------------------
class f0 {
  archetype;
  chassis;
  wheels = [];
  constraints = [];
  composite;
  driver = new Driver();
  audio = null;
  airborneTimer = 0;

  constructor(xPos, yPos, archetypeId = "buggy", audio = null) {
    this.audio = audio;
    this.setArchetype(archetypeId, xPos, yPos);
  }

  setArchetype(archetypeId, xPos = null, yPos = null) {
    const vCfg = VEHICLE_ARCHETYPES[archetypeId] ?? VEHICLE_ARCHETYPES.buggy;
    this.archetype = vCfg;
    x.activeArchetype = vCfg.id;
    x.vehicle = vCfg;

    const posX = xPos ?? this.chassis?.position.x ?? x.world.startX;
    const posY = yPos ?? this.chassis?.position.y ?? x.world.groundBase - 58;

    this.chassis = d.default.Bodies.rectangle(
      posX,
      posY,
      vCfg.chassisWidth,
      vCfg.chassisHeight,
      {
        label: "chassis",
        collisionFilter: { group: -3 },
        density: vCfg.chassisMass / (vCfg.chassisWidth * vCfg.chassisHeight),
        friction: 0.10,
        frictionAir: 0.003,
        restitution: 0.12,
        chamfer: { radius: [6, 6, 12, 12] },
      }
    );

    // Calculate polar moment of inertia for responsive, agile HCR handling
    const defInertia = (vCfg.chassisMass * (vCfg.chassisWidth * vCfg.chassisWidth + vCfg.chassisHeight * vCfg.chassisHeight)) / 12;
    Matter.Body.setInertia(this.chassis, defInertia * 1.6);

    // Lower Center of Mass slightly for natural stability
    Matter.Body.setCentre(this.chassis, { x: 0, y: 2 }, true);

    const wheelOffsets = [
      { x: -vCfg.wheelBase / 2, y: vCfg.wheelOffsetY }, // Rear wheel
      { x: vCfg.wheelBase / 2, y: vCfg.wheelOffsetY },  // Front wheel
    ];

    this.wheels = [];
    this.constraints = [];

    for (let i = 0; i < wheelOffsets.length; i++) {
      const off = wheelOffsets[i];
      const wheel = d.default.Bodies.circle(
        posX + off.x,
        posY + off.y,
        vCfg.wheelRadius,
        {
          label: "wheel",
          collisionFilter: { group: -3 },
          density: vCfg.wheelMass / (Math.PI * vCfg.wheelRadius * vCfg.wheelRadius),
          friction: vCfg.tireGrip,
          frictionStatic: vCfg.tireGrip * 1.4,
          frictionAir: 0.0025,
          restitution: 0.18, // Bouncy, energetic HCR tires!
          slop: 0.02,
        }
      );

      // Authentic Trailing/Leading Swingarm + Strut Architecture:
      // Radius arm constrains the wheel to a smooth circular travel arc,
      // while the spring strut provides authentic Hooke compression and rebound.
      // Geometrically immune to inversion.
      const isRear = i === 0;
      const armSpread = isRear ? 28 : -28;
      const armAnchor = { x: off.x + armSpread, y: 8 };
      const armLen = Math.hypot(armSpread, vCfg.wheelOffsetY - armAnchor.y);

      const swingArm = d.default.Constraint.create({
        bodyA: this.chassis,
        pointA: armAnchor,
        bodyB: wheel,
        length: armLen,
        stiffness: 0.90,
        damping: 0.06,
      });

      const springStrut = d.default.Constraint.create({
        bodyA: this.chassis,
        pointA: { x: off.x, y: 0 },
        bodyB: wheel,
        length: vCfg.wheelOffsetY,
        stiffness: vCfg.suspensionStiffness,
        damping: vCfg.suspensionDamping,
      });

      this.constraints.push(swingArm, springStrut);

      this.wheels.push({
        body: wheel,
        restOffset: off,
        compression: 0,
        lastCompression: 0,
        contact: true, // start grounded
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

  normalLoads = { front: 0, rear: 0 };
  roofContact = false;

  get rpm() {
    const maxSpin = Math.max(...this.wheels.map((w) => Math.abs(w.body.angularVelocity)));
    return b(maxSpin / this.archetype.maxWheelSpeed, 0, 1.4);
  }

  get airborne() {
    return !this.wheels.some((w) => w.contact);
  }

  update(input, dt, terrain = null) {
    const vCfg = this.archetype;
    const throttleBrake = input.throttle - input.brake;
    const dtSec = Math.max(0.001, dt / 1000);

    if (this.airborne) {
      this.airborneTimer += dt;
    } else {
      this.airborneTimer = 0;
    }

    // Dynamic Normal Load Distribution (Spec #03):
    // N_front = [mg(b cos theta - h sin theta) - m h a_x] / L
    // N_rear  = [mg(a cos theta + h sin theta) + m h a_x] / L
    const theta = this.chassis.angle;
    const ax = (this.forwardSpeed - (this.lastForwardSpeed ?? this.forwardSpeed)) / dtSec;
    const m = this.chassis.mass;
    const g = 9.81 * 8.0;
    const W = m * g;
    const L = vCfg.wheelBase;
    const b_dist = L / 2;
    const a_dist = L / 2;
    const h = vCfg.centerOfMassOffsetY ?? 8.0;

    const nFront = Math.max(0.1, (W * (b_dist * Math.cos(theta) - h * Math.sin(theta)) - m * h * ax) / L);
    const nRear = Math.max(0.1, (W * (a_dist * Math.cos(theta) + h * Math.sin(theta)) + m * h * ax) / L);
    this.normalLoads = { front: nFront, rear: nRear };

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const isRear = i === 0;
      const torqueShare = isRear ? 0.55 : 0.45;
      const normalLoad = isRear ? nRear : nFront;
      const spin = w.body.angularVelocity;
      const speedRatio = b(1 - Math.abs(spin) / vCfg.maxWheelSpeed, 0, 1);

      // Wheel Slip Ratio & Saturating Traction Curve S(kappa)
      const R = vCfg.wheelRadius;
      const rw = spin * R;
      const vx = this.forwardSpeed;
      const denom = Math.max(Math.abs(rw), Math.abs(vx), 0.1);
      w.slipRatio = b((rw - vx) / denom, -1.5, 1.5);

      let sKappa = 0;
      const absK = Math.abs(w.slipRatio);
      if (absK < 0.18) {
        sKappa = (absK / 0.18) * Math.sign(w.slipRatio);
      } else {
        sKappa = (1.0 - 0.22 * Math.min(1.0, (absK - 0.18) / 0.82)) * Math.sign(w.slipRatio);
      }

      if (throttleBrake !== 0) {
        const isDriving = Math.sign(throttleBrake) === Math.sign(spin) || Math.abs(spin) < 0.03;
        const torque = isDriving
          ? vCfg.engineTorque * speedRatio * throttleBrake
          : vCfg.brakeTorque * throttleBrake;

        w.body.torque += torque * torqueShare * w.body.mass * 24;

        if (w.contact) {
          const mat = MATERIALS[w.material] ?? MATERIALS.dirt;
          const forwardDir = {
            x: Math.cos(this.chassis.angle),
            y: Math.sin(this.chassis.angle),
          };
          const tractiveMag = torque * torqueShare * mat.friction * 0.24;
          Matter.Body.applyForce(this.chassis, this.chassis.position, {
            x: forwardDir.x * tractiveMag,
            y: forwardDir.y * tractiveMag,
          });
        }
      } else {
        d.default.Body.setAngularVelocity(w.body, spin * 0.992);
      }

      // Suspension travel & Hooke spring-damper compression
      const mountWorld = d.default.Vector.add(
        this.chassis.position,
        d.default.Vector.rotate(
          { x: w.restOffset.x, y: 0 },
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

      const deltaComp = w.compression - w.lastCompression;
      if (deltaComp > 0.26 && w.compression > 0.35 && this.audio) {
        this.audio.creak(deltaComp);
      }
      w.lastCompression = w.compression;
      w.slip = Math.abs(spin * vCfg.wheelRadius - this.forwardSpeed);
    }

    // -------------------------------------------------------------------------
    // GENUINE HILL CLIMB RACING PITCH CONTROL (GROUND & AIR)
    // Gas (D) -> Tilts Nose UP (CCW)
    // Brake (A) -> Tilts Nose DOWN (CW)
    // -------------------------------------------------------------------------
    if (throttleBrake !== 0) {
      const dir = -Math.sign(throttleBrake); // throttle = -1 (CCW / Nose UP), brake = +1 (CW / Nose DOWN)
      if (this.airborne && this.airborneTimer >= 60) {
        const angVel = this.chassis.angularVelocity;
        const spinLimit = b(1 - Math.abs(angVel) / 0.18, 0, 1);
        const opposing = Math.sign(dir) !== Math.sign(angVel) ? 1.0 : spinLimit;
        const airTorque = dir * Math.abs(throttleBrake) * vCfg.airControl * opposing * this.chassis.mass * 24;
        this.chassis.torque += airTorque;
      } else if (!this.airborne) {
        // Subtle ground reaction: Gas lifts nose into wheelie, Brake presses nose down
        const groundPitch = dir * Math.abs(throttleBrake) * 0.003 * this.chassis.mass;
        this.chassis.torque += groundPitch;
      }
    }

    // Dynamic 2-wheel grounded stability (damping ground oscillation)
    if (this.wheels[0].contact && this.wheels[1].contact) {
      this.chassis.torque += -0.008 * this.chassis.mass * this.chassis.angularVelocity;
    }

    // Inverted Self-Righting Roll Recovery (when resting on roof)
    const isUpsideDown = !this.airborne && (Math.abs(normalizeAngle(this.chassis.angle)) > 1.65 || this.roofContact);
    if (isUpsideDown && throttleBrake !== 0) {
      const rollDir = Math.sign(throttleBrake);
      this.chassis.torque += rollDir * this.chassis.mass * 0.40;
      Matter.Body.applyForce(this.chassis, this.chassis.position, {
        x: rollDir * 0.016 * this.chassis.mass,
        y: -0.028 * this.chassis.mass,
      });
    }

    const damping = this.airborne ? vCfg.angularDamping : vCfg.angularDamping * 2.2;
    const factor = 1 - Math.min(damping * (dt / 16.666), 0.5);
    d.default.Body.setAngularVelocity(this.chassis, this.chassis.angularVelocity * factor);

    this.driver.update(this, input, dt);
  }

  markContacts(terrainSet, activePairs) {
    for (const w of this.wheels) w.contact = false;
    this.roofContact = false;

    for (const pair of activePairs) {
      const { bodyA, bodyB } = pair;
      const w = this.wheels.find((wheel) => wheel.body === bodyA || wheel.body === bodyB);
      if (w) {
        const other = bodyA === w.body ? bodyB : bodyA;
        if (terrainSet.has(other)) {
          w.contact = true;
          w.material = other.materialKind ?? "grass";
        }
      }

      // Check chassis roof contact
      const isChassis = bodyA === this.chassis || bodyB === this.chassis;
      if (isChassis) {
        const other = bodyA === this.chassis ? bodyB : bodyA;
        if (terrainSet.has(other)) {
          const supports = pair.collision?.supports ?? [];
          for (const pt of supports) {
            if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
            const relY = (pt.x - this.chassis.position.x) * -Math.sin(this.chassis.angle) +
                         (pt.y - this.chassis.position.y) * Math.cos(this.chassis.angle);
            if (relY < -this.archetype.chassisHeight * 0.2) {
              this.roofContact = true;
            }
          }
        }
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
  groundedTime = 200;
  airDistance = 0;
  airApexY = Infinity;
  launchX = 0;
  launchY = 0;
  cumulativeAngle = 0;
  prevAngle = 0;
  backflips = 0;
  frontflips = 0;
  wheelieTime = 0;
  wheelieDistance = 0;
  stoppieTime = 0;
  stoppieDistance = 0;
  comboMultiplier = 1;
  comboScore = 0;
  comboTimer = 0;
  activeStuntName = "";

  constructor(bus, audio, camera) {
    this.bus = bus;
    this.audio = audio;
    this.camera = camera;
  }

  reset() {
    this.airtime = 0;
    this.groundedTime = 200;
    this.airDistance = 0;
    this.airApexY = Infinity;
    this.cumulativeAngle = 0;
    this.prevAngle = 0;
    this.backflips = 0;
    this.frontflips = 0;
    this.wheelieTime = 0;
    this.wheelieDistance = 0;
    this.stoppieTime = 0;
    this.stoppieDistance = 0;
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
      if (this.groundedTime >= 150 || (this.airtime === 0 && this.cumulativeAngle === 0)) {
        this.launchX = chassis.position.x;
        this.launchY = chassis.position.y;
        this.prevAngle = chassis.angle;
        this.airApexY = chassis.position.y;
        this.cumulativeAngle = 0;
        this.backflips = 0;
        this.frontflips = 0;
      }
      this.groundedTime = 0;

      this.airtime += dt;
      this.airDistance = Math.abs(chassis.position.x - this.launchX) / 40;
      this.airApexY = Math.min(this.airApexY, chassis.position.y);

      let deltaAngle = chassis.angle - this.prevAngle;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      this.cumulativeAngle += deltaAngle;
      this.prevAngle = chassis.angle;

      // Negative cumulative angle = counter-clockwise = BACKFLIP
      if (this.cumulativeAngle <= -(Math.PI * 2 * (this.backflips + 1) - 0.4)) {
        this.backflips++;
        const name = this.backflips === 1 ? "BACKFLIP" : this.backflips === 2 ? "DOUBLE BACKFLIP" : `TRIPLE BACKFLIP`;
        const score = this.backflips * 260;
        this.awardStunt(name, score, 2);
        vehicle.driver.triggerVictory();
      } else if (this.cumulativeAngle >= Math.PI * 2 * (this.frontflips + 1) - 0.4) {
        // Positive cumulative angle = clockwise = FRONTFLIP
        this.frontflips++;
        const name = this.frontflips === 1 ? "FRONTFLIP" : this.frontflips === 2 ? "DOUBLE FRONTFLIP" : `TRIPLE FRONTFLIP`;
        const score = this.frontflips * 300;
        this.awardStunt(name, score, 2);
        vehicle.driver.triggerVictory();
      }
    } else {
      this.groundedTime += dt;
      this.checkGroundStunts(vehicle, terrain, dt);
    }
  }

  checkGroundStunts(vehicle, terrain, dt) {
    const rear = vehicle.wheels[0];
    const front = vehicle.wheels[1];
    const slope = terrain.slopeAt(vehicle.chassis.position.x);
    const relAngle = vehicle.chassis.angle - slope;

    // Wheelie: rear wheel contacts, front wheel elevated, nose pitched up (relAngle < -0.22)
    if (rear.contact && !front.contact && relAngle < -0.22 && vehicle.forwardSpeed > 3.0) {
      this.wheelieTime += dt;
      this.wheelieDistance += (vehicle.forwardSpeed * dt) / 1000;
      if (this.wheelieTime > 400) {
        const step = Math.floor((this.wheelieTime - 400) / 350);
        const prevStep = Math.floor((this.wheelieTime - dt - 400) / 350);
        if (step > prevStep) {
          const score = 80 + step * 40;
          this.awardStunt(`WHEELIE (${(this.wheelieDistance / 2).toFixed(0)}m)`, score, 1);
        }
      }
    } else {
      this.wheelieTime = 0;
      this.wheelieDistance = 0;
    }

    // Stoppie: front wheel contacts, rear elevated, nose pitched down (relAngle > 0.22)
    if (front.contact && !rear.contact && relAngle > 0.22 && vehicle.forwardSpeed > 2.5) {
      this.stoppieTime += dt;
      this.stoppieDistance += (vehicle.forwardSpeed * dt) / 1000;
      if (this.stoppieTime > 400) {
        const step = Math.floor((this.wheelieTime - 400) / 350);
        const prevStep = Math.floor((this.wheelieTime - dt - 400) / 350);
        if (step > prevStep) {
          const score = 100 + step * 50;
          this.awardStunt(`STOPPIE (${(this.stoppieDistance / 2).toFixed(0)}m)`, score, 1);
        }
      }
    } else {
      this.stoppieTime = 0;
      this.stoppieDistance = 0;
    }
  }

  onLanding(vehicle, terrain) {
    if (this.airtime < 220) {
      this.airtime = 0;
      this.groundedTime = 0;
      return;
    }

    const chassis = vehicle.chassis;
    const slope = terrain.slopeAt(chassis.position.x);
    const angleDiff = Math.abs(normalizeAngle(chassis.angle - slope));
    const vertSpeed = Math.abs(chassis.velocity.y);
    const apexHeight = this.launchY - this.airApexY;

    if (this.airtime > 720 || apexHeight > 65) {
      this.awardStunt("BIG AIR", 180, 1);
    }
    if (this.airDistance > 26) {
      this.awardStunt("LONG JUMP", 200, 1);
    }

    // Landing quality evaluation
    if (angleDiff < 0.19 && vertSpeed < 14) {
      this.comboMultiplier = Math.min(this.comboMultiplier + 1, 8);
      this.awardStunt("PERFECT LANDING", 160 * this.comboMultiplier, 3);
      this.camera.pulseZoom(0.04);
      vehicle.driver.triggerVictory();
      // Forward momentum boost for rewarding skillful landing
      const forwardDir = { x: Math.cos(chassis.angle), y: Math.sin(chassis.angle) };
      Matter.Body.applyForce(chassis, chassis.position, {
        x: forwardDir.x * 0.03 * chassis.mass,
        y: forwardDir.y * 0.03 * chassis.mass,
      });
    } else if (angleDiff < 0.40) {
      this.awardStunt("CLEAN LANDING", 60, 1);
      this.camera.pulseZoom(0.015);
    } else if (angleDiff >= 0.72 || vertSpeed > 22) {
      this.breakCombo();
      this.camera.shake(0.30, 240);
      Matter.Body.setVelocity(chassis, {
        x: chassis.velocity.x * 0.82,
        y: chassis.velocity.y * 0.82,
      });
    }

    this.airtime = 0;
    this.groundedTime = 0;
  }

  awardStunt(name, score, tier = 1) {
    this.comboScore += score;
    this.comboTimer = 4.0;
    this.activeStuntName = name;
    this.audio?.stuntChime(tier);

    this.bus.emit("stunt:awarded", {
      name: name,
      score: score,
      multiplier: this.comboMultiplier,
      tier: tier,
      totalComboScore: this.comboScore,
    });
  }

  showToast(name, tier = 1) {
    this.bus.emit("stunt:awarded", {
      name: name,
      score: 0,
      multiplier: 1,
      tier: tier,
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
// Three.js 2.5D Visual Depth Layer (Spec #31, #32, #33, #34, #35)
// Synchronized with authoritative Matter.js 2D simulation
// ----------------------------------------------------------------------------
class ThreeVisualDepth {
  canvas = null;
  renderer = null;
  scene = null;
  camera = null;
  mountains = [];
  echoMeshes = new Map();
  enabled = false;

  constructor(canvas) {
    this.canvas = canvas;
    this.init();
  }

  init() {
    if (typeof THREE === "undefined" || !this.canvas) {
      return;
    }

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance"
      });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0xded2be, 0.00035);

      this.camera = new THREE.PerspectiveCamera(
        42,
        window.innerWidth / window.innerHeight,
        10,
        15000
      );
      this.camera.position.set(0, 0, 1100);

      // Warm directional sunlight + ambient fill
      const sun = new THREE.DirectionalLight(0xffecd2, 1.25);
      sun.position.set(500, 1000, 800);
      this.scene.add(sun);

      const hemiLight = new THREE.HemisphereLight(0xb4c7be, 0x48534e, 0.65);
      this.scene.add(hemiLight);

      this.buildMountainSilhouettes();
      this.enabled = true;
    } catch (err) {
      console.warn("[ThreeVisualDepth] WebGL unavailable, falling back to 2D canvas depth:", err);
      this.enabled = false;
    }
  }

  buildMountainSilhouettes() {
    if (!this.scene) return;
    const layerDefs = [
      { z: -2800, scaleY: 650, color: 0x5c6b65, segs: 28 },
      { z: -1600, scaleY: 480, color: 0x48534e, segs: 36 },
      { z: -800,  scaleY: 340, color: 0x343d39, segs: 44 }
    ];

    for (const l of layerDefs) {
      const geom = new THREE.PlaneGeometry(8000, l.scaleY, l.segs, 4);
      const pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y > 0) {
          const x = pos.getX(i);
          const ridge = Math.sin(x * 0.004) * 80 + Math.sin(x * 0.012) * 45;
          pos.setY(i, y + ridge);
        }
      }
      geom.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({
        color: l.color,
        flatShading: true,
        transparent: true,
        opacity: 0.88
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(0, -60, l.z);
      this.scene.add(mesh);
      this.mountains.push({ mesh, def: l });
    }
  }

  updateEchoes(relics) {
    if (!this.scene) return;
    for (const relic of relics) {
      if (!this.echoMeshes.has(relic.id)) {
        const geom = new THREE.OctahedronGeometry(14, 0);
        const mat = new THREE.MeshLambertMaterial({
          color: 0xd4622a,
          emissive: 0x552200,
          flatShading: true,
          transparent: true,
          opacity: 0.90
        });
        const mesh = new THREE.Mesh(geom, mat);
        this.scene.add(mesh);
        this.echoMeshes.set(relic.id, mesh);
      }
      const mesh = this.echoMeshes.get(relic.id);
      if (relic.collected) {
        mesh.visible = false;
      } else {
        mesh.visible = true;
        mesh.position.set((relic.x - 220) * 0.35, (-relic.y + 560) * 0.35, -20);
        mesh.rotation.y = relic.rotation;
        mesh.rotation.x = relic.rotation * 0.7;
      }
    }
  }

  sync(cam, vehicle, relics) {
    if (!this.enabled || !this.renderer || !this.camera) return;

    const targetX = (cam.x - 220) * 0.35;
    const targetY = (-cam.y + 560) * 0.35;
    const targetZ = 850 / cam.zoom;

    this.camera.position.x = targetX;
    this.camera.position.y = targetY;
    this.camera.position.z = targetZ;
    this.camera.lookAt(targetX, targetY, 0);

    for (const m of this.mountains) {
      m.mesh.position.x = targetX * (1 + m.def.z * 0.0003);
    }

    if (relics) {
      this.updateEchoes(relics);
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}

// ----------------------------------------------------------------------------
// Illustrated Mountain Expeditions Renderer (R0)
// ----------------------------------------------------------------------------
class R0 {
  ctx;
  terrain;
  lastBiomeId = "meadow";
  biomeTransition = 1.0;
  grainCanvas = null;

  constructor(ctx, terrain) {
    this.ctx = ctx;
    this.terrain = terrain;
  }

  setTerrain(terrain) {
    this.terrain = terrain;
  }

  render(camera, vehicle, particles, propManager, width, height, time, debug, allBodies = [], game = null) {
    const ctx = this.ctx;
    const biome = this.terrain.biomeAt(camera.x);

    // Sync Three.js 2.5D visual depth layer
    if (game?.threeDepth) {
      game.threeDepth.sync(camera, vehicle, game.echoManager?.relics);
    }

    ctx.save();
    this.drawSky(width, height, camera, biome);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    const shake = camera.shakeOffset;
    ctx.translate(-camera.x + shake.x, -camera.y + shake.y);

    this.drawParallax(camera, width, height, time, biome);
    this.drawTerrain(camera, width, height, biome);
    this.drawProps(propManager, camera);

    if (game?.echoManager) {
      this.drawMountainEchoes(game.echoManager, camera);
    }

    this.drawParticles(particles, ["dust", "snow", "grass", "wood"]);
    this.drawVehicle(vehicle, biome);
    this.drawParticles(particles, ["spark", "grit", "stone"]);

    if (debug) {
      this.drawDebug(allBodies, vehicle, camera, game);
    }

    ctx.restore();

    this.drawGrain(width, height);
    this.drawVignette(width, height);

    if (debug && game) {
      this.drawDebugPanel(game, width, height);
    }

    ctx.restore();
  }

  drawSky(w, h, cam, biome) {
    if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, biome.skyTop);
    grad.addColorStop(1, biome.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Warm mountain sun/glow
    ctx.save();
    const span = Math.max(10, w * 0.5);
    const sunX = w * 0.72 - ((cam?.x || 0) * 0.015) % span;
    const sunY = h * 0.28;
    if (Number.isFinite(sunX) && Number.isFinite(sunY)) {
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 140);
      sunGlow.addColorStop(0, biome.sun);
      sunGlow.addColorStop(0.35, "rgba(227,126,61,0.22)");
      sunGlow.addColorStop(1, "rgba(239,231,214,0)");
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 140, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawParallax(cam, w, h, time, biome) {
    const ctx = this.ctx;
    const layers = [
      { speed: 0.08, base: 260, amp: 140, freq: 0.0016, color: biome.far, opacity: 0.60, seed: 31 },
      { speed: 0.22, base: 180, amp: 110, freq: 0.0025, color: biome.mid, opacity: 0.78, seed: 44 },
      { speed: 0.42, base: 110, amp: 75, freq: 0.0038, color: biome.near, opacity: 0.92, seed: 57 },
    ];

    const spanX = w / cam.zoom;
    const left = cam.x - spanX * 0.8;
    const right = cam.x + spanX * 0.8;
    const bottomY = Math.max(cam.y + (h / cam.zoom) + 600, 4000);
    const step = 20;

    layers.forEach((l) => {
      const noise = K0(l.seed);
      ctx.save();
      ctx.fillStyle = l.color;
      ctx.globalAlpha = l.opacity;
      ctx.beginPath();
      ctx.moveTo(left - 20, bottomY);
      for (let px = left - 20; px <= right + 20; px += step) {
        const z = (px - cam.x) * l.speed + cam.x;
        const ridge = noise(z * l.freq) * l.amp + noise(z * l.freq * 3.8) * (l.amp * 0.28);
        const py = x.world.groundBase - l.base - ridge;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(right + 20, bottomY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  drawTerrain(cam, w, h, biome) {
    const ctx = this.ctx;
    const terrain = this.terrain;
    const spanX = w / cam.zoom;
    const left = cam.x - spanX * 0.75;
    const right = cam.x + spanX * 0.75;

    const firstX = terrain.samples[0]?.x ?? 0;
    const step = terrain.step;
    const maxIdx = terrain.samples.length - 1;
    const startIdx = Math.max(0, Math.min(maxIdx, Math.floor((left - firstX) / step) - 2));
    const endIdx = Math.max(0, Math.min(maxIdx, Math.ceil((right - firstX) / step) + 2));

    if (startIdx >= endIdx || !terrain.samples[startIdx] || !terrain.samples[endIdx]) return;

    // 1. Terrain Bedrock Fill
    const bottomY = Math.max(cam.y + (h / cam.zoom) + 600, 4000);
    ctx.save();
    ctx.fillStyle = biome.groundFill;
    ctx.beginPath();
    ctx.moveTo(terrain.samples[startIdx].x, bottomY);

    for (let i = startIdx; i <= endIdx; i++) {
      const p = terrain.samples[i];
      if (p) ctx.lineTo(p.x, p.y);
    }

    ctx.lineTo(terrain.samples[endIdx].x, bottomY);
    ctx.closePath();
    ctx.fill();

    // 2. Illustrated Top Crust / Foliage Ribbon
    ctx.lineWidth = 9.0;
    ctx.strokeStyle = biome.groundTop;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    let moved = false;
    for (let i = startIdx; i <= endIdx; i++) {
      const p = terrain.samples[i];
      if (!p) continue;
      if (!moved) { ctx.moveTo(p.x, p.y); moved = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // 3. Highlight Ink Line
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = biome.groundTopLight;
    ctx.beginPath();
    moved = false;
    for (let i = startIdx; i <= endIdx; i++) {
      const p = terrain.samples[i];
      if (!p) continue;
      if (!moved) { ctx.moveTo(p.x, p.y - 1.5); moved = true; }
      else ctx.lineTo(p.x, p.y - 1.5);
    }
    ctx.stroke();

    // 4. Subtle Contour Ink Edge
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#1b1f1d";
    ctx.beginPath();
    moved = false;
    for (let i = startIdx; i <= endIdx; i++) {
      const p = terrain.samples[i];
      if (!p) continue;
      if (!moved) { ctx.moveTo(p.x, p.y - 3.5); moved = true; }
      else ctx.lineTo(p.x, p.y - 3.5);
    }
    ctx.stroke();
    ctx.restore();

    this.drawTerrainDetails(terrain, left, right, biome);
    this.drawLandmarks(cam, left, right);
  }

  drawTerrainDetails(terrain, left, right, biome) {
    const ctx = this.ctx;
    ctx.save();
    const step = 32;
    const start = Math.floor(left / step) * step;
    const end = Math.ceil(right / step) * step;

    for (let q = start; q <= end; q += step) {
      const y = terrain.heightAt(q);
      const slope = terrain.slopeAt(q);
      const mat = terrain.materialAt(q);

      if (mat.name === "grass") {
        ctx.strokeStyle = biome.accent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(q, y - 2);
        ctx.lineTo(q + 3, y - 8);
        ctx.moveTo(q + 4, y - 2);
        ctx.lineTo(q + 8, y - 9);
        ctx.stroke();
      } else if (mat.name === "rock" || mat.name === "gravel") {
        ctx.fillStyle = "#1b1f1d";
        ctx.beginPath();
        ctx.arc(q + 2, y - 2, 2.0, 0, Math.PI * 2);
        ctx.arc(q + 10, y - 1, 1.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (mat.name === "snow") {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.ellipse(q + 5, y - 2, 5, 2, slope, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawLandmarks(cam, left, right) {
    const ctx = this.ctx;
    for (const b of BIOMES) {
      const lm = b.landmark;
      if (!lm || lm.x < left - 80 || lm.x > right + 80) continue;
      const ly = this.terrain.heightAt(lm.x);

      ctx.save();
      ctx.translate(lm.x, ly);

      if (lm.type === "shelter") {
        // Base Camp Outpost Cabin - Elevated to scenic background ridge off the road
        ctx.save();
        ctx.translate(0, -95);
        ctx.scale(0.68, 0.68);
        ctx.globalAlpha = 0.65;

        // Timber foundation stilts on the background cliff
        ctx.strokeStyle = "#5a4d41";
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(-24, 0); ctx.lineTo(-24, 95);
        ctx.moveTo(0, 0); ctx.lineTo(0, 95);
        ctx.moveTo(24, 0); ctx.lineTo(24, 95);
        ctx.moveTo(-24, 45); ctx.lineTo(24, 75);
        ctx.moveTo(24, 45); ctx.lineTo(-24, 75);
        ctx.stroke();

        // Cabin body
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 2.4;
        ctx.fillStyle = "#d9cfb8";
        ctx.fillRect(-32, -34, 64, 34);
        ctx.strokeRect(-32, -34, 64, 34);

        // Window with warm lantern light
        ctx.fillStyle = "#efd07b";
        ctx.fillRect(-16, -24, 12, 12);
        ctx.strokeRect(-16, -24, 12, 12);
        ctx.beginPath();
        ctx.moveTo(-10, -24); ctx.lineTo(-10, -12);
        ctx.moveTo(-16, -18); ctx.lineTo(-4, -18);
        ctx.stroke();

        // Door
        ctx.fillStyle = "#8a533c";
        ctx.fillRect(8, -26, 14, 26);
        ctx.strokeRect(8, -26, 14, 26);

        // Gable roof
        ctx.fillStyle = "#733f2b";
        ctx.beginPath();
        ctx.moveTo(-38, -34);
        ctx.lineTo(0, -56);
        ctx.lineTo(38, -34);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Radio mast & windsock
        ctx.beginPath();
        ctx.moveTo(22, -56);
        ctx.lineTo(22, -92);
        ctx.moveTo(16, -76);
        ctx.lineTo(28, -76);
        ctx.stroke();

        ctx.fillStyle = "#d4622a";
        ctx.beginPath();
        ctx.arc(22, -92, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else if (lm.type === "cairn") {
        // High Crag Cairn & Prayer Flag String
        ctx.fillStyle = "#565e61";
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, -6, 11, 0, Math.PI * 2);
        ctx.arc(1, -20, 8, 0, Math.PI * 2);
        ctx.arc(-1, -31, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Wooden staff with prayer flags
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(-18, -55);
        ctx.stroke();

        const flags = ["#d4622a", "#2ea3a5", "#efd07b", "#efe7d6"];
        for (let f = 0; f < flags.length; f++) {
          ctx.fillStyle = flags[f];
          ctx.beginPath();
          ctx.moveTo(-18 + f * 9, -50 + f * 3);
          ctx.lineTo(-12 + f * 9, -44 + f * 3);
          ctx.lineTo(-18 + f * 9, -42 + f * 3);
          ctx.closePath();
          ctx.fill();
        }
      } else if (lm.type === "trestle") {
        // Old Wooden Trestle Bridge Chasm
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-20, 0); ctx.lineTo(-20, 95);
        ctx.moveTo(20, 0); ctx.lineTo(20, 95);
        ctx.moveTo(-20, 25); ctx.lineTo(20, 65);
        ctx.moveTo(20, 25); ctx.lineTo(-20, 65);
        ctx.stroke();
      } else if (lm.type === "pithead") {
        // Mine Pithead Derrick
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(-28, 0); ctx.lineTo(0, -82); ctx.lineTo(28, 0);
        ctx.moveTo(-16, -42); ctx.lineTo(16, -42);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -82, 14, 0, Math.PI * 2);
        ctx.stroke();
      } else if (lm.type === "beacon") {
        // Summit Observatory Dome & Radar
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 2.4;
        ctx.fillStyle = "#c8d6e0";
        ctx.beginPath();
        ctx.arc(0, -28, 28, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -56); ctx.lineTo(0, -96);
        ctx.stroke();
        ctx.fillStyle = "#d4622a";
        ctx.beginPath();
        ctx.arc(0, -96, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  drawProps(propManager, cam) {
    if (!propManager) return;
    const ctx = this.ctx;

    for (const item of propManager.activeProps.values()) {
      const def = item.def;
      const b = item.bodies[0];
      if (!b) continue;

      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);

      if (def.type === "sign") {
        ctx.fillStyle = item.smashed ? "#745839" : "#a88965";
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 1.8;
        ctx.fillRect(-7, -13, 14, 26);
        ctx.strokeRect(-7, -13, 14, 26);
        ctx.fillStyle = "#d4622a";
        ctx.fillRect(-4, -9, 8, 4);
      } else if (def.type === "fence") {
        ctx.fillStyle = "#8a6d4d";
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 1.6;
        ctx.fillRect(-4, -11, 8, 22);
        ctx.strokeRect(-4, -11, 8, 22);
      } else if (def.type === "crate") {
        ctx.fillStyle = "#bca383";
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 2.0;
        ctx.fillRect(-11, -11, 22, 22);
        ctx.strokeRect(-11, -11, 22, 22);
        ctx.beginPath();
        ctx.moveTo(-11, -11); ctx.lineTo(11, 11);
        ctx.moveTo(11, -11); ctx.lineTo(-11, 11);
        ctx.stroke();
      } else if (def.type === "rock") {
        ctx.fillStyle = "#6e777a";
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        const rad = def.radius || 14;
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  drawVehicle(vehicle, biome) {
    const ctx = this.ctx;
    const chassis = vehicle.chassis;
    const vCfg = vehicle.archetype;

    ctx.save();
    ctx.translate(chassis.position.x, chassis.position.y);
    ctx.rotate(chassis.angle);

    const w = vCfg.chassisWidth;
    const h = vCfg.chassisHeight;

    // Chassis Body Polygon
    ctx.fillStyle = vCfg.chassisColor;
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

    // Cockpit opening
    ctx.fillStyle = "#3d4642";
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 14, -h / 2 - 8);
    ctx.lineTo(-w / 2 + 40, -h / 2 - 26);
    ctx.lineTo(-w / 2 + 58, -h / 2 - 26);
    ctx.lineTo(-w / 2 + 58, -h / 2 - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Windscreen / Aero deflector
    ctx.save();
    ctx.fillStyle = "rgba(180, 225, 235, 0.45)";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 42, -h / 2 - 28);
    ctx.lineTo(-w / 2 + 58, -h / 2 - 10);
    ctx.lineTo(-w / 2 + 50, -h / 2 - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Windscreen specular flash
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 44, -h / 2 - 25);
    ctx.lineTo(-w / 2 + 54, -h / 2 - 12);
    ctx.stroke();
    ctx.restore();

    // Articulated Driver
    this.drawArticulatedDriver(vehicle.driver, vehicle);

    // Roll cage bar
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 18, -h / 2 - 8);
    ctx.lineTo(-w / 2 + 16, -h / 2 - 28);
    ctx.lineTo(-w / 2 + 42, -h / 2 - 28);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Whip Antenna & Expedition Pennant Flag
    const antX = -w / 2 + 16;
    const antBaseY = -h / 2 - 28;
    const antTopY = antBaseY - 24;
    const antBend = Math.sin(Date.now() * 0.006) * 3 - (vehicle.forwardSpeed || 0) * 0.6;
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(antX, antBaseY);
    ctx.quadraticCurveTo(antX + antBend * 0.5, antBaseY - 12, antX + antBend, antTopY);
    ctx.stroke();
    // Triangular pennant flag
    ctx.fillStyle = vCfg.accentColor;
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(antX + antBend, antTopY);
    ctx.lineTo(antX + antBend - 14, antTopY + 4);
    ctx.lineTo(antX + antBend, antTopY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Front Rally Auxiliary Spot Lamps
    const lampX = w / 2 - 8;
    const lampY = -h / 2 + 2;
    ctx.save();
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(lampX - 4, lampY + 2);
    ctx.lineTo(lampX + 3, lampY);
    ctx.stroke();
    ctx.fillStyle = "#2a302e";
    ctx.beginPath();
    ctx.arc(lampX + 5, lampY - 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fadb6a";
    ctx.beginPath();
    ctx.ellipse(lampX + 6.5, lampY - 2, 2.2, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Warm halogen beam forward
    ctx.fillStyle = "rgba(255, 235, 150, 0.14)";
    ctx.beginPath();
    ctx.moveTo(lampX + 7, lampY - 4);
    ctx.lineTo(lampX + 48, lampY - 14);
    ctx.lineTo(lampX + 48, lampY + 8);
    ctx.lineTo(lampX + 7, lampY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Rear Dual Exhaust Pipe
    ctx.save();
    ctx.fillStyle = "#8a9692";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.6;
    ctx.fillRect(-w / 2 - 4, h / 2 - 5, 6, 4);
    ctx.strokeRect(-w / 2 - 4, h / 2 - 5, 6, 4);
    ctx.fillStyle = "#1b1f1d";
    ctx.beginPath();
    ctx.ellipse(-w / 2 - 4, h / 2 - 3, 1.2, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Analog Dashboard Gauge Dial in front of steering wheel
    ctx.save();
    const gaugeX = -w / 2 + 50;
    const gaugeY = -h / 2 - 12;
    ctx.fillStyle = "#efe7d6";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const needleAngle = -Math.PI * 0.75 + (vehicle.rpm || 0.3) * Math.PI * 1.5;
    ctx.strokeStyle = "#d4622a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(gaugeX, gaugeY);
    ctx.lineTo(gaugeX + Math.cos(needleAngle) * 3.2, gaugeY + Math.sin(needleAngle) * 3.2);
    ctx.stroke();
    ctx.restore();

    // Accent Block
    ctx.fillStyle = vCfg.accentColor;
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
      ctx.strokeStyle = vCfg.accentColor;
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

      // Wheel Spokes
      for (let s = 0; s < 5; s++) {
        const a = (s / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * vCfg.wheelRadius * 0.46, Math.sin(a) * vCfg.wheelRadius * 0.46);
        ctx.lineTo(Math.cos(a) * vCfg.wheelRadius * 0.92, Math.sin(a) * vCfg.wheelRadius * 0.92);
        ctx.stroke();
      }

      // Tire treads
      ctx.strokeStyle = "rgba(239,231,214,0.38)";
      ctx.lineWidth = 2.0;
      for (let t = 0; t < 10; t++) {
        const a = (t / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (vCfg.wheelRadius - 5), Math.sin(a) * (vCfg.wheelRadius - 5));
        ctx.lineTo(Math.cos(a) * vCfg.wheelRadius, Math.sin(a) * vCfg.wheelRadius);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  drawArticulatedDriver(driver, vehicle) {
    const ctx = this.ctx;
    // Driver seated naturally inside the cockpit
    const hipX = -26;
    const hipY = -12 + (driver.jolt || 0);

    const spineAngle = (driver.lean || 0) * 0.72;
    const torsoLen = 17;
    const shoulderX = hipX + Math.sin(spineAngle) * torsoLen;
    const shoulderY = hipY - Math.cos(spineAngle) * torsoLen;

    const headX = shoulderX + Math.sin(spineAngle) * 9;
    const headY = shoulderY - Math.cos(spineAngle) * 9;

    const wheelHubX = -9;
    const wheelHubY = -23;

    const handX = wheelHubX;
    const handY = (driver.victory || 0) > 0.1 ? wheelHubY - 18 : wheelHubY - 2;

    const footX = -3;
    const footY = -6;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 1. Dynamic Wind-Blown Expedition Scarf (Trailing silk ribbon)
    const spd = vehicle ? Math.abs(vehicle.forwardSpeed || 0) : 0;
    const time = Date.now() * 0.008;
    const scarfDir = (vehicle && vehicle.forwardSpeed < -0.5) ? 1 : -1;
    const scarfWave1 = Math.sin(time * 3.5) * (3 + spd * 0.4);
    const scarfWave2 = Math.cos(time * 4.2 + 1.2) * (4 + spd * 0.5);
    const scarfLen = 18 + Math.min(spd * 2.2, 22);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(shoulderX - 3, shoulderY + 2);
    ctx.quadraticCurveTo(
      shoulderX + scarfDir * (scarfLen * 0.5), shoulderY + 1 + scarfWave1,
      shoulderX + scarfDir * scarfLen, shoulderY + 3 + scarfWave2
    );
    ctx.lineWidth = 4.4;
    ctx.strokeStyle = "#efd07b"; // Silk mustard gold
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(shoulderX - 3, shoulderY + 2);
    ctx.quadraticCurveTo(
      shoulderX + scarfDir * (scarfLen * 0.5), shoulderY + 1 + scarfWave1,
      shoulderX + scarfDir * scarfLen, shoulderY + 3 + scarfWave2
    );
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Fringe tassel at scarf tip
    ctx.fillStyle = "#d4622a";
    ctx.beginPath();
    ctx.arc(shoulderX + scarfDir * scarfLen, shoulderY + 3 + scarfWave2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Accelerator / Brake Pedal Bracket under boot
    ctx.strokeStyle = "#24282a";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(footX + 4, footY + 4);
    ctx.lineTo(footX - 3, footY + 2);
    ctx.stroke();
    ctx.fillStyle = "#8a9692";
    ctx.fillRect(footX - 1, footY - 1, 6, 3);
    ctx.strokeRect(footX - 1, footY - 1, 6, 3);

    // 3. Leg IK (Hip -> Knee -> Foot Boot)
    const legIK = this.solve2BoneIK(hipX, hipY, footX, footY, 14, 14, 1);
    ctx.lineWidth = 6.4;
    ctx.strokeStyle = "#38423e"; // Rugged mountain slate trousers
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(legIK.x, legIK.y);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    ctx.lineWidth = 2.0;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Reinforced Knee Patch
    ctx.fillStyle = "#262e2b";
    ctx.beginPath();
    ctx.ellipse(legIK.x, legIK.y, 4, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Heavy Mountaineer Lug Boot
    ctx.fillStyle = "#1b1f1d";
    ctx.fillRect(footX - 3, footY - 2, 9, 6);
    ctx.strokeRect(footX - 3, footY - 2, 9, 6);
    // Lug sole
    ctx.fillStyle = "#8a533c";
    ctx.fillRect(footX - 3, footY + 3, 9, 2);
    // Boot lace accents
    ctx.strokeStyle = "#efe7d6";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(footX - 1, footY); ctx.lineTo(footX + 2, footY);
    ctx.moveTo(footX, footY + 2); ctx.lineTo(footX + 3, footY + 2);
    ctx.stroke();

    // 4. Torso (Expedition Flight/Bomber Jacket)
    ctx.lineWidth = 8.6;
    ctx.strokeStyle = "#b55a28"; // Heavy rust leather
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    ctx.lineWidth = 2.0;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Jacket Zipper Line
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#efe7d6";
    ctx.beginPath();
    ctx.moveTo(hipX + 1, hipY);
    ctx.lineTo(shoulderX + 1, shoulderY);
    ctx.stroke();

    // 4-Point Racing Harness
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = "#1b1f1d";
    ctx.beginPath();
    ctx.moveTo(shoulderX - 2, shoulderY + 3);
    ctx.lineTo(hipX + 2, hipY - 2);
    ctx.stroke();
    // Harness Center Latch Buckle
    ctx.fillStyle = "#d9cfb8";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(hipX * 0.5 + shoulderX * 0.5, hipY * 0.5 + shoulderY * 0.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shearling / Fleece Jacket Collar
    ctx.fillStyle = "#f4eedb";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(shoulderX - 1, shoulderY + 2, 4.5, 2.8, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 5. Arm IK (Shoulder -> Elbow -> Leather Driving Glove)
    const armIK = this.solve2BoneIK(shoulderX, shoulderY, handX, handY, 12, 12, -1);
    ctx.lineWidth = 5.2;
    ctx.strokeStyle = "#b55a28";
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(armIK.x, armIK.y);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Wrist cuff
    ctx.strokeStyle = "#f4eedb";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(handX - 2, handY - 1);
    ctx.lineTo(handX - 1, handY + 2);
    ctx.stroke();

    // Leather Driving Glove
    ctx.fillStyle = "#3a2a20";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(handX, handY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 6. Steering Column & Wheel Rim
    ctx.save();
    ctx.strokeStyle = "#3d4642";
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(wheelHubX + 6, wheelHubY + 12);
    ctx.lineTo(wheelHubX, wheelHubY);
    ctx.stroke();

    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(wheelHubX, wheelHubY, 7.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#c46b38";
    ctx.beginPath();
    ctx.arc(wheelHubX, wheelHubY, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(wheelHubX, wheelHubY); ctx.lineTo(wheelHubX - 6, wheelHubY);
    ctx.moveTo(wheelHubX, wheelHubY); ctx.lineTo(wheelHubX + 4, wheelHubY - 5);
    ctx.moveTo(wheelHubX, wheelHubY); ctx.lineTo(wheelHubX + 4, wheelHubY + 5);
    ctx.stroke();
    ctx.restore();

    // 7. Aviator Helmet & Brass Goggles
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(driver.helmetAngle);

    // Visible Face / Chin under helmet
    ctx.fillStyle = "#e0ad84";
    ctx.beginPath();
    ctx.arc(2, 2.5, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Helmet dome shell
    ctx.fillStyle = "#efe7d6";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, -0.5, 8.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Contrast Racing Center Stripe
    ctx.fillStyle = "#d4622a";
    ctx.fillRect(-2.5, -8.6, 5, 16.5);
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-2.5, -8.6, 5, 16.5);

    // Helmet Ear Cushion flap
    ctx.fillStyle = "#5a4232";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.4;
    ctx.fillRect(-5.5, 1, 4.5, 6.5);
    ctx.strokeRect(-5.5, 1, 4.5, 6.5);
    ctx.fillStyle = "#d9b35b";
    ctx.beginPath();
    ctx.arc(-3.2, 4.2, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Chin strap
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-3, 6);
    ctx.lineTo(1, 6.8);
    ctx.stroke();

    // Goggles Leather Strap wrapping around helmet
    ctx.strokeStyle = "#2b221a";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -0.5, 8.4, Math.PI * 0.75, Math.PI * 1.4);
    ctx.stroke();

    // Brass Aviator Goggles Rim
    ctx.fillStyle = "#b88628";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(3.8, -0.5, 4.6, 3.4, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dark tinted lens glass
    ctx.fillStyle = "#1e272b";
    ctx.beginPath();
    ctx.ellipse(4.0, -0.5, 3.4, 2.3, 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Specular Reflection Flash
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(3.2, -2.0);
    ctx.lineTo(5.2, -0.5);
    ctx.stroke();

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
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  drawGrain(w, h) {
    if (!this.grainCanvas) {
      const c = document.createElement("canvas");
      c.width = 180;
      c.height = 180;
      const gctx = c.getContext("2d");
      const img = gctx.createImageData(180, 180);
      for (let i = 0; i < img.data.length; i += 4) {
        const val = Math.random() * 255;
        img.data[i] = val;
        img.data[i + 1] = val;
        img.data[i + 2] = val;
        img.data[i + 3] = 18;
      }
      gctx.putImageData(img, 0, 0);
      this.grainCanvas = c;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const pat = ctx.createPattern(this.grainCanvas, "repeat");
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawVignette(w, h) {
    const ctx = this.ctx;
    ctx.save();
    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, "rgba(27,31,29,0)");
    vig.addColorStop(1, "rgba(27,31,29,0.18)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawDebug(bodies, vehicle, camera, game) {
    const ctx = this.ctx;
    ctx.save();

    // 1. Static & Dynamic Wireframes
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

    // 2. Chassis Velocity Vector
    ctx.strokeStyle = "#2ea3a5";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(vehicle.chassis.position.x, vehicle.chassis.position.y);
    ctx.lineTo(
      vehicle.chassis.position.x + vehicle.chassis.velocity.x * 12,
      vehicle.chassis.position.y + vehicle.chassis.velocity.y * 12
    );
    ctx.stroke();

    // 3. Center of Mass
    ctx.fillStyle = "#d4622a";
    ctx.beginPath();
    ctx.arc(vehicle.chassis.position.x, vehicle.chassis.position.y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 4. Wheel Contacts & Normals
    for (const w of vehicle.wheels) {
      ctx.fillStyle = w.contact ? "#2ea3a5" : "rgba(27,31,29,0.3)";
      ctx.beginPath();
      ctx.arc(w.body.position.x, w.body.position.y, 5, 0, Math.PI * 2);
      ctx.fill();

      if (w.contact) {
        const norm = this.terrain.normalAt(w.body.position.x);
        ctx.strokeStyle = "#2ea3a5";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(w.body.position.x, w.body.position.y);
        ctx.lineTo(w.body.position.x + norm.x * 24, w.body.position.y + norm.y * 24);
        ctx.stroke();
      }
    }

    // 5. Predicted Jump Ballistic Trajectory
    if (vehicle.airborne) {
      ctx.strokeStyle = "rgba(212,98,42,0.6)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      let simX = vehicle.chassis.position.x;
      let simY = vehicle.chassis.position.y;
      let simVx = vehicle.chassis.velocity.x;
      let simVy = vehicle.chassis.velocity.y;
      ctx.moveTo(simX, simY);
      for (let s = 0; s < 30; s++) {
        simX += simVx * 1.5;
        simY += simVy * 1.5;
        simVy += x.physics.gravity * 0.12;
        ctx.lineTo(simX, simY);
        if (simY > this.terrain.heightAt(simX)) break;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  drawMountainEchoes(echoManager, cam) {
    const ctx = this.ctx;
    for (const relic of echoManager.relics) {
      if (relic.collected) continue;
      if (Math.abs(relic.x - cam.x) > 1200) continue;

      ctx.save();
      ctx.translate(relic.x, relic.y);

      // Amber outer radial glow
      const glowR = 26 + relic.glow * 16;
      const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, glowR);
      grad.addColorStop(0, "rgba(212, 98, 42, 0.45)");
      grad.addColorStop(0.5, "rgba(212, 98, 42, 0.18)");
      grad.addColorStop(1, "rgba(239, 231, 214, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Rotating 3D crystal projection (octahedron)
      const rot = relic.rotation;
      const s = 13.0;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);

      const top = { x: 0, y: -s * 1.4 };
      const btm = { x: 0, y: s * 1.4 };
      const v0 = { x: -s * cosR, y: -s * 0.35 * sinR };
      const v1 = { x: s * sinR, y: -s * 0.35 * cosR };
      const v2 = { x: s * cosR, y: s * 0.35 * sinR };
      const v3 = { x: -s * sinR, y: s * 0.35 * cosR };

      const drawFacet = (pA, pB, pC, fillAlpha) => {
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.lineTo(pC.x, pC.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(212, 98, 42, ${fillAlpha})`;
        ctx.fill();
        ctx.strokeStyle = "rgba(27, 31, 29, 0.65)";
        ctx.lineWidth = 1.0;
        ctx.stroke();
      };

      drawFacet(top, v0, v1, 0.85);
      drawFacet(top, v1, v2, 0.70);
      drawFacet(btm, v0, v1, 0.60);
      drawFacet(btm, v1, v2, 0.45);

      // Glyphs
      ctx.strokeStyle = "rgba(239, 231, 214, 0.85)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-3, -4);
      ctx.lineTo(3, 4);
      ctx.moveTo(0, -5);
      ctx.lineTo(0, 5);
      ctx.stroke();

      ctx.restore();
    }
  }

  drawDebugPanel(game, w, h) {
    const ctx = this.ctx;
    const v = game.vehicle;
    const chassis = v.chassis;
    const pos = chassis.position;
    const vel = chassis.velocity;
    const seg = this.terrain.segmentAt(pos.x);
    const slope = this.terrain.slopeAt(pos.x);
    const mat = this.terrain.materialAt(pos.x);
    const biome = this.terrain.biomeAt(pos.x);
    const distMeters = game.maxDistance;
    const difficulty = b(distMeters / 1000, 0, 1);

    const nf = v.normalLoads?.front ?? 0;
    const nr = v.normalLoads?.rear ?? 0;
    const sf = v.wheels[1]?.slipRatio ?? 0;
    const sr = v.wheels[0]?.slipRatio ?? 0;

    const lines = [
      `DIAGNOSTICS (F3)  FPS: ${game.fps.toFixed(0)}  STEP: 8.33ms`,
      `VEHICLE: ${v.archetype.name.toUpperCase()}  BODIES: ${Matter.Composite.allBodies(game.engine.world).length}`,
      `NORMAL FORCES: F=${nf.toFixed(1)}N  R=${nr.toFixed(1)}N  F/R=${((nf/(nf+nr||1))*100).toFixed(0)}%/${((nr/(nf+nr||1))*100).toFixed(0)}%`,
      `SLIP RATIO: F=${sf.toFixed(2)}  R=${sr.toFixed(2)}  ROOF_CONTACT: ${v.roofContact}`,
      `SPEED: ${(Math.abs(v.forwardSpeed) * 7.2).toFixed(1)} km/h  VERT: ${vel.y.toFixed(1)}  RPM: ${(v.rpm * 100).toFixed(0)}%`,
      `CHASSIS ANGLE: ${(chassis.angle * 180 / Math.PI).toFixed(1)}°  ANG_VEL: ${chassis.angularVelocity.toFixed(3)}`,
      `DEATH STATE: ${(game.deathState || "NORMAL").toUpperCase()}  TIMER: ${(game.upsideDownTimer || 0).toFixed(1)}s`,
      `SUSPENSION: R=${v.wheels[0].compression.toFixed(2)} F=${v.wheels[1].compression.toFixed(2)}`,
      `TERRAIN: ${seg.name} (${seg.type})  SLOPE: ${(slope * 180 / Math.PI).toFixed(1)}°  MAT: ${mat.name}`,
      `AIRBORNE: ${v.airborne}  AIRTIME: ${(game.stunts.airtime / 1000).toFixed(2)}s  APEX_H: ${(game.stunts.launchY - game.stunts.airApexY).toFixed(0)}px`,
      `STUNT: ${game.stunts.activeStuntName || "NONE"}  CUMUL_ANG: ${(game.stunts.cumulativeAngle * 180 / Math.PI).toFixed(0)}°  FLIPS: B=${game.stunts.backflips} F=${game.stunts.frontflips}`,
      `COMBO: x${game.stunts.comboMultiplier}  SCORE: ${game.score}  ECHOES: ${game.echoManager?.collectedCount || 0}/${game.echoManager?.totalCount || 6}`,
      `SEEDS: [1]FLAT(1001) [2]STEEP(48192) [3]JUMP(77234) [4]VALLEY(33109)`,
      `TELEMETRY: Press 'T' to export JSON  SEED: ${game.seed}`,
    ];

    ctx.save();
    ctx.fillStyle = "rgba(27,31,29,0.85)";
    const panelW = 460;
    const panelH = lines.length * 16 + 18;
    ctx.fillRect(w - panelW - 16, h - panelH - 16, panelW, panelH);
    ctx.strokeStyle = "var(--hot)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w - panelW - 16, h - panelH - 16, panelW, panelH);

    ctx.font = "11px 'Courier New', monospace";
    ctx.fillStyle = "#efe7d6";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], w - panelW - 6, h - panelH + 4 + i * 16);
    }
    ctx.restore();
  }
}


// ----------------------------------------------------------------------------
// Master Game Orchestrator (q0)
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
  propManager;
  echoManager;
  threeDepth = null;
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
  wasAirborne = false;

  // Death State Machine (Spec #41, #42, #43, #44)
  // States: "normal" -> "unstable" -> "critical" -> "crashed" -> "wrecked" -> "death"
  deathState = "normal";
  upsideDownTimer = 0;
  isDead = false;
  deathReason = "";

  // Telemetry Recorder (Spec #60)
  telemetrySamples = [];
  telemetryTimer = 0;

  career = {
    bestDist: 0,
    peakAlt: 0,
    bestAir: 0,
    maxCombo: 1,
    highScore: 0,
    echoesCollected: [],
  };

  constructor(canvas, seed = 42) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.seed = seed;
    this.loadCareer();

    this.stunts = new StuntDirector(this.bus, this.audio, this.camera);
    this.echoManager = new MountainEchoManager(this.audio, this.particles, this.bus);

    const threeCanvas = document.getElementById("three-canvas");
    if (threeCanvas) {
      this.threeDepth = new ThreeVisualDepth(threeCanvas);
    }

    this.build();
    this.renderer = new R0(this.ctx, this.terrain);

    this.input.attach();
    this.input.onReset = () => this.reset();
    this.input.onDebug = () => {
      this.debug = !this.debug;
    };

    // Diagnostic Seeds & Telemetry Hotkeys
    window.addEventListener("keydown", (e) => {
      if (e.key === "1") this.setTestSeed("SEED_FLAT");
      else if (e.key === "2") this.setTestSeed("SEED_STEEP");
      else if (e.key === "3") this.setTestSeed("SEED_JUMP");
      else if (e.key === "4") this.setTestSeed("SEED_VALLEY");
      else if (e.key === "t" || e.key === "T") {
        if (this.debug) this.exportTelemetry();
      }
    });

    this.bus.on("echo:collected", (relic) => {
      this.score += 500;
      this.stunts.showToast(`ECHO: ${relic.name}`, 3);
      if (!this.career.echoesCollected.includes(relic.id)) {
        this.career.echoesCollected.push(relic.id);
      }
      this.saveCareer();
    });
  }

  loadCareer() {
    try {
      const saved = localStorage.getItem("omw_career");
      if (saved) {
        this.career = { ...this.career, ...JSON.parse(saved) };
      }
    } catch (e) {}
  }

  saveCareer() {
    try {
      this.career.bestDist = Math.max(this.career.bestDist, this.maxDistance);
      this.career.peakAlt = Math.max(this.career.peakAlt, this.highestAltitude);
      this.career.bestAir = Math.max(this.career.bestAir, this.stunts.airtime / 1000);
      this.career.maxCombo = Math.max(this.career.maxCombo, this.stunts.comboMultiplier);
      this.career.highScore = Math.max(this.career.highScore, this.score);
      localStorage.setItem("omw_career", JSON.stringify(this.career));
    } catch (e) {}
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

    this.propManager = new PropManager(this.engine.world, this.audio, this.particles, this.bus);
    this.propManager.initProps(this.terrain, this.seed);

    this.echoManager.initEchoes(this.terrain);

    this.startX = x.world.startX;
    const startY = this.terrain.heightAt(this.startX) - 62;
    this.vehicle = new f0(this.startX, startY, x.activeArchetype, this.audio);
    Matter.Composite.add(this.engine.world, this.vehicle.composite);

    // Initial contacts so vehicle starts in grounded driving state
    this.vehicle.wheels.forEach((w) => {
      w.contact = true;
      w.material = "grass";
    });

    this.camera.reset(this.startX, startY);
    this.stunts.reset();
    this.deathState = "normal";
    this.upsideDownTimer = 0;
    this.isDead = false;
    this.deathReason = "";
    this.telemetrySamples = [];
    this.telemetryTimer = 0;

    Matter.Events.on(this.engine, "collisionStart", (e) => this.onCollisions(e.pairs));
  }

  setTestSeed(key) {
    if (TEST_SEEDS[key]) {
      this.newRun(TEST_SEEDS[key]);
      this.stunts.showToast(`LOADED SEED: ${key} (${TEST_SEEDS[key]})`, 2);
    }
  }

  setVehicleArchetype(archetypeId) {
    if (!VEHICLE_ARCHETYPES[archetypeId]) return;
    const pos = this.vehicle ? { ...this.vehicle.chassis.position } : { x: this.startX, y: x.world.groundBase - 62 };
    Matter.Composite.remove(this.engine.world, this.vehicle.composite);
    this.vehicle = new f0(pos.x, pos.y, archetypeId, this.audio);
    this.vehicle.wheels.forEach((w) => {
      w.contact = true;
      w.material = "grass";
    });
    Matter.Composite.add(this.engine.world, this.vehicle.composite);
  }

  applyTuning(stiffness, damping, grip, torque) {
    if (!this.vehicle) return;
    const vCfg = this.vehicle.archetype;
    if (stiffness !== undefined) vCfg.suspensionStiffness = stiffness;
    if (damping !== undefined) vCfg.suspensionDamping = damping;
    if (grip !== undefined) {
      vCfg.tireGrip = grip;
      this.vehicle.wheels.forEach(w => {
        w.body.friction = grip;
        w.body.frictionStatic = grip * 1.35;
      });
    }
    if (torque !== undefined) vCfg.engineTorque = torque;

    // Update existing spring constraints
    for (const c of this.vehicle.constraints) {
      c.stiffness = vCfg.suspensionStiffness;
      c.damping = vCfg.suspensionDamping;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.loop(this.last);
  }

  reset() {
    this.saveCareer();
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

    const deathOverlay = document.getElementById("death-screen");
    if (deathOverlay) deathOverlay.style.display = "none";
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
      this.saveCareer();
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.running = false;
    this.saveCareer();
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

      const vel = vBody.velocity;
      const speed = Math.hypot(vel.x, vel.y);
      const energy = 0.5 * vBody.mass * speed * speed * 0.045;

      const pt = pair.collision?.supports?.[0] ?? vBody.position;
      const normal = pair.collision?.normal ?? { x: 0, y: -1 };

      // Interactive destructible prop collision
      if (other.propDef) {
        this.propManager.onHit(other, energy, pt);
        this.score += 50;
        continue;
      }

      if (!this.terrainSet.has(other)) continue;
      if (energy < 0.06) continue;

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

      // Crash state machine & slow motion (Spec #48)
      if (severity === "critical") {
        this.deathState = "crashed";
        if (!x.visual.reducedMotion) {
          this.timeScale = 0.32;
          this.timeScaleTarget = 1.0;
        }
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
    if (this.isDead) {
      if (this.deathState === "normal") {
        this.isDead = false;
      } else {
        return;
      }
    }

    const inputState = {
      throttle: this.input.throttle,
      brake: this.input.brake,
    };

    this.vehicle.update(inputState, dt, this.terrain);
    Matter.Engine.update(this.engine, dt);

    const activePairs = this.engine.pairs.list.filter((p) => p.isActive);
    this.vehicle.markContacts(this.terrainSet, activePairs);

    this.safety(dt);
  }

  safety(dt = 16.666) {
    const pos = this.vehicle.chassis.position;
    const vel = this.vehicle.chassis.velocity;
    const speed = Math.hypot(vel.x, vel.y);

    if (!I0(pos) || !I0(vel) || speed > 220 || pos.y > 6000) {
      this.triggerDeath("Fell into Mountain Chasm");
      return;
    }

    // Normalized upside-down amount U in [0, 1] (Spec #42)
    const sinAngle = Math.sin(this.vehicle.chassis.angle);
    const isInverted = Math.abs(sinAngle) > 0.88 || this.vehicle.roofContact;
    const isUpright = Math.abs(sinAngle) < 0.45;
    const hasGroundContact = this.vehicle.wheels.some(w => w.contact);

    // Robust 6-Stage Death State Machine
    if (isInverted) {
      if (this.deathState === "normal") {
        this.deathState = this.vehicle.roofContact ? "crashed" : "critical";
      }

      this.upsideDownTimer += (dt / 1000);
      const remaining = Math.max(0, 1.8 - this.upsideDownTimer);

      const warningEl = document.getElementById("hud-warning");
      const warningTimer = document.getElementById("hud-warning-timer");
      if (warningEl && warningTimer) {
        warningEl.style.display = "block";
        warningTimer.textContent = remaining.toFixed(1) + "s";
      }

      if (Math.random() < 0.08) {
        this.audio?.warningAlarm();
      }

      // 1.8s persistent inversion threshold reached -> WRECKED -> DEATH (Spec #42, #43)
      if (this.upsideDownTimer >= 1.8 && speed < 12.0) {
        this.deathState = "wrecked";
        this.triggerDeath(this.vehicle.roofContact ? "Roof Impact & Frame Crush" : "Persistent Inversion Rollover");
      }
    } else {
      // RECOVERY WINDOW (Spec #44): If vehicle was critical/crashed and gets back upright
      if ((this.deathState === "critical" || this.deathState === "crashed") && isUpright && hasGroundContact) {
        this.deathState = "normal";
        this.upsideDownTimer = 0;
        this.score += 350;
        this.stunts.showToast("ROLLOVER RECOVERED!", 2);

        const warningEl = document.getElementById("hud-warning");
        if (warningEl) warningEl.style.display = "none";
      } else if (isUpright) {
        this.deathState = "normal";
        this.upsideDownTimer = 0;
        const warningEl = document.getElementById("hud-warning");
        if (warningEl) warningEl.style.display = "none";
      }
    }
  }

  triggerDeath(reason) {
    if (this.isDead) return;
    this.isDead = true;
    this.deathState = "death";
    this.deathReason = reason;
    this.saveCareer();

    // Cinematic time dilation and camera lock
    this.timeScale = 0.35;
    this.timeScaleTarget = 0.1;
    this.camera.pulseZoom(0.06);

    const pos = this.vehicle.chassis.position;
    this.particles.spawnLandingBurst(pos.x, pos.y, 2.5, MATERIALS.rock);
    this.particles.spawnSparks(pos.x, pos.y, 0, -1, 30);

    // Hide HUD warning
    const warningEl = document.getElementById("hud-warning");
    if (warningEl) warningEl.style.display = "none";

    // Show Death Debrief Overlay (Spec #46)
    setTimeout(() => {
      const deathOverlay = document.getElementById("death-screen");
      if (deathOverlay) {
        const dCause = document.getElementById("death-cause");
        const dDist = document.getElementById("death-dist");
        const dAlt = document.getElementById("death-alt");
        const dScore = document.getElementById("death-score");
        const dAir = document.getElementById("death-air");
        const dStunts = document.getElementById("death-stunts");
        const dEchoes = document.getElementById("death-echoes");
        const dLoreBox = document.getElementById("death-lore-box");

        if (dCause) dCause.textContent = reason;
        if (dDist) dDist.textContent = `${this.maxDistance.toFixed(0)} m`;
        if (dAlt) dAlt.textContent = `${this.highestAltitude} m`;
        if (dScore) dScore.textContent = String(this.score);
        if (dAir) dAir.textContent = `${(this.stunts.airtime / 1000).toFixed(1)} s`;
        if (dStunts) dStunts.textContent = `${this.stunts.backflips + this.stunts.frontflips} Flips`;
        if (dEchoes) dEchoes.textContent = `${this.echoManager.collectedCount}/${this.echoManager.totalCount}`;

        if (dLoreBox) {
          const collected = this.echoManager.relics.filter(r => r.collected);
          if (collected.length > 0) {
            dLoreBox.style.display = "block";
            dLoreBox.innerHTML = `<strong>Expedition Lore Discovered (${collected.length}):</strong><br/>` +
              collected.map(r => `&bull; <em>${r.name}</em>: "${r.lore}"`).join("<br/>");
          } else {
            dLoreBox.style.display = "none";
          }
        }

        deathOverlay.style.display = "flex";
      }
    }, 600);
  }

  exportTelemetry() {
    const data = {
      expedition: "The Old Mountain Works",
      seed: this.seed,
      vehicle: this.vehicle.archetype.name,
      totalDistance: Math.round(this.maxDistance),
      peakAltitude: Math.round(this.highestAltitude),
      score: this.score,
      echoesCollected: this.echoManager.collectedCount,
      samples: this.telemetrySamples
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telemetry_run_seed_${this.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.stunts.showToast("TELEMETRY EXPORTED (JSON)", 2);
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
    this.propManager.updateChunking(this.camera.x);
    this.draw();
  };

  postPhysics(dt) {
    const v = this.vehicle;
    const isAirborne = v.airborne;

    this.stunts.update(v, this.terrain, dt);
    this.echoManager.update(v, dt);

    if (!isAirborne && this.wasAirborne) {
      this.stunts.onLanding(v, this.terrain);
    }
    this.wasAirborne = isAirborne;

    // Wheel dust and grit spray
    for (const w of v.wheels) {
      if (!w.contact) continue;
      const slip = w.slip;
      const intensity = b((slip - 1.1) * 0.4, 0, 1.8);
      if (intensity > 0.05 && Math.random() < 0.65) {
        const mat = MATERIALS[w.material] ?? MATERIALS.dirt;
        this.particles.spawnWheelSpray(
          w.body.position.x,
          w.body.position.y + v.archetype.wheelRadius * 0.75,
          v.chassis.velocity.x,
          v.chassis.velocity.y,
          intensity,
          mat
        );
      }
    }

    // Camera follow & zoom
    this.camera.update(v, this.terrain, dt);

    // Track expedition records
    const distMeters = Math.max(0, (v.chassis.position.x - this.startX) / 40);
    if (distMeters > this.maxDistance) {
      this.maxDistance = distMeters;
      this.score += Math.round(distMeters - this.maxDistance + 1);
    }

    const altitudeMeters = Math.max(0, Math.round((x.world.groundBase - v.chassis.position.y) / 40));
    if (altitudeMeters > this.highestAltitude) {
      this.highestAltitude = altitudeMeters;
    }

    // Telemetry recorder at 10Hz (Spec #60)
    this.telemetryTimer += dt;
    if (this.telemetryTimer >= 100) {
      this.telemetryTimer = 0;
      this.telemetrySamples.push({
        t: Math.round(this.time / 10) / 100,
        distance: Math.round(this.maxDistance * 10) / 10,
        speed: Math.round(Math.abs(v.forwardSpeed) * 7.2 * 10) / 10,
        altitude: altitudeMeters,
        pitch: Math.round(v.chassis.angle * 180 / Math.PI * 10) / 10,
        compFront: Math.round(v.wheels[1].compression * 100) / 100,
        compRear: Math.round(v.wheels[0].compression * 100) / 100,
        slip: Math.round(v.wheels[0].slip * 100) / 100,
        state: this.deathState
      });
      if (this.telemetrySamples.length > 2500) this.telemetrySamples.shift();
    }

    // Audio pitch modulation
    this.audio.setEngine(v.rpm, Math.abs(this.input.throttle));
    this.audio.setWind(v.speed);

    // Broadcast live telemetry
    this.bus.emit("stats:update", {
      distance: this.maxDistance,
      altitude: this.highestAltitude,
      speed: Math.abs(v.forwardSpeed) * 7.2,
      airtime: this.stunts.airtime,
      rpm: v.rpm,
      airborne: v.airborne,
      score: this.score,
      incline: Math.round(v.chassis.angle * 180 / Math.PI),
      echoCount: this.echoManager.collectedCount,
      echoTotal: this.echoManager.totalCount,
      biomeName: this.terrain.biomeAt(v.chassis.position.x).name,
      vehicleName: v.archetype.name,
      comboMultiplier: this.stunts.comboMultiplier,
      comboTimer: this.stunts.comboTimer,
      activeStunt: this.stunts.activeStuntName,
    });
  }

  draw() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const allBodies = Matter.Composite.allBodies(this.engine.world);
    this.renderer.render(
      this.camera,
      this.vehicle,
      this.particles,
      this.propManager,
      w,
      h,
      this.time,
      this.debug,
      allBodies,
      this
    );
  }
}

// ----------------------------------------------------------------------------
// DOM Mounting, HUD Binding & Expedition Life Cycle
// ----------------------------------------------------------------------------
const canvas = document.getElementById("game");
const resize = () => {
  const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const threeCanvas = document.getElementById("three-canvas");
  if (threeCanvas && window.game?.threeDepth) {
    window.game.threeDepth.resize(w, h);
  }
};
window.addEventListener("resize", resize);
resize();

const game = new q0(canvas, 48192);
window.game = game;

const $el = (id) => document.getElementById(id);

let hasStarted = false;
let isPaused = false;

const hudDist = $el("hud-dist");
const hudSpeed = $el("hud-speed");
const hudAlt = $el("hud-alt");
const hudIncline = $el("hud-incline");
const hudEchoes = $el("hud-echoes");
const hudZone = $el("hud-zone");
const hudScore = $el("hud-score");
const hudVehicle = $el("hud-vehicle");
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
  incline: 0,
  echoCount: 0,
  echoTotal: 6,
  biomeName: "Alpine Meadow",
  vehicleName: "Trail Buggy",
  comboMultiplier: 1,
  comboTimer: 0,
  activeStunt: "",
};

game.bus.on("stats:update", (stats) => {
  liveStats = stats;
});

// Floating Stunt Toast
game.bus.on("stunt:awarded", (data) => {
  if (hudStunt) {
    const toast = document.createElement("div");
    toast.className = `stunt-toast tier-${data.tier}`;
    const multStr = data.multiplier > 1 ? ` &times;${data.multiplier}` : "";
    const scoreStr = data.score > 0 ? ` +${data.score}${multStr}` : "";
    toast.innerHTML = `<strong>${data.name}</strong>${scoreStr}`;
    hudStunt.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      setTimeout(() => toast.remove(), 300);
    }, 1800);
  }
});

setInterval(() => {
  if (hudDist) hudDist.textContent = liveStats.distance.toFixed(0) + " m";
  if (hudSpeed) hudSpeed.textContent = liveStats.speed.toFixed(0) + " km/h";
  if (hudAlt) hudAlt.textContent = (liveStats.altitude || 0).toFixed(0) + " m";
  if (hudIncline) hudIncline.textContent = `${liveStats.incline}°`;
  if (hudEchoes) hudEchoes.textContent = `${liveStats.echoCount}/${liveStats.echoTotal}`;
  if (hudZone) hudZone.textContent = liveStats.biomeName;
  if (hudScore) hudScore.textContent = String(liveStats.score);
  if (hudVehicle) hudVehicle.textContent = liveStats.vehicleName;
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

function updateCareerRecap() {
  const recapDist = $el("recap-dist");
  const recapAlt = $el("recap-alt");
  const recapScore = $el("recap-score");
  const recapAir = $el("recap-air");
  const recapCombo = $el("recap-combo");
  const recapBest = $el("recap-best");
  const titleBest = $el("title-best-dist");

  if (recapDist) recapDist.textContent = game.maxDistance.toFixed(0) + " m";
  if (recapAlt) recapAlt.textContent = game.highestAltitude.toFixed(0) + " m";
  if (recapScore) recapScore.textContent = String(game.score);
  if (recapAir) recapAir.textContent = (game.stunts.airtime / 1000).toFixed(1) + " s";
  if (recapCombo) recapCombo.textContent = `x${game.stunts.comboMultiplier}`;
  if (recapBest) recapBest.textContent = `${Math.max(game.career.bestDist, game.maxDistance).toFixed(0)} m`;
  if (titleBest) titleBest.textContent = `${game.career.bestDist.toFixed(0)} m`;
}

function updateGarageUI() {
  const v = game.vehicle;
  if (!v) return;
  const cfg = v.archetype;

  const tStiff = $el("tune-stiff");
  const tDamp = $el("tune-damp");
  const tGrip = $el("tune-grip");
  const tTorque = $el("tune-torque");

  if (tStiff) { tStiff.value = cfg.suspensionStiffness; $el("tune-val-stiff").textContent = Number(cfg.suspensionStiffness).toFixed(2); }
  if (tDamp) { tDamp.value = cfg.suspensionDamping; $el("tune-val-damp").textContent = Number(cfg.suspensionDamping).toFixed(3); }
  if (tGrip) { tGrip.value = cfg.tireGrip; $el("tune-val-grip").textContent = Number(cfg.tireGrip).toFixed(2); }
  if (tTorque) { tTorque.value = cfg.engineTorque; $el("tune-val-torque").textContent = Number(cfg.engineTorque).toFixed(3); }

  const echoesList = $el("garage-echoes-list");
  if (echoesList && game.echoManager) {
    echoesList.innerHTML = game.echoManager.relics.map(r => {
      const isFound = r.collected;
      return `<div style="padding: 6px 10px; border: 1px solid rgba(27,31,29,0.2); background: ${isFound ? 'rgba(212,98,42,0.1)' : 'rgba(27,31,29,0.03)'};">
        <strong>${isFound ? '&#10003; ' : '&#128274; '}${r.name}</strong> (${r.x}m)
        <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">${isFound ? r.lore : 'Relic undiscovered along the trail.'}</div>
      </div>`;
    }).join("");
  }
}

function togglePause() {
  isPaused = !isPaused;
  game.setPaused(isPaused);
  const pauseOverlay = $el("pause");
  if (pauseOverlay) {
    pauseOverlay.style.display = isPaused ? "flex" : "none";
    if (isPaused) updateCareerRecap();
  }
}

game.input.onPause = () => {
  if (hasStarted && !game.isDead) togglePause();
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

// Death Overlay Buttons
$el("death-retry-btn")?.addEventListener("click", () => {
  game.reset();
});
$el("death-new-route-btn")?.addEventListener("click", () => {
  game.newRun();
});
$el("death-garage-btn")?.addEventListener("click", () => {
  $el("death-screen").style.display = "none";
  const garage = $el("garage-screen");
  if (garage) {
    updateGarageUI();
    garage.style.display = "flex";
  }
});

// Garage Overlay Buttons & Sliders
$el("garage-close-btn")?.addEventListener("click", () => {
  $el("garage-screen").style.display = "none";
  game.reset();
});

const bindSlider = (id, valId, prop) => {
  const el = $el(id);
  const valEl = $el(valId);
  if (el && valEl) {
    el.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      valEl.textContent = val.toFixed(3);
      game.applyTuning(
        prop === "stiffness" ? val : undefined,
        prop === "damping" ? val : undefined,
        prop === "grip" ? val : undefined,
        prop === "torque" ? val : undefined
      );
    });
  }
};
bindSlider("tune-stiff", "tune-val-stiff", "stiffness");
bindSlider("tune-damp", "tune-val-damp", "damping");
bindSlider("tune-grip", "tune-val-grip", "grip");
bindSlider("tune-torque", "tune-val-torque", "torque");

// Archetype Selection Handlers
document.querySelectorAll(".archetype-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const archId = btn.getAttribute("data-archetype");
    if (!archId) return;
    document.querySelectorAll(".archetype-btn").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-archetype") === archId);
    });
    game.setVehicleArchetype(archId);
    updateGarageUI();
  });
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

updateCareerRecap();
game.start();
