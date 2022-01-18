const path = require("path");
const fs = require("fs");
const unzipper = require("unzipper");
const { exec } = require("child_process");

const utils = require("./utils.js");

const android = {
  debug: true,
};

const GRADLE_VERSION = "7.3.3";
const GRADLE_URL = `http://downloads.gradle-dn.com/distributions/gradle-${GRADLE_VERSION}-bin.zip`;

const args = process.argv;

const dir = path.join(args[1], process.platform === "win32" ? "..\\" : "../");

var checkPermission = function (file, mask, cb) {
  fs.stat(file, function (error, stats) {
    if (error) {
      cb(error, false);
    } else {
      cb(
        null,
        !!(mask & parseInt((stats.mode & parseInt("777", 8)).toString(8)[0]))
      );
    }
  });
};

async function gradlew(cmd) {
  return gradle(cmd, "gradlew");
}

async function gradle(cmd, terminal = "gradle") {
  const gradleDir = path.join(dir, "dist", `gradle-${GRADLE_VERSION}`, "bin");
  const gradleBuild = path.join(dir, "dist", "build");

  process.env.PATH = process.env.PATH + ":" + gradleDir;

  exec(
    `${terminal} ${cmd}`,
    {
      cwd: gradleBuild,
      env: process.env,
    },
    (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return false;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return false;
      }
      console.log(`stdout: ${stdout}`);
      return true;
    }
  );
}

class Android {
  config = {};

  constructor(config) {
    this.config = config;
    gradle("--version");
  }

  create() {
    return gradle("init") ? this : null;
  }

  wrapper() {
    return gradle("wrapper") ? this : null;
  }

  build() {
    return gradlew("build") ? this : null;
  }
}

if (args[2] === "--g") {
  const zipDest = path.resolve(dir, `gradle-${GRADLE_VERSION}-bin.zip`);
  utils.getRemoteFile(zipDest, GRADLE_URL, () => {
    const _ = fs
      .createReadStream(zipDest)
      .pipe(unzipper.Extract({ path: "dist" }))
      .on("finish", function (err) {
        if (err) throw err;
        fs.unlinkSync(zipDest);
        // fs.writeFile(
        //   path.resolve(dir, "dist", "gradle-7.3.3", "bin", "gradle.properties"),
        //   " \
        //     org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8 \r\n \
        //     android.useAndroidX=true \r\n \
        //     kotlin.code.style=official \r\n \
        //     \
        //     ",
        //   function (err) {
        //     if (err) throw err;
        //     console.log("Completed!");
        //   }
        // );
      });
  });
} else if (args[2] === "--vue") {
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

  if (args[3] === "--build-apk") {
    new Android(android).create().wrapper().build();
  }

  console.table(files);
}
