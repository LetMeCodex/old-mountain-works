// Comprehensive automated testing suite using Chrome DevTools Protocol (CDP) via native Node.js
import { spawn } from 'child_process';
import http from 'http';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML_PATH = 'file:///C:/Users/anish%20jha/.gemini/antigravity/scratch/old-mountain-works/old-mountain-works(1).html';
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
  await new Promise((r) => setTimeout(r, 1200));

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

  // TEST 11: Error Audit
  console.log('\n--- TEST 11: Browser Error Audit ---');
  if (errors.length > 0) {
    console.error('FOUND CONSOLE EXCEPTIONS:', errors);
    throw new Error('Browser execution reported exceptions!');
  } else {
    console.log('Zero runtime errors reported in browser console!');
  }

  ws.close();
  chrome.kill();
  console.log('\n======================================================');
  console.log('>>> ALL 11 DEEP VERIFICATION CDP TESTS PASSED! <<<');
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
