import * as vscode from 'vscode';
import { registerDuplicateSelectionCommand } from './commands/duplicateSelection';
import { registerGitStashCommand, registerGitStashListCommand } from './commands/gitStash';
import { registerInsertLogCommand } from './commands/insertLog';

export function activate(context: vscode.ExtensionContext) {
  const insertLogDisposable = registerInsertLogCommand();
  const duplicateDisposable = registerDuplicateSelectionCommand();
  const gitStashDisposable = registerGitStashCommand();
  const gitStashListDisposable = registerGitStashListCommand();

  context.subscriptions.push(insertLogDisposable, duplicateDisposable, gitStashDisposable, gitStashListDisposable);
}

export function deactivate() {
  // Intentionally empty for now.
}
