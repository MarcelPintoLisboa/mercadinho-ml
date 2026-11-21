import Dexie, { type Table } from 'dexie';
import { round2 } from './utils';

export type Unidade = 'un' | 'kg' | 'g' | 'L' | 'ml' | 'cx' | 'pct' | 'dz';
export const UNIDADES: Unidade[] = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'dz'];

export type FormaPagamento = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'fiado';
export const PAGAMENTOS: { id: FormaPagamento; nome: string }[] = [
  { id: 'dinheiro', nome: 'Dinheiro' },
  { id: 'pix', nome: 'PIX' },
  { id: 'debito', nome: 'Cartão de débito' },
  { id: 'credito', nome: 'Cartão de crédito' },
  { id: 'fiado', nome: 'Fiado' },
];
export const nomePagamento = (id: FormaPagamento) => PAGAMENTOS.find((p) => p.id === id)?.nome ?? id;

export interface Produto {
  id?: number;
  nome: string;
  codigo: string; // código de barras / código interno
  categoria: string;
  unidade: Unidade;
  custo: number; // preço de custo (custo médio)
  preco: number; // preço de venda
  estoque: number;
  estoqueMinimo: number;
  ativo: boolean;
  criadoEm: number;
  atualizadoEm: number;
}

export type TipoMovimento = 'entrada' | 'ajuste' | 'perda' | 'venda' | 'cancelamento';

export interface Movimento {
  id?: number;
  produtoId: number;
  tipo: TipoMovimento;
  quantidade: number; // positiva = entra no estoque, negativa = sai
  custoUnit?: number;
  estoqueApos: number;
  obs?: string;
  vendaId?: number;
  data: number;
}

export interface ItemVenda {
  produtoId: number;
  nome: string;
  unidade: Unidade;
  categoria: string;
  quantidade: number;
  precoUnit: number;
  custoUnit: number;
  total: number;
}

export interface Venda {
  id?: number;
  data: number;
  itens: ItemVenda[];
  subtotal: number;
  desconto: number;
  total: number;
  custoTotal: number;
  lucro: number;
  pagamento: FormaPagamento;
  valorRecebido?: number;
  troco?: number;
  cliente?: string;
  status: 'concluida' | 'cancelada';
  canceladaEm?: number;
}

export interface Config {
  chave: string;
  valor: unknown;
}

class MercadinhoDB extends Dexie {
  produtos!: Table<Produto, number>;
  movimentos!: Table<Movimento, number>;
  vendas!: Table<Venda, number>;
  config!: Table<Config, string>;

  constructor() {
    super('mercadinho-ml');
    this.version(1).stores({
      produtos: '++id, nome, codigo, categoria, ativo',
      movimentos: '++id, produtoId, tipo, data, vendaId',
      vendas: '++id, data, status, pagamento',
      config: 'chave',
    });
  }
}

export const db = new MercadinhoDB();

// Pede ao navegador/WebView para não apagar os dados em caso de pouco espaço
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => undefined);
}

// ---------------- Produtos ----------------

export async function salvarProduto(p: Omit<Produto, 'criadoEm' | 'atualizadoEm'> & { criadoEm?: number }) {
  const agora = Date.now();
  const codigo = p.codigo.trim();
  if (codigo) {
    const dup = await db.produtos.where('codigo').equals(codigo).first();
    if (dup && dup.id !== p.id) throw new Error(`O código "${codigo}" já está em uso pelo produto "${dup.nome}".`);
  }
  const dados: Produto = {
    ...p,
    nome: p.nome.trim(),
    codigo,
    categoria: p.categoria.trim() || 'Geral',
    custo: round2(p.custo),
    preco: round2(p.preco),
    criadoEm: p.criadoEm ?? agora,
    atualizadoEm: agora,
  };

  return db.transaction('rw', db.produtos, db.movimentos, async () => {
    if (p.id) {
      await db.produtos.put(dados);
      return p.id;
    }
    const id = await db.produtos.add(dados);
    if (dados.estoque !== 0) {
      await db.movimentos.add({
        produtoId: id,
        tipo: 'entrada',
        quantidade: dados.estoque,
        custoUnit: dados.custo,
        estoqueApos: dados.estoque,
        obs: 'Estoque inicial',
        data: agora,
      });
    }
    return id;
  });
}

