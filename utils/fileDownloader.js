const fs = require("fs");
const path = require("path");
const { get } = require("https");

const prefixLink = "https://raw.githubusercontent.com";

/**
 * add request listeners on the network tab for current page
 * when get request recieves response of data
 * the recieved data is written inside file
 * (needs file path)
 */
function addRequestListeners({ currPage, filePath }) {
  const responses = [];
  currPage.on("response", (currRes) => {
    responses.push(currRes);
  });
  currPage.on("load", () => {
    responses.map(async (currRes, i) => {
      const buff = await currRes.buffer();
      fs.writeFileSync(filePath, buff);
    });
  });
}

/**
 * downloads url using get request generated in browser
 * (uses a new tab)
 * (a little heavy on machine as opens a new tab inside application)
 */
async function downloadFileUsingBrowser(args) {
  const { name, href, currPath, browser, userInfoPart, branch } = args;
  const currPage = await browser.newPage();
  const filePath = path.join(currPath, name);
  console.log(`downloading ${href}!`);
  addRequestListeners({ currPage, filePath });
  await currPage._client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: currPath,
  });
  const rawLinkSuffix = href.split(branch)[1];
  try {
    await currPage.goto(`${prefixLink}/${userInfoPart}/.${rawLinkSuffix}`);
  } catch (err) {
    console.log(err);
  } finally {
    await currPage.close();
    console.log(`download complete for ${filePath}`);
    return;
  }
}

/**
 * downloads url using get request generated iwithout opening browser
 * (uses a https request inside node/web apis)
 * (very fast and light on machine as no extra browser application opens)
 * [MORE PREFERABLE]
 */
async function downloadFileHeadless(args) {
  const { name, href, currPath, userInfoPart, branch } = args;
  const filePath = path.join(currPath, name);
  const file = fs.createWriteStream(filePath);
  const rawLinkSuffix = href.split(branch)[1];
  const toRequest = `${prefixLink}/${userInfoPart}/.${rawLinkSuffix}`;
  console.log(`downloading ${href}!`);
  await new Promise((resolve, reject) => {
    get(toRequest, (response) => {
      if (response.statusCode === 200) {
        response
          .on("data", (chunk) => {
            file.write(chunk);
          })
          .on("end", () => {
            file.end();
            resolve();
          });
      }
    }).on("error", (err) => {
      console.error(err + " ---> " + toRequest);
    });
  });
  console.log(`download complete for ${filePath}`);
}

/**
 * download file function
 * calls downloader according to the args provided
 * (needs a browser if download is required using browser)
 * (omit the browser if browserless https request is needed)
 */
async function downloadFile(args) {
  const {
    name,
    href,
    currPath,
    useBrowser,
    username,
    repoTitle,
    branch,
  } = args;
  const userInfoPart = `${username}/${repoTitle}/${branch}`;
  const toPass = { name, href, currPath, userInfoPart, branch };
  if (useBrowser !== undefined && useBrowser !== null) {
    await downloadFileUsingBrowser({
      ...toPass,
      browser: useBrowser,
    });
  } else {
    await downloadFileHeadless(toPass);
  }
}

module.exports = { downloadFile };
