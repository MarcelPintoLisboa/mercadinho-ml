export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl = (n: number) => fmtBRL.format(Number.isFinite(n) ? n : 0);

export const num = (n: number, casas = 3) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas }).format(Number.isFinite(n) ? n : 0);

export const pct = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(Number.isFinite(n) ? n : 0);

/** Converte texto digitado ("1.234,56", "12,5", "12.5") em número. */
export function parseNum(s: string | number | undefined | null): number {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  let t = String(s).trim().replace(/[R$\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** Mostra número em campo de texto no formato brasileiro (sem separador de milhar). */
export const toInput = (n: number | undefined) => (n === undefined || n === null ? '' : String(n).replace('.', ','));

export const margem = (custo: number, preco: number) => (preco > 0 ? (preco - custo) / preco : 0);
export const markup = (custo: number, preco: number) => (custo > 0 ? (preco - custo) / custo : 0);

export const dataHora = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
export const dataCurta = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export const inicioDia = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export const fimDia = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

export type Periodo = 'hoje' | 'ontem' | '7d' | '30d' | 'mes' | 'mesAnterior' | 'ano' | 'custom';
export const PERIODOS: { id: Periodo; nome: string }[] = [
  { id: 'hoje', nome: 'Hoje' },
  { id: 'ontem', nome: 'Ontem' },
  { id: '7d', nome: '7 dias' },
  { id: '30d', nome: '30 dias' },
  { id: 'mes', nome: 'Este mês' },
  { id: 'mesAnterior', nome: 'Mês anterior' },
  { id: 'ano', nome: 'Este ano' },
  { id: 'custom', nome: 'Personalizado' },
];

export function intervalo(p: Periodo, de?: string, ate?: string): [number, number] {
  const hoje = new Date();
  const d = (y: number, m: number, dd: number) => new Date(y, m, dd);
  switch (p) {
    case 'hoje':
      return [inicioDia(hoje), fimDia(hoje)];
    case 'ontem': {
      const o = d(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
      return [inicioDia(o), fimDia(o)];
    }
    case '7d':
      return [inicioDia(d(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6)), fimDia(hoje)];
    case '30d':
      return [inicioDia(d(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 29)), fimDia(hoje)];
    case 'mes':
      return [inicioDia(d(hoje.getFullYear(), hoje.getMonth(), 1)), fimDia(hoje)];
    case 'mesAnterior':
      return [inicioDia(d(hoje.getFullYear(), hoje.getMonth() - 1, 1)), fimDia(d(hoje.getFullYear(), hoje.getMonth(), 0))];
    case 'ano':
      return [inicioDia(d(hoje.getFullYear(), 0, 1)), fimDia(hoje)];
    case 'custom': {
      const a = de ? new Date(de + 'T00:00:00') : hoje;
      const b = ate ? new Date(ate + 'T00:00:00') : hoje;
      return [inicioDia(a), fimDia(b)];
    }
  }
}

export const isoDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function baixarCSV(nome: string, linhas: (string | number)[][]) {
  const csv = linhas
    .map((l) => l.map((c) => (typeof c === 'number' ? String(c).replace('.', ',') : `"${String(c).replace(/"/g, '""')}"`)).join(';'))
    .join('\r\n');
  return salvarArquivo(nome, '﻿' + csv, 'text/csv');
}

/** Salva/compartilha um arquivo de texto. No celular usa o compartilhamento nativo. */
export async function salvarArquivo(nome: string, conteudo: string, mime: string) {
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const r = await Filesystem.writeFile({ path: nome, data: conteudo, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: nome, url: r.uri, dialogTitle: 'Salvar ou enviar arquivo' });
    return;
  }
  const blob = new Blob([conteudo], { type: mime + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
