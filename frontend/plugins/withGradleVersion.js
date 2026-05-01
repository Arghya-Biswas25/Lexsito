const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withGradleVersion(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const wrapperPath = path.join(
        config.modRequest.platformProjectRoot,
        "gradle/wrapper/gradle-wrapper.properties"
      );
      if (fs.existsSync(wrapperPath)) {
        let content = fs.readFileSync(wrapperPath, "utf8");
        content = content.replace(
          /distributionUrl=.+/,
          "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.13-bin.zip"
        );
        fs.writeFileSync(wrapperPath, content);
      }
      return config;
    },
  ]);
};
