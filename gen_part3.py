# PART 3: Interactive Physics Props, Multi-Body Fracture Debris & Mountain Generation 2.0 (8.2km Grammar + Streamed Physics)
import os

part3 = r'''
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
'''

with open('engine_part3.js', 'w', encoding='utf-8') as f:
    f.write(part3)

print("Part 3 updated successfully.")
