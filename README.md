# VSCode Logger

VSCode extension that inserts a `console.log` for the selected variable on the next line. Use `Ctrl+Alt+L` (Windows/Linux) or `Ctrl+Option+L` (macOS) to trigger the command.

## Features
- Works with single selections or multi-cursor selections.
- Falls back to the word under the cursor if nothing is selected.

## Development
Install dependencies and compile the extension:

```bash
npm install
npm run compile
```

Launch the extension by pressing `F5` in VS Code to open a new Extension Development Host window.
