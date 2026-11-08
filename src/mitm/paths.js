// Home dir kept behind an env lookup so @vercel/nft cannot constant-fold it
// and try to bundle the whole user profile (EPERM on Windows junctions).
const userHome = () => process.env.HOME || process.env.USERPROFILE || os.homedir();
const fs = require("fs");
const path = require("path");
const os = require("os");

const APP_NAME = "xrouter";

function defaultDir() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(userHome(), "AppData", "Roaming"), APP_NAME);
  }
  return path.join(userHome(), `.${APP_NAME}`);
}

function getDataDir() {
  const configured = process.env.DATA_DIR;
  if (!configured) return defaultDir();
  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch (e) {
    if (e?.code === "EACCES" || e?.code === "EPERM") {
      console.warn(`[DATA_DIR] '${configured}' not writable → fallback ~/.${APP_NAME}`);
      return defaultDir();
    }
    throw e;
  }
}

const DATA_DIR = getDataDir();
const MITM_DIR = path.join(DATA_DIR, "mitm");
try { fs.mkdirSync(MITM_DIR, { recursive: true }); } catch {}

module.exports = { DATA_DIR, MITM_DIR };
