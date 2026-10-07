/* global process, Buffer */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { copyFile } from 'node:fs/promises';
const runtime = process.env.CODEX_PROOF_RUNTIME ?? 'C:/Users/Patrick/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const sharp = createRequire(path.join(runtime, 'node/package.json'))('sharp');

const proofDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(proofDir, '../../../../..');
const dir = path.join(os.tmpdir(), `instruction-builder-task-4-embedded-proof-${process.pid}`);
const font = await readFile(path.join(root, 'public/fonts/SourceSans3-Regular-3.052.ttf'));
const server = createServer(async (req, res) => {
  const files = {
    '/font.ttf': ['public/fonts/SourceSans3-Regular-3.052.ttf', 'font/ttf'],
    '/jspdf.js': ['node_modules/jspdf/dist/jspdf.umd.min.js', 'text/javascript'],
    '/svg2pdf.js': ['node_modules/svg2pdf.js/dist/svg2pdf.umd.min.js', 'text/javascript'],
  };
  if (req.url === '/embedded.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end(await readFile(path.join(dir, 'embedded.svg'))); }
  else if (files[req.url]) { const [file, type] = files[req.url]; res.setHeader('Content-Type', type); res.end(await readFile(path.join(root, file))); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<html><body><script src="/jspdf.js"></script><script src="/svg2pdf.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(origin);
  const result = await page.evaluate(async ({base64}) => {
    const raw = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const font = new FontFace('SourceProof', raw.buffer); await font.load(); document.fonts.add(font); await document.fonts.ready;
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'); ctx.font = '14.6666666667px SourceProof';
    const lines = ['English: prepare 2 small cups', 'ÄÖÜ äöü ß ẞ – “Größe” — café déjà vu', 'WWWWWWWWWWWWWWWWWW', 'Donaudampfschifffahrtsgesellschaft', 'A\u0308 e\u0301 0123456789 & < >'];
    const mmWidths = lines.map(s => ctx.measureText(s).width * 25.4 / 96);
    const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="190mm" height="80mm" viewBox="0 0 190 80"><style>@font-face{font-family:SourceProof;src:url(data:font/ttf;base64,${base64}) format('truetype');}text{font-family:SourceProof;font-weight:400;font-size:3.8805555556px;}</style><rect width="190" height="80" fill="white"/>${lines.map((s,i)=>`<text x="10" y="${10+i*12}">${escape(s)}</text><path d="M10 ${11+i*12}h${mmWidths[i]}" stroke="red" stroke-width=".15"/>`).join('')}</svg>`;
    const el = new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
    document.body.append(el);
    const img = new Image(); await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));});
    canvas.width = Math.round(190/25.4*150); canvas.height = Math.round(80/25.4*150); ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const png = canvas.toDataURL('image/png').split(',')[1];
    const pdf = new window.jspdf.jsPDF({unit:'mm',format:[190,80],orientation:'landscape'});
    pdf.addFileToVFS('SourceProof.ttf',base64); pdf.addFont('SourceProof.ttf','SourceProof','normal'); pdf.setFont('SourceProof','normal');
    await pdf.svg(el,{x:0,y:0,width:190,height:80});
    const bytes = new Uint8Array(pdf.output('arraybuffer')); let binary=''; for (const b of bytes) binary += String.fromCharCode(b);
    return {svg,png,pdf:btoa(binary),mmWidths};
  }, {base64:font.toString('base64')});
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'embedded.svg'),result.svg);
  await writeFile(path.join(dir,'embedded-image.png'),Buffer.from(result.png,'base64'));
  await writeFile(path.join(dir,'embedded.pdf'),Buffer.from(result.pdf,'base64'));
  await sharp(Buffer.from(result.svg),{density:150}).png().toFile(path.join(dir,'embedded-independent.png'));
  const independent = await browser.newPage(); await independent.goto(origin+'/embedded.svg'); await independent.evaluate(()=>document.fonts.ready); await independent.screenshot({path:path.join(dir,'embedded-browser.png')});
  await writeFile(path.join(dir,'embedded-metrics.json'),JSON.stringify({mmWidths:result.mmWidths},null,2));
  execFileSync(process.env.CODEX_PROOF_PDFTOPPM ?? path.join(runtime,'native/poppler/Library/bin/pdftoppm.exe'), ['-png','-r','150','-singlefile',path.join(dir,'embedded.pdf'),path.join(dir,'embedded-pdf')]);
  for (const file of ['embedded-image.png','embedded-independent.png','embedded-pdf.png','embedded-metrics.json']) await copyFile(path.join(dir,file),path.join(proofDir,file));
  console.log(JSON.stringify({dir,widths:result.mmWidths}));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
