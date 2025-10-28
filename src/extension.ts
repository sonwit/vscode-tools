import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const insertLogDisposable = vscode.commands.registerCommand('vscode-tools.insertLog', async () => {
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
          range = new vscode.Selection(wordRange.start, wordRange.end);
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

  const duplicateDisposable = vscode.commands.registerCommand('vscode-tools.duplicateSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor detected.');
      return;
    }

    const { document } = editor;
    const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';

    type SelectionInfo = {
      index: number;
      selection: vscode.Selection;
      insertedTextLength: number;
      lineInsertionOffset: number;
    };

    const selectionInfos: SelectionInfo[] = editor.selections.map((selection, index) => ({
      index,
      selection,
      insertedTextLength: 0,
      lineInsertionOffset: 0
    }));

    const sorted = selectionInfos.slice().sort((a, b) => {
      if (a.selection.start.line === b.selection.start.line) {
        return b.selection.start.character - a.selection.start.character;
      }

      return b.selection.start.line - a.selection.start.line;
    });

    let didDuplicate = false;
    const lineInsertionCounts = new Map<number, number>();

    await editor.edit(editBuilder => {
      for (const info of sorted) {
        const { selection } = info;

        if (selection.isEmpty) {
          const line = document.lineAt(selection.active.line);
          const insertText = `${eol}${line.text}`;
          editBuilder.insert(line.range.end, insertText);

          const currentCount = lineInsertionCounts.get(selection.active.line) ?? 0;
          const newCount = currentCount + 1;
          lineInsertionCounts.set(selection.active.line, newCount);

          info.lineInsertionOffset = newCount;
          didDuplicate = true;
        } else {
          const selectedText = document.getText(selection);
          if (!selectedText) {
            continue;
          }

          editBuilder.insert(selection.end, selectedText);
          info.insertedTextLength = selectedText.length;
          didDuplicate = true;
        }
      }
    });

    if (!didDuplicate) {
      return;
    }

    const updatedDocument = editor.document;
    const newSelections = selectionInfos
      .sort((a, b) => a.index - b.index)
      .map(info => {
        const { selection, insertedTextLength, lineInsertionOffset } = info;

        if (selection.isEmpty) {
          const originalLine = selection.active.line;
          const targetLine = Math.min(originalLine + lineInsertionOffset, updatedDocument.lineCount - 1);
          const line = updatedDocument.lineAt(targetLine);
          const targetCharacter = Math.min(selection.active.character, line.range.end.character);
          const position = new vscode.Position(targetLine, targetCharacter);
          return new vscode.Selection(position, position);
        }

        const startPosition = selection.end;
        const startOffset = updatedDocument.offsetAt(startPosition);
        const endOffset = startOffset + insertedTextLength;
        const endPosition = updatedDocument.positionAt(endOffset);
        return new vscode.Selection(startPosition, endPosition);
      });

    editor.selections = newSelections;
  });

  context.subscriptions.push(insertLogDisposable, duplicateDisposable);
}

export function deactivate() {
  // Intentionally empty for now.
}
