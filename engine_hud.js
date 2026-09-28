
// ============================================================================
// MASTER HUD 2.0 — LIVING EXPEDITION INSTRUMENT SYSTEM
// ============================================================================

// 1. HUDTheme — Physical Material & Motion Tokens (Sections 18, 19, 21)
const HUDTheme = {
  colors: {
    ink: "#111513",
    anodized: "#141917",
    paper: "#efe7d6",
    muted: "rgba(239, 231, 214, 0.50)",
    mutedStrong: "rgba(239, 231, 214, 0.76)",
    orange: "#d4622a",
    brass: "#c8a464",
    line: "rgba(239, 231, 214, 0.16)",
    warning: "#e25822",
  },
  motionCategories: {
    MECHANICAL: "cubic-bezier(0.19, 1, 0.22, 1)",
    INERTIAL: { k: 82, c: 13.5 },
    ORGANIC: "cubic-bezier(0.25, 1, 0.5, 1)",
    GEOMETRIC: "linear",
    TACTILE: "cubic-bezier(0.12, 0.8, 0.32, 1)",
    ATMOSPHERIC: "cubic-bezier(0.23, 1, 0.32, 1)",
    CINEMATIC: "cubic-bezier(0.16, 1, 0.3, 1)",
    EMERGENCY: "cubic-bezier(0.08, 0.92, 0.18, 1)",
  },
};

// 2. HUDStateMachine — Explicit 17-State HUD Controller (Section 22)
class HUDStateMachine {
  current = "BOOT";
  previous = "BOOT";
  stateTimer = 0;
  overrideState = null;
  overrideDuration = 0;
  hudEl = null;

  static STATES = [
    "BOOT",
    "IDLE",
    "DRIVING",
    "ACCELERATING",
    "BRAKING",
    "AIRBORNE",
    "STUNT",
    "LANDING",
    "LOW_RESOURCE",
    "DANGER",
    "INVERTED",
    "ECHO_DISCOVERY",
    "SECTOR_CHANGE",
    "PAUSED",
    "CRASH",
    "DEATH",
    "DEBRIEF",
  ];

  init() {
    this.hudEl = document.getElementById("hud");
    this.current = "BOOT";
    this.previous = "BOOT";
    this.stateTimer = 0;
    this.overrideState = null;
    this.overrideDuration = 0;
  }

  triggerTransientState(stateName, durationMs = 1200) {
    this.overrideState = stateName;
    this.overrideDuration = durationMs;
    this.applyStateClasses(stateName);
  }

  evaluate(telemetry, dt = 16.666) {
    this.stateTimer += dt;
    if (this.overrideDuration > 0) {
      this.overrideDuration -= dt;
      if (this.overrideDuration <= 0) {
        this.overrideState = null;
      }
    }

    let next = "IDLE";
    if (telemetry.isDead) {
      next = telemetry.debriefVisible ? "DEBRIEF" : "DEATH";
    } else if (telemetry.isPaused) {
      next = "PAUSED";
    } else if (this.overrideState) {
      next = this.overrideState;
    } else if (telemetry.inverted) {
      next = "INVERTED";
    } else if (telemetry.airborne) {
      next = Math.abs(telemetry.cumulativeAirAngle) > 1.8 || telemetry.activeStunt ? "STUNT" : "AIRBORNE";
    } else if (telemetry.fuel < 0.22) {
      next = "LOW_RESOURCE";
    } else if (Math.abs(telemetry.incline) > 34) {
      next = "DANGER";
    } else if (telemetry.brake > 0.1) {
      next = "BRAKING";
    } else if (telemetry.throttle > 0.1) {
      next = "ACCELERATING";
    } else if (telemetry.speed > 3) {
      next = "DRIVING";
    } else {
      next = "IDLE";
    }

    if (next !== this.current) {
      this.previous = this.current;
      this.current = next;
      this.stateTimer = 0;
      this.applyStateClasses(next);
    }
    return this.current;
  }

  applyStateClasses(state) {
    if (!this.hudEl) return;
    this.hudEl.setAttribute("data-hud-state", state);
    this.hudEl.classList.toggle("hud-state-airborne", state === "AIRBORNE" || state === "STUNT");
    this.hudEl.classList.toggle("hud-state-echo", state === "ECHO_DISCOVERY");
  }

  reset() {
    this.overrideState = null;
    this.overrideDuration = 0;
    this.current = "IDLE";
    this.applyStateClasses("IDLE");
  }
}

// 3. HUDThreeInstruments — Subtle 3D Mechanical Bevels, Gimbal & 4WD Wireframe (Sections 1 & 20)
class HUDThreeInstruments {
  canvas = null;
  renderer = null;
  scene = null;
  camera = null;
  speedoGroup = null;
  speedoInnerRing = null;
  compassGroup = null;
  drivetrainGroup = null;
  wheelMeshes = [];
  enabled = false;
  width = 0;
  height = 0;