export async function excluirProduto(id: number) {
  // Mantém o histórico de vendas: o produto é apenas desativado
  await db.produtos.update(id, { ativo: false, atualizadoEm: Date.now() });
}

/** Entrada de mercadoria. Atualiza o custo pelo custo médio ponderado. */
export async function registrarEntrada(produtoId: number, quantidade: number, custoUnit: number, obs?: string, novoPreco?: number) {
  if (!(quantidade > 0)) throw new Error('Informe uma quantidade maior que zero.');
  return db.transaction('rw', db.produtos, db.movimentos, async () => {
    const p = await db.produtos.get(produtoId);
    if (!p) throw new Error('Produto não encontrado.');
    const estoqueAtual = Math.max(p.estoque, 0);
    const novoEstoque = round3(p.estoque + quantidade);
    const custoMedio =
      estoqueAtual + quantidade > 0 ? (estoqueAtual * p.custo + quantidade * custoUnit) / (estoqueAtual + quantidade) : custoUnit;
    await db.produtos.update(produtoId, {
      estoque: novoEstoque,
      custo: round2(custoMedio),
      ...(novoPreco && novoPreco > 0 ? { preco: round2(novoPreco) } : {}),
      atualizadoEm: Date.now(),
    });
    await db.movimentos.add({
      produtoId,
      tipo: 'entrada',
      quantidade,
      custoUnit: round2(custoUnit),
      estoqueApos: novoEstoque,
      obs,
      data: Date.now(),
    });
  });
}

/** Ajuste de inventário (define a quantidade contada) ou registro de perda. */
export async function ajustarEstoque(produtoId: number, modo: 'ajuste' | 'perda', valor: number, obs?: string) {
  return db.transaction('rw', db.produtos, db.movimentos, async () => {
    const p = await db.produtos.get(produtoId);
    if (!p) throw new Error('Produto não encontrado.');
    let delta: number;
    if (modo === 'ajuste') delta = round3(valor - p.estoque);
    else {
      if (!(valor > 0)) throw new Error('Informe a quantidade perdida.');
      delta = -valor;
    }
    if (delta === 0) return;
    const novoEstoque = round3(p.estoque + delta);
    await db.produtos.update(produtoId, { estoque: novoEstoque, atualizadoEm: Date.now() });
    await db.movimentos.add({
      produtoId,
      tipo: modo,
      quantidade: delta,
      custoUnit: p.custo,
      estoqueApos: novoEstoque,
      obs,
      data: Date.now(),
    });
  });
}

// ---------------- Vendas ----------------

export interface ItemCarrinho {
  produtoId: number;
  quantidade: number;
  precoUnit: number;
}

