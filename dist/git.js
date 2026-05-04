import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Get git branch and dirty status for the given directory.
 * Returns { branch: string, dirty: boolean } or null if not a git repo.
 */
export async function getGitInfo(cwd) {
  if (!cwd) return null;

  try {
    await execFileAsync('git', ['rev-parse', '--git-dir'], {
      cwd,
      timeout: 2000,
      windowsHide: true,
    });
  } catch {
    return null;
  }

  try {
    const [{ stdout: branchOut }, { stdout: statusOut }] = await Promise.all([
      execFileAsync('git', ['branch', '--show-current'], {
        cwd,
        timeout: 2000,
        encoding: 'utf8',
        windowsHide: true,
      }),
      execFileAsync('git', ['status', '--porcelain'], {
        cwd,
        timeout: 2000,
        encoding: 'utf8',
        windowsHide: true,
      }),
    ]);

    const branch = branchOut.trim();
    if (!branch) return null;

    const dirty = statusOut.trim().length > 0;
    return { branch, dirty };
  } catch {
    return null;
  }
}
