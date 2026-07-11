const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const serverDir = path.join(dist, 'server');
const openAiDir = path.join(dist, '.openai');

fs.mkdirSync(serverDir, { recursive: true });
fs.mkdirSync(openAiDir, { recursive: true });
fs.copyFileSync(path.join(root, '.openai', 'hosting.json'), path.join(openAiDir, 'hosting.json'));

fs.writeFileSync(
  path.join(serverDir, 'index.js'),
  `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let pathname = url.pathname;
    if (pathname === '/') {
      pathname = '/index.html';
    }

    const assetUrl = new URL(pathname, request.url);
    const asset = await env.ASSETS.fetch(assetUrl);
    if (asset.status !== 404) {
      return asset;
    }

    return env.ASSETS.fetch(new URL('/index.html', request.url));
  },
};
`
);
