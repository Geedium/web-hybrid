const path = require("path");
const fs = require("fs");
const unzipper = require("unzipper");

const utils = require("./utils.js");

const GRADLE_VERSION = "7.3.3";
const GRADLE_URL = `http://downloads.gradle-dn.com/distributions/gradle-${GRADLE_VERSION}-bin.zip`;

const args = process.argv;

const dir = path.join(args[1], process.platform === "win32" ? "..\\" : "../");

if (args[2] === "--g") {
  const zipDest = path.resolve(dir, `gradle-${GRADLE_VERSION}-bin.zip`);
  utils.getRemoteFile(zipDest, GRADLE_URL, () => {
    const _ = fs
      .createReadStream(zipDest)
      .pipe(unzipper.Extract({ path: "dist" }))
      .on("finish", function (err) {
        if (err) throw err;
        fs.unlinkSync(zipDest);
        fs.writeFile(
          path.resolve(dir, "dist", "gradle-7.3.3", "bin", "gradle.properties"),
          " \
            org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8 \r\n \
            android.useAndroidX=true \r\n \
            kotlin.code.style=official \r\n \
            \
            ",
          function (err) {
            if (err) throw err;
            console.log("Completed!");
          }
        );
      });
  });
}

const files = [];

function ThroughDirectory(dir) {
  fs.readdirSync(dir).forEach((file) => {
    const abs = path.join(dir, file);
    if (fs.statSync(abs).isDirectory()) return ThroughDirectory(abs);
    else {
      const name = path.basename(abs);
      if (new RegExp(/.vue$/).test(name)) {
        return files.push(abs);
      }
      return -1;
    }
  });
}

ThroughDirectory(dir);
