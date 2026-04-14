import * as vscode from 'vscode';
import { exec } from 'child_process';

function run(cmd: string, cwd: string): Promise<string> {
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

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function registerGitStashCommand() {
  return vscode.commands.registerCommand('vscode-tools.gitStash', async () => {
    const cwd = getWorkspaceRoot();
    if (!cwd) {
      vscode.window.showErrorMessage('No workspace folder open.');
      return;
    }

    // Get changed files
    let status: string;
    try {
      status = await run('git status --porcelain', cwd);
    } catch {
      vscode.window.showErrorMessage('Not a git repository or git is not installed.');
      return;
    }

    if (!status) {
      vscode.window.showInformationMessage('No changes to stash.');
      return;
    }

    const files = status.split('\n').map(line => {
      const statusCode = line.substring(0, 2).trim();
      const filePath = line.substring(3);
      return { statusCode, filePath };
    });

    // Let user pick files or stash all
    const allLabel = '$(check-all) Stash all changes';
    const items: vscode.QuickPickItem[] = [
      { label: allLabel, description: `${files.length} file(s)` },
      { kind: vscode.QuickPickItemKind.Separator, label: 'Or select individual files' },
      ...files.map(f => ({
        label: f.filePath,
        description: f.statusCode,
        picked: false,
      })),
    ];

    const picked = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: 'Select files to stash (or pick "Stash all changes")',
    });

    if (!picked || picked.length === 0) {
      return;
    }

    const stashAll = picked.some(p => p.label === allLabel);
    const selectedFiles = stashAll
      ? []
      : picked.filter(p => p.label !== allLabel && p.kind !== vscode.QuickPickItemKind.Separator).map(p => p.label);

    // Generate default stash name
    let branch = 'unknown';
    try {
      branch = await run('git rev-parse --abbrev-ref HEAD', cwd);
    } catch {
      // keep default
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const defaultName = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${branch}`;

    const name = await vscode.window.showInputBox({
      prompt: 'Stash message',
      value: defaultName,
      placeHolder: 'Enter a name for this stash',
    });

    if (name === undefined) {
      return; // cancelled
    }

    const message = name || defaultName;

    try {
      if (stashAll) {
        await run(`git stash push -m ${escapeShellArg(message)}`, cwd);
      } else {
        const filePaths = selectedFiles.map(f => escapeShellArg(f)).join(' ');
        await run(`git stash push -m ${escapeShellArg(message)} -- ${filePaths}`, cwd);
      }
      vscode.window.showInformationMessage(`Stashed: ${message}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to stash: ${msg}`);
    }
  });
}

export function registerGitStashListCommand() {
  return vscode.commands.registerCommand('vscode-tools.gitStashList', async () => {
    const cwd = getWorkspaceRoot();
    if (!cwd) {
      vscode.window.showErrorMessage('No workspace folder open.');
      return;
    }

    let stashList: string;
    try {
      stashList = await run('git stash list', cwd);
    } catch {
      vscode.window.showErrorMessage('Not a git repository or git is not installed.');
      return;
    }

    if (!stashList) {
      vscode.window.showInformationMessage('No stashes found.');
      return;
    }

    const stashes = stashList.split('\n').map(line => {
      // Format: stash@{0}: On branch: message
      const match = line.match(/^(stash@\{\d+\}):\s*(.+)$/);
      return {
        ref: match?.[1] ?? line,
        description: match?.[2] ?? '',
        fullLine: line,
      };
    });

    const picked = await vscode.window.showQuickPick(
      stashes.map(s => ({
        label: s.ref,
        description: s.description,
      })),
      {
        placeHolder: 'Select a stash to apply, pop, or drop',
      },
    );

    if (!picked) {
      return;
    }

    const action = await vscode.window.showQuickPick(
      [
        { label: '$(debug-step-into) Apply', description: 'Apply stash and keep it', action: 'apply' },
        { label: '$(debug-step-out) Pop', description: 'Apply stash and remove it', action: 'pop' },
        { label: '$(trash) Drop', description: 'Delete stash', action: 'drop' },
        { label: '$(eye) Show', description: 'View stash diff', action: 'show' },
      ],
      { placeHolder: `Action for ${picked.label}` },
    );

    if (!action) {
      return;
    }

    const ref = picked.label;

    try {
      switch ((action as { action: string }).action) {
        case 'apply':
          await run(`git stash apply ${escapeShellArg(ref)}`, cwd);
          vscode.window.showInformationMessage(`Applied ${ref}`);
          break;
        case 'pop':
          await run(`git stash pop ${escapeShellArg(ref)}`, cwd);
          vscode.window.showInformationMessage(`Popped ${ref}`);
          break;
        case 'drop':
          await run(`git stash drop ${escapeShellArg(ref)}`, cwd);
          vscode.window.showInformationMessage(`Dropped ${ref}`);
          break;
        case 'show': {
          const diff = await run(`git stash show -p ${escapeShellArg(ref)}`, cwd);
          const doc = await vscode.workspace.openTextDocument({
            content: diff,
            language: 'diff',
          });
          await vscode.window.showTextDocument(doc, { preview: true });
          break;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Stash ${(action as { action: string }).action} failed: ${msg}`);
    }
  });
}

function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
