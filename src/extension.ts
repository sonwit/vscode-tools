import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('vscode-logger.insertLog', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor detected.');
      return;
    }

    const { document } = editor;
    const selections = editor.selections.slice().sort((a, b) => {
      if (a.start.line === b.start.line) {
        return b.start.character - a.start.character;
      }

      return b.start.line - a.start.line;
    });

    let didInsert = false;

    await editor.edit(editBuilder => {
      for (const selection of selections) {
        let range = selection;

        if (range.isEmpty) {
          const wordRange = document.getWordRangeAtPosition(range.start);
          if (!wordRange) {
            continue;
          }
          range = wordRange;
        }

        const variableName = document.getText(range).trim();
        if (!variableName) {
          continue;
        }

        const line = document.lineAt(range.end.line);
        const indentMatch = line.text.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const logText = `\n${indent}console.log('${variableName}: ', ${variableName});`;

        editBuilder.insert(line.range.end, logText);
        didInsert = true;
      }
    });

    if (!didInsert) {
      vscode.window.showInformationMessage('Select a variable to log.');
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {
  // Intentionally empty for now.
}
