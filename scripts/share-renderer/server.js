import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json({ limit: '1mb' }));

const port = process.env.PORT || 4000;

const htmlTemplate = ({ title, tagline, description, auraGradient, cardAccent, textColor, insight, lang }) => `
<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1920px; overflow: hidden; }
    .card {
      position: relative; width: 1080px; height: 1920px;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #fafafa;
      display: flex; flex-direction: column; align-items: center; justify-content: space-between;
      padding: 112px 80px;
    }
    .grid { position:absolute; inset:0; background-image: radial-gradient(#00000010 1px, transparent 1px); background-size: 42px 42px; }
    .a1 { position:absolute; top:-10%; left:0; width:100%; height:50%; opacity:0.55; filter: blur(170px); background: radial-gradient(circle at 40% 30%, rgba(176,144,255,0.9), rgba(124,77,255,0.6), transparent 70%); }
    .a2 { position:absolute; bottom:0; right:0; width:80%; height:40%; opacity:0.45; filter: blur(150px); background: radial-gradient(circle at 65% 70%, rgba(255,205,255,0.65), rgba(160,120,255,0.45), transparent 75%); }
    .shine { position:absolute; inset:0; pointer-events:none; }
    .shine::before { content:''; position:absolute; inset:0; opacity:0.07; background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.7), transparent 50%), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.55), transparent 55%); }
    .corner { position:absolute; width:6px; height:6px; border-color: rgba(148,163,184,0.6); border-style: solid; }
    .tl { top:48px; left:48px; border-width:1.5px 0 0 1.5px; }
    .tr { top:48px; right:48px; border-width:1.5px 1.5px 0 0; }
    .bl { bottom:48px; left:48px; border-width:0 0 1.5px 1.5px; }
    .br { bottom:48px; right:48px; border-width:0 1.5px 1.5px 0; }
    .header, .footer { position:relative; z-index:10; width:100%; display:flex; justify-content:space-between; align-items:center; }
    .header .brand { display:flex; align-items:center; gap:16px; }
    .badge { width:48px; height:48px; border-radius:16px; background:#0f172a; color:white; display:flex; align-items:center; justify-content:center; box-shadow:0 12px 24px rgba(15,23,42,0.2); font-weight:700; }
    .brand-text { display:flex; flex-direction:column; }
    .brand-title { font-weight:900; font-size:24px; letter-spacing:-0.02em; color:#0f172a; }
    .brand-sub { font-family: "SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size:11px; letter-spacing:0.25em; color:#94a3b8; text-transform:uppercase; }
    .date { font-family: "SFMono-Regular", ui-monospace; font-size:14px; letter-spacing:0.2em; color:#94a3b8; }
    .card-frame { position:relative; width:920px; aspect-ratio:3/5; }
    .card-offset { position:absolute; inset:0; border-radius:48px; transform:translate(20px,20px); opacity:0.4; background:${cardAccent}; }
    .card-outline { position:absolute; inset:-20px; border:1px solid rgba(15,23,42,0.08); border-radius:64px; }
    .card-body { position:relative; width:100%; height:100%; border-radius:48px; overflow:hidden; background:white; box-shadow:0 30px 60px -15px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05); }
    .footer-line { width:100%; height:1px; background: linear-gradient(to right, transparent, rgba(148,163,184,0.4), transparent); margin-bottom:24px; }
    .footer { opacity:0.6; font-family:"SFMono-Regular", ui-monospace; }
    .footer .left { display:flex; flex-direction:column; gap:6px; }
    .footer .label { font-size:12px; letter-spacing:0.4em; color:#94a3b8; text-transform:uppercase; }
    .footer .brand { font-weight:700; font-size:20px; letter-spacing:0.15em; color:#0f172a; }
    .sticker { position:absolute; top:-24px; right:-24px; background:white; border:1px solid #e2e8f0; border-radius:999px; padding:10px 18px; box-shadow:0 8px 30px rgba(0,0,0,0.12); transform:rotate(6deg); display:flex; align-items:center; gap:12px; font-family:"SFMono-Regular", ui-monospace; font-weight:700; color:#1f2937; }
    /* GlowtypeCard surface approximation */
    .gt-card { position:absolute; inset:0; padding:32px; display:flex; flex-direction:column; justify-content:space-between; color:${textColor}; }
    .gt-bg { position:absolute; inset:0; background:${auraGradient}; opacity:0.32; filter: blur(70px); }
    .gt-content { position:relative; z-index:2; }
    .gt-title { font-size:48px; font-weight:800; letter-spacing:-0.01em; margin:20px 0; }
    .gt-tag { font-size:18px; font-style:italic; opacity:0.85; margin-bottom:24px; }
    .gt-desc { font-size:20px; line-height:1.5; opacity:0.8; }
    .gt-insight { margin-top:24px; padding-top:16px; border-top:1px solid rgba(0,0,0,0.05); font-size:18px; font-style:italic; opacity:0.75; }
  </style>
</head>
<body>
  <div class="card">
    <div class="grid"></div>
    <div class="a1"></div>
    <div class="a2"></div>
    <div class="shine"></div>
    <div class="corner tl corner"></div>
    <div class="corner tr corner"></div>
    <div class="corner bl corner"></div>
    <div class="corner br corner"></div>

    <div class="header">
      <div class="brand">
        <div class="badge">GT</div>
        <div class="brand-text">
          <div class="brand-title">GLOWTYPE</div>
          <div class="brand-sub">Analysis Report</div>
        </div>
      </div>
      <div class="date">${dateStr()}</div>
    </div>

    <div class="card-frame">
      <div class="card-offset"></div>
      <div class="card-outline"></div>
      <div class="card-body">
        <div class="gt-bg"></div>
        <div class="gt-content">
          <div class="brand-sub" style="margin-bottom:12px; letter-spacing:0.2em; color:#94a3b8;">Glowtype</div>
          <div class="gt-title">${title}</div>
          <div class="gt-tag">${tagline}</div>
          <div class="gt-desc">${description}</div>
          ${insight ? `<div class="gt-insight">“${insight}”</div>` : ''}
        </div>
      </div>
      <div class="sticker">
        <span>SCAN</span>
        <span>#${(Math.abs(title.split('').reduce((h,c)=>h*31+c.charCodeAt(0),7))%900+100)}</span>
      </div>
    </div>

    <div class="footer-line"></div>
    <div class="footer">
      <div class="left">
        <div class="label">Generated by AI</div>
        <div class="brand">GLOWTYPE.ME</div>
      </div>
      <div style="font-size:18px; color:#cbd5e1;">&#9672;</div>
    </div>
  </div>
</body>
</html>
`;

const dateStr = () =>
  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

let browser;
const getBrowser = async () => {
  if (!browser) {
    browser = await chromium.launch({ args: ['--no-sandbox'], headless: true });
  }
  return browser;
};

app.post('/render', async (req, res) => {
  const { data, insight, lang = 'en' } = req.body || {};
  if (!data || !data.title || !data.tagline || !data.description) {
    res.status(400).json({ error: 'invalid payload' });
    return;
  }

  try {
    const html = htmlTemplate({
      title: data.title[lang] || data.title.en || '',
      tagline: data.tagline[lang] || data.tagline.en || '',
      description: data.description[lang] || data.description.en || '',
      auraGradient: data.auraGradient || '#b090ff',
      cardAccent: data.cardAccent || '#7c4dff',
      textColor: data.textColor || '#1f2937',
      insight: insight || '',
      lang,
    });

    const b = await getBrowser();
    const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const buffer = await page.screenshot({ type: 'png' });
    await page.close();

    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error('render error', err);
    res.status(500).json({ error: 'render_failed' });
  }
});

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Share render server listening on ${port}`);
});
