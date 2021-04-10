const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { parseInput } = require("./utils/inputParser.js");
const { downloadFile } = require("./utils/fileDownloader.js");

const { url, destPath } = parseInput();
const toDownload = [];
let browser;

/**
 * to optimise performance, i divided link in groups of fixed size,
 * and downloaded 1 group at a time, though
 * all the files in a group are downloaded parallely,
 * this way browser doesn't hang from too many tabs
 * and we can parallely download files
 * [default group size: 10]
 */
async function downloaderCaller({ username, repoTitle, branch }) {
  for (let i = 0; i < toDownload.length; i++) {
    let j = i;
    const sz = Math.min(i + 10, toDownload.length); //  making combination of serially and parallely
    const batchDownload_p = [];
    while (j < sz) {
      const download_p = downloadFile({
        ...toDownload[j++],
        browser,
        userInfo: `${username}/${repoTitle}/${branch}`,
        branch,
      });
      batchDownload_p.push(download_p);
    }
    await Promise.all(batchDownload_p);
    i = j - 1;
  }
}

async function callParser({ href, name, currPath }) {
  const newPage = await browser.newPage();
  await parseTree({
    url: href,
    currPath: path.join(currPath, name),
    page: newPage,
  });
  await newPage.close();
}

async function getRowData({ page, currRow }) {
  await page.waitForSelector('div[role="gridcell"]:nth-child(1) svg');
  const [isFolder, { name, href }] = await Promise.all([
    currRow.$eval('div[role="gridcell"]:nth-child(1) svg', (svg) => {
      const value = svg.getAttribute("aria-label");
      return value === "Directory";
    }),
    currRow.$eval("div[role='rowheader']", (ele) => {
      return {
        name: ele.innerText.trim(),
        href: ele.children[0].children[0].href,
      };
    }),
  ]);
  return { isFolder, name, href };
}

function resolveFolder(currPath) {
  if (fs.existsSync(currPath) && currPath !== process.cwd()) {
    fs.rmdirSync(currPath, { recursive: true, force: true });
  }
  fs.mkdirSync(currPath, { recursive: true });
}

async function parseTree({ url, currPath, page }) {
  console.log(`creating/recreating path: ${currPath}`);
  await page.goto(url);
  resolveFolder(currPath);
  await page.waitForSelector(".Box-row");
  const itemRows = await page.$$(".Box-row");
  const folders = [];
  //  potential parallel spot
  for (let i = 0; i < itemRows.length; i++) {
    const currRow = itemRows[i];
    const toSkip = await page.evaluate((ele) => {
      return ele.innerText === ". .";
    }, currRow);
    if (toSkip) {
      continue;
    }
    const { isFolder, name, href } = await getRowData({ page, currRow });
    if (isFolder) {
      folders.push({ name, href });
    } else {
      toDownload.push({ name, href, currPath });
    }
  }
  const folderVisiter_p = [];
  for (let i = 0; i < folders.length; i++) {
    const { href, name } = folders[i];
    const parseFolder_p = callParser({ href, name, currPath });
    folderVisiter_p.push(parseFolder_p);
  }
  await Promise.all(folderVisiter_p);
}

async function main() {
  browser = await puppeteer.launch({
    headless: true,
  });
  const [page] = await browser.pages();
  const splitLink = url.split("/");
  const userInfo = {
    username: splitLink[3],
    repoTitle: splitLink[4],
    branch: splitLink[6] || "master",
  };
  console.log(
    "---------------------------- creating folder's tree structure & parsing links ----------------------------"
  );
  await parseTree({ url, page, currPath: destPath });
  await browser.close();
  console.log(
    "---------------------------- downloading files ----------------------------"
  );
  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: false,
  });
  await downloaderCaller(userInfo);
  await browser.close();
}

main()
  .then(() => {
    console.log("folder/file download done :)");
    console.log(`path used -> ${destPath}`);
    process.exit(0);
  })
  .catch((err) => {
    console.log(`error: ${err}`);
  });
