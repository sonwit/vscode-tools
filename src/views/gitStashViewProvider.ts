import * as vscode from 'vscode';
import { escapeShellArg, getWorkspaceGitRoot, run } from '../utils/git';

interface StashEntry {
  ref: string;
  index: number;
  branch: string;
  message: string;
}

interface ChangedFile {
  statusCode: string;
  filePath: string;
}

export class GitStashViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vscode-tools.gitStashView';

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'refresh':
          await this._sendState();
          break;
        case 'stash':
          await this._stashFiles(msg.files, msg.message);
          break;
        case 'apply':
          await this._stashAction('apply', msg.ref);
          break;
        case 'pop':
          await this._stashAction('pop', msg.ref);
          break;
        case 'drop':
          await this._stashAction('drop', msg.ref);
          break;
        case 'show':
          await this._showStashDiff(msg.ref);
          break;
      }
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._sendState();
      }
    });

    this._sendState();
  }

  public refresh() {
    this._sendState();
  }

  private async _getCwd(): Promise<string | undefined> {
    return getWorkspaceGitRoot();
  }

  private async _sendState() {
    if (!this._view) return;

    const cwd = await this._getCwd();
    if (!cwd) {
      this._view.webview.postMessage({ type: 'state', error: 'No git repository found in the current workspace.' });
      return;
    }

    try {
      const [statusOutput, stashOutput, branchOutput] = await Promise.all([
        run('git status --porcelain', cwd).catch(() => ''),
        run('git stash list', cwd).catch(() => ''),
        run('git rev-parse --abbrev-ref HEAD', cwd).catch(() => 'unknown'),
      ]);

      const changedFiles: ChangedFile[] = statusOutput
        ? statusOutput.split('\n').map(line => ({
            statusCode: line.substring(0, 2).trim(),
            filePath: line.substring(3),
          }))
        : [];

      const stashes: StashEntry[] = stashOutput
        ? stashOutput.split('\n').map(line => {
            const match = line.match(/^stash@\{(\d+)\}:\s*(?:On\s+(\S+):\s*)?(.+)$/);
            return {
              ref: `stash@{${match?.[1] ?? '0'}}`,
              index: parseInt(match?.[1] ?? '0', 10),
              branch: match?.[2] ?? '',
              message: match?.[3] ?? line,
            };
          })
        : [];

      this._view.webview.postMessage({
        type: 'state',
        changedFiles,
        stashes,
        branch: branchOutput,
      });
    } catch {
      this._view.webview.postMessage({ type: 'state', error: 'Not a git repository.' });
    }
  }

  private async _stashFiles(files: string[] | null, message: string) {
    const cwd = await this._getCwd();
    if (!cwd) return;

    try {
      if (!files || files.length === 0) {
        await run(`git stash push -m ${escapeShellArg(message)}`, cwd);
      } else {
        const paths = files.map(f => escapeShellArg(f)).join(' ');
        await run(`git stash push -m ${escapeShellArg(message)} -- ${paths}`, cwd);
      }
      vscode.window.showInformationMessage(`Stashed: ${message}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to stash: ${msg}`);
    }

    await this._sendState();
  }

  private async _stashAction(action: 'apply' | 'pop' | 'drop', ref: string) {
    const cwd = await this._getCwd();
    if (!cwd) return;

    try {
      await run(`git stash ${action} ${escapeShellArg(ref)}`, cwd);
      vscode.window.showInformationMessage(
        `${action.charAt(0).toUpperCase() + action.slice(1)}: ${ref}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Stash ${action} failed: ${msg}`);
    }

    await this._sendState();
  }

  private async _showStashDiff(ref: string) {
    const cwd = await this._getCwd();
    if (!cwd) return;

    try {
      const diff = await run(`git stash show -p ${escapeShellArg(ref)}`, cwd);
      const doc = await vscode.workspace.openTextDocument({
        content: diff,
        language: 'diff',
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to show stash: ${msg}`);
    }
  }

  private _getHtml(): string {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  :root {
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 12px;
    --spacing-lg: 16px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    padding: var(--spacing-md);
  }

  h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
    margin-bottom: var(--spacing-sm);
    font-weight: 600;
  }

  .section {
    margin-bottom: var(--spacing-lg);
  }

  /* Stash form */
  .stash-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .message-row {
    display: flex;
    gap: var(--spacing-xs);
  }

  .message-row input {
    flex: 1;
    padding: 4px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    font-size: var(--vscode-font-size);
    font-family: var(--vscode-font-family);
    outline: none;
  }

  .message-row input:focus {
    border-color: var(--vscode-focusBorder);
  }

  .message-row input::placeholder {
    color: var(--vscode-input-placeholderForeground);
  }

  button {
    padding: 4px 12px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-size: var(--vscode-font-size);
    font-family: var(--vscode-font-family);
    white-space: nowrap;
  }

  button:hover {
    background: var(--vscode-button-hoverBackground);
  }

  button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }

  button.secondary:hover {
    background: var(--vscode-button-secondaryHoverBackground);
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* File list */
  .file-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    border-radius: 2px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 3px var(--spacing-sm);
    cursor: pointer;
    user-select: none;
  }

  .file-item:hover {
    background: var(--vscode-list-hoverBackground);
  }

  .file-item input[type="checkbox"] {
    accent-color: var(--vscode-checkbox-background);
    cursor: pointer;
  }

  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  .file-status {
    font-size: 11px;
    font-weight: 600;
    min-width: 16px;
    text-align: center;
  }

  .file-status.modified { color: var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d); }
  .file-status.added { color: var(--vscode-gitDecoration-untrackedResourceForeground, #73c991); }
  .file-status.deleted { color: var(--vscode-gitDecoration-deletedResourceForeground, #c74e39); }
  .file-status.untracked { color: var(--vscode-gitDecoration-untrackedResourceForeground, #73c991); }

  .select-bar {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) 0;
    font-size: 11px;
  }

  .select-bar a {
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    text-decoration: none;
  }

  .select-bar a:hover {
    text-decoration: underline;
  }

  /* Stash entries */
  .stash-entry {
    border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent));
    border-radius: 4px;
    margin-bottom: var(--spacing-sm);
    overflow: hidden;
  }

  .stash-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    cursor: pointer;
  }

  .stash-header:hover {
    background: var(--vscode-list-hoverBackground);
  }

  .stash-index {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    min-width: 16px;
  }

  .stash-message {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  .stash-branch {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 1px 6px;
    border-radius: 8px;
    white-space: nowrap;
  }

  .stash-actions {
    display: flex;
    gap: var(--spacing-xs);
    padding: 0 var(--spacing-sm) var(--spacing-sm);
  }

  .stash-actions button {
    flex: 1;
    padding: 3px 8px;
    font-size: 11px;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    background: transparent;
    color: var(--vscode-foreground);
    border-radius: 3px;
    font-size: 14px;
  }

  .icon-btn:hover {
    background: var(--vscode-toolbar-hoverBackground);
  }

  /* Empty state */
  .empty {
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    text-align: center;
    padding: var(--spacing-lg) var(--spacing-sm);
  }

  .error-msg {
    color: var(--vscode-errorForeground);
    font-size: 12px;
    padding: var(--spacing-sm);
  }

  .loading {
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    padding: var(--spacing-lg);
    text-align: center;
  }
</style>
</head>
<body>

<div id="loading" class="loading">Loading...</div>

<div id="error" class="error-msg" style="display:none"></div>

<div id="content" style="display:none">
  <!-- Save Stash Section -->
  <div class="section">
    <h3>Save Changes</h3>
    <div class="stash-form">
      <div class="message-row">
        <input type="text" id="stashMessage" placeholder="Stash message (auto-generated if empty)">
        <button id="stashBtn" title="Stash selected files (or all if none selected)">Stash</button>
      </div>
      <div id="noChanges" class="empty" style="display:none">No uncommitted changes</div>
      <div id="fileSection" style="display:none">
        <div class="select-bar">
          <a id="selectAll">Select all</a>
          <a id="selectNone">Select none</a>
          <span id="selectedCount" style="margin-left:auto; color: var(--vscode-descriptionForeground)"></span>
        </div>
        <div class="file-list" id="fileList"></div>
      </div>
    </div>
  </div>

  <!-- Stash List Section -->
  <div class="section">
    <h3>Stashes</h3>
    <div id="noStashes" class="empty" style="display:none">No stashes</div>
    <div id="stashList"></div>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();

  const els = {
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    content: document.getElementById('content'),
    stashMessage: document.getElementById('stashMessage'),
    stashBtn: document.getElementById('stashBtn'),
    noChanges: document.getElementById('noChanges'),
    fileSection: document.getElementById('fileSection'),
    fileList: document.getElementById('fileList'),
    selectAll: document.getElementById('selectAll'),
    selectNone: document.getElementById('selectNone'),
    selectedCount: document.getElementById('selectedCount'),
    noStashes: document.getElementById('noStashes'),
    stashList: document.getElementById('stashList'),
  };

  let state = { changedFiles: [], stashes: [], branch: '' };
  let expandedStash = null;

  function statusClass(code) {
    if (code === 'M' || code === 'MM') return 'modified';
    if (code === 'A') return 'added';
    if (code === 'D') return 'deleted';
    if (code === '??' || code === '?') return 'untracked';
    return 'modified';
  }

  function statusLabel(code) {
    if (code === 'M' || code === 'MM') return 'M';
    if (code === 'A') return 'A';
    if (code === 'D') return 'D';
    if (code === '??' || code === '?') return 'U';
    return code;
  }

  function updateSelectedCount() {
    const boxes = els.fileList.querySelectorAll('input[type="checkbox"]');
    const checked = Array.from(boxes).filter(b => b.checked).length;
    const total = boxes.length;
    if (checked === 0) {
      els.selectedCount.textContent = 'All files (none selected)';
      els.stashBtn.textContent = 'Stash All';
    } else {
      els.selectedCount.textContent = checked + ' of ' + total + ' selected';
      els.stashBtn.textContent = 'Stash (' + checked + ')';
    }
  }

  function render() {
    // Changed files
    if (state.changedFiles.length === 0) {
      els.noChanges.style.display = '';
      els.fileSection.style.display = 'none';
      els.stashBtn.disabled = true;
    } else {
      els.noChanges.style.display = 'none';
      els.fileSection.style.display = '';
      els.stashBtn.disabled = false;

      els.fileList.innerHTML = state.changedFiles.map((f, i) => {
        const cls = statusClass(f.statusCode);
        const label = statusLabel(f.statusCode);
        const fileName = f.filePath.split('/').pop();
        const dir = f.filePath.includes('/') ? f.filePath.substring(0, f.filePath.lastIndexOf('/')) : '';
        return '<div class="file-item" data-index="' + i + '">'
          + '<input type="checkbox" data-index="' + i + '">'
          + '<span class="file-status ' + cls + '">' + label + '</span>'
          + '<span class="file-name" title="' + f.filePath + '">' + fileName
          + (dir ? ' <span style="color:var(--vscode-descriptionForeground)">' + dir + '</span>' : '')
          + '</span>'
          + '</div>';
      }).join('');

      // Click row to toggle checkbox
      els.fileList.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.type === 'checkbox') {
            updateSelectedCount();
            return;
          }
          const cb = item.querySelector('input[type="checkbox"]');
          cb.checked = !cb.checked;
          updateSelectedCount();
        });
      });

      updateSelectedCount();
    }

    // Stash list
    if (state.stashes.length === 0) {
      els.noStashes.style.display = '';
      els.stashList.innerHTML = '';
    } else {
      els.noStashes.style.display = 'none';
      els.stashList.innerHTML = state.stashes.map(s => {
        const expanded = expandedStash === s.ref;
        return '<div class="stash-entry">'
          + '<div class="stash-header" data-ref="' + s.ref + '">'
          + '<span class="stash-index">#' + s.index + '</span>'
          + '<span class="stash-message" title="' + s.message.replace(/"/g, '&quot;') + '">' + s.message + '</span>'
          + (s.branch ? '<span class="stash-branch">' + s.branch + '</span>' : '')
          + '</div>'
          + (expanded
            ? '<div class="stash-actions">'
              + '<button class="secondary" data-action="show" data-ref="' + s.ref + '" title="View diff">Diff</button>'
              + '<button class="secondary" data-action="apply" data-ref="' + s.ref + '" title="Apply and keep">Apply</button>'
              + '<button data-action="pop" data-ref="' + s.ref + '" title="Apply and remove">Pop</button>'
              + '<button class="secondary" data-action="drop" data-ref="' + s.ref + '" title="Delete stash" style="color:var(--vscode-errorForeground)">Drop</button>'
              + '</div>'
            : '')
          + '</div>';
      }).join('');

      // Toggle expand on click
      els.stashList.querySelectorAll('.stash-header').forEach(hdr => {
        hdr.addEventListener('click', () => {
          const ref = hdr.dataset.ref;
          expandedStash = expandedStash === ref ? null : ref;
          render();
        });
      });

      // Action buttons
      els.stashList.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          vscode.postMessage({ type: btn.dataset.action, ref: btn.dataset.ref });
        });
      });
    }
  }

  // Stash button
  els.stashBtn.addEventListener('click', () => {
    const boxes = els.fileList.querySelectorAll('input[type="checkbox"]:checked');
    const files = Array.from(boxes)
      .map(b => state.changedFiles[Number(b.dataset.index)]?.filePath)
      .filter(Boolean);
    const message = els.stashMessage.value.trim();

    vscode.postMessage({
      type: 'stash',
      files: files.length > 0 ? files : null,
      message: message || defaultMessage(),
    });

    els.stashMessage.value = '';
  });

  function defaultMessage() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate())
      + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())
      + ' ' + (state.branch || 'unknown');
  }

  // Select all / none
  els.selectAll.addEventListener('click', () => {
    els.fileList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    updateSelectedCount();
  });

  els.selectNone.addEventListener('click', () => {
    els.fileList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateSelectedCount();
  });

  // Handle messages from extension
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'state') {
      els.loading.style.display = 'none';

      if (msg.error) {
        els.error.style.display = '';
        els.error.textContent = msg.error;
        els.content.style.display = 'none';
        return;
      }

      els.error.style.display = 'none';
      els.content.style.display = '';
      state = msg;
      render();
    }
  });

  // Initial load
  vscode.postMessage({ type: 'refresh' });
</script>

</body>
</html>`;
  }
}
