import * as vscode from 'vscode';
import { exec } from 'child_process';

export function run(cmd: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

async function getGitRoot(fsPath: string): Promise<string | undefined> {
  try {
    return await run('git rev-parse --show-toplevel', fsPath);
  } catch {
    return undefined;
  }
}

export async function getWorkspaceGitRoot(): Promise<string | undefined> {
  const seen = new Set<string>();
  const candidateFolders: string[] = [];

  const activeEditorPath = vscode.window.activeTextEditor?.document.uri.fsPath;
  if (activeEditorPath) {
    const activeFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(activeEditorPath));
    if (activeFolder) {
      candidateFolders.push(activeFolder.uri.fsPath);
      seen.add(activeFolder.uri.fsPath);
    }
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    if (!seen.has(folder.uri.fsPath)) {
      candidateFolders.push(folder.uri.fsPath);
      seen.add(folder.uri.fsPath);
    }
  }

  for (const folder of candidateFolders) {
    const gitRoot = await getGitRoot(folder);
    if (gitRoot) {
      return gitRoot;
    }
  }

  return undefined;
}
