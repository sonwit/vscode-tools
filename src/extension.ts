import * as vscode from 'vscode';
import { registerDuplicateSelectionCommand } from './commands/duplicateSelection';
import { registerGitStashCommand, registerGitStashListCommand } from './commands/gitStash';
import { registerInsertLogCommand } from './commands/insertLog';
import { GitStashViewProvider } from './views/gitStashViewProvider';

export function activate(context: vscode.ExtensionContext) {
  const insertLogDisposable = registerInsertLogCommand();
  const duplicateDisposable = registerDuplicateSelectionCommand();
  const gitStashDisposable = registerGitStashCommand();
  const gitStashListDisposable = registerGitStashListCommand();

  const gitStashViewProvider = new GitStashViewProvider(context.extensionUri);
  const viewDisposable = vscode.window.registerWebviewViewProvider(
    GitStashViewProvider.viewType,
    gitStashViewProvider,
  );

  const refreshDisposable = vscode.commands.registerCommand(
    'vscode-tools.gitStashRefresh',
    () => gitStashViewProvider.refresh(),
  );

  context.subscriptions.push(
    insertLogDisposable,
    duplicateDisposable,
    gitStashDisposable,
    gitStashListDisposable,
    viewDisposable,
    refreshDisposable,
  );
}

export function deactivate() {
  // Intentionally empty for now.
}
