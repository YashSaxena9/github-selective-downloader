# [Github Selective Downloader](https://github.com/YashSaxena9/github-selective-downloader)

* Sometimes github repositories can be really big and take excess space, while the content actually needed can be quite small.
* Still to get that deeply nested content we need to completely download/clone the repository and then access the content.
* That content can be a file(text, image, code, etc) or a folder.
* so to minimise this hasstle this script can be used to download **only the required content** from github repository.
* The script focuses on efficiency and optimisation along with no data loss, all the files available in github repo can be downloaded easily.

## how to use

* Use the command in the flllowing way
  ```
  $> node index.js "repo link or nested folder(/file) link inside repo" "path/to/download"
  ```
  * or 
  ```
  $> node index.js "repo link or nested folder(/file) link inside repo" 
  // in this case current working directory is used
  ```
* to use globally ```use npm link``` to link this project to global npm package list.