// One-time recovery of the failed, logged-out pilot pairing on 2026-11-13.
// Retains the entire old Chromium profile on the same persistent volume.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  renameSync as renameProfile,
} from "node:fs";
import { join, resolve } from "node:path";

export function recoverFailedProfile(root = "/app/.sessions") {
  root = resolve(root);
  if (realpathSync(root) !== root) throw new Error("recovery_root_symlink");
  const backup = join(root, ".nanba-recovery-20261113");
  const destination = join(backup, "session-default");
  const completed = join(backup, "completed");
  if (existsSync(backup) && lstatSync(backup).isSymbolicLink())
    throw new Error("recovery_backup_symlink");
  if (existsSync(completed) || existsSync(destination))
    return { status: "already_preserved" };
  const source = join(root, "webjs", "default", "session-default");
  for (const path of [
    join(root, "webjs"),
    join(root, "webjs", "default"),
    source,
  ]) {
    if (
      existsSync(path) &&
      (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())
    )
      throw new Error("recovery_unexpected_profile_path");
  }
  mkdirSync(backup, { recursive: true, mode: 0o700 });
  if (!existsSync(source)) {
    mkdirSync(completed, { mode: 0o700 });
    return { status: "no_previous_profile" };
  }
  renameProfile(source, destination);
  mkdirSync(completed, { mode: 0o700 });
  return { status: "failed_profile_preserved" };
}
