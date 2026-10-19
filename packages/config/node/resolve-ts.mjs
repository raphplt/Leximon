// Lets Node run the repository's TypeScript scripts directly (type stripping, Node 24). Internal
// packages import their sources without extension, which Node's resolver refuses on its own:
// this hook retries a relative import with ".ts", then "/index.ts".
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith(".") || error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
      for (const suffix of [".ts", "/index.ts"]) {
        try {
          return nextResolve(specifier + suffix, context);
        } catch {
          // Try the next suffix.
        }
      }
      throw error;
    }
  },
});
