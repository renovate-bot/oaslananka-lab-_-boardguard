import { build } from "esbuild";

await build({
  entryPoints: ["src/action/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: false,
  banner: {
    js: "/* BoardGuard bundled GitHub Action entrypoint. Committed intentionally because JavaScript actions execute packaged code from the repository. */"
  }
});
