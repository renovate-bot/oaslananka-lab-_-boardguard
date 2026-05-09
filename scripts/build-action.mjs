import { build } from "esbuild";

await build({
  entryPoints: ["src/action/index.ts"],
  outfile: "dist/index.cjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  sourcemap: false,
  banner: {
    js: "/* BoardGuard bundled GitHub Action entrypoint. Committed intentionally because JavaScript actions execute packaged code from the repository. */"
  }
});
