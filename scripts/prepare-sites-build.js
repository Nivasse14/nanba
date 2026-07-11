const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const clientDir = path.join(dist, 'client');
const serverDir = path.join(dist, 'server');
const openAiDir = path.join(dist, '.openai');

fs.mkdirSync(clientDir, { recursive: true });
fs.mkdirSync(serverDir, { recursive: true });
fs.mkdirSync(openAiDir, { recursive: true });
fs.copyFileSync(path.join(root, '.openai', 'hosting.json'), path.join(openAiDir, 'hosting.json'));

for (const entry of ['index.html', 'metadata.json', '_expo']) {
  const source = path.join(dist, entry);
  const target = path.join(clientDir, entry);
  if (fs.existsSync(source)) {
    fs.cpSync(source, target, { recursive: true, force: true });
  }
}

fs.writeFileSync(
  path.join(serverDir, 'index.js'),
  `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return env.ASSETS.fetch(new URL('/index.html', request.url));
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response;
    }

    return env.ASSETS.fetch(new URL('/index.html', request.url));
  },
};
`
);
