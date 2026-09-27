// Production server: `next start` with better response compression.
//
// Next gzips its streamed pages itself, but calls res.flush() after every
// chunk it streams, and each flush closes a compression block early. Pages
// went out at up to 2.5x their compressed size (Tokens: 131 KB where one
// gzip pass gives 54 KB), and Brotli was never offered. Here Next's own
// compression is off (compress: false in next.config) and responses are
// compressed below: Brotli when the browser accepts it, else gzip, with
// Next's flushes coalesced to one per 25 ms so pages still stream in order.
// Server-sent events (/api/explain) pass through untouched.
import { createServer } from 'node:http';
import zlib from 'node:zlib';
import next from 'next';

const port = Number(process.env.PORT || 3000);
const hostname = '0.0.0.0'; // like `next start`; Docker sets HOSTNAME to the container's name, so it is not read
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|x-javascript|xml|manifest\+json|ld\+json)|image\/svg\+xml)/i;
const toBuffer = (chunk, encoding) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8'));

function compress(req, res) {
  const accept = String(req.headers['accept-encoding'] ?? '');
  const want = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
  if (!want || req.method === 'HEAD') return;

  const writeHead = res.writeHead, write = res.write, end = res.end;
  let stream; // undefined until headers go out; then a zlib stream, or null to pass through
  let timer = null;
  let ended = false;

  // Decided once, just before the headers are written.
  const decide = () => {
    if (stream !== undefined) return;
    stream = null;
    const type = String(res.getHeader('content-type') ?? '');
    if (!COMPRESSIBLE.test(type) || type.startsWith('text/event-stream')) return;
    const vary = String(res.getHeader('vary') ?? '');
    if (!/accept-encoding/i.test(vary)) res.setHeader('Vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding');
    const length = Number(res.getHeader('content-length'));
    if (res.statusCode === 204 || res.statusCode === 304 || res.getHeader('content-encoding') || length < 1024 || /no-transform/.test(String(res.getHeader('cache-control') ?? ''))) return;
    stream = want === 'br'
      ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, ...(length > 0 ? { [zlib.constants.BROTLI_PARAM_SIZE_HINT]: length } : {}) } })
      : zlib.createGzip({ level: 6 });
    res.setHeader('Content-Encoding', want);
    res.removeHeader('Content-Length');
    stream.on('data', (c) => { if (write.call(res, c) === false) stream.pause(); });
    res.on('drain', () => stream.resume());
    stream.on('end', () => end.call(res));
    stream.on('error', (e) => res.destroy(e));
  };

  res.writeHead = function (status, reason, headers) {
    if (typeof reason !== 'string') { headers = reason; reason = undefined; }
    if (Array.isArray(headers)) {
      if (Array.isArray(headers[0])) for (const [k, v] of headers) this.setHeader(k, v);
      else for (let i = 0; i < headers.length; i += 2) this.setHeader(headers[i], headers[i + 1]);
    } else if (headers) for (const [k, v] of Object.entries(headers)) if (v !== undefined) this.setHeader(k, v);
    this.statusCode = status;
    decide();
    return reason ? writeHead.call(this, status, reason) : writeHead.call(this, status);
  };

  res.write = function (chunk, encoding, cb) {
    if (ended) return false;
    if (!this.headersSent) this.writeHead(this.statusCode);
    if (!stream) return write.call(this, chunk, encoding, cb);
    // zlib buffers; the socket's own backpressure pauses zlib's output above.
    stream.write(toBuffer(chunk, encoding), typeof encoding === 'function' ? encoding : cb);
    return true;
  };

  res.end = function (chunk, encoding, cb) {
    if (ended) return this;
    if (typeof chunk === 'function') { cb = chunk; chunk = undefined; }
    else if (typeof encoding === 'function') { cb = encoding; encoding = undefined; }
    if (!this.headersSent) {
      // A whole body in one call: its size decides whether compressing is worth it.
      if (chunk != null && !this.getHeader('content-length')) this.setHeader('Content-Length', toBuffer(chunk, encoding).length);
      this.writeHead(this.statusCode);
    }
    ended = true;
    if (!stream) return end.call(this, chunk, encoding, cb);
    if (timer) { clearTimeout(timer); timer = null; }
    if (cb) this.once('finish', cb);
    if (chunk != null) stream.end(toBuffer(chunk, encoding)); else stream.end();
    return this;
  };

  // Next calls this after every streamed chunk; one real flush per 25 ms keeps compression effective.
  res.flush = () => {
    if (!stream || timer || ended) return;
    timer = setTimeout(() => { timer = null; if (!ended) stream.flush(); }, 25);
  };
  res.on('close', () => { if (timer) clearTimeout(timer); if (stream && !ended) stream.destroy(); });
}

await app.prepare();

createServer((req, res) => {
  compress(req, res);
  handle(req, res);
}).listen(port, hostname, () => console.log(`> Ready on http://${hostname}:${port}`));
