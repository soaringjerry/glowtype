import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json({ limit: '1mb' }));

const port = process.env.PORT || 4000;
// inside docker: frontend hostname is "frontend"; fallback to localhost
const frontendRenderBase = process.env.FRONTEND_RENDER_URL || 'http://frontend';

let browser;
const getBrowser = async () => {
  if (!browser) {
    browser = await chromium.launch({ args: ['--no-sandbox'], headless: true });
  }
  return browser;
};

const makePayload = (data, insight, lang) =>
  Buffer.from(JSON.stringify({ data, insight, lang })).toString('base64');

app.post('/render', async (req, res) => {
  const { data, insight, lang = 'en' } = req.body || {};
  if (!data || !data.title || !data.tagline || !data.description) {
    res.status(400).json({ error: 'invalid payload' });
    return;
  }

  try {
    const payload = makePayload(data, insight, lang);
    const targetUrl = `${frontendRenderBase.replace(/\/$/, '')}/share-render?payload=${encodeURIComponent(payload)}`;

    const b = await getBrowser();
    const page = await b.newPage({ viewport: { width: 1080, height: 1080 } });
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    const card = await page.$('#share-card-render');
    const buffer = card
      ? await card.screenshot({ type: 'png' })
      : await page.screenshot({ type: 'png' });
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
  console.log(`Share render server listening on ${port}, using frontend ${frontendRenderBase}`);
});
