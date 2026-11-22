// Imagem do app personalizável pelo usuário (Configurações → Imagem do app).
// Fica salva na conta (config "logoLoja", como imagem em data URL), então aparece em todos os aparelhos.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export const LOGO_PADRAO = './icon-192.png';
export const CHAVE_LOGO = 'logoLoja';
const LADO = 256; // tamanho final (quadrado), suficiente para menu, topo e comprovante
const MAX_ARQUIVO = 15 * 1024 * 1024;

/** Imagem personalizada da conta (ou undefined se o usuário não escolheu nenhuma). */
export function useLogoPersonalizada() {
  return useLiveQuery(async () => (await db.config.get(CHAVE_LOGO))?.valor as string | undefined);
}

/** Imagem a mostrar no app: a personalizada ou a padrão do Mercadinho. */
export function useLogo() {
  return useLogoPersonalizada() || LOGO_PADRAO;
}

/**
 * Lê a imagem escolhida, recorta o centro em formato quadrado e reduz para 256×256.
 * Retorna um data URL leve (PNG se tiver transparência e ficar pequeno; senão JPEG).
 */
export async function prepararLogo(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (PNG, JPG, WEBP...).');
  if (arquivo.size > MAX_ARQUIVO) throw new Error('Imagem muito grande. Escolha uma de até 15 MB.');

  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('Não foi possível abrir esta imagem. Tente outra (PNG ou JPG).'));
      i.src = url;
    });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - lado) / 2;
    const sy = (img.naturalHeight - lado) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = LADO;
    canvas.height = LADO;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, lado, lado, 0, 0, LADO, LADO);

    const png = canvas.toDataURL('image/png');
    if (png.length <= 120_000) return png; // mantém transparência quando fica leve
    // foto: JPEG sobre fundo branco (JPEG não tem transparência)
    const fundo = document.createElement('canvas');
    fundo.width = LADO;
    fundo.height = LADO;
    const f = fundo.getContext('2d')!;
    f.fillStyle = '#ffffff';
    f.fillRect(0, 0, LADO, LADO);
    f.drawImage(canvas, 0, 0);
    return fundo.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
