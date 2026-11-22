import Dexie, { type Table } from 'dexie';
import { round2 } from './utils';
import {
  supabase, baixarTudo, nuvemSalvarProduto, nuvemDesativarProduto, nuvemRegistrarEntrada, nuvemAjustarEstoque,
  nuvemFinalizarVenda, nuvemCancelarVenda, nuvemSetConfig, nuvemApagarTudo, nuvemImportar,
} from './nuvem';

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

// ---------------- Gravações (vão para a base de dados; o banco local é só um espelho) ----------------
// As telas continuam chamando estas funções como antes. Ver src/nuvem.ts.

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
  return nuvemSalvarProduto(dados);
}

export async function excluirProduto(id: number) {
  // Mantém o histórico de vendas: o produto é apenas desativado
  await nuvemDesativarProduto(id);
}

/** Entrada de mercadoria. Atualiza o custo pelo custo médio ponderado (calculado no banco). */
export async function registrarEntrada(produtoId: number, quantidade: number, custoUnit: number, obs?: string, novoPreco?: number) {
  if (!(quantidade > 0)) throw new Error('Informe uma quantidade maior que zero.');
  await nuvemRegistrarEntrada(produtoId, quantidade, round2(custoUnit), obs, novoPreco && novoPreco > 0 ? round2(novoPreco) : undefined);
}

/** Ajuste de inventário (define a quantidade contada) ou registro de perda. */
export async function ajustarEstoque(produtoId: number, modo: 'ajuste' | 'perda', valor: number, obs?: string) {
  if (modo === 'perda' && !(valor > 0)) throw new Error('Informe a quantidade perdida.');
  await nuvemAjustarEstoque(produtoId, modo, round3(valor), obs);
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
  return nuvemFinalizarVenda({
    ...dados,
    valorRecebido: dados.pagamento === 'dinheiro' ? dados.valorRecebido : undefined,
    cliente: dados.cliente?.trim() || undefined,
  });
}

export async function cancelarVenda(vendaId: number) {
  const v = await db.vendas.get(vendaId);
  if (v?.status === 'cancelada') return;
  await nuvemCancelarVenda(vendaId);
}

// ---------------- Configurações e backup ----------------

export async function getConfig<T>(chave: string, padrao: T): Promise<T> {
  const c = await db.config.get(chave);
  return (c?.valor as T) ?? padrao;
}
export async function setConfig(chave: string, valor: unknown) {
  await nuvemSetConfig(chave, valor);
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

/** Restaura um backup: substitui TODOS os dados da conta pelos do arquivo. */
export async function importarBackup(json: unknown) {
  const b = json as Awaited<ReturnType<typeof exportarBackup>>;
  if (!b || b.app !== 'mercadinho-ml' || !Array.isArray(b.produtos)) throw new Error('Arquivo de backup inválido.');
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Entre na sua conta para restaurar o backup.');
  await nuvemApagarTudo();
  await nuvemImportar(b);
  await baixarTudo(data.user.id);
}

export async function apagarTudo() {
  await nuvemApagarTudo();
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