  init() {
    this.canvas = document.getElementById("hud-three-canvas");
    if (!this.canvas || typeof THREE === "undefined") return;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(1);
      this.scene = new THREE.Scene();

      this.width = window.innerWidth || 1280;
      this.height = window.innerHeight || 720;
      this.camera = new THREE.OrthographicCamera(
        -this.width / 2,
        this.width / 2,
        this.height / 2,
        -this.height / 2,
        -500,
        500
      );
      this.camera.position.z = 200;

      const bronzeMat = new THREE.LineBasicMaterial({
        color: 0xefe7d6,
        transparent: true,
        opacity: 0.18,
      });
      const orangeMat = new THREE.LineBasicMaterial({
        color: 0xd4622a,
        transparent: true,
        opacity: 0.34,
      });

      // 1. Speedometer 3D Cylindrical Bevel Ring & Inner Calibration Ring
      this.speedoGroup = new THREE.Group();
      const outerTorus = new THREE.TorusGeometry(74, 1.4, 8, 48);
      const outerEdges = new THREE.EdgesGeometry(outerTorus);
      this.speedoGroup.add(new THREE.LineSegments(outerEdges, bronzeMat));

      const innerRingGeo = new THREE.RingGeometry(52, 53.2, 32);
      const innerEdges = new THREE.EdgesGeometry(innerRingGeo);
      this.speedoInnerRing = new THREE.LineSegments(innerEdges, orangeMat);
      this.speedoInnerRing.position.z = 6;
      this.speedoGroup.add(this.speedoInnerRing);
      this.scene.add(this.speedoGroup);

      // 2. Compass 3D Gyroscopic Binnacle Gimbal Ring
      this.compassGroup = new THREE.Group();
      const gimbalGeo = new THREE.TorusGeometry(24, 0.8, 6, 32);
      const gimbalEdges = new THREE.EdgesGeometry(gimbalGeo);
      this.compassGroup.add(new THREE.LineSegments(gimbalEdges, bronzeMat));
      this.scene.add(this.compassGroup);

      // 3. 4WD Miniature 3D Technical Drivetrain & Axle Silhouette
      this.drivetrainGroup = new THREE.Group();
      const chassisGeo = new THREE.BoxGeometry(22, 5, 10);
      const chassisEdges = new THREE.EdgesGeometry(chassisGeo);
      this.drivetrainGroup.add(new THREE.LineSegments(chassisEdges, bronzeMat));

      const wheelGeo = new THREE.CylinderGeometry(3.2, 3.2, 2.2, 10);
      wheelGeo.rotateX(Math.PI / 2);
      const wheelEdges = new THREE.EdgesGeometry(wheelGeo);
      const wheelOffsets = [
        [-8, -2.5, 6],
        [-8, -2.5, -6],
        [8, -2.5, 6],
        [8, -2.5, -6],
      ];
      this.wheelMeshes = [];
      for (const [wx, wy, wz] of wheelOffsets) {
        const wMesh = new THREE.LineSegments(wheelEdges, orangeMat);
        wMesh.position.set(wx, wy, wz);
        this.drivetrainGroup.add(wMesh);
        this.wheelMeshes.push(wMesh);
      }
      this.scene.add(this.drivetrainGroup);

      this.enabled = true;
      this.resize();
    } catch (e) {
      this.enabled = false;
    }
  }

  resize() {
    if (!this.enabled || !this.renderer || !this.camera) return;
    this.width = window.innerWidth || 1280;
    this.height = window.innerHeight || 720;
    this.renderer.setSize(this.width, this.height, false);
    this.camera.left = -this.width / 2;
    this.camera.right = this.width / 2;
    this.camera.top = this.height / 2;
    this.camera.bottom = -this.height / 2;
    this.camera.updateProjectionMatrix();

    // Anchor 3D instruments to exact HUD layout coordinates
    if (this.speedoGroup) {
      this.speedoGroup.position.set(0, -this.height / 2 + 96, 0);
    }
    if (this.compassGroup) {
      this.compassGroup.position.set(this.width / 2 - 52, this.height / 2 - 48, 0);
    }
    if (this.drivetrainGroup) {
      this.drivetrainGroup.position.set(this.width / 2 - 45, -this.height / 2 + 34, 0);
    }
  }

  update(telemetry, dt = 16.666) {
    if (!this.enabled || !this.renderer || !this.scene || !this.camera) return;
    this.frameCount = (this.frameCount || 0) + 1;
    if (this.frameCount % 3 !== 0) return;
    if (this.canvas && this.canvas.style.display !== "block") {
      const hudEl = document.getElementById("hud");
      if (hudEl && hudEl.style.display === "block") {
        this.canvas.style.display = "block";
      } else {
        return;
      }
    }

    const reduce = x.visual.reducedMotion;
    const pitchRad = (telemetry.incline || 0) * (Math.PI / 180);
    const speedNorm = b((telemetry.speed || 0) / 130, 0, 1);
    const accelTilt = (telemetry.throttle - telemetry.brake) * 0.14;

    if (this.speedoGroup) {
      const targetRx = reduce ? 0 : 0.18 + accelTilt * 0.35;
      const targetRy = reduce ? 0 : -pitchRad * 0.25;
      this.speedoGroup.rotation.x += (targetRx - this.speedoGroup.rotation.x) * 0.15;
      this.speedoGroup.rotation.y += (targetRy - this.speedoGroup.rotation.y) * 0.15;
      if (this.speedoInnerRing) {
        this.speedoInnerRing.rotation.z = -speedNorm * Math.PI * 0.85;
      }
    }

    if (this.compassGroup) {
      const targetCx = reduce ? 0 : 0.28 + pitchRad * 0.45;
      const targetCy = reduce ? 0 : Math.sin((telemetry.distance || 0) * 0.04) * 0.22;
      this.compassGroup.rotation.x += (targetCx - this.compassGroup.rotation.x) * 0.12;
      this.compassGroup.rotation.y += (targetCy - this.compassGroup.rotation.y) * 0.12;
      this.compassGroup.rotation.z = -pitchRad * 0.5;
    }

    if (this.drivetrainGroup) {
      this.drivetrainGroup.rotation.x = 0.22;
      this.drivetrainGroup.rotation.y = -0.38;
      this.drivetrainGroup.rotation.z = reduce ? 0 : b(-pitchRad * 0.65, -0.6, 0.6);
      const spinStep = (telemetry.wheelSpin || 0) * (dt / 1000) * 4.8;
      for (const wMesh of this.wheelMeshes) {
        wMesh.rotation.z -= spinStep;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  reset() {
    if (this.speedoGroup) this.speedoGroup.rotation.set(0, 0, 0);
    if (this.compassGroup) this.compassGroup.rotation.set(0, 0, 0);
    if (this.drivetrainGroup) this.drivetrainGroup.rotation.set(0.22, -0.38, 0);
  }
}

// 4. HUDAnimations — Safe Named Timeline Manager & Global Motion System (Sections 18, 19, 23)
class HUDAnimations {
  hasGSAP = false;
  lenis = null;
  relicLottie = null;
  timelines = new Map();

  init() {
    this.hasGSAP = typeof window.gsap !== "undefined";
    this.initLenis();
    this.initLottie();
  }

  createTimeline(name, vars = {}) {
    this.killTimeline(name);
    if (!this.hasGSAP) return null;
    const tl = window.gsap.timeline(vars);
    this.timelines.set(name, tl);
    return tl;
  }

  killTimeline(name) {
    const existing = this.timelines.get(name);
    if (existing) {
      existing.kill();
      this.timelines.delete(name);
    }
  }

  killAllTimelines() {
    for (const [, tl] of this.timelines) {
      tl.kill();
    }
    this.timelines.clear();
  }

  initLenis() {
    if (typeof window.Lenis === "undefined") return;
    try {
      const garageCard = document.querySelector("#garage-screen .card");
      if (garageCard) {
        this.lenis = new window.Lenis({
          wrapper: garageCard,
          content: garageCard,
          duration: 0.9,
          smoothWheel: true,
        });
      }
    } catch (e) {}
  }

  initLottie() {
    if (typeof window.lottie === "undefined") return;
    const container = document.getElementById("hud-lottie-relic");
    if (!container) return;
    try {
      container.innerHTML = "";
      const lottieData = {
        v: "5.7.4",
        fr: 60,
        ip: 0,
        op: 90,
        w: 32,
        h: 32,
        nm: "EchoPulse",
        ddd: 0,
        assets: [],
        layers: [
          {
            ddd: 0,
            ind: 1,
            ty: 4,
            nm: "Ring",
            sr: 1,
            ks: {
              o: {
                a: 1,
                k: [
                  { t: 0, s: [95] },
                  { t: 45, s: [25] },
                  { t: 90, s: [95] },
                ],
              },
              r: { a: 0, k: 0 },
              p: { a: 0, k: [16, 16, 0] },
              a: { a: 0, k: [0, 0, 0] },
              s: {
                a: 1,
                k: [
                  { t: 0, s: [70, 70, 100] },
                  { t: 45, s: [115, 115, 100] },
                  { t: 90, s: [70, 70, 100] },
                ],
              },
            },
            ao: 0,
            shapes: [
              {
                ty: "gr",
                it: [
                  {
                    d: 1,
                    ty: "el",
                    s: { a: 0, k: [18, 18] },
                    p: { a: 0, k: [0, 0] },
                  },
                  {
                    ty: "st",
                    c: { a: 0, k: [0.831, 0.384, 0.165, 1] },
                    o: { a: 0, k: 100 },
                    w: { a: 0, k: 2.2 },
                  },
                  {
                    ty: "tr",
                    p: { a: 0, k: [0, 0] },
                    a: { a: 0, k: [0, 0] },
                    s: { a: 0, k: [100, 100] },
                    r: { a: 0, k: 0 },
                    o: { a: 0, k: 100 },
                  },
                ],
              },
            ],
            ip: 0,
            op: 90,
            st: 0,
          },
        ],
      };
      this.relicLottie = window.lottie.loadAnimation({
        container,
        renderer: "svg",
        loop: true,
        autoplay: false,
        animationData: lottieData,
      });
    } catch (e) {}
  }

  // Distinct Instrument-Specific Boot Sequence (Never uses generic identical fades)
  animateHUDIntro(hudManager) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const tl = this.createTimeline("hudBoot", { defaults: { ease: "power3.out" } });
    if (!tl) return;

    tl.fromTo(
      "#hud-emblem-svg",
      { opacity: 0, scale: 0.94 },
      { opacity: 1, scale: 1, duration: 0.38 },
      0
    )
      .fromTo(
        "#hud-brand-rule",
        { scaleX: 0 },
        { scaleX: 1, duration: 0.48, ease: "expo.out" },
        0.06
      )
      .fromTo(
        "#hud-brand-title, .hud-brand-sub",
        { opacity: 0, x: -6 },
        { opacity: 1, x: 0, duration: 0.36, stagger: 0.05 },
        0.1
      )
      .fromTo(
        "#hud-telemetry-block",
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: 0.42 },
        0.14
      )
      .fromTo(
        "#hud-top-center",
        { opacity: 0, y: -6 },
        { opacity: 1, y: 0, duration: 0.42 },
        0.16
      )
      .fromTo(
        "#hud-top-right",
        { opacity: 0, x: 8 },
        { opacity: 1, x: 0, duration: 0.42 },
        0.18
      )
      .fromTo(
        "#hud-right-column, #hud-vehicle-status",
        { opacity: 0, x: 6 },
        { opacity: 1, x: 0, duration: 0.42, stagger: 0.05 },
        0.2
      )
      .fromTo(
        "#hud-gauges-cluster, #pedals",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.46 },
        0.12
      );

    // Mechanical Needle Calibration Sweep (Speedometer = heavy inertia; RPM = snappy)
    if (hudManager?.speedometer && hudManager?.rpmGauge) {
      const cal = { sweep: 0 };
      const calTl = this.createTimeline("needleCal");
      calTl?.to(cal, {
        sweep: 1,
        duration: 0.32,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
        onUpdate: () => {
          hudManager.speedometer.calibrationOffset = cal.sweep * 54;
          hudManager.rpmGauge.calibrationOffset = cal.sweep * 42;
        },
        onComplete: () => {
          hudManager.speedometer.calibrationOffset = 0;
          hudManager.rpmGauge.calibrationOffset = 0;
        },
      });
    }
  }

  animateStunt(stuntData) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const tl = this.createTimeline("stuntPulse");
    tl?.fromTo(
      "#hud-right-labels",
      { x: 5, opacity: 0.65 },
      { x: 0, opacity: 1, duration: 0.22, ease: "power2.out" },
      0
    ).fromTo(
      "#hud-stunt-bar-top",
      { filter: "brightness(1.5)" },
      { filter: "brightness(1.0)", duration: 0.28, ease: "power2.out" },
      0
    );
  }

  animateLanding(compression = 0.5) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const dip = Math.min(4.8, Math.max(1.4, compression * 4.8));
    const tl = this.createTimeline("landingCompress");
    tl?.fromTo(
      "#hud-gauges-cluster",
      { y: dip },
      { y: 0, duration: 0.26, ease: "back.out(2.2)" },
      0
    )
      .fromTo(
        "#hud-right-column",
        { y: dip * 1.1 },
        { y: 0, duration: 0.28, ease: "back.out(2.0)" },
        0
      )
      .fromTo(
        "#hud-stunt-pulse-ring",
        { attr: { r: 14 }, opacity: 0.9 },
        { attr: { r: 22 }, opacity: 0, duration: 0.38, ease: "power2.out" },
        0
      );
  }

  animateCrash(severity = "heavy") {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const mag = severity === "critical" ? 5.5 : 2.8;
    const tl = this.createTimeline("crashJolt");
    tl?.fromTo(
      "#hud-gauges-cluster",
      { x: -mag },
      { x: 0, duration: 0.24, ease: "elastic.out(1.1, 0.32)" },
      0
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
      const tl = this.createTimeline("sectorChange");
      tl?.fromTo(
        "#hud-sector-label, #hud-route-sector-tag",
        { color: "#d4622a" },
        { color: "rgba(239, 231, 214, 0.85)", duration: 0.75, ease: "power2.out" },
        0
      ).fromTo(
        "#hud-route-beacon",
        { scale: 1.6 },
        { scale: 1.0, duration: 0.42, ease: "back.out(2)" },
        0
      );
    }
  }

  // Section 10: Archival Field-Notebook Echo Discovery Annotation
  animateEchoCollected(relic, collectedCount = 1, totalCount = 6) {
    const lottieEl = document.getElementById("hud-lottie-relic");
    if (lottieEl) {
      lottieEl.style.opacity = "1";
      if (this.relicLottie) {
        this.relicLottie.goToAndPlay(0, true);
      }
    }

    const annoCard = document.getElementById("hud-echo-annotation");
    const annoCounter = document.getElementById("hud-echo-anno-counter");
    const annoName = document.getElementById("hud-echo-anno-name");
    if (annoCounter) {
      annoCounter.textContent = `ARCHIVAL LOG // ECHO 0${collectedCount} / 0${totalCount}`;
    }
    if (annoName && relic?.name) {
      annoName.textContent = relic.name.toUpperCase();
    }
    if (annoCard) {
      annoCard.style.display = "flex";
      if (this.hasGSAP && !x.visual.reducedMotion) {
        const tl = this.createTimeline("echoDiscovery");
        tl?.fromTo(
          annoCard,
          { opacity: 0, x: -6 },
          { opacity: 1, x: 0, duration: 0.26, ease: "power3.out" },
          0
        )
          .fromTo(
            "#hud-echo-anno-line",
            { scaleX: 0 },
            { scaleX: 1, duration: 0.42, ease: "expo.out" },
            0.06
          )
          .to(
            annoCard,
            {
              opacity: 0,
              duration: 0.28,
              ease: "power2.in",
              onComplete: () => {
                annoCard.style.display = "none";
              },
            },
            2.1
          );
      } else {
        setTimeout(() => {
          annoCard.style.display = "none";
        }, 2200);
      }
    }
  }

  animateVehicleChange(archetypeName) {
    if (!this.hasGSAP || x.visual.reducedMotion) return;
    const tl = this.createTimeline("vehicleChange");
    tl?.fromTo(
      "#hud-vehicle, #hud-vehicle-status",
      { opacity: 0.45 },
      { opacity: 1, duration: 0.22, ease: "power2.out" }
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
        const tl = this.createTimeline("deathBanner");
        tl?.fromTo(
          banner,
          { opacity: 0, scale: 0.96 },
          { opacity: 1, scale: 1, duration: 0.22, ease: "power3.out" }
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
      const tl = this.createTimeline("pauseCard");
      tl?.fromTo(
        "#pause .card",
        { opacity: 0, y: 10, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power3.out" }
      );
    }
  }
}

// 5. HUDTelemetry — Geological Altimeter (Sec 6), Spirit-Level Inclinometer (Sec 7), Odometer Distance & Score (Sec 16-17)
class HUDTelemetry {
  els = {};
  cache = {};
  inclinePos = 0;
  inclineVel = 0;

  init() {
    this.els = {
      dist: document.getElementById("hud-dist"),
      speed: document.getElementById("hud-speed"),
      alt: document.getElementById("hud-alt"),
      incline: document.getElementById("hud-incline"),
      inclineBubble: document.getElementById("hud-incline-bubble"),
      inclineBar: document.getElementById("hud-incline-bar"),
      altTape: document.getElementById("hud-alt-tape"),
      altPointer: document.getElementById("hud-alt-pointer"),
      echoes: document.getElementById("hud-echoes"),
      zone: document.getElementById("hud-zone"),
      score: document.getElementById("hud-score"),
      vehicle: document.getElementById("hud-vehicle"),
      rpmBar: document.getElementById("hud-rpm"),
      air: document.getElementById("hud-air"),
      combo: document.getElementById("hud-combo"),
      leftIndicator: document.getElementById("hud-left-indicator"),
    };
    this.cache = {};
    this.inclinePos = 0;
    this.inclineVel = 0;
  }

  setText(key, val, odometerStep = false) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    const el = this.els[key];
    if (!el) return;
    el.textContent = val;
    if (odometerStep && !x.visual.reducedMotion) {
      el.classList.add("odo-step");
      setTimeout(() => el.classList.remove("odo-step"), 95);
    }
  }

  // Section 6: Vertical Geological Surveying Altimeter ("Climbing is accumulation")
  updateGeologicalAltimeter(alt, dist, speed) {
    const normAlt = b((alt || 0) / 140, 0, 0.75);
    const normSpeed = b((speed || 0) / 130, 0.16, 0.36);
    if (this.els.leftIndicator) {
      this.els.leftIndicator.style.bottom = `${Math.round(8 + normAlt * 64)}%`;
      this.els.leftIndicator.style.height = `${Math.round(normSpeed * 100)}%`;
    }
    // Strata tape moves downward as player climbs upward through mountain layers
    if (this.els.altTape) {
      const strataOffset = ((alt || 0) * 1.8) % 30;
      this.els.altTape.setAttribute("transform", `translate(0, ${strataOffset.toFixed(1)})`);
    }
    if (this.els.altPointer) {
      const py = 136 - normAlt * 110;
      this.els.altPointer.setAttribute(
        "points",
        `12,${py.toFixed(1)} 6,${(py - 2.8).toFixed(1)} 6,${(py + 2.8).toFixed(1)}`
      );
    }
  }

  // Section 7: Miniature Mechanical Spirit-Level / Inclinometer ("Balance")
  updateSpiritLevelInclinometer(inclineDeg, dt = 16.666) {
    const dtSec = Math.min(0.05, Math.max(0.004, dt / 1000));
    const targetOffset = b((inclineDeg || 0) * 0.38, -14, 14);
    const k = 65.0;
    const c = 8.2;
    const acc = k * (targetOffset - this.inclinePos) - c * this.inclineVel;
    this.inclineVel += acc * dtSec;
    this.inclinePos = b(this.inclinePos + this.inclineVel * dtSec, -15, 15);

    if (this.els.inclineBubble) {
      const cx = 23 + this.inclinePos;
      this.els.inclineBubble.setAttribute("cx", cx.toFixed(2));
      this.els.inclineBubble.setAttribute(
        "fill",
        Math.abs(inclineDeg) > 32 ? "#e25822" : "#d4622a"
      );
    }
    if (this.els.inclineBar) {
      const tilt = b(inclineDeg * 0.35, -18, 18);
      this.els.inclineBar.setAttribute("transform", `rotate(${tilt.toFixed(1)} 23 6.5)`);
    }
  }

  update(data, dt = 16.666) {
    const distVal = `${Math.round(data.distance || 0)} m`;
    const speedVal = `${Math.round(data.speed || 0)} km/h`;
    const altVal = `${Math.max(1, Math.round(data.altitude || 1))} m`;
    const incVal = `${Math.round(data.incline || 0)}°`;
    const echoVal = `${data.echoCount ?? 0}/${data.echoTotal ?? 6}`;
    const zoneVal = (data.biomeName || "ALPINE MEADOW").toUpperCase();
    const scoreVal = String(Math.round(data.score || 0));
    const vehVal = (data.vehicleName || "TRAIL BUGGY").toUpperCase();

    this.setText("dist", distVal, true);
    this.setText("speed", speedVal, false);
    this.setText("alt", altVal, true);
    this.setText("incline", incVal, false);
    this.setText("echoes", echoVal, false);
    this.setText("zone", zoneVal, false);
    this.setText("score", scoreVal, true);
    this.setText("vehicle", vehVal, false);

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

    this.updateGeologicalAltimeter(data.altitude, data.distance, data.speed);
    this.updateSpiritLevelInclinometer(data.incline, dt);
  }

  reset() {
    this.cache = {};
    this.inclinePos = 0;
    this.inclineVel = 0;
  }
  resize() {}
  destroy() {}
}

