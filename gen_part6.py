# PART 6: Game Loop, Orchestrator (q0), Death State Machine, DOM Wiring & Telemetry
import os

part6 = r'''
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
'''

with open('engine_part6.js', 'w', encoding='utf-8') as f:
    f.write(part6)

print("Part 6 updated successfully.")
