# PART 2: Audio, Event Bus, Input, Particles, Camera
import os

part2 = r'''
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
'''

with open('engine_part2.js', 'w', encoding='utf-8') as f:
    f.write(part2)

print("Part 2 written successfully.")