// 6. Speedometer — 10-Layer Mechanical Momentum Instrument (Section 3: "Momentum has weight")
class Speedometer {
  needleEl = null;
  shadowEl = null;
  pivotEl = null;
  arcEl = null;
  bigNumEl = null;
  orangeZoneEl = null;
  currentSpeed = 0;
  speedVel = 0;
  lastTargetSpeed = 0;
  calibrationOffset = 0;
  lastDisplayedInt = -1;
  frozen = false;

  init() {
    this.needleEl = document.getElementById("hud-speed-needle");
    this.shadowEl = document.getElementById("hud-speed-needle-shadow");
    this.pivotEl = document.getElementById("hud-speed-pivot");
    this.arcEl = document.getElementById("hud-speed-arc");
    this.bigNumEl = document.getElementById("hud-speed-big");
    this.orangeZoneEl = document.getElementById("hud-speed-orange-zone");
  }

  stepPhysics(targetSpeed, dt = 16.666) {
    if (this.frozen) return;
    const dtSec = Math.min(0.05, Math.max(0.004, dt / 1000));
    const rawSpeed = Number.isFinite(targetSpeed) ? Math.max(0, targetSpeed) : 0;
    const target = rawSpeed + this.calibrationOffset;

    // Asymmetric mechanical inertia: acceleration lag + slight overshoot, braking drag, settling at 0
    const isAccelerating = target > this.currentSpeed;
    const k = isAccelerating ? 72.0 : 58.0;
    const c = isAccelerating ? 11.2 : 13.8;
    const force = k * (target - this.currentSpeed) - c * this.speedVel;
    this.speedVel += force * dtSec;
    this.currentSpeed = Math.max(0, this.currentSpeed + this.speedVel * dtSec);
    this.lastTargetSpeed = rawSpeed;

    const maxSpeed = 135;
    const ratio = b(this.currentSpeed / maxSpeed, 0, 1);

    // High-speed mechanical vibration above 80 km/h
    const tremor =
      ratio > 0.58 && !x.visual.reducedMotion
        ? Math.sin(performance.now() * 0.055) * (ratio - 0.58) * 2.5
        : 0;

    // 240-degree sweep from -120 deg to +120 deg
    const visualRatio = Math.max(0.28, ratio);
    const angle = -120 + visualRatio * 240 + tremor;
    const rotStr = `${angle.toFixed(2)} 100 100`;

    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${rotStr})`);
    }
    if (this.shadowEl) {
      this.shadowEl.setAttribute("transform", `translate(2.2, 2.8) rotate(${rotStr})`);
    }
    if (this.pivotEl) {
      const pivotAngle = angle * 0.18;
      this.pivotEl.setAttribute("transform", `rotate(${pivotAngle.toFixed(1)} 100 100)`);
    }

    if (this.arcEl) {
      const offset = 335 * (1 - visualRatio);
      this.arcEl.setAttribute("stroke-dashoffset", offset.toFixed(1));
    }

    // Material contrast on high-speed orange sector (no cheap glow)
    if (this.orangeZoneEl) {
      const highContrast = ratio > 0.6 ? 1.0 : 0.86;
      const strokeW = ratio > 0.6 ? "5.1" : "4.5";
      this.orangeZoneEl.setAttribute("opacity", String(highContrast));
      this.orangeZoneEl.setAttribute("stroke-width", strokeW);
    }

    // Digital readout reacts faster than needle to create perceived physical mass
    const displayInt = Math.round(rawSpeed);
    if (displayInt !== this.lastDisplayedInt && this.bigNumEl) {
      this.lastDisplayedInt = displayInt;
      this.bigNumEl.textContent = String(displayInt);
    }
  }

  update(data, dt) {
    this.stepPhysics(data.speed || 0, dt);
  }

  reset() {
    this.frozen = false;
    this.currentSpeed = 0;
    this.speedVel = 0;
    this.calibrationOffset = 0;
    this.lastDisplayedInt = -1;
    this.stepPhysics(0, 16.666);
  }
  resize() {}
  destroy() {}
}

// 7. RPMGauge — Mechanical Stress & Engine Vibration Instrument (Section 4: "Engine vibration")
class RPMGauge {
  needleEl = null;
  shadowEl = null;
  arcEl = null;
  redlineEl = null;
  readoutEl = null;
  currentVal = 0.22;
  rpmVel = 0;
  calibrationOffset = 0;
  frozen = false;

  init() {
    this.needleEl = document.getElementById("hud-rpm-needle");
    this.shadowEl = document.getElementById("hud-rpm-needle-shadow");
    this.arcEl = document.getElementById("hud-rpm-arc");
    this.redlineEl = document.getElementById("hud-rpm-redline");
    this.readoutEl = document.getElementById("hud-rpm-readout");
  }

  stepPhysics(rpm = 0, temp = 0.28, dt = 16.666) {
    if (this.frozen) return;
    const dtSec = Math.min(0.05, Math.max(0.004, dt / 1000));
    const safeRpm = Number.isFinite(rpm) ? b(rpm, 0, 1) : 0;
    const safeTemp = Number.isFinite(temp) ? b(temp, 0.2, 1) : 0.28;
    const blended = b(safeRpm * 0.72 + safeTemp * 0.28 + this.calibrationOffset * 0.015, 0.14, 1.0);

    // High-stiffness mechanical response (much snappier than Speedometer)
    const k = 210.0;
    const c = 18.5;
    const force = k * (blended - this.currentVal) - c * this.rpmVel;
    this.rpmVel += force * dtSec;
    this.currentVal = b(this.currentVal + this.rpmVel * dtSec, 0.1, 1.0);

    const now = performance.now();
    // Idle breathing vs High-RPM microscopic engine vibration
    let vibration = 0;
    if (!x.visual.reducedMotion) {
      if (safeRpm < 0.12) {
        vibration = Math.sin(now * 0.018) * 0.95; // Gentle engine idle breathing
      } else if (safeRpm > 0.72) {
        vibration = Math.sin(now * 0.115) * (safeRpm - 0.65) * 6.5; // High-frequency redline chatter
      } else {
        vibration = Math.sin(now * 0.045) * safeRpm * 0.8;
      }
    }

    const angle = -78 + this.currentVal * 156 + vibration;
    const rotStr = `${angle.toFixed(1)} 55 62`;
    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${rotStr})`);
    }
    if (this.shadowEl) {
      this.shadowEl.setAttribute("transform", `translate(1.4, 1.8) rotate(${rotStr})`);
    }
    if (this.arcEl) {
      const offset = 132 * (1 - this.currentVal * 0.82);
      this.arcEl.setAttribute("stroke-dashoffset", offset.toFixed(1));
      this.arcEl.setAttribute("stroke", safeRpm > 0.8 ? "#d4622a" : "rgba(239,231,214,0.34)");
    }
    if (this.redlineEl) {
      this.redlineEl.setAttribute("stroke-width", safeRpm > 0.78 ? "4.0" : "3.2");
    }
    if (this.readoutEl) {
      const rpmThousands = (0.8 + safeRpm * 6.4).toFixed(1);
      this.readoutEl.textContent = `${rpmThousands}k RPM`;
      this.readoutEl.setAttribute("opacity", safeRpm > 0.72 ? "0.78" : "0");
    }
  }

  update(data, dt) {
    this.stepPhysics(data.rpm || 0, data.engineTemp ?? 0.28, dt);
  }

  reset() {
    this.frozen = false;
    this.currentVal = 0.22;
    this.rpmVel = 0;
    this.calibrationOffset = 0;
    this.stepPhysics(0, 0.24, 16.666);
  }
  resize() {}
  destroy() {}
}

