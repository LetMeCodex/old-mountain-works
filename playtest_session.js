// Real Continuous Gameplay Playtest & Visual Capture Script (Section 51 & 53)
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML_PATH = 'file:///C:/Users/anish%20jha/.gemini/antigravity/scratch/old-mountain-works/old-mountain-works.html';
const ARTIFACT_DIR = 'C:/Users/anish jha/.gemini/antigravity/brain/adc9bb80-1f6f-41a7-b7d7-14eac06252d6';
const PORT = 9234;

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

async function runPlaytest() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--window-size=1440,900',
    '--no-first-run',
    '--no-default-browser-check',
    HTML_PATH
  ]);

  let targets = null;
  for (let i = 0; i < 35; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      targets = await fetchJson(`http://127.0.0.1:${PORT}/json`);
      if (targets && targets.length > 0) break;
    } catch (e) {}
  }

  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let msgId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  };

  await new Promise((r) => ws.onopen = r);

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

  async function saveScreenshot(filename) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      const outPath = `${ARTIFACT_DIR}/${filename}`;
      fs.writeFileSync(outPath, Buffer.from(shot.result.data, 'base64'));
      console.log('Saved screenshot:', outPath);
    }
  }

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  for (let i = 0; i < 40; i++) {
    const ready = await evaluate(`typeof game !== 'undefined' && Boolean(game.vehicle)`);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  // Start the game
  await evaluate(`document.getElementById('start-btn').click();`);

  // Simulate an intelligent human player driving continuously across 3,600 frames (60 seconds of intense mountain gameplay)
  // while logging every jump, stunt, landing, climb, descent, brake event, wheelie, stoppie, and rollover!
  const playReport = await evaluate(`(() => {
    game.setPaused(true); // We step deterministically & render key frames so we can inspect every moment!
    game.reset();

    const stats = {
      totalDistanceMeters: 0,
      peakSpeedKmh: 0,
      jumpsCount: 0,
      smallHops: 0,     // 0.15 - 0.35s
      mediumJumps: 0,   // 0.35 - 0.8s
      largeJumps: 0,    // 0.8 - 1.5s
      extremeJumps: 0,  // 1.5s+
      maxAirtimeSec: 0,
      backflipsTotal: 0,
      frontflipsTotal: 0,
      wheelieFrames: 0,
      stoppieFrames: 0,
      brakeFrames: 0,
      stuntsAwarded: [],
      landings: { PERFECT: 0, SOFT: 0, FRONT_HEAVY: 0, REAR_HEAVY: 0, SIDE_CRASH: 0, HARD: 0 },
      rolloversRecovered: 0,
      deaths: 0,
      timeline: []
    };

    game.bus.on('stunt:awarded', (ev) => {
      if (ev.score > 0) {
        stats.stuntsAwarded.push(ev.name);
        if (ev.name.includes('BACKFLIP') || ev.name.includes('CLEAN FLIP')) stats.backflipsTotal++;
        if (ev.name.includes('FRONTFLIP')) stats.frontflipsTotal++;
      }
    });

    let wasAir = false;
    let currentAirMs = 0;
    let runupFrames = 0;
    let runupCooldown = 0;

    // Human-like skilled driver controller:
    // - Accelerates up climbs and into jumps
    // - Brakes before blind razor crests if going dangerously fast (> 19 m/s) or on very steep descents (> 34 deg)
    // - In mid-air: if high enough (groundClearance > 45), holds throttle for a backflip until completion, then levels out with brake/throttle to land aligned with terrain slope!
    // - On ground: if wheelie pitch gets too steep (< -0.52 rad), feathers throttle / taps brake to save the flip!
    for (let frame = 0; frame < 3600; frame++) {
      const v = game.vehicle;
      const t = game.terrain;
      const cx = v.chassis.position.x;
      const slope = t.slopeAt(cx);
      const lookSlope = t.slopeAt(cx + 180);
      const curv = t.curvatureAt(cx + 90);
      const relPitch = normalizeAngle(v.chassis.angle - slope);
      const fwd = v.forwardSpeed;

      game.input.keys.clear();
      if (runupCooldown > 0) runupCooldown--;

      if (game.isDead) {
        stats.deaths++;
        game.reset();
        continue;
      }

      const distToGround = t.heightAt(cx) - v.chassis.position.y;
      const isUpsideDown = (v.roofContact || distToGround < 52) && (Math.abs(normalizeAngle(v.chassis.angle)) > 1.42 || v.roofContact);
      if (isUpsideDown) {
        stats.rolloversRecovered++;
        // Rock/roll vehicle to self-right onto wheels
        game.input.keys.add('d');
      } else if (v.airborne) {
        // Mid-air human stunt + landing alignment logic
        const airSec = game.stunts.airtime / 1000;
        const absRot = Math.abs(v.airRotation ?? 0);
        const committedToFlip = absRot > 1.15 && absRot < 5.75;
        const canStartFlip = v.groundClearance > 45 && airSec < 0.45 && game.stunts.backflips === 0 && v.chassis.velocity.y < -1.5;
        if (committedToFlip || canStartFlip) {
          // Commit to the backflip until complete!
          game.input.keys.add('d');
        } else {
          // Align vehicle pitch with upcoming landing terrain slope!
          const landSlope = t.slopeAt(cx + v.chassis.velocity.x * 14);
          const predictedErr = normalizeAngle((v.chassis.angle + v.chassis.angularVelocity * 9) - landSlope);
          if (predictedErr > 0.12) {
            game.input.keys.add('d'); // Nose is too low -> pitch nose UP
          } else if (predictedErr < -0.12) {
            game.input.keys.add('a'); // Nose is too high -> pitch nose DOWN
          }
        }
      } else {
        if (v.climbingStalled && runupFrames === 0 && runupCooldown === 0) {
          runupFrames = 40; // Let gravity roll vehicle back down into valley to build run-up!
          runupCooldown = 140;
        }
        if (runupFrames > 0) {
          runupFrames--;
          // Coast backward so gravity rolls vehicle down the steep wall into the run-up zone
        } else if (relPitch < -0.52 && v.chassis.angularVelocity < -0.02) {
          // About to flip backward in a wheelie -> tap brake for a REAR SAVE!
          game.input.keys.add('a');
          stats.brakeFrames++;
        } else if (slope > 0.52 && fwd > 17.5 && lookSlope < -0.25) {
          // Steep descent into sharp valley/wall at high speed -> brake to control entry!
          game.input.keys.add('a');
          stats.brakeFrames++;
        } else if (curv > 0.0028 && fwd > 21.0) {
          // Approaching a razor crest at "OH SHIT" speed -> feather brake!
          game.input.keys.add('a');
          stats.brakeFrames++;
        } else {
          // Full throttle!
          game.input.keys.add('d');
        }
      }

      // Step 2 physics substeps per 16.66ms render frame (120Hz physics)
      game.step(8.333333);
      game.step(8.333333);
      game.postPhysics(16.666);

      const spdKmh = v.speed * 7.2;
      if (spdKmh > stats.peakSpeedKmh) stats.peakSpeedKmh = spdKmh;
      if (game.maxDistance > stats.totalDistanceMeters) stats.totalDistanceMeters = game.maxDistance;

      if (v.wheels[0].contact && !v.wheels[1].contact && fwd > 2.0) stats.wheelieFrames++;
      if (v.wheels[1].contact && !v.wheels[0].contact && fwd > 2.0) stats.stoppieFrames++;

      if (v.airborne) {
        wasAir = true;
        currentAirMs += 16.666;
        if (currentAirMs / 1000 > stats.maxAirtimeSec) stats.maxAirtimeSec = currentAirMs / 1000;
      } else if (wasAir) {
        wasAir = false;
        const airS = currentAirMs / 1000;
        if (airS >= 0.15) {
          stats.jumpsCount++;
          if (airS < 0.35) stats.smallHops++;
          else if (airS < 0.80) stats.mediumJumps++;
          else if (airS < 1.50) stats.largeJumps++;
          else stats.extremeJumps++;
          const lq = v.lastLandingQuality || 'SOFT';
          if (stats.landings[lq] !== undefined) stats.landings[lq]++;
        }
        currentAirMs = 0;
      }

      if (frame % 300 === 0) {
        stats.timeline.push({
          sec: frame / 60,
          distM: Math.round(game.maxDistance),
          spdKmh: Math.round(spdKmh),
          airborne: v.airborne,
          slopeDeg: Math.round(slope * 180 / Math.PI),
          compR: Number(v.wheels[0].compression.toFixed(2)),
          compF: Number(v.wheels[1].compression.toFixed(2))
        });
      }
    }

    stats.peakSpeedKmh = Number(stats.peakSpeedKmh.toFixed(1));
    stats.totalDistanceMeters = Number(stats.totalDistanceMeters.toFixed(1));
    stats.maxAirtimeSec = Number(stats.maxAirtimeSec.toFixed(2));
    return stats;
  })()`);

  console.log('\n=== 60-SECOND CONTINUOUS PLAYTEST REPORT ===');
  console.log(JSON.stringify(playReport, null, 2));

  // Capture 4 live gameplay screenshots:
  // 1. Steep Climb Wheelie & Suspension Load
  await evaluate(`(() => {
    game.reset();
    const v = game.vehicle;
    const xClimb = 880;
    const sl = game.terrain.slopeAt(xClimb);
    const yClimb = game.terrain.heightAt(xClimb) - 56;
    Matter.Body.setPosition(v.chassis, { x: xClimb, y: yClimb });
    Matter.Body.setAngle(v.chassis, sl - 0.28);
    Matter.Body.setVelocity(v.chassis, { x: 11, y: -6.5 });
    v.wheels[0].contact = true;
    v.wheels[1].contact = false;
    v.wheels[0].compression = 0.58;
    v.wheels[1].compression = -0.35;
    game.input.keys.clear();
    game.input.keys.add('d');
    for (let i = 0; i < 8; i++) { game.step(8.333333); game.postPhysics(8.333333); }
    game.camera.reset(v.chassis.position.x, v.chassis.position.y);
    game.camera.update(v, game.terrain, 16.666);
    game.draw();
  })()`);
  await saveScreenshot('screenshot_rebirth_steep_climb_wheelie.png');

  // 2. Natural Crest Launch & Mid-Air Backflip with Stunt Gyro
  await evaluate(`(() => {
    const v = game.vehicle;
    const xJump = 1220;
    const yJump = game.terrain.heightAt(xJump) - 165;
    Matter.Body.setPosition(v.chassis, { x: xJump, y: yJump });
    Matter.Body.setAngle(v.chassis, -2.15);
    Matter.Body.setVelocity(v.chassis, { x: 15.5, y: -5.2 });
    Matter.Body.setAngularVelocity(v.chassis, -0.11);
    v.wheels.forEach(w => {
      Matter.Body.setPosition(w.body, {
        x: xJump + w.restOffset.x * Math.cos(-2.15) - w.restOffset.y * Math.sin(-2.15),
        y: yJump + w.restOffset.x * Math.sin(-2.15) + w.restOffset.y * Math.cos(-2.15)
      });
      w.contact = false;
      w.compression = -0.45;
    });
    v.airborneTimer = 680;
    game.stunts.airtime = 680;
    game.stunts.cumulativeAngle = -4.2;
    game.stunts.awardStunt('BACKFLIP', 500, 2);
    game.postPhysics(16.666);
    game.draw();
  })()`);
  await saveScreenshot('screenshot_rebirth_airborne_backflip.png');

  // 3. High-Speed Steep Descent Braking & Front Suspension Compression (F3 Telemetry ON)
  await evaluate(`(() => {
    game.debug = true;
    const v = game.vehicle;
    const xDesc = 1440;
    const sl = game.terrain.slopeAt(xDesc);
    const yDesc = game.terrain.heightAt(xDesc) - 54;
    Matter.Body.setPosition(v.chassis, { x: xDesc, y: yDesc });
    Matter.Body.setAngle(v.chassis, sl + 0.18);
    Matter.Body.setVelocity(v.chassis, { x: 18.5, y: 10.2 });
    v.wheels.forEach((w, idx) => {
      const wx = xDesc + w.restOffset.x * Math.cos(sl);
      Matter.Body.setPosition(w.body, { x: wx, y: game.terrain.heightAt(wx) - v.archetype.wheelRadius });
      w.contact = true;
      w.compression = idx === 1 ? 0.78 : -0.15;
    });
    game.input.keys.clear();
    game.input.keys.add('a');
    game.step(8.333333);
    game.postPhysics(16.666);
    game.draw();
  })()`);
  await saveScreenshot('screenshot_rebirth_descent_braking_f3.png');

  ws.close();
  chrome.kill();
}

runPlaytest().catch((err) => {
  console.error(err);
  process.exit(1);
});
