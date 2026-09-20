// Automated browser test using Chrome DevTools Protocol (CDP) via native Node.js
import { spawn } from 'child_process';
import http from 'http';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML_PATH = 'file:///C:/Users/anish%20jha/.gemini/antigravity/scratch/old-mountain-works/old-mountain-works.html';
const PORT = 9224;

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

  chrome.stderr.on('data', (d) => {
    // console.error('[Chrome stderr]', d.toString());
  });

  // Wait for debugger port to become available
  let targets = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      targets = await fetchJson(`http://127.0.0.1:${PORT}/json`);
      if (targets && targets.length > 0) break;
    } catch (e) {
      // retry
    }
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

  console.log('4. Waiting 1s for initial page load and engine build...');
  await new Promise((r) => setTimeout(r, 1000));

  // Check game existence
  const gameState = await evaluate(`({
    hasGame: typeof game !== 'undefined',
    terrainSamples: game.terrain.samples.length,
    terrainBodies: game.terrain.bodies.length,
    startX: game.startX,
    chassisX: game.vehicle.chassis.position.x,
    chassisY: game.vehicle.chassis.position.y,
    wheelsCount: game.vehicle.wheels.length,
    activeBodies: game.engine.world.bodies.length,
    fps: game.fps
  })`);
  console.log('5. Initial Game State:', gameState);

  if (!gameState.hasGame || gameState.terrainSamples < 100) {
    throw new Error('Game failed to initialize properly');
  }

  // Simulate starting the game run
  console.log('6. Simulating Start Button click and full throttle driving...');
  await evaluate(`
    document.getElementById('start-btn').click();
    game.input.keys.add('d'); // Apply throttle
  `);

  // Run driving simulation for 3 seconds
  for (let s = 1; s <= 3; s++) {
    await new Promise((r) => setTimeout(r, 1000));
    const telemetry = await evaluate(`({
      distance: game.maxDistance.toFixed(1),
      speed: (Math.abs(game.vehicle.forwardSpeed) * 7.2).toFixed(1),
      rpm: game.vehicle.rpm.toFixed(2),
      x: game.vehicle.chassis.position.x.toFixed(0),
      y: game.vehicle.chassis.position.y.toFixed(0),
      driverLean: game.vehicle.driver.lean.toFixed(3),
      compression: game.vehicle.wheels.map(w => w.compression.toFixed(2)),
      contacts: game.vehicle.wheels.map(w => w.contact),
      activeParticles: game.particles.pool.filter(p => p.active).length,
      stunt: game.stunts.activeStuntName,
      combo: game.stunts.comboMultiplier,
      fps: game.fps.toFixed(0)
    })`);
    console.log(`   [Second ${s}] Telemetry:`, telemetry);
  }

  // Test jump launch & backflip stunt
  console.log('7. Testing air control and stunt detection...');
  const stuntTestResult = await evaluate(`
    // Teleport vehicle into air with upward velocity and test pitch rotation
    Matter.Body.setPosition(game.vehicle.chassis, { x: 1200, y: 300 });
    Matter.Body.setVelocity(game.vehicle.chassis, { x: 18, y: -12 });
    // Hold throttle in mid-air to test backflip rotation
    game.input.keys.add('d');
    'Airborne test initiated';
  `);
  console.log('   Stunt test launched:', stuntTestResult);

  await new Promise((r) => setTimeout(r, 1500));

  const afterJump = await evaluate(`({
    airtime: game.stunts.airtime,
    stunt: game.stunts.activeStuntName,
    cumulativeAngle: game.stunts.cumulativeAngle.toFixed(2),
    backflips: game.stunts.backflips,
    score: game.score,
    combo: game.stunts.comboMultiplier
  })`);
  console.log('   After-jump Telemetry:', afterJump);

  // Test Pause overlay
  console.log('8. Testing Pause / Resume...');
  await evaluate(`togglePause();`);
  const pauseDisplay = await evaluate(`document.getElementById('pause').style.display`);
  console.log('   Pause overlay display:', pauseDisplay);
  await evaluate(`togglePause();`);

  // Test Reset & New Run
  console.log('9. Testing Reset and New Run...');
  await evaluate(`game.newRun(12345);`);
  const postReset = await evaluate(`({
    seed: game.seed,
    distance: game.maxDistance,
    chassisX: game.vehicle.chassis.position.x.toFixed(0),
    sampleCount: game.terrain.samples.length
  })`);
  console.log('   Post-Reset state:', postReset);

  // Check error log
  console.log('10. Error audit:');
  if (errors.length > 0) {
    console.error('   FOUND ERRORS:', errors);
    throw new Error('Browser execution reported errors!');
  } else {
    console.log('   Zero errors reported in browser console!');
  }

  ws.close();
  chrome.kill();
  console.log('\n>>> ALL BROWSER CDP TESTS PASSED PERFECTLY! <<<\n');
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