// 8. FuelGauge — Deliberate Fluid-Damped Expedition Resource Instrument (Section 15)
class FuelGauge {
  needleEl = null;
  shadowEl = null;
  arcEl = null;
  lowEl = null;
  currentFuel = 1.0;

  init() {
    this.needleEl = document.getElementById("hud-fuel-needle");
    this.shadowEl = document.getElementById("hud-fuel-needle-shadow");
    this.arcEl = document.getElementById("hud-fuel-arc");
    this.lowEl = document.getElementById("hud-fuel-low");
  }

  update(data, dt = 16.666) {
    const target = b(data.fuel ?? 0.95, 0.05, 1.0);
    // Slow, heavily damped fluid movement
    this.currentFuel = G0(this.currentFuel, target, 4.5, dt);

    const arcSpan = 0.08 + this.currentFuel * 0.42;
    const angle = -76 + arcSpan * 152;
    const rotStr = `${angle.toFixed(1)} 55 62`;
    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${rotStr})`);
    }
    if (this.shadowEl) {
      this.shadowEl.setAttribute("transform", `translate(1.4, 1.8) rotate(${rotStr})`);
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

  reset() {
    this.currentFuel = 1.0;
    this.update({ fuel: 1.0 }, 16.666);
  }
  resize() {}
  destroy() {}
}

// 9. Compass — 3D Gimbal & Inertial Magnetic Needle Instrument (Section 5: "Orientation through uncertainty")
class Compass {
  cardEl = null;
  needleEl = null;
  shadowEl = null;
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
    this.cardEl = document.getElementById("hud-compass-card");
    this.needleEl = document.getElementById("hud-compass-needle");
    this.shadowEl = document.getElementById("hud-compass-needle-shadow");
    this.timeEl = document.getElementById("hud-time-val");
    this.ampmEl = document.getElementById("hud-time-ampm");
    this.tempEl = document.getElementById("hud-temp-val");
    this.weatherEl = document.getElementById("hud-weather-label");
  }

  update(data, dt = 16.666) {
    const dtSec = Math.min(0.05, Math.max(0.004, dt / 1000));
    const shakeJitter = (window.game?.camera?.shakeIntensity || 0) * (Math.random() - 0.5) * 28;
    const targetDeg = b(
      (data.incline || 0) * 1.45 + Math.sin((data.distance || 0) * 0.03) * 12 + shakeJitter,
      -68,
      68
    );

    // Underdamped magnetic needle spring: rotational inertia, subtle overshoot, calm when stationary
    const k = 36.0;
    const c = 5.4;
    const acc = k * (targetDeg - this.currentAngle) - c * this.angleVel;
    this.angleVel += acc * dtSec;
    this.currentAngle += this.angleVel * dtSec;

    const rotStr = `${this.currentAngle.toFixed(2)} 32 32`;
    if (this.needleEl) {
      this.needleEl.setAttribute("transform", `rotate(${rotStr})`);
    }
    if (this.shadowEl) {
      this.shadowEl.setAttribute("transform", `translate(1.2, 1.8) rotate(${rotStr})`);
    }
    // Subtle 3D gimbal tilt on the compass card while outer housing remains fixed
    if (this.cardEl && !x.visual.reducedMotion) {
      const rx = b((data.incline || 0) * 0.35, -14, 14);
      const ry = b((data.speed || 0) * 0.08, -8, 8);
      this.cardEl.style.transform = `rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
    }

    // Authoritative WorldState Clock, Temperature & Weather (Living World Simulation 2.0)
    const ws = window.game?.worldSim?.state;
    const totalMin = ws ? Math.floor(ws.timeMinutes) : (6 * 60 + 24 + Math.floor((data.distance || 0) / 18 + (window.game?.time || 0) / 15000));
    const hrs24 = Math.floor(totalMin / 60) % 24;
    const mins = totalMin % 60;
    const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;
    const timeStr = `${String(hrs12).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    if (timeStr !== this.lastTimeStr && this.timeEl) {
      this.lastTimeStr = timeStr;
      this.timeEl.textContent = timeStr;
      if (this.ampmEl) this.ampmEl.textContent = hrs24 >= 12 ? "PM" : "AM";
    }

    // Altitude + Time + Season + Weather Temperature
    const tempC = ws ? Math.round(ws.temperature) : Math.round(12 - (data.altitude || 0) * 0.22);
    const tempStr = `${tempC}°C`;
    if (tempStr !== this.lastTempStr && this.tempEl) {
      this.lastTempStr = tempStr;
      this.tempEl.textContent = tempStr;
    }

    // Live WorldState Weather & Season Condition
    let wStr = "CLEAR";
    if (ws) {
      wStr = ws.weather.replace("_", " ");
    } else {
      const zone = (data.biomeName || "").toLowerCase();
      if (zone.includes("crag")) wStr = "RIDGE WIND";
      else if (zone.includes("canyon")) wStr = "GORGE MIST";
      else if (zone.includes("iron") || zone.includes("works")) wStr = "ASH HAZE";
      else if (zone.includes("summit") || zone.includes("frozen")) wStr = "GLACIER SNOW";
    }

    if (wStr !== this.lastWeatherStr && this.weatherEl) {
      this.lastWeatherStr = wStr;
      this.weatherEl.textContent = wStr;
    }
  }

  reset() {
    this.currentAngle = 0;
    this.angleVel = 0;
    if (this.needleEl) this.needleEl.setAttribute("transform", "rotate(0 32 32)");
    if (this.shadowEl) this.shadowEl.setAttribute("transform", "translate(1.2, 1.8) rotate(0 32 32)");
  }
  resize() {}
  destroy() {}
}

// 10. ExpeditionRouteAndScanner — Surveyed Route (Sec 9) & Signature Living Geological Profile (Sec 8)
class ExpeditionRouteAndScanner {
  progressEl = null;
  beaconEl = null;
  scannerPastEl = null;
  scannerLineEl = null;
  scannerStrataEl = null;
  scannerCarEl = null;
  scannerReticleEl = null;
  scannerCalloutEl = null;
  routeNodes = [];
  discoveredNodes = new Set();
  scanTimer = 0;

  // Waypoints along the 400x28 SVG surveyed route path
  routePoints = [
    { x: 8, y: 21 },
    { x: 55, y: 18 },
    { x: 82, y: 13 },
    { x: 135, y: 16 },
    { x: 154, y: 15 },
    { x: 185, y: 10 },
    { x: 228, y: 9 },
    { x: 285, y: 6 },
    { x: 308, y: 11 },
    { x: 350, y: 8 },
    { x: 392, y: 3 },
  ];

  init() {
    this.progressEl = document.getElementById("hud-route-progress");
    this.beaconEl = document.getElementById("hud-route-beacon");
    this.scannerPastEl = document.getElementById("hud-scanner-past");
    this.scannerLineEl = document.getElementById("hud-scanner-line");
    this.scannerStrataEl = document.getElementById("hud-scanner-strata");
    this.scannerCarEl = document.getElementById("hud-scanner-car");
    this.scannerReticleEl = document.getElementById("hud-scanner-reticle");
    this.scannerCalloutEl = document.getElementById("hud-scanner-callout");
    this.routeNodes = Array.from(document.querySelectorAll("#hud-route-nodes .route-node"));
    this.discoveredNodes.clear();
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
      const dashOffset = 410 * (1 - prog);
      this.progressEl.setAttribute("stroke-dashoffset", dashOffset.toFixed(1));
    }
    if (this.beaconEl) {
      const pt = this.pointAtProgress(prog);
      this.beaconEl.setAttribute("transform", `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
    }

    // Unfold survey nodes as the vehicle discovers them along the expedition route
    const nodeThresholds = [0.0, 0.18, 0.36, 0.56, 0.76, 0.96];
    for (let i = 0; i < this.routeNodes.length; i++) {
      if (prog >= nodeThresholds[i] && !this.discoveredNodes.has(i)) {
        this.discoveredNodes.add(i);
        const ring = this.routeNodes[i].querySelector(".node-ring");
        if (ring) {
          ring.setAttribute("opacity", "0.75");
        }
      }
    }

    // Section 8: Signature Living Geological Terrain Scanner (sampled at 20Hz)
    this.scanTimer += dt;
    if (this.scanTimer >= 45 && window.game?.terrain && window.game?.vehicle) {
      this.scanTimer = 0;
      const terrain = window.game.terrain;
      const carX = window.game.vehicle.chassis.position.x;
      const baseH = terrain.heightAt(carX);

      let pastPath = "";
      let aheadPath = "";
      let strataPath = "";

      const totalSamples = 30;
      const carSampleIdx = 5; // Fixed vehicle fiducial at x = 64 (5/30 * 360 = 60..64)
      let maxClimbSlope = 0;
      let maxDropSlope = 0;
      let featureX = 180;
      let featureY = 16;
      let hasJumpCrest = false;

      for (let i = 0; i <= totalSamples; i++) {
        const u = i / totalSamples;
        const wx = carX - 240 + u * 1440; // -6m behind to +30m ahead
        const wy = terrain.heightAt(wx);
        const slope = terrain.slopeAt(wx);
        const sx = (u * 360).toFixed(1);
        const syVal = b(16 + (wy - baseH) * 0.042, 2.5, 25.5);
        const sy = syVal.toFixed(1);

        if (i <= carSampleIdx) {
          pastPath += i === 0 ? `M ${sx},${sy}` : ` L ${sx},${sy}`;
          if (i === carSampleIdx) {
            aheadPath = `M ${sx},${sy}`;
            if (this.scannerCarEl) {
              this.scannerCarEl.setAttribute("cx", sx);
              this.scannerCarEl.setAttribute("cy", sy);
            }
          }
        } else {
          // Detect sharp crest / jump separation
          const prevWx = carX - 240 + ((i - 1) / totalSamples) * 1440;
          const prevSlope = terrain.slopeAt(prevWx);
          if (prevSlope < -0.28 && slope > 0.22) {
            hasJumpCrest = true;
            aheadPath += ` M ${sx},${sy}`; // Visual gap separation for major jump crest!
            featureX = parseFloat(sx);
            featureY = syVal;
          } else {
            aheadPath += ` L ${sx},${sy}`;
          }

          if (i % 2 === 0) {
            strataPath += `M ${sx},${sy} L ${sx},${Math.min(25.5, syVal + 4.5).toFixed(1)} `;
          }

          if (slope < maxClimbSlope) {
            maxClimbSlope = slope;
            if (!hasJumpCrest) {
              featureX = parseFloat(sx);
              featureY = syVal;
            }
          }
          if (slope > maxDropSlope) {
            maxDropSlope = slope;
            if (!hasJumpCrest && maxDropSlope > Math.abs(maxClimbSlope)) {
              featureX = parseFloat(sx);
              featureY = syVal;
            }
          }
        }
      }

      if (this.scannerPastEl) this.scannerPastEl.setAttribute("d", pastPath);
      if (this.scannerStrataEl) this.scannerStrataEl.setAttribute("d", strataPath);

      // Classify upcoming geological feature using both slope profile and segment metadata (Section 44 & 45)
      const upcomingSeg = terrain.segmentAt ? terrain.segmentAt(carX + 480) : null;
      let callout = "TERRAIN // NOMINAL";
      let isHazard = false;
      if (prog > 0.88) {
        callout = "SUMMIT APPROACH";
        isHazard = true;
      } else if (hasJumpCrest) {
        callout = "JUMP CREST // GAP";
        isHazard = true;
      } else if (maxClimbSlope < -0.46) {
        callout = "STEEP CLIMB";
        isHazard = true;
      } else if (maxDropSlope > 0.46) {
        callout = "DANGEROUS DESCENT";
        isHazard = true;
      } else if (maxClimbSlope < -0.26) {
        callout = "UPCOMING RIDGE";
      } else if (maxDropSlope > 0.26) {
        callout = "DEPRESSION";
      } else if (upcomingSeg?.signature) {
        callout = upcomingSeg.signature;
        isHazard = true;
      }

      if (this.scannerLineEl) {
        this.scannerLineEl.setAttribute("d", aheadPath);
        this.scannerLineEl.setAttribute(
          "stroke",
          isHazard ? "#d4622a" : "rgba(239,231,214,0.64)"
        );
      }
      if (this.scannerReticleEl) {
        this.scannerReticleEl.setAttribute(
          "transform",
          `translate(${featureX.toFixed(1)}, ${featureY.toFixed(1)})`
        );
        this.scannerReticleEl.setAttribute("opacity", isHazard ? "0.9" : "0");
      }
      if (this.scannerCalloutEl) {
        this.scannerCalloutEl.textContent = callout;
        this.scannerCalloutEl.style.color = isHazard
          ? "#d4622a"
          : "rgba(239, 231, 214, 0.68)";
      }
    }
  }

  reset() {
    this.discoveredNodes.clear();
    for (const node of this.routeNodes) {
      const ring = node.querySelector(".node-ring");
      if (ring) ring.setAttribute("opacity", "0");
    }
    if (this.progressEl) this.progressEl.setAttribute("stroke-dashoffset", "410");
    if (this.beaconEl) this.beaconEl.setAttribute("transform", "translate(8, 21)");
  }
  resize() {}
  destroy() {}
}

