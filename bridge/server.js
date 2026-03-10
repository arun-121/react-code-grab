import http from 'node:http';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = 3210;

function normalizePath(url) {
  if (!url) {
    return '/';
  }

  try {
    return new URL(url, `http://${HOST}:${PORT}`).pathname;
  } catch {
    return url;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  response.end(JSON.stringify(payload));
}

function tryCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'ignore'
    });

    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

function editorCandidates(target, line, column) {
  const file = target.split(':')[0];

  return [
    ['code', ['-g', target]],
    ['cursor', ['-g', target]],
    ['webstorm', ['--line', String(line), file]],
    ['open', ['-a', 'Cursor', '--args', '-g', target]],
    ['open', ['-a', 'Visual Studio Code', '--args', '-g', target]],
    ['open', ['-a', 'WebStorm', '--args', '--line', String(line), file]]
  ];
}

async function openInEditor(file, line, column) {
  const target = `${file}:${line}:${column}`;
  const candidates = editorCandidates(target, line, column);

  for (const [command, args] of candidates) {
    const opened = await tryCommand(command, args);
    if (opened) {
      return `${command} ${args.join(' ')}`;
    }
  }

  return null;
}

const server = http.createServer(async (request, response) => {
  const pathname = normalizePath(request.url);

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === 'GET' && pathname === '/') {
    sendJson(response, 200, {
      ok: true,
      service: 'react-code-grab-bridge',
      openEndpoint: '/open'
    });
    return;
  }

  if (request.method !== 'POST' || pathname !== '/open') {
    sendJson(response, 404, {
      ok: false,
      error: 'Not found',
      method: request.method,
      path: pathname
    });
    return;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const file = payload.file;
    const line = Number(payload.line || 1);
    const column = Number(payload.column || 1);

    if (!file || typeof file !== 'string') {
      sendJson(response, 400, { ok: false, error: 'Missing file' });
      return;
    }

    const command = await openInEditor(file, line, column);
    if (!command) {
      sendJson(response, 200, {
        ok: false,
        error: 'No supported editor CLI found on PATH',
        file,
        line,
        column
      });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      command,
      file,
      line,
      column
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`React Code Grab bridge listening on http://${HOST}:${PORT}`);
});
