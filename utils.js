const fs = require("fs");
const http = require("follow-redirects").http;

function getRemoteFile(file, url, cb) {
  let localFile = fs.createWriteStream(file);
  const _ = http.get(url, function (response) {
    var len = parseInt(response.headers["content-length"], 10);
    var cur = 0;
    var total = len / 1048576; //1048576 - bytes in 1 Megabyte

    response.on("data", function (chunk) {
      cur += chunk.length;
      showProgress(file, cur, len, total);
    });

    response.on("error", (err) => {
      console.error(err);
    });

    response.on("end", function () {
      console.log("Download complete");
      cb();
    });

    response.pipe(localFile);
  });
}

function showProgress(file, cur, len, total) {
  console.log(
    "Downloading " +
      file +
      " - " +
      ((100.0 * cur) / len).toFixed(2) +
      "% (" +
      (cur / 1048576).toFixed(2) +
      " MB) of total size: " +
      total.toFixed(2) +
      " MB"
  );
}

module.exports = {
  getRemoteFile,
  showProgress,
};
