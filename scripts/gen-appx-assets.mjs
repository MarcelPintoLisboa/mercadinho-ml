// Gera as imagens exigidas pelo pacote da Microsoft Store (MSIX/AppX) a partir de build/icon.png.
// O electron-builder procura essas imagens em build/appx/. Sem elas, usaria o logo do Electron
// e a Microsoft recusaria o envio.
// Uso: node scripts/gen-appx-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const ICONE = 'build/icon.png';
const DESTINO = 'build/appx';
const FUNDO = '#1f9d55'; // verde do Mercadinho (mesma cor do tema do app)

mkdirSync(DESTINO, { recursive: true });

const quadrado = (nome, lado) => sharp(ICONE).resize(lado, lado).png().toFile(`${DESTINO}/${nome}`);

// Bloco largo: ícone centralizado sobre o verde
async function largo(nome, w, h) {
  const lado = Math.round(h * 0.8);
  const icone = await sharp(ICONE).resize(lado, lado).png().toBuffer();
  await sharp({ create: { width: w, height: h, channels: 4, background: FUNDO } })
    .composite([{ input: icone, gravity: 'center' }])
    .png()
    .toFile(`${DESTINO}/${nome}`);
}

await Promise.all([
  quadrado('StoreLogo.png', 50),
  quadrado('Square44x44Logo.png', 44),
  quadrado('SmallTile.png', 71),
  quadrado('Square150x150Logo.png', 150),
  quadrado('LargeTile.png', 310),
  largo('Wide310x150Logo.png', 310, 150),
]);
console.log('Imagens da Microsoft Store geradas em', DESTINO);
