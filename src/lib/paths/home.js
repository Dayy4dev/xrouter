import os from "node:os";

/**
 * The current user's home directory.
 *
 * The value is read through process.env on purpose. `next build` runs
 * @vercel/nft to compute the `output: "standalone"` file trace, and nft
 * constant-folds a bare `os.homedir()` call. It then emits every directory the
 * app derives from it as a traced asset, i.e. it tries to bundle the whole user
 * profile. On Windows that walk descends into the legacy "Application Data"
 * junctions, `scandir` returns EPERM, and the rejection aborts the build:
 *
 *   glob error [Error: EPERM: operation not permitted,
 *     scandir 'C:\Users\<name>\AppData\Local\Application Data']
 *
 * Keeping the lookup behind an env read makes the value opaque to the static
 * analyser while returning exactly the same path at runtime.
 *
 * Use this instead of os.homedir() anywhere the result can reach the filesystem.
 */
export function userHome() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}
