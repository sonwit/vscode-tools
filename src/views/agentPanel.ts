import * as vscode from 'vscode';
import { askTimeAgentQuestion } from '../agent/timeAgent';

export class AgentDemoViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vscode-tools.agentDemoView';
  private static readonly containerId = 'agentDemo';

  public static async show() {
    await vscode.commands.executeCommand(`workbench.view.extension.${AgentDemoViewProvider.containerId}`);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.type !== 'ask') {
        return;
      }

      const prompt = typeof message.prompt === 'string' && message.prompt.trim()
        ? message.prompt.trim()
        : 'What time is it right now?';

      void webviewView.webview.postMessage({
        type: 'runStarted',
        prompt,
      });

      try {
        const answer = await askTimeAgentQuestion(prompt, event => {
          void webviewView.webview.postMessage({
            type: 'agentEvent',
            event,
          });
        });

        void webviewView.webview.postMessage({
          type: 'runCompleted',
          answer,
        });
      } catch (error: unknown) {
        const messageText = error instanceof Error ? error.message : String(error);
        void webviewView.webview.postMessage({
          type: 'runFailed',
          error: messageText,
        });
      }
    });
  }

  private getHtml(): string {
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>Agent Demo</title>
  <style>
    :root {
      --border: color-mix(in srgb, var(--vscode-editor-foreground) 14%, transparent);
      --panel: color-mix(in srgb, var(--vscode-sideBar-background) 88%, white 3%);
      --panel-alt: color-mix(in srgb, var(--vscode-sideBar-background) 92%, black 5%);
      --accent: var(--vscode-button-background);
      --accent-foreground: var(--vscode-button-foreground);
      --muted: var(--vscode-descriptionForeground);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 12px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 18%, transparent), transparent 38%),
        var(--vscode-sideBar-background);
    }

    .shell {
      display: grid;
      gap: 12px;
    }

    .card {
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 14px;
      padding: 12px;
    }

    h1 {
      margin: 0 0 6px;
      font-size: 18px;
    }

    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      font-size: 12px;
    }

    textarea {
      width: 100%;
      min-height: 88px;
      resize: vertical;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--panel-alt);
      color: var(--vscode-input-foreground);
      padding: 12px;
      font: inherit;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      font: inherit;
      background: var(--accent);
      color: var(--accent-foreground);
      cursor: pointer;
      width: 100%;
    }

    button:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .label {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .log {
      display: grid;
      gap: 10px;
      max-height: 360px;
      overflow: auto;
    }

    .entry {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--panel-alt);
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
    }

    .entry strong {
      display: block;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="card">
      <h1>Agent Demo</h1>
      <p>A minimal tool-calling loop in a VS Code sidebar view. Ask for the time and the model can call a single tool.</p>
    </section>

    <section class="card">
      <div class="label">Prompt</div>
      <textarea id="prompt">What time is it right now in my local timezone?</textarea>
    </section>

    <section class="card">
      <button id="run">Ask Agent</button>
    </section>

    <section class="card">
      <div class="label">Run Log</div>
      <div id="log" class="log"></div>
    </section>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const runButton = document.getElementById('run');
    const promptInput = document.getElementById('prompt');
    const log = document.getElementById('log');

    function addEntry(title, body) {
      const node = document.createElement('div');
      node.className = 'entry';
      node.innerHTML = '<strong>' + title + '</strong>' + body;
      log.prepend(node);
    }

    runButton.addEventListener('click', () => {
      log.innerHTML = '';
      runButton.disabled = true;
      vscode.postMessage({
        type: 'ask',
        prompt: promptInput.value,
      });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message.type === 'runStarted') {
        addEntry('User', message.prompt);
        addEntry('Status', 'Starting agent run...');
        return;
      }

      if (message.type === 'agentEvent') {
        const agentEvent = message.event;

        if (agentEvent.type === 'status') {
          addEntry('Status', agentEvent.message);
          return;
        }

        if (agentEvent.type === 'toolCall') {
          addEntry('Tool Call', agentEvent.toolName + '\\n' + JSON.stringify(agentEvent.input, null, 2));
          return;
        }

        if (agentEvent.type === 'toolResult') {
          addEntry('Tool Result', agentEvent.toolName + '\\n' + agentEvent.result);
        }

        return;
      }

      runButton.disabled = false;

      if (message.type === 'runCompleted') {
        addEntry('Assistant', message.answer);
        return;
      }

      if (message.type === 'runFailed') {
        addEntry('Error', message.error);
      }
    });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';

  for (let index = 0; index < 32; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return nonce;
}
