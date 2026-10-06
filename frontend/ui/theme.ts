// Holiday themes. A theme is chosen in Settings and stored on the *game*
// (see Game.Theme on the server), not in the browser, so the TV and the
// iPad always show the same look: each browser just applies whatever
// theme arrives with the game state.
//
// Applying one does two things: sets data-theme on <html> (the CSS in
// game.css keys everything off that), and builds the decorative layer
// that CSS can't -- falling snow, string lights, embers, confetti.

export const DEFAULT_THEME = 'classic';

export const THEMES = [
  {
    id: 'classic',
    name: 'Classic',
    desc: 'The usual Field Dossier look.',
  },
  {
    id: 'snow',
    name: 'Snowfall',
    desc: 'Pale winter morning, snow drifting past the board.',
  },
  {
    id: 'evergreen',
    name: 'Evergreen Lights',
    desc: 'Dark green room with twinkling tree lights.',
  },
  {
    id: 'fire',
    name: 'Fireside',
    desc: 'Dim room with a flickering fire glow and drifting embers.',
  },
  {
    id: 'nye',
    name: "New Year's Eve",
    desc: 'Midnight violet with gold confetti coming down.',
  },
];

// An id this build doesn't know -- an empty string from a game that never
// chose one, or a theme added on a newer server -- falls back to Classic
// rather than leaving the page in some half-themed state.
export function normalizeTheme(id) {
  return THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME;
}

const DECOR_ID = 'theme-decor';
let applied = null;

function rnd(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function particle(className, style) {
  const e = document.createElement('span');
  e.className = className;
  e.setAttribute('style', style);
  return e;
}

// Particles are positioned at a random spot (top, in vh) and animate by
// translating relative to that spot, from just off one edge to just off
// the other. The start and end offsets are precomputed per particle as
// plain lengths rather than calc() expressions, which the old CSS
// minifier this project builds with can mangle. The resting position
// (animation off, e.g. reduced motion) is simply the random spot.
function falling(className, extra) {
  const top = rnd(0, 100);
  return particle(
    className,
    'left:' + rnd(0, 100).toFixed(1) + '%;top:' + top.toFixed(1) + 'vh' +
      ';--y0:' + (-(top + 6)).toFixed(1) + 'vh;--y1:' + (108 - top).toFixed(1) + 'vh' +
      ';--dr:' + rnd(-45, 45).toFixed(0) + 'px' +
      ';animation-duration:' + rnd(9, 17).toFixed(1) + 's' +
      ';animation-delay:-' + rnd(0, 17).toFixed(1) + 's;' + extra
  );
}

function buildSnow(root) {
  const frost = document.createElement('div');
  frost.className = 'td-frost';
  root.appendChild(frost);
  for (let i = 0; i < 44; i++) {
    const size = rnd(3, 7).toFixed(1) + 'px';
    root.appendChild(
      falling('td-flake', 'width:' + size + ';height:' + size + ';opacity:' + rnd(0.6, 1).toFixed(2))
    );
  }
}

function buildLights(root) {
  const strand = document.createElement('div');
  strand.className = 'td-lights';
  // Gold, amber, mint and warm white only. No red or blue bulb, so
  // nothing on the strand can be mistaken for a team.
  const colors = ['#ffd45a', '#ffb347', '#7fe0a0', '#fff1b8'];
  const count = 20;
  for (let i = 0; i < count; i++) {
    // A shallow sag: the strand dips toward the middle but stays clear of
    // the turn badge underneath it.
    const sag = Math.sin((i / (count - 1)) * Math.PI) * 5;
    strand.appendChild(
      particle(
        'td-bulb',
        '--c:' + colors[i % colors.length] + ';margin-top:' + sag.toFixed(1) +
          'px;animation-delay:-' + rnd(0, 2.2).toFixed(2) + 's'
      )
    );
  }
  root.appendChild(strand);
}

function buildEmbers(root) {
  for (let i = 0; i < 30; i++) {
    // Rises from the bottom edge: top is where it rests, y0/y1 carry it
    // from below the screen to above it.
    const top = rnd(30, 100);
    const size = rnd(3, 6).toFixed(1) + 'px';
    root.appendChild(
      particle(
        'td-ember',
        'left:' + rnd(3, 97).toFixed(1) + '%;top:' + top.toFixed(1) + 'vh' +
          ';width:' + size + ';height:' + size +
          ';opacity:' + rnd(0.8, 1).toFixed(2) +
          ';--y0:' + (104 - top).toFixed(1) + 'vh;--y1:' + (-(top + 6)).toFixed(1) + 'vh' +
          ';--dr:' + rnd(-35, 35).toFixed(0) + 'px' +
          ';animation-duration:' + rnd(6, 11).toFixed(1) + 's' +
          ';animation-delay:-' + rnd(0, 11).toFixed(1) + 's'
      )
    );
  }
}

function buildConfetti(root) {
  const colors = ['#e2c46a', '#f4e6b0', '#c9cfd6', '#e7b8a3'];
  for (let i = 0; i < 40; i++) {
    // r is the resting angle, r2 where it has spun to by the time it
    // reaches the bottom -- both precomputed so the CSS needs no calc().
    const r = rnd(0, 180);
    root.appendChild(
      falling(
        'td-conf',
        'width:' + rnd(4, 7).toFixed(1) + 'px;height:' + rnd(8, 13).toFixed(1) + 'px' +
          ';background:' + pick(colors) + ';opacity:' + rnd(0.7, 1).toFixed(2) +
          ';--r:' + r.toFixed(0) + 'deg;--r2:' + (r + 540).toFixed(0) + 'deg'
      )
    );
  }
}

const BUILDERS = {
  snow: buildSnow,
  evergreen: buildLights,
  fire: buildEmbers,
  nye: buildConfetti,
};

// Safe to call on every game update: does nothing unless the theme
// actually changed, so the particles aren't rebuilt (and restarted) every
// two seconds.
export function applyTheme(id) {
  const theme = normalizeTheme(id);
  if (theme === applied) {
    return;
  }
  applied = theme;

  const html = document.documentElement;
  if (theme === DEFAULT_THEME) {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', theme);
  }

  const old = document.getElementById(DECOR_ID);
  if (old && old.parentNode) {
    old.parentNode.removeChild(old);
  }
  const build = BUILDERS[theme];
  if (!build) {
    return;
  }
  const decor = document.createElement('div');
  decor.id = DECOR_ID;
  decor.setAttribute('aria-hidden', 'true');
  build(decor);
  document.body.appendChild(decor);
}
