import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML_PATH = 'file:///C:/Users/anish%20jha/.gemini/antigravity/scratch/old-mountain-works/old-mountain-works.html';
const PORT = 9272;

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

async function run() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--window-size=1280,800',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    HTML_PATH
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
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
    return res.result?.result?.value;
  }

  await send('Page.enable');
  await send('Runtime.enable');

  for (let i = 0; i < 40; i++) {
    try {
      const ready = await evaluate(`typeof game !== 'undefined' && Boolean(game.vehicle)`);
      if (ready) break;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log('Starting realistic player drive...');
  await evaluate(`
    document.getElementById('start-btn').click();
  `);

  // Drive with realistic player controls for 4 seconds
  for (let frame = 0; frame < 200; frame++) {
    await evaluate(`(() => {
      const v = game.vehicle;
      const slope = game.terrain.slopeAt(v.chassis.position.x);
      const angleDiff = v.chassis.angle - slope;
      
      game.input.keys.clear();
      // If grounded or nose is pointing too far down: Gas (D)
      if (!v.airborne || angleDiff > 0.15) {
        game.input.keys.add('d');
      } 
      // If airborne and nose is pointing too far up: Brake (A) to level with slope
      else if (v.airborne && angleDiff < -0.15) {
        game.input.keys.add('a');
      }
    })()`);
    await new Promise(r => setTimeout(r, 20));
  }

  const telemetry = await evaluate(`({
    distance: game.maxDistance.toFixed(1),
    speed: (Math.abs(game.vehicle.forwardSpeed) * 7.2).toFixed(1),
    x: game.vehicle.chassis.position.x.toFixed(0),
    y: game.vehicle.chassis.position.y.toFixed(0),
    ang: (game.vehicle.chassis.angle * 180 / Math.PI).toFixed(1),
    contacts: game.vehicle.wheels.map(w => w.contact),
    stunt: game.stunts.activeStuntName,
    fps: game.fps.toFixed(0)
  })`);
  console.log('Player Drive Telemetry:', telemetry);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/anish jha/.gemini/antigravity/scratch/old-mountain-works/screenshot_driving_level.png', Buffer.from(shot.result.data, 'base64'));
  fs.writeFileSync('C:/Users/anish jha/.gemini/antigravity/brain/adc9bb80-1f6f-41a7-b7d7-14eac06252d6/screenshot_driving_level.png', Buffer.from(shot.result.data, 'base64'));
  console.log('Clean driving screenshot saved to screenshot_driving_level.png');

  ws.close();
  chrome.kill();
}

run().catch(console.error);
