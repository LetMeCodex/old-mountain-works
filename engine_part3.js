
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
  // 1. Rollers & Rhythm Warmups (Now with real verticality & launch hops!)
  ROLLERS:          { cat: "ROLLERS",  name: "Foothill Hump Rollers", dx: 680,  dy: -65,  exitSlope: -0.18, maxDeg: 24, jumpPotential: "Medium", landingQuality: "Ideal",     surface: "grass" },
  LONG_ROLLERS:     { cat: "ROLLERS",  name: "Highland Swell Run",    dx: 960,  dy: -110, exitSlope: -0.22, maxDeg: 26, jumpPotential: "Medium", landingQuality: "Ideal",     surface: "grass" },
  DOUBLE_HUMP:      { cat: "RHYTHM",   name: "Double Launch Rollers", dx: 820,  dy: -95,  exitSlope: -0.16, maxDeg: 30, jumpPotential: "High",   landingQuality: "Good",      surface: "dirt" },
  TRIPLE_HUMP:      { cat: "RHYTHM",   name: "Triple Rhythm Spine",   dx: 1060, dy: -120, exitSlope: -0.18, maxDeg: 32, jumpPotential: "High",   landingQuality: "Good",      surface: "dirt" },
  CAMELBACK:        { cat: "RHYTHM",   name: "Camelback Twin Launch", dx: 840,  dy: -85,  exitSlope: 0.14,  maxDeg: 32, jumpPotential: "High",   landingQuality: "Good",      surface: "grass" },
  COMPRESSION_RUN:  { cat: "SUSP",     name: "Deep Compression Whoops",dx: 800, dy: -70,  exitSlope: -0.22, maxDeg: 30, jumpPotential: "Medium", landingQuality: "Good",      surface: "mud" },
  OFF_CAMBER:       { cat: "TECH",     name: "Slick Off-Camber Ledge",dx: 760,  dy: -165, exitSlope: -0.28, maxDeg: 34, jumpPotential: "Medium", landingQuality: "Technical", surface: "wet_rock" },
  ROCK_FIELD:       { cat: "TECH",     name: "Jagged Boulder Scree",  dx: 860,  dy: -195, exitSlope: -0.30, maxDeg: 36, jumpPotential: "Medium", landingQuality: "Rough",     surface: "rock" },
  MOGUL_FIELD:      { cat: "SUSP",     name: "Suspension Breaker Moguls", dx: 820, dy: -140, exitSlope: -0.24, maxDeg: 34, jumpPotential: "High", landingQuality: "Rough",  surface: "gravel" },

  // 2. Steep & Multi-Stage Climbs (Require real momentum or vehicle stalls & rolls backward!)
  SHALLOW_CLIMB:    { cat: "CLIMB",    name: "28° Foothill Climb",    dx: 780,  dy: -285, exitSlope: -0.44, maxDeg: 32, jumpPotential: "Medium", landingQuality: "Ideal",     surface: "dirt" },
  LONG_CLIMB:       { cat: "CLIMB",    name: "Sustained Ridge Wall",  dx: 1220, dy: -540, exitSlope: -0.54, maxDeg: 38, jumpPotential: "Medium", landingQuality: "Good",      surface: "rock" },
  STEEP_CLIMB:      { cat: "CLIMB",    name: "40° Steep Escarpment",  dx: 920,  dy: -485, exitSlope: -0.64, maxDeg: 42, jumpPotential: "High",   landingQuality: "Good",      surface: "rock" },
  STEPPED_RIDGE:    { cat: "CLIMB",    name: "Multi-Stage Stepped Climb", dx: 1160, dy: -560, exitSlope: -0.58, maxDeg: 42, jumpPotential: "High", landingQuality: "Technical", surface: "wet_rock" },
  EXTREME_CLIMB:    { cat: "EXTREME",  name: "44° Everest Headwall",  dx: 1020, dy: -610, exitSlope: -0.72, maxDeg: 44, jumpPotential: "High",   landingQuality: "Narrow",    surface: "rock" },
  SUMMIT_FACE:      { cat: "EXTREME",  name: "Vertical Summit Face",  dx: 1180, dy: -690, exitSlope: -0.75, maxDeg: 45, jumpPotential: "Extreme",landingQuality: "Narrow",    surface: "snow" },
  FINAL_ASCENT:     { cat: "EXTREME",  name: "The Abyssal Wall",      dx: 1260, dy: -740, exitSlope: -0.72, maxDeg: 45, jumpPotential: "Extreme",landingQuality: "Narrow",    surface: "snow" },

  // 3. Sharp Mountain Crests (UPHILL -> Tiny Peak -> Immediate Steep DOWNHILL!)
  BLIND_CREST:      { cat: "CREST",    name: "Blind Knife-Edge Crest",dx: 680,  dy: 175,  exitSlope: 0.54,  maxDeg: 38, jumpPotential: "Extreme",landingQuality: "Downhill",  surface: "rock" },
  RAZOR_CREST:      { cat: "CREST",    name: "Razorback Launch Spine",dx: 720,  dy: 245,  exitSlope: 0.64,  maxDeg: 42, jumpPotential: "Extreme",landingQuality: "Narrow",    surface: "rock" },
  BROKEN_RIDGE:     { cat: "TECH",     name: "Exposed Broken Spine",  dx: 920,  dy: -240, exitSlope: -0.38, maxDeg: 38, jumpPotential: "High",   landingQuality: "Technical", surface: "wet_rock" },
  NARROW_RIDGE:     { cat: "TECH",     name: "Knife-Edge Pass",       dx: 840,  dy: -210, exitSlope: -0.32, maxDeg: 36, jumpPotential: "High",   landingQuality: "Narrow",    surface: "gravel" },

  // 4. Natural Jumps, Double-Jump Combos & Giant Gaps
  KICKER:           { cat: "JUMP",     name: "Natural Dirt Launch",   dx: 780,  dy: 45,   exitSlope: 0.38,  maxDeg: 38, jumpPotential: "High",   landingQuality: "Downhill",  surface: "dirt" },
  LONG_KICKER:      { cat: "JUMP",     name: "Giant Canyon Gap",      dx: 1060, dy: 120,  exitSlope: 0.44,  maxDeg: 42, jumpPotential: "Extreme",landingQuality: "Slope",     surface: "rock" },
  RIDGE_LAUNCH:     { cat: "JUMP",     name: "Double-Jump Ridge Combo",dx: 980, dy: 30,   exitSlope: 0.36,  maxDeg: 38, jumpPotential: "Extreme",landingQuality: "Good",      surface: "dirt" },
  CLIFF_LAUNCH:     { cat: "JUMP",     name: "Surprise Cliff Drop",   dx: 1120, dy: 260,  exitSlope: 0.52,  maxDeg: 42, jumpPotential: "Extreme",landingQuality: "Downhill",  surface: "wood" },
  DOWNHILL_LAUNCH:  { cat: "JUMP",     name: "Downhill Speed Vault",  dx: 960,  dy: 310,  exitSlope: 0.56,  maxDeg: 42, jumpPotential: "Extreme",landingQuality: "Downhill",  surface: "dirt" },

  // 5. Real Steep Descents & Deep Trenches (Force Braking & Speed Control!)
  SHALLOW_DESCENT:  { cat: "DESCENT",  name: "30° Fast Descent",      dx: 820,  dy: 290,  exitSlope: 0.44,  maxDeg: 32, jumpPotential: "Medium", landingQuality: "Downhill",  surface: "dirt" },
  STEEP_DESCENT:    { cat: "DESCENT",  name: "42° Gorge Plunge",      dx: 920,  dy: 495,  exitSlope: 0.64,  maxDeg: 42, jumpPotential: "High",   landingQuality: "Downhill",  surface: "gravel" },
  LONG_DESCENT:     { cat: "DESCENT",  name: "50° Terminal Drop Run", dx: 1340, dy: 720,  exitSlope: 0.68,  maxDeg: 44, jumpPotential: "Extreme",landingQuality: "Downhill",  surface: "gravel" },
  V_VALLEY:         { cat: "VALLEY",   name: "Deep V-Trench Launch",  dx: 880,  dy: -75,  exitSlope: -0.52, maxDeg: 40, jumpPotential: "High",   landingQuality: "Good",      surface: "rock" },
  U_VALLEY:         { cat: "VALLEY",   name: "Deep Compression Bowl", dx: 1080, dy: -65,  exitSlope: -0.46, maxDeg: 38, jumpPotential: "High",   landingQuality: "Ideal",     surface: "dirt" },
  GLACIAL_BOWL:     { cat: "VALLEY",   name: "Glacial Ice Trench",    dx: 1280, dy: -55,  exitSlope: -0.44, maxDeg: 38, jumpPotential: "Extreme",landingQuality: "Ideal",     surface: "ice" },
  RAVINE:           { cat: "VALLEY",   name: "Abyssal Ravine Gorge",  dx: 860,  dy: -60,  exitSlope: -0.48, maxDeg: 40, jumpPotential: "High",   landingQuality: "Good",      surface: "mud" },
  MINE_PIT:         { cat: "VALLEY",   name: "Sunken Quarry Trench",  dx: 1140, dy: -50,  exitSlope: -0.50, maxDeg: 40, jumpPotential: "High",   landingQuality: "Good",      surface: "gravel" },

  // 6. Short Tactical Recovery Benches (Moments to breathe & rebuild momentum!)
  PLATEAU:          { cat: "RECOVERY", name: "Momentum Bench Shelf",  dx: 580,  dy: -35,  exitSlope: -0.10, maxDeg: 14, jumpPotential: "Low",    landingQuality: "Ideal",     surface: "grass" },
  RECOVERY_VALLEY:  { cat: "RECOVERY", name: "Saddle Recovery Basin", dx: 640,  dy: 25,   exitSlope: -0.14, maxDeg: 16, jumpPotential: "Low",    landingQuality: "Ideal",     surface: "dirt" },
};

