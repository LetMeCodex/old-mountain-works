# LIVING WORLD SIMULATION MODULE (gen_world.py -> engine_world.js)
# Implements Sections 1-48: Centralized WorldState, Day/Night Cycle, Sun/Moon/Stars,
# 12-State Weather Machine, 3-Layer Clouds, Rain/Puddles/Thunderstorms/Rainbow,
# 4 Seasons with Progressive Transitions, Global Wind Vector, Instanced Vegetation,
# Water Bodies, Boids Bird Flocks, 8-State Ground Wildlife, Insects, Schedule-Driven NPCs,
# Background Ridge Traffic, Chained EventDirector with 4 Rarity Tiers, World Memory & LOD.

import os

world_js = r'''
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
'''

with open('engine_world.js', 'w', encoding='utf-8') as f:
    f.write(world_js)

print("Living World Simulation module written successfully.")
