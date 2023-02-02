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
      '--lang=zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    ],
  });
  const page = await browser.newPage();
  // expose log function
  await page.exposeFunction('log', (value) => console.log(value));
  // Set screen size
  await page.setViewport({ width: 1366, height: 768 });
  // get IP
  console.log('➡️  goto `https://www.whatismyip.com.tw/`');
  await page.goto('https://www.whatismyip.com.tw/', { waitUntil: 'networkidle2' });
  let ip = await page.evaluate(() => {
    return document.querySelector('[data-ip]').getAttribute('data-ip')
  })
  console.log(`🌐  IP: ${ip}`)
  async function fetchPosts({ id = 'gonokamitw', prefix = '' }) {
    // goto picuki
    console.log(`➡️  goto https://www.picuki.com/profile/${id}`);
    await page.goto(`https://www.picuki.com/profile/${id}`, { waitUntil: 'networkidle2' });
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        let totalHeight = 0;
        let distance = Math.floor(Math.random() * 100) + 500;
        let timer = setInterval(() => {
          let scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          log(`🖱  scroll page - ${totalHeight} / ${scrollHeight}`)
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 1000);
      });
    });

    console.log('🧭  parse page');

    // get all post
    let posts = await page.evaluate(() => {
      let posts = document.querySelectorAll('.box-photo');
      posts = [...posts].map(x => {
        try {
          let description = x.querySelector('.photo-description').innerHTML.trim()
          let isLimitedRamen = false
          let limitRamenName = null
          if (description.includes('各位拉麵與沾麵的愛好捧油!!') && description.includes('五之神有夠神')) {
            isLimitedRamen = true
            limitRamenName = isLimitedRamen ? description.match(/本週的限定【(.+?)】/)[1].trim().replace(/\!/g, '') : null
          }
          if (description.includes('限定麵')) {
            isLimitedRamen = true
            limitRamenName = isLimitedRamen ? description.match(/限定麵「(.+?)」/)[1].trim().replace(/\!/g, '') : null
          }
          return {
            img: x.querySelector('.post-image').src,
            description,
            likes: x.querySelector('.likes_photo').innerText.trim(),
            comments: x.querySelector('.comments_photo').innerText.trim(),
            time: x.querySelector('.time').innerText.trim(),
            crawlerTime: new Date().toISOString(),
            isLimitedRamen,
            limitRamenName
          }
        } catch (e) {
          console.log(e)
          return null
        }
      }).filter(x => x !== null)
      return posts
    });
    let existPosts = []
    try {
      existPosts = await fetch(`https://gnehs.github.io/gonokamitw-feed/${prefix}posts.json`).then(x => x.json())
    } catch (e) {
      console.log(`🗄  no exist posts`)
    }
    console.log(`🗄  exist posts: ${existPosts.length}`)
    console.log(`🕸  crawled posts: ${posts.length}(+${posts.length - existPosts.length})`)
    // update time
    posts = posts.map(x => ({ id: hash(x.description), ...x, }))
    existPosts = existPosts.map(x => {
      let post = posts.find(y => y.id === x.id)
      if (post) {
        x.time = post.time
        x.likes = post.likes
        x.comments = post.comments
      }
      return x
    })

    posts = posts
      .filter(x => !existPosts.find(y => y.id === x.id))
      .map(async x => {
        let imgSrc = x.img;
        let imgFileName = x.id + '.jpeg'

        let img = await fetch(imgSrc)
        img = new Buffer.from(await img.arrayBuffer())
        fs.writeFile(`./dist/imgs/${imgFileName}`, img, () => { })

        console.log(`🍜  saved img: ${imgFileName}`)

        return {
          ...x,
          img: `/imgs/${imgFileName}`
        }
      })

    posts = await Promise.all(posts)
    posts = [...posts, ...existPosts]
    fs.writeFileSync(`./dist/${prefix}posts.json`, JSON.stringify(posts));
    // save posts to file
    fs.mkdirSync(`./dist/${prefix}post`, { recursive: true });
    posts.forEach(x => {
      fs.writeFileSync(`./dist/${prefix}post/${x.id}.json`, JSON.stringify(x));
    })

    // copy public file
    fs.copyFileSync('./public/index.html', './dist/index.html')
  }
  fs.mkdirSync('./dist', { recursive: true });
  fs.mkdirSync('./dist/imgs', { recursive: true });
  await fetchPosts({ id: 'gonokamitw' })
  await fetchPosts({ id: 'gonokami_okuyama', prefix: 'okuyama_' })
  await browser.close();
})();