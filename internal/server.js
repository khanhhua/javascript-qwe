import { createServer } from "node:http";
import fs from "node:fs/promises";
import yaml from "yaml";

const routes = []; // { method, path, handler }

const server = createServer((req, res) => {
  try {
    const handler = resolve(req);
    dispatch(handler, req, res);
  } catch (e) {
    console.error(e)
    res.writeHead(e.statusCode, { 'content-type': 'text/plain' });
    res.end(e.message)
  }
});

server.listen(3000, () => {
  console.log('Server listening at 3000...')
});

async function dispatch(handler, req, res) {
  try {
    if (req.method === 'POST') {
      await parseBody(req);
    }

    await handler(req, res);
    console.log(`[INFO] ${req.method} ${req.url} HTTP/${req.httpVersion} ${res.statusCode}`);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(e.message)
  }
}

function get(path, handler) {
  routes.push({ method: 'GET', path, handler })
}

function post(path, handler) {
  routes.push({ method: 'POST', path, handler })
}

function isPathParam(name) {
  if (name?.length < 3) {
    return false;
  }

  return name[0] === '<' && name[name.length - 1] === '>';
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      req.body = Buffer.concat(chunks).toString('utf-8');
      resolve();
    });

    req.on('error', reject);
  });
}

function match(route, pathname) {
  const routeParts = route.split('/', 30);
  const pathnameParts = pathname.split('/', 30);

  if (routeParts.length !== pathnameParts.length) {
    return null;
  }

  const pathParams = {};

  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i] === pathnameParts[i]) {
      continue;
    } else if (isPathParam(routeParts[i])) {
      const key = routeParts[i].substring(1, routeParts[i].length - 1);

      pathParams[key] = pathnameParts[i];
      continue;
    } else {
      return null;
    }
  }

  return pathParams;
}

function resolve(req) {
  const { url, method } = req;
  const url_ = new URL(`http://acme${url}`);
  const maybeConfig = routes.reduce((acc, config) => {
    if (acc.handler) return acc;

    if (config.method !== method) return acc;

    const params = match(config.path, url_.pathname);
    if (!params) return acc;

    return { ...config, params };
  }, { handler: null, params: null });

  if (!maybeConfig.handler) {
    const e = new Error('Not Found')
    e.statusCode = 404;

    throw e;
  }

  req.params = maybeConfig.params;
  url_.searchParams.forEach((v, k) => req.params[k] = v);

  return maybeConfig.handler;
}

get('/', async function echo(req, res) {
  res.end('ok')
});

get('/questions/<session-file>', async function getQuestion(req, res) {
  const filename = req.params['session-file'];
  const q = req.params['q'];
  const content = await fs.readFile(`./questions/${filename}.yaml`, "utf-8");
  const data = yaml.parse(content);
  const { answer, ...rest } = data.questions[q]

  res.writeHead(200, {
    'content-type': 'application/json'
  })
  res.end(JSON.stringify(rest));
});

post('/questions/<session-file>', async function postAnswer(req, res) {
  const filename = req.params['session-file'];
  const q = req.params['q'];
  const content = await fs.readFile(`./questions/${filename}.yaml`, "utf-8");
  const data = yaml.parse(content);
  const question = data.questions[q];

  const payload = JSON.parse(req.body);

  if (typeof payload.answer === 'undefined') {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (payload.answer === question.answer) {
    res.writeHead(200);
    res.end('correct');
  } else {
    res.writeHead(200);
    res.end('wrong');
  }
});
