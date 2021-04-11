const fs = require("fs");
const path = require("path");

/**
 * terminates program in case of invalid arguments
 */
const invalidArgs = () => {
  console.error("invalid arguments passed!!");
  console.error("aborting process!!");
  process.exit(0);
};

/**
 * parse thw input provided in var args while running index.js
 * --- ARGS ---
 * NEEDED: link to github file/folder/project
 * OPTIONAL: path to download (current working directory is used by default)
 */
const parseInput = () => {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.length > 2) {
    invalidArgs();
  }
  const info = { destPath: process.cwd() };
  for (let i = 0; i < args.length; i++) {
    const data = args[i];
    if (data.startsWith("https://")) {
      info.url = data;
    } else {
      info.destPath = path.resolve(data);
    }
  }
  if (info.url === undefined) {
    invalidArgs();
  }
  return info;
};

module.exports = { parseInput };
