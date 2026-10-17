import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultBuildFile = path.join(scriptDir, "..", "android", "app", "build.gradle");
const buildFile = path.resolve(process.argv[2] ?? defaultBuildFile);
const source = fs.readFileSync(buildFile, "utf8");

const versionCodePattern = /^(\s*versionCode\s+)(\d+)(\s*)$/m;
const versionNamePattern = /^(\s*versionName\s+")(\d+)\.(\d+)\.(\d+)("\s*)$/m;
const versionCodeMatch = source.match(versionCodePattern);
const versionNameMatch = source.match(versionNamePattern);

if (!versionCodeMatch || !versionNameMatch) {
  throw new Error(`Unable to find Android version fields in ${buildFile}`);
}

const nextVersionCode = Number(versionCodeMatch[2]) + 1;
const nextPatchVersion = Number(versionNameMatch[4]) + 1;
const nextVersionName = `${versionNameMatch[2]}.${versionNameMatch[3]}.${nextPatchVersion}`;

const updated = source
  .replace(versionCodePattern, (_, prefix, _versionCode, suffix) =>
    `${prefix}${nextVersionCode}${suffix}`,
  )
  .replace(versionNamePattern, (_, prefix, _major, _minor, _patch, suffix) =>
    `${prefix}${nextVersionName}${suffix}`,
  );

fs.writeFileSync(buildFile, updated);
console.log(`Android version: ${nextVersionCode} (${nextVersionName})`);
