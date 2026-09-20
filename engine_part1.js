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
