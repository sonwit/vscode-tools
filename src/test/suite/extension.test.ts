import * as assert from 'assert';
import * as vscode from 'vscode';

async function withTestEditor(
  initialContent: string,
  callback: (editor: vscode.TextEditor) => Thenable<void> | void
) {
  const document = await vscode.workspace.openTextDocument({
    language: 'javascript',
    content: initialContent
  });
  const editor = await vscode.window.showTextDocument(document);

  try {
    await callback(editor);
  } finally {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  }
}

suite('VSCode Tools Extension', () => {
  test('Insert Log: adds console.log for selected identifier', async () => {
    await withTestEditor('const foo = 1;', async editor => {
      const selection = new vscode.Selection(new vscode.Position(0, 6), new vscode.Position(0, 9));
      editor.selection = selection;

      await vscode.commands.executeCommand('vscode-tools.insertLog');

      const text = editor.document.getText();
      assert.strictEqual(text, "const foo = 1;\nconsole.log('foo: ', foo);");
    });
  });

  test('Duplicate Selection: duplicates highlighted text and updates selection', async () => {
    await withTestEditor('const value = 42;', async editor => {
      const selection = new vscode.Selection(new vscode.Position(0, 6), new vscode.Position(0, 11));
      editor.selection = selection;

      await vscode.commands.executeCommand('vscode-tools.duplicateSelection');

      const text = editor.document.getText();
      assert.strictEqual(text, 'const valuevalue = 42;');

      const [updatedSelection] = editor.selections;
      assert.strictEqual(updatedSelection.start.line, 0);
      assert.strictEqual(updatedSelection.start.character, 11);
      assert.strictEqual(updatedSelection.end.line, 0);
      assert.strictEqual(updatedSelection.end.character, 16);
    });
  });

  test('Duplicate Selection: duplicates current line when selection is empty', async () => {
    await withTestEditor('first line\nsecond line', async editor => {
      const position = new vscode.Position(0, 2);
      const selection = new vscode.Selection(position, position);
      editor.selection = selection;

      await vscode.commands.executeCommand('vscode-tools.duplicateSelection');

      const text = editor.document.getText();
      assert.strictEqual(text, 'first line\nfirst line\nsecond line');

      const [updatedSelection] = editor.selections;
      assert.strictEqual(updatedSelection.active.line, 1);
      assert.strictEqual(updatedSelection.active.character, 2);
    });
  });
});
