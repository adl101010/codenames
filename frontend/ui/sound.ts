// Typewriter sounds, synthesized with the Web Audio API rather than
// bundled as audio files -- keeps the app fully self-contained (no
// asset fetches, nothing to serve or cache-bust) and lets each
// keystroke be pitched slightly differently, so a long clue doesn't
// sound like the same sample looped.

let ctx: AudioContext | null = null;

// Created lazily on first use rather than at import time: browsers
// start an AudioContext in a "suspended" state unless it's created (or
// resumed) during a user gesture, so building it up front just means
// holding a dead context. See unlock() below.
function audioContext(): AudioContext | null {
  if (ctx) {
    return ctx;
  }
  const Ctor =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) {
    return null; // no Web Audio support -- caller degrades to silence
  }
  ctx = new Ctor();
  return ctx;
}

// Browsers refuse to play audio until the page has seen a real user
// gesture, and the player view learns about a new clue from background
// polling, not from a click -- so without this, the very first clue on
// a freshly-loaded tab could be silent. Calling this from any click
// handler (see Game.componentDidMount) unlocks audio for the rest of
// the page's life.
export function unlock() {
  const ac = audioContext();
  if (ac && ac.state === 'suspended') {
    ac.resume();
  }
}

// One key strike: a short burst of noise (the mechanical clack) layered
// with a low thud (the key bottoming out).
export function playKeyClack() {
  const ac = audioContext();
  if (!ac || ac.state === 'suspended') {
    return;
  }
  const now = ac.currentTime;

  // The clack itself -- white noise, band-passed so it reads as a
  // sharp mechanical tick rather than a hiss, with a very fast decay.
  const noiseLength = 0.03;
  const buffer = ac.createBuffer(1, ac.sampleRate * noiseLength, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const bandpass = ac.createBiquadFilter();
  bandpass.type = 'bandpass';
  // Jitter the center frequency per strike so repeated keys don't sound
  // identical -- real typebars don't.
  bandpass.frequency.value = 1800 + Math.random() * 1200;
  bandpass.Q.value = 1.2;

  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.22, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLength);

  noise.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(ac.destination);
  noise.start(now);
  noise.stop(now + noiseLength);

  // The thud -- a very short low sine, giving the clack some body so it
  // doesn't sound thin on TV speakers.
  const thud = ac.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(120 + Math.random() * 40, now);
  const thudGain = ac.createGain();
  thudGain.gain.setValueAtTime(0.14, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  thud.connect(thudGain);
  thudGain.connect(ac.destination);
  thud.start(now);
  thud.stop(now + 0.05);
}

// The carriage-return bell, played once the whole clue has finished
// typing out. Two detuned sines with a long decay reads as a small
// metal bell without needing a sample.
export function playBell() {
  const ac = audioContext();
  if (!ac || ac.state === 'suspended') {
    return;
  }
  const now = ac.currentTime;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.13, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  gain.connect(ac.destination);

  [1050, 1575].forEach((freq) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.9);
  });
}
