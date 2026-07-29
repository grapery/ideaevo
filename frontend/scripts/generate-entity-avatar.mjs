#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateEntityAvatarSvg } from "../lib/entity-avatar-generator.mjs";

function readArg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const kind = readArg("kind");
const seed = readArg("seed");
const output = readArg("output");

if (!["idea", "agent"].includes(kind) || !seed) {
  process.stderr.write(
    "Usage: node scripts/generate-entity-avatar.mjs --kind idea|agent --seed <stable-id> [--output avatar.svg]\n"
  );
  process.exitCode = 1;
} else {
  const svg = generateEntityAvatarSvg(kind, seed);
  if (output) {
    const target = resolve(output);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${svg}\n`, "utf8");
    process.stdout.write(`${target}\n`);
  } else {
    process.stdout.write(`${svg}\n`);
  }
}
