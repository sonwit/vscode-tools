import * as vscode from 'vscode';
import { registerDuplicateSelectionCommand } from './commands/duplicateSelection';
import { registerInsertLogCommand } from './commands/insertLog';

export function activate(context: vscode.ExtensionContext) {
  const insertLogDisposable = registerInsertLogCommand();
  const duplicateDisposable = registerDuplicateSelectionCommand();

  context.subscriptions.push(insertLogDisposable, duplicateDisposable);
}

export function deactivate() {
  // Intentionally empty for now.
}