// Markov Category Transition Rules (Section 26 & 27: Rhythm of Climb -> Crest -> Descent -> Trench -> Jump)
const CATEGORY_TRANSITIONS = {
  ROLLERS:  ["CLIMB", "EXTREME", "JUMP", "CREST"],
  RHYTHM:   ["CLIMB", "EXTREME", "JUMP", "VALLEY", "CREST"],
  SUSP:     ["CLIMB", "EXTREME", "JUMP", "CREST"],
  TECH:     ["EXTREME", "CREST", "DESCENT", "JUMP"],
  CLIMB:    ["CREST", "EXTREME", "JUMP", "DESCENT"],
  EXTREME:  ["CREST", "DESCENT", "JUMP", "RECOVERY"],
  CREST:    ["DESCENT", "VALLEY", "JUMP"],
  JUMP:     ["VALLEY", "DESCENT", "CLIMB", "RECOVERY"],
  DESCENT:  ["VALLEY", "JUMP", "CLIMB", "EXTREME"],
  VALLEY:   ["CLIMB", "EXTREME", "JUMP", "CREST"],
  RECOVERY: ["CLIMB", "EXTREME", "JUMP", "DESCENT"],
};

// 10 Signature Expedition Setpieces anchored at key distances across the 8.2km mountain
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
  activeRadius = x.world.activePhysicsRadius || 2160;
  activeChunkCount = 0;
  lastStreamCenterX = -999999;
  stats = null;

  constructor(seed) {
    this.seed = seed;
    this.generateGrammarTerrain();
  }

  // Difficulty curve across the full 8.2km expedition (Starts high enough for real mountain challenge!)
  computeDifficulty(distMeters) {
    let base = 0.42;
    if (distMeters < 800) {
      base = 0.42 + (distMeters / 800) * 0.16; // 0.42 -> 0.58
    } else if (distMeters < 1600) {
      base = 0.58 + ((distMeters - 800) / 800) * 0.12; // 0.58 -> 0.70
    } else if (distMeters < 2600) {
      base = 0.70 + ((distMeters - 1600) / 1000) * 0.10; // 0.70 -> 0.80
    } else if (distMeters < 3800) {
      base = 0.80 + ((distMeters - 2600) / 1200) * 0.08; // 0.80 -> 0.88
    } else if (distMeters < 5200) {
      base = 0.88 + ((distMeters - 3800) / 1400) * 0.06; // 0.88 -> 0.94
    } else {
      base = 0.94 + b((distMeters - 5200) / 2800, 0, 1) * 0.06; // 0.94 -> 1.00
    }
    return b(base, 0.40, 1.0);
  }

  classifyDifficultyCategory(diff) {
    if (diff < 0.48) return "MODERATE";
    if (diff < 0.68) return "CHALLENGING";
    if (diff < 0.86) return "HARD";
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
    const allowedCats = CATEGORY_TRANSITIONS[prevCat] || ["CLIMB", "CREST", "DESCENT", "JUMP"];

    // 3. Filter candidate shapes by Act / Sector appropriateness and anti-repetition
    const candidates = [];
    const allKeys = Object.keys(PARAMETRIC_SHAPES);

    for (const key of allKeys) {
      const def = PARAMETRIC_SHAPES[key];
      if (!allowedCats.includes(def.cat)) continue;

      // Never repeat a shape present in the last 3 segments
      if (recentTypes.slice(-3).includes(key)) continue;

      // Weight high-action climbs, crests, descents, trenches, and jumps across all sectors!
      if (def.cat === "CLIMB" || def.cat === "EXTREME" || def.cat === "CREST" || def.cat === "DESCENT" || def.cat === "JUMP" || def.cat === "VALLEY") {
        candidates.push(key, key);
      }
      if (distMeters >= 1600 && distMeters <= 2400) {
        if (def.cat === "DESCENT" || def.cat === "VALLEY" || key === "STEPPED_RIDGE") {
          candidates.push(key, key);
        }
      }
      if (distMeters >= 3500 && distMeters <= 5000) {
        if (key === "GLACIAL_BOWL" || key === "LONG_KICKER" || key === "DOWNHILL_LAUNCH") {
          candidates.push(key, key);
        }
      }
      if (distMeters >= 5000 && (def.cat === "EXTREME" || key === "STEEP_CLIMB" || key === "RAZOR_CREST")) {
        candidates.push(key, key);
      }

      candidates.push(key);
    }

    if (candidates.length === 0) {
      return { key: "STEEP_CLIMB", overrideName: null, signature: null };
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

    // 1. Initial starting apron (-2500 to startX + 260)
    for (let q = -2500; q < startX + 260; q += this.step) {
      this.samples.push({
        x: q,
        y: groundBase,
        material: "grass",
        biomeId: "meadow",
        slope: 0,
        curvature: 0,
      });
    }

    // 2. EXTREME MOUNTAIN OPENING SEQUENCE (Sections A -> L right in the first 0m -> 220m!):
    //    Immediately delivers: 28° Climb -> Sharp Crest -> Steep 38° Descent (Brake Test!) -> Deep V-Trench ->
    //    Natural Launch Ramp (Big Airtime!) -> Multi-Stage 42° Wall (Momentum Climb!) -> Double-Jump Ridge -> Giant Gap!
    const openingSequence = [
      { key: "KICKER",          name: "Section A: Launch Approach",       dx: 580,  dy: -75,  exitSlope: -0.28, surface: "grass" },
      { key: "STEEP_CLIMB",     name: "Section B: 35° Escarpment Climb",  dx: 840,  dy: -420, exitSlope: -0.58, surface: "rock"  },
      { key: "RAZOR_CREST",     name: "Section E: Knife-Edge Crest Drop", dx: 720,  dy: 250,  exitSlope: 0.62,  surface: "rock"  },
      { key: "STEEP_DESCENT",   name: "Section F: 40° Danger Plunge",     dx: 860,  dy: 440,  exitSlope: 0.58,  surface: "dirt"  },
      { key: "V_VALLEY",        name: "Section G: Deep V-Trench Vault",   dx: 860,  dy: -95,  exitSlope: -0.52, surface: "mud"   },
      { key: "STEPPED_RIDGE",   name: "Section H: Multi-Stage Headwall",  dx: 1080, dy: -540, exitSlope: -0.64, surface: "rock"  },
      { key: "RIDGE_LAUNCH",    name: "Section I: Double-Jump Ridge",     dx: 960,  dy: 40,   exitSlope: 0.38,  surface: "dirt"  },
      { key: "LONG_KICKER",     name: "Section J: Giant Ravine Gap",      dx: 1040, dy: 110,  exitSlope: 0.42,  surface: "rock"  },
    ];

    let curX = this.samples[this.samples.length - 1].x;
    let curY = groundBase;
    let curSlope = 0.0;
    let seqIdx = 0;
    let prevCat = "JUMP";
    const recentTypes = [];

    while (curX < totalLength) {
      const distMeters = Math.max(0, (curX - startX) / 40);
      const difficulty = this.computeDifficulty(distMeters);
      const biome = this.getBiomeAtDist(distMeters);

      let shapeKey, segName, segDx, segDy, targetSlope, segSurface, segSignature = null;
      let shapeDef;

      // Final 220m (7,980m -> 8,200m): Summit Observatory Panoramic Plateau
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
        segDx = Math.round((op.dx * (0.94 + Math.abs(nSwell(curX / 900)) * 0.14)) / this.step) * this.step;
        segDy = op.dy * (1.0 + difficulty * 0.22);
        targetSlope = op.exitSlope;
        segSurface = op.surface;
      } else {
        const picked = this.pickNextShapeKey(distMeters, prevCat, recentTypes, nChoice);
        shapeKey = picked.key;
        shapeDef = PARAMETRIC_SHAPES[shapeKey] || PARAMETRIC_SHAPES.STEEP_CLIMB;
        segName = picked.overrideName || shapeDef.name;
        segSignature = picked.signature;

        // Seeded parametric variation
        const lenScale = 0.86 + Math.abs(nSwell(curX * 0.0011 + seqIdx)) * 0.28;
        const ampScale = (0.95 + Math.abs(nMacro(curX * 0.0007 + seqIdx)) * 0.35) * (0.90 + difficulty * 0.45);

        segDx = Math.round((shapeDef.dx * lenScale) / this.step) * this.step;
        segDy = shapeDef.dy * ampScale;

        // Macro Act Envelope Bias:
        if (distMeters >= 1600 && distMeters < 2300 && shapeDef.cat !== "CLIMB") {
          segDy += 140;
        } else if (distMeters >= 5000 && distMeters < 7950 && (shapeDef.cat === "CLIMB" || shapeDef.cat === "EXTREME")) {
          segDy -= 110;
        }

        targetSlope = b(shapeDef.exitSlope * (0.95 + difficulty * 0.30), -0.78, 0.72);
        segSurface = shapeDef.surface || biome.defaultMaterial;
        if (biome.id === "glacier" && (shapeDef.cat === "VALLEY" || shapeDef.cat === "ROLLERS")) {
          segSurface = "ice";
        } else if (biome.id === "summit") {
          segSurface = Math.abs(targetSlope) > 0.45 ? "rock" : "snow";
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

      // Sample along Cubic Hermite Spline with Extreme Mountain Meso + Micro Articulations
      const L = x1 - x0;
      const maxAllowedDeg = b((shapeDef.maxDeg || 42) + difficulty * 4, 22, 45.1);
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

        const env = Math.sin(u * Math.PI);
        const env2 = env * env;

        // Extreme Mountain Meso & Micro Shape Articulations (Sections 5, 6, 7, 15, 17, 18, 19, 28)
        if (shapeKey === "ROLLERS" || shapeKey === "LONG_ROLLERS") {
          y -= Math.sin(u * Math.PI * 3) * (38.0 + difficulty * 22.0) * env;
        } else if (shapeKey === "DOUBLE_HUMP" || shapeKey === "CAMELBACK") {
          // Two steep launch humps in succession
          y -= Math.sin(u * Math.PI * 3) * (58.0 + difficulty * 28.0) * env;
        } else if (shapeKey === "TRIPLE_HUMP") {
          y -= Math.sin(u * Math.PI * 5) * (46.0 + difficulty * 22.0) * env;
        } else if (shapeKey === "KICKER") {
          // Steep natural upward kicker ramp (u < 0.42) followed by deep landing drop!
          if (u < 0.42) {
            y -= Math.pow(Math.sin((u / 0.42) * Math.PI), 1.2) * (68.0 + difficulty * 32.0);
          } else {
            y += Math.sin(((u - 0.42) / 0.58) * Math.PI) * (54.0 + difficulty * 28.0);
          }
        } else if (shapeKey === "LONG_KICKER") {
          // Giant Gap: speed-building dip -> high launch ramp -> deep chasm -> landing table
          if (u < 0.34) {
            y -= Math.sin((u / 0.34) * Math.PI) * (82.0 + difficulty * 38.0);
          } else {
            y += Math.pow(Math.sin(((u - 0.34) / 0.66) * Math.PI), 1.1) * (135.0 + difficulty * 55.0);
          }
        } else if (shapeKey === "RIDGE_LAUNCH") {
          // Double-Jump Terrain (Sec 18: Downhill -> Valley -> Launch 1 -> Land -> Launch 2)
          y -= Math.sin(u * Math.PI * 4) * (64.0 + difficulty * 26.0) * env;
        } else if (shapeKey === "CLIFF_LAUNCH" || shapeKey === "DOWNHILL_LAUNCH") {
          // Surprise Terrain (Sec 28): looks like a small crest, then drops into a massive chasm!
          if (u < 0.30) {
            y -= Math.sin((u / 0.30) * Math.PI) * (62.0 + difficulty * 26.0);
          } else {
            y += Math.sin(((u - 0.30) / 0.70) * Math.PI) * (145.0 + difficulty * 55.0);
          }
        } else if (shapeKey === "V_VALLEY" || shapeKey === "RAVINE") {
          // Deep V-Trench (Sec 17): plunges 160px down then shoots up a steep exit launch wall!
          y += Math.pow(env, 1.3) * (145.0 + difficulty * 65.0);
        } else if (shapeKey === "U_VALLEY" || shapeKey === "GLACIAL_BOWL") {
          // Deep High-Speed Bowl
          y += env2 * (160.0 + difficulty * 75.0);
        } else if (shapeKey === "MINE_PIT") {
          const pit = Math.min(1, env * 1.6);
          y += pit * (135.0 + difficulty * 55.0);
        } else if (shapeKey === "STEPPED_RIDGE") {
          // Multi-Stage Climb (Sec 15): 30° slope -> small crest -> short dip -> 42° wall -> shelf -> final 45° pitch
          y += (Math.sin(u * Math.PI * 4) * 42.0 - Math.cos(u * Math.PI * 2) * 24.0) * env;
        } else if (shapeKey === "RAZOR_CREST" || shapeKey === "BLIND_CREST") {
          // Sharp Mountain Crest (Sec 6): steep UPHILL -> sharp peak at u=0.38 -> steep DOWNHILL!
          const peak = Math.exp(-Math.pow((u - 0.38) / 0.14, 2));
          y -= peak * (96.0 + difficulty * 42.0) * env;
        } else if (shapeKey === "ROCK_FIELD" || shapeKey === "MOGUL_FIELD") {
          // Wheelbase-challenging rock ledges & moguls
          y += (Math.sin(q / 22.0) * 11.5 + nDetail(q / 38.0) * 14.0) * env2;
        } else if (shapeKey === "OFF_CAMBER" || shapeKey === "BROKEN_RIDGE") {
          y += (Math.sin(q / 19.0) * 10.5 + Math.cos(q / 35.0) * 13.5) * env2;
        } else if (shapeKey === "COMPRESSION_RUN") {
          y += Math.sin(u * Math.PI * 6) * (32.0 + difficulty * 14.0) * env2;
        } else {
          // Natural uneven rock shelves & erosion on climbs/descents
          y += (nDetail(q / 65.0) * 12.0 + Math.sin(u * Math.PI * 3) * 18.0) * env2;
        }

        // Physics Safety & Curvature Clamp:
        const prev = this.samples[this.samples.length - 1];
        const dx = q - prev.x;
        let dy = y - prev.y;

        // 1. Allow sharper crests and launch lips (maxDeltaSlope = 0.145 -> ~8.3 deg per 18px sample)
        const maxDeltaSlope = 0.145;
        const desiredSlope = dy / dx;
        const clampedCurvSlope = b(desiredSlope, prev.slope - maxDeltaSlope, prev.slope + maxDeltaSlope);
        dy = clampedCurvSlope * dx;

        // 2. Maximum slope clamp (<= 45.1 deg -> dy <= 18.06px per 18px step)
        const maxDy = dx * Math.min(maxSlopeTan, Math.tan(0.787));
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
        if (Math.abs(actualSlope) > 0.62 && biome.id !== "summit" && mat !== "metal" && mat !== "wet_rock") {
          mat = "rock";
        } else if (biome.id === "summit" && Math.abs(actualSlope) < 0.20) {
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
