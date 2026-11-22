// Conexão do Mercadinho ML com a base de dados (Supabase) da ML Softwares.
//
// Como funciona:
//  - Os dados oficiais ficam na base (tabelas mercadinho_*), separados por usuário (login).
//  - O banco local do aparelho (Dexie) vira um ESPELHO: ao entrar, os dados da conta são baixados
//    para ele, e as telas continuam lendo dele (rápido e com atualização automática).
//  - Toda gravação vai primeiro para a base; só depois de confirmada o espelho é atualizado.
//    Vendas, cancelamentos, entradas e ajustes usam funções do banco que mexem no estoque de forma
//    atômica (dois aparelhos vendendo ao mesmo tempo não deixam o estoque errado).
//
// A chave anon/publishable é pública por natureza: a segurança fica nas regras (RLS) do banco.
// NUNCA coloque aqui a chave service_role/secret.
import { createClient } from '@supabase/supabase-js';
import type { Movimento, Produto, Venda, ItemVenda, Config } from './db';
import { db } from './db';

export const SUPABASE_URL = 'https://eoowbybfrbmjxcjfniuu.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_n5kj7FP4nEklOtYOt5GgKw_GpRUXs_t';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'mercadinho-ml-auth' },
});

type Linha = Record<string, unknown>;
const n = (v: unknown) => Number(v) || 0;
const ms = (v: unknown) => (v ? Date.parse(String(v)) : Date.now());
const opc = <T,>(v: T | null | undefined) => (v === null ? undefined : v);

// ---------- conversões base -> espelho ----------
const produtoApp = (r: Linha): Produto => ({
  id: n(r.id), nome: r.nome as string, codigo: (r.codigo as string) ?? '', categoria: r.categoria as string,
  unidade: r.unidade as Produto['unidade'], custo: n(r.custo), preco: n(r.preco), estoque: n(r.estoque),
  estoqueMinimo: n(r.estoque_minimo), ativo: r.ativo as boolean, criadoEm: ms(r.criado_em), atualizadoEm: ms(r.atualizado_em),
});
const movimentoApp = (r: Linha): Movimento => ({
  id: n(r.id), produtoId: n(r.produto_id), tipo: r.tipo as Movimento['tipo'], quantidade: n(r.quantidade),
  custoUnit: r.custo_unit == null ? undefined : n(r.custo_unit), estoqueApos: n(r.estoque_apos),
  obs: opc(r.obs as string | null), vendaId: r.venda_id == null ? undefined : n(r.venda_id), data: ms(r.data),
});
const itemApp = (r: Linha): ItemVenda => ({
  produtoId: n(r.produto_id), nome: r.nome as string, unidade: r.unidade as ItemVenda['unidade'], categoria: r.categoria as string,
  quantidade: n(r.quantidade), precoUnit: n(r.preco_unit), custoUnit: n(r.custo_unit), total: n(r.total),
});
const vendaApp = (r: Linha, itens: ItemVenda[]): Venda => ({
  id: n(r.id), data: ms(r.data), itens, subtotal: n(r.subtotal), desconto: n(r.desconto), total: n(r.total),
  custoTotal: n(r.custo_total), lucro: n(r.lucro), pagamento: r.pagamento as Venda['pagamento'],
  valorRecebido: r.valor_recebido == null ? undefined : n(r.valor_recebido), troco: r.troco == null ? undefined : n(r.troco),
  cliente: opc(r.cliente as string | null), status: r.status as Venda['status'],
  canceladaEm: r.cancelada_em ? ms(r.cancelada_em) : undefined,
});

// ---------- leitura ----------
async function lerTudo(tabela: string, ordem = 'id'): Promise<Linha[]> {
  const todos: Linha[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(tabela).select('*').order(ordem).range(de, de + 999);
    if (error) throw error;
    todos.push(...(data as Linha[]));
    if (data.length < 1000) break;
  }
  return todos;
}

async function lerOnde(tabela: string, coluna: string, valores: number[]): Promise<Linha[]> {
  if (!valores.length) return [];
  const { data, error } = await supabase.from(tabela).select('*').in(coluna, valores);
  if (error) throw error;
  return data as Linha[];
}

