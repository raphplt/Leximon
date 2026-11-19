// The EAS Android worker (4 vCPUs, 16 GB) runs out of memory since Skia joined
// the native build and the kernel kills the Gradle daemon. Capping Gradle
// workers is not enough: every CMake task runs Ninja with one clang per core
// plus two, so two native modules building side by side already mean a dozen
// heavy C++ compilations next to the daemon, R8 and the Kotlin daemon.
// A Ninja job pool injected into every native module caps clang processes per
// module, and the Kotlin daemon gets a bounded heap.
const { withGradleProperties, withProjectBuildGradle } = require("expo/config-plugins");

const PROPERTIES = {
  "org.gradle.jvmargs": "-Xmx4g -XX:MaxMetaspaceSize=1g",
  "org.gradle.workers.max": "2",
  "kotlin.daemon.jvmargs": "-Xmx2g",
  reactNativeArchitectures: "armeabi-v7a,arm64-v8a",
};

const NATIVE_JOBS_PER_MODULE = 2;
const MARKER = "// leximon: cap parallel C++ compilations";

const CAP_NATIVE_JOBS = `
${MARKER}
subprojects { sub ->
  ["com.android.library", "com.android.application"].each { pluginId ->
    sub.plugins.withId(pluginId) {
      sub.extensions.getByName("androidComponents").finalizeDsl { android ->
        android.defaultConfig.externalNativeBuild.cmake.arguments(
          "-DCMAKE_JOB_POOLS=leximon_compile=${NATIVE_JOBS_PER_MODULE};leximon_link=1",
          "-DCMAKE_JOB_POOL_COMPILE=leximon_compile",
          "-DCMAKE_JOB_POOL_LINK=leximon_link"
        )
      }
    }
  }
}
`;

function withGradleLimits(config) {
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
}

function withNativeJobPool(config) {
  return withProjectBuildGradle(config, (gradle) => {
    if (gradle.modResults.language !== "groovy") {
      throw new Error("with-lean-gradle expects a Groovy android/build.gradle");
    }
    const { contents } = gradle.modResults;
    // Before the root plugins, which evaluate some subprojects early: their
    // DSL would already be finalized when the hook is registered.
    const anchor = 'apply plugin: "expo-root-project"';
    if (!contents.includes(MARKER)) {
      if (!contents.includes(anchor)) {
        throw new Error(`with-lean-gradle: "${anchor}" not found in android/build.gradle`);
      }
      gradle.modResults.contents = contents.replace(anchor, `${CAP_NATIVE_JOBS}\n${anchor}`);
    }
    return gradle;
  });
}

module.exports = function withLeanGradle(config) {
  return withNativeJobPool(withGradleLimits(config));
};
