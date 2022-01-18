const path = require("path");
const fs = require("fs");
const unzipper = require("unzipper");
const { exec } = require("child_process");

const utils = require("./utils.js");

const android = {
  debug: true,
  appName: "test",
  package: "com.test",
  heapSize: 2048,
  compileSdk: 31,
  targetSdk: 31,
  minSdk: 19,
};

const GRADLE_VERSION = "7.3.3";
const GRADLE_URL = `http://downloads.gradle-dn.com/distributions/gradle-${GRADLE_VERSION}-bin.zip`;

const args = process.argv;

const dir = path.join(args[1], process.platform === "win32" ? "..\\" : "../");

async function gradlew(cmd) {
  return gradle(cmd, "gradlew");
}

async function gradle(cmd, terminal = "gradle") {
  const gradleDir = path.join(dir, "dist", `gradle-${GRADLE_VERSION}`, "bin");
  const gradleBuild = path.join(dir, "dist", "build");

  // Create build directory if not exists
  if (!fs.existsSync(gradleBuild)) {
    fs.mkdirSync(gradleBuild, 0o744);
  }

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

class StringComposer {
  _text = "";
  _tabs = 0;

  constructor(text = "") {
    this._text = text;
  }

  begin(key) {
    if (this._text && this._tabs < 2) {
      this._text += "\r\n";
    }
    for (var i = 0; i < this._tabs; i++) {
      this._text += "    ";
    }
    this._text += `${key} {\r\n`;
    this._tabs += 1;
    return this;
  }

  compose(key, value = "", options = {}) {
    for (var i = 0; i < this._tabs; i++) {
      this._text += "    ";
    }
    if (options.equalSign) {
      value = `= ${value}`;
    }
    if (!value) {
      this._text += `${key}\r\n`;
    } else {
      this._text += `${key} ${value}\r\n`;
    }
    return this;
  }

  end() {
    this._tabs -= 1;
    for (var i = 0; i < this._tabs; i++) {
      this._text += "    ";
    }
    this._text += "}\r\n";
    return this;
  }
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

  async generateProperties() {
    const buildDir = path.join(dir, "dist", "build");
    const filename = path.resolve(dir, "dist", "build", "gradle.properties");

    // Root build.gradle
    var text = new StringComposer()
      .begin("buildscript")
      .compose("ext.kotlin_version", '"1.5.31"', {
        equalSign: true,
      })
      .begin("repositories")
      .compose("google()")
      .compose("mavenCentral()")
      .end()
      .begin("dependencies")
      .compose("classpath", "'com.android.tools.build:gradle:4.2.2'")
      .compose(
        "classpath",
        '"org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"'
      )
      .end()
      .end()
      .begin("allprojects")
      .begin("repositories")
      .compose("google()")
      .compose("mavenCentral()")
      .end()
      .end()
      .begin("task clean(type: Delete)")
      .compose("delete rootProject.buildDir")
      .end();

    if (fs.existsSync(path.resolve(buildDir, "build.gradle"))) {
      fs.unlinkSync(path.resolve(buildDir, "build.gradle"));
    }

    await new Promise((resolve, reject) => {
      fs.writeFile(
        path.resolve(buildDir, "build.gradle"),
        text._text,
        function (err) {
          if (err) reject(err);
          resolve();
        }
      );
    });

    return new Promise((resolve, reject) => {
      if (fs.existsSync(filename) && this.config?.debug) {
        fs.unlinkSync(filename);
      }

      if (!fs.existsSync(filename)) {
        fs.writeFile(
          filename,
          `org.gradle.jvmargs=-Xmx${this.config.heapSize}m -Dfile.encoding=UTF-8 \r\nandroid.useAndroidX=true\r\nkotlin.code.style=official\r\n`,
          function (err) {
            if (err) reject(err);
            resolve();
          }
        );
      }
    });
  }

  async generateApp() {
    const buildDir = path.join(dir, "dist", "build");
    const appDir = path.join(buildDir, "app");
    const settings = path.resolve(buildDir, "settings.gradle");

    // Create build directory if not exists
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, 0o744);
    }

    const srcDir = path.join(appDir, "src");

    // Create src directory if not exists
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, 0o744);
    }

    const mainDir = path.join(srcDir, "main");

    // Create main directory if not exists
    if (!fs.existsSync(mainDir)) {
      fs.mkdirSync(mainDir, 0o744);
    }

    // Create AndroidManifest.xml
    var xml = '<?xml version="1.0" encoding="utf-8"?>\r\n';
    xml += `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools" package="${this.config.package}.worker">`;
    xml +=
      '<application android:allowBackup="true" android:icon="@mipmap/ic_launcher" android:label="@string/app_name" android:roundIcon="@mipmap/ic_launcher_round" android:supportsRtl="true" android:theme="@style/Theme.WorkApp">';
    xml +=
      '<activity android:exported="true" android:name=".ui.login.LoginActivity" android:label="@string/app_name" tools:ignore="Instantiatable"><intent-filter> <action android:name="android.intent.action.MAIN" /> <category android:name="android.intent.category.LAUNCHER" /> </intent-filter></activity></application></manifest>';

    await new Promise((resolve, reject) => {
      fs.writeFile(
        path.resolve(mainDir, "AndroidManifest.xml"),
        xml,
        function (err) {
          if (err) reject(err);
          resolve();
        }
      );
    });

    // Create directory if not exists
    const javaDir = path.join(mainDir, "java");
    if (!fs.existsSync(javaDir)) {
      fs.mkdirSync(javaDir, 0o744);
    }

    const pkg = this.config.package.split(".");
    var pkgDir = javaDir;

    for (var i = 0; i < pkg.length; i++) {
      // Create directory if not exists
      pkgDir = path.join(pkgDir, pkg[i]);
      if (!fs.existsSync(pkgDir)) {
        fs.mkdirSync(pkgDir, 0o744);
      }
    }

    // Create worker directory if not exists
    const workerDir = path.join(pkgDir, "worker");
    if (!fs.existsSync(workerDir)) {
      fs.mkdirSync(workerDir, 0o744);
    }

    // Create libs directory if not exists
    var filename = path.join(appDir, "libs");
    if (!fs.existsSync(filename)) {
      fs.mkdirSync(filename, 0o744);
    }

    if (fs.existsSync(settings)) {
      fs.unlinkSync(settings);
    }

    await new Promise((resolve, reject) => {
      fs.writeFile(
        settings,
        `rootProject.name = "${this.config.appName}"\r\ninclude ':app'`,
        function (err) {
          if (err) reject(err);
          resolve();
        }
      );
    });

    var text = new StringComposer()
      .begin("plugins")
      .compose("id", "'com.android.application'")
      .compose("id", "'kotlin-android'")
      .end()
      .begin("android")
      .compose("compileSdkVersion", this.config.compileSdk)
      .begin("defaultConfig")
      .compose("applicationId", `"${this.config.package}.worker"`)
      .compose("minSdkVersion", this.config.minSdk)
      .compose("targetSdkVersion", this.config.targetSdk)
      .compose("versionCode", 1)
      .compose("versionName", '"1.0"')
      .compose(
        "testInstrumentationRunner",
        '"androidx.test.runner.AndroidJUnitRunner"'
      )
      .compose("multiDexEnabled", true)
      .end()
      .begin("buildTypes")
      .begin("release")
      .compose("minifyEnabled", false)
      .end()
      .end()
      .begin("compileOptions")
      .compose("sourceCompatibility", '"1.8"')
      .compose("targetCompatibility", '"1.8"')
      .end()
      .begin("kotlinOptions")
      .compose("jvmTarget", "'1.8'", {
        equalSign: true,
      })
      .end()
      .begin("buildFeatures")
      .compose("viewBinding", true)
      .end()
      .end()
      .begin("dependencies")
      .compose("implementation", "'com.android.volley:volley:1.2.1'")
      .compose("implementation", "'androidx.core:core-ktx:1.7.0'")
      .compose("implementation", "'androidx.appcompat:appcompat:1.4.0'")
      .compose("implementation", "'com.google.android.material:material:1.4.0'")
      .compose("implementation", "'androidx.annotation:annotation:1.3.0'")
      .compose(
        "implementation",
        "'androidx.constraintlayout:constraintlayout:2.1.2'"
      )
      .compose(
        "implementation",
        "'androidx.lifecycle:lifecycle-livedata-ktx:2.4.0'"
      )
      .compose(
        "implementation",
        "'androidx.lifecycle:lifecycle-viewmodel-ktx:2.4.0'"
      )
      .compose("testImplementation", "'junit:junit:4.13.2'")
      .compose("androidTestImplementation", "'androidx.test.ext:junit:1.1.3'")
      .compose(
        "androidTestImplementation",
        "'androidx.test.espresso:espresso-core:3.4.0'"
      )
      .end();

    if (fs.existsSync(path.resolve(appDir, "build.gradle"))) {
      fs.unlinkSync(path.resolve(appDir, "build.gradle"));
    }

    await new Promise((resolve, reject) => {
      fs.writeFile(
        path.resolve(appDir, "build.gradle"),
        text._text,
        function (err) {
          if (err) reject(err);
          resolve();
        }
      );
    });

    return new Promise((resolve, reject) => {
      fs.writeFile(
        path.resolve(appDir, ".gitignore"),
        "/build",
        function (err) {
          if (err) reject(err);
          resolve();
        }
      );
    });
  }

  async build() {
    // Reference this to scope
    const _this = this;

    // Promises in sequence/series
    return Promise.resolve()
      .then(function () {
        // Generate gradle.properties
        return _this.generateProperties();
      })
      .then(function () {
        // Generate app bundle
        return _this.generateApp();
      })
      .then(function () {
        // Build an application
        return gradlew("assembleDebug");
      })
      .then(function () {
        // Return chain
        return this;
      })
      .catch(null);
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
