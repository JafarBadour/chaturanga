let audioCtx = null;
let unlocked = false;

function getContext() {
  if (!unlocked) return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function unlockGameAudio() {
  unlocked = true;
  getContext();
}

function playStrikeSwordInternal() {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Metallic "ring" as the blade finishes
  const ring = ctx.createOscillator();
  const ringGain = ctx.createGain();
  ring.type = "triangle";
  ring.frequency.setValueAtTime(920, now);
  ring.frequency.exponentialRampToValueAtTime(420, now + 0.12);
  ringGain.gain.setValueAtTime(0.0001, now);
  ringGain.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
  ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  ring.connect(ringGain);
  ringGain.connect(ctx.destination);
  ring.start(now);
  ring.stop(now + 0.35);

  // Whoosh / slash
  const bufferSize = Math.floor(ctx.sampleRate * 0.18);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(2200, now);
  bandpass.frequency.exponentialRampToValueAtTime(600, now + 0.16);
  bandpass.Q.value = 0.8;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.45, now + 0.01);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  noise.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.18);

  // Low "draw" thump
  const thump = ctx.createOscillator();
  const thumpGain = ctx.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(140, now + 0.04);
  thump.frequency.exponentialRampToValueAtTime(70, now + 0.14);
  thumpGain.gain.setValueAtTime(0.0001, now + 0.04);
  thumpGain.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  thump.connect(thumpGain);
  thumpGain.connect(ctx.destination);
  thump.start(now + 0.04);
  thump.stop(now + 0.16);
}

function playClockTickInternal() {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(880, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.07, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.045);
}

export function playStrikeSword() {
  try {
    playStrikeSwordInternal();
  } catch {
    /* ignore audio failures */
  }
}

export function playClockTick() {
  try {
    playClockTickInternal();
  } catch {
    /* ignore audio failures */
  }
}

export function isBulletTimeControl(timeControl) {
  return timeControl === "1+0" || timeControl === "2+1";
}

const NO_TICK_ROYALE = new Set(["royale/1.5", "royale/3"]);

/** Returns tick window in ms (0 = disabled). */
export function getClockTickWindowMs(timeControl) {
  if (isBulletTimeControl(timeControl)) return 0;
  if (NO_TICK_ROYALE.has(timeControl)) return 0;
  if (timeControl === "royale/5") return 500;
  return 1000;
}

export function shouldPlayClockTick(timeControl, activeMs) {
  const windowMs = getClockTickWindowMs(timeControl);
  if (!windowMs) return false;
  return activeMs > 0 && activeMs <= windowMs;
}
