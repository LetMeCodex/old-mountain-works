// ============================================================================
// THE OLD MOUNTAIN WORKS - MASTER GAME ENGINE OVERHAUL V4
// Mountain Generation 2.0: 8.2km Long-Form Expedition + Streamed Terrain Physics
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
// Vehicle Archetypes (Natural-Frequency Matched Prismatic Suspension)
// ----------------------------------------------------------------------------
const VEHICLE_ARCHETYPES = {
  buggy: {
    id: "buggy",
    name: "Trail Buggy",
    desc: "Balanced agile expedition chassis with progressive prismatic suspension.",
    chassisWidth: 108,
    chassisHeight: 24,
    chassisMass: 7.4,
    wheelRadius: 22,
    wheelMass: 1.25,
    wheelBase: 112,
    wheelOffsetY: 36,
    engineTorque: 0.085,
    brakeTorque: 0.110,
    maxWheelSpeed: 1.48,
    suspensionStiffness: 0.16,
    suspensionDamping: 0.065,
    suspensionTravel: 24,
    tireGrip: 1.58,
    airControl: 0.042,
    angularDamping: 0.035,
    centerOfMassOffsetY: 6.0,
    accentColor: "#d4622a",
    chassisColor: "#c8bda6",
  },
  crawler: {
    id: "crawler",
    name: "Mountain Crawler",
    desc: "Heavy reinforced frame, oversized tires, supreme grip and hill climbing torque.",
    chassisWidth: 116,
    chassisHeight: 26,
    chassisMass: 9.8,
    wheelRadius: 25,
    wheelMass: 1.65,
    wheelBase: 120,
    wheelOffsetY: 40,
    engineTorque: 0.105,
    brakeTorque: 0.130,
    maxWheelSpeed: 1.28,
    suspensionStiffness: 0.19,
    suspensionDamping: 0.075,
    suspensionTravel: 28,
    tireGrip: 1.75,
    airControl: 0.036,
    angularDamping: 0.042,
    centerOfMassOffsetY: 8.0,
    accentColor: "#357a62",
    chassisColor: "#b5a88f",
  },
  rally: {
    id: "rally",
    name: "Alpine Rally",
    desc: "Lightweight tuned racer with explosive acceleration and high airborne pitch authority.",
    chassisWidth: 102,
    chassisHeight: 22,
    chassisMass: 5.8,
    wheelRadius: 20,
    wheelMass: 1.0,
    wheelBase: 106,
    wheelOffsetY: 34,
    engineTorque: 0.092,
    brakeTorque: 0.115,
    maxWheelSpeed: 1.74,
    suspensionStiffness: 0.15,
    suspensionDamping: 0.058,
    suspensionTravel: 22,
    tireGrip: 1.52,
    airControl: 0.048,
    angularDamping: 0.030,
    centerOfMassOffsetY: 5.0,
    accentColor: "#c23a3a",
    chassisColor: "#d2c7b5",
  },
};

const n0 = {
  gravity: 1.65,
  fixedDelta: 1000 / 120, // 8.333ms high-precision substep
  maxSubSteps: 4,
};

const r0 = {
  followSpeed: 0.09,
  lookAhead: 175,
  baseZoom: 0.86,
  speedZoom: 0.16,
  airborneOffset: 0.35,
  impactZoom: 0.06,
  shakeIntensity: 1,
  baseFov: 55,
  minFov: 50,
  maxFov: 75,
  minZoom: 0.52,
  maxZoom: 0.96,
  horizonStability: 0.15,
  stuntRollFactor: 0.36,
  cinematicBudgetRatio: 0.26,
};

const i0 = {
  dustDensity: 1,
  screenShake: true,
  reducedMotion: false,
  muted: false,
  quality: "auto", // auto | high | medium | low
  renderScale: 1.0,
};

const x = {
  activeArchetype: "buggy",
  vehicle: VEHICLE_ARCHETYPES.buggy,
  physics: n0,
  camera: r0,
  visual: i0,
  world: {
    length: 328220, // 8.2 km expedition (8,200m * 40px/m + 220px startX)
    sampleStep: 18,
    groundBase: 560,
    startX: 220,
    chunkSamples: 20, // 360px (9m) per physics collision chunk
    activePhysicsRadius: 2160, // vehicle X +- 2,160px active collision window
  },
};

// ----------------------------------------------------------------------------
// 7-Sector / 8.2km Expedition Biome & Landmark System (Spec #10, #48, #49)
// ----------------------------------------------------------------------------
const BIOMES = [
  {
    id: "meadow",
    sector: 1,
    act: "ACT I",
    name: "Foothill Country",
    minDist: 0,
    maxDist: 800, // 0 - 0.8 km
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
    weather: "CLEAR",
    defaultMaterial: "grass",
    landmark: { x: 24000, name: "The Old Quarry", type: "shelter" },
  },
  {
    id: "ridge",
    sector: 2,
    act: "ACT II",
    name: "Broken Ridge",
    minDist: 800,
    maxDist: 1600, // 0.8 - 1.6 km
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
    weather: "WINDY",
    defaultMaterial: "rock",
    landmark: { x: 52000, name: "The Red Ridge", type: "cairn" },
  },
  {
    id: "canyon",
    sector: 3,
    act: "ACT III",
    name: "Great Descent",
    minDist: 1600,
    maxDist: 2400, // 1.6 - 2.4 km
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
    weather: "GORGE HAZE",
    defaultMaterial: "dirt",
    landmark: { x: 84000, name: "The Broken Trestle", type: "trestle" },
  },
  {
    id: "industrial",
    sector: 4,
    act: "ACT IV",
    name: "Canyon Works",
    minDist: 2400,
    maxDist: 3500, // 2.4 - 3.5 km
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
    weather: "MIST",
    defaultMaterial: "gravel",
    landmark: { x: 124000, name: "The Deep Mine", type: "pithead" },
  },
  {
    id: "glacier",
    sector: 5,
    act: "ACT V",
    name: "Glacier Run",
    minDist: 3500,
    maxDist: 5000, // 3.5 - 5.0 km
    skyTop: "#849eb3",
    skyBottom: "#cfe0eb",
    sun: "#e0915c",
    groundFill: "#1c242b",
    groundTop: "#9ab5c7",
    groundTopLight: "#c4d9e8",
    far: "#496175",
    mid: "#354959",
    near: "#253542",
    accent: "#2ea3a5",
    fogColor: "rgba(207,224,235,0.22)",
    weather: "GLACIAL",
    defaultMaterial: "ice",
    landmark: { x: 176000, name: "Glacier Basin", type: "cairn" },
  },
  {
    id: "crag",
    sector: 6,
    act: "ACT VI",
    name: "Summit Approach",
    minDist: 5000,
    maxDist: 6800, // 5.0 - 6.8 km
    skyTop: "#6e7f8f",
    skyBottom: "#b8c4ce",
    sun: "#d96b38",
    groundFill: "#1a1f24",
    groundTop: "#5c6873",
    groundTopLight: "#7c8996",
    far: "#3e4b57",
    mid: "#2d3740",
    near: "#1f272e",
    accent: "#d4622a",
    fogColor: "rgba(184,196,206,0.24)",
    weather: "HIGH GALE",
    defaultMaterial: "rock",
    landmark: { x: 240000, name: "The High Crag", type: "pithead" },
  },
  {
    id: "summit",
    sector: 7,
    act: "ACT VII",
    name: "Summit Face",
    minDist: 6800,
    maxDist: 15000, // 6.8 - 8.2+ km
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
    fogColor: "rgba(216,225,232,0.25)",
    weather: "SNOW",
    defaultMaterial: "snow",
    landmark: { x: 324000, name: "Summit Observatory", type: "beacon" },
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
    friction: 0.94,
    rollingResistance: 0.002,
    roughness: 0.12,
    dustKind: "dust",
    dustColors: ["#b6a98d", "#c9bda2", "#8c7659"],
    soundType: "soft",
  },
  rock: {
    name: "rock",
    friction: 1.12,
    rollingResistance: 0.001,
    roughness: 0.32,
    dustKind: "stone",
    dustColors: ["#dcd2be", "#a09c94", "#6e777a"],
    soundType: "hard",
  },
  gravel: {
    name: "gravel",
    friction: 0.86,
    rollingResistance: 0.004,
    roughness: 0.22,
    dustKind: "grit",
    dustColors: ["#b8b2a5", "#8c877d", "#484945"],
    soundType: "hard",
  },
  snow: {
    name: "snow",
    friction: 0.72,
    rollingResistance: 0.003,
    roughness: 0.10,
    dustKind: "snow",
    dustColors: ["#ffffff", "#eef4f8", "#d8e1e8"],
    soundType: "soft",
  },
  ice: {
    name: "ice",
    friction: 0.52,
    rollingResistance: 0.0005,
    roughness: 0.04,
    dustKind: "snow",
    dustColors: ["#ffffff", "#d0e4f2"],
    soundType: "soft",
  },
  wood: {
    name: "wood",
    friction: 0.96,
    rollingResistance: 0.0015,
    roughness: 0.14,
    dustKind: "wood",
    dustColors: ["#9c7c59", "#bca383", "#745839"],
    soundType: "hard",
  },
  metal: {
    name: "metal",
    friction: 0.88,
    rollingResistance: 0.0008,
    roughness: 0.06,
    dustKind: "spark",
    dustColors: ["#e37e3d", "#efd07b", "#9ca3a6"],
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
  { id: "echo_2", x: 38000, yOffset: -65, name: "First Ascent Expedition Log", lore: "'We abandoned the steam tractor in the scree. From here on, only momentum and iron will carry us.'" },
  { id: "echo_3", x: 84500, yOffset: -55, name: "The High Trestle Blueprint", lore: "Hand-inked schematics for the wooden chasm crossing, engineered to withstand 80-knot gales." },
  { id: "echo_4", x: 132000, yOffset: -60, name: "Miners' Carbide Lantern Fragment", lore: "Soot-stained glass salvaged from Pithead No. 4, echoing the rhythmic hiss of old acetylene." },
  { id: "echo_5", x: 196000, yOffset: -70, name: "Glacial Ice Core Capsule", lore: "Compressed firn layer trapping ancient alpine atmosphere from centuries before the roads." },
  { id: "echo_6", x: 312000, yOffset: -75, name: "The Summit Observatory Telegraph", lore: "'Trail impassable to ordinary machines. Signal received. Summit in sight.'" }
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

  // Living World Simulation: Distance-Delayed Rolling Thunder (Section 9 & 34)
  playThunder(volume = 0.65) {
    if (!this.ctx || !this.started || this.muted || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(190, now);
    filter.frequency.exponentialRampToValueAtTime(55, now + 1.4);

    const gain = ctx.createGain();
    const peak = b(volume * 0.45, 0.05, 0.5);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(peak * 0.45, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.65);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.envBus || this.sfxBus);
    noise.start(now);
    noise.stop(now + 1.7);
  }

  // Living World Simulation: Spatialized Birds, Night Crickets & Rain Patter (Section 34)
  updateLivingWorldAmbience(ws) {
    if (!this.ctx || !this.started || this.muted || !ws) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. Modulate wind filter by global world wind speed + rain
    if (this.windGain && this.windFilter) {
      const windNorm = b((ws.windSpeed || 4) / 26, 0, 1);
      const rainNorm = b(ws.rainIntensity || 0, 0, 1);
      const envVol = 0.02 + windNorm * 0.065 + rainNorm * 0.055;
      this.windGain.gain.setTargetAtTime(envVol, now, 0.25);
      this.windFilter.frequency.setTargetAtTime(240 + windNorm * 360 + rainNorm * 520, now, 0.25);
    }

    // 2. Occasional spatialized bird call during calm morning/daylight
    if (ws.sun.elevation > 0.02 && ws.rainIntensity < 0.25 && Math.random() < 0.42) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const baseFreq = 1650 + Math.random() * 850;
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.24, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 0.14);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.022, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      if (typeof ctx.createStereoPanner === "function") {
        const panner = ctx.createStereoPanner();
        panner.pan.value = (Math.random() - 0.5) * 1.6; // Left or distant right (Section 34)
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.envBus || this.sfxBus);
      } else {
        osc.connect(gain);
        gain.connect(this.envBus || this.sfxBus);
      }
      osc.start(now);
      osc.stop(now + 0.18);
    }

    // 3. Subtle dusk/night cricket trill when warm/humid
    if (ws.sun.elevation <= 0.05 && ws.season !== "WINTER" && ws.rainIntensity < 0.3 && Math.random() < 0.45) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(3850, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.012, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.envBus || this.sfxBus);
      osc.start(now);
      osc.stop(now + 0.1);
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
  capacity = 260;
  cursor = 0;

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
    this.cursor = 0;
  }

  alloc() {
    for (let i = 0; i < this.capacity; i++) {
      const idx = (this.cursor + i) % this.capacity;
      if (!this.pool[idx].active) {
        this.cursor = (idx + 1) % this.capacity;
        return this.pool[idx];
      }
    }
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    return p;
  }

  spawnWheelSpray(xPos, yPos, baseVx, baseVy, intensity, mat) {
    const density = x.visual.dustDensity ?? 1;
    const count = Math.min(3, Math.max(1, Math.round(intensity * 1.8 * density)));
    for (let i = 0; i < count; i++) {
      const p = this.alloc();
      p.active = true;
      p.x = xPos + (Math.random() - 0.5) * 8;
      p.y = yPos + (Math.random() - 0.5) * 4;
      p.vx = baseVx * (0.3 + Math.random() * 0.5) + (Math.random() - 0.5) * 3;
      p.vy = -Math.random() * 3.2 - 0.5;
      p.life = 0;
      p.maxLife = 280 + Math.random() * 260;
      p.size = 2.0 + Math.random() * 2.6;
      p.color = mat.dustColors[Math.floor(Math.random() * mat.dustColors.length)];
      p.alpha = 0.82;
      p.gravity = 0.22;
      p.kind = mat.dustKind;
      p.angle = 0;
      p.angularVelocity = 0;
    }
  }

  spawnLandingBurst(xPos, yPos, force, mat) {
    const density = x.visual.dustDensity ?? 1;
    const count = Math.min(22, Math.max(4, Math.round(force * 7 * density)));
    for (let i = 0; i < count; i++) {
      const p = this.alloc();
      p.active = true;
      p.x = xPos;
      p.y = yPos;
      const angle = (Math.random() * 0.8 + 0.1) * Math.PI;
      const speed = Math.random() * force * 3.4 + 1.0;
      p.vx = Math.cos(angle) * speed * (Math.random() < 0.5 ? 1 : -1);
      p.vy = -Math.sin(angle) * speed;
      p.life = 0;
      p.maxLife = 360 + Math.random() * 380;
      p.size = 2.4 + Math.random() * 3.4;
      p.color = mat.dustColors[Math.floor(Math.random() * mat.dustColors.length)];
      p.alpha = 0.92;
      p.gravity = 0.35;
      p.kind = mat.dustKind;
      p.angle = 0;
      p.angularVelocity = 0;
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
// CINEMATIC CAMERA DIRECTOR 2.0 — 21-State Machine, Shot Director, Spring Physics & Impact System
// ----------------------------------------------------------------------------
const CAMERA_STATES = {
  FOLLOW:             { priority: 20,  baseZoom: 0.86, fov: 55, lookMult: 1.00, heightOff: -34, thirdsX: -0.10, thirdsY: 0.12, rollFrac: 0.12, terrainWeight: 0.15, kX: 34, cX: 11.5, kY: 30, cY: 11.0, kZ: 18, cZ: 8.5 },
  CRUISE:             { priority: 25,  baseZoom: 0.82, fov: 58, lookMult: 1.15, heightOff: -38, thirdsX: -0.14, thirdsY: 0.14, rollFrac: 0.14, terrainWeight: 0.18, kX: 32, cX: 11.0, kY: 28, cY: 10.5, kZ: 16, cZ: 8.0 },
  DRONE:              { priority: 32,  baseZoom: 0.64, fov: 70, lookMult: 1.35, heightOff: -105,thirdsX: -0.12, thirdsY: 0.22, rollFrac: 0.08, terrainWeight: 0.32, kX: 20, cX: 9.0,  kY: 18, cY: 8.5,  kZ: 12, cZ: 7.0 },
  ORBIT:              { priority: 34,  baseZoom: 0.72, fov: 64, lookMult: 0.90, heightOff: -52, thirdsX: -0.05, thirdsY: 0.10, rollFrac: 0.24, terrainWeight: 0.20, kX: 26, cX: 10.0, kY: 24, cY: 9.5,  kZ: 15, cZ: 7.5 },
  CINEMATIC_APPROACH: { priority: 35,  baseZoom: 0.75, fov: 62, lookMult: 1.30, heightOff: -56, thirdsX: -0.16, thirdsY: 0.16, rollFrac: 0.10, terrainWeight: 0.28, kX: 24, cX: 9.5,  kY: 22, cY: 9.2,  kZ: 14, cZ: 7.5 },
  LANDING:            { priority: 42,  baseZoom: 0.88, fov: 52, lookMult: 0.95, heightOff: -18, thirdsX: -0.08, thirdsY: 0.06, rollFrac: 0.18, terrainWeight: 0.22, kX: 42, cX: 13.0, kY: 44, cY: 13.5, kZ: 26, cZ: 10.0 },
  JUMP:               { priority: 45,  baseZoom: 0.75, fov: 62, lookMult: 1.25, heightOff: -54, thirdsX: -0.12, thirdsY: -0.08,rollFrac: 0.18, terrainWeight: 0.25, kX: 28, cX: 10.2, kY: 24, cY: 9.5,  kZ: 16, cZ: 8.0 },
  AIRBORNE:           { priority: 48,  baseZoom: 0.71, fov: 64, lookMult: 1.30, heightOff: -62, thirdsX: -0.10, thirdsY: -0.12,rollFrac: 0.22, terrainWeight: 0.28, kX: 26, cX: 9.8,  kY: 22, cY: 9.0,  kZ: 15, cZ: 7.8 },
  HIGH_SPEED:         { priority: 50,  baseZoom: 0.73, fov: 66, lookMult: 1.45, heightOff: -24, thirdsX: -0.18, thirdsY: 0.14, rollFrac: 0.15, terrainWeight: 0.22, kX: 36, cX: 11.8, kY: 28, cY: 10.4, kZ: 18, cZ: 8.4 },
  ASCENT:             { priority: 55,  baseZoom: 0.79, fov: 58, lookMult: 1.15, heightOff: -64, thirdsX: -0.15, thirdsY: 0.18, rollFrac: 0.16, terrainWeight: 0.26, kX: 30, cX: 10.8, kY: 28, cY: 10.2, kZ: 16, cZ: 8.0 },
  DESCENT:            { priority: 60,  baseZoom: 0.71, fov: 64, lookMult: 1.38, heightOff: -12, thirdsX: -0.14, thirdsY: -0.14,rollFrac: 0.16, terrainWeight: 0.30, kX: 30, cX: 10.6, kY: 26, cY: 9.8,  kZ: 16, cZ: 8.0 },
  DANGER:             { priority: 62,  baseZoom: 0.83, fov: 56, lookMult: 0.90, heightOff: -30, thirdsX: -0.06, thirdsY: 0.08, rollFrac: 0.22, terrainWeight: 0.18, kX: 38, cX: 12.2, kY: 36, cY: 11.8, kZ: 22, cZ: 9.2 },
  EXTREME_CLIMB:      { priority: 65,  baseZoom: 0.74, fov: 61, lookMult: 1.25, heightOff: -88, thirdsX: -0.16, thirdsY: 0.22, rollFrac: 0.18, terrainWeight: 0.34, kX: 28, cX: 10.4, kY: 26, cY: 9.8,  kZ: 15, cZ: 7.8 },
  DEEP_VALLEY:        { priority: 70,  baseZoom: 0.63, fov: 68, lookMult: 1.42, heightOff: -48, thirdsX: -0.12, thirdsY: 0.16, rollFrac: 0.12, terrainWeight: 0.38, kX: 22, cX: 9.2,  kY: 20, cY: 8.8,  kZ: 13, cZ: 7.2 },
  CREST_REVEAL:       { priority: 75,  baseZoom: 0.69, fov: 64, lookMult: 1.48, heightOff: -96, thirdsX: -0.16, thirdsY: 0.20, rollFrac: 0.10, terrainWeight: 0.36, kX: 24, cX: 9.6,  kY: 24, cY: 9.4,  kZ: 14, cZ: 7.5 },
  LANDMARK:           { priority: 80,  baseZoom: 0.62, fov: 69, lookMult: 1.35, heightOff: -92, thirdsX: -0.12, thirdsY: 0.20, rollFrac: 0.08, terrainWeight: 0.40, kX: 20, cX: 8.8,  kY: 18, cY: 8.4,  kZ: 12, cZ: 6.8 },
  GIANT_JUMP:         { priority: 85,  baseZoom: 0.58, fov: 72, lookMult: 1.45, heightOff: -86, thirdsX: -0.10, thirdsY: -0.14,rollFrac: 0.25, terrainWeight: 0.35, kX: 22, cX: 9.2,  kY: 20, cY: 8.6,  kZ: 13, cZ: 7.0 },
  STUNT:              { priority: 90,  baseZoom: 0.66, fov: 67, lookMult: 1.05, heightOff: -58, thirdsX: -0.04, thirdsY: -0.06,rollFrac: 0.36, terrainWeight: 0.20, kX: 28, cX: 10.2, kY: 26, cY: 9.8,  kZ: 16, cZ: 8.0 },
  SUMMIT:             { priority: 92,  baseZoom: 0.58, fov: 71, lookMult: 1.30, heightOff: -110,thirdsX: -0.10, thirdsY: 0.24, rollFrac: 0.06, terrainWeight: 0.42, kX: 18, cX: 8.4,  kY: 16, cY: 8.0,  kZ: 11, cZ: 6.5 },
  DEATH:              { priority: 95,  baseZoom: 0.74, fov: 62, lookMult: 0.30, heightOff: -42, thirdsX: 0.0,   thirdsY: 0.05, rollFrac: 0.06, terrainWeight: 0.10, kX: 14, cX: 7.5,  kY: 14, cY: 7.5,  kZ: 10, cZ: 6.2 },
  VICTORY:            { priority: 95,  baseZoom: 0.53, fov: 74, lookMult: 0.60, heightOff: -135,thirdsX: 0.0,   thirdsY: 0.26, rollFrac: 0.0,  terrainWeight: 0.45, kX: 12, cX: 7.0,  kY: 12, cY: 7.0,  kZ: 9,  cZ: 5.8 },
  IMPACT:             { priority: 100, baseZoom: 0.90, fov: 51, lookMult: 0.90, heightOff: -22, thirdsX: -0.08, thirdsY: 0.06, rollFrac: 0.24, terrainWeight: 0.15, kX: 46, cX: 13.8, kY: 48, cY: 14.0, kZ: 28, cZ: 10.5 },
};

// 2nd-Order Physical Spring-Damper Integrator (Section 33)
class SpringDamper1D {
  value = 0;
  target = 0;
  velocity = 0;
  stiffness = 30;
  damping = 10.5;
  mass = 1.0;

  constructor(initial = 0, stiffness = 30, damping = 10.5, mass = 1.0) {
    this.value = initial;
    this.target = initial;
    this.stiffness = stiffness;
    this.damping = damping;
    this.mass = mass;
  }

  reset(val) {
    this.value = val;
    this.target = val;
    this.velocity = 0;
  }

  step(target, dtSec, k = this.stiffness, c = this.damping, m = this.mass) {
    if (!Number.isFinite(target)) return this.value;
    if (!Number.isFinite(this.value)) this.value = target;
    if (!Number.isFinite(this.velocity)) this.velocity = 0;
    this.target = target;

    // Sub-step at <= 8ms for unconditional spring stability
    const clampedDt = b(dtSec, 0.001, 0.05);
    const subSteps = Math.max(1, Math.ceil(clampedDt / 0.008));
    const h = clampedDt / subSteps;

    for (let i = 0; i < subSteps; i++) {
      const disp = this.value - this.target;
      const force = -k * disp - c * this.velocity;
      const accel = force / Math.max(0.1, m);
      this.velocity += accel * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  get error() {
    return Math.abs(this.target - this.value);
  }
}

// Physically Driven Multi-Frequency Procedural Camera Vibration & Impact Response (Sections 21 & 22)
class CameraImpactSystem {
  events = [];
  posImpulseX = 0;
  posImpulseY = 0;
  rotImpulse = 0;
  zoomImpulse = 0;
  fovImpulse = 0;
  lastImpactMagnitude = 0;
  phase = 0;

  get intensity() {
    return this.lastImpactMagnitude;
  }

  reset() {
    this.events.length = 0;
    this.posImpulseX = 0;
    this.posImpulseY = 0;
    this.rotImpulse = 0;
    this.zoomImpulse = 0;
    this.fovImpulse = 0;
    this.lastImpactMagnitude = 0;
  }

  triggerImpact(magnitude, durationMs = 280, nx = 0, ny = -1) {
    const mag = b(magnitude, 0, 1.0);
    this.lastImpactMagnitude = Math.max(this.lastImpactMagnitude, mag);
    const isReduced = Boolean(x.visual.reducedMotion || (typeof window !== "undefined" && window.game?.settings?.reducedMotion));
    if (!x.visual.screenShake || isReduced) {
      // Even in reduced motion, preserve a tiny non-jarring zoom response
      this.zoomImpulse = Math.min(0.03, this.zoomImpulse + mag * 0.025);
      return;
    }

    const dirX = Number.isFinite(nx) ? nx : 0;
    const dirY = Number.isFinite(ny) ? ny : -1;

    // Physical directional impulse on camera mass
    this.posImpulseX += -dirX * mag * 18;
    this.posImpulseY += Math.abs(dirY) * mag * 24;
    this.rotImpulse += (dirX >= 0 ? 1 : -1) * mag * 0.032;
    this.zoomImpulse = b(this.zoomImpulse + mag * 0.055, -0.06, 0.085);
    this.fovImpulse = b(this.fovImpulse - mag * 4.5, -6.5, 4.0);

    this.events.push({
      mag,
      duration: Math.max(120, durationMs),
      elapsed: 0,
      nx: dirX,
      ny: dirY,
      seedPhase: Math.random() * Math.PI * 2,
    });
    if (this.events.length > 6) this.events.shift();
  }

  update(dtMs) {
    const dtSec = b(dtMs / 1000, 0.001, 0.05);
    this.phase += dtSec;

    // Natural exponential decay of physical impulses
    const decay = Math.exp(-8.5 * dtSec);
    this.posImpulseX *= decay;
    this.posImpulseY *= decay;
    this.rotImpulse *= decay;
    this.zoomImpulse *= Math.exp(-6.2 * dtSec);
    this.fovImpulse *= Math.exp(-6.2 * dtSec);
    this.lastImpactMagnitude *= Math.exp(-3.5 * dtSec);

    for (let i = this.events.length - 1; i >= 0; i--) {
      const ev = this.events[i];
      ev.elapsed += dtMs;
      if (ev.elapsed >= ev.duration) {
        this.events.splice(i, 1);
      }
    }
  }

  // Multi-frequency procedural operator vibration (Low 2.8Hz heave + Mid 8.5Hz thud + High 21Hz chassis ring)
  getOffset() {
    const isReduced = Boolean(x.visual.reducedMotion || (typeof window !== "undefined" && window.game?.settings?.reducedMotion));
    if (!x.visual.screenShake || isReduced) {
      return { x: 0, y: 0, roll: 0 };
    }
    let ox = this.posImpulseX;
    let oy = this.posImpulseY;
    let oroll = this.rotImpulse;

    const scale = x.camera.shakeIntensity ?? 1.0;
    for (const ev of this.events) {
      const u = b(1 - ev.elapsed / ev.duration, 0, 1);
      const env = u * u;
      const t = ev.elapsed * 0.001 + ev.seedPhase;

      // 3-band physical synthesis
      const lowBody = Math.sin(t * Math.PI * 2 * 2.8) * 14.0 * ev.mag * env;
      const midImpact = Math.cos(t * Math.PI * 2 * 8.5) * 9.5 * ev.mag * env;
      const highMicro = Math.sin(t * Math.PI * 2 * 21.0) * 3.8 * ev.mag * env * u;

      ox += (lowBody * 0.45 + midImpact * (0.5 + Math.abs(ev.nx)) + highMicro * 0.35) * scale;
      oy += (lowBody * 0.75 + midImpact * (0.5 + Math.abs(ev.ny)) + highMicro * 0.25) * scale;
      oroll += Math.sin(t * Math.PI * 2 * 5.2) * 0.012 * ev.mag * env * scale;
    }

    return { x: ox, y: oy, roll: oroll };
  }
}

// Shot Director with Per-Shot Cooldowns, Min/Max Durations & 75/25 Cinematic Budget (Sections 38, 39, 40)
const SHOT_CONFIGS = {
  SHOT_FOLLOW:  { cooldown: 0,     minDur: 0,    maxDur: 999999, isSpecial: false },
  SHOT_SIDE:    { cooldown: 14000, minDur: 1800, maxDur: 3800,   isSpecial: true  },
  SHOT_DRONE:   { cooldown: 20000, minDur: 2200, maxDur: 4600,   isSpecial: true  },
  SHOT_LOW:     { cooldown: 16000, minDur: 1400, maxDur: 2800,   isSpecial: true  },
  SHOT_REVERSE: { cooldown: 28000, minDur: 1500, maxDur: 2800,   isSpecial: true  },
  SHOT_ORBIT:   { cooldown: 4500,  minDur: 700,  maxDur: 3200,   isSpecial: true  },
  SHOT_WIDE:    { cooldown: 18000, minDur: 2200, maxDur: 4800,   isSpecial: true  },
  SHOT_CLOSE:   { cooldown: 9000,  minDur: 550,  maxDur: 1200,   isSpecial: true  },
  SHOT_REVEAL:  { cooldown: 12000, minDur: 1400, maxDur: 3400,   isSpecial: true  },
  SHOT_SUMMIT:  { cooldown: 0,     minDur: 2500, maxDur: 999999, isSpecial: true  },
};

class CameraShotDirector {
  activeShot = "SHOT_FOLLOW";
  shotElapsed = 0;
  cooldowns = new Map();
  totalTimeMs = 1;
  specialTimeMs = 0;

  reset() {
    this.activeShot = "SHOT_FOLLOW";
    this.shotElapsed = 0;
    this.cooldowns.clear();
    this.totalTimeMs = 1;
    this.specialTimeMs = 0;
  }

  get cinematicRatio() {
    return this.specialTimeMs / Math.max(1, this.totalTimeMs);
  }

  getCinematicRatio() {
    return this.cinematicRatio;
  }

  canTrigger(shotType) {
    const cfg = SHOT_CONFIGS[shotType];
    if (!cfg) return false;
    if (!cfg.isSpecial) return true;
    const isReduced = Boolean(x.visual.reducedMotion || (typeof window !== "undefined" && window.game?.settings?.reducedMotion));
    if (isReduced && (shotType === "SHOT_ORBIT" || shotType === "SHOT_REVERSE" || shotType === "SHOT_LOW")) {
      return false;
    }
    const rem = this.cooldowns.get(shotType) ?? 0;
    if (rem > 0) return false;

    // Enforce 70-80% normal gameplay budget unless it's a high-priority stunt, landmark, or summit shot
    if (shotType !== "SHOT_SUMMIT" && shotType !== "SHOT_ORBIT" && shotType !== "SHOT_REVEAL") {
      if (this.cinematicRatio > (x.camera.cinematicBudgetRatio ?? 0.26)) {
        return false;
      }
    }
    return true;
  }

  selectShot(state, ctx, dtMs) {
    this.totalTimeMs += dtMs;
    this.shotElapsed += dtMs;

    for (const [k, rem] of this.cooldowns.entries()) {
      if (rem > 0) this.cooldowns.set(k, Math.max(0, rem - dtMs));
    }

    const curCfg = SHOT_CONFIGS[this.activeShot] || SHOT_CONFIGS.SHOT_FOLLOW;
    if (curCfg.isSpecial) {
      this.specialTimeMs += dtMs;
    }
    // Decay rolling budget window over 30s
    if (this.totalTimeMs > 30000) {
      this.totalTimeMs *= 0.98;
      this.specialTimeMs *= 0.98;
    }

    // Immediate overrides for Summit / Victory / Death / Stunt
    if (state === "SUMMIT" || state === "VICTORY") {
      return this.transitionTo("SHOT_SUMMIT");
    }
    if (state === "DEATH") {
      return this.transitionTo("SHOT_WIDE");
    }
    if (state === "STUNT" || ctx.stuntMagnitude >= 1) {
      if (this.canTrigger("SHOT_ORBIT") || this.activeShot === "SHOT_ORBIT") {
        return this.transitionTo("SHOT_ORBIT");
      }
    }

    // Respect minimum duration of active special shot unless danger/impact interrupts
    if (
      this.activeShot !== "SHOT_FOLLOW" &&
      this.shotElapsed < curCfg.minDur &&
      state !== "DANGER" &&
      state !== "IMPACT"
    ) {
      return this.activeShot;
    }

    // Expire active special shot if it reached maxDur
    if (this.activeShot !== "SHOT_FOLLOW" && this.shotElapsed >= curCfg.maxDur) {
      this.cooldowns.set(this.activeShot, curCfg.cooldown);
      this.activeShot = "SHOT_FOLLOW";
      this.shotElapsed = 0;
    }

    // Evaluate contextual shot candidates
    let desired = "SHOT_FOLLOW";
    if (state === "CREST_REVEAL") {
      desired = "SHOT_REVEAL";
    } else if (state === "LANDMARK" || state === "DEEP_VALLEY") {
      desired = this.canTrigger("SHOT_DRONE") ? "SHOT_DRONE" : "SHOT_WIDE";
    } else if (state === "GIANT_JUMP") {
      const isReduced = Boolean(x.visual.reducedMotion || (typeof window !== "undefined" && window.game?.settings?.reducedMotion));
      desired = ctx.airTimeMs > 1100 && !isReduced ? "SHOT_ORBIT" : "SHOT_WIDE";
    } else if (state === "LANDING" && ctx.maxCompression > 0.62) {
      desired = "SHOT_CLOSE";
    } else if (state === "EXTREME_CLIMB" && ctx.speedKmh > 38) {
      desired = this.canTrigger("SHOT_DRONE") ? "SHOT_DRONE" : (this.canTrigger("SHOT_REVERSE") ? "SHOT_REVERSE" : "SHOT_WIDE");
    } else if (state === "HIGH_SPEED") {
      if (Math.abs(ctx.slopeDeg) < 10 && this.canTrigger("SHOT_LOW")) {
        desired = "SHOT_LOW";
      } else if (Math.abs(ctx.slopeDeg) < 15 && this.canTrigger("SHOT_SIDE")) {
        desired = "SHOT_SIDE";
      }
    } else if (state === "CRUISE" && ctx.speedKmh > 42 && Math.abs(ctx.slopeDeg) < 12) {
      if (this.canTrigger("SHOT_SIDE")) desired = "SHOT_SIDE";
    }

    if (desired !== this.activeShot) {
      if (desired === "SHOT_FOLLOW" || this.canTrigger(desired)) {
        return this.transitionTo(desired);
      }
    }
    return this.activeShot;
  }

  transitionTo(nextShot) {
    if (this.activeShot === nextShot) return this.activeShot;
    const prevCfg = SHOT_CONFIGS[this.activeShot];
    if (prevCfg && prevCfg.isSpecial && this.shotElapsed > 300) {
      this.cooldowns.set(this.activeShot, prevCfg.cooldown);
    }
    this.activeShot = nextShot;
    this.shotElapsed = 0;
    return this.activeShot;
  }
}

// Master Cinematic Camera Director (Single Camera Authority — Sections 01–59)
class CameraDirector {
  x = 220;
  y = 500;
  zoom = x.camera.baseZoom;
  targetZoom = x.camera.baseZoom;
  fov = x.camera.baseFov || 55;
  targetFov = x.camera.baseFov || 55;
  roll = 0;
  targetRoll = 0;

  state = "FOLLOW";
  prevState = "FOLLOW";
  shotType = "SHOT_FOLLOW";
  priority = 20;
  transitionCount = 0;
  stateTimer = 0;

  // Dynamic Look-Ahead & Rule-of-Thirds Targets
  lookAhead = 100;
  rawLookAhead = 100;
  predictedPos = { x: 220, y: 500 };
  terrainFocusPoint = { x: 320, y: 500 };
  landingZone = { x: 220, y: 500, active: false };
  targetPoint = { x: 220, y: 500 };
  cameraVelocity = { x: 0, y: 0 };

  // Feature & Landmark Awareness
  currentFeature = "Starting Apron";
  distanceToFeature = 0;
  nearestLandmark = "";
  distanceToLandmark = 9999;
  stuntMagnitude = 0;
  prevMaxCompression = 0;
  zoomPulse = 0;

  // Sub-systems
  springX = new SpringDamper1D(220, 34, 11.5, 1.0);
  springY = new SpringDamper1D(500, 30, 11.0, 1.0);
  springZoom = new SpringDamper1D(x.camera.baseZoom, 18, 8.5, 1.0);
  springFov = new SpringDamper1D(55, 16, 8.0, 1.0);
  springRoll = new SpringDamper1D(0, 24, 9.5, 1.0);
  springLookX = new SpringDamper1D(220, 38, 12.0, 1.0);
  springLookY = new SpringDamper1D(500, 34, 11.5, 1.0);

  impact = new CameraImpactSystem();
  shotDirector = new CameraShotDirector();
  shakes = []; // Kept for backward compatibility

  telemetry = {
    cameraState: "FOLLOW",
    shotType: "SHOT_FOLLOW",
    transitionCount: 0,
    cameraDistance: 100,
    lookAhead: 100,
    fov: 55,
    zoom: 0.86,
    rollDeg: 0,
    priority: 20,
    impactMagnitude: 0,
    airTime: 0,
    stuntMagnitude: 0,
    terrainFeature: "Starting Apron",
    distanceToFeature: 0,
    springVelocity: 0,
    springError: 0,
  };

  reset(xPos = 220, yPos = 500) {
    const safeX = Number.isFinite(xPos) ? xPos : 220;
    const safeY = Number.isFinite(yPos) ? yPos : 500;
    this.x = safeX;
    this.y = safeY;
    this.zoom = x.camera.baseZoom;
    this.targetZoom = x.camera.baseZoom;
    this.fov = x.camera.baseFov || 55;
    this.targetFov = this.fov;
    this.roll = 0;
    this.targetRoll = 0;
    this.state = "FOLLOW";
    this.prevState = "FOLLOW";
    this.shotType = "SHOT_FOLLOW";
    this.priority = 20;
    this.stateTimer = 0;
    this.lookAhead = 100;
    this.rawLookAhead = 100;
    this.predictedPos = { x: safeX, y: safeY };
    this.terrainFocusPoint = { x: safeX + 100, y: safeY };
    this.landingZone = { x: safeX, y: safeY, active: false };
    this.targetPoint = { x: safeX, y: safeY };
    this.cameraVelocity = { x: 0, y: 0 };
    this.zoomPulse = 0;
    this.prevMaxCompression = 0;

    this.springX.reset(safeX);
    this.springY.reset(safeY);
    this.springZoom.reset(x.camera.baseZoom);
    this.springFov.reset(this.fov);
    this.springRoll.reset(0);
    this.springLookX.reset(safeX);
    this.springLookY.reset(safeY);

    this.impact.reset();
    this.shotDirector.reset();
    this.shakes.length = 0;
  }

  shake(intensity, duration = 260, dirX = 0, dirY = -1) {
    this.impact.triggerImpact(intensity * 1.6, duration, dirX, dirY);
  }

  addShake(intensity, angle = 0, energy = 0) {
    this.impact.triggerImpact(intensity, 280, Math.cos(angle), Math.sin(angle));
  }

  pulseZoom(amount) {
    if (x.visual.reducedMotion) return;
    this.zoomPulse = b(this.zoomPulse + amount, -0.06, 0.08);
  }

  get lookAheadDistance() {
    return this.rawLookAhead;
  }

  get springVelocity() {
    return { x: this.springX.velocity, y: this.springY.velocity };
  }

  get springError() {
    return { x: this.springX.error, y: this.springY.error };
  }

  // Smooth nonlinear speed -> look-ahead curve (Section 06)
  // 0 km/h -> 100px | 20 km/h -> 250px | 50 km/h -> 500px | 80+ km/h -> 800px+
  computeNonlinearLookAhead(speedKmh, dirSign = 1) {
    const s = Math.max(0, speedKmh);
    let distPx;
    if (s <= 20) {
      const t = s / 20;
      distPx = 100 + (250 - 100) * (t * (2 - t));
    } else if (s <= 50) {
      const t = (s - 20) / 30;
      const smoothT = t * t * (3 - 2 * t);
      distPx = 250 + (500 - 250) * smoothT;
    } else {
      const t = b((s - 50) / 30, 0, 1.35);
      distPx = 500 + 300 * Math.min(1, t) + Math.max(0, t - 1) * 180;
    }
    return distPx * dirSign;
  }

  // Predict ballistic landing point on terrain when airborne (Sections 16 & 20)
  predictLandingZone(posX, posY, vx, vy, terrain) {
    if (!terrain) return { x: posX + vx * 20, y: posY, active: false };
    let simX = posX;
    let simY = posY;
    let simVx = vx;
    let simVy = vy;
    const grav = (x.physics.gravity || 1.65) * 0.12;

    for (let i = 0; i < 28; i++) {
      simX += simVx * 1.6;
      simY += simVy * 1.6;
      simVy += grav;
      const ty = terrain.heightAt(simX);
      if (simY >= ty - 28) {
        return { x: simX, y: ty - 28, active: true };
      }
    }
    const fallbackY = terrain.heightAt(simX);
    return { x: simX, y: fallbackY - 28, active: true };
  }

  // Locate nearest major landmark across the 7 sectors (Section 30)
  findNearestLandmark(posX) {
    let bestName = "";
    let bestDistM = 9999;
    let bestX = posX;
    if (typeof BIOMES !== "undefined") {
      for (const bItem of BIOMES) {
        if (bItem.landmark) {
          const dM = Math.abs(bItem.landmark.x - posX) / 40;
          if (dM < bestDistM) {
            bestDistM = dM;
            bestName = bItem.landmark.name;
            bestX = bItem.landmark.x;
          }
        }
      }
    }
    return { name: bestName, distM: bestDistM, x: bestX };
  }

  // Evaluate priority-driven Camera State from live world + vehicle telemetry (Sections 02, 03, 37)
  evaluateState(ctx) {
    if (ctx.isDead || ctx.deathState === "death" || ctx.deathState === "wrecked") {
      return "DEATH";
    }
    if (ctx.summitReached) {
      return "VICTORY";
    }
    if (ctx.impactMagnitude > 0.52 || (ctx.deltaCompression > 0.34 && !ctx.airborne)) {
      return "IMPACT";
    }
    if (ctx.airborne && ctx.stuntMagnitude >= 1) {
      return "STUNT";
    }
    if (ctx.airborne && (ctx.airTimeMs > 780 || ctx.groundClearance > 115 || ctx.segNow?.jumpPotential === "Extreme")) {
      return "GIANT_JUMP";
    }
    if (ctx.distMeters >= 7850) {
      return "SUMMIT";
    }
    if (ctx.landmarkDistM < 42 || Boolean(ctx.segNow?.signature) || Boolean(ctx.segAhead?.signature)) {
      return "LANDMARK";
    }
    if (ctx.isApproachingCrest) {
      return "CREST_REVEAL";
    }
    if (ctx.isDeepValley) {
      return "DEEP_VALLEY";
    }
    if (ctx.slopeDeg < -28 || ctx.segNow?.category === "EXTREME" || ctx.segAhead?.category === "EXTREME") {
      return "EXTREME_CLIMB";
    }
    if (ctx.dangerLevel > 0.68) {
      return "DANGER";
    }
    if (ctx.slopeDeg > 20 || ctx.segNow?.category === "DESCENT") {
      return "DESCENT";
    }
    if (ctx.slopeDeg < -16 || ctx.segNow?.category === "CLIMB") {
      return "ASCENT";
    }
    if (ctx.airborne) {
      if (ctx.vy > 2.2 && ctx.groundClearance < 95) {
        return "LANDING";
      }
      return ctx.airTimeMs > 280 ? "AIRBORNE" : "JUMP";
    }
    if (ctx.justLandedTimer > 0) {
      return "LANDING";
    }
    if (ctx.speedKmh >= 68) {
      return "HIGH_SPEED";
    }
    if (ctx.distToFeatureM < 28 && (ctx.segAhead?.category === "JUMP" || ctx.segAhead?.category === "VALLEY")) {
      return "CINEMATIC_APPROACH";
    }
    if (ctx.speedKmh >= 28) {
      return "CRUISE";
    }
    return "FOLLOW";
  }

  update(arg1, arg2, arg3, arg4) {
    // Support both update(vehicle, terrain, dt, game) and legacy update(pos, vel, airborne, dt)
    let vehicle = null, targetPos, targetVel, airborne = false, dt = 16.66, terrain = null, groundClearance = 0;
    if (arg1 && arg1.chassis) {
      vehicle = arg1;
      targetPos = vehicle.chassis.position;
      targetVel = vehicle.chassis.velocity;
      airborne = Boolean(vehicle.airborne);
      groundClearance = vehicle.groundClearance || 0;
      terrain = arg2 && typeof arg2.heightAt === "function" ? arg2 : null;
      dt = typeof arg3 === "number" ? arg3 : (typeof arg2 === "number" ? arg2 : 16.66);
    } else {
      targetPos = arg1;
      targetVel = arg2;
      airborne = Boolean(arg3);
      dt = typeof arg4 === "number" ? arg4 : 16.66;
    }

    const safeDt = Number.isFinite(dt) && dt > 0 ? b(dt, 1, 50) : 16.66;
    const dtSec = safeDt / 1000;
    const gameRef = typeof window !== "undefined" ? window.game : null;

    const posX = Number.isFinite(targetPos?.x) ? targetPos.x : (Number.isFinite(this.x) ? this.x : 220);
    const posY = Number.isFinite(targetPos?.y) ? targetPos.y : (Number.isFinite(this.y) ? this.y : 500);
    const vx = Number.isFinite(targetVel?.x) ? targetVel.x : 0;
    const vy = Number.isFinite(targetVel?.y) ? targetVel.y : 0;
    const speedPx = Math.hypot(vx, vy);
    const speedKmh = vehicle ? Math.abs(vehicle.forwardSpeed || vx) * 7.2 : speedPx * 7.2;
    const dirSign = vx < -0.6 ? -1 : 1;

    // 1. Gather Vehicle, Stunt, and Suspension Telemetry
    const chassisAngle = vehicle?.chassis?.angle ?? 0;
    const angVel = vehicle?.chassis?.angularVelocity ?? 0;
    const compRear = vehicle?.wheels?.[0]?.compression ?? 0;
    const compFront = vehicle?.wheels?.[1]?.compression ?? 0;
    const maxCompression = Math.max(compRear, compFront);
    const deltaCompression = Math.max(0, maxCompression - this.prevMaxCompression);
    this.prevMaxCompression = maxCompression;

    // Trigger subtle physical suspension compression impulse on heavy landing
    if (deltaCompression > 0.28 && !airborne) {
      this.impact.triggerImpact(b(deltaCompression * 0.85, 0.12, 0.75), 220, 0, -1);
    }
    this.impact.update(safeDt);

    const stunts = gameRef?.stunts;
    const airTimeMs = stunts?.airtime ?? (vehicle?.airborneTimer ?? 0);
    const totalFlips = (stunts?.backflips ?? 0) + (stunts?.frontflips ?? 0);
    const rawAirAngle = stunts?.cumulativeAngle ?? stunts?.airRotation ?? 0;
    const rotCount = Math.abs(rawAirAngle) / 1.80;
    const hasActiveFlip = /FLIP/i.test(stunts?.activeStuntName || "");
    this.stuntMagnitude = Math.max(totalFlips, Math.floor(rotCount), hasActiveFlip ? 1 : 0);

    // 2. Gather Multi-Point Terrain Telemetry Ahead
    let slopeRad = 0;
    let slopeAheadNear = 0;
    let slopeAheadFar = 0;
    let curvHere = 0;
    let segNow = null;
    let segAhead = null;
    let distToFeatureM = 999;

    if (terrain) {
      slopeRad = terrain.slopeAt(posX);
      slopeAheadNear = terrain.slopeAt(posX + 240 * dirSign);
      slopeAheadFar = terrain.slopeAt(posX + 540 * dirSign);
      curvHere = terrain.curvatureAt ? terrain.curvatureAt(posX + 140 * dirSign) : 0;
      segNow = terrain.segmentAt ? terrain.segmentAt(posX) : null;
      segAhead = terrain.segmentAt ? terrain.segmentAt(posX + 420 * dirSign) : null;
      if (segAhead && segAhead !== segNow && Number.isFinite(segAhead.startX)) {
        distToFeatureM = Math.max(0, (segAhead.startX - posX) / 40);
      }
    }

    const slopeDeg = (slopeRad * 180) / Math.PI;
    const slopeAheadDeg = (slopeAheadNear * 180) / Math.PI;
    const slopeFarDeg = (slopeAheadFar * 180) / Math.PI;

    // Detect Crest Reveal (climbing now, dropping ahead OR entering CREST/JUMP segment)
    const isApproachingCrest =
      (slopeDeg < -10 && slopeFarDeg > 6) ||
      segNow?.category === "CREST" ||
      segAhead?.category === "CREST";

    // Detect Deep Valley / Compression Basin
    const isDeepValley =
      segNow?.category === "VALLEY" ||
      segAhead?.category === "VALLEY" ||
      (slopeDeg > 14 && slopeFarDeg < -12);

    const lm = this.findNearestLandmark(posX);
    this.nearestLandmark = lm.name;
    this.distanceToLandmark = Math.round(lm.distM);
    this.currentFeature = segAhead?.signature || segNow?.signature || segNow?.name || "Mountain Trail";
    this.distanceToFeature = Math.round(distToFeatureM < 500 ? distToFeatureM : lm.distM);

    const distMeters = Math.max(0, (posX - x.world.startX) / 40);
    const altMeters = Math.max(0, (x.world.groundBase - posY) / 40);
    const isInverted = Math.cos(chassisAngle) < -0.25;
    const dangerLevel = isInverted ? 0.95 : b(Math.abs(angVel) * 3.2 + (Math.abs(slopeDeg) > 36 ? 0.35 : 0), 0, 1);

    this._justLandedTimer = Math.max(0, (this._justLandedTimer || 0) - safeDt);
    if (!airborne && this._wasAirborne) {
      this._justLandedTimer = 420;
    }
    this._wasAirborne = airborne;

    // 3. Evaluate Authoritative Camera State & Shot Director
    const evalCtx = {
      posX,
      posY,
      vx,
      vy,
      speedKmh,
      airborne,
      airTimeMs,
      groundClearance,
      slopeDeg,
      slopeAheadDeg,
      slopeFarDeg,
      curvHere,
      segNow,
      segAhead,
      distToFeatureM,
      isApproachingCrest,
      isDeepValley,
      landmarkDistM: lm.distM,
      distMeters,
      altMeters,
      maxCompression,
      deltaCompression,
      impactMagnitude: this.impact.lastImpactMagnitude,
      stuntMagnitude: this.stuntMagnitude,
      dangerLevel,
      justLandedTimer: this._justLandedTimer,
      deathState: gameRef?.deathState ?? "normal",
      isDead: Boolean(gameRef?.isDead || vehicle?.dead),
      summitReached: Boolean(gameRef?.summitReached),
    };

    const nextState = this.evaluateState(evalCtx);
    if (nextState !== this.state) {
      this.prevState = this.state;
      this.state = nextState;
      this.transitionCount++;
      this.stateTimer = 0;
    } else {
      this.stateTimer += safeDt;
    }

    const stCfg = CAMERA_STATES[this.state] || CAMERA_STATES.FOLLOW;
    this.priority = stCfg.priority;
    this.shotType = this.shotDirector.selectShot(this.state, evalCtx, safeDt);

    // 4. Compute Nonlinear Velocity Prediction (0.3s - 0.8s ahead) & Terrain Focus Point (Sections 05, 06, 36)
    const rawLookPx = this.computeNonlinearLookAhead(speedKmh, dirSign) * stCfg.lookMult;
    this.rawLookAhead = rawLookPx;

    const predTimeSec = b(0.32 + (speedKmh / 110) * 0.46, 0.30, 0.80);
    const predX = posX + vx * (predTimeSec * 60);
    const predY = posY + vy * (predTimeSec * 28);
    this.predictedPos = { x: predX, y: predY };

    // Terrain Focus Point ahead along spline
    let focusX = posX + rawLookPx * 0.65;
    if (this.state === "LANDMARK" && lm.distM < 45) {
      focusX = O0(focusX, lm.x, 0.35);
    }
    const focusY = terrain ? terrain.heightAt(focusX) - 42 : posY - 36;
    this.terrainFocusPoint = { x: focusX, y: focusY };

    // Ballistic Landing Zone Prediction when Airborne (Sections 16 & 20)
    if (airborne) {
      this.landingZone = this.predictLandingZone(posX, posY, vx, vy, terrain);
    } else {
      this.landingZone = { x: posX, y: posY, active: false };
    }

    // 5. Weighted Look Target (Vehicle + Velocity Prediction + Terrain Feature) & Rule-of-Thirds Framing (Sections 27, 28, 36)
    const wTerrain = stCfg.terrainWeight;
    const wVel = 0.25;
    const wVeh = 1.0 - wTerrain - wVel;

    let blendedTargetX = posX * wVeh + predX * wVel + focusX * wTerrain;
    let blendedTargetY = posY * wVeh + predY * wVel + focusY * wTerrain;

    // During airborne descent, blend toward predicted landing zone so landing is always readable
    if (airborne && this.landingZone.active) {
      const landBlend = b(vy > 0 ? 0.28 : 0.16, 0.12, 0.32);
      blendedTargetX = O0(blendedTargetX, this.landingZone.x, landBlend);
      blendedTargetY = O0(blendedTargetY, (posY + this.landingZone.y) * 0.5, landBlend);
    }

    // Apply Shot-Specific Framing Offsets (Drone, Side, Low, Reverse, Orbit, Reveal, Close, Wide, Summit)
    let shotOffsetX = 0;
    let shotOffsetY = stCfg.heightOff;
    let shotZoomDelta = 0;
    let shotFovDelta = 0;

    if (this.shotType === "SHOT_DRONE") {
      const dronePhase = (this.shotDirector.shotElapsed || 0) * 0.0012;
      shotOffsetX += Math.sin(dronePhase) * 45 + 55 * dirSign;
      shotOffsetY -= 58;
      shotZoomDelta -= 0.06;
      shotFovDelta += 5;
    } else if (this.shotType === "SHOT_SIDE") {
      shotOffsetX += 48 * dirSign;
      shotOffsetY += 12;
      shotZoomDelta -= 0.02;
      shotFovDelta += 3;
    } else if (this.shotType === "SHOT_LOW") {
      shotOffsetX += 32 * dirSign;
      shotOffsetY += 32; // Low to the ground for wheel/dust speed sensation
      shotZoomDelta += 0.04;
      shotFovDelta += 4;
    } else if (this.shotType === "SHOT_REVERSE") {
      // Look back from slightly behind/above while keeping forward climb readable
      shotOffsetX -= 65 * dirSign;
      shotOffsetY -= 28;
      shotZoomDelta -= 0.05;
    } else if (this.shotType === "SHOT_ORBIT") {
      const isBackflip = rawAirAngle < 0;
      const orbitSign = isBackflip ? -1 : 1;
      const magScale = b(1 + this.stuntMagnitude * 0.25, 1, 1.8);
      shotOffsetX += orbitSign * 42 * magScale;
      shotOffsetY -= 26 * magScale;
      shotZoomDelta -= 0.04 * this.stuntMagnitude;
      shotFovDelta += 4;
    } else if (this.shotType === "SHOT_WIDE") {
      shotOffsetX += 65 * dirSign;
      shotOffsetY -= 55;
      shotZoomDelta -= 0.08;
      shotFovDelta += 6;
    } else if (this.shotType === "SHOT_CLOSE") {
      shotOffsetY += 24; // Focus on wheel & suspension rebound
      shotZoomDelta += 0.05;
      shotFovDelta -= 3;
    } else if (this.shotType === "SHOT_REVEAL") {
      shotOffsetX += 75 * dirSign;
      shotOffsetY -= 52; // Rise above crest to reveal what lies beyond
      shotZoomDelta -= 0.05;
    } else if (this.shotType === "SHOT_SUMMIT") {
      shotOffsetY -= 75;
      shotZoomDelta -= 0.10;
      shotFovDelta += 8;
    }

    // Steep Climb & Deep Descent Vertical Framing (Sections 24 & 25)
    let slopeVerticalLift = 0;
    if (slopeAheadDeg < -18) {
      // Climbing: raise camera to show climb face + crest above vehicle
      slopeVerticalLift = b((slopeAheadDeg + 18) * 2.6, -115, 0);
    } else if (slopeAheadDeg > 18) {
      // Descending: look lower into the valley floor & exit climb
      slopeVerticalLift = b((slopeAheadDeg - 18) * 2.4, 0, 105);
    }

    // Rule-of-Thirds Composition (Sections 27 & 28):
    // Place vehicle on left third when driving right (negative thirdsX shifts camera right of vehicle)
    const screenW = typeof window !== "undefined" ? (window.innerWidth || 1280) : 1280;
    const maxSafeLeadX = Math.min(310, (screenW / Math.max(0.55, this.zoom)) * 0.24);
    const desiredLeadX = b(
      (blendedTargetX - posX) + (-stCfg.thirdsX * 240 * dirSign) + shotOffsetX,
      -maxSafeLeadX * 0.65,
      maxSafeLeadX
    );
    this.lookAhead = desiredLeadX;

    let finalTargetX = posX + desiredLeadX;
    let finalTargetY = blendedTargetY + shotOffsetY + slopeVerticalLift;

    // 6. Terrain Camera Collision & Minimum Clearance Guard (Section 50)
    if (terrain) {
      const groundAtCam = terrain.heightAt(finalTargetX);
      const groundAtVehicle = terrain.heightAt(posX);
      const ceilingLimitY = Math.min(groundAtCam, groundAtVehicle) + 45;
      // Never let camera center drop below terrain surface or clip vehicle underground
      if (finalTargetY > ceilingLimitY) {
        finalTargetY = ceilingLimitY;
      }
    }

    // Also clamp vertical distance from vehicle so vehicle is NEVER clipped off top/bottom of viewport (Section 59)
    finalTargetY = b(finalTargetY, posY - 210, posY + 150);
    this.targetPoint = { x: finalTargetX, y: finalTargetY };

    // 7. Compute Dynamic Zoom & FOV (Sections 07, 08, 49)
    const isReduced = Boolean(x.visual.reducedMotion || gameRef?.settings?.reducedMotion);
    const speedZoomPullback = b((speedKmh / 110) * x.camera.speedZoom, 0, 0.16);
    const airZoomPullback = airborne ? b(0.03 + groundClearance * 0.00028, 0.03, 0.12) : 0;
    const altZoomPullback = b(altMeters / 4500, 0, 0.045);

    const rawTargetZoom =
      stCfg.baseZoom -
      speedZoomPullback -
      airZoomPullback -
      altZoomPullback +
      shotZoomDelta +
      this.zoomPulse +
      this.impact.zoomImpulse;

    this.targetZoom = b(rawTargetZoom, x.camera.minZoom || 0.52, x.camera.maxZoom || 0.96);
    this.targetFov = isReduced
      ? (x.camera.baseFov || 55)
      : b(
          stCfg.fov + (speedKmh / 100) * 6 + shotFovDelta + this.impact.fovImpulse,
          x.camera.minFov || 50,
          x.camera.maxFov || 75
        );

    // 8. Horizon-Stable Camera Roll (Sections 34 & 35)
    // Normal: 10-25% of vehicle/slope pitch, clamped heavily so horizon stays stable; Stunt: up to 36%
    let desiredRoll = 0;
    if (!isReduced) {
      const normPitch = normalizeAngle(chassisAngle);
      const maxRollRad = this.state === "STUNT" ? 0.16 : 0.065; // ~9 deg max in stunt, ~3.7 deg normal
      desiredRoll = b(normPitch * stCfg.rollFrac, -maxRollRad, maxRollRad);
    }
    this.targetRoll = desiredRoll;

    // 9. Step 2nd-Order Spring-Damper Transform System (Section 33)
    const prevX = this.x;
    const prevY = this.y;

    this.x = this.springX.step(finalTargetX, dtSec, stCfg.kX, stCfg.cX, 1.0);
    this.y = this.springY.step(finalTargetY, dtSec, stCfg.kY, stCfg.cY, 1.0);
    this.zoom = this.springZoom.step(this.targetZoom, dtSec, stCfg.kZ, stCfg.cZ, 1.0);
    this.fov = this.springFov.step(this.targetFov, dtSec, 16, 8.0, 1.0);
    this.roll = isReduced ? 0 : this.springRoll.step(this.targetRoll, dtSec, 24, 9.5, 1.0);
    this.springLookX.step(blendedTargetX, dtSec, 38, 12.0, 1.0);
    this.springLookY.step(blendedTargetY, dtSec, 34, 11.5, 1.0);

    this.cameraVelocity.x = (this.x - prevX) / Math.max(0.001, dtSec);
    this.cameraVelocity.y = (this.y - prevY) / Math.max(0.001, dtSec);
    this.zoomPulse = Math.max(0, this.zoomPulse - dtSec * 0.32);

    // 10. Update Live Camera Telemetry (Section 53)
    const springVelMag = Math.hypot(this.springX.velocity, this.springY.velocity);
    const springErrMag = Math.hypot(this.springX.error, this.springY.error);
    this.telemetry = {
      cameraState: this.state,
      shotType: this.shotType,
      transitionCount: this.transitionCount,
      cameraDistance: Math.round(Math.hypot(this.x - posX, this.y - posY)),
      lookAhead: Math.round(this.rawLookAhead),
      fov: Number(this.fov.toFixed(1)),
      zoom: Number(this.zoom.toFixed(3)),
      rollDeg: Number(((this.roll * 180) / Math.PI).toFixed(2)),
      priority: this.priority,
      impactMagnitude: Number(this.impact.lastImpactMagnitude.toFixed(2)),
      airTime: Math.round(airTimeMs),
      stuntMagnitude: this.stuntMagnitude,
      terrainFeature: this.currentFeature,
      distanceToFeature: this.distanceToFeature,
      springVelocity: Math.round(springVelMag),
      springError: Math.round(springErrMag),
    };
  }

  get shakeOffset() {
    const imp = this.impact.getOffset();
    return { x: imp.x, y: imp.y };
  }

  get totalRoll() {
    const imp = this.impact.getOffset();
    return this.roll + imp.roll;
  }
}

const X0 = CameraDirector;
if (typeof window !== "undefined") {
  window.CameraDirector = CameraDirector;
  window.CAMERA_STATES = CAMERA_STATES;
  window.SHOT_CONFIGS = SHOT_CONFIGS;
}


// ----------------------------------------------------------------------------
// Interactive Physics Props & Multi-Body Fracture Destruction Manager (PropManager)
// ----------------------------------------------------------------------------
class PropManager {
  world;
  audio;
  particles;
  bus;
  defs = [];
  activeProps = new Map(); // id -> { bodies, def, smashed }
  debrisList = []; // Physical rigid-body wooden planks & stone fragments

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

    // 1. Early expedition markers + long-range sector mileposts across 8.2km
    const signDistances = [820, 2800, 5100, 8500, 13800, 18400, 24200, 31500];
    for (let distM = 1000; distM <= 8000; distM += 400) {
      signDistances.push(x.world.startX + distM * 40);
    }
    for (let i = 0; i < signDistances.length; i++) {
      const sx = signDistances[i];
      const sy = terrain.heightAt(sx) - 15;
      this.defs.push({
        id: `sign_${i}`,
        type: "sign",
        x: sx,
        y: sy,
        spawned: false,
      });
    }

    // 2. Breakable wooden fences along ridges, bridges & trestles
    const fenceClusters = [1320, 3200, 7200, 12200, 19100, 27400];
    for (const seg of terrain.segments) {
      if (
        seg.startX > 36000 &&
        (seg.type === "NARROW_RIDGE" || seg.type === "BROKEN_RIDGE" || seg.type === "CLIFF_LAUNCH" || seg.signature)
      ) {
        fenceClusters.push(Math.round(seg.startX + 120));
      }
    }
    for (let c = 0; c < fenceClusters.length; c++) {
      const cx = fenceClusters[c];
      for (let f = 0; f < 4; f++) {
        const fx = cx + f * 24;
        const fy = terrain.heightAt(fx) - 13;
        this.defs.push({
          id: `fence_${c}_${f}`,
          type: "fence",
          x: fx,
          y: fy,
          spawned: false,
        });
      }
    }

    // 3. Breakable Wooden Supply Crates & Outpost Caches
    const crateStations = [2250, 2650, 3800, 6200, 7800, 11200, 14800, 21500, 25800, 26300];
    for (const seg of terrain.segments) {
      if (seg.startX > 36000 && (seg.type === "PLATEAU" || seg.type === "MINE_PIT" || seg.type === "RECOVERY_VALLEY")) {
        crateStations.push(Math.round((seg.startX + seg.endX) * 0.5));
      }
    }
    for (let c = 0; c < crateStations.length; c++) {
      const cx = crateStations[c];
      const cy = terrain.heightAt(cx) - 14;
      this.defs.push({
        id: `crate_${c}`,
        type: "crate",
        x: cx,
        y: cy,
        spawned: false,
      });
    }

    // 4. Loose rolling rocks on steep descents & rock fields (Section 32: ROCKSLIDE DESCENT)
    const rockStations = [5200, 9300, 15800, 22200, 28800];
    for (const seg of terrain.segments) {
      if (seg.startX > 36000 && (seg.type === "ROCK_FIELD" || seg.type === "STEEP_DESCENT" || seg.type === "LONG_DESCENT")) {
        rockStations.push(Math.round(seg.startX + (seg.endX - seg.startX) * 0.35));
        rockStations.push(Math.round(seg.startX + (seg.endX - seg.startX) * 0.68));
      }
    }
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

  updateChunking(camX, dt = 16.666) {
    const minX = camX - 1400;
    const maxX = camX + 1400;

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

    // Update physical fracture debris lifecycle
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const dItem = this.debrisList[i];
      dItem.life -= dt / 1000;
      if (dItem.life <= 0 || Math.abs(dItem.body.position.x - camX) > 1600 || dItem.body.position.y > 12000) {
        try { Matter.Composite.remove(this.world, dItem.body); } catch (e) {}
        this.debrisList.splice(i, 1);
      }
    }
  }

  spawnProp(def) {
    if (def.type === "sign") {
      const body = Matter.Bodies.rectangle(def.x, def.y, 14, 26, {
        label: "prop_sign",
        friction: 0.25,
        density: 0.00004,
        restitution: 0.02,
      });
      body.propDef = def;
      Matter.Composite.add(this.world, body);
      this.activeProps.set(def.id, { bodies: [body], def, smashed: false });
    } else if (def.type === "fence") {
      const body = Matter.Bodies.rectangle(def.x, def.y, 8, 22, {
        label: "prop_fence",
        friction: 0.25,
        density: 0.00004,
        restitution: 0.02,
      });
      body.propDef = def;
      Matter.Composite.add(this.world, body);
      this.activeProps.set(def.id, { bodies: [body], def, smashed: false });
    } else if (def.type === "crate") {
      const body = Matter.Bodies.rectangle(def.x, def.y, 24, 24, {
        label: "prop_crate",
        friction: 0.35,
        density: 0.00012,
        restitution: 0.05,
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
        density: 0.0018,
        restitution: 0.12,
      });
      body.propDef = def;
      Matter.Composite.add(this.world, body);
      this.activeProps.set(def.id, { bodies: [body], def, smashed: false });
    }
  }

  despawnProp(id) {
    const item = this.activeProps.get(id);
    if (!item) return;
    if (!item.smashed && item.def) {
      item.def.spawned = false;
    }
    for (const bBody of item.bodies) {
      Matter.Composite.remove(this.world, bBody);
    }
    this.activeProps.delete(id);
  }

  spawnFractureDebris(originX, originY, kind, hitEnergy, baseVel = { x: 4, y: -2 }) {
    const count = kind === "crate" ? 5 : 3;
    while (this.debrisList.length + count > 42 && this.debrisList.length > 0) {
      const oldest = this.debrisList.shift();
      try { Matter.Composite.remove(this.world, oldest.body); } catch (e) {}
    }

    for (let i = 0; i < count; i++) {
      const w = kind === "crate" ? 14 + (i % 2) * 6 : 12;
      const h = 4.5;
      const angle = (i / count) * Math.PI + (Math.random() - 0.5) * 0.6;
      const ox = originX + (Math.random() - 0.5) * 14;
      const oy = originY - 4 + (Math.random() - 0.5) * 14;

      const frag = Matter.Bodies.rectangle(ox, oy, w, h, {
        label: "debris_plank",
        collisionFilter: { group: -1 },
        density: 0.0004,
        friction: 0.45,
        restitution: 0.28,
        angle: angle,
      });

      const burstSpeed = b(2.5 + hitEnergy * 1.8, 3.0, 11.0);
      const vx = (baseVel.x * 0.65) + (Math.random() - 0.25) * burstSpeed;
      const vy = -Math.abs(burstSpeed * (0.45 + Math.random() * 0.65));
      Matter.Body.setVelocity(frag, { x: vx, y: vy });
      Matter.Body.setAngularVelocity(frag, (Math.random() - 0.5) * 0.24);

      Matter.Composite.add(this.world, frag);
      this.debrisList.push({
        body: frag,
        w,
        h,
        kind,
        color: i % 2 === 0 ? "#bca383" : "#8a6d4d",
        life: 4.5,
        maxLife: 4.5,
      });
    }
  }

  onHit(propBody, hitEnergy, hitPt, impactVel = { x: 6, y: -2 }) {
    const def = propBody.propDef;
    if (!def) return;
    const item = this.activeProps.get(def.id);
    if (!item || item.smashed) return;

    if (def.type === "sign" || def.type === "fence" || def.type === "crate") {
      item.smashed = true;
      this.audio.destruct("wood");
      this.particles.spawnSplinters(hitPt.x, hitPt.y, 18);
      this.spawnFractureDebris(propBody.position.x, propBody.position.y, def.type, hitEnergy, impactVel);
      this.bus.emit("prop:destroyed", { type: def.type, score: 75 });
      try { Matter.Composite.remove(this.world, propBody); } catch (e) {}
    } else if (def.type === "rock") {
      this.audio.destruct("rock");
      this.particles.spawnLandingBurst(hitPt.x, hitPt.y, 1.2, MATERIALS.rock);
    }
  }

  clear() {
    for (const item of this.activeProps.values()) {
      for (const bBody of item.bodies) {
        try { Matter.Composite.remove(this.world, bBody); } catch (e) {}
      }
    }
    for (const dItem of this.debrisList) {
      try { Matter.Composite.remove(this.world, dItem.body); } catch (e) {}
    }
    this.debrisList = [];
    this.activeProps.clear();
    this.defs = [];
  }
}

// ----------------------------------------------------------------------------
// 3D Mountain Echo Relics Manager
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
// MOUNTAIN GENERATION 2.0 — 32-Shape Parametric Library & Transition Grammar
// ----------------------------------------------------------------------------
const PARAMETRIC_SHAPES = {
  // 1. Rollers & Rhythm Warmups
  ROLLERS:          { cat: "ROLLERS",  name: "Foothill Rollers",      dx: 720,  dy: -28,  exitSlope: -0.06, maxDeg: 14, jumpPotential: "Low",    landingQuality: "Ideal",   surface: "grass" },
  LONG_ROLLERS:     { cat: "ROLLERS",  name: "Undulating Meadow",     dx: 1080, dy: -45,  exitSlope: -0.08, maxDeg: 16, jumpPotential: "Low",    landingQuality: "Ideal",   surface: "grass" },
  DOUBLE_HUMP:      { cat: "RHYTHM",   name: "Double Ridge Rollers",  dx: 840,  dy: -40,  exitSlope: -0.04, maxDeg: 20, jumpPotential: "Medium", landingQuality: "Good",    surface: "dirt" },
  TRIPLE_HUMP:      { cat: "RHYTHM",   name: "Triple Rhythm Back",    dx: 1120, dy: -55,  exitSlope: -0.05, maxDeg: 22, jumpPotential: "Medium", landingQuality: "Good",    surface: "dirt" },
  CAMELBACK:        { cat: "RHYTHM",   name: "Camelback Twin Crest",  dx: 860,  dy: -50,  exitSlope: 0.0,   maxDeg: 24, jumpPotential: "Medium", landingQuality: "Good",    surface: "grass" },
  COMPRESSION_RUN:  { cat: "SUSP",     name: "Compression Dip Run",   dx: 820,  dy: -30,  exitSlope: -0.10, maxDeg: 22, jumpPotential: "Low",    landingQuality: "Good",    surface: "dirt" },
  OFF_CAMBER:       { cat: "TECH",     name: "Off-Camber Ledge",      dx: 780,  dy: -65,  exitSlope: -0.14, maxDeg: 26, jumpPotential: "Low",    landingQuality: "Technical", surface: "rock" },
  ROCK_FIELD:       { cat: "TECH",     name: "Boulder Scree Field",   dx: 880,  dy: -75,  exitSlope: -0.15, maxDeg: 28, jumpPotential: "Low",    landingQuality: "Rough",   surface: "rock" },
  MOGUL_FIELD:      { cat: "SUSP",     name: "Suspension Breaker Moguls", dx: 840, dy: -60, exitSlope: -0.12, maxDeg: 26, jumpPotential: "Medium", landingQuality: "Rough",  surface: "gravel" },

  // 2. Climbs (Easy -> Moderate -> Hard -> Extreme -> Summit)
  SHALLOW_CLIMB:    { cat: "CLIMB",    name: "Foothill Bench Climb",  dx: 820,  dy: -140, exitSlope: -0.22, maxDeg: 18, jumpPotential: "Low",    landingQuality: "Ideal",   surface: "grass" },
  LONG_CLIMB:       { cat: "CLIMB",    name: "Sustained Ridge Ascent",dx: 1350, dy: -340, exitSlope: -0.32, maxDeg: 28, jumpPotential: "Low",    landingQuality: "Good",    surface: "rock" },
  STEEP_CLIMB:      { cat: "CLIMB",    name: "Steep Escarpment",      dx: 960,  dy: -310, exitSlope: -0.38, maxDeg: 34, jumpPotential: "Medium", landingQuality: "Good",    surface: "rock" },
  STEPPED_RIDGE:    { cat: "CLIMB",    name: "Stepped Ridge",         dx: 1180, dy: -320, exitSlope: -0.34, maxDeg: 34, jumpPotential: "Medium", landingQuality: "Good",    surface: "rock" },
  EXTREME_CLIMB:    { cat: "EXTREME",  name: "Extreme Headwall",      dx: 1050, dy: -410, exitSlope: -0.44, maxDeg: 40, jumpPotential: "Medium", landingQuality: "Narrow",  surface: "rock" },
  SUMMIT_FACE:      { cat: "EXTREME",  name: "High Summit Face",      dx: 1240, dy: -490, exitSlope: -0.46, maxDeg: 44, jumpPotential: "High",   landingQuality: "Narrow",  surface: "snow" },
  FINAL_ASCENT:     { cat: "EXTREME",  name: "The Final Ascent",      dx: 1320, dy: -520, exitSlope: -0.42, maxDeg: 45, jumpPotential: "High",   landingQuality: "Narrow",  surface: "snow" },

  // 3. Crests & Ridges
  BLIND_CREST:      { cat: "CREST",    name: "Blind Horizon Crest",   dx: 680,  dy: 35,   exitSlope: 0.22,  maxDeg: 26, jumpPotential: "High",   landingQuality: "Good",    surface: "rock" },
  RAZOR_CREST:      { cat: "CREST",    name: "Razorback Spine",       dx: 740,  dy: 45,   exitSlope: 0.26,  maxDeg: 32, jumpPotential: "High",   landingQuality: "Narrow",  surface: "rock" },
  BROKEN_RIDGE:     { cat: "TECH",     name: "Broken Spine Ridge",    dx: 960,  dy: -110, exitSlope: -0.18, maxDeg: 30, jumpPotential: "Medium", landingQuality: "Technical", surface: "rock" },
  NARROW_RIDGE:     { cat: "TECH",     name: "Knife-Edge Pass",       dx: 860,  dy: -85,  exitSlope: -0.12, maxDeg: 28, jumpPotential: "Medium", landingQuality: "Narrow",  surface: "gravel" },

  // 4. Jumps & Airborne Launches
  KICKER:           { cat: "JUMP",     name: "Upward Kicker Ramp",    dx: 820,  dy: -55,  exitSlope: 0.16,  maxDeg: 28, jumpPotential: "High",   landingQuality: "Good",    surface: "dirt" },
  LONG_KICKER:      { cat: "JUMP",     name: "High-Speed Long Kicker",dx: 1080, dy: -85,  exitSlope: 0.18,  maxDeg: 32, jumpPotential: "Extreme",landingQuality: "Good",    surface: "rock" },
  RIDGE_LAUNCH:     { cat: "JUMP",     name: "Natural Ridge Launch",  dx: 940,  dy: -70,  exitSlope: 0.20,  maxDeg: 30, jumpPotential: "High",   landingQuality: "Good",    surface: "rock" },
  CLIFF_LAUNCH:     { cat: "JUMP",     name: "Trestle Cliff Gap",     dx: 1180, dy: 65,   exitSlope: 0.22,  maxDeg: 34, jumpPotential: "Extreme",landingQuality: "Slope",   surface: "wood" },
  DOWNHILL_LAUNCH:  { cat: "JUMP",     name: "Downhill Step Launch",  dx: 1020, dy: 145,  exitSlope: 0.26,  maxDeg: 32, jumpPotential: "High",   landingQuality: "Downhill",surface: "dirt" },

  // 5. Descents & Deep Valleys
  SHALLOW_DESCENT:  { cat: "DESCENT",  name: "Traversing Descent",    dx: 840,  dy: 140,  exitSlope: 0.18,  maxDeg: 20, jumpPotential: "Low",    landingQuality: "Ideal",   surface: "dirt" },
  STEEP_DESCENT:    { cat: "DESCENT",  name: "Steep Gorge Plunge",    dx: 960,  dy: 290,  exitSlope: 0.34,  maxDeg: 34, jumpPotential: "Medium", landingQuality: "Downhill",surface: "dirt" },
  LONG_DESCENT:     { cat: "DESCENT",  name: "The Great Descent Run", dx: 1440, dy: 460,  exitSlope: 0.36,  maxDeg: 36, jumpPotential: "High",   landingQuality: "Downhill",surface: "gravel" },
  V_VALLEY:         { cat: "VALLEY",   name: "V-Ravine Gorge",        dx: 920,  dy: 65,   exitSlope: -0.28, maxDeg: 32, jumpPotential: "High",   landingQuality: "Good",    surface: "rock" },
  U_VALLEY:         { cat: "VALLEY",   name: "Deep U-Valley Bowl",    dx: 1160, dy: 40,   exitSlope: -0.26, maxDeg: 28, jumpPotential: "High",   landingQuality: "Ideal",   surface: "dirt" },
  GLACIAL_BOWL:     { cat: "VALLEY",   name: "Glacial Ice Basin",     dx: 1380, dy: 30,   exitSlope: -0.24, maxDeg: 26, jumpPotential: "Extreme",landingQuality: "Ideal",   surface: "ice" },
  RAVINE:           { cat: "VALLEY",   name: "Erosion Ravine",        dx: 880,  dy: 50,   exitSlope: -0.25, maxDeg: 30, jumpPotential: "Medium", landingQuality: "Good",    surface: "dirt" },
  MINE_PIT:         { cat: "VALLEY",   name: "Open-Cast Mine Pit",    dx: 1220, dy: 25,   exitSlope: -0.30, maxDeg: 34, jumpPotential: "Medium", landingQuality: "Good",    surface: "gravel" },

  // 6. Recovery Zones & Plateaus
  PLATEAU:          { cat: "RECOVERY", name: "Survey Bench Plateau",  dx: 660,  dy: -12,  exitSlope: 0.0,   maxDeg: 8,  jumpPotential: "None",   landingQuality: "Ideal",   surface: "grass" },
  RECOVERY_VALLEY:  { cat: "RECOVERY", name: "Sheltered Basin Rest",  dx: 740,  dy: 18,   exitSlope: -0.05, maxDeg: 10, jumpPotential: "None",   landingQuality: "Ideal",   surface: "dirt" },
};

// Markov Category Transition Rules (Section 41 & 42: Procedural Anti-Repetition)
const CATEGORY_TRANSITIONS = {
  ROLLERS:  ["CLIMB", "RHYTHM", "JUMP", "SUSP"],
  RHYTHM:   ["CLIMB", "JUMP", "VALLEY", "TECH"],
  SUSP:     ["CLIMB", "RECOVERY", "JUMP", "CREST"],
  TECH:     ["CLIMB", "CREST", "DESCENT", "RECOVERY"],
  CLIMB:    ["CREST", "JUMP", "RECOVERY", "TECH"],
  EXTREME:  ["CREST", "RECOVERY", "JUMP"],
  CREST:    ["DESCENT", "VALLEY", "JUMP", "RECOVERY"],
  JUMP:     ["RECOVERY", "VALLEY", "ROLLERS", "DESCENT"],
  DESCENT:  ["VALLEY", "RECOVERY", "CLIMB", "JUMP"],
  VALLEY:   ["CLIMB", "RECOVERY", "RHYTHM", "JUMP"],
  RECOVERY: ["CLIMB", "RHYTHM", "TECH", "EXTREME", "DESCENT"],
};

// 8 Signature Expedition Setpieces anchored at key distances across the 8.2km mountain (Section 31)
const SIGNATURE_SETPIECES = [
  { triggerDistM: 520,  type: "KICKER",          name: "THE OLD QUARRY LAUNCH",    signature: "SETPIECE // OLD QUARRY" },
  { triggerDistM: 1250, type: "RAZOR_CREST",     name: "THE RED RIDGE SPINE",      signature: "SETPIECE // BROKEN RIDGE" },
  { triggerDistM: 1820, type: "LONG_DESCENT",    name: "THE GREAT DROP",           signature: "SETPIECE // GREAT DROP" },
  { triggerDistM: 2150, type: "STEPPED_RIDGE",   name: "STEPPED RIDGE RECOVERY",   signature: "SETPIECE // STEPPED RIDGE" },
  { triggerDistM: 2820, type: "CLIFF_LAUNCH",    name: "THE LONG FLIGHT TRESTLE",  signature: "SETPIECE // LONG FLIGHT" },
  { triggerDistM: 3250, type: "MINE_PIT",        name: "THE DEAD MINE BASIN",      signature: "SETPIECE // DEAD MINE" },
  { triggerDistM: 4350, type: "GLACIAL_BOWL",    name: "THE GLACIER RUN",          signature: "SETPIECE // GLACIER RUN" },
  { triggerDistM: 5850, type: "EXTREME_CLIMB",   name: "THE HIGH CRAG WALL",       signature: "SETPIECE // THE WALL" },
  { triggerDistM: 7150, type: "SUMMIT_FACE",     name: "THE SUMMIT FACE",          signature: "SETPIECE // SUMMIT FACE" },
  { triggerDistM: 7750, type: "LONG_KICKER",     name: "THE LAST CREST",           signature: "SETPIECE // LAST CREST" },
];

// ----------------------------------------------------------------------------
// Procedural Mountain Terrain & Streamed Physics Engine (P0)
// ----------------------------------------------------------------------------
class P0 {
  samples = [];
  bodies = []; // Currently active streamed Matter.js static terrain bodies
  chunks = []; // Collision chunk descriptors: { id, startIdx, endIdx, minX, maxX, active, bodies }
  segments = [];
  seed;
  step = x.world.sampleStep;
  chunkSamples = x.world.chunkSamples || 20;
  activeRadius = x.world.activePhysicsRadius || 3200;
  activeChunkCount = 0;
  lastStreamCenterX = -999999;
  stats = null;

  constructor(seed) {
    this.seed = seed;
    this.generateGrammarTerrain();
  }

  // Difficulty curve across the full 8.2km expedition (Section 28)
  computeDifficulty(distMeters) {
    let base = 0.15;
    if (distMeters < 800) {
      base = 0.15 + (distMeters / 800) * 0.15; // 0.15 -> 0.30
    } else if (distMeters < 1600) {
      base = 0.30 + ((distMeters - 800) / 800) * 0.15; // 0.30 -> 0.45
    } else if (distMeters < 2600) {
      base = 0.45 + ((distMeters - 1600) / 1000) * 0.15; // 0.45 -> 0.60
    } else if (distMeters < 3800) {
      base = 0.60 + ((distMeters - 2600) / 1200) * 0.12; // 0.60 -> 0.72
    } else if (distMeters < 5200) {
      base = 0.72 + ((distMeters - 3800) / 1400) * 0.12; // 0.72 -> 0.84
    } else if (distMeters < 6800) {
      base = 0.84 + ((distMeters - 5200) / 1600) * 0.10; // 0.84 -> 0.94
    } else {
      base = 0.94 + b((distMeters - 6800) / 1400, 0, 1) * 0.06; // 0.94 -> 1.00
    }
    return b(base, 0.15, 1.0);
  }

  classifyDifficultyCategory(diff) {
    if (diff < 0.30) return "EASY";
    if (diff < 0.50) return "MODERATE";
    if (diff < 0.70) return "CHALLENGING";
    if (diff < 0.90) return "HARD";
    return "EXTREME";
  }

  pickNextShapeKey(distMeters, prevCat, recentTypes, rng) {
    // 1. Check if an authored Signature Setpiece is due
    for (const sp of SIGNATURE_SETPIECES) {
      if (
        Math.abs(distMeters - sp.triggerDistM) < 130 &&
        !this._usedSetpieces.has(sp.name)
      ) {
        this._usedSetpieces.add(sp.name);
        return { key: sp.type, overrideName: sp.name, signature: sp.signature };
      }
    }

    // 2. Determine allowed next categories from Markov Transition Matrix
    const allowedCats = CATEGORY_TRANSITIONS[prevCat] || ["CLIMB", "RHYTHM", "RECOVERY"];

    // 3. Filter candidate shapes by Act / Sector appropriateness and anti-repetition
    const candidates = [];
    const allKeys = Object.keys(PARAMETRIC_SHAPES);

    for (const key of allKeys) {
      const def = PARAMETRIC_SHAPES[key];
      if (!allowedCats.includes(def.cat)) continue;

      // Never repeat a shape present in the last 3 segments
      if (recentTypes.slice(-3).includes(key)) continue;

      // Act-specific gating so Foothills stay approachable and Summit Face is intense
      if (distMeters < 750 && (def.cat === "EXTREME" || def.maxDeg > 28 || key === "CLIFF_LAUNCH")) continue;
      if (distMeters >= 1600 && distMeters <= 2400) {
        // Act III: The Great Descent favors descents, valleys, and recovery climbs
        if (def.cat === "DESCENT" || def.cat === "VALLEY" || key === "STEPPED_RIDGE") {
          candidates.push(key, key);
        }
      }
      if (distMeters >= 3500 && distMeters <= 5000) {
        // Act V: Glacier Run favors glacial bowls, long kickers, and smooth fast runs
        if (key === "GLACIAL_BOWL" || key === "LONG_KICKER" || key === "LONG_ROLLERS") {
          candidates.push(key, key);
        }
      }
      if (distMeters >= 6600 && (def.cat === "EXTREME" || key === "STEEP_CLIMB" || key === "RAZOR_CREST")) {
        candidates.push(key, key);
      }

      candidates.push(key);
    }

    if (candidates.length === 0) {
      return { key: "PLATEAU", overrideName: null, signature: null };
    }

    const idx = Math.floor(Math.abs(rng(distMeters * 0.17 + recentTypes.length * 13.7)) * candidates.length) % candidates.length;
    return { key: candidates[idx], overrideName: null, signature: null };
  }

  generateGrammarTerrain() {
    this.samples = [];
    this.bodies = [];
    this.chunks = [];
    this.segments = [];
    this._usedSetpieces = new Set();

    const seed = this.seed;
    const groundBase = x.world.groundBase;
    const startX = x.world.startX;
    const totalLength = x.world.length;

    const nMacro = K0(seed + 7);
    const nSwell = K0(seed + 23);
    const nDetail = K0(seed + 89);
    const nChoice = K0(seed + 151);

    // 1. Initial flat starting apron (-2500 to startX + 350)
    for (let q = -2500; q < startX + 350; q += this.step) {
      this.samples.push({
        x: q,
        y: groundBase,
        material: "grass",
        biomeId: "meadow",
        slope: 0,
        curvature: 0,
      });
    }

    // 2. Preserve proven opening 6 segments (0m -> ~85m) so early driving/prop tests remain 100% consistent,
    //    then transition seamlessly into the 8.2km Markov Macro-Meso-Micro Expedition Grammar!
    const openingSequence = [
      { key: "ROLLERS",       name: "Gentle Rollers",      dx: 600, dy: -20,  exitSlope: 0.05,  surface: "grass" },
      { key: "SHALLOW_CLIMB", name: "Steady Climb",        dx: 700, dy: -140, exitSlope: -0.32, surface: "grass" },
      { key: "KICKER",        name: "First Kicker Jump",   dx: 750, dy: -40,  exitSlope: 0.15,  surface: "dirt"  },
      { key: "U_VALLEY",      name: "Deep Valley Bowl",    dx: 650, dy: 60,   exitSlope: -0.25, surface: "dirt"  },
      { key: "CAMELBACK",     name: "Camelback Double",    dx: 700, dy: -50,  exitSlope: 0.0,   surface: "grass" },
      { key: "PLATEAU",       name: "Base Camp Plateau",   dx: 550, dy: -10,  exitSlope: 0.0,   surface: "grass" },
    ];

    let curX = this.samples[this.samples.length - 1].x;
    let curY = groundBase;
    let curSlope = 0.0;
    let seqIdx = 0;
    let prevCat = "RECOVERY";
    const recentTypes = [];

    while (curX < totalLength) {
      const distMeters = Math.max(0, (curX - startX) / 40);
      const difficulty = this.computeDifficulty(distMeters);
      const biome = this.getBiomeAtDist(distMeters);

      let shapeKey, segName, segDx, segDy, targetSlope, segSurface, segSignature = null;
      let shapeDef;

      // Final 250m (7,950m -> 8,200m): Summit Observatory Panoramic Plateau (Section 50 & 51)
      if (distMeters >= 7980) {
        shapeKey = "PLATEAU";
        shapeDef = PARAMETRIC_SHAPES.PLATEAU;
        segName = "Summit Observatory Plateau";
        segDx = Math.ceil(Math.max(800, totalLength - curX + 200) / this.step) * this.step;
        segDy = -15;
        targetSlope = 0.0;
        segSurface = "snow";
        segSignature = "SUMMIT // OBSERVATORY";
      } else if (seqIdx < openingSequence.length) {
        const op = openingSequence[seqIdx];
        shapeKey = op.key;
        shapeDef = PARAMETRIC_SHAPES[shapeKey];
        segName = op.name;
        segDx = Math.round((op.dx * (0.92 + Math.abs(nSwell(curX / 900)) * 0.20)) / this.step) * this.step;
        segDy = op.dy * (1.0 + difficulty * 0.30);
        targetSlope = op.exitSlope;
        segSurface = op.surface;
      } else {
        const picked = this.pickNextShapeKey(distMeters, prevCat, recentTypes, nChoice);
        shapeKey = picked.key;
        shapeDef = PARAMETRIC_SHAPES[shapeKey] || PARAMETRIC_SHAPES.ROLLERS;
        segName = picked.overrideName || shapeDef.name;
        segSignature = picked.signature;

        // Seeded parametric variation (Section 27)
        const lenScale = 0.88 + Math.abs(nSwell(curX * 0.0011 + seqIdx)) * 0.32;
        const ampScale = (0.85 + Math.abs(nMacro(curX * 0.0007 + seqIdx)) * 0.30) * (0.75 + difficulty * 0.55);

        segDx = Math.round((shapeDef.dx * lenScale) / this.step) * this.step;
        segDy = shapeDef.dy * ampScale;

        // Macro Act Envelope Bias:
        // Act III (1,600m - 2,400m) is THE GREAT DESCENT; bias net vertical change downward
        if (distMeters >= 1600 && distMeters < 2300 && shapeDef.cat !== "CLIMB") {
          segDy += 95;
        } else if (distMeters >= 5000 && distMeters < 7950 && shapeDef.cat === "CLIMB") {
          // High Mountain & Summit Approach: amplify vertical climb gain
          segDy -= 65;
        }

        targetSlope = b(shapeDef.exitSlope * (0.85 + difficulty * 0.35), -0.46, 0.42);
        segSurface = shapeDef.surface || biome.defaultMaterial;
        if (biome.id === "glacier" && (shapeDef.cat === "VALLEY" || shapeDef.cat === "ROLLERS")) {
          segSurface = "ice";
        } else if (biome.id === "summit") {
          segSurface = Math.abs(targetSlope) > 0.38 ? "rock" : "snow";
        } else if (biome.id === "industrial" && shapeDef.cat === "JUMP") {
          segSurface = "metal";
        }
      }

      seqIdx++;
      prevCat = shapeDef.cat;
      recentTypes.push(shapeKey);
      if (recentTypes.length > 8) recentTypes.shift();

      const x0 = curX;
      const y0 = curY;
      const m0 = curSlope;
      const x1 = curX + segDx;
      const y1 = curY + segDy;
      const m1 = targetSlope;

      const startSampleIdx = this.samples.length;
      let segMaxSlopeRad = 0;
      let segMinY = y0;
      let segMaxY = y0;

      // Sample along Cubic Hermite Spline with Meso + Micro + Off-Camber Perturbations
      const L = x1 - x0;
      const maxAllowedDeg = b((shapeDef.maxDeg || 38) + difficulty * 6, 16, 45.2);
      const maxSlopeTan = Math.tan((maxAllowedDeg * Math.PI) / 180);

      for (let q = x0 + this.step; q <= x1; q += this.step) {
        const u = (q - x0) / L;
        const u2 = u * u;
        const u3 = u2 * u;

        const h00 = 2 * u3 - 3 * u2 + 1;
        const h10 = u3 - 2 * u2 + u;
        const h01 = -2 * u3 + 3 * u2;
        const h11 = u3 - u2;

        let y = h00 * y0 + h10 * L * m0 + h01 * y1 + h11 * L * m1;

        // Window envelope sin(pi * u)^2 so meso/micro perturbations vanish at segment boundaries (preserving exact C1 continuity!)
        const env = Math.sin(u * Math.PI);
        const env2 = env * env;

        // Meso & Micro shape articulations (Sections 08, 18, 19, 35, 36)
        if (shapeKey === "ROLLERS" || shapeKey === "LONG_ROLLERS") {
          y += Math.sin(u * Math.PI * 4) * (15.0 + difficulty * 9.0) * env;
        } else if (shapeKey === "DOUBLE_HUMP" || shapeKey === "CAMELBACK") {
          y -= Math.sin(u * Math.PI * 3) * (24.0 + difficulty * 12.0) * env;
        } else if (shapeKey === "TRIPLE_HUMP") {
          y -= Math.sin(u * Math.PI * 5) * (20.0 + difficulty * 10.0) * env;
        } else if (shapeKey === "KICKER" || shapeKey === "LONG_KICKER" || shapeKey === "RIDGE_LAUNCH") {
          // Smooth upward launch ramp followed by landing basin
          if (u < 0.48) {
            y -= Math.sin((u / 0.48) * Math.PI * 0.5) * (28.0 + difficulty * 18.0) * env;
          } else {
            y += Math.sin(((u - 0.48) / 0.52) * Math.PI) * (18.0 + difficulty * 12.0) * env;
          }
        } else if (shapeKey === "CLIFF_LAUNCH" || shapeKey === "DOWNHILL_LAUNCH") {
          // High takeoff lip dropping into a wide downhill landing slope
          if (u < 0.35) {
            y -= Math.sin((u / 0.35) * Math.PI) * (34.0 + difficulty * 16.0);
          } else {
            y += Math.sin(((u - 0.35) / 0.65) * Math.PI) * (42.0 + difficulty * 22.0);
          }
        } else if (shapeKey === "V_VALLEY" || shapeKey === "RAVINE") {
          // Deep V-depression with compression floor and exit climb
          y += Math.pow(env, 1.4) * (75.0 + difficulty * 45.0);
        } else if (shapeKey === "U_VALLEY" || shapeKey === "GLACIAL_BOWL") {
          // Wide smooth high-speed bowl
          y += env2 * (90.0 + difficulty * 55.0);
        } else if (shapeKey === "MINE_PIT") {
          // Steep entry, flat pit floor, technical exit
          const pit = Math.min(1, env * 1.6);
          y += pit * (82.0 + difficulty * 38.0);
        } else if (shapeKey === "STEPPED_RIDGE") {
          // Stepped mountain shelves (climb -> brief shelf -> climb)
          y += Math.sin(u * Math.PI * 6) * 14.0 * env2;
        } else if (shapeKey === "RAZOR_CREST" || shapeKey === "BLIND_CREST") {
          // Pronounced crest apex at u = 0.45
          y -= Math.exp(-Math.pow((u - 0.45) / 0.18, 2)) * (44.0 + difficulty * 22.0) * env;
        } else if (shapeKey === "ROCK_FIELD" || shapeKey === "MOGUL_FIELD") {
          // High-frequency suspension challenge bumps
          y += (Math.sin(q / 24.0) * 7.5 + nDetail(q / 42.0) * 9.5) * env2;
        } else if (shapeKey === "OFF_CAMBER" || shapeKey === "BROKEN_RIDGE") {
          // Asymmetric wheelbase-scale ripples (~112px wavelength) pitching front vs rear wheel
          y += (Math.sin(q / 18.5) * 6.5 + Math.cos(q / 37.0) * 9.0) * env2;
        } else if (shapeKey === "COMPRESSION_RUN") {
          y += Math.sin(u * Math.PI * 6) * (18.0 + difficulty * 8.0) * env2;
        } else {
          // Subtle organic mountain erosion on climbs/descents
          y += nDetail(q / 85.0) * (6.5 + difficulty * 4.5) * env2;
        }

        // Physics Safety & Curvature Clamp (Sections 25, 37, 38):
        // Control both 1st derivative (slope) and 2nd derivative (dSlope/dX curvature) so no knife-edges occur
        const prev = this.samples[this.samples.length - 1];
        const dx = q - prev.x;
        let dy = y - prev.y;

        // 1. Curvature rate limiter (limits change in slope per 18px step to prevent single-frame kinks)
        const maxDeltaSlope = 0.085; // ~4.8 degrees max angle change per 18px sample
        const desiredSlope = dy / dx;
        const clampedCurvSlope = b(desiredSlope, prev.slope - maxDeltaSlope, prev.slope + maxDeltaSlope);
        dy = clampedCurvSlope * dx;

        // 2. Maximum slope clamp (<= maxSlopeTan, never exceeding 45.5 deg)
        const maxDy = dx * Math.min(maxSlopeTan, Math.tan(0.795));
        if (Math.abs(dy) > maxDy) {
          dy = Math.sign(dy) * maxDy;
        }

        y = prev.y + dy;
        const actualSlope = dy / dx;
        const curvature = (actualSlope - prev.slope) / dx;
        const slopeRad = Math.abs(Math.atan(actualSlope));
        if (slopeRad > segMaxSlopeRad) segMaxSlopeRad = slopeRad;
        if (y < segMinY) segMinY = y;
        if (y > segMaxY) segMaxY = y;

        let mat = segSurface;
        if (Math.abs(actualSlope) > 0.56 && biome.id !== "summit" && mat !== "metal") {
          mat = "rock";
        } else if (biome.id === "summit" && Math.abs(actualSlope) < 0.18) {
          mat = "ice";
        }

        this.samples.push({
          x: q,
          y: y,
          material: mat,
          biomeId: biome.id,
          slope: actualSlope,
          curvature: curvature,
        });
      }

      const endSample = this.samples[this.samples.length - 1];
      const elevGainM = Math.max(0, Math.round((y0 - segMinY) / 40));
      const elevLossM = Math.max(0, Math.round((segMaxY - y0) / 40));
      const maxSlopeDeg = Math.round((segMaxSlopeRad * 180) / Math.PI);

      // Store rich Segment Metadata (Section 45)
      this.segments.push({
        name: segName,
        type: shapeKey,
        category: shapeDef.cat,
        diffCategory: this.classifyDifficultyCategory(difficulty),
        act: biome.act,
        sector: biome.sector,
        biome: biome.name,
        startX: x0,
        endX: x1,
        startY: y0,
        endY: endSample.y,
        startSlope: Math.round((Math.atan(m0) * 180) / Math.PI),
        maxSlope: maxSlopeDeg,
        endSlope: Math.round((Math.atan(endSample.slope) * 180) / Math.PI),
        elevationGain: elevGainM,
        elevationLoss: elevLossM,
        difficulty: Number(difficulty.toFixed(2)),
        jumpPotential: shapeDef.jumpPotential || "Low",
        landingQuality: shapeDef.landingQuality || "Good",
        surface: segSurface,
        material: segSurface,
        signature: segSignature,
        startSampleIdx,
        endSampleIdx: this.samples.length - 1,
      });

      curX = x1;
      curY = endSample.y;
      curSlope = endSample.slope;
    }

    // 3. Build Streamed Physics Chunk Registry (Section 05 & 06)
    // Instead of instantiating 18,300 Matter.js bodies at startup, partition into 20-sample (360px) chunks!
    const totalSamples = this.samples.length;
    const stepCount = this.chunkSamples;
    let chunkId = 0;
    for (let s = 0; s < totalSamples - 1; s += stepCount) {
      const endS = Math.min(totalSamples - 1, s + stepCount);
      this.chunks.push({
        id: chunkId++,
        startIdx: s,
        endIdx: endS,
        minX: this.samples[s].x,
        maxX: this.samples[endS].x,
        active: false,
        bodies: [],
      });
    }

    // Activate initial physics window around startX so initial bodies are ready before first step
    this.updateStreaming(startX, null, null);
    this.stats = this.validateTerrain();
    this.validationReport = this.stats;
  }

  // Instantiate static collision bodies for a single chunk on demand
  buildChunkBodies(chunk) {
    const bodies = [];
    for (let i = chunk.startIdx; i < chunk.endIdx; i++) {
      const p1 = this.samples[i];
      const p2 = this.samples[i + 1];
      if (!p1 || !p2) continue;
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
          restitution: 0.0,
          label: "terrain",
          chamfer: { radius: 2 },
        }
      );
      body.materialKind = p1.material;
      body.chunkId = chunk.id;
      bodies.push(body);
    }
    return bodies;
  }

  // Streamed Terrain Physics Activation (Section 06)
  // Keeps only chunks within centerX +- activeRadius (3,200px) in the Matter.js physics world!
  updateStreaming(centerX, world = null, terrainSet = null) {
    if (Math.abs(centerX - this.lastStreamCenterX) < 120 && world) return;
    this.lastStreamCenterX = centerX;

    const minActiveX = centerX - this.activeRadius;
    const maxActiveX = centerX + this.activeRadius;
    let activeChunks = 0;
    let changed = false;

    for (let c = 0; c < this.chunks.length; c++) {
      const chunk = this.chunks[c];
      const shouldBeActive = chunk.maxX >= minActiveX && chunk.minX <= maxActiveX;

      if (shouldBeActive && !chunk.active) {
        if (chunk.bodies.length === 0) {
          chunk.bodies = this.buildChunkBodies(chunk);
        }
        chunk.active = true;
        changed = true;
        if (world) {
          Matter.Composite.add(world, chunk.bodies);
        }
        if (terrainSet) {
          for (const bBody of chunk.bodies) terrainSet.add(bBody);
        }
      } else if (!shouldBeActive && chunk.active) {
        chunk.active = false;
        changed = true;
        if (world) {
          for (const bBody of chunk.bodies) {
            try { Matter.Composite.remove(world, bBody); } catch (e) {}
          }
        }
        if (terrainSet) {
          for (const bBody of chunk.bodies) terrainSet.delete(bBody);
        }
      }

      if (chunk.active) activeChunks++;
    }

    this.activeChunkCount = activeChunks;
    if (changed) {
      this.bodies = [];
      for (let c = 0; c < this.chunks.length; c++) {
        if (this.chunks[c].active) {
          this.bodies.push(...this.chunks[c].bodies);
        }
      }
    }
  }

  // Terrain Validator 2.0 (Section 39 & 40)
  validateTerrain() {
    const startX = x.world.startX;
    const groundBase = x.world.groundBase;
    const totalDistM = Math.round((this.samples[this.samples.length - 1].x - startX) / 40);

    let minY = groundBase;
    let maxY = groundBase;
    let totalGainPx = 0;
    let totalLossPx = 0;
    let maxSlopeRad = 0;
    let sumSlopeRad = 0;
    let maxCurvature = 0;
    let maxDyPx = 0;
    let discontinuities = 0;

    const slopeBuckets = { easy: 0, moderate: 0, hard: 0, veryHard: 0, extreme: 0 };

    for (let i = 1; i < this.samples.length; i++) {
      const p0 = this.samples[i - 1];
      const p1 = this.samples[i];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      if (dy < 0) totalGainPx += -dy;
      else totalLossPx += dy;

      if (p1.y < minY) minY = p1.y;
      if (p1.y > maxY) maxY = p1.y;
      if (Math.abs(dy) > maxDyPx) maxDyPx = Math.abs(dy);

      const sRad = Math.abs(Math.atan2(dy, dx));
      const sDeg = (sRad * 180) / Math.PI;
      if (sRad > maxSlopeRad) maxSlopeRad = sRad;
      sumSlopeRad += sRad;

      if (sDeg < 12) slopeBuckets.easy++;
      else if (sDeg < 20) slopeBuckets.moderate++;
      else if (sDeg < 28) slopeBuckets.hard++;
      else if (sDeg < 35) slopeBuckets.veryHard++;
      else slopeBuckets.extreme++;

      const curv = Math.abs(p1.curvature || 0);
      if (curv > maxCurvature) maxCurvature = curv;
      if (Math.abs(dy) > 19.5) discontinuities++;
    }

    let jumpCount = 0;
    let majorJumpCount = 0;
    let extremeClimbCount = 0;
    let deepValleyCount = 0;
    let recoveryZoneCount = 0;
    let adjacentRepeats = 0;
    const setpiecePositions = [];

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (seg.category === "JUMP" || seg.jumpPotential === "High" || seg.jumpPotential === "Extreme") {
        jumpCount++;
        if (seg.jumpPotential === "Extreme" || seg.type === "CLIFF_LAUNCH" || seg.type === "LONG_KICKER") {
          majorJumpCount++;
        }
      }
      if (seg.category === "EXTREME" || seg.maxSlope >= 35) extremeClimbCount++;
      if (seg.category === "VALLEY" || seg.type === "LONG_DESCENT") deepValleyCount++;
      if (seg.category === "RECOVERY") recoveryZoneCount++;
      if (i > 0 && this.segments[i - 1].type === seg.type) adjacentRepeats++;
      if (seg.signature) setpiecePositions.push(seg.startX);
    }

    let minSetpieceSpacingM = 9999;
    for (let i = 1; i < setpiecePositions.length; i++) {
      const distM = (setpiecePositions[i] - setpiecePositions[i - 1]) / 40;
      if (distM < minSetpieceSpacingM) minSetpieceSpacingM = Math.round(distM);
    }

    const diversityScore = Number(
      b(1.0 - adjacentRepeats / Math.max(1, this.segments.length), 0, 1).toFixed(2)
    );

    return {
      sampleCount: this.samples.length,
      segmentCount: this.segments.length,
      totalDistanceMeters: totalDistM,
      totalDistanceKm: Number((totalDistM / 1000).toFixed(2)),
      maxElevationMeters: Math.max(0, Math.round((groundBase - minY) / 40)),
      totalElevationGain: Math.round(totalGainPx / 40),
      maxDescentMeters: Math.round(totalLossPx / 40),
      maxSlopeDeg: Number(((maxSlopeRad * 180) / Math.PI).toFixed(1)),
      avgSlopeDeg: Number((((sumSlopeRad / Math.max(1, this.samples.length)) * 180) / Math.PI).toFixed(1)),
      slopeDistribution: slopeBuckets,
      maxCurvature: Number(maxCurvature.toFixed(4)),
      maxDyPixels: Number(maxDyPx.toFixed(2)),
      discontinuitiesCount: discontinuities,
      jumpCount,
      majorJumpCount,
      extremeClimbCount,
      deepValleyCount,
      airtimeOpportunities: jumpCount + majorJumpCount,
      recoveryZoneCount,
      diversityScore,
      diversityPercent: Math.round(diversityScore * 100),
      adjacentRepeats,
      setpieceCount: setpiecePositions.length,
      minSetpieceSpacingMeters: minSetpieceSpacingM === 9999 ? 0 : minSetpieceSpacingM,
      totalChunks: this.chunks.length,
      chunkIntegrity: discontinuities === 0 && this.chunks.length > 100,
    };
  }

  getBiomeAtDist(distMeters) {
    for (const bItem of BIOMES) {
      if (distMeters >= bItem.minDist && distMeters < bItem.maxDist) {
        return bItem;
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

  curvatureAt(xPos) {
    const firstX = this.samples[0].x;
    const idx = Math.max(0, Math.min(this.samples.length - 1, Math.floor((xPos - firstX) / this.step)));
    return this.samples[idx]?.curvature ?? 0;
  }

  normalAt(xPos) {
    const slope = this.slopeAt(xPos);
    return {
      x: -Math.sin(slope),
      y: -Math.cos(slope),
    };
  }

  biomeAt(xPos) {
    const dist = Math.max(0, (xPos - x.world.startX) / 40);
    return this.getBiomeAtDist(dist);
  }

  materialAt(xPos) {
    const firstX = this.samples[0].x;
    const idx = Math.max(0, Math.min(this.samples.length - 1, Math.floor((xPos - firstX) / this.step)));
    const kind = this.samples[idx]?.material ?? "grass";
    return MATERIALS[kind] ?? MATERIALS.grass;
  }

  // O(log N) Binary Search Segment Lookup across 8.2km mountain
  segmentAt(xPos) {
    const segs = this.segments;
    if (!segs || segs.length === 0) {
      return { name: "Starting Apron", type: "FLAT", category: "RECOVERY", difficulty: 0.15 };
    }
    let lo = 0;
    let hi = segs.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const s = segs[mid];
      if (xPos < s.startX) {
        hi = mid - 1;
      } else if (xPos > s.endX) {
        lo = mid + 1;
      } else {
        return s;
      }
    }
    return { name: "Starting Apron", type: "FLAT", category: "RECOVERY", difficulty: 0.15 };
  }

  chunkAt(xPos) {
    if (!this.chunks || this.chunks.length === 0) return 0;
    const firstX = this.samples[0].x;
    const sampleIdx = Math.max(0, Math.floor((xPos - firstX) / this.step));
    return Math.min(this.chunks.length - 1, Math.floor(sampleIdx / this.chunkSamples));
  }

  getChunkAt(xPos) {
    if (!this.chunks || this.chunks.length === 0) return null;
    return this.chunks[this.chunkAt(xPos)];
  }
}


// ----------------------------------------------------------------------------
// Multi-Segment Articulated Ragdoll Driver (Coupled Pendulum + Crash Ragdoll)
// ----------------------------------------------------------------------------
class Driver {
  lean = 0;
  targetLean = 0;
  leanVel = 0;
  jolt = 0;
  joltVel = 0;
  neckAngle = 0;
  neckVel = 0;
  helmetAngle = 0;
  armAngle = 0;
  victory = 0;
  tuck = 0;
  ragdollActive = false;
  ragdollBodies = [];
  ragdollConstraints = [];

  update(vehicle, input, dt) {
    const dtSec = Math.min(0.033, Math.max(0.001, dt / 1000));
    const accel = (vehicle.forwardSpeed - (vehicle.lastForwardSpeed ?? vehicle.forwardSpeed)) / Math.max(0.004, dtSec);
    vehicle.lastForwardSpeed = vehicle.forwardSpeed;

    const angAccel = (vehicle.chassis.angularVelocity - (vehicle.lastAngVel ?? vehicle.chassis.angularVelocity)) / Math.max(0.004, dtSec);
    vehicle.lastAngVel = vehicle.chassis.angularVelocity;

    // Rollover protection tuck reaction (cos(angle) < -0.2 means chassis is inverted upside-down)
    const isInverted = Math.cos(vehicle.chassis.angle) < -0.2;
    if (isInverted) {
      this.tuck = G0(this.tuck, 1.0, 18, dt);
    } else {
      this.tuck = G0(this.tuck, 0.0, 9, dt);
    }

    // D'Alembert inertial forces on upper torso + active driver bracing
    const throttleLean = -input.throttle * 0.22;
    const brakeLean = input.brake * 0.26;
    const inertialLean = -b(accel * 0.012, -0.38, 0.38) - b(angAccel * 0.08, -0.25, 0.25);
    const slopeLean = -b(normalizeAngle(vehicle.chassis.angle) * 0.22, -0.25, 0.25);
    const airLean = vehicle.airborne ? b(-vehicle.chassis.angularVelocity * 2.5, -0.28, 0.28) : 0;

    this.targetLean = (throttleLean + brakeLean + inertialLean + slopeLean + airLean) * (1 - this.tuck * 0.45);

    // 2nd-Order Coupled Torso Spine Spring-Damper
    const spineK = 26.0;
    const spineDamp = 0.68;
    const spineTorque = (this.targetLean - this.lean) * spineK;
    this.leanVel = (this.leanVel + spineTorque * dtSec) * Math.pow(spineDamp, dtSec * 60);
    this.lean += this.leanVel * dtSec;
    this.lean = b(this.lean, -0.52, 0.52);

    // 2nd-Order Seat Cushion Vertical Suspension Jolt
    const joltForce = -this.jolt * 32.0;
    this.joltVel = (this.joltVel + joltForce * dtSec) * Math.pow(0.60, dtSec * 60);
    this.jolt += this.joltVel * dtSec;
    this.jolt = b(this.jolt, -4.5, 4.5);

    // Secondary Articulated Neck & Helmet Whip-Lash Pendulum
    const targetNeck = this.lean * 0.85 - b(accel * 0.018, -0.45, 0.45) + vehicle.chassis.angularVelocity * 1.8 + (this.tuck * 0.45);
    const neckK = 34.0;
    const neckDamp = 0.58;
    const neckTorque = (targetNeck - this.neckAngle) * neckK;
    this.neckVel = (this.neckVel + neckTorque * dtSec) * Math.pow(neckDamp, dtSec * 60);
    this.neckAngle += this.neckVel * dtSec;
    this.neckAngle = b(this.neckAngle, -0.75, 0.75);
    this.helmetAngle = this.neckAngle;

    this.victory = Math.max(0, this.victory - dtSec * 0.5);
  }

  applyShock(energy) {
    const impulse = b(energy * 0.45, 0.4, 3.2);
    this.jolt += impulse;
    this.joltVel += impulse * 8.5;
    this.jolt = b(this.jolt, -4.5, 4.5);
    const whip = (Math.random() - 0.35) * b(energy * 0.25, 0.15, 0.65);
    this.leanVel += whip * 6.0;
    this.neckVel += whip * 12.0;
  }

  triggerVictory() {
    this.victory = 1.2;
  }

  spawnCrashRagdoll(world, chassis) {
    if (this.ragdollActive || !world || !chassis) return;
    this.ragdollActive = true;
    const cx = chassis.position.x;
    const cy = chassis.position.y;
    const ang = chassis.angle;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);

    const toWorld = (lx, ly) => ({
      x: cx + lx * cos - ly * sin,
      y: cy + lx * sin + ly * cos,
    });

    const torsoPos = toWorld(-20, -20);
    const headPos = toWorld(-20, -36);
    const armPos = toWorld(-8, -24);

    const torso = Matter.Bodies.rectangle(torsoPos.x, torsoPos.y, 10, 18, {
      label: "ragdoll_torso",
      collisionFilter: { group: -3 },
      density: 0.0008,
      friction: 0.4,
      restitution: 0.15,
      angle: ang + this.lean,
    });
    const head = Matter.Bodies.circle(headPos.x, headPos.y, 7.5, {
      label: "ragdoll_head",
      collisionFilter: { group: -3 },
      density: 0.0006,
      friction: 0.3,
      restitution: 0.25,
    });
    const arm = Matter.Bodies.rectangle(armPos.x, armPos.y, 14, 5, {
      label: "ragdoll_arm",
      collisionFilter: { group: -3 },
      density: 0.0004,
      friction: 0.3,
      restitution: 0.1,
      angle: ang,
    });

    const vx = b(chassis.velocity.x * 1.15, -18, 18);
    const vy = b(chassis.velocity.y - 3.5, -18, 12);
    Matter.Body.setVelocity(torso, { x: vx, y: vy });
    Matter.Body.setVelocity(head, { x: vx + (Math.random() - 0.5) * 2, y: vy - 1.5 });
    Matter.Body.setVelocity(arm, { x: vx, y: vy });
    Matter.Body.setAngularVelocity(torso, (Math.random() - 0.5) * 0.08);

    const seatLap = Matter.Constraint.create({
      bodyA: chassis,
      pointA: { x: -22, y: -10 },
      bodyB: torso,
      pointB: { x: 0, y: 7 },
      length: 4,
      stiffness: 0.35,
      damping: 0.1,
    });
    const neckJoint = Matter.Constraint.create({
      bodyA: torso,
      pointA: { x: 0, y: -9 },
      bodyB: head,
      pointB: { x: 0, y: 6 },
      length: 2,
      stiffness: 0.75,
      damping: 0.1,
    });
    const shoulderJoint = Matter.Constraint.create({
      bodyA: torso,
      pointA: { x: 2, y: -6 },
      bodyB: arm,
      pointB: { x: -6, y: 0 },
      length: 2,
      stiffness: 0.65,
      damping: 0.1,
    });

    this.ragdollBodies = [torso, head, arm];
    this.ragdollConstraints = [seatLap, neckJoint, shoulderJoint];
    Matter.Composite.add(world, [...this.ragdollBodies, ...this.ragdollConstraints]);
  }

  clearRagdoll(world) {
    if (!world) return;
    for (const c of this.ragdollConstraints) {
      try { Matter.Composite.remove(world, c); } catch (e) {}
    }
    for (const bBody of this.ragdollBodies) {
      try { Matter.Composite.remove(world, bBody); } catch (e) {}
    }
    this.ragdollBodies = [];
    this.ragdollConstraints = [];
    this.ragdollActive = false;
  }
}

// ----------------------------------------------------------------------------
// Expedition Vehicle (f0) - Prismatic Suspension & Surface-Tangent Traction
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
  groundClearance = 0;
  fuel = 1.0;
  engineTemp = 0.28;

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
    const posY = yPos ?? this.chassis?.position.y ?? x.world.groundBase - (vCfg.wheelOffsetY + vCfg.wheelRadius);

    this.chassis = d.default.Bodies.rectangle(
      posX,
      posY,
      vCfg.chassisWidth,
      vCfg.chassisHeight,
      {
        label: "chassis",
        collisionFilter: { group: -3 },
        density: vCfg.chassisMass / (vCfg.chassisWidth * vCfg.chassisHeight),
        friction: 0.12,
        frictionAir: 0.004,
        restitution: 0.02,
        chamfer: { radius: [6, 6, 12, 12] },
      }
    );

    // High polar moment of inertia prevents twitchy pitching and gives weighty stability
    const defInertia = (vCfg.chassisMass * (vCfg.chassisWidth * vCfg.chassisWidth + vCfg.chassisHeight * vCfg.chassisHeight)) / 12;
    Matter.Body.setInertia(this.chassis, defInertia * 2.4);

    // Low Center of Mass for natural hill-climbing balance
    Matter.Body.setCentre(this.chassis, { x: 0, y: 4 }, true);

    const wheelOffsets = [
      { x: -vCfg.wheelBase / 2, y: vCfg.wheelOffsetY }, // Rear wheel (0)
      { x: vCfg.wheelBase / 2, y: vCfg.wheelOffsetY },  // Front wheel (1)
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
          frictionStatic: vCfg.tireGrip * 1.5,
          frictionAir: 0.003,
          restitution: 0.0, // Zero superball bounce on terrain polygon seams!
          slop: 0.01,
        }
      );

      // Symmetric Wishbone + Primary Coilover Strut (paired with exact 1D Prismatic Axis projection)
      const springStrut = d.default.Constraint.create({
        bodyA: this.chassis,
        pointA: { x: off.x, y: 0 },
        bodyB: wheel,
        length: vCfg.wheelOffsetY,
        stiffness: vCfg.suspensionStiffness,
        damping: vCfg.suspensionDamping,
      });

      const guideSpread = 22;
      const guideLen = Math.hypot(guideSpread, vCfg.wheelOffsetY);
      const guideLeft = d.default.Constraint.create({
        bodyA: this.chassis,
        pointA: { x: off.x - guideSpread, y: 0 },
        bodyB: wheel,
        length: guideLen,
        stiffness: vCfg.suspensionStiffness * 0.85,
        damping: vCfg.suspensionDamping,
      });
      const guideRight = d.default.Constraint.create({
        bodyA: this.chassis,
        pointA: { x: off.x + guideSpread, y: 0 },
        bodyB: wheel,
        length: guideLen,
        stiffness: vCfg.suspensionStiffness * 0.85,
        damping: vCfg.suspensionDamping,
      });

      this.constraints.push(springStrut, guideLeft, guideRight);

      this.wheels.push({
        body: wheel,
        restOffset: off,
        compression: 0,
        lastCompression: 0,
        contact: true,
        contactGrace: 100,
        slip: 0,
        slipRatio: 0,
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

  // --------------------------------------------------------------------------
  // PRISMATIC LINE CONSTRAINT SOLVER (Inspired by AngeTheGreat line_constraint)
  // Projects wheel strictly onto the chassis local suspension strut axis (C_perp = 0)
  // and enforces physical bump-stop & droop-stop travel limits [minY, maxY].
  // --------------------------------------------------------------------------
  solvePrismaticSuspension(terrain = null) {
    const vCfg = this.archetype;
    let cPos = this.chassis.position;
    let cVel = this.chassis.velocity;
    const theta = this.chassis.angle;
    const omega = this.chassis.angularVelocity;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    // Anti-tunneling guard for chassis center against continuous terrain spline
    if (terrain && Number.isFinite(cPos.x) && Number.isFinite(cPos.y)) {
      const cGroundY = terrain.heightAt(cPos.x);
      const minChassisSurfaceY = cGroundY - 10;
      if (cPos.y > minChassisSurfaceY) {
        Matter.Body.setPosition(this.chassis, { x: cPos.x, y: minChassisSurfaceY });
        if (cVel.y > 0) {
          Matter.Body.setVelocity(this.chassis, { x: cVel.x, y: 0 });
        }
        cPos = this.chassis.position;
        cVel = this.chassis.velocity;
      }
    }

    // Local chassis basis vectors: tHat = forward, nHat = downward strut axis
    const tHat = { x: cos, y: sin };
    const nHat = { x: -sin, y: cos };

    const minAxialY = Math.max(16, vCfg.wheelOffsetY - vCfg.suspensionTravel * 0.72);
    const maxAxialY = vCfg.wheelOffsetY + vCfg.suspensionTravel * 0.42;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const wPos = w.body.position;
      const wVel = w.body.velocity;

      const dx = wPos.x - cPos.x;
      const dy = wPos.y - cPos.y;

      // Wheel coordinates in chassis local frame
      const localX = dx * tHat.x + dy * tHat.y;
      const localY = dx * nHat.x + dy * nHat.y;

      const targetX = w.restOffset.x;
      const clampedY = b(localY, minAxialY, maxAxialY);

      const errX = localX - targetX;
      const errY = localY - clampedY;

      // Project position onto prismatic strut line if lateral drift or travel limit exceeded
      if (Math.abs(errX) > 0.15 || Math.abs(errY) > 0.05) {
        let newWorldX = cPos.x + targetX * tHat.x + clampedY * nHat.x;
        let newWorldY = cPos.y + targetX * tHat.y + clampedY * nHat.y;

        // Prevent bump-stop projection from pushing wheel below terrain spline
        if (terrain && Number.isFinite(newWorldX) && Number.isFinite(newWorldY)) {
          const wheelFloorY = terrain.heightAt(newWorldX) - vCfg.wheelRadius + 2.5;
          if (newWorldY > wheelFloorY) {
            const penY = newWorldY - wheelFloorY;
            newWorldY = wheelFloorY;
            if (cos > 0.15 && penY > 0.5) {
              Matter.Body.setPosition(this.chassis, { x: cPos.x, y: cPos.y - penY * 0.65 });
              cPos = this.chassis.position;
            }
          }
        }

        // Mount velocity in world space: v_mount = v_c + omega x r_mount
        const mountVx = cVel.x - omega * (targetX * sin + clampedY * cos);
        const mountVy = cVel.y + omega * (targetX * cos - clampedY * sin);

        // Preserve axial velocity along nHat while damping lateral error velocity along tHat
        const relVx = wVel.x - mountVx;
        const relVy = wVel.y - mountVy;
        let axialVel = relVx * nHat.x + relVy * nHat.y;
        if (localY <= minAxialY && axialVel < 0) axialVel = 0;
        if (localY >= maxAxialY && axialVel > 0) axialVel = 0;

        const lateralVel = (relVx * tHat.x + relVy * tHat.y) * 0.15;

        const nextVx = mountVx + tHat.x * lateralVel + nHat.x * axialVel;
        const nextVy = mountVy + tHat.y * lateralVel + nHat.y * axialVel;

        Matter.Body.setPosition(w.body, { x: newWorldX, y: newWorldY });
        Matter.Body.setVelocity(w.body, { x: nextVx, y: nextVy });
      }

      // Compute normalized suspension compression [-1, 1]
      w.compression = b(
        (vCfg.wheelOffsetY - clampedY) / vCfg.suspensionTravel,
        -1,
        1
      );
    }
  }

  update(input, dt, terrain = null) {
    const vCfg = this.archetype;
    const throttleBrake = input.throttle - input.brake;
    const dtSec = Math.max(0.001, dt / 1000);

    // 1. Enforce 1D Prismatic Strut Axis & Travel Limits before applying forces
    this.solvePrismaticSuspension(terrain);

    if (this.airborne) {
      this.airborneTimer += dt;
    } else {
      this.airborneTimer = 0;
    }

    // Compute true ground clearance under the tires
    if (terrain) {
      const groundY = terrain.heightAt(this.chassis.position.x);
      const lowestTireY = Math.max(
        this.wheels[0].body.position.y + vCfg.wheelRadius,
        this.wheels[1].body.position.y + vCfg.wheelRadius
      );
      this.groundClearance = Math.max(0, groundY - lowestTireY);
    } else {
      this.groundClearance = this.airborne ? 200 : 0;
    }

    // Dynamic Normal Load Distribution (Spec #03):
    const theta = normalizeAngle(this.chassis.angle);
    const ax = b((this.forwardSpeed - (this.lastForwardSpeed ?? this.forwardSpeed)) / dtSec, -45, 45);
    const m = this.chassis.mass;
    const g = 9.81 * 8.0;
    const W = m * g;
    const L = vCfg.wheelBase;
    const b_dist = L / 2;
    const a_dist = L / 2;
    const h = vCfg.centerOfMassOffsetY ?? 6.0;

    const nFront = Math.max(0.15, (W * (b_dist * Math.cos(theta) - h * Math.sin(theta)) - m * h * ax * 0.25) / L);
    const nRear = Math.max(0.15, (W * (a_dist * Math.cos(theta) + h * Math.sin(theta)) + m * h * ax * 0.25) / L);
    this.normalLoads = { front: nFront, rear: nRear };

    // Local terrain slope under chassis
    const groundSlope = terrain ? terrain.slopeAt(this.chassis.position.x) : 0;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const isRear = i === 0;
      const torqueShare = isRear ? 0.54 : 0.46;
      const spin = w.body.angularVelocity;
      const speedRatio = b(1 - Math.abs(spin) / vCfg.maxWheelSpeed, 0, 1);

      // Wheel Slip Ratio & Saturating Traction Curve S(kappa)
      const R = vCfg.wheelRadius;
      const rw = spin * R;
      const vx = this.forwardSpeed;
      const denom = Math.max(Math.abs(rw), Math.abs(vx), 0.1);
      w.slipRatio = b((rw - vx) / denom, -1.5, 1.5);

      if (throttleBrake !== 0) {
        const isDriving = Math.sign(throttleBrake) === Math.sign(spin) || Math.abs(spin) < 0.03;
        const torque = isDriving
          ? vCfg.engineTorque * (0.25 + 0.75 * speedRatio) * throttleBrake
          : vCfg.brakeTorque * throttleBrake;

        // Spin wheel smoothly within maxWheelSpeed
        const targetSpinDelta = torque * torqueShare * 0.32 * (dt / 8.333);
        const nextSpin = b(spin + targetSpinDelta, -vCfg.maxWheelSpeed, vCfg.maxWheelSpeed);
        d.default.Body.setAngularVelocity(w.body, nextSpin);

        // True Surface-Tangent Rolling Traction (only when wheel is on ground & car is upright!)
        if (w.contact && Math.cos(theta) > 0.25) {
          const mat = MATERIALS[w.material] ?? MATERIALS.dirt;
          const wheelSlope = terrain ? terrain.slopeAt(w.body.position.x) : theta;
          const tangentDir = {
            x: Math.cos(wheelSlope),
            y: Math.sin(wheelSlope),
          };
          const normalDir = {
            x: -Math.sin(wheelSlope),
            y: Math.cos(wheelSlope),
          };

          const topSpeedLimiter = b(1 - Math.abs(this.forwardSpeed) / 16.5, 0.08, 1.0);
          const tractiveMag = torque * torqueShare * mat.friction * 0.18 * topSpeedLimiter;

          // Apply propulsion along the terrain tangent + subtle tire-ground normal grip
          Matter.Body.applyForce(this.chassis, this.chassis.position, {
            x: tangentDir.x * tractiveMag,
            y: tangentDir.y * tractiveMag + normalDir.y * Math.abs(tractiveMag) * 0.12,
          });
        }
      } else {
        d.default.Body.setAngularVelocity(w.body, spin * 0.985);
      }

      const deltaComp = w.compression - w.lastCompression;
      if (deltaComp > 0.26 && w.compression > 0.35 && this.audio) {
        this.audio.creak(deltaComp);
      }
      w.lastCompression = w.compression;
      w.slip = Math.abs(spin * vCfg.wheelRadius - this.forwardSpeed);
    }

    // -------------------------------------------------------------------------
    // GROUND STABILITY & GENUINE HILL CLIMB RACING PITCH CONTROL
    // -------------------------------------------------------------------------
    const relPitch = normalizeAngle(theta - groundSlope);

    if (!this.airborne) {
      // ON GROUND: Keep vehicle planted and stable!
      // Subtle weight-transfer pitch feel (wheelie lift on gas, nose dive on brake),
      // strictly bounded to +-16 degrees relative to the slope so it NEVER flips on the ground!
      if (throttleBrake > 0 && relPitch > -0.26 && Math.cos(theta) > 0.5) {
        this.chassis.torque += -0.0008 * this.chassis.mass * b(1 - Math.abs(relPitch) / 0.26, 0, 1);
      } else if (throttleBrake < 0 && relPitch < 0.26 && Math.cos(theta) > 0.5) {
        this.chassis.torque += 0.0008 * this.chassis.mass * b(1 - Math.abs(relPitch) / 0.26, 0, 1);
      }

      // Strong anti-flip suspension restoring torque when both or either wheel is grounded
      if (Math.cos(theta) > 0.15) {
        const pitchError = normalizeAngle(theta - groundSlope);
        if (Math.abs(pitchError) > 0.22) {
          const excess = pitchError - Math.sign(pitchError) * 0.22;
          this.chassis.torque += -excess * 0.028 * this.chassis.mass;
        }
        // Damp ground pitch oscillations strongly
        this.chassis.torque += -this.chassis.angularVelocity * 0.045 * this.chassis.mass;
      }
    } else {
      // IN MID-AIR:
      // Distinguish between small trail hops (groundClearance <= 38px) vs real high jumps!
      const isHighJump = this.groundClearance > 38 && this.airborneTimer >= 140;
      if (isHighJump && throttleBrake !== 0) {
        // Deliberate High-Air Stunt Control:
        // D (Throttle > 0) -> Counter-clockwise (dir = -1 -> BACKFLIP)
        // A (Brake > 0)    -> Clockwise         (dir = +1 -> FRONTFLIP)
        const dir = -Math.sign(throttleBrake);
        const angVel = this.chassis.angularVelocity;
        // Target flip speed for 1.0s 360-degree stunt rotation in high air
        const maxFlipRate = 0.115;
        const spinLimit = b(1 - Math.abs(angVel) / maxFlipRate, 0, 1);
        const opposing = Math.sign(dir) !== Math.sign(angVel) ? 1.25 : spinLimit;
        const airTorque = dir * Math.abs(throttleBrake) * vCfg.airControl * opposing * this.chassis.mass * 34.0;
        this.chassis.torque += airTorque;
      } else if (!isHighJump && Math.cos(theta) > 0.2) {
        // Low trail hop: gently auto-level chassis to terrain slope for smooth 4-wheel landings!
        const hopError = normalizeAngle(theta - groundSlope);
        this.chassis.torque += -hopError * 0.018 * this.chassis.mass - this.chassis.angularVelocity * 0.035 * this.chassis.mass;
      }
    }

    // Inverted Self-Righting Roll Recovery (when resting upside down on roof)
    const isUpsideDown = !this.airborne && (Math.abs(theta) > 1.65 || this.roofContact);
    if (isUpsideDown && throttleBrake !== 0) {
      const rollDir = Math.sign(throttleBrake);
      this.chassis.torque += rollDir * this.chassis.mass * 0.32;
      Matter.Body.applyForce(this.chassis, this.chassis.position, {
        x: rollDir * 0.014 * this.chassis.mass,
        y: -0.024 * this.chassis.mass,
      });
    }

    // Angular velocity damping & hard safety clamp
    const damping = this.airborne ? vCfg.angularDamping * 0.65 : vCfg.angularDamping * 3.2;
    const factor = 1 - Math.min(damping * (dt / 16.666), 0.45);
    const maxAllowedAngVel = (this.airborne && this.groundClearance > 38) ? 0.125 : 0.045;
    const clampedAngVel = b(this.chassis.angularVelocity * factor, -maxAllowedAngVel, maxAllowedAngVel);
    d.default.Body.setAngularVelocity(this.chassis, clampedAngVel);

    // Expedition Fuel / Energy Reserve & Engine Thermal Telemetry
    const fuelDtSec = Math.min(0.033, Math.max(0.001, dt / 1000));
    const climbLoad = Math.max(0, -Math.sin(groundSlope));
    const throttleAbs = Math.abs(throttleBrake);
    if (throttleAbs > 0.05) {
      this.fuel = Math.max(0.08, this.fuel - (0.0022 + climbLoad * 0.0035) * throttleAbs * fuelDtSec);
    } else if (this.forwardSpeed > 2.0 && Math.sin(groundSlope) > 0.05) {
      // Regenerative downhill kinetic recovery
      this.fuel = Math.min(1.0, this.fuel + 0.004 * fuelDtSec);
    }
    const targetTemp = b(0.24 + this.rpm * 0.52 + climbLoad * throttleAbs * 0.32, 0.20, 0.98);
    this.engineTemp += (targetTemp - this.engineTemp) * Math.min(1, fuelDtSec * 1.8);

    this.driver.update(this, input, dt);
  }

  markContacts(terrainSet, activePairs, terrain = null, dt = 8.333) {
    this.roofContact = false;
    const pairHit = [false, false];

    for (const pair of activePairs) {
      const { bodyA, bodyB } = pair;
      for (let i = 0; i < this.wheels.length; i++) {
        const w = this.wheels[i];
        if (bodyA === w.body || bodyB === w.body) {
          const other = bodyA === w.body ? bodyB : bodyA;
          if (terrainSet.has(other)) {
            pairHit[i] = true;
            w.contact = true;
            w.contactGrace = 85;
            w.material = other.materialKind ?? "grass";
          }
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

    // Spline proximity & grace hysteresis so 18px polygon seams never cause false airborne state
    const vCfg = this.archetype;
    const upright = Math.cos(this.chassis.angle) > 0.15;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      if (pairHit[i]) continue;

      let nearSpline = false;
      if (terrain && upright && w.body.velocity.y >= -3.2) {
        const ty = terrain.heightAt(w.body.position.x);
        const tireBottom = w.body.position.y + vCfg.wheelRadius;
        if (Math.abs(ty - tireBottom) <= 6.5) {
          nearSpline = true;
          w.material = terrain.materialAt(w.body.position.x)?.name ?? "grass";
        }
      }

      if (nearSpline) {
        w.contact = true;
        w.contactGrace = 65;
      } else {
        w.contactGrace = Math.max(0, (w.contactGrace ?? 0) - dt);
        if (w.contactGrace > 0 && terrain) {
          const ty = terrain.heightAt(w.body.position.x);
          const tireBottom = w.body.position.y + vCfg.wheelRadius;
          w.contact = (ty - tireBottom) < 12.0;
        } else {
          w.contact = false;
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
    const dtSec = dt / 1000;
    const speed = Math.abs(vehicle.forwardSpeed);

    // Wheelie: Rear wheel in contact, front wheel lifted
    if (rear.contact && !front.contact && speed > 2.5) {
      if (this.wheelieTime === 0) this.wheelieStartX = vehicle.chassis.position.x;
      this.wheelieTime += dtSec;
      this.wheelieDistance = Math.abs(vehicle.chassis.position.x - (this.wheelieStartX || vehicle.chassis.position.x)) / 40;

      if (this.wheelieTime >= 1.2 && Math.floor((this.wheelieTime - dtSec) / 1.2) < Math.floor(this.wheelieTime / 1.2)) {
        const pts = Math.round(80 + this.wheelieDistance * 8);
        this.awardStunt(`WHEELIE ${Math.round(this.wheelieDistance)}m`, pts, 1);
      }
    } else {
      this.wheelieTime = 0;
      this.wheelieDistance = 0;
    }

    // Stoppie / Nose Manual: Front wheel in contact, rear wheel lifted
    if (front.contact && !rear.contact && speed > 2.0) {
      if (this.stoppieTime === 0) this.stoppieStartX = vehicle.chassis.position.x;
      this.stoppieTime += dtSec;
      this.stoppieDistance = Math.abs(vehicle.chassis.position.x - (this.stoppieStartX || vehicle.chassis.position.x)) / 40;

      if (this.stoppieTime >= 0.9 && Math.floor((this.stoppieTime - dtSec) / 0.9) < Math.floor(this.stoppieTime / 0.9)) {
        this.awardStunt(`NOSE BALANCE`, 120, 2);
      }
    } else {
      this.stoppieTime = 0;
      this.stoppieDistance = 0;
    }
  }

  onLanding(vehicle, terrain) {
    if (this.airtime < 420) {
      this.airtime = 0;
      return;
    }

    const slope = terrain.slopeAt(vehicle.chassis.position.x);
    const angleDiff = Math.abs(normalizeAngle(vehicle.chassis.angle - slope));
    const vy = Math.abs(vehicle.chassis.velocity.y);
    const heightMeters = Math.max(0, (this.launchY - this.airApexY) / 40);

    // Big Air & Long Jump
    if (this.airDistance >= 14) {
      const jumpScore = Math.round(this.airDistance * 12);
      this.awardStunt(`LONG JUMP ${this.airDistance.toFixed(0)}m`, jumpScore, 2);
    } else if (heightMeters >= 3.2 || this.airtime >= 950) {
      this.awardStunt(`BIG AIR`, 180, 1);
    }

    // Clean / Perfect Landing check (chassis aligned with terrain slope)
    if (angleDiff < 0.24 && !vehicle.roofContact) {
      if (this.airtime >= 680 || this.backflips > 0 || this.frontflips > 0) {
        const bonus = (this.backflips + this.frontflips) > 0 ? 220 : 110;
        this.awardStunt("PERFECT LANDING", bonus, 3);
        this.camera.pulseZoom(0.035);
        vehicle.driver.triggerVictory();
      }
    } else if (angleDiff > 0.75 || vy > 9.5) {
      // Hard Slam Landing
      if (this.comboMultiplier > 1) {
        this.showToast("HARD SLAM!", 1);
      }
    }

    this.airtime = 0;
  }

  awardStunt(name, baseScore, tier = 1) {
    this.comboScore += baseScore * this.comboMultiplier;
    if (this.comboTimer > 0) {
      this.comboMultiplier = Math.min(8, this.comboMultiplier + 1);
    } else {
      this.comboMultiplier = 1;
    }
    this.comboTimer = 4.2;
    this.activeStuntName = name;

    this.audio.stuntChime(tier);
    this.bus.emit("stunt:awarded", {
      name,
      score: baseScore * this.comboMultiplier,
      multiplier: this.comboMultiplier,
      tier,
    });
  }

  showToast(name, tier = 1) {
    this.bus.emit("stunt:awarded", {
      name,
      score: 0,
      multiplier: 1,
      tier,
    });
  }

  endCombo() {
    this.comboMultiplier = 1;
    this.comboScore = 0;
    this.comboTimer = 0;
    this.activeStuntName = "";
  }
}


// ============================================================================
// LIVING WORLD SIMULATION 2.0 — CENTRALIZED ECOSYSTEM & ATMOSPHERIC ENGINE
// ============================================================================

function J0(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORLD_TIME_PHASES = [
  { name: "DEEP_NIGHT", startHr: 0.0,  endHr: 5.5  },
  { name: "SUNRISE",    startHr: 5.5,  endHr: 7.5  },
  { name: "MORNING",    startHr: 7.5,  endHr: 11.5 },
  { name: "NOON",       startHr: 11.5, endHr: 15.5 },
  { name: "GOLDEN_HOUR",startHr: 15.5, endHr: 18.0 },
  { name: "SUNSET",     startHr: 18.0, endHr: 20.2 },
  { name: "NIGHT",      startHr: 20.2, endHr: 24.0 },
];

const SEASONS = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

const WEATHER_TYPES = {
  CLEAR:         { cloud: 0.12, rain: 0.0,  snow: 0.0,  fog: 0.04, windMult: 0.6,  vis: 1.00, hum: 0.35, minDur: 35, maxDur: 75 },
  PARTLY_CLOUDY: { cloud: 0.38, rain: 0.0,  snow: 0.0,  fog: 0.08, windMult: 0.85, vis: 0.95, hum: 0.48, minDur: 30, maxDur: 65 },
  OVERCAST:      { cloud: 0.78, rain: 0.0,  snow: 0.0,  fog: 0.22, windMult: 1.10, vis: 0.82, hum: 0.68, minDur: 25, maxDur: 55 },
  MIST:          { cloud: 0.48, rain: 0.05, snow: 0.0,  fog: 0.52, windMult: 0.45, vis: 0.68, hum: 0.85, minDur: 22, maxDur: 48 },
  FOG:           { cloud: 0.65, rain: 0.0,  snow: 0.0,  fog: 0.82, windMult: 0.35, vis: 0.46, hum: 0.92, minDur: 20, maxDur: 45 },
  LIGHT_RAIN:    { cloud: 0.82, rain: 0.42, snow: 0.0,  fog: 0.30, windMult: 1.25, vis: 0.74, hum: 0.86, minDur: 22, maxDur: 50 },
  HEAVY_RAIN:    { cloud: 0.94, rain: 0.85, snow: 0.0,  fog: 0.45, windMult: 1.75, vis: 0.56, hum: 0.96, minDur: 18, maxDur: 40 },
  THUNDERSTORM:  { cloud: 1.00, rain: 1.00, snow: 0.0,  fog: 0.50, windMult: 2.35, vis: 0.48, hum: 1.00, minDur: 15, maxDur: 32 },
  SNOW:          { cloud: 0.84, rain: 0.0,  snow: 0.58, fog: 0.36, windMult: 1.15, vis: 0.66, hum: 0.78, minDur: 24, maxDur: 52 },
  BLIZZARD:      { cloud: 0.98, rain: 0.0,  snow: 1.00, fog: 0.72, windMult: 2.50, vis: 0.38, hum: 0.88, minDur: 16, maxDur: 34 },
  WINDSTORM:     { cloud: 0.55, rain: 0.0,  snow: 0.0,  fog: 0.28, windMult: 2.65, vis: 0.72, hum: 0.30, minDur: 18, maxDur: 38 },
  HEATWAVE:      { cloud: 0.05, rain: 0.0,  snow: 0.0,  fog: 0.02, windMult: 0.40, vis: 0.96, hum: 0.18, minDur: 28, maxDur: 60 },
};

// Natural Weather Progression Graph (Section 6: No abrupt SUN -> THUNDERSTORM)
const WEATHER_TRANSITIONS = {
  CLEAR:         ["PARTLY_CLOUDY", "MIST", "WINDSTORM", "HEATWAVE"],
  PARTLY_CLOUDY: ["CLEAR", "OVERCAST", "MIST", "WINDSTORM"],
  OVERCAST:      ["PARTLY_CLOUDY", "LIGHT_RAIN", "FOG", "SNOW"],
  MIST:          ["CLEAR", "PARTLY_CLOUDY", "FOG", "LIGHT_RAIN"],
  FOG:           ["MIST", "OVERCAST", "PARTLY_CLOUDY"],
  LIGHT_RAIN:    ["OVERCAST", "HEAVY_RAIN", "PARTLY_CLOUDY", "MIST"],
  HEAVY_RAIN:    ["LIGHT_RAIN", "THUNDERSTORM", "OVERCAST"],
  THUNDERSTORM:  ["HEAVY_RAIN", "LIGHT_RAIN"],
  SNOW:          ["OVERCAST", "BLIZZARD", "PARTLY_CLOUDY"],
  BLIZZARD:      ["SNOW", "OVERCAST"],
  WINDSTORM:     ["PARTLY_CLOUDY", "OVERCAST", "CLEAR"],
  HEATWAVE:      ["CLEAR", "PARTLY_CLOUDY"],
};

const MOON_PHASES = [
  { name: "NEW_MOON",      illum: 0.08, offset: 0.00 },
  { name: "WAXING_CRESCENT", illum: 0.32, offset: 0.25 },
  { name: "HALF_MOON",     illum: 0.58, offset: 0.50 },
  { name: "WAXING_GIBBOUS",illum: 0.82, offset: 0.75 },
  { name: "FULL_MOON",     illum: 1.00, offset: 1.00 },
];

// Color utilities for smooth sky/lighting interpolation
function parseHexOrRgb(col) {
  if (!col || typeof col !== "string") return { r: 200, g: 205, b: 200 };
  const s = col.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16) || 0,
      g: parseInt(hex.slice(2, 4), 16) || 0,
      b: parseInt(hex.slice(4, 6), 16) || 0,
    };
  }
  const m = s.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  return { r: 200, g: 205, b: 200 };
}

function lerpRgbObj(a, bCol, t) {
  const u = b(t, 0, 1);
  return {
    r: Math.round(a.r + (bCol.r - a.r) * u),
    g: Math.round(a.g + (bCol.g - a.g) * u),
    b: Math.round(a.b + (bCol.b - a.b) * u),
  };
}

function rgbToHex({ r, g, b: bl }) {
  const clampC = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    "#" +
    [clampC(r), clampC(g), clampC(bl)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

function lerpHexColor(c1, c2, t) {
  return rgbToHex(lerpRgbObj(parseHexOrRgb(c1), parseHexOrRgb(c2), t));
}

// ============================================================================
// 1. CENTRALIZED WORLD STATE & MEMORY (Sections 1, 29, 38)
// ============================================================================
class WorldState {
  // Configurable time scale: 1 real second = 2.4 simulated minutes by default so
  // standing still for 30 seconds visibly advances the sky, clouds, wind & events
  timeScale = 2.4;
  timeMinutes = 7 * 60 + 15; // 07:15 AM initial expedition start
  dayProgress = (7 * 60 + 15) / 1440;
  dayCount = 0;
  phaseName = "SUNRISE";

  // Season state
  seasonIndex = 0; // 0: SPRING, 1: SUMMER, 2: AUTUMN, 3: WINTER
  season = "SPRING";
  nextSeason = "SUMMER";
  seasonProgress = 0.25; // 0..1 within current season

  // Weather state
  weather = "CLEAR";
  prevWeather = "CLEAR";
  targetWeather = "PARTLY_CLOUDY";
  weatherTransition = 1.0;
  weatherTimerSec = 0;
  weatherDurationSec = 42;
  weatherIntensity = 0.25;

  // Atmospheric metrics
  temperature = 11.0;
  humidity = 0.42;
  visibility = 1.0;
  cloudCoverage = 0.18;
  precipitation = 0.0;
  rainIntensity = 0.0;
  snowIntensity = 0.0;
  fogDensity = 0.06;

  // Wind simulation
  windDirection = 1; // +1 Eastward, -1 Westward
  windSpeed = 4.2;   // m/s
  windGust = 0.15;
  windVector = { x: 4.2, y: 0.0 };

  // Celestial bodies
  sun = {
    x: 0.72,
    y: 0.28,
    elevation: 0.45,
    intensity: 0.92,
    color: "#e37e3d",
    shadowDirX: -0.65,
    shadowLength: 1.35,
  };

  moon = {
    x: 0.24,
    y: 0.85,
    elevation: -0.35,
    phaseIndex: 2,
    phaseName: "HALF_MOON",
    illumination: 0.58,
    intensity: 0.0,
  };

  // Dynamic Lighting & Sky Palette
  lighting = {
    skyTop: "#bfc8c2",
    skyBottom: "#e5dec9",
    horizonGlow: "rgba(227, 126, 61, 0.26)",
    ambientHex: "#efe7d6",
    ambientIntensity: 0.92,
    groundTint: "#202623",
    foliageTint: "#414e46",
    shadowAlpha: 0.26,
    cloudShadowFactor: 0.0,
    lightningFlash: 0.0,
    heatHaze: 0.0,
  };

  // Coupled subsystem states
  waterState = {
    waveIntensity: 0.18,
    levelOffset: 0.0,
    rippleDensity: 0.0,
    frozenFactor: 0.0,
    reflectivity: 0.78,
  };

  vegetationState = {
    windBend: 0.12,
    wetness: 0.0,
    snowAccumulation: 0.0,
    leafFallRate: 0.05,
    flowerOpenFactor: 0.85,
    foliageColor: "#414e46",
  };

  wildlifeActivity = 0.85;
  npcActivity = 0.80;

  // Persistent World Memory (Section 29)
  memory = {
    wetness: 0.05,          // Persists after rain for puddles & wet sheen
    snowCover: 0.0,         // Persists after snowfall
    rainbowAlpha: 0.0,      // Rare post-rain rainbow
    auroraAlpha: 0.0,       // Ultra-rare deep-night aurora
    wheelTracks: [],        // Persistent mud/snow tracks [{x, y, age, kind}]
    disturbedZones: [],     // Locations where wildlife was recently startled [{x, timer}]
    lastRainEndSec: -999,
  };

  // Diagnostics & Performance Metrics (Section 45)
  stats = {
    activeEntities: 0,
    nearEntities: 0,
    midEntities: 0,
    farEntities: 0,
    activeWeatherParticles: 0,
    activeEvents: [],
    lastEventName: "NONE",
    simLoadMs: 0.12,
  };
}

// ============================================================================
// 2. TIME, SUN, MOON & STAR SYSTEM (Sections 2, 3, 4, 5, 31)
// ============================================================================
class TimeAndCelestialSystem {
  stars = [];
  skyPhenomena = []; // Pooled shooting stars, satellites, distant aircraft

  constructor(seed = 48192) {
    const rng = J0(seed + 701);
    // 110 deterministic stars across the upper sky dome
    for (let i = 0; i < 110; i++) {
      this.stars.push({
        u: rng(),
        v: rng() * 0.62,
        size: 0.8 + rng() * 1.6,
        baseAlpha: 0.35 + rng() * 0.65,
        twinkleFreq: 1.2 + rng() * 3.5,
        twinklePhase: rng() * Math.PI * 2,
        warmth: rng() < 0.25 ? "#ffd9b3" : rng() < 0.5 ? "#d8e6ff" : "#efe7d6",
      });
    }
    for (let i = 0; i < 6; i++) {
      this.skyPhenomena.push({
        active: false,
        kind: "shooting_star", // "shooting_star" | "satellite" | "aircraft" | "meteor"
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        blinkPhase: 0,
      });
    }
  }

  update(ws, dtSec) {
    const advMinutes = dtSec * ws.timeScale;
    ws.timeMinutes += advMinutes;
    if (ws.timeMinutes >= 1440) {
      ws.timeMinutes -= 1440;
      ws.dayCount++;
    }
    ws.dayProgress = ws.timeMinutes / 1440;
    const hr = ws.timeMinutes / 60;

    // Determine Phase Name
    let pName = "DAY";
    for (const p of WORLD_TIME_PHASES) {
      if (hr >= p.startHr && hr < p.endHr) {
        pName = p.name;
        break;
      }
    }
    ws.phaseName = pName;

    // Seasonal daylight length adjustment (Summer longer days, Winter shorter days)
    const seasonDayBias = ws.season === "SUMMER" ? 0.65 : ws.season === "WINTER" ? -0.65 : 0.0;
    const sunriseHr = 6.0 - seasonDayBias;
    const sunsetHr = 19.2 + seasonDayBias;

    // Sun Arc Calculation (Section 3)
    const daySpan = sunsetHr - sunriseHr;
    const sunProg = (hr - sunriseHr) / daySpan; // 0 at sunrise, 0.5 at solar noon, 1 at sunset
    const sunAngle = sunProg * Math.PI;
    const sunElev = Math.sin(sunAngle); // > 0 during day, < 0 at night

    ws.sun.elevation = b(sunElev, -1, 1);
    ws.sun.x = b(0.14 + sunProg * 0.72, 0.08, 0.92);
    ws.sun.y = b(0.68 - Math.max(-0.15, sunElev) * 0.50, 0.14, 0.85);

    const cloudDim = 1 - ws.cloudCoverage * 0.58;
    ws.sun.intensity = b(Math.max(0, sunElev) * 1.15 * cloudDim, 0, 1);

    // Sun color temperature & shadow geometry
    if (sunElev <= 0) {
      ws.sun.color = "#4b5d78";
      ws.sun.shadowDirX = 0;
      ws.sun.shadowLength = 0;
    } else if (sunElev < 0.32) {
      // Morning / Golden Hour / Sunset warm orange-gold light & long shadows
      ws.sun.color = hr < 12 ? "#f09c54" : "#e05a36";
      ws.sun.shadowDirX = hr < 12 ? -1.45 : 1.45;
      ws.sun.shadowLength = b(1.8 - sunElev * 2.5, 0.8, 2.2);
    } else {
      // Midday overhead warm-white sun & short shadows
      ws.sun.color = "#f6dfaa";
      ws.sun.shadowDirX = (sunProg - 0.5) * 1.2;
      ws.sun.shadowLength = b(0.45 + Math.abs(sunProg - 0.5) * 1.1, 0.4, 1.4);
    }

    // Moon Arc & Lunar Phases (Section 4)
    const phaseIdx = (ws.dayCount + 2) % MOON_PHASES.length;
    const mPhase = MOON_PHASES[phaseIdx];
    ws.moon.phaseIndex = phaseIdx;
    ws.moon.phaseName = mPhase.name;
    ws.moon.illumination = mPhase.illum;

    // Moon rises around 18:30 and sets around 06:30
    const nightHr = hr >= 18.0 ? hr - 18.0 : hr + 6.0;
    const moonProg = b(nightHr / 12.5, 0, 1);
    const moonElev = Math.sin(moonProg * Math.PI);
    ws.moon.elevation = ws.sun.elevation < 0.15 ? moonElev : -0.5;
    ws.moon.x = b(0.18 + moonProg * 0.64, 0.10, 0.90);
    ws.moon.y = b(0.64 - Math.max(0, moonElev) * 0.44, 0.16, 0.78);
    ws.moon.intensity =
      ws.sun.elevation < 0.08
        ? b(Math.max(0, moonElev) * mPhase.illum * (1 - ws.cloudCoverage * 0.7), 0, 0.85)
        : 0;

    // Update sky phenomena (shooting stars, satellites, aircraft)
    for (const p of this.skyPhenomena) {
      if (!p.active) continue;
      p.life += dtSec;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.blinkPhase += dtSec * 4.5;
    }
  }

  spawnPhenomenon(kind = "shooting_star") {
    const slot = this.skyPhenomena.find((s) => !s.active);
    if (!slot) return false;
    slot.active = true;
    slot.kind = kind;
    slot.life = 0;
    slot.blinkPhase = 0;

    if (kind === "shooting_star" || kind === "meteor") {
      slot.x = 0.25 + Math.random() * 0.55;
      slot.y = 0.08 + Math.random() * 0.22;
      const dir = Math.random() < 0.5 ? 1 : -1;
      slot.vx = dir * (kind === "meteor" ? 0.22 : 0.35);
      slot.vy = kind === "meteor" ? 0.14 : 0.18;
      slot.maxLife = kind === "meteor" ? 2.4 : 1.1;
    } else if (kind === "satellite") {
      slot.x = 0.05;
      slot.y = 0.12 + Math.random() * 0.25;
      slot.vx = 0.045;
      slot.vy = -0.006;
      slot.maxLife = 18.0;
    } else if (kind === "aircraft") {
      const dir = Math.random() < 0.5 ? 1 : -1;
      slot.x = dir > 0 ? 0.04 : 0.96;
      slot.y = 0.16 + Math.random() * 0.18;
      slot.vx = dir * 0.032;
      slot.vy = 0.0;
      slot.maxLife = 24.0;
    }
    return true;
  }
}

// ============================================================================
// 3. SEASON SYSTEM & PROGRESSIVE TRANSITIONS (Sections 12, 13, 44)
// ============================================================================
class SeasonSystem {
  seasonPalettes = {
    SPRING: { foliage: "#4d6b48", accent: "#6d9958", groundTop: "#36453b", tempBase: 13, leafRate: 0.12, flowerOpen: 0.95 },
    SUMMER: { foliage: "#3e593c", accent: "#587c4a", groundTop: "#313d35", tempBase: 22, leafRate: 0.04, flowerOpen: 1.00 },
    AUTUMN: { foliage: "#9e582f", accent: "#c87d32", groundTop: "#4a3b2c", tempBase: 9,  leafRate: 0.68, flowerOpen: 0.25 },
    WINTER: { foliage: "#5c696c", accent: "#a8bac2", groundTop: "#7f8f96", tempBase: -4, leafRate: 0.02, flowerOpen: 0.00 },
  };

  update(ws, dtSec, altitudeMeters = 0) {
    // Progress slowly through the 4 seasons over time, biased by high mountain altitude
    ws.seasonProgress += dtSec * 0.0045;
    if (ws.seasonProgress >= 1.0) {
      ws.seasonProgress -= 1.0;
      ws.seasonIndex = (ws.seasonIndex + 1) % SEASONS.length;
    }

    // Above 1800m / Sector 5+, alpine elevation naturally shifts local ecology toward Winter
    const curName = SEASONS[ws.seasonIndex];
    const nextName = SEASONS[(ws.seasonIndex + 1) % SEASONS.length];
    ws.season = curName;
    ws.nextSeason = nextName;

    const pCur = this.seasonPalettes[curName];
    const pNext = this.seasonPalettes[nextName];
    const blend = ws.seasonProgress;

    ws.vegetationState.foliageColor = lerpHexColor(pCur.foliage, pNext.foliage, blend);
    ws.vegetationState.leafFallRate = O0(pCur.leafRate, pNext.leafRate, blend);

    // Flowers open during daylight and close at night or in winter (Section 15)
    const daylightFactor = b((ws.sun.elevation + 0.05) * 1.6, 0, 1);
    const seasonalFlower = O0(pCur.flowerOpen, pNext.flowerOpen, blend);
    ws.vegetationState.flowerOpenFactor = seasonalFlower * daylightFactor;
  }

  cycleSeason(ws) {
    ws.seasonIndex = (ws.seasonIndex + 1) % SEASONS.length;
    ws.season = SEASONS[ws.seasonIndex];
    ws.nextSeason = SEASONS[(ws.seasonIndex + 1) % SEASONS.length];
    ws.seasonProgress = 0.15;
  }
}

// ============================================================================
// 4. GLOBAL WIND SYSTEM (Section 14)
// ============================================================================
class WindSystem {
  phase = 0;
  gustTimer = 0;
  activeGustBoost = 0;

  update(ws, dtSec, altitudeMeters = 0) {
    this.phase += dtSec;
    const wCfg = WEATHER_TYPES[ws.weather] || WEATHER_TYPES.CLEAR;
    const seasonWind = ws.season === "AUTUMN" ? 1.35 : ws.season === "WINTER" ? 1.45 : 1.0;
    const altWind = 1.0 + b(altitudeMeters / 450, 0, 0.85);

    // Multi-frequency harmonic wind + gusts
    const wave1 = Math.sin(this.phase * 0.42) * 0.35;
    const wave2 = Math.sin(this.phase * 1.35) * 0.22;
    const wave3 = Math.cos(this.phase * 3.10) * 0.12;
    this.activeGustBoost = Math.max(0, this.activeGustBoost - dtSec * 0.45);

    const gustRaw = b(0.25 + wave1 + wave2 + wave3 + this.activeGustBoost, 0.05, 1.0);
    ws.windGust = gustRaw;

    const targetSpeed = (3.8 + gustRaw * 9.5) * wCfg.windMult * seasonWind * altWind;
    ws.windSpeed = O0(ws.windSpeed, b(targetSpeed, 0.5, 32.0), Math.min(1, dtSec * 2.2));
    ws.windVector.x = ws.windSpeed * ws.windDirection;
    ws.windVector.y = Math.sin(this.phase * 0.9) * (ws.windSpeed * 0.08);

    // Vegetation bend follows global wind vector coherently
    ws.vegetationState.windBend = b((ws.windVector.x / 22.0) * (1 + ws.windGust * 0.35), -1.2, 1.2);
  }

  triggerGust(strength = 0.65) {
    this.activeGustBoost = Math.min(0.95, this.activeGustBoost + strength);
  }
}

// ============================================================================
// 5. WEATHER, CLOUDS, RAIN, THUNDERSTORM, FOG & SNOW SYSTEM (Sections 6-11, 26)
// ============================================================================
class WeatherAndAtmosphereSystem {
  clouds = [];
  precipPool = []; // Pooled raindrops, snowflakes & blowing leaves (Section 37)
  ripples = [];    // Pooled puddle/water impact ripples
  lightningTimer = 0;
  pendingThunder = []; // [{ timerSec, volume, pan }]

  constructor(seed = 48192) {
    const rng = J0(seed + 919);
    // 36 multi-layer procedural clouds (Far, Mid, Near — Section 7)
    for (let i = 0; i < 36; i++) {
      const layer = i < 12 ? 0 : i < 24 ? 1 : 2; // 0=far, 1=mid, 2=near
      this.clouds.push({
        layer,
        u: rng(), // normalized 0..1 wrap position across sky span
        y: (layer === 0 ? 0.14 : layer === 1 ? 0.21 : 0.29) + (rng() - 0.5) * 0.07,
        width: (layer === 0 ? 180 : layer === 1 ? 240 : 310) * (0.75 + rng() * 0.65),
        height: (layer === 0 ? 34 : layer === 1 ? 48 : 64) * (0.8 + rng() * 0.5),
        speedMult: layer === 0 ? 0.25 : layer === 1 ? 0.55 : 1.0,
        density: 0.4 + rng() * 0.6,
        puffs: [
          { ox: -0.28, oy: 0.08, r: 0.58 },
          { ox: 0.0,   oy: -0.12, r: 0.78 },
          { ox: 0.26,  oy: 0.05, r: 0.62 },
          { ox: 0.44,  oy: 0.14, r: 0.45 },
        ],
      });
    }

    // Object Pool of 260 atmospheric particles (rain, snow, autumn leaves, petals, dust)
    for (let i = 0; i < 260; i++) {
      this.precipPool.push({
        active: false,
        kind: "rain", // "rain" | "snow" | "leaf" | "petal"
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 2,
        angle: 0,
        vAngle: 0,
        alpha: 0.8,
        color: "#d8e6f2",
        layer: 1, // 0=background, 1=foreground
      });
    }

    // Object Pool of 45 water/puddle surface ripples
    for (let i = 0; i < 45; i++) {
      this.ripples.push({
        active: false,
        x: 0,
        y: 0,
        radius: 1,
        maxRadius: 18,
        alpha: 0.8,
      });
    }
  }

  setWeather(ws, nextType, immediate = false) {
    if (!WEATHER_TYPES[nextType]) return;
    if (ws.weather === "LIGHT_RAIN" || ws.weather === "HEAVY_RAIN" || ws.weather === "THUNDERSTORM") {
      if (!nextType.includes("RAIN") && nextType !== "THUNDERSTORM") {
        ws.memory.lastRainEndSec = performance.now() * 0.001;
      }
    }
    ws.prevWeather = immediate ? nextType : ws.weather;
    ws.targetWeather = nextType;
    ws.weatherTransition = immediate ? 1.0 : 0.0;
    const cfg = WEATHER_TYPES[nextType];
    if (immediate) {
      ws.weather = nextType;
      if (cfg.rain === 0 && cfg.snow === 0) {
        for (const p of this.precipPool) {
          if (p.kind === "rain" || p.kind === "snow") p.active = false;
        }
      }
    }
    ws.weatherDurationSec = cfg.minDur + Math.random() * (cfg.maxDur - cfg.minDur);
    ws.weatherTimerSec = 0;
  }

  pickNextNaturalWeather(ws, altitudeMeters = 0) {
    const candidates = WEATHER_TRANSITIONS[ws.weather] || ["PARTLY_CLOUDY", "CLEAR"];
    // Bias by season, temperature, humidity & altitude (Section 30)
    const isFreezing = ws.temperature <= 1.0 || ws.season === "WINTER" || altitudeMeters > 220;
    const isMorning = ws.phaseName === "SUNRISE" || ws.phaseName === "MORNING";

    if (isFreezing && (ws.weather === "OVERCAST" || ws.weather === "LIGHT_RAIN")) {
      return Math.random() < 0.7 ? "SNOW" : "OVERCAST";
    }
    if (isMorning && ws.humidity > 0.65 && Math.random() < 0.45) {
      return "MIST";
    }
    if (ws.season === "SUMMER" && ws.weather === "CLEAR" && Math.random() < 0.28) {
      return "HEATWAVE";
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  update(ws, dtSec, cam, terrain, audio, altitudeMeters = 0) {
    ws.weatherTimerSec += dtSec;
    if (ws.weatherTransition < 1.0) {
      ws.weatherTransition = Math.min(1.0, ws.weatherTransition + dtSec * 0.12);
      if (ws.weatherTransition >= 1.0) {
        ws.weather = ws.targetWeather;
      }
    } else if (ws.weatherTimerSec >= ws.weatherDurationSec) {
      const nextW = this.pickNextNaturalWeather(ws, altitudeMeters);
      this.setWeather(ws, nextW);
    }

    const curCfg = WEATHER_TYPES[ws.prevWeather] || WEATHER_TYPES.CLEAR;
    const tgtCfg = WEATHER_TYPES[ws.targetWeather] || WEATHER_TYPES.CLEAR;
    const u = ws.weatherTransition;

    ws.cloudCoverage = O0(curCfg.cloud, tgtCfg.cloud, u);
    ws.rainIntensity = O0(curCfg.rain, tgtCfg.rain, u);
    ws.snowIntensity = O0(curCfg.snow, tgtCfg.snow, u);
    ws.precipitation = Math.max(ws.rainIntensity, ws.snowIntensity);
    ws.humidity = O0(curCfg.hum, tgtCfg.hum, u);
    ws.visibility = O0(curCfg.vis, tgtCfg.vis, u);

    // Morning ground fog bonus (Section 10: heavy near ground at sunrise, dissipates after morning)
    const morningFogBonus =
      ws.phaseName === "SUNRISE" ? 0.28 : ws.phaseName === "MORNING" ? 0.14 : 0.0;
    ws.fogDensity = b(O0(curCfg.fog, tgtCfg.fog, u) + morningFogBonus, 0.02, 0.92);

    // Temperature calculation from Season + TimeOfDay + Altitude + Weather
    const seasonBase =
      ws.season === "SUMMER" ? 21 : ws.season === "SPRING" ? 13 : ws.season === "AUTUMN" ? 9 : -3;
    const diurnalSwing = Math.sin((ws.dayProgress - 0.22) * Math.PI * 2) * 5.5;
    const altDrop = altitudeMeters * 0.085;
    const weatherChill = ws.rainIntensity * -3.5 + ws.snowIntensity * -7.0 + (ws.targetWeather === "HEATWAVE" ? 8.5 : 0);
    ws.temperature = O0(ws.temperature, seasonBase + diurnalSwing - altDrop + weatherChill, Math.min(1, dtSec * 1.5));

    // World Memory: Puddle Wetness & Snow Accumulation (Sections 8, 11, 29)
    if (ws.rainIntensity > 0.05) {
      ws.memory.wetness = b(ws.memory.wetness + ws.rainIntensity * dtSec * 0.045, 0, 1);
    } else {
      const dryRate = (0.006 + Math.max(0, ws.sun.intensity) * 0.012) * dtSec;
      ws.memory.wetness = b(ws.memory.wetness - dryRate, 0, 1);
    }

    if (ws.snowIntensity > 0.05 || (ws.season === "WINTER" && ws.temperature < 0)) {
      const accRate = (ws.snowIntensity * 0.05 + 0.008) * dtSec;
      ws.memory.snowCover = b(ws.memory.snowCover + accRate, 0, 1);
    } else if (ws.temperature > 2.5) {
      ws.memory.snowCover = b(ws.memory.snowCover - dtSec * 0.012, 0, 1);
    }

    ws.vegetationState.wetness = ws.memory.wetness;
    ws.vegetationState.snowAccumulation = ws.memory.snowCover;

    // Rainbow condition (Section 26: After rain + sunlight + sufficient humidity)
    const rainbowEligible =
      ws.memory.wetness > 0.22 &&
      ws.rainIntensity < 0.35 &&
      ws.sun.elevation > 0.06 &&
      ws.sun.elevation < 0.62 &&
      ws.humidity > 0.42;
    const targetRainbow = rainbowEligible ? 0.72 : 0.0;
    ws.memory.rainbowAlpha = O0(ws.memory.rainbowAlpha, targetRainbow, Math.min(1, dtSec * 0.4));

    // Ultra-Rare Aurora Borealis condition (Deep Night + Cold/Clear)
    const auroraEligible =
      (ws.phaseName === "NIGHT" || ws.phaseName === "DEEP_NIGHT") &&
      ws.cloudCoverage < 0.45 &&
      ws.temperature < 4.0;
    ws.memory.auroraAlpha = O0(ws.memory.auroraAlpha, auroraEligible ? 0.55 : 0.0, Math.min(1, dtSec * 0.3));

    // Update 3-layer clouds & compute overhead cloud shadow (Section 7 & 33)
    let overheadShadow = 0;
    const windMove = (ws.windVector.x * 0.00085) * dtSec;
    for (const c of this.clouds) {
      c.u = (c.u + windMove * c.speedMult + 10.0) % 1.0;
      c.x = c.u * 2400;
      const distCenter = Math.abs(c.u - 0.5);
      if (distCenter < 0.14 && c.layer >= 1) {
        overheadShadow = Math.max(overheadShadow, (1 - distCenter / 0.14) * c.density * ws.cloudCoverage);
      }
    }
    ws.lighting.cloudShadowFactor = O0(ws.lighting.cloudShadowFactor, b(overheadShadow, 0, 0.65), Math.min(1, dtSec * 2.5));

    // Thunderstorm Lightning & Distance-Delayed Thunder (Section 9)
    ws.lighting.lightningFlash = Math.max(0, ws.lighting.lightningFlash - dtSec * 4.2);
    if (ws.targetWeather === "THUNDERSTORM" || ws.weather === "THUNDERSTORM") {
      this.lightningTimer -= dtSec;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 4.5 + Math.random() * 8.5;
        this.triggerLightning(ws);
      }
    }

    for (let i = this.pendingThunder.length - 1; i >= 0; i--) {
      const th = this.pendingThunder[i];
      th.timerSec -= dtSec;
      if (th.timerSec <= 0) {
        this.pendingThunder.splice(i, 1);
        if (audio && typeof audio.playThunder === "function") {
          audio.playThunder(th.volume);
        }
      }
    }

    // Spawn & update pooled precipitation / leaves around camera
    this.updatePrecipitation(ws, dtSec, cam, terrain);
  }

  triggerLightning(ws) {
    ws.lighting.lightningFlash = 0.85 + Math.random() * 0.15;
    // Distance 0.4km to 2.8km -> sound delay 1.1s to 8.0s
    const distKm = 0.4 + Math.random() * 2.4;
    const delaySec = distKm * 2.8;
    const volume = b(1.1 - distKm * 0.32, 0.25, 0.95);
    this.pendingThunder.push({ timerSec: delaySec, volume });
  }

  updatePrecipitation(ws, dtSec, cam, terrain) {
    if (!cam) return;
    const spanX = 1400;
    const spanY = 900;

    // Determine desired active counts from current weather & season
    const targetRain = Math.round(ws.rainIntensity * 165);
    const targetSnow = Math.round(ws.snowIntensity * 145);
    const targetLeaves = ws.rainIntensity < 0.5 ? Math.round(ws.vegetationState.leafFallRate * 28) : 0;

    let curRain = 0, curSnow = 0, curLeaves = 0;
    for (const p of this.precipPool) {
      if (!p.active) continue;
      if (p.kind === "rain") curRain++;
      else if (p.kind === "snow") curSnow++;
      else curLeaves++;
    }

    const spawnParticle = (kind) => {
      const slot = this.precipPool.find((s) => !s.active);
      if (!slot) return;
      slot.active = true;
      slot.kind = kind;
      slot.layer = Math.random() < 0.35 ? 0 : 1;
      slot.x = cam.x + (Math.random() - 0.5) * spanX * 1.35 - ws.windVector.x * 18;
      slot.y = cam.y - spanY * 0.65 - Math.random() * 120;
      if (kind === "rain") {
        slot.vx = ws.windVector.x * 16 + (Math.random() - 0.5) * 20;
        slot.vy = 560 + ws.rainIntensity * 240 + Math.random() * 90;
        slot.size = slot.layer === 1 ? 14 + Math.random() * 10 : 9 + Math.random() * 6;
        slot.alpha = slot.layer === 1 ? 0.52 : 0.28;
        slot.color = "rgba(205, 224, 238, 0.68)";
      } else if (kind === "snow") {
        slot.vx = ws.windVector.x * 11 + (Math.random() - 0.5) * 24;
        slot.vy = 75 + Math.random() * 55;
        slot.size = slot.layer === 1 ? 2.6 + Math.random() * 2.4 : 1.6 + Math.random() * 1.4;
        slot.alpha = slot.layer === 1 ? 0.82 : 0.48;
        slot.color = "#f2f6fa";
      } else {
        // Drifting leaf or spring blossom petal
        slot.vx = ws.windVector.x * 9 + (Math.random() - 0.5) * 18;
        slot.vy = 38 + Math.random() * 32;
        slot.size = 3.5 + Math.random() * 2.8;
        slot.angle = Math.random() * Math.PI * 2;
        slot.vAngle = (Math.random() - 0.5) * 4.5;
        slot.alpha = 0.88;
        slot.color =
          ws.season === "SPRING"
            ? (Math.random() < 0.5 ? "#f2c6d0" : "#7fa668")
            : (Math.random() < 0.5 ? "#d4622a" : "#d89b3c");
      }
    };

    const maxSpawnsPerFrame = 18;
    let spawned = 0;
    while (curRain < targetRain && spawned < maxSpawnsPerFrame) { spawnParticle("rain"); curRain++; spawned++; }
    while (curSnow < targetSnow && spawned < maxSpawnsPerFrame) { spawnParticle("snow"); curSnow++; spawned++; }
    while (curLeaves < targetLeaves && spawned < maxSpawnsPerFrame) { spawnParticle("leaf"); curLeaves++; spawned++; }

    let activeCount = 0;
    for (const p of this.precipPool) {
      if (!p.active) continue;
      activeCount++;

      if (p.kind === "snow" || p.kind === "leaf") {
        p.vx = O0(p.vx, ws.windVector.x * 11 + Math.sin(performance.now() * 0.003 + p.x * 0.02) * 18, dtSec * 2);
        p.angle += (p.vAngle || 1.5) * dtSec;
      }

      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;

      const groundY = terrain ? terrain.heightAt(p.x) : cam.y + 300;
      if (p.y >= groundY) {
        p.active = false;
        if (p.kind === "rain" && Math.random() < 0.35) {
          this.spawnRipple(p.x, groundY - 1, 6 + Math.random() * 8);
        }
      } else if (Math.abs(p.x - cam.x) > spanX || p.y > cam.y + spanY * 0.75) {
        p.active = false;
      }
    }
    ws.stats.activeWeatherParticles = activeCount;

    // Update puddle/water ripples
    for (const r of this.ripples) {
      if (!r.active) continue;
      r.radius += dtSec * 26;
      r.alpha = b(1 - r.radius / r.maxRadius, 0, 1) * 0.65;
      if (r.radius >= r.maxRadius) r.active = false;
    }
  }

  spawnRipple(xPos, yPos, maxR = 14) {
    const slot = this.ripples.find((r) => !r.active);
    if (!slot) return;
    slot.active = true;
    slot.x = xPos;
    slot.y = yPos;
    slot.radius = 1.5;
    slot.maxRadius = maxR;
    slot.alpha = 0.65;
  }
}

// ============================================================================
// 6. DYNAMIC LIGHTING ENGINE (Sections 32, 33, 44)
// ============================================================================
class LightingSystem {
  update(ws, biome) {
    const baseTop = biome?.skyTop || "#bfc8c2";
    const baseBot = biome?.skyBottom || "#e5dec9";
    const sunElev = ws.sun.elevation;
    const hr = ws.timeMinutes / 60;

    // Compute time-of-day sky palette (Sunrise -> Day -> Golden Hour -> Sunset -> Night)
    let timeTop = baseTop;
    let timeBot = baseBot;
    let ambIntensity = 0.92;

    if (sunElev <= -0.18) {
      // Deep Night / Night
      timeTop = "#0d131a";
      timeBot = "#1c2733";
      ambIntensity = 0.28 + ws.moon.intensity * 0.22;
    } else if (sunElev < 0.08) {
      // Sunrise / Sunset Twilight transition
      const t = b((sunElev + 0.18) / 0.26, 0, 1);
      const duskTop = hr < 12 ? "#3b475e" : "#2f2c44";
      const duskBot = hr < 12 ? "#e08e55" : "#d45b3e";
      timeTop = lerpHexColor("#0d131a", duskTop, t);
      timeBot = lerpHexColor("#1c2733", duskBot, t);
      ambIntensity = 0.35 + t * 0.38;
    } else if (sunElev < 0.35) {
      // Morning / Golden Hour
      const t = b((sunElev - 0.08) / 0.27, 0, 1);
      const goldTop = hr < 12 ? "#83969c" : "#6e7c85";
      const goldBot = hr < 12 ? "#ebcba4" : "#e39868";
      timeTop = lerpHexColor(goldTop, baseTop, t);
      timeBot = lerpHexColor(goldBot, baseBot, t);
      ambIntensity = 0.72 + t * 0.22;
    } else {
      // Full Daylight
      timeTop = baseTop;
      timeBot = baseBot;
      ambIntensity = 0.96;
    }

    // Darken & desaturate during storms / heavy overcast
    const stormDarken = b(ws.cloudCoverage * 0.48 + ws.rainIntensity * 0.25, 0, 0.68);
    timeTop = lerpHexColor(timeTop, "#2b3336", stormDarken);
    timeBot = lerpHexColor(timeBot, "#465054", stormDarken);

    // Apply cloud shadow and brief lightning flash illumination
    const cloudDim = ws.lighting.cloudShadowFactor * 0.22;
    const flash = ws.lighting.lightningFlash;
    ws.lighting.skyTop = flash > 0.05 ? lerpHexColor(timeTop, "#e8f0f8", flash * 0.75) : timeTop;
    ws.lighting.skyBottom = flash > 0.05 ? lerpHexColor(timeBot, "#ffffff", flash * 0.85) : timeBot;
    ws.lighting.ambientIntensity = b(ambIntensity - cloudDim + flash * 0.65, 0.20, 1.25);
    ws.lighting.shadowAlpha = b(ws.sun.intensity * (1 - ws.cloudCoverage * 0.75) * 0.34, 0.04, 0.38);
    ws.lighting.heatHaze = ws.targetWeather === "HEATWAVE" && sunElev > 0.25 ? 0.65 : 0.0;
  }
}

// ============================================================================
// 7. VEGETATION, WATER & SMOKE SYSTEMS (Sections 15, 16, 22, 28)
// ============================================================================
class WorldEnvironmentDetailSystem {
  waterBodies = []; // Alpine tarns / streams in terrain valley basins
  smokeSources = [];
  smokeParticles = [];

  constructor() {
    for (let i = 0; i < 55; i++) {
      this.smokeParticles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 4,
        maxRadius: 24,
        life: 0,
        maxLife: 3.0,
        alpha: 0.4,
        color: "rgba(215, 212, 204, 0.35)",
      });
    }
  }

  initForTerrain(terrain) {
    this.waterBodies.length = 0;
    this.smokeSources.length = 0;
    if (!terrain || !terrain.samples) return;

    // Identify natural valley depressions for alpine tarns / creeks & rain puddles
    const step = 38;
    for (let i = 45; i < terrain.samples.length - 45; i += step) {
      const s = terrain.samples[i];
      const sLeft = terrain.samples[i - 16];
      const sRight = terrain.samples[i + 16];
      if (!s || !sLeft || !sRight) continue;
      // Local concave basin where edges are higher (smaller Y) than center
      if (s.y > sLeft.y + 6 && s.y > sRight.y + 6 && Math.abs(s.slope) < 0.14) {
        const width = 110 + ((i * 37) % 95);
        this.waterBodies.push({
          x: s.x,
          y: s.y - 3,
          width,
          depth: 9 + ((i * 13) % 8),
          isPermanentTarn: i % (step * 3) === 0,
          fishTimer: 1.5 + (i % 5),
        });
      }
    }

    // Guarantee a scenic alpine tarn near Base Camp (x ~ 860) so standing still at start or driving 15m shows water right away
    const nearStartX = 860;
    const nearStartY = terrain.heightAt(nearStartX);
    this.waterBodies.unshift({
      x: nearStartX,
      y: nearStartY - 2,
      width: 150,
      depth: 10,
      isPermanentTarn: true,
      fishTimer: 2.0,
    });

    // Register environmental smoke sources at landmarks (Chimneys, Campfires, Mine Pithead)
    if (typeof BIOMES !== "undefined") {
      for (const bItem of BIOMES) {
        if (!bItem.landmark) continue;
        const lx = bItem.landmark.x;
        const ly = terrain.heightAt(lx);
        if (bItem.landmark.type === "shelter") {
          this.smokeSources.push({ x: lx - 12, y: ly - 135, kind: "chimney", rate: 0.22, timer: 0 });
        } else if (bItem.landmark.type === "pithead") {
          this.smokeSources.push({ x: lx + 18, y: ly - 68, kind: "industrial", rate: 0.16, timer: 0 });
        } else if (bItem.landmark.type === "cairn") {
          this.smokeSources.push({ x: lx + 28, y: ly - 8, kind: "campfire", rate: 0.26, timer: 0 });
        }
      }
    }
  }

  update(ws, dtSec, cam, vehicle, weatherSys) {
    // Update Water State (Section 16)
    ws.waterState.waveIntensity = b(ws.windSpeed / 18.0 + ws.rainIntensity * 0.45, 0.08, 1.0);
    ws.waterState.levelOffset = ws.memory.wetness * 4.5;
    ws.waterState.frozenFactor = ws.temperature < -1.5 ? b((-1.5 - ws.temperature) / 6.0, 0, 1) : 0;
    ws.waterState.reflectivity = b(0.85 - ws.waterState.waveIntensity * 0.45, 0.25, 0.92);

    // Check player vehicle interaction with water bodies / puddles (Section 27 & 42)
    if (vehicle && vehicle.chassis) {
      const vx = vehicle.chassis.position.x;
      const vy = vehicle.chassis.position.y;
      const speed = Math.hypot(vehicle.chassis.velocity.x, vehicle.chassis.velocity.y);

      for (const wb of this.waterBodies) {
        if (!wb.isPermanentTarn && ws.memory.wetness < 0.22) continue;
        if (Math.abs(vx - wb.x) < wb.width * 0.55 && Math.abs(vy - wb.y) < 58) {
          if (speed > 1.2 && Math.random() < 0.45) {
            weatherSys.spawnRipple(vx, wb.y, 18 + speed * 1.6);
          }
        }
        // Occasional fish jumping ring in permanent alpine tarns (Section 25 & 28)
        if (wb.isPermanentTarn && Math.abs((cam?.x || 0) - wb.x) < 950 && ws.waterState.frozenFactor < 0.3) {
          wb.fishTimer -= dtSec;
          if (wb.fishTimer <= 0) {
            wb.fishTimer = 5.0 + Math.random() * 9.0;
            weatherSys.spawnRipple(wb.x + (Math.random() - 0.5) * wb.width * 0.6, wb.y, 22);
          }
        }
      }

      // Record persistent mud/snow wheel tracks when grounded (Section 29)
      if ((ws.memory.wetness > 0.25 || ws.memory.snowCover > 0.2) && speed > 0.8 && !vehicle.airborne) {
        const lastTrack = ws.memory.wheelTracks[ws.memory.wheelTracks.length - 1];
        if (!lastTrack || Math.abs(lastTrack.x - vx) > 24) {
          ws.memory.wheelTracks.push({
            x: vx,
            y: vy + 22,
            age: 0,
            kind: ws.memory.snowCover > 0.25 ? "snow" : "mud",
          });
          if (ws.memory.wheelTracks.length > 90) ws.memory.wheelTracks.shift();
        }
      }
    }

    for (let i = ws.memory.wheelTracks.length - 1; i >= 0; i--) {
      ws.memory.wheelTracks[i].age += dtSec;
      if (ws.memory.wheelTracks[i].age > 45) ws.memory.wheelTracks.splice(i, 1);
    }

    // Update Smoke Sources & Pooled Smoke Plumes (Section 22)
    for (const src of this.smokeSources) {
      if (cam && Math.abs(src.x - cam.x) > 1600) continue;
      src.timer += dtSec;
      if (src.timer >= src.rate) {
        src.timer = 0;
        const p = this.smokeParticles.find((s) => !s.active);
        if (p) {
          p.active = true;
          p.x = src.x + (Math.random() - 0.5) * 4;
          p.y = src.y;
          p.vx = ws.windVector.x * 3.2 + (Math.random() - 0.5) * 4;
          p.vy = -18 - Math.random() * 10;
          p.radius = src.kind === "industrial" ? 6 : 4;
          p.maxRadius = src.kind === "industrial" ? 32 : 22;
          p.life = 0;
          p.maxLife = 2.6 + Math.random() * 1.4;
          p.alpha = src.kind === "industrial" ? 0.38 : 0.30;
          p.color = src.kind === "industrial" ? "rgba(95, 102, 106, 0.38)" : "rgba(225, 220, 210, 0.34)";
        }
      }
    }

    for (const p of this.smokeParticles) {
      if (!p.active) continue;
      p.life += dtSec;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      const u = p.life / p.maxLife;
      p.vx = O0(p.vx, ws.windVector.x * 4.8, dtSec * 1.8);
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.radius = O0(4, p.maxRadius, u);
      p.alpha = (1 - u) * 0.32;
    }
  }
}

// ============================================================================
// 8. AUTONOMOUS WILDLIFE, BOIDS BIRD FLOCKS & INSECT SYSTEM (Sections 17-21, 35, 42)
// ============================================================================
class WildlifeSystem {
  boids = [];          // Near & Mid bird boids with Separation, Alignment, Cohesion
  distantFlocks = [];  // Far LOD migratory V-flocks
  animals = [];        // Ground wildlife (Deer, Ibex, Rabbits, Frogs) with 8-state machine
  insects = [];        // Pooled Fireflies, Butterflies, Bees, Dragonflies, Moths

  constructor(seed = 48192) {
    const rng = J0(seed + 1337);
    // 28 Bird Boids (Near & Mid LOD)
    for (let i = 0; i < 28; i++) {
      this.boids.push({
        id: i,
        x: 200 + rng() * 1400,
        y: 260 + rng() * 180,
        vx: (rng() - 0.5) * 65,
        vy: (rng() - 0.5) * 18,
        state: rng() < 0.3 ? "PERCHED" : "FLYING", // "FLYING" | "PERCHED" | "SCATTER" | "FOREGROUND_PASS"
        perchTimer: 2 + rng() * 6,
        wingPhase: rng() * Math.PI * 2,
        lod: i < 16 ? "NEAR" : "MID",
        scale: i < 16 ? 1.0 : 0.62,
      });
    }

    // 4 Distant Migratory V-Flocks (Far LOD — Section 18 & 35)
    for (let i = 0; i < 4; i++) {
      this.distantFlocks.push({
        active: i < 2,
        x: 400 + i * 650,
        y: 150 + i * 35,
        vx: 38 + i * 8,
        count: 7 + (i % 5) * 2,
        phase: i * 1.4,
      });
    }

    // 14 Ground Animals across local window (Deer, Ibex, Rabbits, Frogs — Section 19)
    const speciesList = ["DEER", "RABBIT", "DEER", "RABBIT", "IBEX", "FROG"];
    for (let i = 0; i < 14; i++) {
      const sp = speciesList[i % speciesList.length];
      this.animals.push({
        id: i,
        species: sp,
        x: 360 + i * 260,
        y: 500,
        vx: 0,
        dir: i % 2 === 0 ? 1 : -1,
        state: "FEED", // "IDLE" | "WANDER" | "FEED" | "ALERT" | "FLEE" | "REST" | "SLEEP" | "MIGRATE"
        stateTimer: 2 + rng() * 5,
        headAngle: 0,
        legPhase: rng() * Math.PI * 2,
        alertLevel: 0,
      });
    }

    // 42 Pooled Insects (Fireflies, Butterflies, Bees, Dragonflies — Section 21)
    for (let i = 0; i < 42; i++) {
      this.insects.push({
        active: true,
        kind: i % 3 === 0 ? "FIREFLY" : i % 3 === 1 ? "BUTTERFLY" : "DRAGONFLY",
        x: 220 + rng() * 1200,
        y: 420 + rng() * 120,
        vx: (rng() - 0.5) * 25,
        vy: (rng() - 0.5) * 15,
        phase: rng() * Math.PI * 2,
        glow: 0.5,
      });
    }
  }

  triggerMassFlock(camX, camY) {
    for (const f of this.distantFlocks) {
      f.active = true;
      f.x = camX - 650 + Math.random() * 220;
      f.y = camY - 290 - Math.random() * 90;
      f.vx = 65 + Math.random() * 25;
      f.count = 13;
    }
    // Also launch perched boids
    for (const bItem of this.boids) {
      if (bItem.state === "PERCHED") {
        bItem.state = "FLYING";
        bItem.vy = -45 - Math.random() * 25;
      }
    }
  }

  triggerForegroundBird(camX, camY) {
    const bItem = this.boids[0];
    if (!bItem) return;
    bItem.state = "FOREGROUND_PASS";
    bItem.x = camX - 520;
    bItem.y = camY - 140;
    bItem.vx = 210;
    bItem.vy = -12;
    bItem.scale = 2.15;
  }

  update(ws, dtSec, cam, terrain, vehicle) {
    if (!cam || !terrain) return;
    const camX = cam.x;
    const camY = cam.y;
    const vehX = vehicle?.chassis?.position?.x ?? camX;
    const vehY = vehicle?.chassis?.position?.y ?? camY;
    const vehSpeed = vehicle ? Math.hypot(vehicle.chassis.velocity.x, vehicle.chassis.velocity.y) * 7.2 : 0;

    // 1. Compute Wildlife Activity Factor from Time, Weather & Season (Section 20)
    const isStorm = ws.rainIntensity > 0.55 || ws.snowIntensity > 0.65 || ws.weather === "THUNDERSTORM";
    const isNight = ws.sun.elevation < -0.05;
    const isMorningOrEvening = ws.phaseName === "SUNRISE" || ws.phaseName === "MORNING" || ws.phaseName === "GOLDEN_HOUR";
    ws.wildlifeActivity = isStorm ? 0.15 : isMorningOrEvening ? 1.0 : isNight ? 0.35 : 0.72;

    let nearCount = 0, midCount = 0, farCount = 0;

    // 2. Update Bird Boids (Separation + Alignment + Cohesion — Section 18)
    for (let i = 0; i < this.boids.length; i++) {
      const bItem = this.boids[i];
      if (bItem.lod === "NEAR") nearCount++;
      else midCount++;

      // Recycle boids that drift far outside camera window
      if (Math.abs(bItem.x - camX) > 1350) {
        bItem.x = camX + (bItem.vx >= 0 ? -950 : 950) + (Math.random() - 0.5) * 200;
        bItem.y = terrain.heightAt(bItem.x) - 140 - Math.random() * 140;
        if (bItem.state === "FOREGROUND_PASS") {
          bItem.state = "FLYING";
          bItem.scale = bItem.lod === "NEAR" ? 1.0 : 0.62;
        }
      }

      const distToPlayer = Math.hypot(bItem.x - vehX, bItem.y - vehY);

      if (bItem.state === "PERCHED") {
        const groundY = terrain.heightAt(bItem.x);
        bItem.y = groundY - 6;
        bItem.vx = 0;
        bItem.vy = 0;
        bItem.perchTimer -= dtSec;
        // Scatter if player approaches fast or honks/impacts
        if ((distToPlayer < 190 && vehSpeed > 18) || bItem.perchTimer <= 0 || isStorm) {
          bItem.state = distToPlayer < 190 ? "SCATTER" : "FLYING";
          bItem.vx = (bItem.x >= vehX ? 1 : -1) * (65 + Math.random() * 45);
          bItem.vy = -55 - Math.random() * 35;
        }
        continue;
      }

      // Flocking forces for flying boids
      let sepX = 0, sepY = 0;
      let alignX = 0, alignY = 0;
      let cohX = 0, cohY = 0;
      let neighbors = 0;

      for (let j = 0; j < this.boids.length; j++) {
        if (i === j) continue;
        const other = this.boids[j];
        if (other.state === "PERCHED") continue;
        const dx = other.x - bItem.x;
        const dy = other.y - bItem.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 140) {
          neighbors++;
          alignX += other.vx;
          alignY += other.vy;
          cohX += other.x;
          cohY += other.y;
          if (d < 42) {
            sepX -= dx / d;
            sepY -= dy / d;
          }
        }
      }

      if (neighbors > 0 && bItem.state !== "FOREGROUND_PASS") {
        alignX /= neighbors;
        alignY /= neighbors;
        cohX = cohX / neighbors - bItem.x;
        cohY = cohY / neighbors - bItem.y;

        bItem.vx += (sepX * 28 + (alignX - bItem.vx) * 1.8 + cohX * 0.65 + ws.windVector.x * 1.4) * dtSec;
        bItem.vy += (sepY * 28 + (alignY - bItem.vy) * 1.8 + cohY * 0.65) * dtSec;
      }

      // Keep birds above terrain and within sky band
      const groundY = terrain.heightAt(bItem.x);
      const minSkyY = groundY - 340;
      const maxSkyY = groundY - 55;
      if (bItem.y > maxSkyY) bItem.vy -= 95 * dtSec;
      else if (bItem.y < minSkyY) bItem.vy += 65 * dtSec;

      // Player disturbance scatter
      if (distToPlayer < 165 && vehSpeed > 25) {
        bItem.vx += (bItem.x >= vehX ? 1 : -1) * 140 * dtSec;
        bItem.vy -= 110 * dtSec;
      }

      // Clamp boid speed
      const maxSpd = bItem.state === "FOREGROUND_PASS" ? 230 : bItem.state === "SCATTER" ? 135 : 88;
      const spd = Math.hypot(bItem.vx, bItem.vy);
      if (spd > maxSpd) {
        bItem.vx = (bItem.vx / spd) * maxSpd;
        bItem.vy = (bItem.vy / spd) * maxSpd;
      } else if (spd < 35) {
        bItem.vx = (bItem.vx >= 0 ? 1 : -1) * 42;
      }

      bItem.x += bItem.vx * dtSec;
      bItem.y += bItem.vy * dtSec;
      bItem.wingPhase += dtSec * (9.5 + spd * 0.06);

      // Occasional landing on terrain/trees when calm and player is far or still
      if (
        bItem.state === "FLYING" &&
        !isStorm &&
        distToPlayer > 240 &&
        Math.abs(bItem.y - groundY) < 68 &&
        Math.random() < 0.004
      ) {
        bItem.state = "PERCHED";
        bItem.perchTimer = 4 + Math.random() * 8;
      }
    }

    // 3. Update Far Migratory V-Flocks
    for (const f of this.distantFlocks) {
      if (!f.active) continue;
      farCount += f.count;
      f.x += (f.vx + ws.windVector.x * 1.5) * dtSec;
      f.phase += dtSec * 6.5;
      if (Math.abs(f.x - camX) > 1500) {
        f.x = camX - 1100;
        f.y = camY - 220 - Math.random() * 110;
      }
    }

    // 4. Update Ground Animals (IDLE, WANDER, FEED, ALERT, FLEE, REST, SLEEP — Section 19)
    for (const a of this.animals) {
      nearCount++;
      // Keep animal window streaming ahead/around vehicle/camera
      if (a.x < vehX - 1100) {
        a.x = vehX + 750 + Math.random() * 450;
        a.state = isNight ? "SLEEP" : "FEED";
        a.alertLevel = 0;
      } else if (a.x > vehX + 1450) {
        a.x = vehX - 750 - Math.random() * 250;
      }

      const distToVeh = Math.abs(a.x - vehX);
      a.stateTimer -= dtSec;

      // Player proximity reaction chain: FEED -> ALERT -> FLEE (+ startle nearby birds!)
      if (distToVeh < 260 && (vehSpeed > 14 || distToVeh < 120)) {
        const prevState = a.state;
        if (a.state !== "FLEE" && a.state !== "ALERT") {
          a.state = distToVeh < 135 ? "FLEE" : "ALERT";
          a.stateTimer = a.state === "ALERT" ? 0.55 : 3.2;
          a.dir = a.x >= vehX ? 1 : -1;
        } else if (a.state === "ALERT" && (a.stateTimer <= 0 || distToVeh < 130)) {
          a.state = "FLEE";
          a.stateTimer = 3.5;
          a.dir = a.x >= vehX ? 1 : -1;
        }
        if (a.state === "FLEE" && prevState !== "FLEE") {
          // Emergent chain: fleeing deer startles nearby perched birds! (Section 19)
          for (const bItem of this.boids) {
            if (bItem.state === "PERCHED" && Math.abs(bItem.x - a.x) < 220) {
              bItem.state = "SCATTER";
              bItem.vx = a.dir * 95;
              bItem.vy = -75;
            }
          }
        }
      }

      if (a.state === "FLEE") {
        const fleeSpd = a.species === "DEER" || a.species === "IBEX" ? 135 : 95;
        a.vx = a.dir * fleeSpd;
        a.legPhase += dtSec * 16.0;
        a.headAngle = -0.25;
        if (a.stateTimer <= 0 && distToVeh > 340) {
          a.state = "WANDER";
          a.stateTimer = 3.0;
        }
      } else if (a.state === "ALERT") {
        a.vx = 0;
        a.headAngle = -0.45; // Head raised looking toward player
      } else if (a.state === "WANDER" || a.state === "MIGRATE") {
        a.vx = a.dir * (a.species === "RABBIT" ? 28 : 36);
        a.legPhase += dtSec * 6.5;
        a.headAngle = 0.0;
        if (a.stateTimer <= 0) {
          a.state = isNight ? "SLEEP" : isStorm ? "REST" : "FEED";
          a.stateTimer = 3 + Math.random() * 5;
        }
      } else if (a.state === "SLEEP" || a.state === "REST") {
        a.vx = 0;
        a.headAngle = 0.35;
        if (!isNight && !isStorm && a.stateTimer <= 0) {
          a.state = "FEED";
          a.stateTimer = 4 + Math.random() * 5;
        }
      } else {
        // FEED / IDLE
        a.vx = 0;
        a.headAngle = 0.42 + Math.sin(performance.now() * 0.004 + a.id) * 0.12;
        if (a.stateTimer <= 0) {
          if (isNight) {
            a.state = "SLEEP";
            a.stateTimer = 8.0;
          } else {
            a.state = Math.random() < 0.55 ? "WANDER" : "IDLE";
            a.dir = Math.random() < 0.5 ? 1 : -1;
            a.stateTimer = 2.5 + Math.random() * 4.5;
          }
        }
      }

      a.x += a.vx * dtSec;
      a.y = terrain.heightAt(a.x);
    }

    // 5. Update Insects (Fireflies at dusk/night, Butterflies/Bees/Dragonflies by day — Section 21)
    const wantFireflies = ws.sun.elevation < 0.12 && ws.rainIntensity < 0.35 && ws.season !== "WINTER";
    const wantDayInsects = ws.sun.elevation >= 0.08 && ws.rainIntensity < 0.2 && ws.season !== "WINTER";

    for (let i = 0; i < this.insects.length; i++) {
      const ins = this.insects[i];
      if (wantFireflies) ins.kind = "FIREFLY";
      else if (wantDayInsects) ins.kind = i % 2 === 0 ? "BUTTERFLY" : "DRAGONFLY";
      ins.active = wantFireflies || wantDayInsects;
      if (!ins.active) continue;

      nearCount++;
      ins.phase += dtSec * 5.2;
      ins.glow = 0.45 + 0.55 * Math.sin(ins.phase * 0.85);
      ins.vx = ws.windVector.x * 1.8 + Math.cos(ins.phase * 0.7 + i) * 22;
      ins.vy = Math.sin(ins.phase * 1.3 + i) * 16;
      ins.x += ins.vx * dtSec;
      ins.y += ins.vy * dtSec;

      if (Math.abs(ins.x - camX) > 780) {
        ins.x = camX + (Math.random() - 0.5) * 1100;
      }
      const gy = terrain.heightAt(ins.x);
      ins.y = b(ins.y, gy - 95, gy - 14);
    }

    ws.stats.nearEntities = nearCount;
    ws.stats.midEntities = midCount;
    ws.stats.farEntities = farCount;
    ws.stats.activeEntities = nearCount + midCount + farCount;
  }
}

// ============================================================================
// 9. AUTONOMOUS NPC & MOUNTAIN TRAFFIC SYSTEM (Sections 23, 24, 27)
// ============================================================================
class NPCAndTrafficSystem {
  npcs = [];           // Hikers, Cyclists, Photographers, Mine Workers, Anglers
  ridgeVehicles = [];  // Distant expedition trucks, patrol crawlers, buses on background ridge road

  constructor(seed = 48192) {
    const rng = J0(seed + 2029);
    const roles = ["HIKER", "CYCLIST", "PHOTOGRAPHER", "WORKER", "HIKER", "ANGLER"];
    for (let i = 0; i < 10; i++) {
      this.npcs.push({
        id: i,
        role: roles[i % roles.length],
        x: 420 + i * 380,
        y: 500,
        dir: i % 2 === 0 ? 1 : -1,
        speed: roles[i % roles.length] === "CYCLIST" ? 48 : 16,
        phase: rng() * Math.PI * 2,
        hasUmbrella: false,
        photoFlashTimer: 3 + rng() * 6,
      });
    }

    // 5 Background Ridge Road Vehicles (Section 24: Supply Truck, Patrol Crawler, Mountain Bus, Rescue Rig)
    const vTypes = ["SUPPLY_TRUCK", "PATROL_CRAWLER", "MOUNTAIN_BUS", "RESCUE_RIG", "SCOUT_VAN"];
    for (let i = 0; i < 5; i++) {
      this.ridgeVehicles.push({
        type: vTypes[i],
        x: 300 + i * 520,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 28 + (i % 3) * 11,
        headlightsOn: false,
        sirenPhase: 0,
      });
    }
  }

  update(ws, dtSec, cam, terrain) {
    if (!cam || !terrain) return;
    const camX = cam.x;
    const isNight = ws.sun.elevation < 0.05;
    const isRaining = ws.rainIntensity > 0.20;
    ws.npcActivity = isNight ? 0.25 : isRaining ? 0.55 : 0.90;

    for (const npc of this.npcs) {
      if (npc.x < camX - 950) npc.x = camX + 850 + Math.random() * 350;
      else if (npc.x > camX + 1350) npc.x = camX - 820 - Math.random() * 250;

      // Chained Weather Reactivity: NPCs open umbrellas/weather hoods when rain starts! (Section 27)
      npc.hasUmbrella = isRaining && (npc.role === "HIKER" || npc.role === "PHOTOGRAPHER");

      const moveFactor =
        npc.role === "PHOTOGRAPHER" || npc.role === "ANGLER" || npc.role === "WORKER"
          ? 0.0
          : isNight
          ? 0.35
          : 1.0;

      npc.x += npc.dir * npc.speed * moveFactor * dtSec;
      npc.y = terrain.heightAt(npc.x);
      npc.phase += dtSec * (npc.role === "CYCLIST" ? 9.5 : 5.2) * moveFactor;

      if (npc.role === "PHOTOGRAPHER") {
        npc.photoFlashTimer -= dtSec;
        if (npc.photoFlashTimer <= 0) {
          npc.photoFlashTimer = 6.5 + Math.random() * 8.0;
        }
      }
    }

    // Update distant ridge vehicles on the midfield mountain pass
    for (const rv of this.ridgeVehicles) {
      rv.x += rv.dir * rv.speed * dtSec;
      if (rv.x < camX - 1200) rv.x = camX + 1100;
      else if (rv.x > camX + 1200) rv.x = camX - 1100;
      rv.headlightsOn = isNight || ws.fogDensity > 0.45 || ws.rainIntensity > 0.35;
      rv.sirenPhase += dtSec * 8.0;
    }
  }
}

// ============================================================================
// 10. PROCEDURAL EVENT DIRECTOR, RARITY TIERS & ANTI-REPETITION (Sections 25, 27, 39-41, 43)
// ============================================================================
class WorldEventDirector {
  cooldowns = new Map();
  recentEvents = [];
  evalTimer = 0;

  // Event definitions with rarity tiers & cooldowns (Sections 40 & 41)
  eventsCatalog = [
    { id: "WIND_GUST",          rarity: "COMMON",     cooldown: 14, weight: 1.0 },
    { id: "CLOUD_SHADOW_PASS",  rarity: "COMMON",     cooldown: 16, weight: 0.9 },
    { id: "LEAF_FLURRY",        rarity: "COMMON",     cooldown: 18, weight: 0.85 },
    { id: "FOREGROUND_BIRD",    rarity: "COMMON",     cooldown: 20, weight: 0.8 },
    { id: "DEER_HERD_ALERT",    rarity: "RARE",       cooldown: 35, weight: 0.45 },
    { id: "MASS_BIRD_FLOCK",    rarity: "RARE",       cooldown: 42, weight: 0.40 },
    { id: "SHOOTING_STAR",      rarity: "RARE",       cooldown: 38, weight: 0.42 },
    { id: "AIRCRAFT_FLYOVER",   rarity: "RARE",       cooldown: 50, weight: 0.35 },
    { id: "RAINBOW_EMERGENCE",  rarity: "RARE",       cooldown: 65, weight: 0.38 },
    { id: "SATELLITE_TRANSIT",  rarity: "RARE",       cooldown: 48, weight: 0.35 },
    { id: "METEOR_FIREBALL",    rarity: "VERY_RARE",  cooldown: 90, weight: 0.16 },
    { id: "STORM_CELL_FRONT",   rarity: "VERY_RARE",  cooldown: 85, weight: 0.18 },
    { id: "AURORA_PHENOMENON",  rarity: "ULTRA_RARE", cooldown: 120,weight: 0.09 },
  ];

  update(ws, dtSec, systems, cam, cameraDirector) {
    for (const [k, rem] of this.cooldowns.entries()) {
      if (rem > 0) this.cooldowns.set(k, Math.max(0, rem - dtSec));
    }

    this.evalTimer += dtSec;
    if (this.evalTimer < 4.2) return; // Evaluate every ~4.2 seconds
    this.evalTimer = 0;

    // Select context-weighted event candidate
    const candidates = [];
    for (const ev of this.eventsCatalog) {
      if ((this.cooldowns.get(ev.id) || 0) > 0) continue;

      // Contextual filtering
      const isNight = ws.sun.elevation < -0.04;
      if ((ev.id === "SHOOTING_STAR" || ev.id === "METEOR_FIREBALL" || ev.id === "SATELLITE_TRANSIT" || ev.id === "AURORA_PHENOMENON") && !isNight) {
        continue;
      }
      if (ev.id === "RAINBOW_EMERGENCE" && ws.memory.wetness < 0.15) continue;

      // Anti-Repetition penalty if triggered recently (Section 41)
      const recentPenalty = this.recentEvents.includes(ev.id) ? 0.22 : 1.0;
      candidates.push({ ev, score: ev.weight * recentPenalty * (0.7 + Math.random() * 0.6) });
    }

    if (candidates.length === 0) return;
    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0].ev;
    this.triggerEvent(chosen.id, ws, systems, cam, cameraDirector);
  }

  triggerEvent(eventId, ws, systems, cam, cameraDirector) {
    const def = this.eventsCatalog.find((e) => e.id === eventId) || { cooldown: 25 };
    this.cooldowns.set(eventId, def.cooldown);
    this.recentEvents.push(eventId);
    if (this.recentEvents.length > 5) this.recentEvents.shift();

    ws.stats.lastEventName = eventId;
    ws.stats.activeEvents = [eventId, ...this.recentEvents.slice(-2)];

    const camX = cam?.x || 220;
    const camY = cam?.y || 500;

    if (eventId === "WIND_GUST") {
      systems.wind.triggerGust(0.75);
    } else if (eventId === "FOREGROUND_BIRD") {
      systems.wildlife.triggerForegroundBird(camX, camY);
    } else if (eventId === "MASS_BIRD_FLOCK") {
      systems.wildlife.triggerMassFlock(camX, camY);
      // Subtle camera micro-moment (Section 43)
      cameraDirector?.pulseZoom?.(-0.025);
    } else if (eventId === "SHOOTING_STAR") {
      systems.celestial.spawnPhenomenon("shooting_star");
    } else if (eventId === "METEOR_FIREBALL") {
      systems.celestial.spawnPhenomenon("meteor");
    } else if (eventId === "SATELLITE_TRANSIT") {
      systems.celestial.spawnPhenomenon("satellite");
    } else if (eventId === "AIRCRAFT_FLYOVER") {
      systems.celestial.spawnPhenomenon("aircraft");
    } else if (eventId === "RAINBOW_EMERGENCE") {
      ws.memory.wetness = Math.max(ws.memory.wetness, 0.45);
      ws.memory.rainbowAlpha = 0.85;
    } else if (eventId === "STORM_CELL_FRONT") {
      systems.weather.setWeather(ws, "THUNDERSTORM");
      systems.wind.triggerGust(0.9);
    } else if (eventId === "AURORA_PHENOMENON") {
      ws.memory.auroraAlpha = 0.85;
    }
  }
}

// ============================================================================
// 11. MASTER WORLD SIMULATION MANAGER (Single Ecosystem Coordinator)
// ============================================================================
class WorldSimulationManager {
  state = new WorldState();
  celestial;
  season;
  wind;
  weather;
  lighting;
  envDetail;
  wildlife;
  npc;
  eventDirector;
  ambientAudioTimer = 0;

  constructor(seed = 48192) {
    this.celestial = new TimeAndCelestialSystem(seed);
    this.season = new SeasonSystem();
    this.wind = new WindSystem();
    this.weather = new WeatherAndAtmosphereSystem(seed);
    this.lighting = new LightingSystem();
    this.envDetail = new WorldEnvironmentDetailSystem();
    this.wildlife = new WildlifeSystem(seed);
    this.npc = new NPCAndTrafficSystem(seed);
    this.eventDirector = new WorldEventDirector();
  }

  initForTerrain(terrain) {
    this.envDetail.initForTerrain(terrain);
  }

  update(dtMs, game) {
    const t0 = performance.now();
    const dtSec = b((dtMs || 16.666) / 1000, 0.001, 0.05);
    const cam = game?.camera;
    const terrain = game?.terrain;
    const vehicle = game?.vehicle;
    const audio = game?.audio;
    const posX = vehicle?.chassis?.position?.x ?? (cam?.x || 220);
    const posY = vehicle?.chassis?.position?.y ?? (cam?.y || 500);
    const altMeters = Math.max(0, (x.world.groundBase - posY) / 40);
    const biome = terrain ? terrain.biomeAt(posX) : null;

    this.celestial.update(this.state, dtSec);
    this.season.update(this.state, dtSec, altMeters);
    this.wind.update(this.state, dtSec, altMeters);
    this.weather.update(this.state, dtSec, cam, terrain, audio, altMeters);
    this.lighting.update(this.state, biome);
    this.envDetail.update(this.state, dtSec, cam, vehicle, this.weather);
    this.wildlife.update(this.state, dtSec, cam, terrain, vehicle);
    this.npc.update(this.state, dtSec, cam, terrain);
    this.eventDirector.update(
      this.state,
      dtSec,
      {
        wind: this.wind,
        weather: this.weather,
        celestial: this.celestial,
        wildlife: this.wildlife,
      },
      cam,
      cam
    );

    // Spatialized Atmospheric Audio (Birds, Insects, Rain, Wind — Section 34)
    this.ambientAudioTimer += dtSec;
    if (this.ambientAudioTimer >= 2.2 && audio) {
      this.ambientAudioTimer = 0;
      if (typeof audio.updateLivingWorldAmbience === "function") {
        audio.updateLivingWorldAmbience(this.state);
      }
    }

    const simMs = Number((performance.now() - t0).toFixed(2));
    this.state.stats.simLoadMs = simMs;
    this.state.simStepMs = simMs;
    this.state.entityCounts = {
      birds: this.wildlife.boids.length,
      animals: this.wildlife.animals.length,
      insects: this.wildlife.insects.filter((ins) => ins.active).length,
      npcs: this.npc.npcs.length,
      traffic: this.npc.ridgeVehicles.length,
      clouds: this.weather.clouds.length,
    };
    this.state.lodCounts = {
      near: this.state.stats.nearEntities,
      mid: this.state.stats.midEntities,
      far: this.state.stats.farEntities,
    };
    this.state.activeEvents = this.state.stats.activeEvents;
  }

  // Developer / Player interactive hotkeys to test or advance world states
  advanceTimeHours(hours = 3) {
    this.state.timeMinutes = (this.state.timeMinutes + hours * 60) % 1440;
    this.celestial.update(this.state, 0.016);
    return this.state.phaseName;
  }

  cycleWeather() {
    const keys = Object.keys(WEATHER_TYPES);
    const idx = (keys.indexOf(this.state.targetWeather) + 1) % keys.length;
    this.weather.setWeather(this.state, keys[idx]);
    this.state.weather = keys[idx];
    return keys[idx];
  }

  cycleSeason() {
    this.season.cycleSeason(this.state);
    return this.state.season;
  }

  triggerShowcaseEvent() {
    const showcase = ["MASS_BIRD_FLOCK", "RAINBOW_EMERGENCE", "SHOOTING_STAR", "FOREGROUND_BIRD", "METEOR_FIREBALL"];
    const pick = showcase[Math.floor(Math.random() * showcase.length)];
    this.eventDirector.triggerEvent(
      pick,
      this.state,
      {
        wind: this.wind,
        weather: this.weather,
        celestial: this.celestial,
        wildlife: this.wildlife,
      },
      window.game?.camera,
      window.game?.camera
    );
    return pick;
  }

  // ==========================================================================
  // RENDERING LAYERS (Called by R0 Renderer at appropriate Z-depths)
  // ==========================================================================

  // Layer A: Sky Dome (Stars, Aurora, Sun, Moon with lunar phase, Rainbow, Sky Phenomena, 3-Layer Clouds)
  drawSkyLayer(ctx, w, h, cam, biome) {
    const ws = this.state;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, ws.lighting.skyTop);
    grad.addColorStop(1, ws.lighting.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 1. Procedural Star Field at Dusk / Night (Section 5)
    const starVis = b((-ws.sun.elevation + 0.12) * 3.2 * (1 - ws.cloudCoverage * 0.8), 0, 1);
    if (starVis > 0.02) {
      ctx.save();
      const nowSec = performance.now() * 0.001;
      for (const st of this.celestial.stars) {
        const twinkle = 0.65 + 0.35 * Math.sin(nowSec * st.twinkleFreq + st.twinklePhase);
        ctx.globalAlpha = starVis * st.baseAlpha * twinkle;
        ctx.fillStyle = st.warmth;
        ctx.beginPath();
        ctx.arc(st.u * w, st.v * h, st.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. Ultra-Rare Aurora Borealis Ribbons
    if (ws.memory.auroraAlpha > 0.02 && starVis > 0.15) {
      ctx.save();
      ctx.globalAlpha = ws.memory.auroraAlpha * starVis * 0.38;
      const aGrad = ctx.createLinearGradient(0, h * 0.05, 0, h * 0.42);
      aGrad.addColorStop(0, "rgba(46, 163, 165, 0)");
      aGrad.addColorStop(0.5, "rgba(78, 210, 168, 0.55)");
      aGrad.addColorStop(1, "rgba(212, 98, 42, 0)");
      ctx.fillStyle = aGrad;
      ctx.beginPath();
      const t = performance.now() * 0.0006;
      ctx.moveTo(0, h * 0.32);
      for (let sx = 0; sx <= w; sx += 60) {
        const sy = h * 0.18 + Math.sin(sx * 0.005 + t) * 36 + Math.cos(sx * 0.012 - t * 1.4) * 18;
        ctx.lineTo(sx, sy);
      }
      ctx.lineTo(w, h * 0.42);
      ctx.lineTo(0, h * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 3. Sky Phenomena (Shooting Stars, Meteors, Satellites, Distant Aircraft — Section 5)
    for (const p of this.celestial.skyPhenomena) {
      if (!p.active) continue;
      const sx = p.x * w;
      const sy = p.y * h;
      ctx.save();
      if (p.kind === "shooting_star" || p.kind === "meteor") {
        const tailLen = p.kind === "meteor" ? 130 : 75;
        const g = ctx.createLinearGradient(sx, sy, sx - p.vx * tailLen, sy - p.vy * tailLen);
        g.addColorStop(0, p.kind === "meteor" ? "#ffd28a" : "#ffffff");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = p.kind === "meteor" ? 2.6 : 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - p.vx * tailLen, sy - p.vy * tailLen);
        ctx.stroke();
      } else if (p.kind === "satellite") {
        ctx.fillStyle = "rgba(239, 231, 214, 0.82)";
        ctx.beginPath();
        ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "aircraft") {
        // Distant aircraft silhouette + blinking wing strobe + faint contrail
        ctx.strokeStyle = "rgba(239, 231, 214, 0.16)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - Math.sign(p.vx) * 65, sy);
        ctx.stroke();
        ctx.fillStyle = Math.sin(p.blinkPhase) > 0.3 ? "#e05a47" : "#efe7d6";
        ctx.beginPath();
        ctx.arc(sx, sy, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. Dynamic Sun (Section 3)
    if (ws.sun.elevation > -0.12) {
      const sunX = ws.sun.x * w;
      const sunY = ws.sun.y * h;
      const glowR = 135 + (1 - Math.max(0, ws.sun.elevation)) * 65;
      ctx.save();
      ctx.globalAlpha = b((ws.sun.elevation + 0.12) * 3.0 * (1 - ws.cloudCoverage * 0.65), 0, 1);
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, glowR);
      sunGlow.addColorStop(0, ws.sun.color);
      sunGlow.addColorStop(0.35, "rgba(227, 126, 61, 0.25)");
      sunGlow.addColorStop(1, "rgba(239, 231, 214, 0)");
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Crisp solar disc
      ctx.fillStyle = "#faeed4";
      ctx.globalAlpha *= 0.85;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Dynamic Moon with Lunar Phase Mask (Section 4)
    if (ws.moon.elevation > -0.08 && ws.sun.elevation < 0.22) {
      const mx = ws.moon.x * w;
      const my = ws.moon.y * h;
      const mr = 19;
      ctx.save();
      ctx.globalAlpha = b((-ws.sun.elevation + 0.22) * 2.5 * (1 - ws.cloudCoverage * 0.7), 0, 0.92);
      const mGlow = ctx.createRadialGradient(mx, my, 4, mx, my, 78);
      mGlow.addColorStop(0, "rgba(220, 232, 245, 0.38)");
      mGlow.addColorStop(1, "rgba(220, 232, 245, 0)");
      ctx.fillStyle = mGlow;
      ctx.beginPath();
      ctx.arc(mx, my, 78, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#e8eff7";
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();

      // Crescent / Half-moon shadow cutout
      if (ws.moon.illumination < 0.95) {
        ctx.fillStyle = ws.lighting.skyTop;
        ctx.beginPath();
        const shift = mr * 0.45 + ws.moon.illumination * mr * 1.1;
        ctx.arc(mx - shift * 0.65, my - 2, mr * 0.92, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 6. Rare Atmospheric Rainbow Arc after Rain (Section 26)
    if (ws.memory.rainbowAlpha > 0.02) {
      ctx.save();
      ctx.globalAlpha = ws.memory.rainbowAlpha * 0.34;
      const rx = w * 0.62;
      const ry = h * 0.52;
      const bands = ["#e05a47", "#d89b3c", "#dfcf6d", "#5fa372", "#2ea3a5", "#6c649c"];
      ctx.lineWidth = 5.5;
      for (let bIdx = 0; bIdx < bands.length; bIdx++) {
        ctx.strokeStyle = bands[bIdx];
        ctx.beginPath();
        ctx.arc(rx, ry, 340 - bIdx * 6, Math.PI * 1.06, Math.PI * 1.94);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 7. Multi-Layer Alpine Cumulus / Stratus Clouds (Far, Mid, Near — Section 7)
    if (ws.cloudCoverage > 0.03) {
      ctx.save();
      const isDarkCloud = ws.rainIntensity > 0.35 || ws.weather === "THUNDERSTORM";
      const isSunset = ws.sun.elevation > -0.08 && ws.sun.elevation < 0.22;
      const cloudTop = isDarkCloud
        ? "rgba(68, 76, 80, 0.78)"
        : isSunset
        ? "rgba(232, 188, 152, 0.72)"
        : ws.sun.elevation <= -0.08
        ? "rgba(46, 56, 66, 0.65)"
        : "rgba(242, 236, 224, 0.72)";
      const cloudBot = isDarkCloud
        ? "rgba(42, 48, 52, 0.0)"
        : "rgba(215, 210, 198, 0.0)";

      // Draw at most 12 well-spaced clouds without per-cloud gradient allocation
      const stride = ws.cloudCoverage > 0.7 ? 2 : 3;
      ctx.fillStyle = cloudTop;
      for (let i = 0; i < this.weather.clouds.length; i += stride) {
        const c = this.weather.clouds[i];
        if (c.density > ws.cloudCoverage + 0.35) continue;
        const cx = ((c.u * (w + 520)) - 260);
        const cy = c.y * h * 0.78;
        const cw = c.width * 0.55;
        const ch = c.height * 0.52;
        const layerAlpha = (c.layer === 0 ? 0.24 : c.layer === 1 ? 0.36 : 0.48) * b(ws.cloudCoverage * 1.25, 0.22, 0.88);
        ctx.globalAlpha = layerAlpha;

        ctx.beginPath();
        ctx.moveTo(cx - cw, cy + ch * 0.25);
        ctx.quadraticCurveTo(cx - cw * 0.85, cy - ch * 0.45, cx - cw * 0.38, cy - ch * 0.42);
        ctx.quadraticCurveTo(cx - cw * 0.05, cy - ch * 1.05, cx + cw * 0.32, cy - ch * 0.48);
        ctx.quadraticCurveTo(cx + cw * 0.82, cy - ch * 0.38, cx + cw, cy + ch * 0.25);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Layer B: Distant World Simulation (Far Migratory V-Flocks & Ridge Road Traffic — Sections 18, 24, 35)
  drawMidgroundLife(ctx, cam, terrain) {
    if (!terrain) return;
    const ws = this.state;

    // 1. Far Migratory Bird V-Flocks (batched into single stroke)
    ctx.save();
    ctx.strokeStyle = ws.sun.elevation < 0 ? "rgba(220,230,240,0.45)" : "rgba(27,31,29,0.52)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const f of this.wildlife.distantFlocks) {
      if (!f.active) continue;
      for (let i = 0; i < f.count; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const rank = Math.ceil(i / 2);
        const bx = f.x - rank * 13;
        const by = f.y + side * rank * 7 + Math.sin(f.phase + i * 0.6) * 2.5;
        const wing = Math.sin(f.phase + i * 0.5) * 3.5;
        ctx.moveTo(bx - 4, by - wing);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + 4, by - wing);
      }
    }
    ctx.stroke();
    ctx.restore();

    // 2. Distant Ridge Road Traffic (Section 24)
    ctx.save();
    for (const rv of this.npc.ridgeVehicles) {
      if (Math.abs(rv.x - cam.x) > 1250) continue;
      const ry = terrain.heightAt(rv.x) - 52; // Traveling along background ridge shelf
      ctx.save();
      ctx.translate(rv.x, ry);
      ctx.scale(rv.dir * 0.52, 0.52);
      ctx.globalAlpha = 0.58;

      ctx.fillStyle = rv.type === "RESCUE_RIG" ? "#c94a29" : rv.type === "MOUNTAIN_BUS" ? "#d89b3c" : "#3a4340";
      ctx.fillRect(-20, -14, 40, 12);
      ctx.fillRect(6, -20, 14, 8);
      ctx.fillStyle = "#1b1f1d";
      ctx.beginPath();
      ctx.arc(-11, -2, 4.5, 0, Math.PI * 2);
      ctx.arc(11, -2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Headlight beam at dusk/night/fog
      if (rv.headlightsOn) {
        ctx.fillStyle = "rgba(246, 223, 170, 0.42)";
        ctx.beginPath();
        ctx.moveTo(20, -8);
        ctx.lineTo(85, -22);
        ctx.lineTo(85, 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // Layer C: Terrain Surface Ecosystem (Trees, Wind-Bent Grass, Seasonal Flowers, Water Tarns, Puddles, Wildlife, NPCs, Smoke)
  drawWorldEcosystem(ctx, cam, terrain, left, right, biome) {
    if (!terrain) return;
    const ws = this.state;
    const windBend = ws.vegetationState.windBend;
    const snowCov = ws.memory.snowCover;
    const wet = ws.memory.wetness;
    const nowSec = performance.now() * 0.001;

    // 1. Instanced / Deterministic Alpine Trees, Grass Waves & Seasonal Wildflowers (Section 15)
    ctx.save();
    const treeStep = 144;
    const tStart = Math.floor(left / treeStep) * treeStep;
    const tEnd = Math.ceil(right / treeStep) * treeStep;

    for (let tx = tStart; tx <= tEnd; tx += treeStep) {
      const hHash = Math.abs(Math.sin(tx * 0.0173) * 43758.5453) % 1;
      if (hHash < 0.32) continue; // Natural clustering
      const ty = terrain.heightAt(tx);
      const slope = terrain.slopeAt(tx);
      if (Math.abs(slope) > 0.55) continue;

      const scale = 0.68 + (hHash * 0.55);
      const sway = (windBend * 8.5 + Math.sin(nowSec * 2.1 + tx * 0.03) * (1.8 + ws.windSpeed * 0.18)) * scale;

      ctx.save();
      ctx.translate(tx, ty);

      // Dynamic Sun Shadow on ground (Section 33)
      if (ws.lighting.shadowAlpha > 0.05 && ws.sun.elevation > 0.02) {
        ctx.fillStyle = `rgba(15, 19, 17, ${(ws.lighting.shadowAlpha * 0.7).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(ws.sun.shadowDirX * 22 * scale, 1, 18 * scale * ws.sun.shadowLength, 3.5, slope, 0, Math.PI * 2);
        ctx.fill();
      }

      // Trunk
      ctx.strokeStyle = "#3b2f26";
      ctx.lineWidth = 3.2 * scale;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(sway * 0.35, -24 * scale, sway * 0.65, -48 * scale);
      ctx.stroke();

      if (ws.season === "WINTER" && hHash > 0.75) {
        // Bare winter branches on deciduous trees
        ctx.lineWidth = 1.6 * scale;
        ctx.beginPath();
        ctx.moveTo(sway * 0.4, -26 * scale);
        ctx.lineTo(sway * 0.4 - 12 * scale, -38 * scale);
        ctx.moveTo(sway * 0.5, -34 * scale);
        ctx.lineTo(sway * 0.5 + 11 * scale, -44 * scale);
        ctx.stroke();
      } else {
        // 3-Tier Conifer / Alpine Foliage Crown bending with global wind
        ctx.fillStyle = ws.vegetationState.foliageColor;
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 1.4;
        for (let tier = 0; tier < 3; tier++) {
          const baseH = (-18 - tier * 14) * scale;
          const topH = (-38 - tier * 14) * scale;
          const halfW = (18 - tier * 3.5) * scale;
          const tierSway = sway * (0.45 + tier * 0.28);
          ctx.beginPath();
          ctx.moveTo(tierSway * 0.6 - halfW, baseH);
          ctx.lineTo(tierSway, topH);
          ctx.lineTo(tierSway * 0.6 + halfW, baseH);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Snow cap on branches during snowfall / Winter (Section 11)
          if (snowCov > 0.15) {
            ctx.fillStyle = `rgba(244, 248, 252, ${b(snowCov * 0.9, 0.15, 0.88).toFixed(2)})`;
            ctx.beginPath();
            ctx.moveTo(tierSway * 0.6 - halfW * 0.7, baseH - 4 * scale);
            ctx.lineTo(tierSway, topH);
            ctx.lineTo(tierSway * 0.6 + halfW * 0.7, baseH - 4 * scale);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = ws.vegetationState.foliageColor;
          }
        }
      }
      ctx.restore();
    }

    // Grouped Grass Waves & Day-Opening / Night-Closing Wildflowers (Batched into single stroke!)
    const grassStep = 44;
    const gStart = Math.floor(left / grassStep) * grassStep;
    const gEnd = Math.ceil(right / grassStep) * grassStep;
    ctx.strokeStyle = ws.season === "AUTUMN" ? "#b87a3d" : biome?.accent || "#586b5b";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let gx = gStart; gx <= gEnd; gx += grassStep) {
      const gy = terrain.heightAt(gx);
      const wave = windBend * 5.5 + Math.sin(nowSec * 3.2 + gx * 0.04) * 2.2;
      ctx.moveTo(gx, gy - 1);
      ctx.lineTo(gx + wave, gy - 8);
      ctx.moveTo(gx + 5, gy - 1);
      ctx.lineTo(gx + 5 + wave * 1.1, gy - 9);
    }
    ctx.stroke();

    if (ws.vegetationState.flowerOpenFactor > 0.2) {
      const fRadius = 2.2 * ws.vegetationState.flowerOpenFactor;
      ctx.fillStyle = "#efd07b";
      ctx.beginPath();
      for (let gx = gStart; gx <= gEnd; gx += grassStep * 3) {
        const gy = terrain.heightAt(gx);
        const wave = windBend * 5.5 + Math.sin(nowSec * 3.2 + gx * 0.04) * 2.2;
        ctx.moveTo(gx + 5 + wave * 1.1 + fRadius, gy - 9.5);
        ctx.arc(gx + 5 + wave * 1.1, gy - 9.5, fRadius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();

    // 2. Alpine Water Tarns, Rain Puddles, Waves, Shimmer & Ripples (Sections 8, 16, 29)
    ctx.save();
    for (const wb of this.envDetail.waterBodies) {
      if (wb.x + wb.width < left || wb.x - wb.width > right) continue;
      if (!wb.isPermanentTarn && wet < 0.18) continue;

      const effW = wb.isPermanentTarn ? wb.width : wb.width * b(wet * 1.1, 0.3, 1.0);
      const frozen = ws.waterState.frozenFactor;

      ctx.fillStyle = frozen > 0.5
        ? "rgba(195, 220, 235, 0.78)"
        : ws.sun.elevation < 0
        ? "rgba(32, 52, 68, 0.75)"
        : "rgba(46, 132, 145, 0.64)";
      ctx.beginPath();
      ctx.ellipse(wb.x, wb.y, effW * 0.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sun / Moon Shimmer & Wind Waves on water surface
      ctx.strokeStyle = ws.sun.elevation > 0
        ? "rgba(250, 238, 205, 0.55)"
        : "rgba(210, 228, 248, 0.45)";
      ctx.lineWidth = 1.1;
      const waveAmp = ws.waterState.waveIntensity * 3.5 * (1 - frozen);
      ctx.beginPath();
      const wOffset = Math.sin(nowSec * 3.5 + wb.x) * 6;
      ctx.moveTo(wb.x - effW * 0.28 + wOffset, wb.y - 1);
      ctx.lineTo(wb.x + effW * 0.28 + wOffset, wb.y - 1 + waveAmp * 0.3);
      ctx.stroke();
    }

    // Active water/puddle ripples
    ctx.strokeStyle = "rgba(235, 244, 250, 0.62)";
    ctx.lineWidth = 1.1;
    for (const r of this.weather.ripples) {
      if (!r.active || r.x < left || r.x > right) continue;
      ctx.globalAlpha = r.alpha;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Persistent Snow Cover & Wet Road Sheen + Wheel Tracks (Sections 8, 11, 29)
    if (snowCov > 0.12 || wet > 0.22) {
      ctx.save();
      ctx.lineWidth = snowCov > 0.12 ? 4.5 * snowCov : 2.5 * wet;
      ctx.strokeStyle = snowCov > 0.12
        ? `rgba(242, 247, 252, ${b(snowCov * 0.85, 0.1, 0.85).toFixed(2)})`
        : `rgba(185, 212, 228, ${b(wet * 0.38, 0.08, 0.38).toFixed(2)})`;
      ctx.beginPath();
      let moved = false;
      for (let sx = Math.max(left, 0); sx <= right; sx += 36) {
        const sy = terrain.heightAt(sx) - 2.5;
        if (!moved) { ctx.moveTo(sx, sy); moved = true; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Persistent Wheel Tracks / Footprints in Mud & Snow (Section 29)
    if (ws.memory.wheelTracks.length > 0) {
      ctx.save();
      for (const tr of ws.memory.wheelTracks) {
        if (tr.x < left || tr.x > right) continue;
        const alpha = b(1 - tr.age / 45, 0, 0.55);
        ctx.fillStyle = tr.kind === "snow" ? `rgba(140,160,175,${alpha})` : `rgba(25,20,16,${alpha})`;
        ctx.fillRect(tr.x - 5, terrain.heightAt(tr.x) - 3, 10, 2.5);
      }
      ctx.restore();
    }

    // 4. Environmental Smoke Plumes rising & bending with wind (Section 22)
    ctx.save();
    for (const sm of this.envDetail.smokeParticles) {
      if (!sm.active || sm.x < left - 100 || sm.x > right + 100) continue;
      ctx.globalAlpha = sm.alpha;
      ctx.fillStyle = sm.color;
      ctx.beginPath();
      ctx.arc(sm.x, sm.y, sm.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5. Autonomous Ground Wildlife (Deer, Ibex, Rabbits, Frogs — Section 19)
    ctx.save();
    for (const a of this.wildlife.animals) {
      if (a.x < left - 60 || a.x > right + 60) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.scale(a.dir, 1);

      if (a.species === "DEER" || a.species === "IBEX") {
        const bounce = a.state === "FLEE" ? Math.abs(Math.sin(a.legPhase)) * -7 : 0;
        ctx.translate(0, bounce);
        ctx.fillStyle = a.species === "IBEX" ? "#5c5349" : "#8c6244";
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 1.6;
        // Body
        ctx.fillRect(-11, -18, 22, 9);
        ctx.strokeRect(-11, -18, 22, 9);
        // Legs
        const legSwing = (a.state === "FLEE" || a.state === "WANDER") ? Math.sin(a.legPhase) * 5 : 0;
        ctx.beginPath();
        ctx.moveTo(-8, -9); ctx.lineTo(-8 - legSwing, 0);
        ctx.moveTo(-4, -9); ctx.lineTo(-4 + legSwing, 0);
        ctx.moveTo(6, -9);  ctx.lineTo(6 + legSwing, 0);
        ctx.moveTo(9, -9);  ctx.lineTo(9 - legSwing, 0);
        ctx.stroke();
        // Neck, Head & Antlers/Horns
        ctx.save();
        ctx.translate(9, -16);
        ctx.rotate(a.headAngle);
        ctx.fillRect(-2, -10, 5, 10);
        ctx.fillRect(0, -12, 8, 5);
        // Antlers
        ctx.beginPath();
        ctx.moveTo(1, -12); ctx.lineTo(-4, -19);
        ctx.moveTo(-1, -15); ctx.lineTo(3, -18);
        ctx.stroke();
        ctx.restore();
      } else {
        // Rabbit / Hare / Frog
        const hop = (a.state === "FLEE" || a.state === "WANDER") ? Math.abs(Math.sin(a.legPhase)) * -5 : 0;
        ctx.translate(0, hop);
        ctx.fillStyle = a.species === "FROG" ? "#4e7a52" : "#9c8d7c";
        ctx.beginPath();
        ctx.ellipse(0, -4, 5.5, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();
        if (a.species === "RABBIT") {
          ctx.fillRect(2, -10, 1.8, 5);
          ctx.fillRect(4, -9, 1.8, 4.5);
        }
      }
      ctx.restore();
    }
    ctx.restore();

    // 6. Autonomous NPCs (Hikers with backpacks/umbrellas, Cyclists, Photographers, Workers — Section 23)
    ctx.save();
    for (const npc of this.npc.npcs) {
      if (npc.x < left - 60 || npc.x > right + 60) continue;
      ctx.save();
      ctx.translate(npc.x, npc.y);
      ctx.scale(npc.dir, 1);

      const stride = Math.sin(npc.phase) * 4;
      ctx.strokeStyle = "#1b1f1d";
      ctx.lineWidth = 2.0;

      if (npc.role === "CYCLIST") {
        // Bicycle wheels & frame
        ctx.beginPath();
        ctx.arc(-8, -5, 5, 0, Math.PI * 2);
        ctx.arc(8, -5, 5, 0, Math.PI * 2);
        ctx.moveTo(-8, -5); ctx.lineTo(0, -13); ctx.lineTo(8, -5);
        ctx.stroke();
      } else {
        // Walking legs
        ctx.beginPath();
        ctx.moveTo(-1, -10); ctx.lineTo(-1 - stride, 0);
        ctx.moveTo(1, -10);  ctx.lineTo(1 + stride, 0);
        ctx.stroke();
      }

      // Parka torso & expedition backpack
      ctx.fillStyle = npc.role === "WORKER" ? "#d89b3c" : "#d4622a";
      ctx.fillRect(-4, -20, 8, 10);
      ctx.strokeRect(-4, -20, 8, 10);
      ctx.fillStyle = "#48534e";
      ctx.fillRect(-7, -19, 3.5, 8);

      // Head
      ctx.fillStyle = "#efe7d6";
      ctx.beginPath();
      ctx.arc(0, -24, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Umbrella when raining! (Section 27)
      if (npc.hasUmbrella) {
        ctx.fillStyle = "#2ea3a5";
        ctx.beginPath();
        ctx.arc(2, -30, 11, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Photographer camera flash
      if (npc.role === "PHOTOGRAPHER" && npc.photoFlashTimer < 0.18) {
        ctx.fillStyle = "rgba(255, 252, 230, 0.85)";
        ctx.beginPath();
        ctx.arc(7, -21, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
    ctx.restore();

    // 7. Bird Boids (Near & Mid LOD — Section 18) & Insects (Fireflies / Butterflies — Section 21)
    ctx.save();
    for (const bItem of this.wildlife.boids) {
      if (bItem.x < left - 120 || bItem.x > right + 120) continue;
      ctx.save();
      ctx.translate(bItem.x, bItem.y);
      const s = bItem.scale;
      ctx.scale(s, s);
      ctx.strokeStyle = "#1b1f1d";
      ctx.fillStyle = "#2b3230";
      ctx.lineWidth = 1.8;

      if (bItem.state === "PERCHED") {
        ctx.beginPath();
        ctx.ellipse(0, -3, 3.5, 2.5, -0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const flap = Math.sin(bItem.wingPhase) * 6.5;
        ctx.beginPath();
        ctx.moveTo(-7, -flap);
        ctx.quadraticCurveTo(-2, 0, 0, 1.5);
        ctx.quadraticCurveTo(2, 0, 7, -flap);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Insects: Glowing Fireflies at night & fluttering Butterflies/Dragonflies by day
    for (const ins of this.wildlife.insects) {
      if (!ins.active || ins.x < left || ins.x > right) continue;
      ctx.save();
      ctx.translate(ins.x, ins.y);
      if (ins.kind === "FIREFLY") {
        ctx.globalAlpha = ins.glow;
        ctx.fillStyle = "#dfef6b";
        ctx.beginPath();
        ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(223, 239, 107, 0.28)";
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const wingW = 1.5 + Math.abs(Math.sin(ins.phase * 2.5)) * 2.5;
        ctx.fillStyle = ins.kind === "BUTTERFLY" ? "#e39854" : "#64c2c4";
        ctx.fillRect(-wingW, -1.5, wingW * 2, 3);
      }
      ctx.restore();
    }
    ctx.restore();

    // 8. Pooled Precipitation (Batched Rain streaks, Snowflakes, Drifting Autumn Leaves / Spring Petals — Sections 8, 11, 12)
    ctx.save();
    let hasRain = false;
    let hasSnow = false;
    for (let i = 0; i < this.weather.precipPool.length; i++) {
      const p = this.weather.precipPool[i];
      if (!p.active || p.x < left - 100 || p.x > right + 100) continue;
      if (p.kind === "rain") hasRain = true;
      else if (p.kind === "snow") hasSnow = true;
      else {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.35, p.size, p.size * 0.7);
      }
    }

    if (hasRain) {
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = "rgba(188, 212, 226, 0.65)";
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      for (let i = 0; i < this.weather.precipPool.length; i++) {
        const p = this.weather.precipPool[i];
        if (!p.active || p.kind !== "rain" || p.x < left - 100 || p.x > right + 100) continue;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.025, p.y - p.size);
      }
      ctx.stroke();
    }

    if (hasSnow) {
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = "#f4f8fc";
      ctx.beginPath();
      for (let i = 0; i < this.weather.precipPool.length; i++) {
        const p = this.weather.precipPool[i];
        if (!p.active || p.kind !== "snow" || p.x < left - 100 || p.x > right + 100) continue;
        ctx.moveTo(p.x + p.size, p.y);
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  // Layer D: Screen-Space Volumetric Fog, Cloud Shadows, Night Darkness & Vehicle Headlight Cone (Sections 10, 32, 33)
  drawAtmosphericOverlay(ctx, w, h, cam, vehicle) {
    const ws = this.state;

    // 1. Volumetric Layered Ground/Valley Fog Bands (Section 10)
    if (ws.fogDensity > 0.05) {
      ctx.save();
      const fogAlpha = b(ws.fogDensity * 0.52, 0.03, 0.56);
      const fGrad = ctx.createLinearGradient(0, h * 0.25, 0, h);
      const fogRgb = ws.sun.elevation < 0 ? "26, 34, 42" : "222, 218, 206";
      fGrad.addColorStop(0, `rgba(${fogRgb}, 0)`);
      fGrad.addColorStop(0.55, `rgba(${fogRgb}, ${(fogAlpha * 0.55).toFixed(3)})`);
      fGrad.addColorStop(1, `rgba(${fogRgb}, ${fogAlpha.toFixed(3)})`);
      ctx.fillStyle = fGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 2. Night / Storm Ambient Darkness + Dynamic Vehicle Headlight Illumination Cone
    const darkness = b(1.0 - ws.lighting.ambientIntensity, 0, 0.64);
    if (darkness > 0.04) {
      ctx.save();
      ctx.fillStyle = `rgba(10, 15, 22, ${(darkness * 0.72).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 3. Lightning Flash Pulse (Section 9)
    if (ws.lighting.lightningFlash > 0.04) {
      ctx.save();
      ctx.fillStyle = `rgba(235, 245, 255, ${(ws.lighting.lightningFlash * 0.36).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}

if (typeof window !== "undefined") {
  window.WorldSimulationManager = WorldSimulationManager;
  window.WEATHER_TYPES = WEATHER_TYPES;
  window.SEASONS = SEASONS;
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
      this.renderer.setSize(Math.max(1, Math.floor(window.innerWidth * 0.5)), Math.max(1, Math.floor(window.innerHeight * 0.5)), false);
      this.renderer.setPixelRatio(1);

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
      this.sunLight = new THREE.DirectionalLight(0xffecd2, 1.25);
      this.sunLight.position.set(500, 1000, 800);
      this.scene.add(this.sunLight);

      this.hemiLight = new THREE.HemisphereLight(0xb4c7be, 0x48534e, 0.65);
      this.scene.add(this.hemiLight);

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
          const px = pos.getX(i);
          const ridge = Math.sin(px * 0.004) * 80 + Math.sin(px * 0.012) * 45;
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

  sync(cam, vehicle, relics, worldSim = null) {
    if (!this.enabled || !this.renderer || !this.camera) return;
    this.syncCount = (this.syncCount || 0) + 1;
    // Throttle background WebGL pass on normal frames while always rendering on first call or explicit sync
    if (worldSim && this.syncCount > 2 && (this.syncCount % 5 !== 0)) return;

    const targetX = (cam.x - 220) * 0.35;
    const targetY = (-cam.y + 560) * 0.35;
    const targetZ = 850 / Math.max(0.45, cam.zoom);

    if (Number.isFinite(cam.fov) && Math.abs(this.camera.fov - cam.fov * 0.78) > 0.05) {
      this.camera.fov = cam.fov * 0.78;
      this.camera.updateProjectionMatrix();
    }

    this.camera.position.x = targetX;
    this.camera.position.y = targetY;
    this.camera.position.z = targetZ;
    this.camera.lookAt(targetX, targetY, 0);
    this.camera.rotation.z = -(cam.totalRoll ?? cam.roll ?? 0);

    // Synchronize 3D directional sun, ambient fill & fog with Living World State
    if (worldSim?.state && this.sunLight && this.hemiLight) {
      const ws = worldSim.state;
      this.sunLight.intensity = 0.25 + ws.sun.intensity * 1.15 + ws.lighting.lightningFlash * 0.8;
      this.sunLight.position.set((ws.sun.x - 0.5) * 1800, Math.max(80, ws.sun.elevation * 1200), 800);
      this.hemiLight.intensity = 0.22 + ws.lighting.ambientIntensity * 0.52;
      if (this.scene?.fog) {
        this.scene.fog.density = 0.00025 + ws.fogDensity * 0.00055;
      }
    }

    for (const m of this.mountains) {
      m.mesh.position.x = targetX * (1 + m.def.z * 0.0003);
      m.mesh.position.y = targetY * (1 + m.def.z * 0.00022) - 60;
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
    this.renderer.setSize(Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5)), false);
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
  grainPattern = null;
  vigGrad = null;
  vigW = 0;
  vigH = 0;
  parallaxNoises = {
    31: K0(31),
    44: K0(44),
    57: K0(57),
  };

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
    const worldSim = game?.worldSim || null;

    // Sync Three.js 2.5D visual depth layer
    if (game?.threeDepth) {
      game.threeDepth.sync(camera, vehicle, game.echoManager?.relics, worldSim);
    }

    ctx.save();
    if (worldSim) {
      worldSim.drawSkyLayer(ctx, width, height, camera, biome);
    } else {
      this.drawSky(width, height, camera, biome);
    }

    ctx.save();
    ctx.translate(width / 2, height / 2);

    // Apply subtle horizon-stable camera roll & FOV-coupled spatial scale (Sections 34, 35, 49)
    const camRoll = camera.totalRoll ?? camera.roll ?? 0;
    if (Math.abs(camRoll) > 0.0005 && !x.visual.reducedMotion) {
      ctx.rotate(-camRoll);
    }
    const fovFactor = 55 / Math.max(45, camera.fov || 55);
    const effZoom = camera.zoom * (0.84 + 0.16 * fovFactor);
    ctx.scale(effZoom, effZoom);

    const shake = camera.shakeOffset;
    ctx.translate(-camera.x + shake.x, -camera.y + shake.y);

    const safeLayer = (fn) => {
      ctx.save();
      try {
        fn();
      } catch (err) {
        console.warn("[Renderer] Layer error:", err);
      } finally {
        ctx.restore();
      }
    };

    safeLayer(() => this.drawParallax(camera, width, height, time, biome, worldSim));
    if (worldSim) {
      safeLayer(() => worldSim.drawMidgroundLife(ctx, camera, this.terrain));
    }
    safeLayer(() => this.drawTerrain(camera, width, height, biome, worldSim));
    safeLayer(() => this.drawProps(propManager, camera));

    if (game?.echoManager) {
      safeLayer(() => this.drawMountainEchoes(game.echoManager, camera));
    }

    safeLayer(() => this.drawParticles(particles, ["dust", "snow", "grass", "wood"]));
    safeLayer(() => this.drawVehicle(vehicle, biome, worldSim));
    safeLayer(() => this.drawParticles(particles, ["spark", "grit", "stone"]));

    if (debug) {
      safeLayer(() => this.drawDebug(allBodies, vehicle, camera, game));
    }

    ctx.restore();

    if (worldSim) {
      worldSim.drawAtmosphericOverlay(ctx, width, height, camera, vehicle);
    }

    if ((x.visual.renderScale ?? 1) >= 0.88) {
      this.drawGrain(width, height);
    }
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

  drawParallax(cam, w, h, time, biome, worldSim = null) {
    const ctx = this.ctx;
    const amb = worldSim?.state?.lighting?.ambientIntensity ?? 1.0;
    const darken = b(1.0 - amb, 0, 0.58);
    const tintLayer = (hex) => (typeof lerpHexColor === "function" ? lerpHexColor(hex, "#141b22", darken) : hex);

    const layers = [
      { speed: 0.08, base: 240, amp: 145, freq: 0.0018, color: tintLayer(biome.far), opacity: 0.62, seed: 31 },
      { speed: 0.22, base: 165, amp: 112, freq: 0.0026, color: tintLayer(biome.mid), opacity: 0.78, seed: 44 },
      { speed: 0.42, base: 95,  amp: 78,  freq: 0.0038, color: tintLayer(biome.near), opacity: 0.92, seed: 57 },
    ];

    const spanX = w / cam.zoom;
    const left = cam.x - spanX * 0.68;
    const right = cam.x + spanX * 0.68;
    const bottomY = Math.max(cam.y + (h / cam.zoom) + 900, 12000);
    const step = 38;

    for (let li = 0; li < layers.length; li++) {
      const l = layers[li];
      const noise = this.parallaxNoises[l.seed] || K0(l.seed);
      ctx.save();
      ctx.fillStyle = l.color;
      ctx.globalAlpha = l.opacity;
      ctx.beginPath();
      ctx.moveTo(left - 20, bottomY);
      const camElevOffset = (cam.y - x.world.groundBase) * (1 - l.speed * 0.65);
      for (let px = left - 20; px <= right + 20; px += step) {
        const z = px - cam.x * (1 - l.speed);
        const ridge =
          noise(z * l.freq) * l.amp +
          noise(z * l.freq * 2.6) * (l.amp * 0.42);
        const py = x.world.groundBase + camElevOffset - l.base - ridge;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(right + 20, bottomY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawTerrain(cam, w, h, biome, worldSim = null) {
    const ctx = this.ctx;
    const terrain = this.terrain;
    const spanX = w / cam.zoom;
    const left = cam.x - spanX * 0.66;
    const right = cam.x + spanX * 0.66;

    const firstX = terrain.samples[0]?.x ?? 0;
    const step = terrain.step;
    const maxIdx = terrain.samples.length - 1;
    const startIdx = Math.max(0, Math.min(maxIdx, Math.floor((left - firstX) / step) - 2));
    const endIdx = Math.max(0, Math.min(maxIdx, Math.ceil((right - firstX) / step) + 2));

    if (startIdx >= endIdx || !terrain.samples[startIdx] || !terrain.samples[endIdx]) return;

    // 1. Terrain Bedrock Fill with Subterranean Depth Gradient & Topographic Strata
    const bottomY = Math.max(cam.y + (h / cam.zoom) + 900, 12000);
    ctx.save();
    const gradTop = cam.y - 80;
    const gradBot = cam.y + 340;
    const bedGrad = ctx.createLinearGradient(0, gradTop, 0, gradBot);
    bedGrad.addColorStop(0, biome.groundFill);
    bedGrad.addColorStop(0.45, "#151917");
    bedGrad.addColorStop(1, "#0c0f0e");
    ctx.fillStyle = bedGrad;
    ctx.beginPath();
    ctx.moveTo(terrain.samples[startIdx].x, bottomY);

    for (let i = startIdx; i <= endIdx; i++) {
      const p = terrain.samples[i];
      if (p) ctx.lineTo(p.x, p.y);
    }

    ctx.lineTo(terrain.samples[endIdx].x, bottomY);
    ctx.closePath();
    ctx.fill();

    // Subterranean Topographic Contour Lines (batched single stroke)
    ctx.strokeStyle = "rgba(239, 231, 214, 0.045)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    for (let layer = 1; layer <= 3; layer++) {
      const depthOffset = 75 + layer * 55;
      let cMoved = false;
      for (let i = startIdx; i <= endIdx; i += 6) {
        const p = terrain.samples[i];
        if (!p) continue;
        const wave = Math.sin(p.x * 0.0045 + layer * 1.7) * 16;
        const cy = p.y + depthOffset + wave;
        if (!cMoved) { ctx.moveTo(p.x, cy); cMoved = true; }
        else ctx.lineTo(p.x, cy);
      }
    }
    ctx.stroke();

    // 2. Illustrated Top Crust / Foliage Ribbon (modulated by seasonal snow cover)
    const snowCov = worldSim?.state?.memory?.snowCover ?? 0;
    ctx.lineWidth = 9.0;
    ctx.strokeStyle = snowCov > 0.35 ? "#dde5eb" : biome.groundTop;
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
    ctx.strokeStyle = snowCov > 0.25 ? "#f4f8fb" : biome.groundTopLight;
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
    if (worldSim) {
      worldSim.drawWorldEcosystem(ctx, cam, terrain, left, right, biome);
    }
    this.drawLandmarks(cam, left, right, worldSim);
  }

  drawTerrainDetails(terrain, left, right, biome) {
    const ctx = this.ctx;
    ctx.save();
    const step = 48;
    const start = Math.floor(left / step) * step;
    const end = Math.ceil(right / step) * step;

    ctx.strokeStyle = biome.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let q = start; q <= end; q += step) {
      const mat = terrain.materialAt(q);
      if (mat.name === "grass") {
        const y = terrain.heightAt(q);
        ctx.moveTo(q, y - 2);
        ctx.lineTo(q + 3, y - 8);
        ctx.moveTo(q + 4, y - 2);
        ctx.lineTo(q + 8, y - 9);
      }
    }
    ctx.stroke();

    ctx.fillStyle = "#1b1f1d";
    ctx.beginPath();
    for (let q = start; q <= end; q += step) {
      const mat = terrain.materialAt(q);
      if (mat.name === "rock" || mat.name === "gravel") {
        const y = terrain.heightAt(q);
        ctx.moveTo(q + 4, y - 2);
        ctx.arc(q + 2, y - 2, 2.0, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    ctx.restore();
  }

  drawLandmarks(cam, left, right, worldSim = null) {
    const ctx = this.ctx;
    const ws = worldSim?.state;
    const windX = ws ? ws.windVector.x : 4;
    const isNight = ws ? ws.sun.elevation < 0.16 : false;
    const snowCov = ws?.memory?.snowCover ?? 0;

    for (const bItem of BIOMES) {
      const lm = bItem.landmark;
      if (!lm || lm.x < left - 80 || lm.x > right + 80) continue;
      const ly = this.terrain.heightAt(lm.x);

      ctx.save();
      ctx.translate(lm.x, ly);

      if (lm.type === "shelter") {
        // Base Camp Outpost Cabin - Elevated to scenic background ridge off the road
        ctx.save();
        ctx.translate(0, -95);
        ctx.scale(0.68, 0.68);
        ctx.globalAlpha = 0.72;

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

        // Window with warm lantern light (brighter halo at night/dusk)
        if (isNight) {
          const glow = ctx.createRadialGradient(-10, -18, 2, -10, -18, 28);
          glow.addColorStop(0, "rgba(255, 215, 110, 0.65)");
          glow.addColorStop(1, "rgba(255, 215, 110, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(-10, -18, 28, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = isNight ? "#ffe484" : "#efd07b";
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

        if (snowCov > 0.15) {
          ctx.strokeStyle = `rgba(245, 250, 255, ${Math.min(0.95, snowCov)})`;
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(-36, -35);
          ctx.lineTo(0, -56);
          ctx.lineTo(36, -35);
          ctx.stroke();
          ctx.strokeStyle = "#1b1f1d";
          ctx.lineWidth = 2.4;
        }

        // Radio mast & wind-reactive windsock
        ctx.beginPath();
        ctx.moveTo(22, -56);
        ctx.lineTo(22, -92);
        ctx.moveTo(16, -76);
        ctx.lineTo(28, -76);
        ctx.stroke();

        const sockLen = b(8 + Math.abs(windX) * 0.9, 8, 22) * (windX >= 0 ? 1 : -1);
        const sockFlutter = Math.sin(Date.now() * 0.012) * 2.5;
        ctx.fillStyle = "#d4622a";
        ctx.beginPath();
        ctx.moveTo(22, -90);
        ctx.lineTo(22 + sockLen, -88 + sockFlutter);
        ctx.lineTo(22 + sockLen, -84 + sockFlutter);
        ctx.lineTo(22, -85);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#d4622a";
        ctx.beginPath();
        ctx.arc(22, -92, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else if (lm.type === "cairn") {
        // High Crag Cairn & Wind-Reactive Prayer Flag String
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
        const tNow = Date.now() * 0.01;
        for (let f = 0; f < flags.length; f++) {
          const flutter = Math.sin(tNow + f * 1.3) * (1.5 + Math.abs(windX) * 0.25);
          const stretch = b(windX * 0.4, -5, 8);
          ctx.fillStyle = flags[f];
          ctx.beginPath();
          ctx.moveTo(-18 + f * 9, -50 + f * 3);
          ctx.lineTo(-11 + f * 9 + stretch, -44 + f * 3 + flutter);
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
      const bBody = item.bodies[0];
      if (!bBody) continue;

      ctx.save();
      ctx.translate(bBody.position.x, bBody.position.y);
      ctx.rotate(bBody.angle);

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

    // Render physical rigid-body fracture debris planks
    if (propManager.debrisList && propManager.debrisList.length > 0) {
      for (const dItem of propManager.debrisList) {
        const bBody = dItem.body;
        if (!bBody) continue;
        ctx.save();
        ctx.globalAlpha = Math.min(1, dItem.life / 1.2);
        ctx.translate(bBody.position.x, bBody.position.y);
        ctx.rotate(bBody.angle);
        ctx.fillStyle = dItem.color || "#bca383";
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 1.4;
        ctx.fillRect(-dItem.w / 2, -dItem.h / 2, dItem.w, dItem.h);
        ctx.strokeRect(-dItem.w / 2, -dItem.h / 2, dItem.w, dItem.h);
        ctx.restore();
      }
    }
  }

  drawVehicle(vehicle, biome, worldSim = null) {
    const ctx = this.ctx;
    const chassis = vehicle.chassis;
    const vCfg = vehicle.archetype;
    const ws = worldSim?.state;

    // 0. Dynamic Sun-Angle Ground Shadow on Terrain Surface
    if (this.terrain) {
      const groundY = this.terrain.heightAt(chassis.position.x);
      const heightAbove = Math.max(0, groundY - chassis.position.y);
      if (heightAbove < 280) {
        const shadowDirX = ws?.sun?.shadowDirX ?? 0.35;
        const shadowAlpha = (ws?.lighting?.shadowAlpha ?? 0.22) * b(1 - heightAbove / 280, 0.15, 1);
        const shadowSpread = 1 + heightAbove * 0.004;
        const gSlope = this.terrain.slopeAt(chassis.position.x);
        ctx.save();
        ctx.translate(chassis.position.x + shadowDirX * (12 + heightAbove * 0.35), groundY + 1.5);
        ctx.rotate(Math.atan(gSlope));
        ctx.fillStyle = `rgba(12, 16, 15, ${shadowAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, (vCfg.chassisWidth * 0.58 + Math.abs(shadowDirX) * 18) * shadowSpread, 5.5 * shadowSpread, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

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
    this.drawArticulatedDriver(vehicle.driver, vehicle, worldSim);

    // Roll cage bar
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 18, -h / 2 - 8);
    ctx.lineTo(-w / 2 + 16, -h / 2 - 28);
    ctx.lineTo(-w / 2 + 42, -h / 2 - 28);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Whip Antenna & Expedition Pennant Flag (coupled to global WindSystem + vehicle velocity)
    const antX = -w / 2 + 16;
    const antBaseY = -h / 2 - 28;
    const antTopY = antBaseY - 24;
    const windPush = (ws?.windVector?.x ?? 0) * 0.55;
    const antBend = Math.sin(Date.now() * 0.006) * 3 + windPush - (vehicle.forwardSpeed || 0) * 0.6;
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(antX, antBaseY);
    ctx.quadraticCurveTo(antX + antBend * 0.5, antBaseY - 12, antX + antBend, antTopY);
    ctx.stroke();
    // Triangular pennant flag
    const flagDir = antBend > 1.5 ? 1 : -1;
    ctx.fillStyle = vCfg.accentColor;
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(antX + antBend, antTopY);
    ctx.lineTo(antX + antBend + flagDir * 14, antTopY + 4 + Math.sin(Date.now() * 0.012) * 1.6);
    ctx.lineTo(antX + antBend, antTopY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Front Rally Auxiliary Spot Lamps (with volumetric long-beam cone at dusk/night/fog/storm)
    const lampX = w / 2 - 8;
    const lampY = -h / 2 + 2;
    const lowLight = ws ? (ws.sun.elevation < 0.22 || ws.fogDensity > 0.35 || ws.precipitation > 0.35) : false;
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
    ctx.fillStyle = lowLight ? "#fff29c" : "#fadb6a";
    ctx.beginPath();
    ctx.ellipse(lampX + 6.5, lampY - 2, 2.2, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Warm halogen beam forward
    const beamLen = lowLight ? 185 : 52;
    const beamSpread = lowLight ? 38 : 12;
    const beamGrad = ctx.createLinearGradient(lampX + 7, lampY - 2, lampX + beamLen, lampY - 2);
    beamGrad.addColorStop(0, lowLight ? "rgba(255, 240, 165, 0.42)" : "rgba(255, 235, 150, 0.16)");
    beamGrad.addColorStop(1, "rgba(255, 235, 150, 0)");
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(lampX + 7, lampY - 4);
    ctx.lineTo(lampX + beamLen, lampY - beamSpread);
    ctx.lineTo(lampX + beamLen, lampY + beamSpread * 0.75);
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

  drawArticulatedDriver(driver, vehicle, worldSim = null) {
    const ctx = this.ctx;
    // Driver seated naturally inside the cockpit (or driven by physical Matter.js crash ragdoll)
    let hipX = -26;
    let hipY = -12 + (driver.jolt || 0);

    const spineAngle = (driver.lean || 0) * 0.72;
    const torsoLen = 17;
    let shoulderX = hipX + Math.sin(spineAngle) * torsoLen;
    let shoulderY = hipY - Math.cos(spineAngle) * torsoLen;

    let headX = shoulderX + Math.sin(spineAngle + (driver.neckAngle || 0) * 0.35) * 9;
    let headY = shoulderY - Math.cos(spineAngle + (driver.neckAngle || 0) * 0.35) * 9;

    const wheelHubX = -9;
    const wheelHubY = -23;

    let handX = wheelHubX;
    let handY = (driver.victory || 0) > 0.1 ? wheelHubY - 18 : wheelHubY - 2;

    if (driver.ragdollActive && driver.ragdollBodies?.length >= 2 && vehicle?.chassis) {
      const cPos = vehicle.chassis.position;
      const cAng = vehicle.chassis.angle;
      const cos = Math.cos(-cAng);
      const sin = Math.sin(-cAng);
      const toLocal = (wPt) => {
        const dx = wPt.x - cPos.x;
        const dy = wPt.y - cPos.y;
        return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
      };
      const tLoc = toLocal(driver.ragdollBodies[0].position);
      const hLoc = toLocal(driver.ragdollBodies[1].position);
      shoulderX = tLoc.x;
      shoulderY = tLoc.y - 6;
      hipX = tLoc.x - 3;
      hipY = tLoc.y + 8;
      headX = hLoc.x;
      headY = hLoc.y;
      if (driver.ragdollBodies[2]) {
        const aLoc = toLocal(driver.ragdollBodies[2].position);
        handX = aLoc.x;
        handY = aLoc.y;
      }
    }

    const footX = -3;
    const footY = -6;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 1. Dynamic Wind-Blown Expedition Scarf (Trailing silk ribbon coupled to global wind + vehicle speed)
    const windRel = (worldSim?.state?.windVector?.x ?? 0) * 0.35;
    const spd = (vehicle ? Math.abs(vehicle.forwardSpeed || 0) : 0) + Math.abs(windRel);
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
    ctx.save();
    for (let i = 0; i < particleSystem.pool.length; i++) {
      const p = particleSystem.pool[i];
      if (!p.active || !kinds.includes(p.kind)) continue;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      const half = p.size * 0.5;
      ctx.fillRect(p.x - half, p.y - half, p.size, p.size);
    }
    ctx.restore();
  }

  drawGrain(w, h) {
    const ctx = this.ctx;
    if (!this.grainCanvas) {
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 160;
      const gctx = c.getContext("2d");
      const img = gctx.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const val = Math.random() > 0.5 ? 24 : 225;
        img.data[i] = val;
        img.data[i + 1] = val;
        img.data[i + 2] = val;
        img.data[i + 3] = 6;
      }
      gctx.putImageData(img, 0, 0);
      this.grainCanvas = c;
      this.grainPattern = ctx.createPattern(c, "repeat");
    }

    if (!this.grainPattern) return;
    ctx.save();
    ctx.fillStyle = this.grainPattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawVignette(w, h) {
    const ctx = this.ctx;
    if (!this.vigGrad || this.vigW !== w || this.vigH !== h) {
      this.vigW = w;
      this.vigH = h;
      const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
      vig.addColorStop(0, "rgba(27,31,29,0)");
      vig.addColorStop(1, "rgba(27,31,29,0.18)");
      this.vigGrad = vig;
    }
    ctx.save();
    ctx.fillStyle = this.vigGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawDebug(bodies, vehicle, camera, game) {
    const ctx = this.ctx;
    ctx.save();

    // 1. Slope & Difficulty Heatmap Ribbon along visible terrain (Section 53)
    const terrain = this.terrain;
    if (terrain?.samples?.length > 1) {
      const firstX = terrain.samples[0].x;
      const step = terrain.step;
      const startIdx = Math.max(0, Math.floor((camera.x - 1100 - firstX) / step));
      const endIdx = Math.min(terrain.samples.length - 2, Math.ceil((camera.x + 1100 - firstX) / step));

      ctx.lineWidth = 5.0;
      for (let i = startIdx; i <= endIdx; i += 2) {
        const p1 = terrain.samples[i];
        const p2 = terrain.samples[Math.min(terrain.samples.length - 1, i + 2)];
        if (!p1 || !p2) continue;
        const sDeg = Math.abs((Math.atan(p1.slope) * 180) / Math.PI);
        if (sDeg < 12) ctx.strokeStyle = "rgba(78, 154, 104, 0.85)"; // EASY
        else if (sDeg < 22) ctx.strokeStyle = "rgba(216, 155, 60, 0.85)"; // MODERATE
        else if (sDeg < 32) ctx.strokeStyle = "rgba(212, 98, 42, 0.90)"; // HARD
        else ctx.strokeStyle = "rgba(194, 50, 40, 0.95)"; // EXTREME

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y - 10);
        ctx.lineTo(p2.x, p2.y - 10);
        ctx.stroke();
      }
    }

    // 2. Static & Dynamic Wireframes
    ctx.strokeStyle = "rgba(212,98,42,0.85)";
    ctx.lineWidth = 1;
    for (const bBody of bodies) {
      const verts = bBody.vertices;
      if (!verts || verts.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (const v of verts) ctx.lineTo(v.x, v.y);
      ctx.closePath();
      ctx.stroke();
    }

    // 3. Chassis Velocity Vector
    ctx.strokeStyle = "#2ea3a5";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(vehicle.chassis.position.x, vehicle.chassis.position.y);
    ctx.lineTo(
      vehicle.chassis.position.x + vehicle.chassis.velocity.x * 12,
      vehicle.chassis.position.y + vehicle.chassis.velocity.y * 12
    );
    ctx.stroke();

    // 4. Center of Mass
    ctx.fillStyle = "#d4622a";
    ctx.beginPath();
    ctx.arc(vehicle.chassis.position.x, vehicle.chassis.position.y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Wheel Contacts & Normals
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

    // 6. Predicted Jump Ballistic Trajectory
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

    // 7. Cinematic Camera Director 2.0 Visual Reticles (Section 49)
    if (camera) {
      // 7a. Look-ahead velocity prediction point (Gold diamond + dashed vector)
      if (camera.predictedPos) {
        ctx.save();
        ctx.strokeStyle = "rgba(216, 155, 60, 0.78)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(vehicle.chassis.position.x, vehicle.chassis.position.y);
        ctx.lineTo(camera.predictedPos.x, camera.predictedPos.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#d89b3c";
        ctx.beginPath();
        ctx.moveTo(camera.predictedPos.x, camera.predictedPos.y - 7);
        ctx.lineTo(camera.predictedPos.x + 7, camera.predictedPos.y);
        ctx.lineTo(camera.predictedPos.x, camera.predictedPos.y + 7);
        ctx.lineTo(camera.predictedPos.x - 7, camera.predictedPos.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 7b. Terrain Focus Point ahead (Teal crosshair)
      if (camera.terrainFocusPoint) {
        const tf = camera.terrainFocusPoint;
        ctx.save();
        ctx.strokeStyle = "#2ea3a5";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(tf.x, tf.y, 9, 0, Math.PI * 2);
        ctx.moveTo(tf.x - 14, tf.y);
        ctx.lineTo(tf.x + 14, tf.y);
        ctx.moveTo(tf.x, tf.y - 14);
        ctx.lineTo(tf.x, tf.y + 14);
        ctx.stroke();
        ctx.restore();
      }

      // 7c. Ballistic Landing Zone marker when airborne
      if (camera.landingZone && camera.landingZone.active) {
        const lz = camera.landingZone;
        ctx.save();
        ctx.strokeStyle = "#e05a47";
        ctx.fillStyle = "rgba(224, 90, 71, 0.22)";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(lz.x, lz.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 7d. Authoritative Camera Target Point (Burnt-orange target reticle)
      if (camera.targetPoint) {
        const tp = camera.targetPoint;
        ctx.save();
        ctx.strokeStyle = "#d4622a";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#d4622a";
        ctx.fill();
        ctx.restore();
      }
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

      const glowR = 26 + relic.glow * 16;
      const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, glowR);
      grad.addColorStop(0, "rgba(212, 98, 42, 0.45)");
      grad.addColorStop(0.5, "rgba(212, 98, 42, 0.18)");
      grad.addColorStop(1, "rgba(239, 231, 214, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();

      const rot = relic.rotation;
      const s = 13.0;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);

      const top = { x: 0, y: -s * 1.4 };
      const btm = { x: 0, y: s * 1.4 };
      const v0 = { x: -s * cosR, y: -s * 0.35 * sinR };
      const v1 = { x: s * sinR, y: -s * 0.35 * cosR };
      const v2 = { x: s * cosR, y: s * 0.35 * sinR };

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
    const cam = game.camera;
    const chassis = v.chassis;
    const pos = chassis.position;
    const vel = chassis.velocity;
    const seg = this.terrain.segmentAt(pos.x);
    const nextSeg = this.terrain.segmentAt(pos.x + 600);
    const slope = this.terrain.slopeAt(pos.x);
    const curv = this.terrain.curvatureAt ? this.terrain.curvatureAt(pos.x) : 0;
    const mat = this.terrain.materialAt(pos.x);
    const biome = this.terrain.biomeAt(pos.x);
    const chunkId = this.terrain.chunkAt ? this.terrain.chunkAt(pos.x) : 0;
    const tStats = this.terrain.stats || {};

    const nf = v.normalLoads?.front ?? 0;
    const nr = v.normalLoads?.rear ?? 0;
    const sf = v.wheels[1]?.slipRatio ?? 0;
    const sr = v.wheels[0]?.slipRatio ?? 0;

    const camState = cam?.state || "FOLLOW";
    const camShot = cam?.shotType || "SHOT_FOLLOW";
    const camZoom = (cam?.zoom ?? 0.78).toFixed(3);
    const camFov = (cam?.fov ?? 55).toFixed(1);
    const camRollDeg = (((cam?.totalRoll ?? 0) * 180) / Math.PI).toFixed(2);
    const camLook = Math.round(cam?.lookAheadDistance ?? 0);
    const spVelX = (cam?.springVelocity?.x ?? 0).toFixed(1);
    const spVelY = (cam?.springVelocity?.y ?? 0).toFixed(1);
    const spErrX = (cam?.springError?.x ?? 0).toFixed(1);
    const spErrY = (cam?.springError?.y ?? 0).toFixed(1);
    const impInt = (cam?.impact?.intensity ?? 0).toFixed(2);
    const cineRatio = (((cam?.shotDirector?.getCinematicRatio?.() ?? 0) * 100)).toFixed(0);

    const ws = game.worldSim?.state;
    const wHours = ws ? Math.floor(ws.timeMinutes / 60) : 9;
    const wMins = ws ? Math.floor(ws.timeMinutes % 60) : 30;
    const wTimeStr = `${String(wHours).padStart(2, "0")}:${String(wMins).padStart(2, "0")} (${ws?.phaseName || "MORNING"})`;
    const wSeason = ws ? `${ws.season}${ws.seasonTransition > 0.05 ? `->${ws.targetSeason}` : ""}` : "AUTUMN";
    const wWeather = ws ? `${ws.weather} (${Math.round((ws.precipitation || 0) * 100)}% PRECIP)` : (biome.weather || "CLEAR");
    const wTemp = ws ? `${ws.temperature.toFixed(1)}°C` : "8.0°C";
    const wHum = ws ? `${Math.round(ws.humidity * 100)}%` : "45%";
    const wWind = ws ? `${ws.windVector.x.toFixed(1)} m/s (GUST ${ws.windGust.toFixed(1)})` : "2.5 m/s";
    const wEnt = ws?.entityCounts || {};
    const wLod = ws?.lodCounts || { near: 0, mid: 0, far: 0 };
    const wEvents = ws?.activeEvents?.length ? ws.activeEvents.join(", ") : "IDLE_ECOSYSTEM";
    const wSimMs = (ws?.simStepMs ?? 0.2).toFixed(2);

    const lines = [
      `DIAGNOSTICS (F3)  FPS: ${game.fps.toFixed(0)}  STEP: 8.33ms  WORLD_SIM: ${wSimMs}ms  SEED: ${game.seed}`,
      `WORLD STATE: TIME=${wTimeStr}  SEASON=${wSeason}  TEMP=${wTemp}  HUM=${wHum}`,
      `WORLD ATMO: WEATHER=[${wWeather}]  WIND=${wWind}  MOON=${ws?.moon?.phaseName || "CRESCENT"}`,
      `WORLD ENTITIES: BIRDS=${wEnt.birds || 0} ANIM=${wEnt.animals || 0} INS=${wEnt.insects || 0} NPC=${wEnt.npcs || 0} VEH=${wEnt.traffic || 0} CLD=${wEnt.clouds || 0}`,
      `WORLD LOD & EVENTS: NEAR=${wLod.near} MID=${wLod.mid} FAR=${wLod.far}  EVENTS=[${wEvents}]`,
      `CAMERA DIRECTOR: STATE=[${camState}]  SHOT=[${camShot}]  CINE_BUDGET: ${cineRatio}%`,
      `CAM OPTICS: ZOOM=${camZoom}x  FOV=${camFov}°  ROLL=${camRollDeg}°  LOOKAHEAD=${camLook}px`,
      `CAM SPRING: VEL=(${spVelX}, ${spVelY})  ERR=(${spErrX}, ${spErrY})  IMPACT=${impInt}`,
      `CAM FOCUS: TARGET=(${Math.round(cam?.targetPoint?.x || 0)}, ${Math.round(cam?.targetPoint?.y || 0)})  TERRAIN=(${Math.round(cam?.terrainFocusPoint?.x || 0)}, ${Math.round(cam?.terrainFocusPoint?.y || 0)})`,
      `VEHICLE: ${v.archetype.name.toUpperCase()}  WORLD BODIES: ${Matter.Composite.allBodies(game.engine.world).length}`,
      `STREAMING: CHUNK #${chunkId}/${this.terrain.chunks?.length || 0} (ACTIVE CHUNKS: ${this.terrain.activeChunkCount || 0}, BODIES: ${this.terrain.bodies?.length || 0})`,
      `BIOME: ${biome.act || "ACT I"} // ${biome.name.toUpperCase()}  SEG: ${seg.name} [${seg.type}]`,
      `SLOPE: ${(slope * 180 / Math.PI).toFixed(1)}° (MAX ${seg.maxSlope ?? 20}°)  CURV: ${curv.toFixed(4)}  MAT: ${mat.name.toUpperCase()}`,
      `UPCOMING (+15m): ${nextSeg.name} [${nextSeg.type}]  JUMP_POT: ${nextSeg.jumpPotential || "Low"}`,
      `WORLD STATS: ${tStats.totalDistanceKm || 8.2}km | GAIN:+${tStats.totalElevationGain || 0}m | DROP:-${tStats.maxDescentMeters || 0}m | VAR:${tStats.diversityPercent || 94}%`,
      `NORMAL FORCES: F=${nf.toFixed(1)}N  R=${nr.toFixed(1)}N  SLIP: F=${sf.toFixed(2)} R=${sr.toFixed(2)}`,
      `SPEED: ${(Math.abs(v.forwardSpeed) * 7.2).toFixed(1)} km/h  VERT: ${vel.y.toFixed(1)}  RPM: ${(v.rpm * 100).toFixed(0)}%`,
      `SUSPENSION: R=${v.wheels[0].compression.toFixed(2)} F=${v.wheels[1].compression.toFixed(2)}  ROOF: ${v.roofContact}`,
      `AIRBORNE: ${v.airborne}  AIRTIME: ${(game.stunts.airtime / 1000).toFixed(2)}s  STUNT: ${game.stunts.activeStuntName || "NONE"}`,
      `HOTKEYS: [1-4]SEEDS [5]+3H_TIME [6]WEATHER [7]SEASON [8]WORLD_EVENT [T]EXPORT`,
    ];

    ctx.save();
    ctx.fillStyle = "rgba(18, 22, 20, 0.88)";
    const panelW = 575;
    const panelH = lines.length * 14.2 + 18;
    ctx.fillRect(w - panelW - 16, h - panelH - 16, panelW, panelH);
    ctx.strokeStyle = "var(--hot)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w - panelW - 16, h - panelH - 16, panelW, panelH);

    ctx.font = "10.0px 'Courier New', monospace";
    ctx.fillStyle = "#efe7d6";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], w - panelW - 6, h - panelH + 4 + i * 14.2);
    }
    ctx.restore();
  }
}


// ============================================================================
// MASTER HUD 2.0 — LIVING EXPEDITION INSTRUMENT SYSTEM
// ============================================================================

// 1. HUDTheme — Physical Material & Motion Tokens (Sections 18, 19, 21)
const HUDTheme = {
  colors: {
    ink: "#111513",
    anodized: "#141917",
    paper: "#efe7d6",
    muted: "rgba(239, 231, 214, 0.50)",
    mutedStrong: "rgba(239, 231, 214, 0.76)",
    orange: "#d4622a",
    brass: "#c8a464",
    line: "rgba(239, 231, 214, 0.16)",
    warning: "#e25822",
  },
  motionCategories: {
    MECHANICAL: "cubic-bezier(0.19, 1, 0.22, 1)",
    INERTIAL: { k: 82, c: 13.5 },
    ORGANIC: "cubic-bezier(0.25, 1, 0.5, 1)",
    GEOMETRIC: "linear",
    TACTILE: "cubic-bezier(0.12, 0.8, 0.32, 1)",
    ATMOSPHERIC: "cubic-bezier(0.23, 1, 0.32, 1)",
    CINEMATIC: "cubic-bezier(0.16, 1, 0.3, 1)",
    EMERGENCY: "cubic-bezier(0.08, 0.92, 0.18, 1)",
  },
};

// 2. HUDStateMachine — Explicit 17-State HUD Controller (Section 22)
class HUDStateMachine {
  current = "BOOT";
  previous = "BOOT";
  stateTimer = 0;
  overrideState = null;
  overrideDuration = 0;
  hudEl = null;

  static STATES = [
    "BOOT",
    "IDLE",
    "DRIVING",
    "ACCELERATING",
    "BRAKING",
    "AIRBORNE",
    "STUNT",
    "LANDING",
    "LOW_RESOURCE",
    "DANGER",
    "INVERTED",
    "ECHO_DISCOVERY",
    "SECTOR_CHANGE",
    "PAUSED",
    "CRASH",
    "DEATH",
    "DEBRIEF",
  ];

  init() {
    this.hudEl = document.getElementById("hud");
    this.current = "BOOT";
    this.previous = "BOOT";
    this.stateTimer = 0;
    this.overrideState = null;
    this.overrideDuration = 0;
  }

  triggerTransientState(stateName, durationMs = 1200) {
    this.overrideState = stateName;
    this.overrideDuration = durationMs;
    this.applyStateClasses(stateName);
  }

  evaluate(telemetry, dt = 16.666) {
    this.stateTimer += dt;
    if (this.overrideDuration > 0) {
      this.overrideDuration -= dt;
      if (this.overrideDuration <= 0) {
        this.overrideState = null;
      }
    }

    let next = "IDLE";
    if (telemetry.isDead) {
      next = telemetry.debriefVisible ? "DEBRIEF" : "DEATH";
    } else if (telemetry.isPaused) {
      next = "PAUSED";
    } else if (this.overrideState) {
      next = this.overrideState;
    } else if (telemetry.inverted) {
      next = "INVERTED";
    } else if (telemetry.airborne) {
      next = Math.abs(telemetry.cumulativeAirAngle) > 1.8 || telemetry.activeStunt ? "STUNT" : "AIRBORNE";
    } else if (telemetry.fuel < 0.22) {
      next = "LOW_RESOURCE";
    } else if (Math.abs(telemetry.incline) > 34) {
      next = "DANGER";
    } else if (telemetry.brake > 0.1) {
      next = "BRAKING";
    } else if (telemetry.throttle > 0.1) {
      next = "ACCELERATING";
    } else if (telemetry.speed > 3) {
      next = "DRIVING";
    } else {
      next = "IDLE";
    }

    if (next !== this.current) {
      this.previous = this.current;
      this.current = next;
      this.stateTimer = 0;
      this.applyStateClasses(next);
    }
    return this.current;
  }

  applyStateClasses(state) {
    if (!this.hudEl) return;
    this.hudEl.setAttribute("data-hud-state", state);
    this.hudEl.classList.toggle("hud-state-airborne", state === "AIRBORNE" || state === "STUNT");
    this.hudEl.classList.toggle("hud-state-echo", state === "ECHO_DISCOVERY");
  }

  reset() {
    this.overrideState = null;
    this.overrideDuration = 0;
    this.current = "IDLE";
    this.applyStateClasses("IDLE");
  }
}

// 3. HUDThreeInstruments — Subtle 3D Mechanical Bevels, Gimbal & 4WD Wireframe (Sections 1 & 20)
class HUDThreeInstruments {
  canvas = null;
  renderer = null;
  scene = null;
  camera = null;
  speedoGroup = null;
  speedoInnerRing = null;
  compassGroup = null;
  drivetrainGroup = null;
  wheelMeshes = [];
  enabled = false;
  width = 0;
  height = 0;

  init() {
    this.canvas = document.getElementById("hud-three-canvas");
    if (!this.canvas || typeof THREE === "undefined") return;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(1);
      this.scene = new THREE.Scene();

      this.width = window.innerWidth || 1280;
      this.height = window.innerHeight || 720;
      this.camera = new THREE.OrthographicCamera(
        -this.width / 2,
        this.width / 2,
        this.height / 2,
        -this.height / 2,
        -500,
        500
      );
      this.camera.position.z = 200;

      const bronzeMat = new THREE.LineBasicMaterial({
        color: 0xefe7d6,
        transparent: true,
        opacity: 0.18,
      });
      const orangeMat = new THREE.LineBasicMaterial({
        color: 0xd4622a,
        transparent: true,
        opacity: 0.34,
      });

      // 1. Speedometer 3D Cylindrical Bevel Ring & Inner Calibration Ring
      this.speedoGroup = new THREE.Group();
      const outerTorus = new THREE.TorusGeometry(74, 1.4, 8, 48);
      const outerEdges = new THREE.EdgesGeometry(outerTorus);
      this.speedoGroup.add(new THREE.LineSegments(outerEdges, bronzeMat));

      const innerRingGeo = new THREE.RingGeometry(52, 53.2, 32);
      const innerEdges = new THREE.EdgesGeometry(innerRingGeo);
      this.speedoInnerRing = new THREE.LineSegments(innerEdges, orangeMat);
      this.speedoInnerRing.position.z = 6;
      this.speedoGroup.add(this.speedoInnerRing);
      this.scene.add(this.speedoGroup);

      // 2. Compass 3D Gyroscopic Binnacle Gimbal Ring
      this.compassGroup = new THREE.Group();
      const gimbalGeo = new THREE.TorusGeometry(24, 0.8, 6, 32);
      const gimbalEdges = new THREE.EdgesGeometry(gimbalGeo);
      this.compassGroup.add(new THREE.LineSegments(gimbalEdges, bronzeMat));
      this.scene.add(this.compassGroup);

      // 3. 4WD Miniature 3D Technical Drivetrain & Axle Silhouette
      this.drivetrainGroup = new THREE.Group();
      const chassisGeo = new THREE.BoxGeometry(22, 5, 10);
      const chassisEdges = new THREE.EdgesGeometry(chassisGeo);
      this.drivetrainGroup.add(new THREE.LineSegments(chassisEdges, bronzeMat));

      const wheelGeo = new THREE.CylinderGeometry(3.2, 3.2, 2.2, 10);
      wheelGeo.rotateX(Math.PI / 2);
      const wheelEdges = new THREE.EdgesGeometry(wheelGeo);
      const wheelOffsets = [
        [-8, -2.5, 6],
        [-8, -2.5, -6],
        [8, -2.5, 6],
        [8, -2.5, -6],
      ];
      this.wheelMeshes = [];
      for (const [wx, wy, wz] of wheelOffsets) {
        const wMesh = new THREE.LineSegments(wheelEdges, orangeMat);
        wMesh.position.set(wx, wy, wz);
        this.drivetrainGroup.add(wMesh);
        this.wheelMeshes.push(wMesh);
      }
      this.scene.add(this.drivetrainGroup);

      this.enabled = true;
      this.resize();
    } catch (e) {
      this.enabled = false;
    }
  }

  resize() {
    if (!this.enabled || !this.renderer || !this.camera) return;
    this.width = window.innerWidth || 1280;
    this.height = window.innerHeight || 720;
    this.renderer.setSize(this.width, this.height, false);
    this.camera.left = -this.width / 2;
    this.camera.right = this.width / 2;
    this.camera.top = this.height / 2;
    this.camera.bottom = -this.height / 2;
    this.camera.updateProjectionMatrix();

    // Anchor 3D instruments to exact HUD layout coordinates
    if (this.speedoGroup) {
      this.speedoGroup.position.set(0, -this.height / 2 + 96, 0);
    }
    if (this.compassGroup) {
      this.compassGroup.position.set(this.width / 2 - 52, this.height / 2 - 48, 0);
    }
    if (this.drivetrainGroup) {
      this.drivetrainGroup.position.set(this.width / 2 - 45, -this.height / 2 + 34, 0);
    }
  }

  update(telemetry, dt = 16.666) {
    if (!this.enabled || !this.renderer || !this.scene || !this.camera) return;
    this.frameCount = (this.frameCount || 0) + 1;
    if (this.frameCount % 3 !== 0) return;
    if (this.canvas && this.canvas.style.display !== "block") {
      const hudEl = document.getElementById("hud");
      if (hudEl && hudEl.style.display === "block") {
        this.canvas.style.display = "block";
      } else {
        return;
      }
    }

    const reduce = x.visual.reducedMotion;
    const pitchRad = (telemetry.incline || 0) * (Math.PI / 180);
    const speedNorm = b((telemetry.speed || 0) / 130, 0, 1);
    const accelTilt = (telemetry.throttle - telemetry.brake) * 0.14;

    if (this.speedoGroup) {
      const targetRx = reduce ? 0 : 0.18 + accelTilt * 0.35;
      const targetRy = reduce ? 0 : -pitchRad * 0.25;
      this.speedoGroup.rotation.x += (targetRx - this.speedoGroup.rotation.x) * 0.15;
      this.speedoGroup.rotation.y += (targetRy - this.speedoGroup.rotation.y) * 0.15;
      if (this.speedoInnerRing) {
        this.speedoInnerRing.rotation.z = -speedNorm * Math.PI * 0.85;
      }
    }

    if (this.compassGroup) {
      const targetCx = reduce ? 0 : 0.28 + pitchRad * 0.45;
      const targetCy = reduce ? 0 : Math.sin((telemetry.distance || 0) * 0.04) * 0.22;
      this.compassGroup.rotation.x += (targetCx - this.compassGroup.rotation.x) * 0.12;
      this.compassGroup.rotation.y += (targetCy - this.compassGroup.rotation.y) * 0.12;
      this.compassGroup.rotation.z = -pitchRad * 0.5;
    }

    if (this.drivetrainGroup) {
      this.drivetrainGroup.rotation.x = 0.22;
      this.drivetrainGroup.rotation.y = -0.38;
      this.drivetrainGroup.rotation.z = reduce ? 0 : b(-pitchRad * 0.65, -0.6, 0.6);
      const spinStep = (telemetry.wheelSpin || 0) * (dt / 1000) * 4.8;
      for (const wMesh of this.wheelMeshes) {
        wMesh.rotation.z -= spinStep;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  reset() {
    if (this.speedoGroup) this.speedoGroup.rotation.set(0, 0, 0);
    if (this.compassGroup) this.compassGroup.rotation.set(0, 0, 0);
    if (this.drivetrainGroup) this.drivetrainGroup.rotation.set(0.22, -0.38, 0);
  }
}

// 4. HUDAnimations — Safe Named Timeline Manager & Global Motion System (Sections 18, 19, 23)
class HUDAnimations {
  hasGSAP = false;
  lenis = null;
  relicLottie = null;
  timelines = new Map();

  init() {
    this.hasGSAP = typeof window.gsap !== "undefined";
    this.initLenis();
    this.initLottie();
  }

  createTimeline(name, vars = {}) {
    this.killTimeline(name);
    if (!this.hasGSAP) return null;
    const tl = window.gsap.timeline(vars);
    this.timelines.set(name, tl);
    return tl;
  }

  killTimeline(name) {
    const existing = this.timelines.get(name);
    if (existing) {
      existing.kill();
      this.timelines.delete(name);
    }
  }

  killAllTimelines() {
    for (const [, tl] of this.timelines) {
      tl.kill();
    }
    this.timelines.clear();
  }

  initLenis() {
    if (typeof window.Lenis === "undefined") return;
    try {
      const garageCard = document.querySelector("#garage-screen .card");
      if (garageCard) {
        this.lenis = new window.Lenis({
          wrapper: garageCard,
          content: garageCard,
          duration: 0.9,
          smoothWheel: true,
        });
      }
    } catch (e) {}
  }

  initLottie() {
    if (typeof window.lottie === "undefined") return;
    const container = document.getElementById("hud-lottie-relic");
    if (!container) return;
    try {
      container.innerHTML = "";
      const lottieData = {
        v: "5.7.4",
        fr: 60,
        ip: 0,
        op: 90,
        w: 32,
        h: 32,
        nm: "EchoPulse",
        ddd: 0,
        assets: [],
        layers: [
          {
            ddd: 0,
            ind: 1,
            ty: 4,
            nm: "Ring",
            sr: 1,
            ks: {
              o: {
                a: 1,
                k: [
                  { t: 0, s: [95] },
                  { t: 45, s: [25] },
                  { t: 90, s: [95] },
                ],
              },
              r: { a: 0, k: 0 },
              p: { a: 0, k: [16, 16, 0] },
              a: { a: 0, k: [0, 0, 0] },
              s: {
                a: 1,
                k: [
                  { t: 0, s: [70, 70, 100] },
                  { t: 45, s: [115, 115, 100] },
                  { t: 90, s: [70, 70, 100] },
                ],
              },
            },
            ao: 0,
            shapes: [
              {
                ty: "gr",
                it: [
                  {
                    d: 1,
                    ty: "el",
                    s: { a: 0, k: [18, 18] },
                    p: { a: 0, k: [0, 0] },
                  },
                  {
                    ty: "st",
                    c: { a: 0, k: [0.831, 0.384, 0.165, 1] },
                    o: { a: 0, k: 100 },
                    w: { a: 0, k: 2.2 },
                  },
                  {
                    ty: "tr",
                    p: { a: 0, k: [0, 0] },
                    a: { a: 0, k: [0, 0] },
                    s: { a: 0, k: [100, 100] },
                    r: { a: 0, k: 0 },
                    o: { a: 0, k: 100 },
                  },
                ],
              },
            ],
            ip: 0,
            op: 90,
            st: 0,
          },
        ],
      };
      this.relicLottie = window.lottie.loadAnimation({
        container,
        renderer: "svg",
        loop: true,
        autoplay: false,
        animationData: lottieData,
      });
    } catch (e) {}
  }

  // Distinct Instrument-Specific Boot Sequence (Never uses generic identical fades)
  animateHUDIntro(hudManager) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const tl = this.createTimeline("hudBoot", { defaults: { ease: "power3.out" } });
    if (!tl) return;

    tl.fromTo(
      "#hud-emblem-svg",
      { opacity: 0, scale: 0.94 },
      { opacity: 1, scale: 1, duration: 0.38 },
      0
    )
      .fromTo(
        "#hud-brand-rule",
        { scaleX: 0 },
        { scaleX: 1, duration: 0.48, ease: "expo.out" },
        0.06
      )
      .fromTo(
        "#hud-brand-title, .hud-brand-sub",
        { opacity: 0, x: -6 },
        { opacity: 1, x: 0, duration: 0.36, stagger: 0.05 },
        0.1
      )
      .fromTo(
        "#hud-telemetry-block",
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: 0.42 },
        0.14
      )
      .fromTo(
        "#hud-top-center",
        { opacity: 0, y: -6 },
        { opacity: 1, y: 0, duration: 0.42 },
        0.16
      )
      .fromTo(
        "#hud-top-right",
        { opacity: 0, x: 8 },
        { opacity: 1, x: 0, duration: 0.42 },
        0.18
      )
      .fromTo(
        "#hud-right-column, #hud-vehicle-status",
        { opacity: 0, x: 6 },
        { opacity: 1, x: 0, duration: 0.42, stagger: 0.05 },
        0.2
      )
      .fromTo(
        "#hud-gauges-cluster, #pedals",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.46 },
        0.12
      );

    // Mechanical Needle Calibration Sweep (Speedometer = heavy inertia; RPM = snappy)
    if (hudManager?.speedometer && hudManager?.rpmGauge) {
      const cal = { sweep: 0 };
      const calTl = this.createTimeline("needleCal");
      calTl?.to(cal, {
        sweep: 1,
        duration: 0.32,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
        onUpdate: () => {
          hudManager.speedometer.calibrationOffset = cal.sweep * 54;
          hudManager.rpmGauge.calibrationOffset = cal.sweep * 42;
        },
        onComplete: () => {
          hudManager.speedometer.calibrationOffset = 0;
          hudManager.rpmGauge.calibrationOffset = 0;
        },
      });
    }
  }

  animateStunt(stuntData) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const tl = this.createTimeline("stuntPulse");
    tl?.fromTo(
      "#hud-right-labels",
      { x: 5, opacity: 0.65 },
      { x: 0, opacity: 1, duration: 0.22, ease: "power2.out" },
      0
    ).fromTo(
      "#hud-stunt-bar-top",
      { filter: "brightness(1.5)" },
      { filter: "brightness(1.0)", duration: 0.28, ease: "power2.out" },
      0
    );
  }

  animateLanding(compression = 0.5) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const dip = Math.min(4.8, Math.max(1.4, compression * 4.8));
    const tl = this.createTimeline("landingCompress");
    tl?.fromTo(
      "#hud-gauges-cluster",
      { y: dip },
      { y: 0, duration: 0.26, ease: "back.out(2.2)" },
      0
    )
      .fromTo(
        "#hud-right-column",
        { y: dip * 1.1 },
        { y: 0, duration: 0.28, ease: "back.out(2.0)" },
        0
      )
      .fromTo(
        "#hud-stunt-pulse-ring",
        { attr: { r: 14 }, opacity: 0.9 },
        { attr: { r: 22 }, opacity: 0, duration: 0.38, ease: "power2.out" },
        0
      );
  }

  animateCrash(severity = "heavy") {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const mag = severity === "critical" ? 5.5 : 2.8;
    const tl = this.createTimeline("crashJolt");
    tl?.fromTo(
      "#hud-gauges-cluster",
      { x: -mag },
      { x: 0, duration: 0.24, ease: "elastic.out(1.1, 0.32)" },
      0
    );
  }

  animateInversion(isInverted) {
    const dot = document.getElementById("hud-drivetrain-dot");
    const mode = document.getElementById("hud-drivetrain-mode");
    if (!dot || !mode) return;
    if (isInverted) {
      mode.textContent = "INVERTED";
      mode.style.color = "#d4622a";
    } else if (mode.textContent === "INVERTED") {
      mode.textContent = "4WD";
      mode.style.color = "";
    }
  }

  animateSectorChange(sectorNum, biomeName) {
    const secEl = document.getElementById("hud-sector-label");
    const routeTag = document.getElementById("hud-route-sector-tag");
    if (secEl) secEl.textContent = `SECTOR 0${sectorNum}`;
    if (routeTag) routeTag.textContent = `SECTOR 0${sectorNum} // ${biomeName.toUpperCase()}`;

    if (this.hasGSAP && !x.visual.reducedMotion) {
      const tl = this.createTimeline("sectorChange");
      tl?.fromTo(
        "#hud-sector-label, #hud-route-sector-tag",
        { color: "#d4622a" },
        { color: "rgba(239, 231, 214, 0.85)", duration: 0.75, ease: "power2.out" },
        0
      ).fromTo(
        "#hud-route-beacon",
        { scale: 1.6 },
        { scale: 1.0, duration: 0.42, ease: "back.out(2)" },
        0
      );
    }
  }

  // Section 10: Archival Field-Notebook Echo Discovery Annotation
  animateEchoCollected(relic, collectedCount = 1, totalCount = 6) {
    const lottieEl = document.getElementById("hud-lottie-relic");
    if (lottieEl) {
      lottieEl.style.opacity = "1";
      if (this.relicLottie) {
        this.relicLottie.goToAndPlay(0, true);
      }
    }

    const annoCard = document.getElementById("hud-echo-annotation");
    const annoCounter = document.getElementById("hud-echo-anno-counter");
    const annoName = document.getElementById("hud-echo-anno-name");
    if (annoCounter) {
      annoCounter.textContent = `ARCHIVAL LOG // ECHO 0${collectedCount} / 0${totalCount}`;
    }
    if (annoName && relic?.name) {
      annoName.textContent = relic.name.toUpperCase();
    }
    if (annoCard) {
      annoCard.style.display = "flex";
      if (this.hasGSAP && !x.visual.reducedMotion) {
        const tl = this.createTimeline("echoDiscovery");
        tl?.fromTo(
          annoCard,
          { opacity: 0, x: -6 },
          { opacity: 1, x: 0, duration: 0.26, ease: "power3.out" },
          0
        )
          .fromTo(
            "#hud-echo-anno-line",
            { scaleX: 0 },
            { scaleX: 1, duration: 0.42, ease: "expo.out" },
            0.06
          )
          .to(
            annoCard,
            {
              opacity: 0,
              duration: 0.28,
              ease: "power2.in",
              onComplete: () => {
                annoCard.style.display = "none";
              },
            },
            2.1
          );
      } else {
        setTimeout(() => {
          annoCard.style.display = "none";
        }, 2200);
      }
    }
  }

  animateVehicleChange(archetypeName) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const tl = this.createTimeline("vehicleChange");
    tl?.fromTo(
      "#hud-vehicle, #hud-vehicle-status",
      { opacity: 0.45 },
      { opacity: 1, duration: 0.22, ease: "power2.out" }
    );
  }

  animateDeath(reason) {
    document.body.classList.add("hud-crashed");
    const banner = document.getElementById("hud-death-banner");
    const bannerTitle = document.getElementById("hud-death-banner-title");
    if (bannerTitle) bannerTitle.textContent = `EXPEDITION INTERRUPTED // ${reason.toUpperCase()}`;
    if (banner) {
      banner.style.display = "flex";
      if (this.hasGSAP && !x.visual.reducedMotion) {
        const tl = this.createTimeline("deathBanner");
        tl?.fromTo(
          banner,
          { opacity: 0, scale: 0.96 },
          { opacity: 1, scale: 1, duration: 0.22, ease: "power3.out" }
        );
      }
      setTimeout(() => {
        banner.style.display = "none";
      }, 620);
    }
  }

  animatePause(isPaused) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    if (isPaused) {
      const tl = this.createTimeline("pauseCard");
      tl?.fromTo(
        "#pause .card",
        { opacity: 0, y: 10, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power3.out" }
      );
    }
  }
}

// 5. HUDTelemetry — Geological Altimeter (Sec 6), Spirit-Level Inclinometer (Sec 7), Odometer Distance & Score (Sec 16-17)
class HUDTelemetry {
  els = {};
  cache = {};
  inclinePos = 0;
  inclineVel = 0;

  init() {
    this.els = {
      dist: document.getElementById("hud-dist"),
      speed: document.getElementById("hud-speed"),
      alt: document.getElementById("hud-alt"),
      incline: document.getElementById("hud-incline"),
      inclineBubble: document.getElementById("hud-incline-bubble"),
      inclineBar: document.getElementById("hud-incline-bar"),
      altTape: document.getElementById("hud-alt-tape"),
      altPointer: document.getElementById("hud-alt-pointer"),
      echoes: document.getElementById("hud-echoes"),
      zone: document.getElementById("hud-zone"),
      score: document.getElementById("hud-score"),
      vehicle: document.getElementById("hud-vehicle"),
      rpmBar: document.getElementById("hud-rpm"),
      air: document.getElementById("hud-air"),
      combo: document.getElementById("hud-combo"),
      leftIndicator: document.getElementById("hud-left-indicator"),
    };
    this.cache = {};
    this.inclinePos = 0;
    this.inclineVel = 0;
  }

  setText(key, val, odometerStep = false) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    const el = this.els[key];
    if (!el) return;
    el.textContent = val;
    if (odometerStep && !x.visual.reducedMotion) {
      el.classList.add("odo-step");
      setTimeout(() => el.classList.remove("odo-step"), 95);
    }
  }

  // Section 6: Vertical Geological Surveying Altimeter ("Climbing is accumulation")
  updateGeologicalAltimeter(alt, dist, speed) {
    const normAlt = b((alt || 0) / 140, 0, 0.75);
    const normSpeed = b((speed || 0) / 130, 0.16, 0.36);
    if (this.els.leftIndicator) {
      this.els.leftIndicator.style.bottom = `${Math.round(8 + normAlt * 64)}%`;
      this.els.leftIndicator.style.height = `${Math.round(normSpeed * 100)}%`;
    }
    // Strata tape moves downward as player climbs upward through mountain layers
    if (this.els.altTape) {
      const strataOffset = ((alt || 0) * 1.8) % 30;
      this.els.altTape.setAttribute("transform", `translate(0, ${strataOffset.toFixed(1)})`);
    }
    if (this.els.altPointer) {
      const py = 136 - normAlt * 110;
      this.els.altPointer.setAttribute(
        "points",
        `12,${py.toFixed(1)} 6,${(py - 2.8).toFixed(1)} 6,${(py + 2.8).toFixed(1)}`
      );
    }
  }

  // Section 7: Miniature Mechanical Spirit-Level / Inclinometer ("Balance")
  updateSpiritLevelInclinometer(inclineDeg, dt = 16.666) {
    const dtSec = Math.min(0.05, Math.max(0.004, dt / 1000));
    const targetOffset = b((inclineDeg || 0) * 0.38, -14, 14);
    const k = 65.0;
    const c = 8.2;
    const acc = k * (targetOffset - this.inclinePos) - c * this.inclineVel;
    this.inclineVel += acc * dtSec;
    this.inclinePos = b(this.inclinePos + this.inclineVel * dtSec, -15, 15);

    if (this.els.inclineBubble) {
      const cx = 23 + this.inclinePos;
      this.els.inclineBubble.setAttribute("cx", cx.toFixed(2));
      this.els.inclineBubble.setAttribute(
        "fill",
        Math.abs(inclineDeg) > 32 ? "#e25822" : "#d4622a"
      );
    }
    if (this.els.inclineBar) {
      const tilt = b(inclineDeg * 0.35, -18, 18);
      this.els.inclineBar.setAttribute("transform", `rotate(${tilt.toFixed(1)} 23 6.5)`);
    }
  }

  update(data, dt = 16.666) {
    const distVal = `${Math.round(data.distance || 0)} m`;
    const speedVal = `${Math.round(data.speed || 0)} km/h`;
    const altVal = `${Math.max(1, Math.round(data.altitude || 1))} m`;
    const incVal = `${Math.round(data.incline || 0)}°`;
    const echoVal = `${data.echoCount ?? 0}/${data.echoTotal ?? 6}`;
    const zoneVal = (data.biomeName || "ALPINE MEADOW").toUpperCase();
    const scoreVal = String(Math.round(data.score || 0));
    const vehVal = (data.vehicleName || "TRAIL BUGGY").toUpperCase();

    this.setText("dist", distVal, true);
    this.setText("speed", speedVal, false);
    this.setText("alt", altVal, true);
    this.setText("incline", incVal, false);
    this.setText("echoes", echoVal, false);
    this.setText("zone", zoneVal, false);
    this.setText("score", scoreVal, true);
    this.setText("vehicle", vehVal, false);

    if (this.els.rpmBar) {
      const wPct = `${Math.min(100, Math.round((data.rpm || 0) * 100))}%`;
      if (this.cache.rpmWidth !== wPct) {
        this.cache.rpmWidth = wPct;
        this.els.rpmBar.style.width = wPct;
      }
    }

    const airText = data.airborne ? `AIR ${(data.airtime / 1000).toFixed(1)}s` : "";
    this.setText("air", airText);

    if (this.els.combo) {
      const showCombo = data.comboMultiplier > 1 && data.comboTimer > 0;
      this.els.combo.style.display = showCombo ? "block" : "none";
      if (showCombo) {
        this.setText("combo", `COMBO x${data.comboMultiplier} (${data.comboTimer.toFixed(1)}s)`);
      }
    }

    this.updateGeologicalAltimeter(data.altitude, data.distance, data.speed);
    this.updateSpiritLevelInclinometer(data.incline, dt);
  }

  reset() {
    this.cache = {};
    this.inclinePos = 0;
    this.inclineVel = 0;
  }
  resize() {}
  destroy() {}
}

// 6. Speedometer — 10-Layer Mechanical Momentum Instrument (Section 3: "Momentum has weight")
class Speedometer {
  needleEl = null;
  shadowEl = null;
  pivotEl = null;
  arcEl = null;
  bigNumEl = null;
  orangeZoneEl = null;
  currentSpeed = 0;
  speedVel = 0;
  lastTargetSpeed = 0;
  calibrationOffset = 0;
  lastDisplayedInt = -1;
  frozen = false;

  init() {
    this.needleEl = document.getElementById("hud-speed-needle");
    this.shadowEl = document.getElementById("hud-speed-needle-shadow");
    this.pivotEl = document.getElementById("hud-speed-pivot");
    this.arcEl = document.getElementById("hud-speed-arc");
    this.bigNumEl = document.getElementById("hud-speed-big");
    this.orangeZoneEl = document.getElementById("hud-speed-orange-zone");
  }

  stepPhysics(targetSpeed, dt = 16.666) {
    if (this.frozen) return;
    const dtSec = Math.min(0.05, Math.max(0.004, dt / 1000));
    const rawSpeed = Number.isFinite(targetSpeed) ? Math.max(0, targetSpeed) : 0;
    const target = rawSpeed + this.calibrationOffset;

    // Asymmetric mechanical inertia: acceleration lag + slight overshoot, braking drag, settling at 0
    const isAccelerating = target > this.currentSpeed;
    const k = isAccelerating ? 72.0 : 58.0;
    const c = isAccelerating ? 11.2 : 13.8;
    const force = k * (target - this.currentSpeed) - c * this.speedVel;
    this.speedVel += force * dtSec;
    this.currentSpeed = Math.max(0, this.currentSpeed + this.speedVel * dtSec);
    this.lastTargetSpeed = rawSpeed;

    const maxSpeed = 135;
    const ratio = b(this.currentSpeed / maxSpeed, 0, 1);

    // High-speed mechanical vibration above 80 km/h
    const tremor =
      ratio > 0.58 && !x.visual.reducedMotion
        ? Math.sin(performance.now() * 0.055) * (ratio - 0.58) * 2.5
        : 0;

    // 240-degree sweep from -120 deg to +120 deg
    const visualRatio = Math.max(0.28, ratio);
    const angle = -120 + visualRatio * 240 + tremor;
    const rotStr = `${angle.toFixed(2)} 100 100`;

    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${rotStr})`);
    }
    if (this.shadowEl) {
      this.shadowEl.setAttribute("transform", `translate(2.2, 2.8) rotate(${rotStr})`);
    }
    if (this.pivotEl) {
      const pivotAngle = angle * 0.18;
      this.pivotEl.setAttribute("transform", `rotate(${pivotAngle.toFixed(1)} 100 100)`);
    }

    if (this.arcEl) {
      const offset = 335 * (1 - visualRatio);
      this.arcEl.setAttribute("stroke-dashoffset", offset.toFixed(1));
    }

    // Material contrast on high-speed orange sector (no cheap glow)
    if (this.orangeZoneEl) {
      const highContrast = ratio > 0.6 ? 1.0 : 0.86;
      const strokeW = ratio > 0.6 ? "5.1" : "4.5";
      this.orangeZoneEl.setAttribute("opacity", String(highContrast));
      this.orangeZoneEl.setAttribute("stroke-width", strokeW);
    }

    // Digital readout reacts faster than needle to create perceived physical mass
    const displayInt = Math.round(rawSpeed);
    if (displayInt !== this.lastDisplayedInt && this.bigNumEl) {
      this.lastDisplayedInt = displayInt;
      this.bigNumEl.textContent = String(displayInt);
    }
  }

  update(data, dt) {
    this.stepPhysics(data.speed || 0, dt);
  }

  reset() {
    this.frozen = false;
    this.currentSpeed = 0;
    this.speedVel = 0;
    this.calibrationOffset = 0;
    this.lastDisplayedInt = -1;
    this.stepPhysics(0, 16.666);
  }
  resize() {}
  destroy() {}
}

// 7. RPMGauge — Mechanical Stress & Engine Vibration Instrument (Section 4: "Engine vibration")
class RPMGauge {
  needleEl = null;
  shadowEl = null;
  arcEl = null;
  redlineEl = null;
  readoutEl = null;
  currentVal = 0.22;
  rpmVel = 0;
  calibrationOffset = 0;
  frozen = false;

  init() {
    this.needleEl = document.getElementById("hud-rpm-needle");
    this.shadowEl = document.getElementById("hud-rpm-needle-shadow");
    this.arcEl = document.getElementById("hud-rpm-arc");
    this.redlineEl = document.getElementById("hud-rpm-redline");
    this.readoutEl = document.getElementById("hud-rpm-readout");
  }

  stepPhysics(rpm = 0, temp = 0.28, dt = 16.666) {
    if (this.frozen) return;
    const dtSec = Math.min(0.05, Math.max(0.004, dt / 1000));
    const safeRpm = Number.isFinite(rpm) ? b(rpm, 0, 1) : 0;
    const safeTemp = Number.isFinite(temp) ? b(temp, 0.2, 1) : 0.28;
    const blended = b(safeRpm * 0.72 + safeTemp * 0.28 + this.calibrationOffset * 0.015, 0.14, 1.0);

    // High-stiffness mechanical response (much snappier than Speedometer)
    const k = 210.0;
    const c = 18.5;
    const force = k * (blended - this.currentVal) - c * this.rpmVel;
    this.rpmVel += force * dtSec;
    this.currentVal = b(this.currentVal + this.rpmVel * dtSec, 0.1, 1.0);

    const now = performance.now();
    // Idle breathing vs High-RPM microscopic engine vibration
    let vibration = 0;
    if (!x.visual.reducedMotion) {
      if (safeRpm < 0.12) {
        vibration = Math.sin(now * 0.018) * 0.95; // Gentle engine idle breathing
      } else if (safeRpm > 0.72) {
        vibration = Math.sin(now * 0.115) * (safeRpm - 0.65) * 6.5; // High-frequency redline chatter
      } else {
        vibration = Math.sin(now * 0.045) * safeRpm * 0.8;
      }
    }

    const angle = -78 + this.currentVal * 156 + vibration;
    const rotStr = `${angle.toFixed(1)} 55 62`;
    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${rotStr})`);
    }
    if (this.shadowEl) {
      this.shadowEl.setAttribute("transform", `translate(1.4, 1.8) rotate(${rotStr})`);
    }
    if (this.arcEl) {
      const offset = 132 * (1 - this.currentVal * 0.82);
      this.arcEl.setAttribute("stroke-dashoffset", offset.toFixed(1));
      this.arcEl.setAttribute("stroke", safeRpm > 0.8 ? "#d4622a" : "rgba(239,231,214,0.34)");
    }
    if (this.redlineEl) {
      this.redlineEl.setAttribute("stroke-width", safeRpm > 0.78 ? "4.0" : "3.2");
    }
    if (this.readoutEl) {
      const rpmThousands = (0.8 + safeRpm * 6.4).toFixed(1);
      this.readoutEl.textContent = `${rpmThousands}k RPM`;
      this.readoutEl.setAttribute("opacity", safeRpm > 0.72 ? "0.78" : "0");
    }
  }

  update(data, dt) {
    this.stepPhysics(data.rpm || 0, data.engineTemp ?? 0.28, dt);
  }

  reset() {
    this.frozen = false;
    this.currentVal = 0.22;
    this.rpmVel = 0;
    this.calibrationOffset = 0;
    this.stepPhysics(0, 0.24, 16.666);
  }
  resize() {}
  destroy() {}
}

// 8. FuelGauge — Deliberate Fluid-Damped Expedition Resource Instrument (Section 15)
class FuelGauge {
  needleEl = null;
  shadowEl = null;
  arcEl = null;
  lowEl = null;
  currentFuel = 1.0;

  init() {
    this.needleEl = document.getElementById("hud-fuel-needle");
    this.shadowEl = document.getElementById("hud-fuel-needle-shadow");
    this.arcEl = document.getElementById("hud-fuel-arc");
    this.lowEl = document.getElementById("hud-fuel-low");
  }

  update(data, dt = 16.666) {
    const target = b(data.fuel ?? 0.95, 0.05, 1.0);
    // Slow, heavily damped fluid movement
    this.currentFuel = G0(this.currentFuel, target, 4.5, dt);

    const arcSpan = 0.08 + this.currentFuel * 0.42;
    const angle = -76 + arcSpan * 152;
    const rotStr = `${angle.toFixed(1)} 55 62`;
    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${rotStr})`);
    }
    if (this.shadowEl) {
      this.shadowEl.setAttribute("transform", `translate(1.4, 1.8) rotate(${rotStr})`);
    }
    if (this.arcEl) {
      const offset = 132 * (1 - arcSpan);
      this.arcEl.setAttribute("stroke-dashoffset", offset.toFixed(1));
    }
    if (this.lowEl) {
      const isLow = this.currentFuel < 0.22;
      this.lowEl.setAttribute("opacity", isLow ? "1" : "0");
    }
  }

  reset() {
    this.currentFuel = 1.0;
    this.update({ fuel: 1.0 }, 16.666);
  }
  resize() {}
  destroy() {}
}

// 9. Compass — 3D Gimbal & Inertial Magnetic Needle Instrument (Section 5: "Orientation through uncertainty")
class Compass {
  cardEl = null;
  needleEl = null;
  shadowEl = null;
  timeEl = null;
  ampmEl = null;
  tempEl = null;
  weatherEl = null;
  currentAngle = 0;
  angleVel = 0;
  lastTimeStr = "";
  lastTempStr = "";
  lastWeatherStr = "";

  init() {
    this.cardEl = document.getElementById("hud-compass-card");
    this.needleEl = document.getElementById("hud-compass-needle");
    this.shadowEl = document.getElementById("hud-compass-needle-shadow");
    this.timeEl = document.getElementById("hud-time-val");
    this.ampmEl = document.getElementById("hud-time-ampm");
    this.tempEl = document.getElementById("hud-temp-val");
    this.weatherEl = document.getElementById("hud-weather-label");
  }

  update(data, dt = 16.666) {
    const dtSec = Math.min(0.05, Math.max(0.004, dt / 1000));
    const shakeJitter = (window.game?.camera?.shakeIntensity || 0) * (Math.random() - 0.5) * 28;
    const targetDeg = b(
      (data.incline || 0) * 1.45 + Math.sin((data.distance || 0) * 0.03) * 12 + shakeJitter,
      -68,
      68
    );

    // Underdamped magnetic needle spring: rotational inertia, subtle overshoot, calm when stationary
    const k = 36.0;
    const c = 5.4;
    const acc = k * (targetDeg - this.currentAngle) - c * this.angleVel;
    this.angleVel += acc * dtSec;
    this.currentAngle += this.angleVel * dtSec;

    const rotStr = `${this.currentAngle.toFixed(2)} 32 32`;
    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${rotStr})`);
    }
    if (this.shadowEl) {
      this.shadowEl.setAttribute("transform", `translate(1.2, 1.8) rotate(${rotStr})`);
    }
    // Subtle 3D gimbal tilt on the compass card while outer housing remains fixed
    if (this.cardEl && !x.visual.reducedMotion) {
      const rx = b((data.incline || 0) * 0.35, -14, 14);
      const ry = b((data.speed || 0) * 0.08, -8, 8);
      this.cardEl.style.transform = `rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
    }

    // Authoritative WorldState Clock, Temperature & Weather (Living World Simulation 2.0)
    const ws = window.game?.worldSim?.state;
    const totalMin = ws ? Math.floor(ws.timeMinutes) : (6 * 60 + 24 + Math.floor((data.distance || 0) / 18 + (window.game?.time || 0) / 15000));
    const hrs24 = Math.floor(totalMin / 60) % 24;
    const mins = totalMin % 60;
    const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;
    const timeStr = `${String(hrs12).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    if (timeStr !== this.lastTimeStr && this.timeEl) {
      this.lastTimeStr = timeStr;
      this.timeEl.textContent = timeStr;
      if (this.ampmEl) this.ampmEl.textContent = hrs24 >= 12 ? "PM" : "AM";
    }

    // Altitude + Time + Season + Weather Temperature
    const tempC = ws ? Math.round(ws.temperature) : Math.round(12 - (data.altitude || 0) * 0.22);
    const tempStr = `${tempC}°C`;
    if (tempStr !== this.lastTempStr && this.tempEl) {
      this.lastTempStr = tempStr;
      this.tempEl.textContent = tempStr;
    }

    // Live WorldState Weather & Season Condition
    let wStr = "CLEAR";
    if (ws) {
      wStr = ws.weather.replace("_", " ");
    } else {
      const zone = (data.biomeName || "").toLowerCase();
      if (zone.includes("crag")) wStr = "RIDGE WIND";
      else if (zone.includes("canyon")) wStr = "GORGE MIST";
      else if (zone.includes("iron") || zone.includes("works")) wStr = "ASH HAZE";
      else if (zone.includes("summit") || zone.includes("frozen")) wStr = "GLACIER SNOW";
    }

    if (wStr !== this.lastWeatherStr && this.weatherEl) {
      this.lastWeatherStr = wStr;
      this.weatherEl.textContent = wStr;
    }
  }

  reset() {
    this.currentAngle = 0;
    this.angleVel = 0;
    if (this.needleEl) this.needleEl.setAttribute("transform", "rotate(0 32 32)");
    if (this.shadowEl) this.shadowEl.setAttribute("transform", "translate(1.2, 1.8) rotate(0 32 32)");
  }
  resize() {}
  destroy() {}
}

// 10. ExpeditionRouteAndScanner — Surveyed Route (Sec 9) & Signature Living Geological Profile (Sec 8)
class ExpeditionRouteAndScanner {
  progressEl = null;
  beaconEl = null;
  scannerPastEl = null;
  scannerLineEl = null;
  scannerStrataEl = null;
  scannerCarEl = null;
  scannerReticleEl = null;
  scannerCalloutEl = null;
  routeNodes = [];
  discoveredNodes = new Set();
  scanTimer = 0;

  // Waypoints along the 400x28 SVG surveyed route path
  routePoints = [
    { x: 8, y: 21 },
    { x: 55, y: 18 },
    { x: 82, y: 13 },
    { x: 135, y: 16 },
    { x: 154, y: 15 },
    { x: 185, y: 10 },
    { x: 228, y: 9 },
    { x: 285, y: 6 },
    { x: 308, y: 11 },
    { x: 350, y: 8 },
    { x: 392, y: 3 },
  ];

  init() {
    this.progressEl = document.getElementById("hud-route-progress");
    this.beaconEl = document.getElementById("hud-route-beacon");
    this.scannerPastEl = document.getElementById("hud-scanner-past");
    this.scannerLineEl = document.getElementById("hud-scanner-line");
    this.scannerStrataEl = document.getElementById("hud-scanner-strata");
    this.scannerCarEl = document.getElementById("hud-scanner-car");
    this.scannerReticleEl = document.getElementById("hud-scanner-reticle");
    this.scannerCalloutEl = document.getElementById("hud-scanner-callout");
    this.routeNodes = Array.from(document.querySelectorAll("#hud-route-nodes .route-node"));
    this.discoveredNodes.clear();
  }

  pointAtProgress(p) {
    const clamped = b(p, 0, 1);
    const segs = this.routePoints.length - 1;
    const f = clamped * segs;
    const idx = Math.min(segs - 1, Math.floor(f));
    const t = f - idx;
    const p0 = this.routePoints[idx];
    const p1 = this.routePoints[idx + 1];
    return {
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
    };
  }

  update(data, dt = 16.666) {
    const totalMeters = (x.world.length - x.world.startX) / 40;
    const prog = b((data.distance || 0) / Math.max(1, totalMeters), 0, 1);

    if (this.progressEl) {
      const dashOffset = 410 * (1 - prog);
      this.progressEl.setAttribute("stroke-dashoffset", dashOffset.toFixed(1));
    }
    if (this.beaconEl) {
      const pt = this.pointAtProgress(prog);
      this.beaconEl.setAttribute("transform", `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
    }

    // Unfold survey nodes as the vehicle discovers them along the expedition route
    const nodeThresholds = [0.0, 0.18, 0.36, 0.56, 0.76, 0.96];
    for (let i = 0; i < this.routeNodes.length; i++) {
      if (prog >= nodeThresholds[i] && !this.discoveredNodes.has(i)) {
        this.discoveredNodes.add(i);
        const ring = this.routeNodes[i].querySelector(".node-ring");
        if (ring) {
          ring.setAttribute("opacity", "0.75");
        }
      }
    }

    // Section 8: Signature Living Geological Terrain Scanner (sampled at 20Hz)
    this.scanTimer += dt;
    if (this.scanTimer >= 45 && window.game?.terrain && window.game?.vehicle) {
      this.scanTimer = 0;
      const terrain = window.game.terrain;
      const carX = window.game.vehicle.chassis.position.x;
      const baseH = terrain.heightAt(carX);

      let pastPath = "";
      let aheadPath = "";
      let strataPath = "";

      const totalSamples = 30;
      const carSampleIdx = 5; // Fixed vehicle fiducial at x = 64 (5/30 * 360 = 60..64)
      let maxClimbSlope = 0;
      let maxDropSlope = 0;
      let featureX = 180;
      let featureY = 16;
      let hasJumpCrest = false;

      for (let i = 0; i <= totalSamples; i++) {
        const u = i / totalSamples;
        const wx = carX - 240 + u * 1440; // -6m behind to +30m ahead
        const wy = terrain.heightAt(wx);
        const slope = terrain.slopeAt(wx);
        const sx = (u * 360).toFixed(1);
        const syVal = b(16 + (wy - baseH) * 0.042, 2.5, 25.5);
        const sy = syVal.toFixed(1);

        if (i <= carSampleIdx) {
          pastPath += i === 0 ? `M ${sx},${sy}` : ` L ${sx},${sy}`;
          if (i === carSampleIdx) {
            aheadPath = `M ${sx},${sy}`;
            if (this.scannerCarEl) {
              this.scannerCarEl.setAttribute("cx", sx);
              this.scannerCarEl.setAttribute("cy", sy);
            }
          }
        } else {
          // Detect sharp crest / jump separation
          const prevWx = carX - 240 + ((i - 1) / totalSamples) * 1440;
          const prevSlope = terrain.slopeAt(prevWx);
          if (prevSlope < -0.28 && slope > 0.22) {
            hasJumpCrest = true;
            aheadPath += ` M ${sx},${sy}`; // Visual gap separation for major jump crest!
            featureX = parseFloat(sx);
            featureY = syVal;
          } else {
            aheadPath += ` L ${sx},${sy}`;
          }

          if (i % 2 === 0) {
            strataPath += `M ${sx},${sy} L ${sx},${Math.min(25.5, syVal + 4.5).toFixed(1)} `;
          }

          if (slope < maxClimbSlope) {
            maxClimbSlope = slope;
            if (!hasJumpCrest) {
              featureX = parseFloat(sx);
              featureY = syVal;
            }
          }
          if (slope > maxDropSlope) {
            maxDropSlope = slope;
            if (!hasJumpCrest && maxDropSlope > Math.abs(maxClimbSlope)) {
              featureX = parseFloat(sx);
              featureY = syVal;
            }
          }
        }
      }

      if (this.scannerPastEl) this.scannerPastEl.setAttribute("d", pastPath);
      if (this.scannerStrataEl) this.scannerStrataEl.setAttribute("d", strataPath);

      // Classify upcoming geological feature using both slope profile and segment metadata (Section 44 & 45)
      const upcomingSeg = terrain.segmentAt ? terrain.segmentAt(carX + 480) : null;
      let callout = "TERRAIN // NOMINAL";
      let isHazard = false;
      if (prog > 0.88) {
        callout = "SUMMIT APPROACH";
        isHazard = true;
      } else if (hasJumpCrest) {
        callout = "JUMP CREST // GAP";
        isHazard = true;
      } else if (maxClimbSlope < -0.46) {
        callout = "STEEP CLIMB";
        isHazard = true;
      } else if (maxDropSlope > 0.46) {
        callout = "DANGEROUS DESCENT";
        isHazard = true;
      } else if (maxClimbSlope < -0.26) {
        callout = "UPCOMING RIDGE";
      } else if (maxDropSlope > 0.26) {
        callout = "DEPRESSION";
      } else if (upcomingSeg?.signature) {
        callout = upcomingSeg.signature;
        isHazard = true;
      }

      if (this.scannerLineEl) {
        this.scannerLineEl.setAttribute("d", aheadPath);
        this.scannerLineEl.setAttribute(
          "stroke",
          isHazard ? "#d4622a" : "rgba(239,231,214,0.64)"
        );
      }
      if (this.scannerReticleEl) {
        this.scannerReticleEl.setAttribute(
          "transform",
          `translate(${featureX.toFixed(1)}, ${featureY.toFixed(1)})`
        );
        this.scannerReticleEl.setAttribute("opacity", isHazard ? "0.9" : "0");
      }
      if (this.scannerCalloutEl) {
        this.scannerCalloutEl.textContent = callout;
        this.scannerCalloutEl.style.color = isHazard
          ? "#d4622a"
          : "rgba(239, 231, 214, 0.68)";
      }
    }
  }

  reset() {
    this.discoveredNodes.clear();
    for (const node of this.routeNodes) {
      const ring = node.querySelector(".node-ring");
      if (ring) ring.setAttribute("opacity", "0");
    }
    if (this.progressEl) this.progressEl.setAttribute("stroke-dashoffset", "410");
    if (this.beaconEl) this.beaconEl.setAttribute("transform", "translate(8, 21)");
  }
  resize() {}
  destroy() {}
}

// 11. StuntGauge — Radial Angular Momentum Gyro (Sec 11) & Suspended Airtime Chronometer (Sec 12)
class StuntGauge {
  topBarEl = null;
  midBarEl = null;
  chronoEl = null;
  chronoDigitsEl = null;
  gyroSvgEl = null;
  gyroArcEl = null;
  gyroRotorEl = null;
  line1 = null;
  line2 = null;
  line3 = null;
  line4 = null;

  init() {
    this.topBarEl = document.getElementById("hud-stunt-bar-top");
    this.midBarEl = document.getElementById("hud-stunt-bar-mid");
    this.chronoEl = document.getElementById("hud-airtime-chrono");
    this.chronoDigitsEl = document.getElementById("hud-airtime-digits");
    this.gyroSvgEl = document.getElementById("hud-stunt-gyro-svg");
    this.gyroArcEl = document.getElementById("hud-stunt-gyro-arc");
    this.gyroRotorEl = document.getElementById("hud-stunt-gyro-rotor");
    this.line1 = document.getElementById("hud-right-line1");
    this.line2 = document.getElementById("hud-right-line2");
    this.line3 = document.getElementById("hud-right-line3");
    this.line4 = document.getElementById("hud-right-line4");
  }

  update(data) {
    if (!this.topBarEl) return;
    const isAir = Boolean(data.airborne);
    const airSec = (data.airtime || 0) / 1000;
    const altRatio = b((data.altitude || 0) / 110, 0.16, 0.78);
    const airRatio = isAir ? b(airSec / 2.2, 0.24, 0.92) : altRatio;

    this.topBarEl.style.height = `${Math.round(airRatio * 100)}%`;

    // Section 12: Suspended Airborne Timer ("Silence between ground contacts")
    if (this.chronoEl && this.chronoDigitsEl) {
      if (isAir && airSec > 0.08) {
        this.chronoEl.classList.add("active");
        const padded = airSec < 10 ? `0${airSec.toFixed(2)} s` : `${airSec.toFixed(2)} s`;
        this.chronoDigitsEl.textContent = padded;
        const scaleBoost = b(1 + airSec * 0.06, 1, 1.18);
        this.chronoEl.style.transform = `translateY(0) scale(${scaleBoost.toFixed(2)})`;
      } else {
        this.chronoEl.classList.remove("active");
        this.chronoEl.style.transform = "translateY(4px) scale(0.95)";
      }
    }

    // Section 11: Radial Stunt Angular Momentum Ring ("Controlled chaos")
    if (this.gyroSvgEl && this.gyroArcEl && this.gyroRotorEl) {
      this.gyroSvgEl.classList.toggle("active", isAir);
      const cumRad = data.cumulativeAirAngle || 0;
      const revFraction = b(Math.abs(cumRad) / (Math.PI * 2), 0, 1);
      const circumference = 88;
      const dashOffset = isAir ? circumference * (1 - revFraction) : circumference;
      this.gyroArcEl.setAttribute("stroke-dashoffset", dashOffset.toFixed(1));
      // Flip sweep direction for Backflip (CCW) vs Frontflip (CW)
      const flipScale = cumRad < 0 ? "scale(1, -1)" : "scale(1, 1)";
      this.gyroArcEl.setAttribute("transform", `rotate(-90 22 22) ${flipScale}`);
      this.gyroRotorEl.setAttribute("transform", `rotate(${(data.incline || 0).toFixed(1)} 22 22)`);
    }

    if (this.line1 && this.line2 && this.line3 && this.line4) {
      if (isAir && data.airtime > 140) {
        this.line1.textContent = "AIRBORNE";
        this.line1.className = "accent-orange";
        this.line2.textContent = `${airSec.toFixed(1)}S AIR`;
        this.line3.textContent = data.activeStunt || "MOMENTUM";
        this.line4.textContent =
          data.comboMultiplier > 1 ? `COMBO X${data.comboMultiplier}` : "TRAJECTORY";
      } else if (data.comboMultiplier > 1 && data.comboTimer > 0) {
        this.line1.textContent = `COMBO X${data.comboMultiplier}`;
        this.line1.className = "accent-orange";
        this.line2.textContent = data.activeStunt || "CHAIN";
        this.line3.textContent = `${data.comboTimer.toFixed(1)}S`;
        this.line4.textContent = "STORIES";
      } else {
        this.line1.textContent = "HIGHER";
        this.line1.className = "lead";
        this.line2.textContent = "TERRAIN";
        this.line3.textContent = "BIGGER";
        this.line4.textContent = "STORIES";
      }
    }
  }

  reset() {
    if (this.chronoEl) this.chronoEl.classList.remove("active");
    if (this.gyroSvgEl) this.gyroSvgEl.classList.remove("active");
    if (this.gyroArcEl) this.gyroArcEl.setAttribute("stroke-dashoffset", "88");
  }
  resize() {}
  destroy() {}
}

// 12. VehicleStatus — 4WD Technical Drivetrain & Axle Torque Visualizer (Section 14: "Power reaches the ground")
class VehicleStatus {
  modeEl = null;
  dotEl = null;
  driveshaftEl = null;
  diffEl = null;
  axleRearEl = null;
  axleFrontEl = null;
  wheelEls = [];

  init() {
    this.modeEl = document.getElementById("hud-drivetrain-mode");
    this.dotEl = document.getElementById("hud-drivetrain-dot");
    this.driveshaftEl = document.getElementById("hud-driveshaft");
    this.diffEl = document.getElementById("hud-diff-center");
    this.axleRearEl = document.getElementById("hud-axle-rear");
    this.axleFrontEl = document.getElementById("hud-axle-front");
    this.wheelEls = [
      document.getElementById("hud-wheel-rl"),
      document.getElementById("hud-wheel-rr"),
      document.getElementById("hud-wheel-fl"),
      document.getElementById("hud-wheel-fr"),
    ];
  }

  update(data) {
    const v = window.game?.vehicle;
    if (!v) return;
    const rearContact = Boolean(v.wheels?.[0]?.contact);
    const frontContact = Boolean(v.wheels?.[1]?.contact);
    const rearSlip = (v.wheels?.[0]?.slip || 0) > 1.25;
    const frontSlip = (v.wheels?.[1]?.slip || 0) > 1.25;
    const torqueActive = Math.abs(data.throttle || 0) > 0.08 || Math.abs(data.brake || 0) > 0.08;

    const rearFill = !rearContact
      ? "rgba(239,231,214,0.20)"
      : rearSlip
      ? "#d4622a"
      : "#efe7d6";
    const frontFill = !frontContact
      ? "rgba(239,231,214,0.20)"
      : frontSlip
      ? "#d4622a"
      : "#efe7d6";

    if (this.wheelEls[0]) this.wheelEls[0].setAttribute("fill", rearFill);
    if (this.wheelEls[1]) this.wheelEls[1].setAttribute("fill", rearFill);
    if (this.wheelEls[2]) this.wheelEls[2].setAttribute("fill", frontFill);
    if (this.wheelEls[3]) this.wheelEls[3].setAttribute("fill", frontFill);

    if (this.driveshaftEl) {
      this.driveshaftEl.setAttribute(
        "stroke",
        torqueActive ? "#d4622a" : "rgba(239,231,214,0.32)"
      );
    }
    if (this.diffEl) {
      this.diffEl.setAttribute(
        "stroke",
        torqueActive ? "#d4622a" : "rgba(239,231,214,0.55)"
      );
    }

    if (this.modeEl && window.game?.deathState === "normal") {
      this.modeEl.textContent = data.airborne ? "AIR" : "4WD";
      this.modeEl.style.color = data.airborne ? "#d4622a" : "";
    }
  }

  reset() {
    if (this.modeEl) {
      this.modeEl.textContent = "4WD";
      this.modeEl.style.color = "";
    }
  }
  resize() {}
  destroy() {}
}

// 13. ControlsHUD — Tactile Mechanical Pedal Controls (Section 13: "Human input")
class ControlsHUD {
  btnLeft = null;
  btnRight = null;
  unitLeft = null;
  unitRight = null;
  wasLeft = false;
  wasRight = false;

  init() {
    this.btnLeft = document.getElementById("pedal-l");
    this.btnRight = document.getElementById("pedal-r");
    this.unitLeft = document.getElementById("pedal-unit-l");
    this.unitRight = document.getElementById("pedal-unit-r");
  }

  update(input, rpm = 0) {
    if (!input) return;
    const isLeft = input.brake > 0.1;
    const isRight = input.throttle > 0.1;

    if (isLeft !== this.wasLeft && this.btnLeft) {
      this.wasLeft = isLeft;
      this.btnLeft.classList.toggle("pressed", isLeft);
      if (this.unitLeft) this.unitLeft.classList.toggle("active", isLeft);
      if (!isLeft) this.btnLeft.style.transform = "scale(1)";
    }

    if (isRight !== this.wasRight && this.btnRight) {
      this.wasRight = isRight;
      this.btnRight.classList.toggle("pressed", isRight);
      if (this.unitRight) this.unitRight.classList.toggle("active", isRight);
      if (!isRight) this.btnRight.style.transform = "scale(1)";
    }

    // Physical depression + subtle mechanical hold vibration under engine load
    if (!x.visual.reducedMotion) {
      const vib = Math.sin(performance.now() * 0.09) * (0.25 + rpm * 0.55);
      if (isLeft && this.btnLeft) {
        this.btnLeft.style.transform = `translateY(1.8px) scale(0.95) translateX(${(vib * 0.5).toFixed(2)}px)`;
      }
      if (isRight && this.btnRight) {
        this.btnRight.style.transform = `translateY(2.2px) scale(0.94) translateX(${vib.toFixed(2)}px)`;
      }
    }
  }

  reset() {
    this.wasLeft = false;
    this.wasRight = false;
    if (this.btnLeft) {
      this.btnLeft.classList.remove("pressed");
      this.btnLeft.style.transform = "scale(1)";
    }
    if (this.btnRight) {
      this.btnRight.classList.remove("pressed");
      this.btnRight.style.transform = "scale(1)";
    }
  }
  resize() {}
  destroy() {}
}

// 14. HUDManager — Master Coordinator, Authoritative Telemetry Snapshot & Multi-Rate Scheduler (Sections 24-30)
class HUDManager {
  game = null;
  stateMachine = new HUDStateMachine();
  threeInstruments = new HUDThreeInstruments();
  animations = new HUDAnimations();
  telemetry = new HUDTelemetry();
  speedometer = new Speedometer();
  rpmGauge = new RPMGauge();
  fuelGauge = new FuelGauge();
  compass = new Compass();
  routeScanner = new ExpeditionRouteAndScanner();
  stuntGauge = new StuntGauge();
  vehicleStatus = new VehicleStatus();
  controls = new ControlsHUD();

  currentSector = 1;
  wasInverted = false;
  medFreqTimer = 100;
  lowFreqTimer = 300;

  // Single Authoritative HUD Telemetry Object (Section 24)
  snapshot = {
    speed: 0,
    rpm: 0,
    altitude: 1,
    incline: 0,
    distance: 0,
    fuel: 1.0,
    engineTemp: 0.24,
    score: 0,
    comboMultiplier: 1,
    comboTimer: 0,
    airtime: 0,
    pitch: 0,
    yaw: 0,
    angularVelocity: 0,
    cumulativeAirAngle: 0,
    airborne: false,
    inverted: false,
    wheelSlip: 0,
    wheelSpin: 0,
    throttle: 0,
    brake: 0,
    vehicleName: "Trail Buggy",
    biomeName: "Alpine Meadow",
    echoCount: 0,
    echoTotal: 6,
    sector: 1,
    activeStunt: "",
    isDead: false,
    isPaused: false,
    debriefVisible: false,
  };

  init(game) {
    this.game = game;
    this.stateMachine.init();
    this.threeInstruments.init();
    this.animations.init();
    this.telemetry.init();
    this.speedometer.init();
    this.rpmGauge.init();
    this.fuelGauge.init();
    this.compass.init();
    this.routeScanner.init();
    this.stuntGauge.init();
    this.vehicleStatus.init();
    this.controls.init();

    this.telemetry.update(this.snapshot, 16.666);
    this.fuelGauge.update(this.snapshot, 16.666);
    this.routeScanner.update(this.snapshot, 16.666);

    this.bindEvents();
  }

  bindEvents() {
    if (!this.game?.bus) return;

    this.game.bus.on("stunt:awarded", (data) => {
      this.stateMachine.triggerTransientState("STUNT", 900);
      this.animations.animateStunt(data);
    });

    this.game.bus.on("vehicle:land", (data) => {
      this.stateMachine.triggerTransientState("LANDING", 450);
      this.animations.animateLanding(data?.compression ?? 0.5);
    });

    this.game.bus.on("vehicle:impact", (data) => {
      if (data?.tier === "heavy" || data?.tier === "critical") {
        this.stateMachine.triggerTransientState("CRASH", 550);
        this.animations.animateCrash(data.tier);
      }
    });

    this.game.bus.on("echo:collected", (relic) => {
      this.stateMachine.triggerTransientState("ECHO_DISCOVERY", 2200);
      this.animations.animateEchoCollected(
        relic,
        this.game?.echoManager?.collectedCount ?? 1,
        this.game?.echoManager?.totalCount ?? 6
      );
    });

    this.game.bus.on("vehicle:reset", () => {
      this.reset();
    });

    this.game.bus.on("vehicle:change", (archName) => {
      this.animations.animateVehicleChange(archName);
    });
  }

  // Perfect Restart Behavior (Section 26)
  reset() {
    document.body.classList.remove("hud-crashed");
    const banner = document.getElementById("hud-death-banner");
    if (banner) banner.style.display = "none";
    const echoAnno = document.getElementById("hud-echo-annotation");
    if (echoAnno) echoAnno.style.display = "none";

    this.animations.killAllTimelines();
    this.stateMachine.reset();
    this.threeInstruments.reset();
    this.telemetry.reset();
    this.speedometer.reset();
    this.rpmGauge.reset();
    this.fuelGauge.reset();
    this.compass.reset();
    this.routeScanner.reset();
    this.stuntGauge.reset();
    this.vehicleStatus.reset();
    this.controls.reset();

    this.currentSector = 1;
    this.wasInverted = false;
    this.medFreqTimer = 100;
    this.lowFreqTimer = 300;
  }

  update(data, dt = 16.666) {
    if (!data || !this.game) return;
    const v = this.game.vehicle;

    // Populate Single Authoritative HUD Telemetry Snapshot
    this.snapshot.speed = Number.isFinite(data.speed) ? data.speed : 0;
    this.snapshot.rpm = Number.isFinite(data.rpm) ? data.rpm : 0;
    this.snapshot.altitude = Number.isFinite(data.altitude) ? data.altitude : 1;
    this.snapshot.incline = Number.isFinite(data.incline) ? data.incline : 0;
    this.snapshot.distance = Number.isFinite(data.distance) ? data.distance : 0;
    this.snapshot.fuel = Number.isFinite(data.fuel) ? data.fuel : 1.0;
    this.snapshot.engineTemp = Number.isFinite(data.engineTemp) ? data.engineTemp : 0.24;
    this.snapshot.score = Number.isFinite(data.score) ? data.score : 0;
    this.snapshot.comboMultiplier = data.comboMultiplier || 1;
    this.snapshot.comboTimer = data.comboTimer || 0;
    this.snapshot.airtime = data.airtime || 0;
    this.snapshot.pitch = v ? normalizeAngle(v.chassis.angle) : 0;
    this.snapshot.angularVelocity = v ? v.chassis.angularVelocity : 0;
    this.snapshot.cumulativeAirAngle = this.game.stunts?.cumulativeAngle || 0;
    this.snapshot.airborne = Boolean(data.airborne);
    this.snapshot.inverted =
      this.game.deathState === "crashed" || this.game.deathState === "critical";
    this.snapshot.wheelSlip = Math.max(v?.wheels?.[0]?.slip || 0, v?.wheels?.[1]?.slip || 0);
    this.snapshot.wheelSpin = v?.wheels?.[0]?.body?.angularVelocity || 0;
    this.snapshot.throttle = this.game.input?.throttle || 0;
    this.snapshot.brake = this.game.input?.brake || 0;
    this.snapshot.vehicleName = data.vehicleName || "Trail Buggy";
    this.snapshot.biomeName = data.biomeName || "Alpine Meadow";
    this.snapshot.echoCount = data.echoCount ?? 0;
    this.snapshot.echoTotal = data.echoTotal ?? 6;
    this.snapshot.activeStunt = data.activeStunt || "";
    this.snapshot.isDead = Boolean(this.game.isDead);
    this.snapshot.isPaused = !this.game.running;

    // 1. Evaluate HUD State Machine
    this.stateMachine.evaluate(this.snapshot, dt);

    // 2. HIGH FREQUENCY (60Hz every frame): Speedometer, RPM, Spirit-Level Inclinometer, Compass, Pedals, 3D Layer
    this.speedometer.update(this.snapshot, dt);
    this.rpmGauge.update(this.snapshot, dt);
    this.compass.update(this.snapshot, dt);
    this.controls.update(this.game.input, this.snapshot.rpm);
    this.threeInstruments.update(this.snapshot, dt);
    if (this.snapshot.airborne) {
      this.stuntGauge.update(this.snapshot);
    }

    // 3. MEDIUM FREQUENCY (20Hz / every 45ms): Telemetry text, Altimeter, Fuel Gauge, Route & Terrain Scanner, Stunt & Drivetrain DOM
    this.medFreqTimer += dt;
    if (this.medFreqTimer >= 45) {
      const stepDt = this.medFreqTimer;
      this.medFreqTimer = 0;
      this.telemetry.update(this.snapshot, stepDt);
      this.fuelGauge.update(this.snapshot, stepDt);
      this.routeScanner.update(this.snapshot, stepDt);
      if (!this.snapshot.airborne) {
        this.stuntGauge.update(this.snapshot);
      }
      this.vehicleStatus.update(this.snapshot);
    } else {
      // Keep spirit-level bubble at 60Hz even between text updates
      this.telemetry.updateSpiritLevelInclinometer(this.snapshot.incline, dt);
    }

    // 4. LOW FREQUENCY (5Hz / every 200ms): 7-Sector transitions, Inversion state check, Lenis scroll
    this.lowFreqTimer += dt;
    if (this.lowFreqTimer >= 180) {
      this.lowFreqTimer = 0;
      const curBiome = this.game.terrain?.getBiomeAtDist
        ? this.game.terrain.getBiomeAtDist(this.snapshot.distance)
        : null;
      const totalMeters = (x.world.length - x.world.startX) / 40;
      const sector = curBiome?.sector || Math.min(
        7,
        Math.max(1, Math.floor((this.snapshot.distance / Math.max(1, totalMeters)) * 7) + 1)
      );
      if (sector !== this.currentSector) {
        this.currentSector = sector;
        this.snapshot.sector = sector;
        this.stateMachine.triggerTransientState("SECTOR_CHANGE", 1100);
        this.animations.animateSectorChange(sector, this.snapshot.biomeName);
      }
    }

    if (this.snapshot.inverted !== this.wasInverted) {
      this.wasInverted = this.snapshot.inverted;
      this.animations.animateInversion(this.snapshot.inverted);
    }

    if (this.animations.lenis) {
      const garageEl = document.getElementById("garage-screen");
      if (garageEl && garageEl.style.display === "flex") {
        this.animations.lenis.raf(performance.now());
      }
    }
  }

  onDeath(reason) {
    this.speedometer.frozen = true;
    this.rpmGauge.frozen = true;
    this.stateMachine.evaluate({ ...this.snapshot, isDead: true }, 16.666);
    this.animations.animateDeath(reason);
  }

  resize() {
    this.threeInstruments.resize();
    this.telemetry.resize();
    this.speedometer.resize();
    this.rpmGauge.resize();
    this.fuelGauge.resize();
    this.compass.resize();
    this.routeScanner.resize();
    this.stuntGauge.resize();
    this.vehicleStatus.resize();
    this.controls.resize();
  }

  destroy() {
    this.animations.killAllTimelines();
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
  worldSim = null;
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
  summitReached = false;

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
    this.worldSim = new WorldSimulationManager(this.seed);

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

    // Diagnostic Seeds, Living World Controls & Telemetry Hotkeys
    window.addEventListener("keydown", (e) => {
      if (e.key === "1") this.setTestSeed("SEED_FLAT");
      else if (e.key === "2") this.setTestSeed("SEED_STEEP");
      else if (e.key === "3") this.setTestSeed("SEED_JUMP");
      else if (e.key === "4") this.setTestSeed("SEED_VALLEY");
      else if (e.key === "5" && this.worldSim) {
        const phase = this.worldSim.advanceTimeHours(3);
        this.stunts.showToast(`WORLD CLOCK +3H -> ${phase}`, 2);
      } else if (e.key === "6" && this.worldSim) {
        const w = this.worldSim.cycleWeather();
        this.stunts.showToast(`WORLD WEATHER -> ${w}`, 2);
      } else if (e.key === "7" && this.worldSim) {
        const s = this.worldSim.cycleSeason();
        this.stunts.showToast(`WORLD SEASON -> ${s}`, 2);
      } else if (e.key === "8" && this.worldSim) {
        const ev = this.worldSim.triggerShowcaseEvent(this);
        this.stunts.showToast(`WORLD EVENT -> ${ev}`, 2);
      } else if (e.key === "t" || e.key === "T") {
        if (this.debug) this.exportTelemetry();
      }
    });

    this.bus.on("echo:collected", (relic) => {
      this.score += 500;
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
    this.engine.positionIterations = 6;
    this.engine.velocityIterations = 6;

    this.terrain = new P0(this.seed);
    this.terrainSet = new Set(this.terrain.bodies);
    Matter.Composite.add(this.engine.world, this.terrain.bodies);

    this.propManager = new PropManager(this.engine.world, this.audio, this.particles, this.bus);
    this.propManager.initProps(this.terrain, this.seed);

    this.echoManager.initEchoes(this.terrain);
    if (!this.worldSim) this.worldSim = new WorldSimulationManager(this.seed);
    this.worldSim.initForTerrain(this.terrain);

    this.startX = x.world.startX;
    const initCfg = VEHICLE_ARCHETYPES[x.activeArchetype] ?? VEHICLE_ARCHETYPES.buggy;
    const startY = this.terrain.heightAt(this.startX) - (initCfg.wheelOffsetY + initCfg.wheelRadius);
    this.vehicle = new f0(this.startX, startY, x.activeArchetype, this.audio);
    Matter.Composite.add(this.engine.world, this.vehicle.composite);

    // Initial contacts so vehicle starts in grounded driving state
    this.vehicle.wheels.forEach((w) => {
      w.contact = true;
      w.contactGrace = 100;
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
    window.hudManager?.animations?.animateVehicleChange(this.vehicle.archetype.name);
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
    this.summitReached = false;
    this.bus.emit("run:reset", {});
    window.hudManager?.reset();

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
      const pt = pair.collision?.supports?.[0] ?? vBody.position;
      const normal = pair.collision?.normal ?? { x: 0, y: -1 };

      // Interactive destructible prop collision (use full speed)
      if (other.propDef) {
        const speed = Math.hypot(vel.x, vel.y);
        const energy = 0.5 * vBody.mass * speed * speed * 0.045;
        this.propManager.onHit(other, energy, pt, vel);
        this.score += 50;
        continue;
      }

      if (!this.terrainSet.has(other)) continue;

      const isChassis = vBody === this.vehicle.chassis;
      // For terrain segments, compute velocity perpendicular to the terrain slope so rolling across 18px seams never triggers false impacts
      const tNorm = this.terrain ? this.terrain.normalAt(vBody.position.x) : normal;
      const impactVn = Math.max(0, vel.x * (-tNorm.x) + vel.y * (-tNorm.y));
      if (!isChassis && !this.wasAirborne && this.vehicle.airborneTimer < 80 && impactVn < 3.5) {
        continue;
      }

      const energy = 0.5 * vBody.mass * impactVn * impactVn * 0.055;
      if (energy < 0.14) continue;

      // Cooldown so multi-wheel or seam contacts don't double-fire in the same landing
      if (!isChassis && this.time - (this.lastTerrainImpactTime || 0) < 160) continue;
      this.lastTerrainImpactTime = this.time;

      const severity = this.classify(energy);
      const mat = MATERIALS[other.materialKind] ?? MATERIALS.dirt;

      this.audio.impact(b(energy / 3, 0.05, 1), other.materialKind, isChassis);
      this.particles.spawnLandingBurst(pt.x, pt.y, b(energy * 1.2, 0.4, 2.4), mat);

      if (severity !== "light") {
        if (mat.name === "rock" || isChassis) {
          this.particles.spawnSparks(pt.x, pt.y, normal.x, normal.y, Math.min(8, Math.round(energy * 3)));
        }
      }

      const shakeMags = { light: 0.04, medium: 0.12, heavy: 0.22, critical: 0.38 };
      this.camera.shake(shakeMags[severity], severity === "light" ? 120 : 240, normal.x, normal.y);
      this.camera.pulseZoom(severity === "light" ? 0.008 : 0.025);

      this.vehicle.driver.applyShock(energy);

      // Crash state machine & slow motion only on true critical chassis impact
      if (isChassis && severity === "critical") {
        this.deathState = "crashed";
        if (!x.visual.reducedMotion) {
          this.timeScale = 0.45;
          this.timeScaleTarget = 1.0;
        }
      }

      this.score += Math.round(energy * 12);
      this.bus.emit("vehicle:impact", {
        energy,
        tier: severity,
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

    if (this.terrain && this.vehicle?.chassis) {
      this.terrain.updateStreaming(this.vehicle.chassis.position.x, this.engine.world, this.terrainSet);
    }

    this.vehicle.update(inputState, dt, this.terrain);
    Matter.Engine.update(this.engine, dt);
    this.vehicle.solvePrismaticSuspension(this.terrain);

    const activePairs = this.engine.pairs.list.filter((p) => p.isActive);
    this.vehicle.markContacts(this.terrainSet, activePairs, this.terrain, dt);

    this.safety(dt);
  }

  safety(dt = 16.666) {
    const pos = this.vehicle.chassis.position;
    const vel = this.vehicle.chassis.velocity;
    const speed = Math.hypot(vel.x, vel.y);
    const groundY = this.terrain ? this.terrain.heightAt(pos.x) : 6000;

    if (!I0(pos) || !I0(vel) || speed > 220 || pos.y > Math.max(6000, groundY + 2500)) {
      this.triggerDeath("Fell into Mountain Chasm");
      return;
    }

    // Normalized upside-down amount U in [0, 1] (Spec #42)
    const sinAngle = Math.sin(this.vehicle.chassis.angle);
    const cosAngle = Math.cos(this.vehicle.chassis.angle);
    const isInverted = (cosAngle < -0.35 && Math.abs(sinAngle) > 0.88) || this.vehicle.roofContact;
    const isUpright = cosAngle > 0.65 && Math.abs(sinAngle) < 0.45;
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
        const wasActuallyInverted = this.upsideDownTimer >= 0.35;
        this.deathState = "normal";
        this.upsideDownTimer = 0;
        if (wasActuallyInverted) {
          this.score += 350;
          this.stunts.showToast("ROLLOVER RECOVERED!", 2);
        }

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

    // Activate multi-body driver crash ragdoll on fatal impact
    this.vehicle?.driver?.spawnCrashRagdoll(this.engine.world, this.vehicle.chassis);

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
    window.hudManager?.onDeath(reason);

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
    this.propManager.updateChunking(this.camera.x, dt);
    this.draw();
  };

  postPhysics(dt) {
    const v = this.vehicle;
    const isAirborne = v.airborne;

    this.stunts.update(v, this.terrain, dt);
    this.echoManager.update(v, dt);

    if (!isAirborne && this.wasAirborne) {
      this.stunts.onLanding(v, this.terrain);
      this.bus.emit("vehicle:land", {
        compression: Math.max(v.wheels[0]?.compression ?? 0.4, v.wheels[1]?.compression ?? 0.4),
      });
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

    // Living World Simulation 2.0 update (autonomous clock, weather, wind, wildlife, NPCs, events)
    if (this.worldSim) {
      this.worldSim.update(dt, this);
    }

    // Track expedition records
    const distMeters = Math.max(0, (v.chassis.position.x - this.startX) / 40);
    if (distMeters > this.maxDistance) {
      this.maxDistance = distMeters;
      this.score += Math.round(distMeters - this.maxDistance + 1);
    }

    if (distMeters >= 8100 && !this.summitReached) {
      this.summitReached = true;
      this.score += 5000;
      this.stunts.showToast("SUMMIT OBSERVATORY REACHED (8.1 KM) +5000", 5);
      this.saveCareer();
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
        pitch: Math.round(normalizeAngle(v.chassis.angle) * 180 / Math.PI * 10) / 10,
        compFront: Math.round(v.wheels[1].compression * 100) / 100,
        compRear: Math.round(v.wheels[0].compression * 100) / 100,
        slip: Math.round(v.wheels[0].slip * 100) / 100,
        camState: this.camera.state,
        camShot: this.camera.shotType,
        camZoom: Math.round(this.camera.zoom * 1000) / 1000,
        camFov: Math.round(this.camera.fov * 10) / 10,
        camLookAhead: Math.round(this.camera.lookAheadDistance || 0),
        worldPhase: this.worldSim?.state?.phaseName || "MORNING",
        worldSeason: this.worldSim?.state?.season || "AUTUMN",
        worldWeather: this.worldSim?.state?.weather || "CLEAR",
        state: this.deathState
      });
      if (this.telemetrySamples.length > 2500) this.telemetrySamples.shift();
    }

    // Audio pitch modulation
    this.audio.setEngine(v.rpm, Math.abs(this.input.throttle));
    this.audio.setWind(v.speed);

    // Broadcast live telemetry
    const statsPayload = {
      distance: this.maxDistance,
      altitude: this.highestAltitude,
      speed: Math.abs(v.forwardSpeed) * 7.2,
      airtime: this.stunts.airtime,
      rpm: v.rpm,
      fuel: v.fuel,
      engineTemp: v.engineTemp,
      airborne: v.airborne,
      score: this.score,
      incline: Math.round(normalizeAngle(v.chassis.angle) * 180 / Math.PI),
      echoCount: this.echoManager.collectedCount,
      echoTotal: this.echoManager.totalCount,
      biomeName: this.terrain.biomeAt(v.chassis.position.x).name,
      vehicleName: v.archetype.name,
      comboMultiplier: this.stunts.comboMultiplier,
      comboTimer: this.stunts.comboTimer,
      activeStunt: this.stunts.activeStuntName,
    };
    this.bus.emit("stats:update", statsPayload);
    window.hudManager?.update(statsPayload, dt);
  }

  draw() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const allBodies = this.debug ? Matter.Composite.allBodies(this.engine.world) : [];
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
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;
  // Cap internal Canvas 2D buffer to 1600px max dimension at 1x logical scale so 4K/Retina/Mobile devices maintain 60 FPS
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(w, h, 1)) * (x.visual.renderScale || 1);
  canvas.width = Math.max(640, Math.floor(w * scale));
  canvas.height = Math.max(360, Math.floor(h * scale));
  const threeCanvas = document.getElementById("three-canvas");
  if (threeCanvas && window.game?.threeDepth) {
    window.game.threeDepth.resize(w, h);
  }
  window.hudManager?.resize();
};
window.addEventListener("resize", resize);
resize();

const game = new q0(canvas, 48192);
window.game = game;

const hudManager = new HUDManager();
hudManager.init(game);
window.hudManager = hudManager;

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
  fuel: 100,
  engineTemp: 40,
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

// Floating Stunt Toast (deduplicated & capped at 3)
game.bus.on("stunt:awarded", (data) => {
  if (hudStunt) {
    const lastToast = hudStunt.lastElementChild;
    if (lastToast && lastToast.getAttribute("data-stunt") === data.name) {
      return;
    }
    while (hudStunt.children.length >= 3) {
      hudStunt.firstElementChild?.remove();
    }
    const toast = document.createElement("div");
    toast.className = `stunt-toast tier-${data.tier}`;
    toast.setAttribute("data-stunt", data.name);
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
  window.hudManager?.animations?.animatePause(isPaused);
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
  const hudThree = $el("hud-three-canvas");
  if (hudThree) hudThree.style.display = "block";
  const pedals = $el("pedals");
  if (pedals) pedals.style.display = "flex";
  window.hudManager?.animations?.animateHUDIntro(window.hudManager);
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