function montarVendas(vendas: Linha[], itens: Linha[]): Venda[] {
  const porVenda = new Map<number, ItemVenda[]>();
  for (const i of itens) {
    const k = n(i.venda_id);
    if (!porVenda.has(k)) porVenda.set(k, []);
    porVenda.get(k)!.push(itemApp(i));
  }
  return vendas.map((v) => vendaApp(v, porVenda.get(n(v.id)) ?? []));
}

const MARCA_ESPELHO = 'mercadinho-ml:espelho-de';
let ultimaCarga = 0;

/** Baixa todos os dados da conta e substitui o espelho local. */
export async function baixarTudo(userId: string) {
  const [produtos, movimentos, vendas, itens, config] = await Promise.all([
    lerTudo('mercadinho_produtos'),
    lerTudo('mercadinho_movimentos'),
    lerTudo('mercadinho_vendas'),
    lerTudo('mercadinho_venda_itens'),
    lerTudo('mercadinho_config', 'chave'),
  ]);
  await db.transaction('rw', db.produtos, db.movimentos, db.vendas, db.config, async () => {
    await Promise.all([db.produtos.clear(), db.movimentos.clear(), db.vendas.clear(), db.config.clear()]);
    await db.produtos.bulkPut(produtos.map(produtoApp));
    await db.movimentos.bulkPut(movimentos.map(movimentoApp));
    await db.vendas.bulkPut(montarVendas(vendas, itens));
    await db.config.bulkPut(config.map((c) => ({ chave: c.chave as string, valor: c.valor })));
  });
  localStorage.setItem(MARCA_ESPELHO, userId);
  ultimaCarga = Date.now();
}

/** Atualiza o espelho ao voltar para o app (no máximo a cada 60 s), para ver o que outros aparelhos gravaram. */
export async function atualizarSePreciso(userId: string) {
  if (Date.now() - ultimaCarga < 60_000) return;
  ultimaCarga = Date.now();
  await baixarTudo(userId).catch(() => undefined);
}

/** Há dados antigos (da versão sem login) neste aparelho que ainda não foram para nenhuma conta? */
export async function temDadosLocaisAntigos() {
  if (localStorage.getItem(MARCA_ESPELHO)) return false;
  return (await db.produtos.count()) + (await db.vendas.count()) > 0;
}

// ---------- atualização pontual do espelho ----------
async function espelharProdutos(ids: number[]) {
  const linhas = await lerOnde('mercadinho_produtos', 'id', [...new Set(ids)]);
  await db.produtos.bulkPut(linhas.map(produtoApp));
}
async function espelharMovimentos(coluna: 'produto_id' | 'venda_id', ids: number[]) {
  const linhas = await lerOnde('mercadinho_movimentos', coluna, [...new Set(ids)]);
  await db.movimentos.bulkPut(linhas.map(movimentoApp));
}
async function espelharVenda(id: number): Promise<Venda> {
  const [vendas, itens] = await Promise.all([lerOnde('mercadinho_vendas', 'id', [id]), lerOnde('mercadinho_venda_itens', 'venda_id', [id])]);
  const [venda] = montarVendas(vendas, itens);
  await db.vendas.put(venda);
  return venda;
}

// ---------- gravações ----------
export async function nuvemSalvarProduto(p: Produto): Promise<number> {
  const campos = {
    nome: p.nome, codigo: p.codigo, categoria: p.categoria, unidade: p.unidade, custo: p.custo, preco: p.preco,
    estoque: p.estoque, estoque_minimo: p.estoqueMinimo, ativo: p.ativo,
  };
  const q = p.id
    ? supabase.from('mercadinho_produtos').update(campos).eq('id', p.id).select().single()
    : supabase.from('mercadinho_produtos').insert(campos).select().single();
  const { data, error } = await q;
  if (error) throw traduzir(error, p.codigo);
  const salvo = produtoApp(data as Linha);
  await db.produtos.put(salvo);
  if (!p.id) await espelharMovimentos('produto_id', [salvo.id!]); // "Estoque inicial"
  return salvo.id!;
}

export async function nuvemDesativarProduto(id: number) {
  const { error } = await supabase.from('mercadinho_produtos').update({ ativo: false }).eq('id', id);
  if (error) throw traduzir(error);
  await espelharProdutos([id]);
}

