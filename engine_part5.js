
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
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

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
      const sun = new THREE.DirectionalLight(0xffecd2, 1.25);
      sun.position.set(500, 1000, 800);
      this.scene.add(sun);

      const hemiLight = new THREE.HemisphereLight(0xb4c7be, 0x48534e, 0.65);
      this.scene.add(hemiLight);

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
          const x = pos.getX(i);
          const ridge = Math.sin(x * 0.004) * 80 + Math.sin(x * 0.012) * 45;
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

  sync(cam, vehicle, relics) {
    if (!this.enabled || !this.renderer || !this.camera) return;

    const targetX = (cam.x - 220) * 0.35;
    const targetY = (-cam.y + 560) * 0.35;
    const targetZ = 850 / cam.zoom;

    this.camera.position.x = targetX;
    this.camera.position.y = targetY;
    this.camera.position.z = targetZ;
    this.camera.lookAt(targetX, targetY, 0);

    for (const m of this.mountains) {
      m.mesh.position.x = targetX * (1 + m.def.z * 0.0003);
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
    this.renderer.setSize(w, h);
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

    // Sync Three.js 2.5D visual depth layer
    if (game?.threeDepth) {
      game.threeDepth.sync(camera, vehicle, game.echoManager?.relics);
    }

    ctx.save();
    this.drawSky(width, height, camera, biome);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    const shake = camera.shakeOffset;
    ctx.translate(-camera.x + shake.x, -camera.y + shake.y);

    this.drawParallax(camera, width, height, time, biome);
    this.drawTerrain(camera, width, height, biome);
    this.drawProps(propManager, camera);

    if (game?.echoManager) {
      this.drawMountainEchoes(game.echoManager, camera);
    }

    this.drawParticles(particles, ["dust", "snow", "grass", "wood"]);
    this.drawVehicle(vehicle, biome);
    this.drawParticles(particles, ["spark", "grit", "stone"]);

    if (debug) {
      this.drawDebug(allBodies, vehicle, camera, game);
    }

    ctx.restore();

    this.drawGrain(width, height);
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

  drawParallax(cam, w, h, time, biome) {
    const ctx = this.ctx;
    const layers = [
      { speed: 0.08, yOff: 180, amp: 160, freq: 0.00045, color: biome.far, opacity: 0.60 },
      { speed: 0.22, yOff: 240, amp: 120, freq: 0.00095, color: biome.mid, opacity: 0.78 },
      { speed: 0.42, yOff: 300, amp: 85, freq: 0.00180, color: biome.near, opacity: 0.92 },
    ];

    for (const l of layers) {
      ctx.save();
      ctx.fillStyle = l.color;
      ctx.globalAlpha = l.opacity;
      ctx.beginPath();

      const spanX = w / cam.zoom;
      const left = cam.x - spanX * 0.7;
      const right = cam.x + spanX * 0.7;
      const step = 40;

      ctx.moveTo(left - 20, cam.y + h);
      for (let px = left - 20; px <= right + 20; px += step) {
        const py = cam.y + l.yOff + Math.sin(px * l.freq + l.speed) * l.amp + Math.cos(px * l.freq * 2.3) * (l.amp * 0.35);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(right + 20, cam.y + h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawTerrain(cam, w, h, biome) {
    const ctx = this.ctx;
    const terrain = this.terrain;
    const spanX = w / cam.zoom;
    const left = cam.x - spanX * 0.65;
    const right = cam.x + spanX * 0.65;

    const firstX = terrain.samples[0]?.x ?? 0;
    const step = terrain.step;
    const maxIdx = terrain.samples.length - 1;
    const startIdx = Math.max(0, Math.min(maxIdx, Math.floor((left - firstX) / step) - 2));
    const endIdx = Math.max(0, Math.min(maxIdx, Math.ceil((right - firstX) / step) + 2));

    if (startIdx >= endIdx || !terrain.samples[startIdx] || !terrain.samples[endIdx]) return;

    // 1. Terrain Bedrock Fill
    ctx.save();
    ctx.fillStyle = biome.groundFill;
    ctx.beginPath();
    ctx.moveTo(terrain.samples[startIdx].x, cam.y + h + 200);

    for (let i = startIdx; i <= endIdx; i++) {
      const p = terrain.samples[i];
      if (p) ctx.lineTo(p.x, p.y);
    }

    ctx.lineTo(terrain.samples[endIdx].x, cam.y + h + 200);
    ctx.closePath();
    ctx.fill();

    // 2. Illustrated Top Crust / Foliage Ribbon
    ctx.lineWidth = 9.0;
    ctx.strokeStyle = biome.groundTop;
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
    ctx.strokeStyle = biome.groundTopLight;
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
    this.drawLandmarks(cam, left, right);
  }

  drawTerrainDetails(terrain, left, right, biome) {
    const ctx = this.ctx;
    ctx.save();
    const step = 32;
    const start = Math.floor(left / step) * step;
    const end = Math.ceil(right / step) * step;

    for (let q = start; q <= end; q += step) {
      const y = terrain.heightAt(q);
      const slope = terrain.slopeAt(q);
      const mat = terrain.materialAt(q);

      if (mat.name === "grass") {
        ctx.strokeStyle = biome.accent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(q, y - 2);
        ctx.lineTo(q + 3, y - 8);
        ctx.moveTo(q + 4, y - 2);
        ctx.lineTo(q + 8, y - 9);
        ctx.stroke();
      } else if (mat.name === "rock" || mat.name === "gravel") {
        ctx.fillStyle = "#1b1f1d";
        ctx.beginPath();
        ctx.arc(q + 2, y - 2, 2.0, 0, Math.PI * 2);
        ctx.arc(q + 10, y - 1, 1.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (mat.name === "snow") {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.ellipse(q + 5, y - 2, 5, 2, slope, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawLandmarks(cam, left, right) {
    const ctx = this.ctx;
    for (const b of BIOMES) {
      const lm = b.landmark;
      if (!lm || lm.x < left - 80 || lm.x > right + 80) continue;
      const ly = this.terrain.heightAt(lm.x);

      ctx.save();
      ctx.translate(lm.x, ly);

      if (lm.type === "shelter") {
        // Base Camp Outpost Cabin
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 2.4;
        ctx.fillStyle = "#d9cfb8";
        ctx.fillRect(-28, -32, 56, 32);
        ctx.strokeRect(-28, -32, 56, 32);

        // Gable roof
        ctx.fillStyle = "#8a533c";
        ctx.beginPath();
        ctx.moveTo(-34, -32);
        ctx.lineTo(0, -52);
        ctx.lineTo(34, -32);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Radio mast & windsock
        ctx.beginPath();
        ctx.moveTo(22, -52);
        ctx.lineTo(22, -88);
        ctx.moveTo(16, -72);
        ctx.lineTo(28, -72);
        ctx.stroke();

        ctx.fillStyle = "#d4622a";
        ctx.beginPath();
        ctx.arc(22, -88, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (lm.type === "cairn") {
        // High Crag Cairn & Prayer Flag String
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
        for (let f = 0; f < flags.length; f++) {
          ctx.fillStyle = flags[f];
          ctx.beginPath();
          ctx.moveTo(-18 + f * 9, -50 + f * 3);
          ctx.lineTo(-12 + f * 9, -44 + f * 3);
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
      const b = item.bodies[0];
      if (!b) continue;

      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);

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
  }

  drawVehicle(vehicle, biome) {
    const ctx = this.ctx;
    const chassis = vehicle.chassis;
    const vCfg = vehicle.archetype;

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

    // Articulated Driver
    this.drawArticulatedDriver(vehicle.driver, vehicle);

    // Roll cage bar
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 18, -h / 2 - 8);
    ctx.lineTo(-w / 2 + 16, -h / 2 - 28);
    ctx.lineTo(-w / 2 + 42, -h / 2 - 28);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

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

  drawArticulatedDriver(driver, vehicle) {
    const ctx = this.ctx;
    const hipX = -12;
    const hipY = -6 + driver.jolt;

    const spineAngle = driver.lean * 0.82;
    const torsoLen = 18;
    const shoulderX = hipX + Math.sin(spineAngle) * torsoLen;
    const shoulderY = hipY - Math.cos(spineAngle) * torsoLen;

    const headX = shoulderX + Math.sin(spineAngle) * 9;
    const headY = shoulderY - Math.cos(spineAngle) * 9;

    const wheelHubX = 14;
    const wheelHubY = -14;

    const handX = wheelHubX;
    const handY = driver.victory > 0.1 ? wheelHubY - 26 : wheelHubY - 2;

    const footX = 16;
    const footY = 4;

    ctx.save();
    ctx.lineCap = "round";

    // Torso (Expedition jacket with harness)
    ctx.lineWidth = 6.2;
    ctx.strokeStyle = "#c46b38";
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    // Torso outline
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Harness straps
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#1b1f1d";
    ctx.beginPath();
    ctx.moveTo(shoulderX - 2, shoulderY + 3);
    ctx.lineTo(hipX + 2, hipY - 2);
    ctx.stroke();

    // Leg IK (Hip -> Knee -> Foot Boot)
    const legIK = this.solve2BoneIK(hipX, hipY, footX, footY, 14, 14, 1);
    ctx.lineWidth = 5.0;
    ctx.strokeStyle = "#3d4642";
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(legIK.x, legIK.y);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Mountaineer Boot
    ctx.fillStyle = "#1b1f1d";
    ctx.fillRect(footX - 2, footY - 1, 8, 4);

    // Arm IK (Shoulder -> Elbow -> Hand on Steering Wheel)
    const armIK = this.solve2BoneIK(shoulderX, shoulderY, handX, handY, 12, 12, -1);
    ctx.lineWidth = 4.2;
    ctx.strokeStyle = "#c46b38";
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(armIK.x, armIK.y);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Hand grip on steering wheel
    ctx.fillStyle = "#d9cfb8";
    ctx.beginPath();
    ctx.arc(handX, handY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Steering Wheel rim
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(wheelHubX, wheelHubY, 7, 0, Math.PI * 2);
    ctx.stroke();

    // Helmet & Visor
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(driver.helmetAngle);

    // Helmet shell
    ctx.fillStyle = "#efe7d6";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 7.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Expedition orange center stripe
    ctx.fillStyle = "#d4622a";
    ctx.fillRect(-2.5, -7.8, 5, 15.6);

    // Visor with reflection
    ctx.fillStyle = "#1b1f1d";
    ctx.beginPath();
    ctx.ellipse(3, 0, 3.8, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(3, -0.6, 2.0, -0.6, 0.6);
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
    const kindSet = new Set(kinds);

    for (const p of particleSystem.pool) {
      if (!p.active || !kindSet.has(p.kind)) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  drawGrain(w, h) {
    if (!this.grainCanvas) {
      const c = document.createElement("canvas");
      c.width = 180;
      c.height = 180;
      const gctx = c.getContext("2d");
      const img = gctx.createImageData(180, 180);
      for (let i = 0; i < img.data.length; i += 4) {
        const val = Math.random() * 255;
        img.data[i] = val;
        img.data[i + 1] = val;
        img.data[i + 2] = val;
        img.data[i + 3] = 18;
      }
      gctx.putImageData(img, 0, 0);
      this.grainCanvas = c;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const pat = ctx.createPattern(this.grainCanvas, "repeat");
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawVignette(w, h) {
    const ctx = this.ctx;
    ctx.save();
    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, "rgba(27,31,29,0)");
    vig.addColorStop(1, "rgba(27,31,29,0.18)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawDebug(bodies, vehicle, camera, game) {
    const ctx = this.ctx;
    ctx.save();

    // 1. Static & Dynamic Wireframes
    ctx.strokeStyle = "rgba(212,98,42,0.85)";
    ctx.lineWidth = 1;
    for (const b of bodies) {
      const verts = b.vertices;
      if (!verts || verts.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (const v of verts) ctx.lineTo(v.x, v.y);
      ctx.closePath();
      ctx.stroke();
    }

    // 2. Chassis Velocity Vector
    ctx.strokeStyle = "#2ea3a5";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(vehicle.chassis.position.x, vehicle.chassis.position.y);
    ctx.lineTo(
      vehicle.chassis.position.x + vehicle.chassis.velocity.x * 12,
      vehicle.chassis.position.y + vehicle.chassis.velocity.y * 12
    );
    ctx.stroke();

    // 3. Center of Mass
    ctx.fillStyle = "#d4622a";
    ctx.beginPath();
    ctx.arc(vehicle.chassis.position.x, vehicle.chassis.position.y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 4. Wheel Contacts & Normals
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

    // 5. Predicted Jump Ballistic Trajectory
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

    ctx.restore();
  }

  drawMountainEchoes(echoManager, cam) {
    const ctx = this.ctx;
    for (const relic of echoManager.relics) {
      if (relic.collected) continue;
      if (Math.abs(relic.x - cam.x) > 1200) continue;

      ctx.save();
      ctx.translate(relic.x, relic.y);

      // Amber outer radial glow
      const glowR = 26 + relic.glow * 16;
      const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, glowR);
      grad.addColorStop(0, "rgba(212, 98, 42, 0.45)");
      grad.addColorStop(0.5, "rgba(212, 98, 42, 0.18)");
      grad.addColorStop(1, "rgba(239, 231, 214, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Rotating 3D crystal projection (octahedron)
      const rot = relic.rotation;
      const s = 13.0;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);

      const top = { x: 0, y: -s * 1.4 };
      const btm = { x: 0, y: s * 1.4 };
      const v0 = { x: -s * cosR, y: -s * 0.35 * sinR };
      const v1 = { x: s * sinR, y: -s * 0.35 * cosR };
      const v2 = { x: s * cosR, y: s * 0.35 * sinR };
      const v3 = { x: -s * sinR, y: s * 0.35 * cosR };

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

      // Glyphs
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
    const chassis = v.chassis;
    const pos = chassis.position;
    const vel = chassis.velocity;
    const seg = this.terrain.segmentAt(pos.x);
    const slope = this.terrain.slopeAt(pos.x);
    const mat = this.terrain.materialAt(pos.x);
    const biome = this.terrain.biomeAt(pos.x);
    const distMeters = game.maxDistance;
    const difficulty = b(distMeters / 1000, 0, 1);

    const nf = v.normalLoads?.front ?? 0;
    const nr = v.normalLoads?.rear ?? 0;
    const sf = v.wheels[1]?.slipRatio ?? 0;
    const sr = v.wheels[0]?.slipRatio ?? 0;

    const lines = [
      `DIAGNOSTICS (F3)  FPS: ${game.fps.toFixed(0)}  STEP: 8.33ms`,
      `VEHICLE: ${v.archetype.name.toUpperCase()}  BODIES: ${Matter.Composite.allBodies(game.engine.world).length}`,
      `NORMAL FORCES: F=${nf.toFixed(1)}N  R=${nr.toFixed(1)}N  F/R=${((nf/(nf+nr||1))*100).toFixed(0)}%/${((nr/(nf+nr||1))*100).toFixed(0)}%`,
      `SLIP RATIO: F=${sf.toFixed(2)}  R=${sr.toFixed(2)}  ROOF_CONTACT: ${v.roofContact}`,
      `SPEED: ${(Math.abs(v.forwardSpeed) * 7.2).toFixed(1)} km/h  VERT: ${vel.y.toFixed(1)}  RPM: ${(v.rpm * 100).toFixed(0)}%`,
      `CHASSIS ANGLE: ${(chassis.angle * 180 / Math.PI).toFixed(1)}°  ANG_VEL: ${chassis.angularVelocity.toFixed(3)}`,
      `DEATH STATE: ${(game.deathState || "NORMAL").toUpperCase()}  TIMER: ${(game.upsideDownTimer || 0).toFixed(1)}s`,
      `SUSPENSION: R=${v.wheels[0].compression.toFixed(2)} F=${v.wheels[1].compression.toFixed(2)}`,
      `TERRAIN: ${seg.name} (${seg.type})  SLOPE: ${(slope * 180 / Math.PI).toFixed(1)}°  MAT: ${mat.name}`,
      `AIRBORNE: ${v.airborne}  AIRTIME: ${(game.stunts.airtime / 1000).toFixed(2)}s  APEX_H: ${(game.stunts.launchY - game.stunts.airApexY).toFixed(0)}px`,
      `STUNT: ${game.stunts.activeStuntName || "NONE"}  CUMUL_ANG: ${(game.stunts.cumulativeAngle * 180 / Math.PI).toFixed(0)}°  FLIPS: B=${game.stunts.backflips} F=${game.stunts.frontflips}`,
      `COMBO: x${game.stunts.comboMultiplier}  SCORE: ${game.score}  ECHOES: ${game.echoManager?.collectedCount || 0}/${game.echoManager?.totalCount || 6}`,
      `SEEDS: [1]FLAT(1001) [2]STEEP(48192) [3]JUMP(77234) [4]VALLEY(33109)`,
      `TELEMETRY: Press 'T' to export JSON  SEED: ${game.seed}`,
    ];

    ctx.save();
    ctx.fillStyle = "rgba(27,31,29,0.85)";
    const panelW = 460;
    const panelH = lines.length * 16 + 18;
    ctx.fillRect(w - panelW - 16, h - panelH - 16, panelW, panelH);
    ctx.strokeStyle = "var(--hot)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w - panelW - 16, h - panelH - 16, panelW, panelH);

    ctx.font = "11px 'Courier New', monospace";
    ctx.fillStyle = "#efe7d6";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], w - panelW - 6, h - panelH + 4 + i * 16);
    }
    ctx.restore();
  }
}
