# PART HUD: Modular Alpine Expedition Instrument HUD System
# Implements:
# - HUDTheme, HUDAnimations (GSAP + Lenis + Lottie + Spring Physics)
# - HUDTelemetry, Speedometer, RPMGauge, FuelGauge, Compass
# - TerrainScanner, ExpeditionRoute, VehicleStatus, StuntGauge, ControlsHUD
# - HUDManager orchestrating 60FPS dirty-checked SVG/DOM updates
import os

part_hud = r'''
// ============================================================================
// THE OLD MOUNTAIN WORKS — MODULAR ALPINE EXPEDITION INSTRUMENT HUD SYSTEM
// ============================================================================

// 1. HUDTheme — Adaptive Biome & World-Time Contrast System
class HUDTheme {
  currentSector = 1;
  currentBiome = "";

  init() {
    this.applySectorTheme(1, "Alpine Meadow");
  }

  applySectorTheme(sectorNum, biomeName) {
    if (this.currentSector === sectorNum && this.currentBiome === biomeName) return;
    this.currentSector = sectorNum;
    this.currentBiome = biomeName;

    const root = document.documentElement;
    // Subtle environmental accent shifts while preserving the core field-instrument palette
    if (sectorNum === 1) {
      root.style.setProperty("--hud-orange", "#d4622a");
    } else if (sectorNum === 2) {
      root.style.setProperty("--hud-orange", "#d86b32");
    } else if (sectorNum === 3) {
      root.style.setProperty("--hud-orange", "#de7236");
    } else if (sectorNum === 4) {
      root.style.setProperty("--hud-orange", "#e05e26");
    } else {
      root.style.setProperty("--hud-orange", "#d4622a");
    }
  }

  update(data) {
    const sector = Math.min(5, Math.max(1, Math.floor((data.distance || 0) / 180) + 1));
    this.applySectorTheme(sector, data.zone || "Alpine Meadow");
  }

  resize() {}
  destroy() {}
}

// 2. HUDAnimations — GSAP + Lenis + Lottie Animation Orchestrator
class HUDAnimations {
  hasGSAP = typeof window !== "undefined" && typeof window.gsap !== "undefined";
  hasLenis = typeof window !== "undefined" && typeof window.Lenis !== "undefined";
  hasLottie = typeof window !== "undefined" && typeof window.lottie !== "undefined";
  lenisInstances = [];
  relicLottie = null;

  init() {
    this.initLenisPanels();
    this.initRelicLottie();
  }

  initLenisPanels() {
    if (!this.hasLenis) return;
    try {
      const scrollContainers = [
        document.getElementById("garage-screen"),
        document.getElementById("garage-echoes-list"),
        document.getElementById("death-lore-box"),
      ].filter(Boolean);

      for (const wrapper of scrollContainers) {
        const lenis = new window.Lenis({
          wrapper,
          content: wrapper.firstElementChild || wrapper,
          lerp: 0.12,
          smoothWheel: true,
        });
        this.lenisInstances.push(lenis);
      }
    } catch (e) {}
  }

  initRelicLottie() {
    if (!this.hasLottie) return;
    const container = document.getElementById("hud-lottie-relic");
    if (!container) return;

    // Compact self-contained Lottie JSON for the Mountain Echo Diamond Pulse
    const echoAnimData = {
      v: "5.7.4",
      fr: 60,
      ip: 0,
      op: 60,
      w: 32,
      h: 32,
      nm: "EchoRelicPulse",
      ddd: 0,
      assets: [],
      layers: [
        {
          ddd: 0,
          ind: 1,
          ty: 4,
          nm: "Diamond",
          sr: 1,
          ks: {
            o: { a: 1, k: [{ t: 0, s: [100] }, { t: 30, s: [60] }, { t: 60, s: [100] }] },
            r: { a: 1, k: [{ t: 0, s: [0] }, { t: 60, s: [90] }] },
            p: { a: 0, k: [16, 16, 0] },
            a: { a: 0, k: [0, 0, 0] },
            s: { a: 1, k: [{ t: 0, s: [85, 85, 100] }, { t: 30, s: [115, 115, 100] }, { t: 60, s: [85, 85, 100] }] }
          },
          shapes: [
            {
              ty: "sr",
              sy: 1,
              d: 1,
              pt: { a: 0, k: 4 },
              p: { a: 0, k: [0, 0] },
              r: { a: 0, k: 0 },
              or: { a: 0, k: 10 },
              os: { a: 0, k: 0 }
            },
            {
              ty: "st",
              c: { a: 0, k: [0.831, 0.384, 0.165, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 2.5 }
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.831, 0.384, 0.165, 0.35] },
              o: { a: 0, k: 80 }
            }
          ],
          ip: 0,
          op: 60,
          st: 0
        }
      ]
    };

    try {
      this.relicLottie = window.lottie.loadAnimation({
        container,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: echoAnimData,
      });
    } catch (e) {}
  }

  // Boot Sequence (1.1s precision instrumentation calibration)
  animateHUDIntro(hudManager) {
    if (x.visual.reducedMotion || !this.hasGSAP) return;
    const gsap = window.gsap;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(
      "#hud-emblem-svg",
      { opacity: 0, scale: 0.92 },
      { opacity: 1, scale: 1, duration: 0.45 },
      0
    )
      .fromTo(
        "#hud-brand-title",
        { opacity: 0, y: 4 },
        { opacity: 1, y: 0, duration: 0.45 },
        0.08
      )
      .fromTo(
        "#hud-brand-rule",
        { scaleX: 0 },
        { scaleX: 1, duration: 0.55, ease: "expo.out" },
        0.12
      )
      .fromTo(
        ".hud-brand-sub",
        { opacity: 0 },
        { opacity: 1, duration: 0.4 },
        0.25
      )
      .fromTo(
        "#hud-telemetry-block",
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: 0.5 },
        0.18
      )
      .fromTo(
        "#hud-top-center, #hud-top-right, #hud-right-column, #hud-vehicle-status",
        { opacity: 0, y: -6 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06 },
        0.2
      )
      .fromTo(
        "#hud-gauges-cluster, #pedals",
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.55 },
        0.15
      );

    // Subtle Speedometer & RPM Needle Calibration Sweep
    if (hudManager?.speedometer && hudManager?.rpmGauge) {
      const cal = { sweep: 0 };
      gsap.to(cal, {
        sweep: 1,
        duration: 0.36,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
        onUpdate: () => {
          hudManager.speedometer.calibrationOffset = cal.sweep * 48;
          hudManager.rpmGauge.calibrationOffset = cal.sweep * 35;
        },
        onComplete: () => {
          hudManager.speedometer.calibrationOffset = 0;
          hudManager.rpmGauge.calibrationOffset = 0;
        },
      });
    }
  }

  animateSpeed(speedometer, targetSpeed, dt) {
    speedometer.stepPhysics(targetSpeed, dt);
  }

  animateRPM(rpmGauge, targetRpm, targetTemp, dt) {
    rpmGauge.stepPhysics(targetRpm, targetTemp, dt);
  }

  animateAltitude(telemetry, alt, dist, speed) {
    telemetry.updateRuler(alt, dist, speed);
  }

  animateStunt(stuntData) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const gsap = window.gsap;
    gsap.fromTo(
      "#hud-right-labels",
      { x: 6, opacity: 0.65 },
      { x: 0, opacity: 1, duration: 0.24, ease: "power2.out", overwrite: "auto" }
    );
    gsap.fromTo(
      "#hud-stunt-bar-top",
      { filter: "brightness(1.7)" },
      { filter: "brightness(1.0)", duration: 0.35, ease: "power2.out", overwrite: "auto" }
    );
  }

  animateLanding(compression = 0.5) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const gsap = window.gsap;
    const dip = Math.min(4.5, Math.max(1.2, compression * 4.5));
    gsap.fromTo(
      "#hud-gauges-cluster",
      { y: dip },
      { y: 0, duration: 0.28, ease: "back.out(2.2)", overwrite: "auto" }
    );
  }

  animateCrash(severity = "heavy") {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const gsap = window.gsap;
    const mag = severity === "critical" ? 5 : 2.5;
    gsap.fromTo(
      "#hud-gauges-cluster",
      { x: -mag },
      { x: 0, duration: 0.26, ease: "elastic.out(1.2, 0.3)", overwrite: "auto" }
    );
  }

  animateInversion(isInverted) {
    const dot = document.getElementById("hud-drivetrain-dot");
    const mode = document.getElementById("hud-drivetrain-mode");
    if (!dot || !mode) return;
    if (isInverted) {
      mode.textContent = "INVERTED";
      mode.style.color = "#d4622a";
    } else if (mode.textContent === "INVERTED") {
      mode.textContent = "4WD";
      mode.style.color = "";
    }
  }

  animateSectorChange(sectorNum, biomeName) {
    const secEl = document.getElementById("hud-sector-label");
    const routeTag = document.getElementById("hud-route-sector-tag");
    if (secEl) secEl.textContent = `SECTOR 0${sectorNum}`;
    if (routeTag) routeTag.textContent = `SECTOR 0${sectorNum} // ${biomeName.toUpperCase()}`;

    if (this.hasGSAP && !x.visual.reducedMotion) {
      window.gsap.fromTo(
        "#hud-sector-label, #hud-route-sector-tag",
        { color: "#d4622a" },
        { color: "rgba(239, 231, 214, 0.85)", duration: 0.9, ease: "power2.out" }
      );
      window.gsap.fromTo(
        "#hud-route-beacon",
        { scale: 1.7 },
        { scale: 1.0, duration: 0.5, ease: "back.out(2)" }
      );
    }
  }

  animateEchoCollected(relic) {
    const lottieEl = document.getElementById("hud-lottie-relic");
    if (lottieEl) {
      lottieEl.style.opacity = "1";
      if (this.relicLottie) {
        this.relicLottie.goToAndPlay(0, true);
      }
    }
    if (this.hasGSAP && !x.visual.reducedMotion) {
      window.gsap.fromTo(
        "#hud-echoes",
        { color: "#d4622a" },
        { color: "#efe7d6", duration: 0.7, ease: "power2.out" }
      );
    }
  }

  animateVehicleChange(archetypeName) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    window.gsap.fromTo(
      "#hud-vehicle, #hud-vehicle-status",
      { opacity: 0.45 },
      { opacity: 1, duration: 0.25, ease: "power2.out", overwrite: "auto" }
    );
  }

  animateDeath(reason) {
    document.body.classList.add("hud-crashed");
    const banner = document.getElementById("hud-death-banner");
    const bannerTitle = document.getElementById("hud-death-banner-title");
    if (bannerTitle) bannerTitle.textContent = `EXPEDITION INTERRUPTED // ${reason.toUpperCase()}`;
    if (banner) {
      banner.style.display = "flex";
      if (this.hasGSAP && !x.visual.reducedMotion) {
        window.gsap.fromTo(
          banner,
          { opacity: 0, scale: 0.96 },
          { opacity: 1, scale: 1, duration: 0.25, ease: "power3.out" }
        );
      }
      setTimeout(() => {
        banner.style.display = "none";
      }, 620);
    }
  }

  animatePause(isPaused) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    if (isPaused) {
      window.gsap.fromTo(
        "#pause .card",
        { opacity: 0, y: 12, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "power3.out" }
      );
    }
  }
}

// 3. HUDTelemetry — Left-Side Editorial Telemetry & Vertical Scale Ruler
class HUDTelemetry {
  els = {};
  cache = {};

  init() {
    this.els = {
      dist: document.getElementById("hud-dist"),
      speed: document.getElementById("hud-speed"),
      alt: document.getElementById("hud-alt"),
      incline: document.getElementById("hud-incline"),
      echoes: document.getElementById("hud-echoes"),
      zone: document.getElementById("hud-zone"),
      score: document.getElementById("hud-score"),
      vehicle: document.getElementById("hud-vehicle"),
      rpmBar: document.getElementById("hud-rpm"),
      air: document.getElementById("hud-air"),
      combo: document.getElementById("hud-combo"),
      leftIndicator: document.getElementById("hud-left-indicator"),
    };
  }

  setText(key, val) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    const el = this.els[key];
    if (el) el.textContent = val;
  }

  updateRuler(alt, dist, speed) {
    if (!this.els.leftIndicator) return;
    const normAlt = b((alt || 0) / 140, 0, 0.72);
    const normSpeed = b((speed || 0) / 130, 0.16, 0.36);
    this.els.leftIndicator.style.bottom = `${Math.round(8 + normAlt * 64)}%`;
    this.els.leftIndicator.style.height = `${Math.round(normSpeed * 100)}%`;
  }

  update(data) {
    const distVal = `${Math.round(data.distance || 0)} m`;
    const speedVal = `${Math.round(data.speed || 0)} km/h`;
    const altVal = `${Math.max(1, Math.round(data.altitude || 1))} m`;
    const incVal = `${Math.round(data.incline || 0)}°`;
    const echoVal = `${data.echoCount ?? 0}/${data.echoTotal ?? 6}`;
    const zoneVal = (data.biomeName || "ALPINE MEADOW").toUpperCase();
    const scoreVal = String(Math.round(data.score || 0));
    const vehVal = (data.vehicleName || "TRAIL BUGGY").toUpperCase();

    this.setText("dist", distVal);
    this.setText("speed", speedVal);
    this.setText("alt", altVal);
    this.setText("incline", incVal);
    this.setText("echoes", echoVal);
    this.setText("zone", zoneVal);
    this.setText("score", scoreVal);
    this.setText("vehicle", vehVal);

    if (this.els.rpmBar) {
      const wPct = `${Math.min(100, Math.round((data.rpm || 0) * 100))}%`;
      if (this.cache.rpmWidth !== wPct) {
        this.cache.rpmWidth = wPct;
        this.els.rpmBar.style.width = wPct;
      }
    }

    const airText = data.airborne ? `AIR ${(data.airtime / 1000).toFixed(1)}s` : "";
    this.setText("air", airText);

    if (this.els.combo) {
      const showCombo = data.comboMultiplier > 1 && data.comboTimer > 0;
      this.els.combo.style.display = showCombo ? "block" : "none";
      if (showCombo) {
        this.setText("combo", `COMBO x${data.comboMultiplier} (${data.comboTimer.toFixed(1)}s)`);
      }
    }

    this.updateRuler(data.altitude, data.distance, data.speed);
  }

  resize() {}
  destroy() {}
}

// 4. Speedometer — Hero Circular Analog Instrument with Critically Damped Spring
class Speedometer {
  needleEl = null;
  arcEl = null;
  bigNumEl = null;
  orangeZoneEl = null;
  currentSpeed = 0;
  speedVel = 0;
  calibrationOffset = 0;
  lastDisplayedInt = -1;
  frozen = false;

  init() {
    this.needleEl = document.getElementById("hud-speed-needle");
    this.arcEl = document.getElementById("hud-speed-arc");
    this.bigNumEl = document.getElementById("hud-speed-big");
    this.orangeZoneEl = document.getElementById("hud-speed-orange-zone");
  }

  stepPhysics(targetSpeed, dt = 16.666) {
    if (this.frozen) return;
    const dtSec = Math.min(0.05, Math.max(0.004, dt / 1000));
    const target = Math.max(0, targetSpeed + this.calibrationOffset);

    // 2nd-order critically damped spring for authentic mechanical gauge inertia
    const k = 95.0;
    const c = 17.5;
    const force = k * (target - this.currentSpeed) - c * this.speedVel;
    this.speedVel += force * dtSec;
    this.currentSpeed = Math.max(0, this.currentSpeed + this.speedVel * dtSec);

    const maxSpeed = 135;
    const ratio = b(this.currentSpeed / maxSpeed, 0, 1);

    // High-speed micro-vibration above 80 km/h
    const tremor = ratio > 0.6 && !x.visual.reducedMotion
      ? Math.sin(performance.now() * 0.055) * (ratio - 0.6) * 2.4
      : 0;

    // 240-degree sweep from -120 deg to +120 deg
    const visualRatio = Math.max(0.28, ratio);
    const angle = -120 + visualRatio * 240 + tremor;
    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${angle.toFixed(2)} 100 100)`);
    }

    // Arc stroke-dashoffset (total length 335)
    if (this.arcEl) {
      const offset = 335 * (1 - visualRatio);
      this.arcEl.setAttribute("stroke-dashoffset", offset.toFixed(1));
    }

    if (this.orangeZoneEl) {
      const highGlow = ratio > 0.65 ? 1.0 : 0.88;
      this.orangeZoneEl.setAttribute("opacity", String(highGlow));
    }

    const displayInt = Math.round(targetSpeed);
    if (displayInt !== this.lastDisplayedInt && this.bigNumEl) {
      this.lastDisplayedInt = displayInt;
      this.bigNumEl.textContent = String(displayInt);
    }
  }

  update(data, dt) {
    this.stepPhysics(data.speed || 0, dt);
  }

  resize() {}
  destroy() {}
}

// 5. RPMGauge — Right Sub-Dial Analog RPM & Engine Thermal Instrument
class RPMGauge {
  needleEl = null;
  arcEl = null;
  readoutEl = null;
  currentVal = 0.25;
  calibrationOffset = 0;
  frozen = false;

  init() {
    this.needleEl = document.getElementById("hud-rpm-needle");
    this.arcEl = document.getElementById("hud-rpm-arc");
    this.readoutEl = document.getElementById("hud-rpm-readout");
  }

  stepPhysics(rpm = 0, temp = 0.28, dt = 16.666) {
    if (this.frozen) return;
    const blended = b(rpm * 0.68 + temp * 0.32 + this.calibrationOffset * 0.015, 0.14, 1.0);
    this.currentVal = G0(this.currentVal, blended, 12, dt);

    const tremor = rpm > 0.82 && !x.visual.reducedMotion
      ? Math.sin(performance.now() * 0.08) * 2.2
      : 0;

    // Sweep from -78 deg (C) to +78 deg (H)
    const angle = -78 + this.currentVal * 156 + tremor;
    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${angle.toFixed(1)} 55 62)`);
    }
    if (this.arcEl) {
      const offset = 132 * (1 - this.currentVal * 0.82);
      this.arcEl.setAttribute("stroke-dashoffset", offset.toFixed(1));
      this.arcEl.setAttribute("stroke", rpm > 0.82 ? "#d4622a" : "rgba(239,231,214,0.34)");
    }
    if (this.readoutEl) {
      const rpmThousands = (0.8 + rpm * 6.4).toFixed(1);
      this.readoutEl.textContent = `${rpmThousands}k RPM`;
      this.readoutEl.setAttribute("opacity", rpm > 0.72 ? "0.75" : "0");
    }
  }

  update(data, dt) {
    this.stepPhysics(data.rpm || 0, data.engineTemp ?? 0.28, dt);
  }

  resize() {}
  destroy() {}
}

// 6. FuelGauge — Left Sub-Dial Expedition Fuel / Reserve Instrument
class FuelGauge {
  needleEl = null;
  arcEl = null;
  lowEl = null;
  currentFuel = 1.0;

  init() {
    this.needleEl = document.getElementById("hud-fuel-needle");
    this.arcEl = document.getElementById("hud-fuel-arc");
    this.lowEl = document.getElementById("hud-fuel-low");
  }

  update(data, dt = 16.666) {
    const target = b(data.fuel ?? 0.95, 0.05, 1.0);
    this.currentFuel = G0(this.currentFuel, target, 8, dt);

    // Calibrated reserve sweep: at 1.0 fuel, illuminates the signature 48% burnt-orange left-upper arc
    const arcSpan = 0.08 + this.currentFuel * 0.42;
    const angle = -76 + arcSpan * 152;
    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${angle.toFixed(1)} 55 62)`);
    }
    if (this.arcEl) {
      const offset = 132 * (1 - arcSpan);
      this.arcEl.setAttribute("stroke-dashoffset", offset.toFixed(1));
    }
    if (this.lowEl) {
      const isLow = this.currentFuel < 0.22;
      this.lowEl.setAttribute("opacity", isLow ? "1" : "0");
    }
  }

  resize() {}
  destroy() {}
}

// 7. Compass — Top-Right Environmental Telemetry & Spring-Damped Compass Rose
class Compass {
  needleEl = null;
  timeEl = null;
  ampmEl = null;
  tempEl = null;
  weatherEl = null;
  currentAngle = 0;
  angleVel = 0;
  lastTimeStr = "";
  lastTempStr = "";
  lastWeatherStr = "";

  init() {
    this.needleEl = document.getElementById("hud-compass-needle");
    this.timeEl = document.getElementById("hud-time-val");
    this.ampmEl = document.getElementById("hud-time-ampm");
    this.tempEl = document.getElementById("hud-temp-val");
    this.weatherEl = document.getElementById("hud-weather-label");
  }

  update(data, dt = 16.666) {
    const dtSec = Math.min(0.05, Math.max(0.004, dt / 1000));
    // Compass needle responds with physical inertia & tiny overshoot to slope/incline + heading
    const targetDeg = b((data.incline || 0) * 1.45 + Math.sin((data.distance || 0) * 0.03) * 12, -65, 65);
    const k = 48.0;
    const c = 8.5;
    const acc = k * (targetDeg - this.currentAngle) - c * this.angleVel;
    this.angleVel += acc * dtSec;
    this.currentAngle += this.angleVel * dtSec;

    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${this.currentAngle.toFixed(2)} 32 32)`);
    }

    // World Clock (starts at 06:24 AM and progresses with expedition time/distance)
    const elapsedMin = Math.floor(((data.distance || 0) / 18) + ((window.game?.time || 0) / 15000));
    const totalMin = 6 * 60 + 24 + elapsedMin;
    const hrs24 = Math.floor(totalMin / 60) % 24;
    const mins = totalMin % 60;
    const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;
    const timeStr = `${String(hrs12).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    if (timeStr !== this.lastTimeStr && this.timeEl) {
      this.lastTimeStr = timeStr;
      this.timeEl.textContent = timeStr;
      if (this.ampmEl) this.ampmEl.textContent = hrs24 >= 12 ? "PM" : "AM";
    }

    // Altitude-driven Alpine Temperature (12°C at base camp dropping with elevation)
    const tempC = Math.round(12 - (data.altitude || 0) * 0.22);
    const tempStr = `${tempC}°C`;
    if (tempStr !== this.lastTempStr && this.tempEl) {
      this.lastTempStr = tempStr;
      this.tempEl.textContent = tempStr;
    }

    // Biome Weather Condition
    const zone = (data.biomeName || "").toLowerCase();
    let wStr = "CLEAR";
    if (zone.includes("crag")) wStr = "RIDGE WIND";
    else if (zone.includes("canyon")) wStr = "GORGE MIST";
    else if (zone.includes("iron") || zone.includes("works")) wStr = "ASH HAZE";
    else if (zone.includes("summit") || zone.includes("frozen")) wStr = "GLACIER SNOW";

    if (wStr !== this.lastWeatherStr && this.weatherEl) {
      this.lastWeatherStr = wStr;
      this.weatherEl.textContent = wStr;
    }
  }

  resize() {}
  destroy() {}
}

// 8. ExpeditionRoute & 9. TerrainScanner — Top-Center Ridge Progression & Live Terrain Profile
class ExpeditionRouteAndScanner {
  progressEl = null;
  beaconEl = null;
  scannerLineEl = null;
  scannerCarEl = null;
  scanTimer = 0;

  // Waypoints along the 400x26 SVG route path
  routePoints = [
    { x: 8, y: 20 },
    { x: 55, y: 18 },
    { x: 95, y: 12 },
    { x: 135, y: 16 },
    { x: 185, y: 9 },
    { x: 235, y: 14 },
    { x: 285, y: 6 },
    { x: 335, y: 11 },
    { x: 392, y: 3 },
  ];

  init() {
    this.progressEl = document.getElementById("hud-route-progress");
    this.beaconEl = document.getElementById("hud-route-beacon");
    this.scannerLineEl = document.getElementById("hud-scanner-line");
    this.scannerCarEl = document.getElementById("hud-scanner-car");
  }

  pointAtProgress(p) {
    const clamped = b(p, 0, 1);
    const segs = this.routePoints.length - 1;
    const f = clamped * segs;
    const idx = Math.min(segs - 1, Math.floor(f));
    const t = f - idx;
    const p0 = this.routePoints[idx];
    const p1 = this.routePoints[idx + 1];
    return {
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
    };
  }

  update(data, dt = 16.666) {
    const totalMeters = (x.world.length - x.world.startX) / 40;
    const prog = b((data.distance || 0) / Math.max(1, totalMeters), 0, 1);

    if (this.progressEl) {
      const dashOffset = 400 * (1 - prog);
      this.progressEl.setAttribute("stroke-dashoffset", dashOffset.toFixed(1));
    }
    if (this.beaconEl) {
      const pt = this.pointAtProgress(prog);
      this.beaconEl.setAttribute("transform", `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
    }

    // Update live terrain profile scanner at 20Hz
    this.scanTimer += dt;
    if (this.scanTimer >= 50 && window.game?.terrain && window.game?.vehicle) {
      this.scanTimer = 0;
      const terrain = window.game.terrain;
      const carX = window.game.vehicle.chassis.position.x;
      const baseH = terrain.heightAt(carX);
      let dPath = "";
      let maxGrade = 0;
      const samples = 24;
      for (let i = 0; i <= samples; i++) {
        const u = i / samples;
        const wx = carX - 140 + u * 1240;
        const wy = terrain.heightAt(wx);
        const relY = b(11 + (wy - baseH) * 0.038, 1.5, 16.5);
        const sx = (u * 300).toFixed(1);
        const sy = relY.toFixed(1);
        dPath += (i === 0 ? `M ${sx},${sy}` : ` L ${sx},${sy}`);
        if (i > 2 && i < 14) {
          maxGrade = Math.max(maxGrade, Math.abs(terrain.slopeAt(wx)));
        }
      }
      if (this.scannerLineEl) {
        this.scannerLineEl.setAttribute("d", dPath);
        this.scannerLineEl.setAttribute(
          "stroke",
          maxGrade > 0.44 ? "#d4622a" : "rgba(239,231,214,0.45)"
        );
      }
    }
  }

  resize() {}
  destroy() {}
}

// 10. StuntGauge — Right-Side Vertical Elevation / Airtime / Stunt Telemetry Column
class StuntGauge {
  line1 = null;
  line2 = null;
  line3 = null;
  line4 = null;
  barTop = null;
  wasAirborne = false;

  init() {
    this.line1 = document.getElementById("hud-right-line1");
    this.line2 = document.getElementById("hud-right-line2");
    this.line3 = document.getElementById("hud-right-line3");
    this.line4 = document.getElementById("hud-right-line4");
    this.barTop = document.getElementById("hud-stunt-bar-top");
  }

  update(data) {
    if (!this.line1) return;

    if (data.airborne && data.airtime > 120) {
      this.line1.textContent = "AIRTIME";
      this.line1.className = "accent-orange";
      this.line2.textContent = `${(data.airtime / 1000).toFixed(2)} S`;
      this.line2.className = "lead";
      this.line3.textContent = data.activeStunt || "BALLISTIC";
      this.line4.textContent = data.comboMultiplier > 1 ? `COMBO X${data.comboMultiplier}` : "ARC LOCKED";

      if (this.barTop) {
        const pct = b(22 + (data.airtime / 1800) * 65, 22, 88);
        this.barTop.style.height = `${pct.toFixed(0)}%`;
      }
      this.wasAirborne = true;
    } else if (this.wasAirborne) {
      this.wasAirborne = false;
      this.line1.textContent = "HIGHER";
      this.line1.className = "lead";
      this.line2.textContent = "TERRAIN";
      this.line2.className = "";
      this.line3.textContent = "BIGGER";
      this.line4.textContent = "STORIES";
      if (this.barTop) {
        const altPct = b(22 + ((data.altitude || 0) / 160) * 52, 22, 74);
        this.barTop.style.height = `${altPct.toFixed(0)}%`;
      }
    } else if (this.barTop) {
      const altPct = b(22 + ((data.altitude || 0) / 160) * 52, 22, 74);
      this.barTop.style.height = `${altPct.toFixed(0)}%`;
    }
  }

  resize() {}
  destroy() {}
}

// 11. VehicleStatus — Bottom-Right 4WD Drivetrain & Tire Contact Matrix
class VehicleStatus {
  modeEl = null;
  dotEl = null;
  wheels = [];

  init() {
    this.modeEl = document.getElementById("hud-drivetrain-mode");
    this.dotEl = document.getElementById("hud-drivetrain-dot");
    this.wheels = [
      document.getElementById("hud-wheel-rl"),
      document.getElementById("hud-wheel-rr"),
      document.getElementById("hud-wheel-fl"),
      document.getElementById("hud-wheel-fr"),
    ];
  }

  update(data) {
    const v = window.game?.vehicle;
    if (!v || !this.modeEl) return;

    const rearContact = v.wheels[0]?.contact ?? true;
    const frontContact = v.wheels[1]?.contact ?? true;

    if (window.game?.deathState === "critical" || window.game?.deathState === "crashed") {
      this.modeEl.textContent = "INVERTED";
      this.modeEl.style.color = "#d4622a";
    } else if (data.airborne) {
      this.modeEl.textContent = "AIR";
      this.modeEl.style.color = "#d4622a";
    } else {
      this.modeEl.textContent = "4WD";
      this.modeEl.style.color = "#efe7d6";
    }

    const rColor = rearContact ? "#efe7d6" : "rgba(239,231,214,0.22)";
    const fColor = frontContact ? "#efe7d6" : "rgba(239,231,214,0.22)";
    if (this.wheels[0]) this.wheels[0].setAttribute("fill", rColor);
    if (this.wheels[1]) this.wheels[1].setAttribute("fill", rColor);
    if (this.wheels[2]) this.wheels[2].setAttribute("fill", fColor);
    if (this.wheels[3]) this.wheels[3].setAttribute("fill", fColor);
  }

  resize() {}
  destroy() {}
}

// 12. ControlsHUD — Bottom-Left Mechanical SVG Pedals (Keyboard + Touch Synchronized)
class ControlsHUD {
  pedalL = null;
  pedalR = null;
  prevBrake = false;
  prevThrottle = false;

  init() {
    this.pedalL = document.getElementById("pedal-l");
    this.pedalR = document.getElementById("pedal-r");
  }

  setPedalState(btn, isPressed, wasPressed) {
    if (!btn || isPressed === wasPressed) return;
    btn.classList.toggle("pressed", isPressed);
    if (typeof window.gsap !== "undefined" && !x.visual.reducedMotion) {
      window.gsap.to(btn, {
        scale: isPressed ? 0.91 : 1.0,
        y: isPressed ? 2.5 : 0,
        duration: isPressed ? 0.1 : 0.2,
        ease: isPressed ? "power2.out" : "back.out(2.2)",
        overwrite: "auto",
      });
    }
  }

  update() {
    const input = window.game?.input;
    if (!input) return;
    const isBrake = (input.brake || 0) > 0.1;
    const isThrottle = (input.throttle || 0) > 0.1;

    this.setPedalState(this.pedalL, isBrake, this.prevBrake);
    this.setPedalState(this.pedalR, isThrottle, this.prevThrottle);

    this.prevBrake = isBrake;
    this.prevThrottle = isThrottle;
  }

  resize() {}
  destroy() {}
}

// 13. HUDManager — Master Coordinator
class HUDManager {
  theme = new HUDTheme();
  animations = new HUDAnimations();
  telemetry = new HUDTelemetry();
  speedometer = new Speedometer();
  rpmGauge = new RPMGauge();
  fuelGauge = new FuelGauge();
  compass = new Compass();
  routeScanner = new ExpeditionRouteAndScanner();
  stuntGauge = new StuntGauge();
  vehicleStatus = new VehicleStatus();
  controls = new ControlsHUD();
  lastSector = 1;

  init(gameInstance) {
    this.theme.init();
    this.animations.init();
    this.telemetry.init();
    this.speedometer.init();
    this.rpmGauge.init();
    this.fuelGauge.init();
    this.compass.init();
    this.routeScanner.init();
    this.stuntGauge.init();
    this.vehicleStatus.init();
    this.controls.init();

    if (gameInstance?.bus) {
      gameInstance.bus.on("stunt:awarded", (d) => this.animations.animateStunt(d));
      gameInstance.bus.on("echo:collected", (r) => {
        if (gameInstance.vehicle) {
          gameInstance.vehicle.fuel = Math.min(1.0, (gameInstance.vehicle.fuel || 0.8) + 0.25);
        }
        this.animations.animateEchoCollected(r);
      });
      gameInstance.bus.on("vehicle:impact", (imp) => {
        if (imp.energy > 1.2) {
          this.animations.animateCrash(imp.energy > 2.4 ? "critical" : "heavy");
        } else if (imp.energy > 0.35) {
          this.animations.animateLanding(b(imp.energy, 0.3, 1.2));
        }
      });
    }
  }

  reset() {
    document.body.classList.remove("hud-crashed");
    this.speedometer.frozen = false;
    this.rpmGauge.frozen = false;
    const banner = document.getElementById("hud-death-banner");
    if (banner) banner.style.display = "none";
  }

  onDeath(reason) {
    this.speedometer.frozen = true;
    this.rpmGauge.frozen = true;
    this.animations.animateDeath(reason);
  }

  update(data, dt = 16.666) {
    const v = window.game?.vehicle;
    const enriched = {
      ...data,
      fuel: v?.fuel ?? 0.88,
      engineTemp: v?.engineTemp ?? 0.28,
    };

    const sector = Math.min(5, Math.max(1, Math.floor((enriched.distance || 0) / 180) + 1));
    if (sector !== this.lastSector) {
      this.lastSector = sector;
      this.animations.animateSectorChange(sector, enriched.biomeName || "Alpine Meadow");
    }

    this.theme.update(enriched);
    this.telemetry.update(enriched);
    this.speedometer.update(enriched, dt);
    this.rpmGauge.update(enriched, dt);
    this.fuelGauge.update(enriched, dt);
    this.compass.update(enriched, dt);
    this.routeScanner.update(enriched, dt);
    this.stuntGauge.update(enriched);
    this.vehicleStatus.update(enriched);
    this.controls.update();

    for (const l of this.animations.lenisInstances) {
      try { l.raf(performance.now()); } catch (e) {}
    }
  }

  resize() {
    this.theme.resize();
    this.telemetry.resize();
    this.speedometer.resize();
    this.rpmGauge.resize();
    this.fuelGauge.resize();
    this.compass.resize();
    this.routeScanner.resize();
    this.stuntGauge.resize();
    this.vehicleStatus.resize();
    this.controls.resize();
  }

  destroy() {}
}
'''

with open('engine_hud.js', 'w', encoding='utf-8') as f:
    f.write(part_hud)

print("HUD module written successfully.")
