# VS Code Tools

VS Code extension that streamlines a couple of everyday editing tasks:

- Insert a `console.log` for the current selection with `Ctrl+Alt+L` (Windows/Linux) or `Ctrl+Option+L` (macOS).
- Duplicate the current selection, or the whole line when nothing is selected, with `Ctrl+D` (Windows/Linux) or `Ctrl+Cmd+D` (macOS).

## Features
- Works with multi-cursor selections and keeps the cursors on the duplicated content.
- Falls back to the word under each cursor if nothing is selected when inserting logs.

## Development
Install dependencies and compile the extension:

```bash
npm install
npm run compile
```

Launch the extension by pressing `F5` in VS Code to open a new Extension Development Host window.

## Install Locally (VSIX)
Build and install the extension in one command:

```bash
npm install && npm run compile && npx @vscode/vsce package && code --install-extension vscode-tools-0.0.1.vsix
```

This creates `vscode-tools-0.0.1.vsix` and installs it into your local VS Code.

If `code` is not available in your shell, open VS Code and run the command palette action `Shell Command: Install 'code' command in PATH`.
