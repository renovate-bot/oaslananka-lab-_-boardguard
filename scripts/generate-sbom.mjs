import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const output = process.argv[2] ?? "boardguard-results/sbom.cdx.json";
const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));
const lockfile = await fs.readFile("pnpm-lock.yaml", "utf8");
const lock = YAML.parse(lockfile);
const directDependencies = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {})
]);
const components = Object.entries(lock.packages ?? {}).map(([key, value]) => {
  const parsed = parsePnpmPackageKey(key);
  return {
    type: "library",
    name: parsed.name,
    version: parsed.version,
    purl: `pkg:npm/${encodeURIComponent(parsed.name)}@${encodeURIComponent(parsed.version)}`,
    hashes: hashFor(value),
    scope: directDependencies.has(parsed.name) ? "required" : "optional"
  };
}).filter((component) => component.name && component.version).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

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

function parsePnpmPackageKey(key) {
  const peerless = key.replace(/\(.+\)$/u, "");
  const splitAt = peerless.startsWith("@") ? peerless.lastIndexOf("@") : peerless.indexOf("@");
  if (splitAt <= 0) {
    return { name: peerless, version: "0.0.0" };
  }
  return {
    name: peerless.slice(0, splitAt),
    version: peerless.slice(splitAt + 1)
  };
}

function hashFor(value) {
  const integrity = value?.resolution?.integrity;
  if (typeof integrity !== "string") {
    return undefined;
  }
  const [algorithm, content] = integrity.split("-");
  if (!algorithm || !content) {
    return undefined;
  }
  return [{ alg: algorithm.toUpperCase().replace("SHA", "SHA-"), content }];
}
