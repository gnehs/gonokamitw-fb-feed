import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { executablePath } from 'puppeteer';
import fs from 'fs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  // Add stealth plugin and use defaults (all evasion techniques)
  puppeteer.use(StealthPlugin());

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: executablePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--lang=zh-TW',
    ],
  });
  const page = await browser.newPage();

  let facebookCredentials = {
    email: process.env.FB_EMAIL,
    pass: process.env.FB_PASS
  }

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 });
  await page.goto(`https://mbasic.facebook.com/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[name="email"]');
  await page.type('input[name="email"]', facebookCredentials.email);
  await page.type('input[name="pass"]', facebookCredentials.pass);
  await page.click('input[name="login"]');

  await page.waitForSelector(`[value="好"]`)
  await page.click(`[value="好"]`);
  await delay(1000);

  await page.goto(`https://mbasic.facebook.com/gonokamitw`, { waitUntil: 'networkidle2' });
  await page.waitForSelector(`a[href^="/gonokamitw?v=timeline"]`);
  await page.click(`a[href^="/gonokamitw?v=timeline"]`);

  await delay(1000);
  // get all post
  const postIds = await page.evaluate(() => {
    let links = document.querySelectorAll('a[href^="/composer/mbasic/?c_src=share"]');
    links = Array.from(links).map((link) => link.href).map((href) => {
      let searchParams = new URL(href).searchParams
      return { target: searchParams.get('target'), sid: searchParams.get('sid') }
    });
    return links;
  });
  fs.mkdirSync('./dist', { recursive: true });
  fs.writeFileSync('./dist/postIds.json', JSON.stringify(postIds));

  // fetch posts
  for (let post of postIds) {
    console.log(`goto https://mbasic.facebook.com/composer/mbasic/?c_src=share&target=${post.target}&sid=${post.sid}`)
    await page.goto(`https://mbasic.facebook.com/composer/mbasic/?c_src=share&target=${post.target}&sid=${post.sid}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector(`[name="xc_message"]`);
  }





  await browser.close();
})();