// 11. StuntGauge — Radial Angular Momentum Gyro (Sec 11) & Suspended Airtime Chronometer (Sec 12)
class StuntGauge {
  topBarEl = null;
  midBarEl = null;
  chronoEl = null;
  chronoDigitsEl = null;
  gyroSvgEl = null;
  gyroArcEl = null;
  gyroRotorEl = null;
  line1 = null;
  line2 = null;
  line3 = null;
  line4 = null;

  init() {
    this.topBarEl = document.getElementById("hud-stunt-bar-top");
    this.midBarEl = document.getElementById("hud-stunt-bar-mid");
    this.chronoEl = document.getElementById("hud-airtime-chrono");
    this.chronoDigitsEl = document.getElementById("hud-airtime-digits");
    this.gyroSvgEl = document.getElementById("hud-stunt-gyro-svg");
    this.gyroArcEl = document.getElementById("hud-stunt-gyro-arc");
    this.gyroRotorEl = document.getElementById("hud-stunt-gyro-rotor");
    this.line1 = document.getElementById("hud-right-line1");
    this.line2 = document.getElementById("hud-right-line2");
    this.line3 = document.getElementById("hud-right-line3");
    this.line4 = document.getElementById("hud-right-line4");
  }

  update(data) {
    if (!this.topBarEl) return;
    const isAir = Boolean(data.airborne);
    const airSec = (data.airtime || 0) / 1000;
    const altRatio = b((data.altitude || 0) / 110, 0.16, 0.78);
    const airRatio = isAir ? b(airSec / 2.2, 0.24, 0.92) : altRatio;

    this.topBarEl.style.height = `${Math.round(airRatio * 100)}%`;

    // Section 12: Suspended Airborne Timer ("Silence between ground contacts")
    if (this.chronoEl && this.chronoDigitsEl) {
      if (isAir && airSec > 0.08) {
        this.chronoEl.classList.add("active");
        const padded = airSec < 10 ? `0${airSec.toFixed(2)} s` : `${airSec.toFixed(2)} s`;
        this.chronoDigitsEl.textContent = padded;
        const scaleBoost = b(1 + airSec * 0.06, 1, 1.18);
        this.chronoEl.style.transform = `translateY(0) scale(${scaleBoost.toFixed(2)})`;
      } else {
        this.chronoEl.classList.remove("active");
        this.chronoEl.style.transform = "translateY(4px) scale(0.95)";
      }
    }

    // Section 11: Radial Stunt Angular Momentum Ring ("Controlled chaos")
    if (this.gyroSvgEl && this.gyroArcEl && this.gyroRotorEl) {
      this.gyroSvgEl.classList.toggle("active", isAir);
      const cumRad = data.cumulativeAirAngle || 0;
      const revFraction = b(Math.abs(cumRad) / (Math.PI * 2), 0, 1);
      const circumference = 88;
      const dashOffset = isAir ? circumference * (1 - revFraction) : circumference;
      this.gyroArcEl.setAttribute("stroke-dashoffset", dashOffset.toFixed(1));
      // Flip sweep direction for Backflip (CCW) vs Frontflip (CW)
      const flipScale = cumRad < 0 ? "scale(1, -1)" : "scale(1, 1)";
      this.gyroArcEl.setAttribute("transform", `rotate(-90 22 22) ${flipScale}`);
      this.gyroRotorEl.setAttribute("transform", `rotate(${(data.incline || 0).toFixed(1)} 22 22)`);
    }

    if (this.line1 && this.line2 && this.line3 && this.line4) {
      if (isAir && data.airtime > 140) {
        this.line1.textContent = "AIRBORNE";
        this.line1.className = "accent-orange";
        this.line2.textContent = `${airSec.toFixed(1)}S AIR`;
        this.line3.textContent = data.activeStunt || "MOMENTUM";
        this.line4.textContent =
          data.comboMultiplier > 1 ? `COMBO X${data.comboMultiplier}` : "TRAJECTORY";
      } else if (data.comboMultiplier > 1 && data.comboTimer > 0) {
        this.line1.textContent = `COMBO X${data.comboMultiplier}`;
        this.line1.className = "accent-orange";
        this.line2.textContent = data.activeStunt || "CHAIN";
        this.line3.textContent = `${data.comboTimer.toFixed(1)}S`;
        this.line4.textContent = "STORIES";
      } else {
        this.line1.textContent = "HIGHER";
        this.line1.className = "lead";
        this.line2.textContent = "TERRAIN";
        this.line3.textContent = "BIGGER";
        this.line4.textContent = "STORIES";
      }
    }
  }

