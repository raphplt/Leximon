// The EAS Android worker runs out of memory since Skia joined the native
// build: four ABIs of C++ (Skia, worklets, screens) compiled in parallel next
// to R8 get the Gradle daemon killed. Fewer concurrent workers and phone ABIs
// only keep the build within the worker's memory.
const { withGradleProperties } = require("expo/config-plugins");

const PROPERTIES = {
  "org.gradle.jvmargs": "-Xmx4g -XX:MaxMetaspaceSize=1g",
  "org.gradle.workers.max": "2",
  reactNativeArchitectures: "armeabi-v7a,arm64-v8a",
};

module.exports = function withLeanGradle(config) {
  return withGradleProperties(config, (gradle) => {
    for (const [key, value] of Object.entries(PROPERTIES)) {
      const existing = gradle.modResults.find(
        (item) => item.type === "property" && item.key === key,
      );
      if (existing) existing.value = value;
      else gradle.modResults.push({ type: "property", key, value });
    }
    return gradle;
  });
};
