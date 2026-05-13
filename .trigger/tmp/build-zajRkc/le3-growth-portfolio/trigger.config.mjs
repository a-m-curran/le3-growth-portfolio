import {
  defineConfig
} from "../chunk-QB64SHYG.mjs";
import "../chunk-LM4VUS3I.mjs";
import {
  init_esm
} from "../chunk-X37OX4K2.mjs";

// trigger.config.ts
init_esm();
var trigger_config_default = defineConfig({
  project: "proj_hjxwfqkuakbcxrzabspr",
  runtime: "node",
  dirs: ["./src/trigger"],
  // Log level for task runs. "info" is sensible for production;
  // bump to "debug" during pilot troubleshooting.
  logLevel: "info",
  build: {},
  // Default retry policy for tasks that don't override it.
  // The sync task has its own retry config in src/trigger/sync-le3.ts
  // and will use that instead.
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 5e3,
      maxTimeoutInMs: 6e4,
      factor: 2,
      randomize: true
    }
  },
  // Cap the default task duration. Individual tasks can override with
  // maxDuration in their task definition. sync-le3 sets 1800s (30 min).
  maxDuration: 1800
});
var resolveEnvVars = void 0;
export {
  trigger_config_default as default,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map
