const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");

const config = require("../config/env");
const { query } = require("../config/db");

const DAY_MS = 24 * 60 * 60 * 1000;

const parseArgs = (argv) => {
  const args = new Set(argv);
  const readValue = (flag) => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return null;
    return argv[idx + 1] ?? null;
  };

  const apply = args.has("--apply");
  const includeLegacy = !args.has("--no-legacy");
  const olderThanDaysRaw = readValue("--older-than-days");
  const olderThanDays = olderThanDaysRaw != null ? Number(olderThanDaysRaw) : null;

  return {
    apply,
    dryRun: !apply,
    includeLegacy,
    olderThanDays: Number.isFinite(olderThanDays) ? olderThanDays : null,
  };
};

const normalizeUrlToRelative = (url) => {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;
  return raw.replace(/^\//, "").replace(/^uploads\//, "");
};

const toPosixRel = (relPath) => {
  return String(relPath).split(path.sep).join("/");
};

const walkFiles = async (rootDir) => {
  const results = [];

  const walk = async (dir) => {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (entry.isFile()) {
        results.push(full);
      }
    }
  };

  await walk(rootDir);
  return results;
};

const isPathInside = (rootDir, candidate) => {
  const rel = path.relative(rootDir, candidate);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));

  const roots = [config.uploadsDir];
  if (opts.includeLegacy && config.legacyUploadsDir && config.legacyUploadsDir !== config.uploadsDir) {
    roots.push(config.legacyUploadsDir);
  }

  const { rows } = await query("SELECT url FROM images");
  const referenced = new Set(
    rows
      .map((r) => normalizeUrlToRelative(r.url))
      .filter(Boolean)
      .map(toPosixRel)
  );

  const thresholdMs =
    opts.olderThanDays != null ? Date.now() - opts.olderThanDays * DAY_MS : null;

  let scanned = 0;
  let candidates = 0;
  let deleted = 0;
  let bytesToFree = 0;

  for (const rootDir of roots) {
    const files = await walkFiles(rootDir);
    scanned += files.length;

    for (const abs of files) {
      if (!isPathInside(rootDir, abs)) continue;

      const rel = toPosixRel(path.relative(rootDir, abs));
      if (!rel || rel === ".") continue;

      if (referenced.has(rel)) continue;

      let stat;
      try {
        stat = await fsp.stat(abs);
      } catch {
        continue;
      }

      if (thresholdMs != null && stat.mtimeMs > thresholdMs) {
        continue;
      }

      candidates += 1;
      bytesToFree += stat.size || 0;

      if (opts.dryRun) {
        console.log(`[dry-run] orphan: ${abs}`);
        continue;
      }

      try {
        await fsp.unlink(abs);
        deleted += 1;
        console.log(`[deleted] ${abs}`);
      } catch (err) {
        console.error(`[failed] ${abs}`, err?.message || err);
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: opts.dryRun ? "dry-run" : "apply",
        uploadsDir: config.uploadsDir,
        legacyUploadsDir: opts.includeLegacy ? config.legacyUploadsDir : null,
        scanned,
        orphanCandidates: candidates,
        deleted,
        bytesToFree,
      },
      null,
      2
    )
  );

  if (!opts.dryRun && deleted !== candidates) {
    process.exitCode = 2;
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
