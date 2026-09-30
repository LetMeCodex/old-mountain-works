# PART 5: Renderer (R0) with Full Driver IK, Landmarks, Props & F3 Telemetry
import os

part5 = r'''
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
      this.renderer.setSize(Math.max(1, Math.floor(window.innerWidth * 0.5)), Math.max(1, Math.floor(window.innerHeight * 0.5)), false);
      this.renderer.setPixelRatio(1);

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
      this.sunLight = new THREE.DirectionalLight(0xffecd2, 1.25);
      this.sunLight.position.set(500, 1000, 800);
      this.scene.add(this.sunLight);

      this.hemiLight = new THREE.HemisphereLight(0xb4c7be, 0x48534e, 0.65);
      this.scene.add(this.hemiLight);

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
          const px = pos.getX(i);
          const ridge = Math.sin(px * 0.004) * 80 + Math.sin(px * 0.012) * 45;
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

  sync(cam, vehicle, relics, worldSim = null) {
    if (!this.enabled || !this.renderer || !this.camera) return;
    this.syncCount = (this.syncCount || 0) + 1;
    // Throttle background WebGL pass on normal frames while always rendering on first call or explicit sync
    if (worldSim && this.syncCount > 2 && (this.syncCount % 5 !== 0)) return;

    const targetX = (cam.x - 220) * 0.35;
    const targetY = (-cam.y + 560) * 0.35;
    const targetZ = 850 / Math.max(0.45, cam.zoom);

    if (Number.isFinite(cam.fov) && Math.abs(this.camera.fov - cam.fov * 0.78) > 0.05) {
      this.camera.fov = cam.fov * 0.78;
      this.camera.updateProjectionMatrix();
    }

    this.camera.position.x = targetX;
    this.camera.position.y = targetY;
    this.camera.position.z = targetZ;
    this.camera.lookAt(targetX, targetY, 0);
    this.camera.rotation.z = -(cam.totalRoll ?? cam.roll ?? 0);

    // Synchronize 3D directional sun, ambient fill & fog with Living World State
    if (worldSim?.state && this.sunLight && this.hemiLight) {
      const ws = worldSim.state;
      this.sunLight.intensity = 0.25 + ws.sun.intensity * 1.15 + ws.lighting.lightningFlash * 0.8;
      this.sunLight.position.set((ws.sun.x - 0.5) * 1800, Math.max(80, ws.sun.elevation * 1200), 800);
      this.hemiLight.intensity = 0.22 + ws.lighting.ambientIntensity * 0.52;
      if (this.scene?.fog) {
        this.scene.fog.density = 0.00025 + ws.fogDensity * 0.00055;
      }
    }

    for (const m of this.mountains) {
      m.mesh.position.x = targetX * (1 + m.def.z * 0.0003);
      m.mesh.position.y = targetY * (1 + m.def.z * 0.00022) - 60;
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
    this.renderer.setSize(Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5)), false);
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
  grainPattern = null;
  vigGrad = null;
  vigW = 0;
  vigH = 0;
  parallaxNoises = {
    31: K0(31),
    44: K0(44),
    57: K0(57),
  };

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
    const worldSim = game?.worldSim || null;

    // Sync Three.js 2.5D visual depth layer
    if (game?.threeDepth) {
      game.threeDepth.sync(camera, vehicle, game.echoManager?.relics, worldSim);
    }

    ctx.save();
    if (worldSim) {
      worldSim.drawSkyLayer(ctx, width, height, camera, biome);
    } else {
      this.drawSky(width, height, camera, biome);
    }

    ctx.save();
    ctx.translate(width / 2, height / 2);

    // Apply subtle horizon-stable camera roll & FOV-coupled spatial scale (Sections 34, 35, 49)
    const camRoll = camera.totalRoll ?? camera.roll ?? 0;
    if (Math.abs(camRoll) > 0.0005 && !x.visual.reducedMotion) {
      ctx.rotate(-camRoll);
    }
    const fovFactor = 55 / Math.max(45, camera.fov || 55);
    const effZoom = camera.zoom * (0.84 + 0.16 * fovFactor);
    ctx.scale(effZoom, effZoom);

    const shake = camera.shakeOffset;
    ctx.translate(-camera.x + shake.x, -camera.y + shake.y);

    const safeLayer = (fn) => {
      ctx.save();
      try {
        fn();
      } catch (err) {
        console.warn("[Renderer] Layer error:", err);
      } finally {
        ctx.restore();
      }
    };

    safeLayer(() => this.drawParallax(camera, width, height, time, biome, worldSim));
    if (worldSim) {
      safeLayer(() => worldSim.drawMidgroundLife(ctx, camera, this.terrain));
    }
    safeLayer(() => this.drawTerrain(camera, width, height, biome, worldSim));
    safeLayer(() => this.drawProps(propManager, camera));

    if (game?.echoManager) {
      safeLayer(() => this.drawMountainEchoes(game.echoManager, camera));
    }

    safeLayer(() => this.drawParticles(particles, ["dust", "snow", "grass", "wood"]));
    safeLayer(() => this.drawVehicle(vehicle, biome, worldSim));
    safeLayer(() => this.drawParticles(particles, ["spark", "grit", "stone"]));

    if (debug) {
      safeLayer(() => this.drawDebug(allBodies, vehicle, camera, game));
    }

    ctx.restore();

    if (worldSim) {
      worldSim.drawAtmosphericOverlay(ctx, width, height, camera, vehicle);
    }

    if ((x.visual.renderScale ?? 1) >= 0.88) {
      this.drawGrain(width, height);
    }
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

  drawParallax(cam, w, h, time, biome, worldSim = null) {
    const ctx = this.ctx;
    const amb = worldSim?.state?.lighting?.ambientIntensity ?? 1.0;
    const darken = b(1.0 - amb, 0, 0.58);
    const tintLayer = (hex) => (typeof lerpHexColor === "function" ? lerpHexColor(hex, "#141b22", darken) : hex);

    const layers = [
      { speed: 0.08, base: 240, amp: 145, freq: 0.0018, color: tintLayer(biome.far), opacity: 0.62, seed: 31 },
      { speed: 0.22, base: 165, amp: 112, freq: 0.0026, color: tintLayer(biome.mid), opacity: 0.78, seed: 44 },
      { speed: 0.42, base: 95,  amp: 78,  freq: 0.0038, color: tintLayer(biome.near), opacity: 0.92, seed: 57 },
    ];

    const spanX = w / cam.zoom;
    const left = cam.x - spanX * 0.68;
    const right = cam.x + spanX * 0.68;
    const bottomY = Math.max(cam.y + (h / cam.zoom) + 900, 12000);
    const step = 38;

    for (let li = 0; li < layers.length; li++) {
      const l = layers[li];
      const noise = this.parallaxNoises[l.seed] || K0(l.seed);
      ctx.save();
      ctx.fillStyle = l.color;
      ctx.globalAlpha = l.opacity;
      ctx.beginPath();
      ctx.moveTo(left - 20, bottomY);
      const camElevOffset = (cam.y - x.world.groundBase) * (1 - l.speed * 0.65);
      for (let px = left - 20; px <= right + 20; px += step) {
        const z = px - cam.x * (1 - l.speed);
        const ridge =
          noise(z * l.freq) * l.amp +
          noise(z * l.freq * 2.6) * (l.amp * 0.42);
        const py = x.world.groundBase + camElevOffset - l.base - ridge;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(right + 20, bottomY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawTerrain(cam, w, h, biome, worldSim = null) {
    const ctx = this.ctx;
    const terrain = this.terrain;
    const spanX = w / cam.zoom;
    const left = cam.x - spanX * 0.66;
    const right = cam.x + spanX * 0.66;

    const firstX = terrain.samples[0]?.x ?? 0;
    const step = terrain.step;
    const maxIdx = terrain.samples.length - 1;
    const startIdx = Math.max(0, Math.min(maxIdx, Math.floor((left - firstX) / step) - 2));
    const endIdx = Math.max(0, Math.min(maxIdx, Math.ceil((right - firstX) / step) + 2));

    if (startIdx >= endIdx || !terrain.samples[startIdx] || !terrain.samples[endIdx]) return;

    // 1. Terrain Bedrock Fill with Subterranean Depth Gradient & Topographic Strata
    const bottomY = Math.max(cam.y + (h / cam.zoom) + 900, 12000);
    ctx.save();
    const gradTop = cam.y - 80;
    const gradBot = cam.y + 340;
    const bedGrad = ctx.createLinearGradient(0, gradTop, 0, gradBot);
    bedGrad.addColorStop(0, biome.groundFill);
    bedGrad.addColorStop(0.45, "#151917");
    bedGrad.addColorStop(1, "#0c0f0e");
    ctx.fillStyle = bedGrad;
    ctx.beginPath();
    ctx.moveTo(terrain.samples[startIdx].x, bottomY);

    for (let i = startIdx; i <= endIdx; i++) {
      const p = terrain.samples[i];
      if (p) ctx.lineTo(p.x, p.y);
    }

    ctx.lineTo(terrain.samples[endIdx].x, bottomY);
    ctx.closePath();
    ctx.fill();

    // Subterranean Topographic Contour Lines (batched single stroke)
    ctx.strokeStyle = "rgba(239, 231, 214, 0.045)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    for (let layer = 1; layer <= 3; layer++) {
      const depthOffset = 75 + layer * 55;
      let cMoved = false;
      for (let i = startIdx; i <= endIdx; i += 6) {
        const p = terrain.samples[i];
        if (!p) continue;
        const wave = Math.sin(p.x * 0.0045 + layer * 1.7) * 16;
        const cy = p.y + depthOffset + wave;
        if (!cMoved) { ctx.moveTo(p.x, cy); cMoved = true; }
        else ctx.lineTo(p.x, cy);
      }
    }
    ctx.stroke();

    // 2. Illustrated Top Crust / Foliage Ribbon (modulated by seasonal snow cover)
    const snowCov = worldSim?.state?.memory?.snowCover ?? 0;
    ctx.lineWidth = 9.0;
    ctx.strokeStyle = snowCov > 0.35 ? "#dde5eb" : biome.groundTop;
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
    ctx.strokeStyle = snowCov > 0.25 ? "#f4f8fb" : biome.groundTopLight;
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
    if (worldSim) {
      worldSim.drawWorldEcosystem(ctx, cam, terrain, left, right, biome);
    }
    this.drawLandmarks(cam, left, right, worldSim);
  }

  drawTerrainDetails(terrain, left, right, biome) {
    const ctx = this.ctx;
    ctx.save();
    const step = 48;
    const start = Math.floor(left / step) * step;
    const end = Math.ceil(right / step) * step;

    ctx.strokeStyle = biome.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let q = start; q <= end; q += step) {
      const mat = terrain.materialAt(q);
      if (mat.name === "grass") {
        const y = terrain.heightAt(q);
        ctx.moveTo(q, y - 2);
        ctx.lineTo(q + 3, y - 8);
        ctx.moveTo(q + 4, y - 2);
        ctx.lineTo(q + 8, y - 9);
      }
    }
    ctx.stroke();

    ctx.fillStyle = "#1b1f1d";
    ctx.beginPath();
    for (let q = start; q <= end; q += step) {
      const mat = terrain.materialAt(q);
      if (mat.name === "rock" || mat.name === "gravel" || mat.name === "wet_rock") {
        const y = terrain.heightAt(q);
        ctx.moveTo(q + 4, y - 2);
        ctx.arc(q + 2, y - 2, 2.2, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    // Mud & Wet-Rock slick sheen + steep cliff strata hashes for terrain readability
    ctx.strokeStyle = "rgba(215, 195, 165, 0.36)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let q = start; q <= end; q += step) {
      const mat = terrain.materialAt(q);
      const sl = Math.abs(terrain.slopeAt(q));
      const y = terrain.heightAt(q);
      if (mat.name === "mud" || mat.name === "wet_rock" || mat.name === "ice") {
        ctx.moveTo(q - 8, y + 3);
        ctx.lineTo(q + 10, y + 3);
      }
      if (sl > 0.46) {
        ctx.moveTo(q, y + 6);
        ctx.lineTo(q - 6, y + 22);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  drawLandmarks(cam, left, right, worldSim = null) {
    const ctx = this.ctx;
    const ws = worldSim?.state;
    const windX = ws ? ws.windVector.x : 4;
    const isNight = ws ? ws.sun.elevation < 0.16 : false;
    const snowCov = ws?.memory?.snowCover ?? 0;

    for (const bItem of BIOMES) {
      const lm = bItem.landmark;
      if (!lm || lm.x < left - 80 || lm.x > right + 80) continue;
      const ly = this.terrain.heightAt(lm.x);

      ctx.save();
      ctx.translate(lm.x, ly);

      if (lm.type === "shelter") {
        // Base Camp Outpost Cabin - Elevated to scenic background ridge off the road
        ctx.save();
        ctx.translate(0, -95);
        ctx.scale(0.68, 0.68);
        ctx.globalAlpha = 0.72;

        // Timber foundation stilts on the background cliff
        ctx.strokeStyle = "#5a4d41";
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(-24, 0); ctx.lineTo(-24, 95);
        ctx.moveTo(0, 0); ctx.lineTo(0, 95);
        ctx.moveTo(24, 0); ctx.lineTo(24, 95);
        ctx.moveTo(-24, 45); ctx.lineTo(24, 75);
        ctx.moveTo(24, 45); ctx.lineTo(-24, 75);
        ctx.stroke();

        // Cabin body
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 2.4;
        ctx.fillStyle = "#d9cfb8";
        ctx.fillRect(-32, -34, 64, 34);
        ctx.strokeRect(-32, -34, 64, 34);

        // Window with warm lantern light (brighter halo at night/dusk)
        if (isNight) {
          const glow = ctx.createRadialGradient(-10, -18, 2, -10, -18, 28);
          glow.addColorStop(0, "rgba(255, 215, 110, 0.65)");
          glow.addColorStop(1, "rgba(255, 215, 110, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(-10, -18, 28, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = isNight ? "#ffe484" : "#efd07b";
        ctx.fillRect(-16, -24, 12, 12);
        ctx.strokeRect(-16, -24, 12, 12);
        ctx.beginPath();
        ctx.moveTo(-10, -24); ctx.lineTo(-10, -12);
        ctx.moveTo(-16, -18); ctx.lineTo(-4, -18);
        ctx.stroke();

        // Door
        ctx.fillStyle = "#8a533c";
        ctx.fillRect(8, -26, 14, 26);
        ctx.strokeRect(8, -26, 14, 26);

        // Gable roof
        ctx.fillStyle = "#733f2b";
        ctx.beginPath();
        ctx.moveTo(-38, -34);
        ctx.lineTo(0, -56);
        ctx.lineTo(38, -34);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (snowCov > 0.15) {
          ctx.strokeStyle = `rgba(245, 250, 255, ${Math.min(0.95, snowCov)})`;
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(-36, -35);
          ctx.lineTo(0, -56);
          ctx.lineTo(36, -35);
          ctx.stroke();
          ctx.strokeStyle = "#1b1f1d";
          ctx.lineWidth = 2.4;
        }

        // Radio mast & wind-reactive windsock
        ctx.beginPath();
        ctx.moveTo(22, -56);
        ctx.lineTo(22, -92);
        ctx.moveTo(16, -76);
        ctx.lineTo(28, -76);
        ctx.stroke();

        const sockLen = b(8 + Math.abs(windX) * 0.9, 8, 22) * (windX >= 0 ? 1 : -1);
        const sockFlutter = Math.sin(Date.now() * 0.012) * 2.5;
        ctx.fillStyle = "#d4622a";
        ctx.beginPath();
        ctx.moveTo(22, -90);
        ctx.lineTo(22 + sockLen, -88 + sockFlutter);
        ctx.lineTo(22 + sockLen, -84 + sockFlutter);
        ctx.lineTo(22, -85);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#d4622a";
        ctx.beginPath();
        ctx.arc(22, -92, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else if (lm.type === "cairn") {
        // High Crag Cairn & Wind-Reactive Prayer Flag String
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
        const tNow = Date.now() * 0.01;
        for (let f = 0; f < flags.length; f++) {
          const flutter = Math.sin(tNow + f * 1.3) * (1.5 + Math.abs(windX) * 0.25);
          const stretch = b(windX * 0.4, -5, 8);
          ctx.fillStyle = flags[f];
          ctx.beginPath();
          ctx.moveTo(-18 + f * 9, -50 + f * 3);
          ctx.lineTo(-11 + f * 9 + stretch, -44 + f * 3 + flutter);
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
      const bBody = item.bodies[0];
      if (!bBody) continue;

      ctx.save();
      ctx.translate(bBody.position.x, bBody.position.y);
      ctx.rotate(bBody.angle);

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

    // Render physical rigid-body fracture debris planks
    if (propManager.debrisList && propManager.debrisList.length > 0) {
      for (const dItem of propManager.debrisList) {
        const bBody = dItem.body;
        if (!bBody) continue;
        ctx.save();
        ctx.globalAlpha = Math.min(1, dItem.life / 1.2);
        ctx.translate(bBody.position.x, bBody.position.y);
        ctx.rotate(bBody.angle);
        ctx.fillStyle = dItem.color || "#bca383";
        ctx.strokeStyle = "#1b1f1d";
        ctx.lineWidth = 1.4;
        ctx.fillRect(-dItem.w / 2, -dItem.h / 2, dItem.w, dItem.h);
        ctx.strokeRect(-dItem.w / 2, -dItem.h / 2, dItem.w, dItem.h);
        ctx.restore();
      }
    }
  }

  drawVehicle(vehicle, biome, worldSim = null) {
    const ctx = this.ctx;
    const chassis = vehicle.chassis;
    const vCfg = vehicle.archetype;
    const ws = worldSim?.state;

    // 0. Dynamic Sun-Angle Ground Shadow on Terrain Surface
    if (this.terrain) {
      const groundY = this.terrain.heightAt(chassis.position.x);
      const heightAbove = Math.max(0, groundY - chassis.position.y);
      if (heightAbove < 280) {
        const shadowDirX = ws?.sun?.shadowDirX ?? 0.35;
        const shadowAlpha = (ws?.lighting?.shadowAlpha ?? 0.22) * b(1 - heightAbove / 280, 0.15, 1);
        const shadowSpread = 1 + heightAbove * 0.004;
        const gSlope = this.terrain.slopeAt(chassis.position.x);
        ctx.save();
        ctx.translate(chassis.position.x + shadowDirX * (12 + heightAbove * 0.35), groundY + 1.5);
        ctx.rotate(Math.atan(gSlope));
        ctx.fillStyle = `rgba(12, 16, 15, ${shadowAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, (vCfg.chassisWidth * 0.58 + Math.abs(shadowDirX) * 18) * shadowSpread, 5.5 * shadowSpread, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

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

    // Windscreen / Aero deflector
    ctx.save();
    ctx.fillStyle = "rgba(180, 225, 235, 0.45)";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 42, -h / 2 - 28);
    ctx.lineTo(-w / 2 + 58, -h / 2 - 10);
    ctx.lineTo(-w / 2 + 50, -h / 2 - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Windscreen specular flash
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 44, -h / 2 - 25);
    ctx.lineTo(-w / 2 + 54, -h / 2 - 12);
    ctx.stroke();
    ctx.restore();

    // Articulated Driver
    this.drawArticulatedDriver(vehicle.driver, vehicle, worldSim);

    // Roll cage bar
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 18, -h / 2 - 8);
    ctx.lineTo(-w / 2 + 16, -h / 2 - 28);
    ctx.lineTo(-w / 2 + 42, -h / 2 - 28);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Whip Antenna & Expedition Pennant Flag (coupled to global WindSystem + vehicle velocity)
    const antX = -w / 2 + 16;
    const antBaseY = -h / 2 - 28;
    const antTopY = antBaseY - 24;
    const windPush = (ws?.windVector?.x ?? 0) * 0.55;
    const antBend = Math.sin(Date.now() * 0.006) * 3 + windPush - (vehicle.forwardSpeed || 0) * 0.6;
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(antX, antBaseY);
    ctx.quadraticCurveTo(antX + antBend * 0.5, antBaseY - 12, antX + antBend, antTopY);
    ctx.stroke();
    // Triangular pennant flag
    const flagDir = antBend > 1.5 ? 1 : -1;
    ctx.fillStyle = vCfg.accentColor;
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(antX + antBend, antTopY);
    ctx.lineTo(antX + antBend + flagDir * 14, antTopY + 4 + Math.sin(Date.now() * 0.012) * 1.6);
    ctx.lineTo(antX + antBend, antTopY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Front Rally Auxiliary Spot Lamps (with volumetric long-beam cone at dusk/night/fog/storm)
    const lampX = w / 2 - 8;
    const lampY = -h / 2 + 2;
    const lowLight = ws ? (ws.sun.elevation < 0.22 || ws.fogDensity > 0.35 || ws.precipitation > 0.35) : false;
    ctx.save();
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(lampX - 4, lampY + 2);
    ctx.lineTo(lampX + 3, lampY);
    ctx.stroke();
    ctx.fillStyle = "#2a302e";
    ctx.beginPath();
    ctx.arc(lampX + 5, lampY - 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = lowLight ? "#fff29c" : "#fadb6a";
    ctx.beginPath();
    ctx.ellipse(lampX + 6.5, lampY - 2, 2.2, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Warm halogen beam forward
    const beamLen = lowLight ? 185 : 52;
    const beamSpread = lowLight ? 38 : 12;
    const beamGrad = ctx.createLinearGradient(lampX + 7, lampY - 2, lampX + beamLen, lampY - 2);
    beamGrad.addColorStop(0, lowLight ? "rgba(255, 240, 165, 0.42)" : "rgba(255, 235, 150, 0.16)");
    beamGrad.addColorStop(1, "rgba(255, 235, 150, 0)");
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(lampX + 7, lampY - 4);
    ctx.lineTo(lampX + beamLen, lampY - beamSpread);
    ctx.lineTo(lampX + beamLen, lampY + beamSpread * 0.75);
    ctx.lineTo(lampX + 7, lampY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Rear Dual Exhaust Pipe
    ctx.save();
    ctx.fillStyle = "#8a9692";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.6;
    ctx.fillRect(-w / 2 - 4, h / 2 - 5, 6, 4);
    ctx.strokeRect(-w / 2 - 4, h / 2 - 5, 6, 4);
    ctx.fillStyle = "#1b1f1d";
    ctx.beginPath();
    ctx.ellipse(-w / 2 - 4, h / 2 - 3, 1.2, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Analog Dashboard Gauge Dial in front of steering wheel
    ctx.save();
    const gaugeX = -w / 2 + 50;
    const gaugeY = -h / 2 - 12;
    ctx.fillStyle = "#efe7d6";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const needleAngle = -Math.PI * 0.75 + (vehicle.rpm || 0.3) * Math.PI * 1.5;
    ctx.strokeStyle = "#d4622a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(gaugeX, gaugeY);
    ctx.lineTo(gaugeX + Math.cos(needleAngle) * 3.2, gaugeY + Math.sin(needleAngle) * 3.2);
    ctx.stroke();
    ctx.restore();

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

  drawArticulatedDriver(driver, vehicle, worldSim = null) {
    const ctx = this.ctx;
    // Driver seated naturally inside the cockpit (or driven by physical Matter.js crash ragdoll)
    let hipX = -26;
    let hipY = -12 + (driver.jolt || 0);

    const spineAngle = (driver.lean || 0) * 0.72;
    const torsoLen = 17;
    let shoulderX = hipX + Math.sin(spineAngle) * torsoLen;
    let shoulderY = hipY - Math.cos(spineAngle) * torsoLen;

    let headX = shoulderX + Math.sin(spineAngle + (driver.neckAngle || 0) * 0.35) * 9;
    let headY = shoulderY - Math.cos(spineAngle + (driver.neckAngle || 0) * 0.35) * 9;

    const wheelHubX = -9;
    const wheelHubY = -23;

    let handX = wheelHubX;
    let handY = (driver.victory || 0) > 0.1 ? wheelHubY - 18 : wheelHubY - 2;

    if (driver.ragdollActive && driver.ragdollBodies?.length >= 2 && vehicle?.chassis) {
      const cPos = vehicle.chassis.position;
      const cAng = vehicle.chassis.angle;
      const cos = Math.cos(-cAng);
      const sin = Math.sin(-cAng);
      const toLocal = (wPt) => {
        const dx = wPt.x - cPos.x;
        const dy = wPt.y - cPos.y;
        return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
      };
      const tLoc = toLocal(driver.ragdollBodies[0].position);
      const hLoc = toLocal(driver.ragdollBodies[1].position);
      shoulderX = tLoc.x;
      shoulderY = tLoc.y - 6;
      hipX = tLoc.x - 3;
      hipY = tLoc.y + 8;
      headX = hLoc.x;
      headY = hLoc.y;
      if (driver.ragdollBodies[2]) {
        const aLoc = toLocal(driver.ragdollBodies[2].position);
        handX = aLoc.x;
        handY = aLoc.y;
      }
    }

    const footX = -3;
    const footY = -6;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 1. Dynamic Wind-Blown Expedition Scarf (Trailing silk ribbon coupled to global wind + vehicle speed)
    const windRel = (worldSim?.state?.windVector?.x ?? 0) * 0.35;
    const spd = (vehicle ? Math.abs(vehicle.forwardSpeed || 0) : 0) + Math.abs(windRel);
    const time = Date.now() * 0.008;
    const scarfDir = (vehicle && vehicle.forwardSpeed < -0.5) ? 1 : -1;
    const scarfWave1 = Math.sin(time * 3.5) * (3 + spd * 0.4);
    const scarfWave2 = Math.cos(time * 4.2 + 1.2) * (4 + spd * 0.5);
    const scarfLen = 18 + Math.min(spd * 2.2, 22);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(shoulderX - 3, shoulderY + 2);
    ctx.quadraticCurveTo(
      shoulderX + scarfDir * (scarfLen * 0.5), shoulderY + 1 + scarfWave1,
      shoulderX + scarfDir * scarfLen, shoulderY + 3 + scarfWave2
    );
    ctx.lineWidth = 4.4;
    ctx.strokeStyle = "#efd07b"; // Silk mustard gold
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(shoulderX - 3, shoulderY + 2);
    ctx.quadraticCurveTo(
      shoulderX + scarfDir * (scarfLen * 0.5), shoulderY + 1 + scarfWave1,
      shoulderX + scarfDir * scarfLen, shoulderY + 3 + scarfWave2
    );
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Fringe tassel at scarf tip
    ctx.fillStyle = "#d4622a";
    ctx.beginPath();
    ctx.arc(shoulderX + scarfDir * scarfLen, shoulderY + 3 + scarfWave2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Accelerator / Brake Pedal Bracket under boot
    ctx.strokeStyle = "#24282a";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(footX + 4, footY + 4);
    ctx.lineTo(footX - 3, footY + 2);
    ctx.stroke();
    ctx.fillStyle = "#8a9692";
    ctx.fillRect(footX - 1, footY - 1, 6, 3);
    ctx.strokeRect(footX - 1, footY - 1, 6, 3);

    // 3. Leg IK (Hip -> Knee -> Foot Boot)
    const legIK = this.solve2BoneIK(hipX, hipY, footX, footY, 14, 14, 1);
    ctx.lineWidth = 6.4;
    ctx.strokeStyle = "#38423e"; // Rugged mountain slate trousers
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(legIK.x, legIK.y);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    ctx.lineWidth = 2.0;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Reinforced Knee Patch
    ctx.fillStyle = "#262e2b";
    ctx.beginPath();
    ctx.ellipse(legIK.x, legIK.y, 4, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Heavy Mountaineer Lug Boot
    ctx.fillStyle = "#1b1f1d";
    ctx.fillRect(footX - 3, footY - 2, 9, 6);
    ctx.strokeRect(footX - 3, footY - 2, 9, 6);
    // Lug sole
    ctx.fillStyle = "#8a533c";
    ctx.fillRect(footX - 3, footY + 3, 9, 2);
    // Boot lace accents
    ctx.strokeStyle = "#efe7d6";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(footX - 1, footY); ctx.lineTo(footX + 2, footY);
    ctx.moveTo(footX, footY + 2); ctx.lineTo(footX + 3, footY + 2);
    ctx.stroke();

    // 4. Torso (Expedition Flight/Bomber Jacket)
    ctx.lineWidth = 8.6;
    ctx.strokeStyle = "#b55a28"; // Heavy rust leather
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    ctx.lineWidth = 2.0;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Jacket Zipper Line
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#efe7d6";
    ctx.beginPath();
    ctx.moveTo(hipX + 1, hipY);
    ctx.lineTo(shoulderX + 1, shoulderY);
    ctx.stroke();

    // 4-Point Racing Harness
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = "#1b1f1d";
    ctx.beginPath();
    ctx.moveTo(shoulderX - 2, shoulderY + 3);
    ctx.lineTo(hipX + 2, hipY - 2);
    ctx.stroke();
    // Harness Center Latch Buckle
    ctx.fillStyle = "#d9cfb8";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(hipX * 0.5 + shoulderX * 0.5, hipY * 0.5 + shoulderY * 0.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shearling / Fleece Jacket Collar
    ctx.fillStyle = "#f4eedb";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(shoulderX - 1, shoulderY + 2, 4.5, 2.8, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 5. Arm IK (Shoulder -> Elbow -> Leather Driving Glove)
    const armIK = this.solve2BoneIK(shoulderX, shoulderY, handX, handY, 12, 12, -1);
    ctx.lineWidth = 5.2;
    ctx.strokeStyle = "#b55a28";
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(armIK.x, armIK.y);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#1b1f1d";
    ctx.stroke();

    // Wrist cuff
    ctx.strokeStyle = "#f4eedb";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(handX - 2, handY - 1);
    ctx.lineTo(handX - 1, handY + 2);
    ctx.stroke();

    // Leather Driving Glove
    ctx.fillStyle = "#3a2a20";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(handX, handY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 6. Steering Column & Wheel Rim
    ctx.save();
    ctx.strokeStyle = "#3d4642";
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(wheelHubX + 6, wheelHubY + 12);
    ctx.lineTo(wheelHubX, wheelHubY);
    ctx.stroke();

    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(wheelHubX, wheelHubY, 7.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#c46b38";
    ctx.beginPath();
    ctx.arc(wheelHubX, wheelHubY, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(wheelHubX, wheelHubY); ctx.lineTo(wheelHubX - 6, wheelHubY);
    ctx.moveTo(wheelHubX, wheelHubY); ctx.lineTo(wheelHubX + 4, wheelHubY - 5);
    ctx.moveTo(wheelHubX, wheelHubY); ctx.lineTo(wheelHubX + 4, wheelHubY + 5);
    ctx.stroke();
    ctx.restore();

    // 7. Aviator Helmet & Brass Goggles
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(driver.helmetAngle);

    // Visible Face / Chin under helmet
    ctx.fillStyle = "#e0ad84";
    ctx.beginPath();
    ctx.arc(2, 2.5, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Helmet dome shell
    ctx.fillStyle = "#efe7d6";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, -0.5, 8.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Contrast Racing Center Stripe
    ctx.fillStyle = "#d4622a";
    ctx.fillRect(-2.5, -8.6, 5, 16.5);
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-2.5, -8.6, 5, 16.5);

    // Helmet Ear Cushion flap
    ctx.fillStyle = "#5a4232";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.4;
    ctx.fillRect(-5.5, 1, 4.5, 6.5);
    ctx.strokeRect(-5.5, 1, 4.5, 6.5);
    ctx.fillStyle = "#d9b35b";
    ctx.beginPath();
    ctx.arc(-3.2, 4.2, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Chin strap
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-3, 6);
    ctx.lineTo(1, 6.8);
    ctx.stroke();

    // Goggles Leather Strap wrapping around helmet
    ctx.strokeStyle = "#2b221a";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -0.5, 8.4, Math.PI * 0.75, Math.PI * 1.4);
    ctx.stroke();

    // Brass Aviator Goggles Rim
    ctx.fillStyle = "#b88628";
    ctx.strokeStyle = "#1b1f1d";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(3.8, -0.5, 4.6, 3.4, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dark tinted lens glass
    ctx.fillStyle = "#1e272b";
    ctx.beginPath();
    ctx.ellipse(4.0, -0.5, 3.4, 2.3, 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Specular Reflection Flash
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(3.2, -2.0);
    ctx.lineTo(5.2, -0.5);
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
    ctx.save();
    for (let i = 0; i < particleSystem.pool.length; i++) {
      const p = particleSystem.pool[i];
      if (!p.active || !kinds.includes(p.kind)) continue;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      const half = p.size * 0.5;
      ctx.fillRect(p.x - half, p.y - half, p.size, p.size);
    }
    ctx.restore();
  }

  drawGrain(w, h) {
    const ctx = this.ctx;
    if (!this.grainCanvas) {
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 160;
      const gctx = c.getContext("2d");
      const img = gctx.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const val = Math.random() > 0.5 ? 24 : 225;
        img.data[i] = val;
        img.data[i + 1] = val;
        img.data[i + 2] = val;
        img.data[i + 3] = 6;
      }
      gctx.putImageData(img, 0, 0);
      this.grainCanvas = c;
      this.grainPattern = ctx.createPattern(c, "repeat");
    }

    if (!this.grainPattern) return;
    ctx.save();
    ctx.fillStyle = this.grainPattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawVignette(w, h) {
    const ctx = this.ctx;
    if (!this.vigGrad || this.vigW !== w || this.vigH !== h) {
      this.vigW = w;
      this.vigH = h;
      const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
      vig.addColorStop(0, "rgba(27,31,29,0)");
      vig.addColorStop(1, "rgba(27,31,29,0.18)");
      this.vigGrad = vig;
    }
    ctx.save();
    ctx.fillStyle = this.vigGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawDebug(bodies, vehicle, camera, game) {
    const ctx = this.ctx;
    ctx.save();

    // 1. Slope & Difficulty Heatmap Ribbon along visible terrain (Section 53)
    const terrain = this.terrain;
    if (terrain?.samples?.length > 1) {
      const firstX = terrain.samples[0].x;
      const step = terrain.step;
      const startIdx = Math.max(0, Math.floor((camera.x - 1100 - firstX) / step));
      const endIdx = Math.min(terrain.samples.length - 2, Math.ceil((camera.x + 1100 - firstX) / step));

      ctx.lineWidth = 5.0;
      for (let i = startIdx; i <= endIdx; i += 2) {
        const p1 = terrain.samples[i];
        const p2 = terrain.samples[Math.min(terrain.samples.length - 1, i + 2)];
        if (!p1 || !p2) continue;
        const sDeg = Math.abs((Math.atan(p1.slope) * 180) / Math.PI);
        if (sDeg < 12) ctx.strokeStyle = "rgba(78, 154, 104, 0.85)"; // EASY
        else if (sDeg < 22) ctx.strokeStyle = "rgba(216, 155, 60, 0.85)"; // MODERATE
        else if (sDeg < 32) ctx.strokeStyle = "rgba(212, 98, 42, 0.90)"; // HARD
        else ctx.strokeStyle = "rgba(194, 50, 40, 0.95)"; // EXTREME

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y - 10);
        ctx.lineTo(p2.x, p2.y - 10);
        ctx.stroke();
      }
    }

    // 2. Static & Dynamic Wireframes
    ctx.strokeStyle = "rgba(212,98,42,0.85)";
    ctx.lineWidth = 1;
    for (const bBody of bodies) {
      const verts = bBody.vertices;
      if (!verts || verts.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (const v of verts) ctx.lineTo(v.x, v.y);
      ctx.closePath();
      ctx.stroke();
    }

    // 3. Chassis Velocity Vector
    ctx.strokeStyle = "#2ea3a5";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(vehicle.chassis.position.x, vehicle.chassis.position.y);
    ctx.lineTo(
      vehicle.chassis.position.x + vehicle.chassis.velocity.x * 12,
      vehicle.chassis.position.y + vehicle.chassis.velocity.y * 12
    );
    ctx.stroke();

    // 4. Center of Mass
    ctx.fillStyle = "#d4622a";
    ctx.beginPath();
    ctx.arc(vehicle.chassis.position.x, vehicle.chassis.position.y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Wheel Contacts & Normals
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

    // 6. Predicted Jump Ballistic Trajectory
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

    // 7. Cinematic Camera Director 2.0 Visual Reticles (Section 49)
    if (camera) {
      // 7a. Look-ahead velocity prediction point (Gold diamond + dashed vector)
      if (camera.predictedPos) {
        ctx.save();
        ctx.strokeStyle = "rgba(216, 155, 60, 0.78)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(vehicle.chassis.position.x, vehicle.chassis.position.y);
        ctx.lineTo(camera.predictedPos.x, camera.predictedPos.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#d89b3c";
        ctx.beginPath();
        ctx.moveTo(camera.predictedPos.x, camera.predictedPos.y - 7);
        ctx.lineTo(camera.predictedPos.x + 7, camera.predictedPos.y);
        ctx.lineTo(camera.predictedPos.x, camera.predictedPos.y + 7);
        ctx.lineTo(camera.predictedPos.x - 7, camera.predictedPos.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 7b. Terrain Focus Point ahead (Teal crosshair)
      if (camera.terrainFocusPoint) {
        const tf = camera.terrainFocusPoint;
        ctx.save();
        ctx.strokeStyle = "#2ea3a5";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(tf.x, tf.y, 9, 0, Math.PI * 2);
        ctx.moveTo(tf.x - 14, tf.y);
        ctx.lineTo(tf.x + 14, tf.y);
        ctx.moveTo(tf.x, tf.y - 14);
        ctx.lineTo(tf.x, tf.y + 14);
        ctx.stroke();
        ctx.restore();
      }

      // 7c. Ballistic Landing Zone marker when airborne
      if (camera.landingZone && camera.landingZone.active) {
        const lz = camera.landingZone;
        ctx.save();
        ctx.strokeStyle = "#e05a47";
        ctx.fillStyle = "rgba(224, 90, 71, 0.22)";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(lz.x, lz.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 7d. Authoritative Camera Target Point (Burnt-orange target reticle)
      if (camera.targetPoint) {
        const tp = camera.targetPoint;
        ctx.save();
        ctx.strokeStyle = "#d4622a";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#d4622a";
        ctx.fill();
        ctx.restore();
      }
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

      const glowR = 26 + relic.glow * 16;
      const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, glowR);
      grad.addColorStop(0, "rgba(212, 98, 42, 0.45)");
      grad.addColorStop(0.5, "rgba(212, 98, 42, 0.18)");
      grad.addColorStop(1, "rgba(239, 231, 214, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();

      const rot = relic.rotation;
      const s = 13.0;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);

      const top = { x: 0, y: -s * 1.4 };
      const btm = { x: 0, y: s * 1.4 };
      const v0 = { x: -s * cosR, y: -s * 0.35 * sinR };
      const v1 = { x: s * sinR, y: -s * 0.35 * cosR };
      const v2 = { x: s * cosR, y: s * 0.35 * sinR };

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
    const cam = game.camera;
    const chassis = v.chassis;
    const pos = chassis.position;
    const vel = chassis.velocity;
    const seg = this.terrain.segmentAt(pos.x);
    const nextSeg = this.terrain.segmentAt(pos.x + 600);
    const slope = this.terrain.slopeAt(pos.x);
    const curv = this.terrain.curvatureAt ? this.terrain.curvatureAt(pos.x) : 0;
    const mat = this.terrain.materialAt(pos.x);
    const biome = this.terrain.biomeAt(pos.x);
    const chunkId = this.terrain.chunkAt ? this.terrain.chunkAt(pos.x) : 0;
    const tStats = this.terrain.stats || {};

    const nf = v.normalLoads?.front ?? 0;
    const nr = v.normalLoads?.rear ?? 0;
    const sf = v.wheels[1]?.slipRatio ?? 0;
    const sr = v.wheels[0]?.slipRatio ?? 0;

    const camState = cam?.state || "FOLLOW";
    const camShot = cam?.shotType || "SHOT_FOLLOW";
    const camZoom = (cam?.zoom ?? 0.78).toFixed(3);
    const camFov = (cam?.fov ?? 55).toFixed(1);
    const camRollDeg = (((cam?.totalRoll ?? 0) * 180) / Math.PI).toFixed(2);
    const camLook = Math.round(cam?.lookAheadDistance ?? 0);
    const spVelX = (cam?.springVelocity?.x ?? 0).toFixed(1);
    const spVelY = (cam?.springVelocity?.y ?? 0).toFixed(1);
    const spErrX = (cam?.springError?.x ?? 0).toFixed(1);
    const spErrY = (cam?.springError?.y ?? 0).toFixed(1);
    const impInt = (cam?.impact?.intensity ?? 0).toFixed(2);
    const cineRatio = (((cam?.shotDirector?.getCinematicRatio?.() ?? 0) * 100)).toFixed(0);

    const ws = game.worldSim?.state;
    const wHours = ws ? Math.floor(ws.timeMinutes / 60) : 9;
    const wMins = ws ? Math.floor(ws.timeMinutes % 60) : 30;
    const wTimeStr = `${String(wHours).padStart(2, "0")}:${String(wMins).padStart(2, "0")} (${ws?.phaseName || "MORNING"})`;
    const wSeason = ws ? `${ws.season}${ws.seasonTransition > 0.05 ? `->${ws.targetSeason}` : ""}` : "AUTUMN";
    const wWeather = ws ? `${ws.weather} (${Math.round((ws.precipitation || 0) * 100)}% PRECIP)` : (biome.weather || "CLEAR");
    const wTemp = ws ? `${ws.temperature.toFixed(1)}°C` : "8.0°C";
    const wHum = ws ? `${Math.round(ws.humidity * 100)}%` : "45%";
    const wWind = ws ? `${ws.windVector.x.toFixed(1)} m/s (GUST ${ws.windGust.toFixed(1)})` : "2.5 m/s";
    const wEnt = ws?.entityCounts || {};
    const wLod = ws?.lodCounts || { near: 0, mid: 0, far: 0 };
    const wEvents = ws?.activeEvents?.length ? ws.activeEvents.join(", ") : "IDLE_ECOSYSTEM";
    const wSimMs = (ws?.simStepMs ?? 0.2).toFixed(2);

    const pitchDeg = ((chassis.angle * 180) / Math.PI).toFixed(1);
    const angVel = (chassis.angularVelocity || 0).toFixed(3);
    const comX = v.centerOfMassOffset?.x ?? 0;
    const comY = v.centerOfMassOffset?.y ?? -3.5;
    const engForce = (v.lastEngineForce || 0).toFixed(2);
    const brkForce = (v.lastBrakeForce || 0).toFixed(2);
    const wheelContacts = `R:${v.wheels[0]?.contact ? 1 : 0} F:${v.wheels[1]?.contact ? 1 : 0}`;
    const tractionCoeff = (mat.friction ?? 0.9).toFixed(2);
    const landingState = v.lastLandingQuality || "GROUND";
    const landingPred = v.landingPrediction || "GROUNDED";
    const wheelRpmVal = v.wheelRpm ?? 0;
    const rotDeg = Math.round(((game.stunts.cumulativeAngle || 0) * 180) / Math.PI);
    const flipProgPct = Math.round((game.stunts.flipProgress ?? 0) * 100);

    const lines = [
      `DIAGNOSTICS (F3)  FPS: ${game.fps.toFixed(0)}  STEP: 8.33ms  WORLD_SIM: ${wSimMs}ms  SEED: ${game.seed}`,
      `WORLD STATE: TIME=${wTimeStr}  SEASON=${wSeason}  TEMP=${wTemp}  HUM=${wHum}`,
      `WORLD ATMO: WEATHER=[${wWeather}]  WIND=${wWind}  MOON=${ws?.moon?.phaseName || "CRESCENT"}`,
      `WORLD ENTITIES: BIRDS=${wEnt.birds || 0} ANIM=${wEnt.animals || 0} INS=${wEnt.insects || 0} NPC=${wEnt.npcs || 0} VEH=${wEnt.traffic || 0} CLD=${wEnt.clouds || 0}`,
      `WORLD LOD & EVENTS: NEAR=${wLod.near} MID=${wLod.mid} FAR=${wLod.far}  EVENTS=[${wEvents}]`,
      `CAMERA DIRECTOR: STATE=[${camState}]  SHOT=[${camShot}]  CINE_BUDGET: ${cineRatio}%`,
      `CAM OPTICS: ZOOM=${camZoom}x  FOV=${camFov}°  ROLL=${camRollDeg}°  LOOKAHEAD=${camLook}px`,
      `CAM SPRING: VEL=(${spVelX}, ${spVelY})  ERR=(${spErrX}, ${spErrY})  IMPACT=${impInt}`,
      `CAM FOCUS: TARGET=(${Math.round(cam?.targetPoint?.x || 0)}, ${Math.round(cam?.targetPoint?.y || 0)})  TERRAIN=(${Math.round(cam?.terrainFocusPoint?.x || 0)}, ${Math.round(cam?.terrainFocusPoint?.y || 0)})`,
      `VEHICLE: ${v.archetype.name.toUpperCase()}  CoM=(${comX},${comY}px)  BODIES: ${Matter.Composite.allBodies(game.engine.world).length}`,
      `STREAMING: CHUNK #${chunkId}/${this.terrain.chunks?.length || 0} (ACTIVE CHUNKS: ${this.terrain.activeChunkCount || 0}, BODIES: ${this.terrain.bodies?.length || 0})`,
      `BIOME: ${biome.act || "ACT I"} // ${biome.name.toUpperCase()}  SEG: ${seg.name} [${seg.type}]`,
      `SLOPE: ${(slope * 180 / Math.PI).toFixed(1)}° (MAX ${seg.maxSlope ?? 20}°)  CURV: ${curv.toFixed(4)}  MAT: ${mat.name.toUpperCase()} (TRACTION:${tractionCoeff})`,
      `UPCOMING (+15m): ${nextSeg.name} [${nextSeg.type}]  JUMP_POT: ${nextSeg.jumpPotential || "Low"}`,
      `WORLD STATS: ${tStats.totalDistanceKm || 8.2}km | GAIN:+${tStats.totalElevationGain || 0}m | DROP:-${tStats.maxDescentMeters || 0}m | VAR:${tStats.diversityPercent || 94}%`,
      `NORMAL FORCES: F=${nf.toFixed(1)}N  R=${nr.toFixed(1)}N  SLIP: F=${sf.toFixed(2)} R=${sr.toFixed(2)}  CONTACTS:[${wheelContacts}]`,
      `SPEED: ${(v.speed * 7.2).toFixed(1)} km/h  FWD:${v.forwardSpeed.toFixed(1)}  VERT:${vel.y.toFixed(1)}  PITCH:${pitchDeg}°  ANG_VEL:${angVel}`,
      `FORCES: ENGINE=${engForce}N  BRAKE=${brkForce}N  WHEEL_RPM=${wheelRpmVal} (${(v.rpm * 100).toFixed(0)}%)  STALL=${Boolean(v.climbingStalled)}`,
      `SUSPENSION: REAR=${v.wheels[0].compression.toFixed(2)}  FRONT=${v.wheels[1].compression.toFixed(2)}  ROOF:${v.roofContact}  LANDING:[${landingState}]`,
      `AIRBORNE: ${v.airborne}  AIRTIME:${(game.stunts.airtime / 1000).toFixed(2)}s  ROT:${rotDeg}° (FLIP:${flipProgPct}%)  PRED:[${landingPred}]  STUNT:${game.stunts.activeStuntName || "NONE"}`,
      `HOTKEYS: [1-4]SEEDS [5]+3H_TIME [6]WEATHER [7]SEASON [8]WORLD_EVENT [T]EXPORT`,
    ];

    ctx.save();
    ctx.fillStyle = "rgba(18, 22, 20, 0.88)";
    const panelW = 615;
    const panelH = lines.length * 14.0 + 18;
    ctx.fillRect(w - panelW - 16, h - panelH - 16, panelW, panelH);
    ctx.strokeStyle = "var(--hot)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w - panelW - 16, h - panelH - 16, panelW, panelH);

    ctx.font = "9.6px 'Courier New', monospace";
    ctx.fillStyle = "#efe7d6";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], w - panelW - 6, h - panelH + 4 + i * 14.0);
    }
    ctx.restore();
  }
}
'''

with open('engine_part5.js', 'w', encoding='utf-8') as f:
    f.write(part5)

print("Part 5 written successfully.")
