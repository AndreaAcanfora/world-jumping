// Uploads a local folder to Altervista over FTPS, one file at a time, resuming where it
// stopped. It never deletes anything on the server.
//   ALTERVISTA_FTP_PASSWORD=... node scripts/deploy-ftp.mjs dist /platform3D/
//   ALTERVISTA_FTP_PASSWORD=... node scripts/deploy-ftp.mjs site /
// Altervista only accepts FTP from the countries enabled in its control panel.
import { readdirSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { Client } from 'basic-ftp';

const source = process.argv[2] ?? 'dist';
const dir = process.argv[3] ?? process.env.DEPLOY_DIR ?? '/platform3D-next/';
const password = process.env.ALTERVISTA_FTP_PASSWORD;
if (!password) throw new Error('set ALTERVISTA_FTP_PASSWORD');
// Only these targets: the game build into its folders, the site files into the root.
const allowed = { dist: ['/platform3D/', '/platform3D-next/'], site: ['/'], 'site/platform3D-classic': ['/platform3D-classic/'], 'site/landing': ['/landing/'], 'site/img': ['/img/'] };
if (!allowed[source]?.includes(dir)) throw new Error(`refusing to deploy ${source} to ${dir}`);

function files(root, base = root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? files(path, base) : [relative(base, path)];
  });
}

let client = null;
async function connect() {
  client?.close();
  client = new Client(60_000);
  await client.access({
    host: 'ftp.andreaaca.altervista.org',
    user: process.env.ALTERVISTA_FTP_USER ?? 'andreaaca',
    password,
    secure: true,
    secureOptions: { rejectUnauthorized: false },
  });
}

// index.html last, so visitors never get a page that points at files not uploaded yet.
const list = files(source).sort((a, b) => (a === 'index.html') - (b === 'index.html'));
let uploaded = 0;
let skipped = 0;
await connect();
for (const file of list) {
  const local = join(source, file);
  const remote = posix.join(dir, file.split('\\').join('/'));
  const size = statSync(local).size;
  for (let attempt = 1; ; attempt++) {
    try {
      const existing = await client.size(remote).catch(() => -1);
      if (existing === size && file !== 'index.html') {
        skipped++;
        break;
      }
      await client.ensureDir(posix.dirname(remote));
      await client.cd('/');
      // A stalled data connection can hang without an error: give each file 90 s.
      await Promise.race([
        client.uploadFrom(local, remote),
        new Promise((_, reject) => setTimeout(() => reject(new Error('upload timed out')), 90_000)),
      ]);
      uploaded++;
      console.log(`up ${file} (${(size / 1024).toFixed(0)} kB)`);
      break;
    } catch (err) {
      if (attempt >= 5) throw err;
      console.log(`retry ${file}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      await connect();
    }
  }
}
client.close();
console.log(`done: ${uploaded} uploaded, ${skipped} already there, to ${dir}`);