  reset() {
    if (this.chronoEl) this.chronoEl.classList.remove("active");
    if (this.gyroSvgEl) this.gyroSvgEl.classList.remove("active");
    if (this.gyroArcEl) this.gyroArcEl.setAttribute("stroke-dashoffset", "88");
  }
  resize() {}
  destroy() {}
}

// 12. VehicleStatus — 4WD Technical Drivetrain & Axle Torque Visualizer (Section 14: "Power reaches the ground")
class VehicleStatus {
  modeEl = null;
  dotEl = null;
  driveshaftEl = null;
  diffEl = null;
  axleRearEl = null;
  axleFrontEl = null;
  wheelEls = [];

  init() {
    this.modeEl = document.getElementById("hud-drivetrain-mode");
    this.dotEl = document.getElementById("hud-drivetrain-dot");
    this.driveshaftEl = document.getElementById("hud-driveshaft");
    this.diffEl = document.getElementById("hud-diff-center");
    this.axleRearEl = document.getElementById("hud-axle-rear");
    this.axleFrontEl = document.getElementById("hud-axle-front");
    this.wheelEls = [
      document.getElementById("hud-wheel-rl"),
      document.getElementById("hud-wheel-rr"),
      document.getElementById("hud-wheel-fl"),
      document.getElementById("hud-wheel-fr"),
    ];
  }

