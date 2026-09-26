# PART 3: Interactive Physics Props, Multi-Body Fracture Debris & Procedural Terrain Grammar
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

    // 1. Trail signs at scenic spots & early expedition markers
    const signDistances = [820, 2800, 5100, 8500, 13800, 18400, 24200, 31500];
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

    // 2. Breakable wooden fences along ridges & bridges
    const fenceClusters = [1320, 3200, 7200, 12200, 19100, 27400];
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

    // 3. Breakable Wooden Supply Crates & Stacked Outpost Caches
    const crateStations = [2250, 2650, 3800, 6200, 7800, 11200, 14800, 21500, 25800, 26300];
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

  updateChunking(camX, dt = 16.666) {
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

    // Update physical fracture debris lifecycle
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const dItem = this.debrisList[i];
      dItem.life -= dt / 1000;
      if (dItem.life <= 0 || Math.abs(dItem.body.position.x - camX) > 1600 || dItem.body.position.y > 4000) {
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
    // Enforce debris pool limit (max 42 rigid bodies)
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

      // Group -1 so debris collides with terrain (group 0) and tumbles realistically without colliding with vehicle (group -1)
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
          restitution: 0.0,
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

  segmentAt(xPos) {
    for (const seg of this.segments) {
      if (xPos >= seg.startX && xPos <= seg.endX) return seg;
    }
    return { name: "Starting Apron", type: "flat" };
  }
}
'''

with open('engine_part3.js', 'w', encoding='utf-8') as f:
    f.write(part3)

print("Part 3 updated successfully.")
