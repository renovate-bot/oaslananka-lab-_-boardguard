import fs from "node:fs/promises";
import path from "node:path";

const output = process.argv[2] ?? "boardguard-results/sbom.cdx.json";
const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));
const lockfile = await fs.readFile("pnpm-lock.yaml", "utf8");
const components = [
  ...Object.entries(packageJson.dependencies ?? {}),
  ...Object.entries(packageJson.devDependencies ?? {})
].map(([name, version]) => ({
  type: "library",
  name,
  version: String(version),
  purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(String(version))}`
})).sort((a, b) => a.name.localeCompare(b.name));

const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  version: 1,
  metadata: {
    component: {
      type: "application",
      name: packageJson.name,
      version: packageJson.version
    },
    properties: [
      {
        name: "boardguard:lockfile",
        value: lockfile.includes("lockfileVersion") ? "pnpm-lock.yaml" : "unknown"
      }
    ]
  },
  components
};

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(bom, null, 2)}\n`, "utf8");
