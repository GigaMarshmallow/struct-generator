import * as vscode from 'vscode';

// Данные одного поля структуры
interface Field {
	type: string;  // например, "int"
	name: string;  // например, "age"
}

// Данные всей структуры
interface StructData {
	structName: string;
	fields: Field[];
}

export function activate(context: vscode.ExtensionContext) {
	console.log('struct-generator is now active!');

	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100
	);
	statusBarItem.text = '$(symbol-structure) Create Struct';
	statusBarItem.tooltip = 'Создать C++ struct';
	statusBarItem.command = 'struct-generator.createStruct';
	statusBarItem.show();

	const cmd = vscode.commands.registerCommand(
		'struct-generator.createStruct',
		createStructCommand
	);

	context.subscriptions.push(cmd, statusBarItem);
}

/**
 * Открывает webview-форму для создания структуры.
 */
function createStructCommand() {
	const panel = vscode.window.createWebviewPanel(
		'structForm',
		'Создание структуры',
		vscode.ViewColumn.One,
		{
			enableScripts: true
		}
	);

	panel.webview.html = getFormHtml();

	// Запоминаем последний сгенерированный код, чтобы кнопка «Скопировать» знала, что копировать
	let lastCode = '';

	panel.webview.onDidReceiveMessage((message) => {
		switch (message.command) {
			case 'parse':
				try {
					const data = parseStructString(message.input);
					lastCode = generateStructCode(data);
					panel.webview.postMessage({ command: 'result', code: lastCode });
				} catch (error) {
					lastCode = '';
					panel.webview.postMessage({
						command: 'error',
						text: (error as Error).message
					});
				}
				break;
			case 'copy':
				if (lastCode) {
					vscode.env.clipboard.writeText(lastCode);
					vscode.window.showInformationMessage('Скопировано в буфер обмена');
				}
				break;
		}
	});
}

/**
 * Парсит строку вида "Person: string name, int age".
 */
function parseStructString(input: string): StructData {
	const trimmed = input.trim();
	if (trimmed === '') {
		throw new Error('Пустая строка');
	}

	const colonIndex = trimmed.indexOf(':');
	if (colonIndex === -1) {
		throw new Error('Не найдено ":" между именем структуры и полями');
	}

	const structName = trimmed.slice(0, colonIndex).trim();
	const fieldsPart = trimmed.slice(colonIndex + 1).trim();

	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(structName)) {
		throw new Error(`Некорректное имя структуры: "${structName}"`);
	}

	const fieldChunks = fieldsPart.split(',');
	const fields: Field[] = [];

	for (const chunk of fieldChunks) {
		const raw = chunk.trim();
		if (raw === '') continue;

		const match = raw.match(/^(.+?)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
		if (!match) {
			throw new Error(`Не удалось разобрать поле: "${raw}"`);
		}

		const type = match[1].trim();
		const name = match[2];

		if (fields.some(f => f.name === name)) {
			throw new Error(`Поле с именем "${name}" уже существует`);
		}

		fields.push({ type, name });
	}

	if (fields.length === 0) {
		throw new Error('Не найдено ни одного поля');
	}

	return { structName, fields };
}

/**
 * Генерирует C++ код структуры.
 */
function generateStructCode(data: StructData): string {
	const lines = [`struct ${data.structName} {`];
	for (const field of data.fields) {
		lines.push(`    ${field.type} ${field.name};`);
	}
	lines.push('};');
	return lines.join('\n');
}

/**
 * Собирает HTML для формы.
 */
function getFormHtml(): string {
	return `<!DOCTYPE html>
<html lang="ru">
<head>
	<meta charset="UTF-8">
	<title>Создание структуры</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
			padding: 24px;
			line-height: 1.5;
		}
		h1 {
			font-size: 20px;
			margin-bottom: 20px;
			border-bottom: 1px solid var(--vscode-panel-border);
			padding-bottom: 8px;
		}
		h2 {
			font-size: 16px;
			margin-top: 24px;
			margin-bottom: 12px;
		}
		label {
			display: block;
			margin-bottom: 6px;
			font-weight: bold;
		}
		.hint {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 8px;
		}
		textarea {
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			padding: 10px;
			border-radius: 4px;
			font-family: var(--vscode-editor-font-family);
			font-size: 14px;
			width: 100%;
			max-width: 600px;
			min-height: 60px;
			box-sizing: border-box;
			resize: vertical;
		}
		button {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			padding: 8px 16px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			margin-top: 12px;
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
			cursor: not-allowed;
		}
		pre {
			background: var(--vscode-textCodeBlock-background);
			padding: 16px;
			border-radius: 6px;
			border: 1px solid var(--vscode-panel-border);
			overflow-x: auto;
			font-family: var(--vscode-editor-font-family);
			font-size: 14px;
			max-width: 600px;
			min-height: 20px;
		}
		.error {
			color: var(--vscode-errorForeground);
			background: var(--vscode-inputValidation-errorBackground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
			padding: 10px 14px;
			border-radius: 4px;
			font-size: 14px;
			max-width: 600px;
			margin-top: 8px;
			display: none;
		}
		.result-actions {
			margin-top: 8px;
			display: flex;
			gap: 10px;
		}
	</style>
</head>
<body>
	<h1>Создание C++ структуры</h1>

	<label for="input">Введите описание структуры:</label>
	<div class="hint">Формат: ИмяСтруктуры: тип1 имя1, тип2 имя2, ...</div>
	<textarea id="input" placeholder="Person: string name, int age, string email"></textarea>

	<button id="parse">Обработать</button>

	<h2>Результат</h2>
	<pre id="code"></pre>
	<div id="error" class="error"></div>

	<div class="result-actions">
		<button id="copy" class="secondary" disabled>Скопировать</button>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		const copyBtn = document.getElementById('copy');
		const codeEl = document.getElementById('code');
		const errorEl = document.getElementById('error');

		document.getElementById('parse').addEventListener('click', () => {
			const input = document.getElementById('input').value;
			vscode.postMessage({ command: 'parse', input: input });
		});

		copyBtn.addEventListener('click', () => {
			vscode.postMessage({ command: 'copy' });
		});

		window.addEventListener('message', (event) => {
			const message = event.data;

			if (message.command === 'result') {
				codeEl.textContent = message.code;
				errorEl.style.display = 'none';
				errorEl.textContent = '';
				copyBtn.disabled = false;
			} else if (message.command === 'error') {
				codeEl.textContent = '';
				errorEl.textContent = message.text;
				errorEl.style.display = 'block';
				copyBtn.disabled = true;
			}
		});
	</script>
</body>
</html>`;
}

export function deactivate() {}