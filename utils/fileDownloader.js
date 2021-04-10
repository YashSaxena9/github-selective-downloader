const fs = require("fs");
const path = require("path");
const prefixLink = "https://raw.githubusercontent.com";

const addRequestListeners = ({ currPage, filePath }) => {
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
};

async function downloadFile(args) {
  const { name, href, currPath, browser, userInfo, branch } = args;
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
    await currPage.goto(`${prefixLink}/${userInfo}/.${rawLinkSuffix}`);
  } catch (err) {
    console.log(err);
  } finally {
    await currPage.close();
    console.log(`download complete for ${filePath}`);
    return;
  }
}

module.exports = { downloadFile };