  update(data) {
    const v = window.game?.vehicle;
    if (!v) return;
    const rearContact = Boolean(v.wheels?.[0]?.contact);
    const frontContact = Boolean(v.wheels?.[1]?.contact);
    const rearSlip = (v.wheels?.[0]?.slip || 0) > 1.25;
    const frontSlip = (v.wheels?.[1]?.slip || 0) > 1.25;
    const torqueActive = Math.abs(data.throttle || 0) > 0.08 || Math.abs(data.brake || 0) > 0.08;

    const rearFill = !rearContact
      ? "rgba(239,231,214,0.20)"
      : rearSlip
      ? "#d4622a"
      : "#efe7d6";
    const frontFill = !frontContact
      ? "rgba(239,231,214,0.20)"
      : frontSlip
      ? "#d4622a"
      : "#efe7d6";

    if (this.wheelEls[0]) this.wheelEls[0].setAttribute("fill", rearFill);
    if (this.wheelEls[1]) this.wheelEls[1].setAttribute("fill", rearFill);
    if (this.wheelEls[2]) this.wheelEls[2].setAttribute("fill", frontFill);
    if (this.wheelEls[3]) this.wheelEls[3].setAttribute("fill", frontFill);

    if (this.driveshaftEl) {
      this.driveshaftEl.setAttribute(
        "stroke",
        torqueActive ? "#d4622a" : "rgba(239,231,214,0.32)"
      );
    }
    if (this.diffEl) {
      this.diffEl.setAttribute(
        "stroke",
        torqueActive ? "#d4622a" : "rgba(239,231,214,0.55)"
      );
    }

    if (this.modeEl && window.game?.deathState === "normal") {
      this.modeEl.textContent = data.airborne ? "AIR" : "4WD";
      this.modeEl.style.color = data.airborne ? "#d4622a" : "";
    }
  }

  reset() {
    if (this.modeEl) {
      this.modeEl.textContent = "4WD";
      this.modeEl.style.color = "";
    }
  }
  resize() {}
  destroy() {}
}

// 13. ControlsHUD — Tactile Mechanical Pedal Controls (Section 13: "Human input")
class ControlsHUD {
  btnLeft = null;
  btnRight = null;
  unitLeft = null;
  unitRight = null;
  wasLeft = false;
  wasRight = false;

  init() {
    this.btnLeft = document.getElementById("pedal-l");
    this.btnRight = document.getElementById("pedal-r");
    this.unitLeft = document.getElementById("pedal-unit-l");
    this.unitRight = document.getElementById("pedal-unit-r");
  }

  update(input, rpm = 0) {
    if (!input) return;
    const isLeft = input.brake > 0.1;
    const isRight = input.throttle > 0.1;

    if (isLeft !== this.wasLeft && this.btnLeft) {
      this.wasLeft = isLeft;
      this.btnLeft.classList.toggle("pressed", isLeft);
      if (this.unitLeft) this.unitLeft.classList.toggle("active", isLeft);
      if (!isLeft) this.btnLeft.style.transform = "scale(1)";
    }

    if (isRight !== this.wasRight && this.btnRight) {
      this.wasRight = isRight;
      this.btnRight.classList.toggle("pressed", isRight);
      if (this.unitRight) this.unitRight.classList.toggle("active", isRight);
      if (!isRight) this.btnRight.style.transform = "scale(1)";
    }

    // Physical depression + subtle mechanical hold vibration under engine load
    if (!x.visual.reducedMotion) {
      const vib = Math.sin(performance.now() * 0.09) * (0.25 + rpm * 0.55);
      if (isLeft && this.btnLeft) {
        this.btnLeft.style.transform = `translateY(1.8px) scale(0.95) translateX(${(vib * 0.5).toFixed(2)}px)`;
      }
      if (isRight && this.btnRight) {
        this.btnRight.style.transform = `translateY(2.2px) scale(0.94) translateX(${vib.toFixed(2)}px)`;
      }
    }
  }

  reset() {
    this.wasLeft = false;
    this.wasRight = false;
    if (this.btnLeft) {
      this.btnLeft.classList.remove("pressed");
      this.btnLeft.style.transform = "scale(1)";
    }
    if (this.btnRight) {
      this.btnRight.classList.remove("pressed");
      this.btnRight.style.transform = "scale(1)";
    }
  }
  resize() {}
  destroy() {}
}

// 14. HUDManager — Master Coordinator, Authoritative Telemetry Snapshot & Multi-Rate Scheduler (Sections 24-30)
class HUDManager {
  game = null;
  stateMachine = new HUDStateMachine();
  threeInstruments = new HUDThreeInstruments();
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

  currentSector = 1;
  wasInverted = false;
  medFreqTimer = 100;
  lowFreqTimer = 300;

  // Single Authoritative HUD Telemetry Object (Section 24)
  snapshot = {
    speed: 0,
    rpm: 0,
    altitude: 1,
    incline: 0,
    distance: 0,
    fuel: 1.0,
    engineTemp: 0.24,
    score: 0,
    comboMultiplier: 1,
    comboTimer: 0,
    airtime: 0,
    pitch: 0,
    yaw: 0,
    angularVelocity: 0,
    cumulativeAirAngle: 0,
    airborne: false,
    inverted: false,
    wheelSlip: 0,
    wheelSpin: 0,
    throttle: 0,
    brake: 0,
    vehicleName: "Trail Buggy",
    biomeName: "Alpine Meadow",
    echoCount: 0,
    echoTotal: 6,
    sector: 1,
    activeStunt: "",
    isDead: false,
    isPaused: false,
    debriefVisible: false,
  };

