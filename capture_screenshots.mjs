import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'https://finance.nicolasportie.com';
const EMAIL = 'nicolasportieprofissional@gmail.com';
const SENHA = 'Ni367180@';
const SCREENSHOT_DIR = 'screenshots';

const PAGES = [
  { name: '10_limites',            path: '/limites' },
  { name: '11_metas',              path: '/metas' },
  { name: '12_admin_visao_geral',  path: '/admin' },
  { name: '13_admin_usuarios',     path: '/admin/usuarios' },
  { name: '14_admin_convites',     path: '/admin/convites' },
  { name: '15_admin_seguranca',    path: '/admin/seguranca' },
  { name: '16_perfil',             path: '/perfil' },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--window-size=1920,1080', '--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Login
  console.log('Navigating to login...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="mail"]', { timeout: 10000 });

  // Fill email
  const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="mail"]');
  await emailInput.click({ clickCount: 3 });
  await emailInput.type(EMAIL, { delay: 30 });

  // Fill password
  const senhaInput = await page.$('input[type="password"], input[name="senha"], input[name="password"]');
  await senhaInput.click({ clickCount: 3 });
  await senhaInput.type(SENHA, { delay: 30 });

  // Submit
  const submitBtn = await page.$('button[type="submit"]');
  await submitBtn.click();

  // Wait for dashboard redirect
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  console.log('Logged in. Current URL:', page.url());

  // Capture each page
  for (const p of PAGES) {
    console.log(`Navigating to ${p.path}...`);
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2500)); // wait for animations
    const filePath = `${SCREENSHOT_DIR}/${p.name}.png`;
    await page.screenshot({ path: filePath, type: 'png' });
    console.log(`  Saved: ${filePath}`);
  }

  await browser.close();
  console.log('Done!');
})();
