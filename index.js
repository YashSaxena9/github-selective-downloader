//  dependencies
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

//  local modules
const { parseInput } = require("./utils/inputParser.js");
const { downloadFile } = require("./utils/fileDownloader.js");

const { url, destPath } = parseInput();   //  parsed user input
const toDownload = [];  //  will contains download file info
let browser;  //  global browser

/**
 * calls downloader function to download 
 * the urls present in toDownload array
 * NOTE: to optimise performance, i divided link in groups of fixed size,
 * and downloaded 1 group at a time, though
 * all the files in a group are downloaded parallely,
 * this way browser doesn't hang from too many tabs
 * and we can parallely download files
 * [default group size: 20]
 */
async function downloaderCaller({ username, repoTitle, branch }) {
  for (let i = 0; i < toDownload.length; i++) {
    let j = i;
    const sz = Math.min(i + 20, toDownload.length); //  making combination of serially and parallely
    const batchDownload_p = [];
    while (j < sz) {
      const download_p = downloadFile({
        ...toDownload[j++],
        // useBrowser: browser,   //  uncomment to use [visible] browser to download
        username,
        repoTitle,
        branch,
      });
      batchDownload_p.push(download_p);
    }
    await Promise.all(batchDownload_p);
    i = j - 1;
  }
}

/**
 * open new page and calls
 * parseTree for provided path and href
 */
async function callParser({ href, name, currPath }) {
  const newPage = await browser.newPage();
  await parseTree({
    url: href,
    currPath: path.join(currPath, name),
    page: newPage,
  });
  await newPage.close();
}

/**
 * get current row's required information
 * works parallely
 */
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

/**
 * creates/recreates folder
 * -- creates folders needed to
 * -- deletes folder that are needed to
 * -- doesnot touch Current Working Directory's content(for security of files)
 */
function resolveFolder(currPath) {
  if (fs.existsSync(currPath) && currPath !== process.cwd()) {
    fs.rmdirSync(currPath, { recursive: true, force: true });
  }
  fs.mkdirSync(currPath, { recursive: true });
}

/**
 * parse the file system tree of repo
 * -- visit the current folder
 * -- segregate files and folder links
 * -- recursively parse child folders
 * -- create folder structure in local machine as available on repo
 */
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

/**
 * main function
 * opens a headless browser and calls util methods
 * -- opens browser
 * -- calls to fetch tree structure of repo
 * -- calls downloder function for available files
 */
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


/**
 * main function call
 */
main()
  .then(() => {
    console.log("folder/file download done :)");
    console.log(`path used -> ${destPath}`);
    process.exit(0);
  })
  .catch((err) => {
    console.log(`error: ${err}`);
  });
