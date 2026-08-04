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

// Everything is routed through a lowpass on the way out rather than
// straight to the destination. Without it the strike's opening
// transient runs unbounded up to ~20kHz, which is what made an earlier
// version sting after a few clues -- a real typebar has no energy up
// there. Applied to the bell too, so it doesn't end up the one sharp
// thing left.
const ROLLOFF_HZ = 7000;

function toneOut(ac: AudioContext): BiquadFilterNode {
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = ROLLOFF_HZ;
  lp.Q.value = 0.7;
  lp.connect(ac.destination);
  return lp;
}

// A short burst of filtered noise, shaped by a fast decay envelope.
function noiseBurst(
  ac: AudioContext,
  out: AudioNode,
  now: number,
  opts: {
    duration: number;
    type: BiquadFilterType;
    frequency: number;
    q: number;
    peak: number;
    decay: number;
  }
) {
  const buffer = ac.createBuffer(
    1,
    Math.max(1, Math.floor(ac.sampleRate * opts.duration)),
    ac.sampleRate
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ac.createBufferSource();
  source.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = opts.type;
  filter.frequency.value = opts.frequency;
  filter.Q.value = opts.q;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(opts.peak, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.decay);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(now);
  source.stop(now + opts.duration);
}

// One key strike: a typebar slapping the platen. Three layers -- a hard
// transient at the moment of contact, the mid-range body of the strike,
// and a low thump as the key bottoms out.
export function playKeyClack() {
  const ac = audioContext();
  if (!ac || ac.state === 'suspended') {
    return;
  }
  const now = ac.currentTime;
  const out = toneOut(ac);

  // The contact transient. Bandpassed rather than highpassed so it's
  // bounded on top -- this is the layer that gives the strike its snap,
  // and also the one that turns harsh if it's left to run free.
  noiseBurst(ac, out, now, {
    duration: 0.008,
    type: 'bandpass',
    frequency: 2600,
    q: 1.1,
    peak: 0.24,
    decay: 0.008,
  });

  // The body of the strike. Jittered per keystroke so a long clue
  // doesn't sound like one sample looped -- real typebars don't repeat.
  noiseBurst(ac, out, now, {
    duration: 0.05,
    type: 'bandpass',
    frequency: 850 + Math.random() * 300,
    q: 1.8,
    peak: 0.5,
    decay: 0.04,
  });

  // The key bottoming out -- a short pitch drop, giving the strike
  // weight so it doesn't sound thin on TV speakers.
  const thump = ac.createOscillator();
  thump.type = 'sine';
  const thumpFrom = 150 + Math.random() * 30;
  thump.frequency.setValueAtTime(thumpFrom, now);
  thump.frequency.exponentialRampToValueAtTime(80, now + 0.05);
  const thumpGain = ac.createGain();
  thumpGain.gain.setValueAtTime(0.34, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  thump.connect(thumpGain);
  thumpGain.connect(out);
  thump.start(now);
  thump.stop(now + 0.05);
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
  const out = toneOut(ac);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  gain.connect(out);

  [1050, 1575].forEach((freq) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.9);
  });
}
