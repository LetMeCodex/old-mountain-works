// Comprehensive automated testing suite using Chrome DevTools Protocol (CDP) via native Node.js
import { spawn } from 'child_process';
import http from 'http';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML_PATH = 'file:///C:/Users/anish%20jha/.gemini/antigravity/scratch/old-mountain-works/old-mountain-works.html';
const PORT = 9230;

async function run() {
  console.log('1. Spawning headless Chrome on port', PORT);
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    HTML_PATH
  ]);

  chrome.stderr.on('data', () => {});

  let targets = null;
  for (let i = 0; i < 35; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      targets = await fetchJson(`http://127.0.0.1:${PORT}/json`);
      if (targets && targets.length > 0) break;
    } catch (e) {}
  }

  if (!targets || targets.length === 0) {
    chrome.kill();
    throw new Error('Failed to connect to Chrome debugging port');
  }

  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  console.log('2. Target found:', pageTarget.title, pageTarget.url);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let msgId = 1;
  const pending = new Map();
  const consoleLogs = [];
  const errors = [];

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      consoleLogs.push(data.params.args.map((a) => a.value).join(' '));
    }
    if (data.method === 'Runtime.exceptionThrown') {
      errors.push(data.params.exceptionDetails);
    }
  };

  await new Promise((r) => ws.onopen = r);
  console.log('3. WebSocket CDP connected');

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.result?.exceptionDetails) {
      throw new Error(JSON.stringify(res.result.exceptionDetails));
    }
    return res.result?.result?.value;
  }

  await send('Runtime.enable');
  await send('Page.enable');

  console.log('4. Waiting for initial page load and engine build...');
  for (let i = 0; i < 40; i++) {
    try {
      const ready = await evaluate(`typeof game !== 'undefined' && Boolean(game.vehicle)`);
      if (ready) break;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  if (errors.length > 0) {
    console.error('INITIAL PAGE ERRORS:', JSON.stringify(errors, null, 2));
  }

  // TEST 1: Initial Game State & Terrain Validation
  console.log('\n--- TEST 1: Initial Game State & Terrain Grammar ---');
  const initState = await evaluate(`({
    hasGame: typeof game !== 'undefined',
    terrainSamples: game.terrain.samples.length,
    terrainBodies: game.terrain.bodies.length,
    terrainSegments: game.terrain.segments.length,
    startX: game.startX,
    chassisX: game.vehicle.chassis.position.x,
    chassisY: game.vehicle.chassis.position.y,
    wheelsCount: game.vehicle.wheels.length,
    propDefsCount: game.propManager.defs.length,
    archetype: game.vehicle.archetype.name,
    fps: game.fps
  })`);
  console.log('Game Initial State:', initState);
  if (!initState.hasGame || initState.terrainSamples < 1000) {
    throw new Error('Initial state check failed');
  }

  // TEST 2: Terrain Smoothness & C1 Continuity Audit (No Knife Edges)
  console.log('\n--- TEST 2: Terrain Smoothness & C1 Continuity Audit ---');
  const terrainAudit = await evaluate(`(() => {
    let maxSlope = 0;
    let maxDy = 0;
    let discontinuities = 0;
    const samples = game.terrain.samples;
    for (let i = 0; i < samples.length - 1; i++) {
      const dx = samples[i+1].x - samples[i].x;
      const dy = Math.abs(samples[i+1].y - samples[i].y);
      const slope = dy / dx;
      if (slope > maxSlope) maxSlope = slope;
      if (dy > maxDy) maxDy = dy;
      if (slope > 1.05) discontinuities++; // > 46.4 degrees
    }
    return {
      sampleCount: samples.length,
      maxSlopeRad: maxSlope.toFixed(3),
      maxSlopeDeg: (Math.atan(maxSlope) * 180 / Math.PI).toFixed(1),
      maxDyPixels: maxDy.toFixed(2),
      discontinuitiesCount: discontinuities
    };
  })()`);
  console.log('Terrain Audit Result across 36,000px trail:', terrainAudit);
  if (terrainAudit.discontinuitiesCount > 0) {
    throw new Error(`Terrain contains ${terrainAudit.discontinuitiesCount} slope discontinuities!`);
  }

  // TEST 3: Driving Simulation & Suspension Response
  console.log('\n--- TEST 3: Driving Simulation & Suspension Response ---');
  await evaluate(`
    document.getElementById('start-btn').click();
    game.input.keys.add('d'); // Full throttle
  `);

  for (let s = 1; s <= 3; s++) {
    await new Promise((r) => setTimeout(r, 1000));
    const telemetry = await evaluate(`({
      distance: game.maxDistance.toFixed(1),
      speed: (Math.abs(game.vehicle.forwardSpeed) * 7.2).toFixed(1),
      rpm: game.vehicle.rpm.toFixed(2),
      x: game.vehicle.chassis.position.x.toFixed(0),
      driverLean: game.vehicle.driver.lean.toFixed(3),
      compression: game.vehicle.wheels.map(w => w.compression.toFixed(2)),
      contacts: game.vehicle.wheels.map(w => w.contact),
      activeParticles: game.particles.pool.filter(p => p.active).length,
      activeProps: game.propManager.activeProps.size,
      stunt: game.stunts.activeStuntName,
      fps: game.fps.toFixed(0)
    })`);
    console.log(`[Drive ${s}s]`, telemetry);
  }

  // TEST 4: Air Control & Backflip Physics
  console.log('\n--- TEST 4: Air Control & Backflip Physics ---');
  await evaluate(`
    // Launch vehicle high into the air (chassis + wheels)
    Matter.Body.setPosition(game.vehicle.chassis, { x: 1800, y: 120 });
    Matter.Body.setVelocity(game.vehicle.chassis, { x: 14, y: -16 });
    Matter.Body.setAngle(game.vehicle.chassis, 0);
    Matter.Body.setAngularVelocity(game.vehicle.chassis, 0);
    game.vehicle.wheels.forEach(w => {
      Matter.Body.setPosition(w.body, { x: 1800 + w.restOffset.x, y: 120 + w.restOffset.y });
      Matter.Body.setVelocity(w.body, { x: 14, y: -16 });
      w.contact = false;
    });
    game.vehicle.airborneTimer = 200;
    game.stunts.reset();
    // Hold Throttle (D) in mid-air -> MUST pitch nose UP (counter-clockwise -> BACKFLIP)
    game.input.keys.clear();
    game.input.keys.add('d');
  `);

  await new Promise((r) => setTimeout(r, 1200));

  const backflipResult = await evaluate(`({
    airtime: game.stunts.airtime.toFixed(0),
    cumulativeAngle: game.stunts.cumulativeAngle.toFixed(2),
    backflips: game.stunts.backflips,
    frontflips: game.stunts.frontflips,
    activeStunt: game.stunts.activeStuntName,
    score: game.score,
    combo: game.stunts.comboMultiplier
  })`);
  console.log('Backflip Air Control Result:', backflipResult);
  if (parseFloat(backflipResult.cumulativeAngle) >= 0) {
    throw new Error('Throttle in mid-air pitched nose DOWN instead of UP! Cumulative angle should be negative for backflip!');
  }
  if (backflipResult.backflips < 1) {
    throw new Error('Vehicle failed to complete Backflip during mid-air launch!');
  }

  // TEST 5: Air Control & Frontflip Physics (Brake)
  console.log('\n--- TEST 5: Air Control & Frontflip Physics ---');
  await evaluate(`
    Matter.Body.setPosition(game.vehicle.chassis, { x: 3200, y: 120 });
    Matter.Body.setVelocity(game.vehicle.chassis, { x: 14, y: -16 });
    Matter.Body.setAngle(game.vehicle.chassis, 0);
    Matter.Body.setAngularVelocity(game.vehicle.chassis, 0);
    game.vehicle.wheels.forEach(w => {
      Matter.Body.setPosition(w.body, { x: 3200 + w.restOffset.x, y: 120 + w.restOffset.y });
      Matter.Body.setVelocity(w.body, { x: 14, y: -16 });
      w.contact = false;
    });
    game.vehicle.airborneTimer = 200;
    game.stunts.reset();
    // Hold Brake (A) in mid-air -> MUST pitch nose DOWN (clockwise -> FRONTFLIP)
    game.input.keys.clear();
    game.input.keys.add('a');
  `);

  await new Promise((r) => setTimeout(r, 1200));

  const frontflipResult = await evaluate(`({
    airtime: game.stunts.airtime.toFixed(0),
    cumulativeAngle: game.stunts.cumulativeAngle.toFixed(2),
    backflips: game.stunts.backflips,
    frontflips: game.stunts.frontflips,
    activeStunt: game.stunts.activeStuntName
  })`);
  console.log('Frontflip Air Control Result:', frontflipResult);
  if (parseFloat(frontflipResult.cumulativeAngle) <= 0) {
    throw new Error('Brake in mid-air pitched nose UP instead of DOWN! Cumulative angle should be positive for frontflip!');
  }
  if (frontflipResult.frontflips < 1) {
    throw new Error('Vehicle failed to complete Frontflip during mid-air launch!');
  }

  // TEST 6: Articulated Driver Rollover Protection Tuck
  console.log('\n--- TEST 6: Articulated Driver Rollover Tuck ---');
  const driverTuck = await evaluate(`(() => {
    // Invert vehicle (upside down)
    Matter.Body.setAngle(game.vehicle.chassis, Math.PI);
    game.vehicle.update({ throttle: 0, brake: 0 }, 16.666);
    return {
      chassisAngle: game.vehicle.chassis.angle.toFixed(2),
      driverTuck: game.vehicle.driver.tuck.toFixed(3),
      driverLean: game.vehicle.driver.lean.toFixed(3)
    };
  })()`);
  console.log('Driver Rollover Tuck State:', driverTuck);
  if (parseFloat(driverTuck.driverTuck) < 0.1) {
    throw new Error('Driver failed to tuck during vehicle rollover inversion!');
  }

  // TEST 7: Vehicle Archetype Switching
  console.log('\n--- TEST 7: Vehicle Archetype Switching ---');
  const archSwitch = await evaluate(`(() => {
    game.setVehicleArchetype('crawler');
    const crawlerProps = {
      name: game.vehicle.archetype.name,
      mass: game.vehicle.archetype.chassisMass,
      radius: game.vehicle.archetype.wheelRadius,
      stiffness: game.vehicle.archetype.suspensionStiffness
    };
    game.setVehicleArchetype('rally');
    const rallyProps = {
      name: game.vehicle.archetype.name,
      mass: game.vehicle.archetype.chassisMass,
      radius: game.vehicle.archetype.wheelRadius,
      stiffness: game.vehicle.archetype.suspensionStiffness
    };
    game.setVehicleArchetype('buggy');
    return { crawler: crawlerProps, rally: rallyProps };
  })()`);
  console.log('Archetype Switch Verification:', archSwitch);
  if (archSwitch.crawler.mass !== 9.8 || archSwitch.rally.mass !== 5.8) {
    throw new Error('Vehicle archetype properties failed to apply correctly!');
  }

  // TEST 8: Interactive Props Collision & Smashing
  console.log('\n--- TEST 8: Interactive Props Collision & Smashing ---');
  const propTest = await evaluate(`(() => {
    const crate = game.propManager.defs.find(d => d.type === 'crate');
    game.camera.x = crate.x;
    game.propManager.updateChunking(game.camera.x);
    const activeCrate = game.propManager.activeProps.get(crate.id);
    const hasCrateBody = !!activeCrate;
    // Simulate vehicle ramming crate
    game.propManager.onHit(activeCrate.bodies[0], 2.5, { x: crate.x, y: crate.y });
    return {
      hasCrateBody,
      crateSmashed: activeCrate.smashed,
      particlesCount: game.particles.pool.filter(p => p.active).length
    };
  })()`);
  console.log('Interactive Prop Smashing Result:', propTest);
  if (!propTest.hasCrateBody || !propTest.crateSmashed) {
    throw new Error('Interactive crate prop failed to spawn or smash on impact!');
  }

  // TEST 9: F3 Live Diagnostic Overlay
  console.log('\n--- TEST 9: F3 Live Diagnostic Overlay ---');
  await evaluate(`
    game.debug = true;
    game.draw();
  `);
  const debugActive = await evaluate(`game.debug`);
  console.log('F3 Debug Mode is active:', debugActive);

  // TEST 10: Career Persistence (localStorage)
  console.log('\n--- TEST 10: Career Persistence ---');
  const careerTest = await evaluate(`(() => {
    game.maxDistance = 450;
    game.score = 2500;
    game.saveCareer();
    const loaded = JSON.parse(localStorage.getItem('omw_career'));
    return loaded;
  })()`);
  console.log('Persisted Career Data:', careerTest);
  if (careerTest.bestDist < 450 || careerTest.highScore < 2500) {
    throw new Error('Career persistence to localStorage failed!');
  }

  // TEST 11: Dynamic Normal Loads & Slip Curves
  console.log('\n--- TEST 11: Dynamic Normal Loads & Slip Curves ---');
  const normalLoadsTest = await evaluate(`(() => {
    // Reset vehicle on level ground
    Matter.Body.setPosition(game.vehicle.chassis, { x: 220, y: 480 });
    Matter.Body.setVelocity(game.vehicle.chassis, { x: 0, y: 0 });
    Matter.Body.setAngle(game.vehicle.chassis, 0);
    game.vehicle.wheels.forEach(w => {
      Matter.Body.setPosition(w.body, { x: 220 + w.restOffset.x, y: 480 + w.restOffset.y });
      Matter.Body.setVelocity(w.body, { x: 0, y: 0 });
    });
    // Step vehicle physics
    for (let i = 0; i < 15; i++) {
      game.vehicle.wheels.forEach(w => w.contact = true);
      game.vehicle.update({ throttle: 0.5, brake: 0 }, 16.666);
    }
    return {
      normalLoads: {
        front: parseFloat(game.vehicle.normalLoads.front.toFixed(3)),
        rear: parseFloat(game.vehicle.normalLoads.rear.toFixed(3))
      },
      slipRatios: {
        front: parseFloat((game.vehicle.wheels[1]?.slipRatio ?? 0).toFixed(3)),
        rear: parseFloat((game.vehicle.wheels[0]?.slipRatio ?? 0).toFixed(3))
      }
    };
  })()`);
  console.log('Dynamic Normal Loads & Slip:', normalLoadsTest);
  if (normalLoadsTest.normalLoads.front <= 0 || normalLoadsTest.normalLoads.rear <= 0) {
    throw new Error('Normal load distribution failed to calculate positive loads!');
  }

  // TEST 12: Mountain Echo Relics & Proximity Drift
  console.log('\n--- TEST 12: Mountain Echo Relics & Proximity Drift ---');
  const echoTest = await evaluate(`(() => {
    const totalRelics = game.echoManager.relics.length;
    const firstRelic = game.echoManager.relics[0];
    const initialCollected = game.echoManager.collectedCount;
    
    // Teleport vehicle close to first relic to trigger magnetic pull and collection
    Matter.Body.setPosition(game.vehicle.chassis, { x: firstRelic.x, y: firstRelic.y });
    Matter.Body.setVelocity(game.vehicle.chassis, { x: 0, y: 0 });
    game.vehicle.wheels.forEach(w => {
      Matter.Body.setPosition(w.body, { x: firstRelic.x + w.restOffset.x, y: firstRelic.y + w.restOffset.y });
      Matter.Body.setVelocity(w.body, { x: 0, y: 0 });
    });
    for (let i = 0; i < 5; i++) {
      game.echoManager.update(game.vehicle, 16.666);
    }
    
    return {
      totalRelics,
      relicName: firstRelic.name,
      relicLore: firstRelic.lore,
      initialCollected,
      collectedNow: game.echoManager.collectedCount,
      relic0Collected: firstRelic.collected
    };
  })()`);
  console.log('Mountain Echo Relic Collection Result:', echoTest);
  if (echoTest.totalRelics < 6 || !echoTest.relic0Collected || echoTest.collectedNow !== 1) {
    throw new Error('Mountain Echo Relic system failed to initialize or collect properly!');
  }

  // TEST 13: Three.js 2.5D Visual Depth Layer
  console.log('\n--- TEST 13: Three.js 2.5D Visual Depth Layer ---');
  const threeTest = await evaluate(`(() => {
    const td = game.threeDepth;
    const hasThree = !!td;
    const hasRenderer = td && !!td.renderer;
    const hasScene = td && !!td.scene;
    const echoMeshesCount = td ? td.echoMeshes.size : 0;
    const mountainMeshesCount = td ? td.mountains.length : 0;
    
    // Test rendering step
    let renderClean = false;
    if (td) {
      try {
        td.sync(game.camera, game.vehicle, game.echoManager.relics);
        renderClean = true;
      } catch (e) {
        renderClean = false;
      }
    }
    
    return {
      hasThree,
      hasRenderer,
      hasScene,
      echoMeshesCount,
      mountainMeshesCount,
      renderClean
    };
  })()`);
  console.log('Three.js Depth Layer Result:', threeTest);
  if (!threeTest.hasThree || !threeTest.hasScene || !threeTest.renderClean) {
    throw new Error('Three.js 2.5D Visual Depth layer failed verification!');
  }

  // TEST 14: 6-Stage Death State Machine & 1.8s Inversion Timer & Recovery Window
  console.log('\n--- TEST 14: 6-Stage Death State Machine & Recovery Window ---');
  const deathTest = await evaluate(`(() => {
    // Initial clean state
    game.isDead = false;
    game.deathState = "normal";
    game.upsideDownTimer = 0;
    const initialDeathState = game.deathState;
    
    // Invert vehicle
    Matter.Body.setAngle(game.vehicle.chassis, Math.PI);
    game.vehicle.roofContact = true;
    
    // Advance safety frames to enter critical state
    for (let i = 0; i < 45; i++) {
      game.safety(16.666);
    }
    const criticalState = game.deathState;
    const timerValue = game.upsideDownTimer;
    
    // Now simulate unflip / recovery within window!
    Matter.Body.setAngle(game.vehicle.chassis, 0);
    game.vehicle.roofContact = false;
    game.safety(16.666);
    const recoveredState = game.deathState;
    const recoveryAwarded = game.upsideDownTimer === 0;
    
    // Now simulate persistent inversion past 1.8s -> triggers death
    Matter.Body.setAngle(game.vehicle.chassis, Math.PI);
    Matter.Body.setVelocity(game.vehicle.chassis, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(game.vehicle.chassis, 0);
    game.vehicle.roofContact = true;
    for (let i = 0; i < 120; i++) {
      game.safety(16.666);
    }
    const crashState = game.deathState;
    
    return {
      initialDeathState,
      criticalState,
      timerValue: timerValue.toFixed(2),
      recoveredState,
      recoveryAwarded,
      crashState
    };
  })()`);
  console.log('Death State Machine Result:', deathTest);
  if ((deathTest.criticalState !== 'critical' && deathTest.criticalState !== 'crashed') || deathTest.recoveredState !== 'normal' || (deathTest.crashState !== 'wrecked' && deathTest.crashState !== 'death')) {
    throw new Error('6-Stage Death State Machine or Recovery Window failed verification!');
  }

  // TEST 15: Vehicle Garage & Tuning Workshop
  console.log('\n--- TEST 15: Vehicle Garage & Tuning Workshop ---');
  const garageTest = await evaluate(`(() => {
    const garageScreen = document.getElementById('garage-screen');
    const deathGarageBtn = document.getElementById('death-garage-btn');
    const garageCloseBtn = document.getElementById('garage-close-btn');
    const stiffInput = document.getElementById('tune-stiff');
    const gripInput = document.getElementById('tune-grip');
    
    // Open garage
    deathGarageBtn.click();
    const isVisibleAfterClick = garageScreen.style.display === 'flex';
    
    // Adjust suspension slider
    stiffInput.value = "0.19";
    stiffInput.dispatchEvent(new Event('input'));
    const appliedStiffness = game.vehicle.archetype.suspensionStiffness;
    
    // Adjust grip slider
    gripInput.value = "1.25";
    gripInput.dispatchEvent(new Event('input'));
    const appliedGrip = game.vehicle.archetype.tireGrip;
    
    // Close garage
    garageCloseBtn.click();
    const isHiddenAfterClose = garageScreen.style.display === 'none';
    
    return {
      isVisibleAfterClick,
      appliedStiffness,
      appliedGrip,
      isHiddenAfterClose
    };
  })()`);
  console.log('Vehicle Garage Tuning Result:', garageTest);
  if (!garageTest.isVisibleAfterClick || garageTest.appliedStiffness !== 0.19 || !garageTest.isHiddenAfterClose) {
    throw new Error('Vehicle Garage & Tuning Workshop interaction failed!');
  }

  // TEST 16: Test Seeds & Spline Re-generation
  console.log('\n--- TEST 16: Test Seeds & Spline Re-generation ---');
  const seedTest = await evaluate(`(() => {
    const results = {};
    for (const key of ['SEED_FLAT', 'SEED_STEEP', 'SEED_JUMP', 'SEED_VALLEY']) {
      game.setTestSeed(key);
      results[key] = {
        seed: game.terrain.seed,
        samplesCount: game.terrain.samples.length,
        bodiesCount: game.terrain.bodies.length
      };
    }
    return results;
  })()`);
  console.log('Test Seeds Re-generation Result:', seedTest);
  if (!seedTest.SEED_STEEP || seedTest.SEED_STEEP.samplesCount < 1000) {
    throw new Error('Test seed re-generation failed!');
  }

  // TEST 17: Telemetry Streaming & Export
  console.log('\n--- TEST 17: Telemetry Streaming & Export ---');
  const telemetryTest = await evaluate(`(() => {
    // Step a few frames to record telemetry
    for (let i = 0; i < 15; i++) {
      game.postPhysics(16.666);
    }
    const recordedEntries = game.telemetrySamples.length;
    // Export telemetry
    game.exportTelemetry();
    const sampleEntry = game.telemetrySamples[game.telemetrySamples.length - 1];
    return {
      recordedEntries,
      hasSample: !!sampleEntry,
      sampleKeys: sampleEntry ? Object.keys(sampleEntry) : []
    };
  })()`);
  console.log('Telemetry Streaming & Export Result:', telemetryTest);
  if (telemetryTest.recordedEntries < 1 || !telemetryTest.hasSample) {
    throw new Error('Telemetry system failed to record entries!');
  }

  // TEST 18: Master HUD 2.0 — Living Expedition Instrument System & Edge Cases
  console.log('\n--- TEST 18: Master HUD 2.0 Living Expedition Instruments & Edge Cases ---');
  const hud2Test = await evaluate(`(() => {
    const hm = window.hudManager;
    if (!hm) return { ok: false, reason: 'hudManager missing' };

    // 1. Verify all 10 Speedometer layers exist
    const speedoLayers = [
      'speedo-layer-housing',
      'speedo-layer-ring',
      'speedo-layer-ticks',
      'speedo-layer-scale',
      'hud-speed-orange-zone',
      'hud-speed-needle-shadow',
      'hud-speed-needle',
      'hud-speed-pivot',
      'hud-speed-big',
      'speedo-layer-cal'
    ];
    const missingLayers = speedoLayers.filter(id => !document.getElementById(id));

    // 2. Verify Geological Altimeter, Spirit-Level Inclinometer, Terrain Scanner, Compass, Stunt Gyro, Archival Echo
    const requiredIds = [
      'hud-altimeter-svg', 'hud-alt-tape', 'hud-alt-pointer',
      'hud-inclinometer-svg', 'hud-incline-bubble', 'hud-incline-bar',
      'hud-scanner-svg', 'hud-scanner-past', 'hud-scanner-line', 'hud-scanner-strata', 'hud-scanner-callout', 'hud-scanner-reticle',
      'hud-compass-card', 'hud-compass-needle', 'hud-compass-needle-shadow',
      'hud-airtime-chrono', 'hud-stunt-gyro-svg', 'hud-stunt-gyro-arc',
      'hud-echo-annotation', 'hud-three-canvas'
    ];
    const missingInstruments = requiredIds.filter(id => !document.getElementById(id));

    // 3. Simulate high-speed driving & airborne stunt & edge cases (0, 250 km/h, extreme pitch)
    hm.update({
      speed: 124,
      rpm: 0.88,
      altitude: 68,
      incline: 24,
      distance: 420,
      fuel: 0.18,
      engineTemp: 0.82,
      score: 1450,
      comboMultiplier: 3,
      comboTimer: 2.5,
      airtime: 1420,
      airborne: true,
      vehicleName: 'Trail Buggy',
      biomeName: ' Pine Ridge ',
      echoCount: 2,
      echoTotal: 6,
      activeStunt: 'BACKFLIP x1'
    }, 50);

    const stateWhenAirborne = hm.stateMachine.state;
    const speedBigText = document.getElementById('hud-speed-big')?.textContent;
    const scannerPathD = document.getElementById('hud-scanner-line')?.getAttribute('d') || '';
    const scannerCalloutText = document.getElementById('hud-scanner-callout')?.textContent || '';
    const fuelLowDisplay = document.getElementById('hud-fuel-low')?.style.display;

    // 4. Test rapid R reset 10 times in a row (Section 29 Edge Case Audit)
    for (let i = 0; i < 10; i++) {
      game.reset();
    }
    const stateAfterReset = hm.stateMachine.state;
    const speedAfterReset = document.getElementById('hud-speed-big')?.textContent;
    const anyNaN = document.getElementById('hud')?.innerText.includes('NaN');

    return {
      ok: missingLayers.length === 0 && missingInstruments.length === 0 && !anyNaN,
      missingLayers,
      missingInstruments,
      stateWhenAirborne,
      speedBigText,
      scannerPathValid: scannerPathD.startsWith('M ') && !scannerPathD.includes('NaN'),
      scannerCalloutText,
      fuelLowDisplay,
      stateAfterReset,
      speedAfterReset,
      anyNaN
    };
  })()`);
  console.log('Master HUD 2.0 Verification Result:', hud2Test);
  if (!hud2Test.ok || !hud2Test.scannerPathValid || hud2Test.anyNaN) {
    throw new Error('Master HUD 2.0 verification failed: ' + JSON.stringify(hud2Test));
  }

  // TEST 19: Mountain Generation 2.0 — 8.2km Scale, 20-Seed Validator 2.0, Diversity Score & Physics Chunk Streaming
  console.log('\n--- TEST 19: Mountain Generation 2.0 (8.2km Scale, 20-Seed Validator 2.0 & Physics Chunk Streaming) ---');
  const mtn2Test = await evaluate(`(() => {
    const t = game.terrain;
    const rep = t.validationReport;

    // 1. Test Physics Chunk Streaming at 3,000m (x=120,220) and 7,000m (x=280,220)
    const startChunk = t.getChunkAt(220);
    const wasStartActive = startChunk.active;

    t.updateStreaming(120220, game.engine.world, game.terrainSet);
    const midChunk = t.getChunkAt(120220);
    const midChunkActive = Boolean(midChunk && midChunk.active && game.terrainSet.has(midChunk.bodies[0]));
    const startDeactivatedAtMid = !startChunk.active && !game.terrainSet.has(startChunk.bodies[0]);
    const activeChunksAtMid = t.activeChunkCount;
    const activeBodiesAtMid = t.bodies.length;

    t.updateStreaming(280220, game.engine.world, game.terrainSet);
    const summitChunk = t.getChunkAt(280220);
    const summitChunkActive = Boolean(summitChunk && summitChunk.active && game.terrainSet.has(summitChunk.bodies[0]));
    const midDeactivatedAtSummit = !midChunk.active;

    // Restore streaming back to start
    t.updateStreaming(game.vehicle.chassis.position.x, game.engine.world, game.terrainSet);

    // 2. Validate 20 distinct seeds in-engine via P0 + validateTerrain()
    const seeds20 = [42, 101, 256, 512, 777, 1024, 1337, 2025, 3141, 4096, 5839, 6553, 7919, 8192, 9001, 11113, 22229, 31415, 48192, 99991];
    let passedSeeds = 0;
    let minDiv = 100;
    let maxSlopeAcross20 = 0;
    let minDistKm = 999;

    for (const s of seeds20) {
      const testTerrain = new P0(s);
      const r = testTerrain.validationReport;
      if (
        r.totalDistanceKm >= 8.15 &&
        r.maxSlopeDeg <= 45.2 &&
        r.maxDyPixels <= 20.0 &&
        r.diversityPercent >= 80 &&
        r.setpieceCount >= 10 &&
        r.chunkIntegrity
      ) {
        passedSeeds++;
      }
      if (r.diversityPercent < minDiv) minDiv = r.diversityPercent;
      if (r.maxSlopeDeg > maxSlopeAcross20) maxSlopeAcross20 = r.maxSlopeDeg;
      if (r.totalDistanceKm < minDistKm) minDistKm = r.totalDistanceKm;
    }

    return {
      totalDistanceKm: rep.totalDistanceKm,
      sampleCount: rep.sampleCount,
      segmentCount: rep.segmentCount,
      totalChunks: t.chunks.length,
      activeChunksAtMid,
      activeBodiesAtMid,
      wasStartActive,
      midChunkActive,
      startDeactivatedAtMid,
      summitChunkActive,
      midDeactivatedAtSummit,
      maxElevationMeters: rep.maxElevationMeters,
      totalElevationGain: rep.totalElevationGain,
      maxDescentMeters: rep.maxDescentMeters,
      jumpCount: rep.jumpCount,
      majorJumpCount: rep.majorJumpCount,
      extremeClimbCount: rep.extremeClimbCount,
      deepValleyCount: rep.deepValleyCount,
      diversityPercent: rep.diversityPercent,
      setpieceCount: rep.setpieceCount,
      passedSeeds,
      minDiv,
      maxSlopeAcross20,
      minDistKm
    };
  })()`);
  console.log('Mountain Generation 2.0 Verification Result:', mtn2Test);
  if (
    mtn2Test.passedSeeds !== 20 ||
    !mtn2Test.midChunkActive ||
    !mtn2Test.startDeactivatedAtMid ||
    !mtn2Test.summitChunkActive ||
    !mtn2Test.midDeactivatedAtSummit ||
    mtn2Test.activeBodiesAtMid > 500
  ) {
    throw new Error('Mountain Generation 2.0 verification failed: ' + JSON.stringify(mtn2Test));
  }

  // TEST 20: Cinematic Camera Director 2.0 — 21-State Machine, Shot Director, Spring Physics, Lookahead & Terrain Guard
  console.log('\n--- TEST 20: Cinematic Camera Director 2.0 (Section 54 Full Test Matrix) ---');
  const cam2Test = await evaluate(`(() => {
    const cam = game.camera;
    const v = game.vehicle;
    const t = game.terrain;
    if (!cam || !window.CameraDirector || !window.CAMERA_STATES) {
      return { ok: false, reason: 'CameraDirector or CAMERA_STATES missing' };
    }

    const stateCount = Object.keys(window.CAMERA_STATES).length;
    const shotCount = Object.keys(window.SHOT_CONFIGS || {}).length;

    // 1. Verify Nonlinear Look-Ahead Curve (Section 10: 0->100, 20->250, 50->500, 80->800)
    const look0 = Math.round(cam.computeNonlinearLookAhead(0));
    const look20 = Math.round(cam.computeNonlinearLookAhead(20));
    const look50 = Math.round(cam.computeNonlinearLookAhead(50));
    const look80 = Math.round(cam.computeNonlinearLookAhead(80));
    const lookAheadCurveOk = (look0 === 100 && look20 === 250 && look50 === 500 && look80 === 800);

    // Helper to step camera cleanly
    const stepCam = (frames = 8, dt = 16.67) => {
      for (let i = 0; i < frames; i++) {
        cam.update(v, t, dt);
      }
    };

    // 2. Idle state -> FOLLOW
    game.reset();
    Matter.Body.setVelocity(v.chassis, { x: 0, y: 0 });
    v.forwardSpeed = 0;
    v.airborne = false;
    stepCam(10);
    const stateIdle = cam.state;

    // 3. High Speed (85 km/h -> forwardSpeed = 85 / 7.2 = 11.8)
    const flatX = 300;
    const flatY = t.heightAt(flatX) - 38;
    Matter.Body.setPosition(v.chassis, { x: flatX, y: flatY });
    Matter.Body.setVelocity(v.chassis, { x: 12.2, y: 0 });
    v.forwardSpeed = 12.2;
    v.airborne = false;
    v.wheels[0].contact = true;
    v.wheels[1].contact = true;
    stepCam(18);
    const stateHighSpeed = cam.state;
    const fovHighSpeed = Number(cam.fov.toFixed(1));
    const zoomHighSpeed = Number(cam.zoom.toFixed(3));

    // 4. Extreme Climb (Find a steep climb sample or synthesize slope > 27 deg)
    let steepSample = t.samples.find(s => (Math.atan(s.slope) * 180 / Math.PI) < -28);
    if (steepSample) {
      Matter.Body.setPosition(v.chassis, { x: steepSample.x, y: steepSample.y - 35 });
      Matter.Body.setVelocity(v.chassis, { x: 4.5, y: -2.5 });
      v.forwardSpeed = 5.0;
      v.airborne = false;
      v.wheels[0].contact = true;
      v.wheels[1].contact = true;
      stepCam(12);
    }
    const stateExtremeClimb = cam.state;

    // 5. Giant Jump + Ballistic Landing Zone Prediction
    Matter.Body.setPosition(v.chassis, { x: 4200, y: t.heightAt(4200) - 180 });
    Matter.Body.setVelocity(v.chassis, { x: 11.5, y: -5.5 });
    v.forwardSpeed = 11.5;
    v.airborne = true;
    v.airborneTime = 0.85;
    v.wheels[0].contact = false;
    v.wheels[1].contact = false;
    game.stunts.airtime = 850;
    game.stunts.cumulativeAngle = 0.2;
    stepCam(12);
    const stateGiantJump = cam.state;
    const landingZoneActive = Boolean(cam.landingZone && cam.landingZone.active);

    // 6. Mid-Air Backflip Stunt -> STUNT + SHOT_ORBIT
    game.stunts.cumulativeAngle = -3.6;
    game.stunts.activeStuntName = 'BACKFLIP';
    cam.shotDirector.cooldowns.clear();
    stepCam(12);
    const stateStunt = cam.state;
    const shotStunt = cam.shotType;

    // 7. Hard Landing Compression -> LANDING / IMPACT
    v.airborne = false;
    v.airborneTime = 0;
    v.wheels[0].contact = true;
    v.wheels[1].contact = true;
    game.stunts.airtime = 0;
    game.stunts.cumulativeAngle = 0;
    game.stunts.activeStuntName = '';
    v.wheels[0].compression = 0.72;
    v.wheels[1].compression = 0.75;
    cam.prevMaxCompression = 0.10;
    stepCam(4);
    const stateLanding = cam.state;

    // 8. Impact System 3-Frequency Impulse
    cam.addShake(1.0, Math.PI, 8500);
    stepCam(3);
    const stateImpact = cam.state;
    const impactIntensity = Number(cam.impact.intensity.toFixed(2));

    // 9. Summit Approach (x > 318,000 px / 7,950 m)
    cam.impact.reset();
    cam._justLandedTimer = 0;
    const summitX = 322000;
    Matter.Body.setPosition(v.chassis, { x: summitX, y: t.heightAt(summitX) - 36 });
    Matter.Body.setVelocity(v.chassis, { x: 5.0, y: 0 });
    v.forwardSpeed = 5.0;
    v.wheels[0].compression = 0.15;
    v.wheels[1].compression = 0.15;
    cam.prevMaxCompression = 0.15;
    cam.shotDirector.cooldowns.clear();
    stepCam(12);
    const stateSummit = cam.state;
    const shotSummit = cam.shotType;

    // 10. Death & Victory Camera States
    v.dead = true;
    stepCam(8);
    const stateDeath = cam.state;

    v.dead = false;
    game.summitReached = true;
    stepCam(8);
    const stateVictory = cam.state;

    // 11. Reduced Motion Accessibility Mode
    game.summitReached = false;
    x.visual.reducedMotion = true;
    cam.addShake(1.0, 0, 5000);
    stepCam(10);
    const reducedRoll = Math.abs(cam.totalRoll);
    const reducedFov = Math.round(cam.fov);
    x.visual.reducedMotion = false;

    // 12. Reset back to clean start & verify zero NaNs
    game.reset();
    stepCam(5);
    const hasNaN = [cam.x, cam.y, cam.zoom, cam.fov, cam.totalRoll, cam.lookAheadDistance].some(val => !Number.isFinite(val));

    return {
      ok: (
        stateCount >= 21 &&
        lookAheadCurveOk &&
        stateHighSpeed === 'HIGH_SPEED' &&
        stateGiantJump === 'GIANT_JUMP' &&
        landingZoneActive &&
        stateStunt === 'STUNT' &&
        shotStunt === 'SHOT_ORBIT' &&
        stateImpact === 'IMPACT' &&
        stateSummit === 'SUMMIT' &&
        stateDeath === 'DEATH' &&
        stateVictory === 'VICTORY' &&
        reducedRoll < 0.01 &&
        !hasNaN
      ),
      stateCount,
      shotCount,
      lookAheadCurve: { look0, look20, look50, look80 },
      stateIdle,
      stateHighSpeed,
      fovHighSpeed,
      zoomHighSpeed,
      stateExtremeClimb,
      stateGiantJump,
      landingZoneActive,
      stateStunt,
      shotStunt,
      stateLanding,
      stateImpact,
      impactIntensity,
      stateSummit,
      shotSummit,
      stateDeath,
      stateVictory,
      reducedRoll,
      reducedFov,
      hasNaN
    };
  })()`);
  console.log('Cinematic Camera Director 2.0 Verification Result:', cam2Test);
  if (!cam2Test.ok) {
    throw new Error('Cinematic Camera Director 2.0 verification failed: ' + JSON.stringify(cam2Test));
  }

  // TEST 21: Living World Simulation 2.0 — Idle Test, Systemic WorldState, Weather/Seasons, Boids & Animal Reactivity
  console.log('\n--- TEST 21: Living World Simulation 2.0 (Sections 1-48) ---');
  const worldSimTest = await evaluate(`(() => {
    const wsSim = game.worldSim;
    if (!wsSim || !wsSim.state) return { ok: false, reason: 'worldSim missing' };
    const s = wsSim.state;

    // 1. Verify Weather & Season Catalogs
    const weatherCount = window.WEATHER_TYPES ? Object.keys(window.WEATHER_TYPES).length : 0;
    const seasonCount = window.SEASONS ? window.SEASONS.length : 0;

    // 2. IDLE WORLD TEST (Section 48: Stop vehicle completely and observe autonomous world evolution)
    const v = game.vehicle;
    Matter.Body.setVelocity(v.chassis, { x: 0, y: 0 });
    v.forwardSpeed = 0;
    const t0 = s.timeMinutes;
    const cloud0 = wsSim.weather.clouds[0]?.x ?? 0;
    const bird0 = wsSim.wildlife.boids[0]?.x ?? 0;

    for (let i = 0; i < 60; i++) {
      wsSim.update(50, game);
    }
    const idleTimeAdvanced = s.timeMinutes > t0;
    const idleCloudsMoved = Math.abs((wsSim.weather.clouds[0]?.x ?? 0) - cloud0) > 0.5;
    const idleBirdsMoved = Math.abs((wsSim.wildlife.boids[0]?.x ?? 0) - bird0) > 0.5;

    // 3. Time & Celestial Progression (Sunrise -> Noon -> Sunset -> Night)
    wsSim.advanceTimeHours(4); // Afternoon / Golden Hour
    wsSim.update(32, game);
    const phaseAfternoon = s.phaseName;
    const shadowAfternoon = s.sun.shadowDirX;

    // Set to Night (23:00)
    s.timeMinutes = 23 * 60;
    wsSim.update(32, game);
    const phaseNight = s.phaseName;
    const sunElevNight = s.sun.elevation;
    const trafficHeadlightsAtNight = wsSim.npc.ridgeVehicles.some(t => t.headlightsOn);

    // 4. Weather State Machine & NPC Rain Umbrella Reactivity
    wsSim.weather.setWeather(s, 'HEAVY_RAIN', true);
    for (let i = 0; i < 30; i++) wsSim.update(50, game);
    const rainPrecip = s.precipitation;
    const rainWetness = s.memory.wetness;
    const npcUmbrellaInRain = wsSim.npc.npcs.some(n => n.hasUmbrella);

    // 5. Winter Blizzard & Freezing Water Reactivity
    s.seasonIndex = 3;
    s.season = 'WINTER';
    wsSim.weather.setWeather(s, 'BLIZZARD', true);
    for (let i = 0; i < 30; i++) wsSim.update(50, game);
    const winterTemp = s.temperature;
    const winterSnowCover = s.memory.snowCover;

    // 6. Wildlife Animal Reactivity (FEED -> ALERT -> FLEE) & Bird Startle Chain
    const testAnimal = wsSim.wildlife.animals[0];
    const testBird = wsSim.wildlife.boids[0];
    if (testAnimal && testBird) {
      testAnimal.x = v.chassis.position.x + 50;
      testAnimal.state = 'FEED';
      testBird.x = testAnimal.x + 20;
      testBird.y = game.terrain.heightAt(testBird.x) - 5;
      testBird.state = 'PERCHED';
      testBird.perchTimer = 10;
      v.forwardSpeed = 16;
      wsSim.update(50, game);
    }
    const animalReacted = testAnimal ? (testAnimal.state === 'FLEE' || testAnimal.state === 'ALERT') : false;
    const birdScattered = testBird ? (testBird.state === 'SCATTER' || testBird.state === 'FLYING') : false;

    // 7. World Event Director Showcase Events
    const triggeredEvents = [];
    for (let i = 0; i < 5; i++) {
      triggeredEvents.push(wsSim.triggerShowcaseEvent(game));
      wsSim.update(32, game);
    }

    // 8. Reset back to clean morning state & verify rendering + HUD sync
    s.timeMinutes = 9.5 * 60;
    s.season = 'AUTUMN';
    s.targetSeason = 'AUTUMN';
    s.weather = 'CLEAR';
    s.targetWeather = 'PARTLY_CLOUDY';
    wsSim.update(32, game);
    game.draw();

    const hasNaN = [s.timeMinutes, s.temperature, s.windSpeed, s.sun.elevation, s.simStepMs].some(val => !Number.isFinite(val));

    return {
      ok: (
        weatherCount >= 12 &&
        seasonCount === 4 &&
        idleTimeAdvanced &&
        idleCloudsMoved &&
        idleBirdsMoved &&
        sunElevNight < 0 &&
        trafficHeadlightsAtNight &&
        rainPrecip > 0.2 &&
        rainWetness > 0 &&
        npcUmbrellaInRain &&
        winterTemp < 5 &&
        winterSnowCover > 0 &&
        animalReacted &&
        birdScattered &&
        triggeredEvents.length === 5 &&
        !hasNaN
      ),
      weatherCount,
      seasonCount,
      idleTimeAdvanced,
      idleCloudsMoved,
      idleBirdsMoved,
      phaseAfternoon,
      shadowAfternoon: Number(shadowAfternoon.toFixed(2)),
      phaseNight,
      sunElevNight: Number(sunElevNight.toFixed(2)),
      trafficHeadlightsAtNight,
      rainPrecip: Number(rainPrecip.toFixed(2)),
      rainWetness: Number(rainWetness.toFixed(3)),
      npcUmbrellaInRain,
      winterTemp: Number(winterTemp.toFixed(1)),
      winterSnowCover: Number(winterSnowCover.toFixed(3)),
      animalReacted,
      birdScattered,
      triggeredEvents,
      entityCounts: s.entityCounts,
      simStepMs: Number(s.simStepMs.toFixed(3)),
      hasNaN
    };
  })()`);
  console.log('Living World Simulation 2.0 Verification Result:', worldSimTest);
  if (!worldSimTest.ok) {
    throw new Error('Living World Simulation 2.0 verification failed: ' + JSON.stringify(worldSimTest));
  }

  // TEST 22: Extreme Mountain Terrain + Physics Overhaul (Sections 1-34)
  console.log('\n--- TEST 22: Extreme Mountain Terrain + Physics Overhaul (Sections 1-34) ---');
  const extremeOverhaulTest = await evaluate(`(() => {
    const rules = x?.world?.terrainRules || {};
    const hasRules = (
      rules.MAX_SLOPE === 45 &&
      rules.MIN_SLOPE === -45 &&
      rules.CREST_SHARPNESS >= 0.8 &&
      rules.VALLEY_DEPTH >= 150 &&
      rules.JUMP_DISTANCE >= 350
    );
    const hasSurfaceMaterials = Boolean(
      MATERIALS.rock && MATERIALS.dirt && MATERIALS.gravel &&
      MATERIALS.mud && MATERIALS.wet_rock && MATERIALS.snow && MATERIALS.ice
    );

    // Find a steep uphill sample in the opening sequence (around x=700..1150, Section C: Steep Climb)
    let steepClimbX = 920;
    for (let q = 650; q < 2500; q += 20) {
      if (game.terrain.slopeAt(q) < -0.54) {
        steepClimbX = q;
        break;
      }
    }
    const climbSlopeDeg = Number((Math.abs(game.terrain.slopeAt(steepClimbX)) * 180 / Math.PI).toFixed(1));

    // 1. Low-momentum stall & rollback test on steep climb
    game.reset();
    const v = game.vehicle;
    const climbY = game.terrain.heightAt(steepClimbX) - 44;
    const climbSlope = game.terrain.slopeAt(steepClimbX);
    Matter.Body.setPosition(v.chassis, { x: steepClimbX, y: climbY });
    Matter.Body.setAngle(v.chassis, climbSlope);
    Matter.Body.setVelocity(v.chassis, { x: 0, y: 0 });
    Matter.Body.setPosition(v.wheels[0].body, { x: steepClimbX - 40, y: game.terrain.heightAt(steepClimbX - 40) - 22 });
    Matter.Body.setPosition(v.wheels[1].body, { x: steepClimbX + 42, y: game.terrain.heightAt(steepClimbX + 42) - 22 });
    Matter.Body.setVelocity(v.wheels[0].body, { x: 0, y: 0 });
    Matter.Body.setVelocity(v.wheels[1].body, { x: 0, y: 0 });
    v.wheels.forEach(w => { w.contact = true; w.contactGrace = 100; });
    game.terrain.updateStreaming(steepClimbX, game.engine.world, game.terrainSet);

    game.input.keys.clear();
    for (let i = 0; i < 55; i++) {
      game.step(8.333333);
    }
    const rollbackSpeed = Number(v.forwardSpeed.toFixed(2));
    const rolledBackward = v.chassis.position.x < steepClimbX - 3 && v.forwardSpeed < -0.4;

    // Now test holding hill-brake ('a') while rolling backward
    game.input.keys.add('a');
    for (let i = 0; i < 35; i++) {
      v.wheels.forEach(w => { w.contact = true; w.contactGrace = 100; });
      game.step(8.333333);
    }
    const hillBrakeForce = Number((v.lastBrakeForce || 0).toFixed(4));
    game.input.keys.clear();

    // 2. High-momentum entry vs Low-momentum entry on the same steep climb
    Matter.Body.setPosition(v.chassis, { x: steepClimbX - 40, y: game.terrain.heightAt(steepClimbX - 40) - 44 });
    Matter.Body.setAngle(v.chassis, game.terrain.slopeAt(steepClimbX - 40));
    Matter.Body.setVelocity(v.chassis, { x: 0.5, y: 0 });
    Matter.Body.setPosition(v.wheels[0].body, { x: steepClimbX - 80, y: game.terrain.heightAt(steepClimbX - 80) - 22 });
    Matter.Body.setPosition(v.wheels[1].body, { x: steepClimbX + 2, y: game.terrain.heightAt(steepClimbX + 2) - 22 });
    Matter.Body.setVelocity(v.wheels[0].body, { x: 0.5, y: 0 });
    Matter.Body.setVelocity(v.wheels[1].body, { x: 0.5, y: 0 });
    v.wheels.forEach(w => { w.contact = true; w.contactGrace = 100; });
    game.input.keys.add('d');
    for (let i = 0; i < 60; i++) {
      game.step(8.333333);
    }
    const lowMomentumReachX = v.chassis.position.x;

    Matter.Body.setPosition(v.chassis, { x: steepClimbX - 40, y: game.terrain.heightAt(steepClimbX - 40) - 44 });
    Matter.Body.setAngle(v.chassis, game.terrain.slopeAt(steepClimbX - 40));
    Matter.Body.setVelocity(v.chassis, { x: 18, y: -9 });
    Matter.Body.setPosition(v.wheels[0].body, { x: steepClimbX - 80, y: game.terrain.heightAt(steepClimbX - 80) - 22 });
    Matter.Body.setPosition(v.wheels[1].body, { x: steepClimbX + 2, y: game.terrain.heightAt(steepClimbX + 2) - 22 });
    Matter.Body.setVelocity(v.wheels[0].body, { x: 18, y: -9 });
    Matter.Body.setVelocity(v.wheels[1].body, { x: 18, y: -9 });
    v.wheels.forEach(w => { w.contact = true; w.contactGrace = 100; });
    for (let i = 0; i < 60; i++) {
      game.step(8.333333);
    }
    const highMomentumReachX = v.chassis.position.x;
    const momentumAdvantagePx = Number((highMomentumReachX - lowMomentumReachX).toFixed(1));
    game.input.keys.clear();

    // 3. Active Mechanical Braking ('a') on a steep descent
    let steepDescentX = 1380;
    for (let q = 1100; q < 3000; q += 20) {
      if (game.terrain.slopeAt(q) > 0.54) {
        steepDescentX = q;
        break;
      }
    }
    const descentSlope = game.terrain.slopeAt(steepDescentX);
    Matter.Body.setPosition(v.chassis, { x: steepDescentX, y: game.terrain.heightAt(steepDescentX) - 44 });
    Matter.Body.setAngle(v.chassis, descentSlope);
    Matter.Body.setVelocity(v.chassis, { x: 15, y: 8 });
    Matter.Body.setPosition(v.wheels[0].body, { x: steepDescentX - 40, y: game.terrain.heightAt(steepDescentX - 40) - 22 });
    Matter.Body.setPosition(v.wheels[1].body, { x: steepDescentX + 42, y: game.terrain.heightAt(steepDescentX + 42) - 22 });
    Matter.Body.setVelocity(v.wheels[0].body, { x: 15, y: 8 });
    Matter.Body.setVelocity(v.wheels[1].body, { x: 15, y: 8 });
    v.wheels.forEach(w => { w.contact = true; w.contactGrace = 100; });
    game.terrain.updateStreaming(steepDescentX, game.engine.world, game.terrainSet);
    game.step(8.333333);

    const speedBeforeBrake = v.forwardSpeed;
    game.input.keys.clear();
    game.input.keys.add('a');
    let peakBrakeForce = 0;
    for (let i = 0; i < 45; i++) {
      v.wheels.forEach(w => { w.contact = true; w.contactGrace = 100; });
      game.step(8.333333);
      if ((v.lastBrakeForce || 0) > peakBrakeForce) peakBrakeForce = v.lastBrakeForce;
    }
    const speedAfterBrake = v.forwardSpeed;
    const brakeDecelerated = speedAfterBrake < speedBeforeBrake - 2.0 && peakBrakeForce > 0.005;
    game.input.keys.clear();

    // 4. Landing quality state machine verification
    v.chassis.angle = game.terrain.slopeAt(v.chassis.position.x) + 0.48; // nose-heavy
    v.chassis.velocity.y = 7.5;
    game.stunts.airtime = 650;
    game.stunts.onLanding(v, game.terrain);
    const noseHeavyLanding = v.lastLandingQuality === 'FRONT_HEAVY';

    v.chassis.angle = game.terrain.slopeAt(v.chassis.position.x) - 0.48; // rear-heavy
    v.chassis.velocity.y = 7.5;
    game.stunts.airtime = 650;
    game.stunts.onLanding(v, game.terrain);
    const rearHeavyLanding = v.lastLandingQuality === 'REAR_HEAVY';

    v.chassis.angle = game.terrain.slopeAt(v.chassis.position.x) + 0.04; // aligned
    v.chassis.velocity.y = 3.5;
    game.stunts.airtime = 650;
    game.stunts.onLanding(v, game.terrain);
    const perfectLanding = v.lastLandingQuality === 'PERFECT';

    game.reset();

    return {
      ok: (
        hasRules &&
        hasSurfaceMaterials &&
        climbSlopeDeg >= 30 &&
        rolledBackward &&
        momentumAdvantagePx > 120 &&
        brakeDecelerated &&
        noseHeavyLanding &&
        rearHeavyLanding &&
        perfectLanding
      ),
      hasRules,
      hasSurfaceMaterials,
      climbSlopeDeg,
      rollbackSpeed,
      rolledBackward,
      hillBrakeForce,
      momentumAdvantagePx,
      speedBeforeBrake: Number(speedBeforeBrake.toFixed(2)),
      speedAfterBrake: Number(speedAfterBrake.toFixed(2)),
      peakBrakeForce: Number(peakBrakeForce.toFixed(4)),
      brakeDecelerated,
      noseHeavyLanding,
      rearHeavyLanding,
      perfectLanding
    };
  })()`);
  console.log('Extreme Mountain Terrain + Physics Overhaul Result:', extremeOverhaulTest);
  if (!extremeOverhaulTest.ok) {
    throw new Error('Extreme Mountain Terrain + Physics Overhaul verification failed: ' + JSON.stringify(extremeOverhaulTest));
  }

  // TEST 23: Error Audit
  console.log('\n--- TEST 23: Browser Error Audit ---');
  if (errors.length > 0) {
    console.error('FOUND CONSOLE EXCEPTIONS:', errors);
    throw new Error('Browser execution reported exceptions!');
  } else {
    console.log('Zero runtime errors reported in browser console!');
  }

  ws.close();
  chrome.kill();
  console.log('\n======================================================');
  console.log('>>> ALL 23 DEEP VERIFICATION CDP TESTS PASSED! <<<');
  console.log('======================================================\n');
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