export async function nuvemRegistrarEntrada(produtoId: number, quantidade: number, custoUnit: number, obs?: string, novoPreco?: number) {
  const { error } = await supabase.rpc('mercadinho_registrar_entrada', {
    p_produto_id: produtoId, p_quantidade: quantidade, p_custo_unit: custoUnit, p_obs: obs ?? null, p_novo_preco: novoPreco ?? null,
  });
  if (error) throw traduzir(error);
  await Promise.all([espelharProdutos([produtoId]), espelharMovimentos('produto_id', [produtoId])]);
}

export async function nuvemAjustarEstoque(produtoId: number, modo: 'ajuste' | 'perda', valor: number, obs?: string) {
  const { error } = await supabase.rpc('mercadinho_ajustar_estoque', {
    p_produto_id: produtoId, p_modo: modo, p_valor: valor, p_obs: obs ?? null,
  });
  if (error) throw traduzir(error);
  await Promise.all([espelharProdutos([produtoId]), espelharMovimentos('produto_id', [produtoId])]);
}

export async function nuvemFinalizarVenda(dados: {
  itens: { produtoId: number; quantidade: number; precoUnit: number }[];
  desconto: number;
  pagamento: Venda['pagamento'];
  valorRecebido?: number;
  cliente?: string;
}): Promise<Venda> {
  const { data, error } = await supabase.rpc('mercadinho_finalizar_venda', {
    p_itens: dados.itens.map((i) => ({ produto_id: i.produtoId, quantidade: i.quantidade, preco_unit: i.precoUnit })),
    p_pagamento: dados.pagamento,
    p_desconto: dados.desconto,
    p_valor_recebido: dados.valorRecebido ?? null,
    p_cliente: dados.cliente ?? null,
  });
  if (error) throw traduzir(error);
  const id = n((data as Linha).id);
  const venda = await espelharVenda(id);
  await Promise.all([espelharProdutos(venda.itens.map((i) => i.produtoId)), espelharMovimentos('venda_id', [id])]);
  return venda;
}

export async function nuvemCancelarVenda(vendaId: number) {
  const { error } = await supabase.rpc('mercadinho_cancelar_venda', { p_venda_id: vendaId });
  if (error) throw traduzir(error);
  const venda = await espelharVenda(vendaId);
  await Promise.all([espelharProdutos(venda.itens.map((i) => i.produtoId)), espelharMovimentos('venda_id', [vendaId])]);
}

export async function nuvemSetConfig(chave: string, valor: unknown) {
  const { error } = await supabase.from('mercadinho_config').upsert({ chave, valor }, { onConflict: 'owner_id,chave' });
  if (error) throw traduzir(error);
  await db.config.put({ chave, valor });
}

/** Apaga todos os dados da conta na base e no espelho. */
export async function nuvemApagarTudo() {
  for (const [tabela, col] of [
    ['mercadinho_vendas', 'id'], ['mercadinho_movimentos', 'id'], ['mercadinho_produtos', 'id'], ['mercadinho_config', 'chave'],
  ] as const) {
    const { error } = await supabase.from(tabela).delete().not(col, 'is', null);
    if (error) throw traduzir(error);
  }
  await db.transaction('rw', db.produtos, db.movimentos, db.vendas, db.config, async () => {
    await Promise.all([db.produtos.clear(), db.movimentos.clear(), db.vendas.clear(), db.config.clear()]);
  });
}

const pedacos = <T,>(arr: T[], k: number) => Array.from({ length: Math.ceil(arr.length / k) }, (_, i) => arr.slice(i * k, i * k + k));

async function inserirDevolvendoIds(tabela: string, linhas: Linha[]): Promise<number[]> {
  const ids: number[] = [];
  for (const parte of pedacos(linhas, 500)) {
    const { data, error } = await supabase.from(tabela).insert(parte).select('id');
    if (error) throw traduzir(error);
    if (data.length !== parte.length) throw new Error('Resposta inesperada da base ao importar.');
    ids.push(...data.map((r) => n(r.id)));
  }
  return ids;
}

/**
 * Envia para a conta um conjunto completo de dados (backup restaurado ou dados antigos deste aparelho).
 * Os ids mudam (os da base são únicos entre todos os usuários), então as referências são remapeadas.
 */
