import {
  mkdirSync,
  existsSync,
  lstatSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve, relative, sep, join, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
export function localDir(path: string) {
  const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim(),
    base = join(repo, ".local"),
    target = resolve(path);
  const rel = relative(base, target);
  if (
    !rel ||
    isAbsolute(rel) ||
    rel.startsWith("..") ||
    resolve(base) === target
  )
    throw new Error("LOCAL_SUBDIRECTORY_REQUIRED");
  let current = repo;
  for (const part of [".local", ...rel.split(sep)]) {
    current = join(current, part);
    if (existsSync(current)) {
      if (
        lstatSync(current).isSymbolicLink() ||
        !lstatSync(current).isDirectory()
      )
        throw new Error("UNSAFE_OUTPUT_PATH");
    } else mkdirSync(current, { mode: 0o700 });
  }
  return target;
}
export function readBoundedJson(path: string, max = 20_000_000): unknown {
  if (statSync(path).size > max) throw new Error("INPUT_TOO_LARGE");
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}
export function writeNew(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
}
