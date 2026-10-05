// The published pages' shared design system: tokens, type, page shell, navigation.
//
// One source for every page on GitHub Pages, so the character sheet, the den and the landing page
// cannot drift into three looks. The palette is taken from the cat (ginger accent, plum-brown ink)
// over a neutral warm ground — the same system as the Design canvas.

export const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">'
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=Silkscreen&display=swap">';

export const BASE_CSS = `
:root{--ground:#f3eee7;--card:#fbf8f3;--well:#efe4d6;--line:#e4dbcf;--ink:#2e1c20;--mute:#6a524a;--accent:#b4501c;
  --display:'Bricolage Grotesque','Helvetica Neue',Arial,sans-serif;--body:'IBM Plex Sans','Helvetica Neue',Arial,sans-serif;
  --label:'Silkscreen','Courier New',monospace}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.6 var(--body);-webkit-font-smoothing:antialiased}
a{color:var(--accent)}a:hover{color:#8f3d14}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px 80px}
nav.top{display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding:22px 0 30px}
nav.top .brand{font:800 22px/1 var(--display);letter-spacing:-.01em;color:var(--ink);text-decoration:none;margin-right:auto}
nav.top a.link{font:13px/1 var(--label);letter-spacing:.05em;color:var(--mute);text-decoration:none;padding:8px 0}
nav.top a.link[aria-current=page]{color:var(--accent)}
nav.top a.link:hover{color:var(--ink)}
section{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:34px;margin-bottom:22px}
h1,h2,h3{font-family:var(--display);margin:0;letter-spacing:-.01em}
h1{font-weight:800;font-size:clamp(34px,6vw,64px);line-height:1.02;margin:6px 0 14px}
h2{font-weight:800;font-size:clamp(24px,3.4vw,34px);line-height:1.1;margin-bottom:8px}
h3{font-weight:600;font-size:18px;margin-bottom:6px}
.kicker{font:13px/1.4 var(--label);letter-spacing:.06em;color:var(--accent);margin:0}
.lede{color:var(--mute);font-size:17px;max-width:68ch;margin:0 0 24px}
.fine{color:var(--mute);font-size:14px;max-width:74ch;margin:18px 0 0}
.pix{image-rendering:pixelated}
.anim{image-rendering:pixelated;background-repeat:no-repeat;background-size:1600% 100%;
  animation:sp 2.4s steps(16,jump-none) infinite}
@keyframes sp{from{background-position:0 0}to{background-position:100% 0}}
@media (prefers-reduced-motion:reduce){.anim{animation:none}}
footer{color:var(--mute);font-size:14px;padding:16px 0}
@media (max-width:640px){section{padding:22px 18px}}
`;

const NAV = [
  ['index.html', 'HOME'], ['character.html', 'CHARACTER'], ['den.html', 'DEN'], ['pet.html', 'LIVE PROTOTYPE'],
];

export function shell({ title, description, current, css = '', body }) {
  const nav = NAV.map(([href, label]) =>
    `<a class="link" href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><meta name="description" content="${description}">
${FONTS}<style>${BASE_CSS}${css}</style></head>
<body><div class="wrap">
<nav class="top" aria-label="Vivier"><a class="brand" href="index.html">Vivier</a>${nav}</nav>
${body}
<footer>A work in progress. These pages are design prototypes, not the finished object —
<a href="https://github.com/wonderjimmy/Vivier">source and the full engineering record on GitHub</a>.</footer>
</div></body></html>`;
}