  init(game) {
    this.game = game;
    this.stateMachine.init();
    this.threeInstruments.init();
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

    this.telemetry.update(this.snapshot, 16.666);
    this.fuelGauge.update(this.snapshot, 16.666);
    this.routeScanner.update(this.snapshot, 16.666);

    this.bindEvents();
  }

  bindEvents() {
    if (!this.game?.bus) return;

    this.game.bus.on("stunt:awarded", (data) => {
      this.stateMachine.triggerTransientState("STUNT", 900);
      this.animations.animateStunt(data);
    });

    this.game.bus.on("vehicle:land", (data) => {
      this.stateMachine.triggerTransientState("LANDING", 450);
      this.animations.animateLanding(data?.compression ?? 0.5);
    });

    this.game.bus.on("vehicle:impact", (data) => {
      if (data?.tier === "heavy" || data?.tier === "critical") {
        this.stateMachine.triggerTransientState("CRASH", 550);
        this.animations.animateCrash(data.tier);
      }
    });

    this.game.bus.on("echo:collected", (relic) => {
      this.stateMachine.triggerTransientState("ECHO_DISCOVERY", 2200);
      this.animations.animateEchoCollected(
        relic,
        this.game?.echoManager?.collectedCount ?? 1,
        this.game?.echoManager?.totalCount ?? 6
      );
    });

    this.game.bus.on("vehicle:reset", () => {
      this.reset();
    });

    this.game.bus.on("vehicle:change", (archName) => {
      this.animations.animateVehicleChange(archName);
    });
  }

  // Perfect Restart Behavior (Section 26)
  reset() {
    document.body.classList.remove("hud-crashed");
    const banner = document.getElementById("hud-death-banner");
    if (banner) banner.style.display = "none";
    const echoAnno = document.getElementById("hud-echo-annotation");
    if (echoAnno) echoAnno.style.display = "none";

    this.animations.killAllTimelines();
    this.stateMachine.reset();
    this.threeInstruments.reset();
    this.telemetry.reset();
    this.speedometer.reset();
    this.rpmGauge.reset();
    this.fuelGauge.reset();
    this.compass.reset();
    this.routeScanner.reset();
    this.stuntGauge.reset();
    this.vehicleStatus.reset();
    this.controls.reset();

    this.currentSector = 1;
    this.wasInverted = false;
    this.medFreqTimer = 100;
    this.lowFreqTimer = 300;
  }

  update(data, dt = 16.666) {
    if (!data || !this.game) return;
    const v = this.game.vehicle;

    // Populate Single Authoritative HUD Telemetry Snapshot
    this.snapshot.speed = Number.isFinite(data.speed) ? data.speed : 0;
    this.snapshot.rpm = Number.isFinite(data.rpm) ? data.rpm : 0;
    this.snapshot.altitude = Number.isFinite(data.altitude) ? data.altitude : 1;
    this.snapshot.incline = Number.isFinite(data.incline) ? data.incline : 0;
    this.snapshot.distance = Number.isFinite(data.distance) ? data.distance : 0;
    this.snapshot.fuel = Number.isFinite(data.fuel) ? data.fuel : 1.0;
    this.snapshot.engineTemp = Number.isFinite(data.engineTemp) ? data.engineTemp : 0.24;
    this.snapshot.score = Number.isFinite(data.score) ? data.score : 0;
    this.snapshot.comboMultiplier = data.comboMultiplier || 1;
    this.snapshot.comboTimer = data.comboTimer || 0;
    this.snapshot.airtime = data.airtime || 0;
    this.snapshot.pitch = v ? normalizeAngle(v.chassis.angle) : 0;
    this.snapshot.angularVelocity = v ? v.chassis.angularVelocity : 0;
    this.snapshot.cumulativeAirAngle = this.game.stunts?.cumulativeAngle || 0;
    this.snapshot.airborne = Boolean(data.airborne);
    this.snapshot.inverted =
      this.game.deathState === "crashed" || this.game.deathState === "critical";
    this.snapshot.wheelSlip = Math.max(v?.wheels?.[0]?.slip || 0, v?.wheels?.[1]?.slip || 0);
    this.snapshot.wheelSpin = v?.wheels?.[0]?.body?.angularVelocity || 0;
    this.snapshot.throttle = this.game.input?.throttle || 0;
    this.snapshot.brake = this.game.input?.brake || 0;
    this.snapshot.vehicleName = data.vehicleName || "Trail Buggy";
    this.snapshot.biomeName = data.biomeName || "Alpine Meadow";
    this.snapshot.echoCount = data.echoCount ?? 0;
    this.snapshot.echoTotal = data.echoTotal ?? 6;
    this.snapshot.activeStunt = data.activeStunt || "";
    this.snapshot.isDead = Boolean(this.game.isDead);
    this.snapshot.isPaused = !this.game.running;

    // 1. Evaluate HUD State Machine
    this.stateMachine.evaluate(this.snapshot, dt);

    // 2. HIGH FREQUENCY (60Hz every frame): Speedometer, RPM, Spirit-Level Inclinometer, Compass, Pedals, 3D Layer
    this.speedometer.update(this.snapshot, dt);
    this.rpmGauge.update(this.snapshot, dt);
    this.compass.update(this.snapshot, dt);
    this.controls.update(this.game.input, this.snapshot.rpm);
    this.threeInstruments.update(this.snapshot, dt);
    if (this.snapshot.airborne) {
      this.stuntGauge.update(this.snapshot);
    }

    // 3. MEDIUM FREQUENCY (20Hz / every 45ms): Telemetry text, Altimeter, Fuel Gauge, Route & Terrain Scanner, Stunt & Drivetrain DOM
    this.medFreqTimer += dt;
    if (this.medFreqTimer >= 45) {
      const stepDt = this.medFreqTimer;
      this.medFreqTimer = 0;
      this.telemetry.update(this.snapshot, stepDt);
      this.fuelGauge.update(this.snapshot, stepDt);
      this.routeScanner.update(this.snapshot, stepDt);
      if (!this.snapshot.airborne) {
        this.stuntGauge.update(this.snapshot);
      }
      this.vehicleStatus.update(this.snapshot);
    } else {
      // Keep spirit-level bubble at 60Hz even between text updates
      this.telemetry.updateSpiritLevelInclinometer(this.snapshot.incline, dt);
    }

    // 4. LOW FREQUENCY (5Hz / every 200ms): 7-Sector transitions, Inversion state check, Lenis scroll
    this.lowFreqTimer += dt;
    if (this.lowFreqTimer >= 180) {
      this.lowFreqTimer = 0;
      const curBiome = this.game.terrain?.getBiomeAtDist
        ? this.game.terrain.getBiomeAtDist(this.snapshot.distance)
        : null;
      const totalMeters = (x.world.length - x.world.startX) / 40;
      const sector = curBiome?.sector || Math.min(
        7,
        Math.max(1, Math.floor((this.snapshot.distance / Math.max(1, totalMeters)) * 7) + 1)
      );
      if (sector !== this.currentSector) {
        this.currentSector = sector;
        this.snapshot.sector = sector;
        this.stateMachine.triggerTransientState("SECTOR_CHANGE", 1100);
        this.animations.animateSectorChange(sector, this.snapshot.biomeName);
      }
    }

    if (this.snapshot.inverted !== this.wasInverted) {
      this.wasInverted = this.snapshot.inverted;
      this.animations.animateInversion(this.snapshot.inverted);
    }

    if (this.animations.lenis) {
      const garageEl = document.getElementById("garage-screen");
      if (garageEl && garageEl.style.display === "flex") {
        this.animations.lenis.raf(performance.now());
      }
    }
  }

  onDeath(reason) {
    this.speedometer.frozen = true;
    this.rpmGauge.frozen = true;
    this.stateMachine.evaluate({ ...this.snapshot, isDead: true }, 16.666);
    this.animations.animateDeath(reason);
  }

  resize() {
    this.threeInstruments.resize();
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

  destroy() {
    this.animations.killAllTimelines();
  }
}