export async function finalizarVenda(dados: {
  itens: ItemCarrinho[];
  desconto: number;
  pagamento: FormaPagamento;
  valorRecebido?: number;
  cliente?: string;
}) {
  if (!dados.itens.length) throw new Error('O carrinho está vazio.');
  return db.transaction('rw', db.produtos, db.movimentos, db.vendas, async () => {
    const agora = Date.now();
    const itens: ItemVenda[] = [];
    for (const it of dados.itens) {
      const p = await db.produtos.get(it.produtoId);
      if (!p) throw new Error('Produto do carrinho não encontrado.');
      itens.push({
        produtoId: it.produtoId,
        nome: p.nome,
        unidade: p.unidade,
        categoria: p.categoria,
        quantidade: it.quantidade,
        precoUnit: it.precoUnit,
        custoUnit: p.custo,
        total: round2(it.quantidade * it.precoUnit),
      });
    }
    const subtotal = round2(itens.reduce((s, i) => s + i.total, 0));
    const desconto = round2(Math.min(Math.max(dados.desconto, 0), subtotal));
    const total = round2(subtotal - desconto);
    const custoTotal = round2(itens.reduce((s, i) => s + i.quantidade * i.custoUnit, 0));
    const venda: Venda = {
      data: agora,
      itens,
      subtotal,
      desconto,
      total,
      custoTotal,
      lucro: round2(total - custoTotal),
      pagamento: dados.pagamento,
      valorRecebido: dados.pagamento === 'dinheiro' ? dados.valorRecebido : undefined,
      troco: dados.pagamento === 'dinheiro' && dados.valorRecebido ? round2(Math.max(dados.valorRecebido - total, 0)) : undefined,
      cliente: dados.cliente?.trim() || undefined,
      status: 'concluida',
    };
    const vendaId = await db.vendas.add(venda);

    for (const it of itens) {
      const p = (await db.produtos.get(it.produtoId))!;
      const novoEstoque = round3(p.estoque - it.quantidade);
      await db.produtos.update(it.produtoId, { estoque: novoEstoque, atualizadoEm: agora });
      await db.movimentos.add({
        produtoId: it.produtoId,
        tipo: 'venda',
        quantidade: -it.quantidade,
        custoUnit: it.custoUnit,
        estoqueApos: novoEstoque,
        vendaId,
        data: agora,
      });
    }
    return { ...venda, id: vendaId };
  });
}

export async function cancelarVenda(vendaId: number) {
  return db.transaction('rw', db.produtos, db.movimentos, db.vendas, async () => {
    const v = await db.vendas.get(vendaId);
    if (!v) throw new Error('Venda não encontrada.');
    if (v.status === 'cancelada') return;
    const agora = Date.now();
    for (const it of v.itens) {
      const p = await db.produtos.get(it.produtoId);
      if (!p) continue;
      const novoEstoque = round3(p.estoque + it.quantidade);
      await db.produtos.update(it.produtoId, { estoque: novoEstoque, atualizadoEm: agora });
      await db.movimentos.add({
        produtoId: it.produtoId,
        tipo: 'cancelamento',
        quantidade: it.quantidade,
        custoUnit: it.custoUnit,
        estoqueApos: novoEstoque,
        vendaId,
        obs: `Cancelamento da venda #${vendaId}`,
        data: agora,
      });
    }
    await db.vendas.update(vendaId, { status: 'cancelada', canceladaEm: agora });
  });
}

// ---------------- Configurações e backup ----------------

export async function getConfig<T>(chave: string, padrao: T): Promise<T> {
  const c = await db.config.get(chave);
  return (c?.valor as T) ?? padrao;
}
export async function setConfig(chave: string, valor: unknown) {
  await db.config.put({ chave, valor });
}

export async function exportarBackup() {
  return {
    app: 'mercadinho-ml',
    versao: 1,
    geradoEm: new Date().toISOString(),
    produtos: await db.produtos.toArray(),
    movimentos: await db.movimentos.toArray(),
    vendas: await db.vendas.toArray(),
    config: await db.config.toArray(),
  };
}

export async function importarBackup(json: unknown) {
  const b = json as Awaited<ReturnType<typeof exportarBackup>>;
  if (!b || b.app !== 'mercadinho-ml' || !Array.isArray(b.produtos)) throw new Error('Arquivo de backup inválido.');
  await db.transaction('rw', db.produtos, db.movimentos, db.vendas, db.config, async () => {
    await Promise.all([db.produtos.clear(), db.movimentos.clear(), db.vendas.clear(), db.config.clear()]);
    await db.produtos.bulkAdd(b.produtos);
    await db.movimentos.bulkAdd(b.movimentos ?? []);
    await db.vendas.bulkAdd(b.vendas ?? []);
    await db.config.bulkAdd(b.config ?? []);
  });
}

export async function apagarTudo() {
  await db.transaction('rw', db.produtos, db.movimentos, db.vendas, db.config, async () => {
    await Promise.all([db.produtos.clear(), db.movimentos.clear(), db.vendas.clear(), db.config.clear()]);
  });
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
