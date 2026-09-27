# Python script to assemble Part 1: Core Math, Config, Archetypes, Biomes, Materials
import os

parts = []

# PART 1: Core Math, Config, Archetypes, Biomes, Materials
parts.append(r'''// ============================================================================
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
  maxSubSteps: 6,
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
    activePhysicsRadius: 3200, // vehicle X +- 3,200px active collision window
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
''')

# Write Part 1
with open('engine_part1.js', 'w', encoding='utf-8') as f:
    f.write(parts[0])

print("Part 1 written successfully.")
