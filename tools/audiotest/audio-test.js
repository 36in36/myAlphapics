/* iOS PWA audio diagnostic. Logs persist across navigation via localStorage. */
const LOG_KEY = 'audiotest.log';
const CLIPS = { letter: 'audio/letter-g.mp3', praise: 'audio/praise.mp3' };

let ctx = null;
const buffers = {};

function log(line) {
  const t = new Date().toISOString().slice(11, 23);
  const entry = `[${t}] ${PAGE} | ${line}`;
  const all = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  all.push(entry);
  localStorage.setItem(LOG_KEY, JSON.stringify(all));
  render();
}

function render() {
  const all = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  const el = document.getElementById('log');
  if (el) { el.textContent = all.join('\n'); el.scrollTop = el.scrollHeight; }
}

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { log('FAIL: no AudioContext constructor'); return null; }
    ctx = new AC();
    log(`created AudioContext -> state=${ctx.state} rate=${ctx.sampleRate}`);
  }
  return ctx;
}

async function loadBuffer(name) {
  if (buffers[name]) return buffers[name];
  const c = getCtx();
  if (!c) return null;
  try {
    const res = await fetch(CLIPS[name], { cache: 'force-cache' });
    const arr = await res.arrayBuffer();
    log(`fetched ${name}: ${arr.byteLength}b`);
    const buf = await new Promise((resolve, reject) => {
      const p = c.decodeAudioData(arr, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
    buffers[name] = buf;
    log(`decoded ${name}: ${buf.duration.toFixed(2)}s`);
    return buf;
  } catch (e) {
    log(`FAIL decode ${name}: ${e && e.message}`);
    return null;
  }
}

/* The real test: did sound actually come out?
   Proof = context clock advanced AND onended fired within the expected window. */
async function playBuffer(name, tag) {
  const c = getCtx();
  if (!c) return;
  log(`${tag}: state before resume = ${c.state}`);
  try {
    await c.resume();
    log(`${tag}: state after resume = ${c.state}`);
  } catch (e) {
    log(`${tag}: resume() threw -> ${e && e.message}`);
  }
  const buf = await loadBuffer(name);
  if (!buf) return;

  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  let ended = false;
  src.onended = () => { ended = true; };
  const t0 = c.currentTime;
  try { src.start(0); } catch (e) { log(`${tag}: start() threw -> ${e && e.message}`); return; }
  log(`${tag}: started, clock=${t0.toFixed(3)}`);

  await new Promise(r => setTimeout(r, (buf.duration * 1000) + 600));
  const advanced = c.currentTime - t0;
  const played = ended && advanced >= buf.duration * 0.8;
  log(`${tag}: RESULT ${played ? 'PLAYED' : 'SILENT'} (ended=${ended} clockAdvanced=${advanced.toFixed(2)}s state=${c.state})`);
}

function testSpeech(tag) {
  if (!('speechSynthesis' in window)) { log(`${tag}: no speechSynthesis`); return; }
  let started = false;
  const u = new SpeechSynthesisUtterance('Testing speech synthesis.');
  u.onstart = () => { started = true; log(`${tag}: speech onstart fired`); };
  u.onend = () => log(`${tag}: speech onend fired`);
  u.onerror = e => log(`${tag}: speech error -> ${e.error}`);
  speechSynthesis.speak(u);
  setTimeout(() => { if (!started) log(`${tag}: RESULT speechSynthesis SILENT (onstart never fired)`); }, 2500);
}

function environment() {
  const standalone = ('standalone' in navigator) ? navigator.standalone
    : window.matchMedia('(display-mode: standalone)').matches;
  log(`--- page load ---`);
  log(`standalone=${standalone} sw=${!!(navigator.serviceWorker && navigator.serviceWorker.controller)}`);
  if (!standalone) log('WARNING: not in standalone mode — add to Home Screen and open from there');
}


/* Hand the log to the native iOS share sheet (AirDrop, Mail, Messages, Notes).
   Prefers a real .txt file so it arrives on a Mac as a file, not pasted text. */
async function shareLog() {
  const all = JSON.parse(localStorage.getItem(LOG_KEY) || '[]').join(String.fromCharCode(10));
  if (!all) { alert('Log is empty'); return; }

  let file = null;
  try { file = new File([all], 'audiotest-log.txt', { type: 'text/plain' }); } catch (e) { /* older iOS */ }

  if (navigator.share) {
    const attempts = [];
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      attempts.push({ files: [file], title: 'AudioTest log' });
    }
    attempts.push({ title: 'AudioTest log', text: all });
    for (const payload of attempts) {
      try { await navigator.share(payload); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }  // user cancelled — stop
    }
  }
  try { await navigator.clipboard.writeText(all); alert('Share unavailable — copied to clipboard'); }
  catch (e) { alert('Could not share or copy — select the log text manually'); }
}

function wireCommon() {
  render();
  const sh = document.getElementById('share');
  if (sh) sh.onclick = shareLog;
  document.getElementById('clear').onclick = () => { localStorage.removeItem(LOG_KEY); render(); };
  document.getElementById('copy').onclick = async () => {
    const all = JSON.parse(localStorage.getItem(LOG_KEY) || '[]').join('\n');
    try { await navigator.clipboard.writeText(all); alert('Log copied'); }
    catch { alert('Copy failed — select the log text manually'); }
  };
}
