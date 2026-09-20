
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