export async function nuvemImportar(b: { produtos: Produto[]; movimentos: Movimento[]; vendas: Venda[]; config: Config[] }) {
  const mapaProd = new Map<number, number>();
  const mapaVenda = new Map<number, number>();
  const iso = (t?: number) => new Date(t ?? Date.now()).toISOString();

  // 1) produtos com estoque 0 (o estoque final é aplicado no passo 4, sem gerar "Estoque inicial" duplicado)
  const prods = b.produtos ?? [];
  const novosProd = await inserirDevolvendoIds('mercadinho_produtos', prods.map((p) => ({
    nome: p.nome, codigo: p.codigo ?? '', categoria: p.categoria || 'Geral', unidade: p.unidade, custo: p.custo, preco: p.preco,
    estoque: 0, estoque_minimo: p.estoqueMinimo ?? 0, ativo: p.ativo !== false, criado_em: iso(p.criadoEm),
  })));
  prods.forEach((p, i) => mapaProd.set(p.id!, novosProd[i]));

  // 2) vendas e itens
  const vendas = b.vendas ?? [];
  const novasVendas = await inserirDevolvendoIds('mercadinho_vendas', vendas.map((v) => ({
    data: iso(v.data), subtotal: v.subtotal, desconto: v.desconto, total: v.total, custo_total: v.custoTotal, lucro: v.lucro,
    pagamento: v.pagamento, valor_recebido: v.valorRecebido ?? null, troco: v.troco ?? null, cliente: v.cliente ?? null,
    status: v.status, cancelada_em: v.canceladaEm ? iso(v.canceladaEm) : null,
  })));
  vendas.forEach((v, i) => mapaVenda.set(v.id!, novasVendas[i]));
  const itens = vendas.flatMap((v) => (v.itens ?? []).map((it) => ({
    venda_id: mapaVenda.get(v.id!), produto_id: mapaProd.get(it.produtoId) ?? null, nome: it.nome, unidade: it.unidade,
    categoria: it.categoria, quantidade: it.quantidade, preco_unit: it.precoUnit, custo_unit: it.custoUnit, total: it.total,
  })));
  for (const parte of pedacos(itens, 500)) {
    const { error } = await supabase.from('mercadinho_venda_itens').insert(parte);
    if (error) throw traduzir(error);
  }

  // 3) histórico de movimentações
  const movs = (b.movimentos ?? []).filter((m) => mapaProd.has(m.produtoId)).map((m) => ({
    produto_id: mapaProd.get(m.produtoId), tipo: m.tipo, quantidade: m.quantidade, custo_unit: m.custoUnit ?? null,
    estoque_apos: m.estoqueApos, obs: m.obs ?? null, venda_id: m.vendaId != null ? mapaVenda.get(m.vendaId) ?? null : null,
    data: iso(m.data),
  }));
  for (const parte of pedacos(movs, 500)) {
    const { error } = await supabase.from('mercadinho_movimentos').insert(parte);
    if (error) throw traduzir(error);
  }

  // 4) estoque final de cada produto
  for (const p of prods) {
    if (!p.estoque) continue;
    const { error } = await supabase.from('mercadinho_produtos').update({ estoque: p.estoque }).eq('id', mapaProd.get(p.id!)!);
    if (error) throw traduzir(error);
  }

  // 5) configurações
  const conf = (b.config ?? []).map((c) => ({ chave: c.chave, valor: c.valor }));
  if (conf.length) {
    const { error } = await supabase.from('mercadinho_config').upsert(conf, { onConflict: 'owner_id,chave' });
    if (error) throw traduzir(error);
  }
}

// ---------- erros ----------
function traduzir(error: { message?: string; code?: string }, codigo?: string): Error {
  const msg = error.message || '';
  if (error.code === '23505' && /codigo/i.test(msg)) return new Error(`O código "${codigo}" já está em uso por outro produto.`);
  return new Error(mensagemErro(error));
}

export function mensagemErro(e: unknown): string {
  const msg = String((e as { message?: string })?.message || e || '');
  if (/Failed to fetch|NetworkError|network|timeout|Load failed/i.test(msg)) return 'Sem conexão com a internet. Verifique a rede e tente de novo.';
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/banned/i.test(msg)) return 'Sua conta foi desativada. Fale com a ML Softwares: (81) 98805-5220.';
  if (/row-level security/i.test(msg)) return 'Sua conta está desativada ou sem permissão para esta ação. Fale com a ML Softwares.';
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/User already registered/i.test(msg)) return 'Já existe uma conta com este e-mail. Use "Entrar".';
  if (/Password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/JWT|session|not authenticated/i.test(msg)) return 'Sua sessão expirou. Entre novamente.';
  return msg || 'Erro inesperado.';
}
