import * as vscode from 'vscode';
import { AgentDemoViewProvider } from './views/agentPanel';
import { registerDuplicateSelectionCommand } from './commands/duplicateSelection';
import { registerGitStashCommand, registerGitStashListCommand } from './commands/gitStash';
import { registerInsertLogCommand } from './commands/insertLog';
import { GitStashViewProvider } from './views/gitStashViewProvider';

export function activate(context: vscode.ExtensionContext) {
  const insertLogDisposable = registerInsertLogCommand();
  const duplicateDisposable = registerDuplicateSelectionCommand();
  const gitStashDisposable = registerGitStashCommand();
  const gitStashListDisposable = registerGitStashListCommand();

  const agentDemoViewProvider = new AgentDemoViewProvider();
  const agentDemoViewDisposable = vscode.window.registerWebviewViewProvider(
    AgentDemoViewProvider.viewType,
    agentDemoViewProvider,
  );

  const gitStashViewProvider = new GitStashViewProvider(context.extensionUri);
  const viewDisposable = vscode.window.registerWebviewViewProvider(
    GitStashViewProvider.viewType,
    gitStashViewProvider,
  );

  const refreshDisposable = vscode.commands.registerCommand(
    'vscode-tools.gitStashRefresh',
    () => gitStashViewProvider.refresh(),
  );
  const openAgentPanelDisposable = vscode.commands.registerCommand(
    'vscode-tools.openAgentPanel',
    () => AgentDemoViewProvider.show(),
  );

  context.subscriptions.push(
    insertLogDisposable,
    duplicateDisposable,
    gitStashDisposable,
    gitStashListDisposable,
    agentDemoViewDisposable,
    viewDisposable,
    refreshDisposable,
    openAgentPanelDisposable,
  );
}

export function deactivate() {
  // Intentionally empty for now.
}
