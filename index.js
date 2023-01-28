import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { executablePath } from 'puppeteer';
import fs from 'fs';
import fetch from 'node-fetch';
import crypto from 'crypto';

function hash(str, salt = 'salt') {
  const hash = crypto.createHash('sha256')
  hash.update(str.toString() + salt, 'utf8')
  return hash.digest('hex').slice(0, 8)
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  // Add stealth plugin and use defaults (all evasion techniques)
  puppeteer.use(StealthPlugin());

  const browser = await puppeteer.launch({
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

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 });
  // get IP
  await page.goto('https://www.whatismyip.com.tw/', { waitUntil: 'networkidle2' });
  let ip = await page.evaluate(() => {
    return document.querySelector('[data-ip]').getAttribute('data-ip')
  })
  console.log(`🌐  IP: ${ip}`)
  // goto picuki
  console.log('➡️  goto `https://www.picuki.com/profile/gonokamitw`');
  await page.goto(`https://www.picuki.com/profile/gonokamitw`, { waitUntil: 'networkidle2' });
  console.log('🖱  scroll page');
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0;
      let distance = 100;
      let timer = setInterval(() => {
        let scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
      }, 100);
      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, 10000);
    });
  });

  console.log('🧭  parse page');

  fs.mkdirSync('./dist', { recursive: true });
  fs.mkdirSync('./dist/imgs', { recursive: true });
  // get all post
  let posts = await page.evaluate(() => {
    let posts = document.querySelectorAll('.box-photo');
    posts = [...posts].map(x => {
      try {
        return {
          img: x.querySelector('.post-image').src,
          description: x.querySelector('.photo-description').innerHTML.trim(),
          likes: x.querySelector('.likes_photo').innerText.trim(),
          time: x.querySelector('.time').innerText.trim(),
          crawlerTime: new Date().toISOString()
        }
      } catch (e) {
        return null
      }
    }).filter(x => x !== null)
    return posts
  });
  posts = posts.map(async x => {
    let id = hash(x.description)
    let imgSrc = x.img;
    let imgFileName = id + '.jpeg'

    let img = await fetch(imgSrc)
    img = new Buffer.from(await img.arrayBuffer())
    fs.writeFile(`./dist/imgs/${imgFileName}`, img, () => { })

    console.log(`🍜  saved img: ${imgFileName}`)

    return {
      id,
      ...x,
      img: `/imgs/${imgFileName}`
    }
  })
  posts = await Promise.all(posts)
  console.log(`🗄  posts: ${posts.length}`)
  fs.writeFileSync('./dist/posts.json', JSON.stringify(posts));
  // save posts to file
  fs.mkdirSync('./dist/post', { recursive: true });
  posts.forEach(x => {
    fs.writeFileSync(`./dist/post/${x.id}.json`, JSON.stringify(x));
  })
  // create README.md
  let readme = fs.readFileSync('./README.md', 'utf8')
  let latestPost = posts[0]
  readme += '## 最新貼文\n'
  readme += `![](https://github.com/gnehs/gonokamitw-feed/blob/gh-pages${latestPost.img}?raw=true)\n`
  readme += `${latestPost.description}\n`
  readme += `👍 \`${latestPost.likes}\` 🕒 \`${latestPost.time}\``
  fs.writeFileSync('./dist/README.md', readme)

  await browser.close();
})();