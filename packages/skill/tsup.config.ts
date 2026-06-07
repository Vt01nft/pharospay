import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  clean: true,
  // Bundle workspace packages (they ship as TS source); leave npm deps external.
  noExternal: [/@pharospay\//],
  // Note: the shebang from src/server.ts is preserved by tsup; no banner needed.
  target: "node20",
});
