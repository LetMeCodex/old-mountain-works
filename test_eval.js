import { spawn } from 'child_process';
import http from 'http';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML_PATH = 'file:///C:/Users/anish%20jha/.gemini/antigravity/scratch/old-mountain-works/old-mountain-works.html';
const PORT = 9234;

async function test() {
  const chrome = spawn(CHROME_PATH, ['--headless=new', '--remote-debugging-port=' + PORT, '--disable-gpu', HTML_PATH]);
  for (let i = 0; i < 35; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const targets = await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json', r => {
          let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
        }).on('error', rej);
      });
      if (targets && targets.length) {
        const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
        await new Promise(r => ws.onopen = r);
        let id = 1;
        const send = (method, params = {}) => new Promise(res => {
          const reqId = id++;
          const handler = (e) => {
            const data = JSON.parse(e.data);
            if (data.id === reqId) { ws.removeEventListener('message', handler); res(data); }
          };
          ws.addEventListener('message', handler);
          ws.send(JSON.stringify({ id: reqId, method, params }));
        });
        await send('Runtime.enable');
        
        const evalRes = await send('Runtime.evaluate', {
          expression: '(() => {\n' +
            '  const results = {};\n' +
            '  for (const t of [5, 10, 20, 40]) {\n' +
            '    const engine = game.engine.constructor.create({ gravity: { x: 0, y: 0 } });\n' +
            '    const b = x0.default.Bodies.rectangle(0, 0, 118, 28, { mass: 7.4, frictionAir: 0.004 });\n' +
            '    x0.default.Composite.add(engine.world, b);\n' +
            '    for (let step = 0; step < 120; step++) {\n' +
            '      b.torque = -t;\n' +
            '      game.engine.constructor.update(engine, 1000 / 120);\n' +
            '    }\n' +
            '    results[t] = { angVel: b.angularVelocity.toFixed(3), angle: b.angle.toFixed(3) };\n' +
            '  }\n' +
            '  return results;\n' +
            '})()',
          returnByValue: true
        });
        console.log('EVAL RES:', JSON.stringify(evalRes));
        ws.close();
        chrome.kill();
        process.exit(0);
      }
    } catch(e) {}
  }
}
test();
