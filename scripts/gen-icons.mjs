// Gera todos os ícones (web, desktop e base para Android/iOS) a partir de assets/logo-original.png
// Uso: npm run icons   (depois, para celular: npx capacitor-assets generate)
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'node:fs/promises';

const SRC = 'assets/logo-original.png';
const TOPO = '#32ae58'; // cores do degradê do logo
const BASE = '#18753d';

const gradiente = (w, h) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${TOPO}"/><stop offset="1" stop-color="${BASE}"/></linearGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );

/** Ícone quadrado ocupando toda a área (sem bordas). */
const cheio = (size, out) => sharp(SRC).resize(size, size, { fit: 'cover', position: 'centre' }).png().toFile(out);

/** Logo menor, com bordas suavizadas, sobre o degradê (ícone adaptativo/splash). */
async function centralizado(size, escala, out, comFundo = true) {
  const inner = Math.round(size * escala);
  const feather = Math.round(inner * 0.06);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}"><filter id="b"><feGaussianBlur stdDeviation="${feather / 2}"/></filter>` +
      `<rect x="${feather}" y="${feather}" width="${inner - feather * 2}" height="${inner - feather * 2}" rx="${inner * 0.12}" fill="#fff" filter="url(#b)"/></svg>`,
  );
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  const base = comFundo
    ? sharp(gradiente(size, size))
    : sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  await base.composite([{ input: logo, gravity: 'center' }]).png().toFile(out);
}

await fs.mkdir('build', { recursive: true });
await fs.mkdir('public', { recursive: true });

// Base para @capacitor/assets (Android + iOS)
await cheio(1024, 'assets/icon-only.png');
await centralizado(1024, 0.62, 'assets/icon-foreground.png', false); // área segura do ícone adaptativo
await sharp(gradiente(1024, 1024)).png().toFile('assets/icon-background.png');
await centralizado(2732, 0.3, 'assets/splash.png');
await centralizado(2732, 0.3, 'assets/splash-dark.png');

// Web
await cheio(192, 'public/icon-192.png');
await cheio(512, 'public/icon-512.png');
await fs.copyFile(SRC, 'public/logo.png');

// Desktop (Electron)
await cheio(512, 'build/icon.png');
const bufs = [];
for (const s of [16, 24, 32, 48, 64, 128, 256]) {
  bufs.push(await sharp(SRC).resize(s, s, { fit: 'cover' }).png().toBuffer());
}
await fs.writeFile('build/icon.ico', await pngToIco(bufs));

console.log('Ícones gerados com sucesso.');
