import * as vscode from 'vscode';

type AgentEvent =
  | { type: 'status'; message: string }
  | { type: 'toolCall'; toolName: string; input: object }
  | { type: 'toolResult'; toolName: string; result: string };

export async function askTimeAgentQuestion(
  question: string,
  onEvent?: (event: AgentEvent) => void,
): Promise<string> {
  onEvent?.({ type: 'status', message: 'Selecting a language model...' });

  const models = await vscode.lm.selectChatModels({
    vendor: 'copilot',
    family: 'gpt-4o'
  });

  if (models.length === 0) {
    throw new Error('No compatible chat model is available. Install/sign in to GitHub Copilot and enable language model access.');
  }

  const [model] = models;
  const tool: vscode.LanguageModelChatTool = {
    name: 'get_current_time',
    description: 'Returns the current local date, time, timezone, and ISO timestamp for the user.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  };

  const messages: vscode.LanguageModelChatMessage[] = [
    vscode.LanguageModelChatMessage.User(
      [
        new vscode.LanguageModelTextPart(
          'You are a minimal demo agent running inside a VS Code extension panel.'
        ),
      ],
      'system'
    ),
    vscode.LanguageModelChatMessage.User(
      [
        new vscode.LanguageModelTextPart(
          'When the user asks for the current time or date, call the get_current_time tool before answering. Keep the final answer short.'
        ),
      ],
      'system'
    ),
    vscode.LanguageModelChatMessage.User(question),
  ];

  const tokenSource = new vscode.CancellationTokenSource();

  onEvent?.({ type: 'status', message: `Using model ${model.vendor}/${model.family}...` });

  for (let step = 0; step < 4; step += 1) {
    const response = await model.sendRequest(
      messages,
      {
        justification: 'Answer a question in the extension panel using a small tool-calling demo.',
        tools: [tool],
      },
      tokenSource.token,
    );

    let textOutput = '';
    let toolCall: vscode.LanguageModelToolCallPart | undefined;

    for await (const chunk of response.stream) {
      if (chunk instanceof vscode.LanguageModelTextPart) {
        textOutput += chunk.value;
      } else if (chunk instanceof vscode.LanguageModelToolCallPart) {
        toolCall = chunk;
      }
    }

    if (toolCall) {
      onEvent?.({ type: 'toolCall', toolName: toolCall.name, input: toolCall.input });

      const toolResult = runTool(toolCall.name);

      onEvent?.({ type: 'toolResult', toolName: toolCall.name, result: toolResult });

      messages.push(vscode.LanguageModelChatMessage.Assistant([toolCall]));
      messages.push(
        vscode.LanguageModelChatMessage.User([
          new vscode.LanguageModelToolResultPart(toolCall.callId, [
            new vscode.LanguageModelTextPart(toolResult),
          ]),
        ]),
      );
      continue;
    }

    const finalText = textOutput.trim();
    if (!finalText) {
      throw new Error('The model returned an empty response.');
    }

    return finalText;
  }

  throw new Error('The agent exceeded the maximum number of tool steps.');
}

function runTool(toolName: string): string {
  if (toolName !== 'get_current_time') {
    throw new Error(`Unsupported tool: ${toolName}`);
  }

  const now = new Date();

  return JSON.stringify(
    {
      iso: now.toISOString(),
      localTime: now.toLocaleTimeString(),
      localDate: now.toLocaleDateString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    null,
    2,
  );
}
