# VS Code Tools

VS Code extension that streamlines a couple of everyday editing tasks:

- Insert a `console.log` for the current selection with `Ctrl+Alt+L` (Windows/Linux) or `Ctrl+Option+L` (macOS).
- Duplicate the current selection, or the whole line when nothing is selected, with `Ctrl+D` (Windows/Linux) or `Ctrl+Cmd+D` (macOS).
- Open an `Agent Demo` panel with `Ctrl+Alt+Shift+A` (Windows/Linux) or `Ctrl+Option+Shift+A` (macOS).
- **Git Stash sidebar panel** — a dedicated sidebar with a full GUI for git stash management. Select files to stash with checkboxes, enter a message, and browse/apply/pop/drop/diff your stashes without leaving the editor.

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

## Agent Demo
The extension includes a minimal panel-based agent demo that uses the VS Code Language Model API and a single private tool:

- Command: `Open Agent Demo Panel`
- Shortcut: `Ctrl+Alt+Shift+A` on Windows/Linux, `Ctrl+Option+Shift+A` on macOS
- Requirement: access to a VS Code chat model, such as GitHub Copilot

This is intentionally a small first step: the model is asked a question in a panel, it can call `get_current_time`, and the panel shows the tool call/result before the final answer.

## Install Locally (VSIX)
Build and install the extension in one command:

```bash
npm install && npm run compile && npx @vscode/vsce package && code --install-extension vscode-tools-0.0.1.vsix
```

This creates `vscode-tools-0.0.1.vsix` and installs it into your local VS Code.

If `code` is not available in your shell, open VS Code and run the command palette action `Shell Command: Install 'code' command in PATH`.
