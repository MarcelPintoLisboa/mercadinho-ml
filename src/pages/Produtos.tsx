import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, salvarProduto, excluirProduto, registrarEntrada, ajustarEstoque, UNIDADES, type Produto, type Unidade, type TipoMovimento } from '../db';
import { brl, num, pct, parseNum, toInput, margem, markup, dataHora, baixarCSV, round2 } from '../utils';
import { Modal, Campo, Vazio, useAvisos } from '../components/ui';
import Icon from '../components/Icon';

type Filtro = 'todos' | 'baixo' | 'zerado';

export default function Produtos() {
  const { aviso, confirmar } = useAvisos();
  const produtos = useLiveQuery(() => db.produtos.filter((p) => p.ativo).toArray(), [], []);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [categoria, setCategoria] = useState('');
  const [editando, setEditando] = useState<Partial<Produto> | null>(null);
  const [entrada, setEntrada] = useState<Produto | null>(null);
  const [ajuste, setAjuste] = useState<Produto | null>(null);
  const [historico, setHistorico] = useState<Produto | null>(null);

  const categorias = useMemo(() => [...new Set(produtos.map((p) => p.categoria))].sort(), [produtos]);

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return produtos
      .filter((p) => !b || p.nome.toLowerCase().includes(b) || p.codigo.includes(b))
      .filter((p) => !categoria || p.categoria === categoria)
      .filter((p) => (filtro === 'baixo' ? p.estoque <= p.estoqueMinimo : filtro === 'zerado' ? p.estoque <= 0 : true))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [produtos, busca, filtro, categoria]);

  const resumo = useMemo(() => {
    const pos = produtos.filter((p) => p.estoque > 0);
    return {
      itens: produtos.length,
      custo: pos.reduce((s, p) => s + p.estoque * p.custo, 0),
      venda: pos.reduce((s, p) => s + p.estoque * p.preco, 0),
      baixo: produtos.filter((p) => p.estoque <= p.estoqueMinimo).length,
    };
  }, [produtos]);

  const exportar = () =>
    baixarCSV('estoque.csv', [
      ['Código', 'Produto', 'Categoria', 'Unidade', 'Custo', 'Preço venda', 'Margem %', 'Estoque', 'Estoque mínimo', 'Valor em custo', 'Valor em venda'],
      ...lista.map((p) => [
        p.codigo,
        p.nome,
        p.categoria,
        p.unidade,
        p.custo,
        p.preco,
        round2(margem(p.custo, p.preco) * 100),
        p.estoque,
        p.estoqueMinimo,
        round2(p.estoque * p.custo),
        round2(p.estoque * p.preco),
      ]),
    ]);

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <h1>Estoque</h1>
        <div className="acoes">
          <button className="btn" onClick={exportar} disabled={!lista.length}>
            <Icon name="download" size={18} /> Exportar
          </button>
          <button className="btn btn-primario" onClick={() => setEditando({ unidade: 'un', estoque: 0, estoqueMinimo: 0, categoria: '' })}>
            <Icon name="add" size={18} /> Novo produto
          </button>
        </div>
      </div>

      <div className="cards-kpi kpi-4">
        <div className="kpi"><span>Produtos</span><strong>{resumo.itens}</strong></div>
        <div className="kpi"><span>Estoque (custo)</span><strong>{brl(resumo.custo)}</strong></div>
        <div className="kpi"><span>Estoque (venda)</span><strong>{brl(resumo.venda)}</strong></div>
        <div className={'kpi' + (resumo.baixo ? ' kpi-alerta' : '')}>
          <span>Estoque baixo</span>
          <strong>{resumo.baixo}</strong>
        </div>
      </div>

      <div className="filtros">
        <div className="busca">
          <Icon name="search" size={18} />
          <input placeholder="Buscar por nome ou código..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <div className="segmento">
          {(['todos', 'baixo', 'zerado'] as Filtro[]).map((f) => (
            <button key={f} className={filtro === f ? 'ativo' : ''} onClick={() => setFiltro(f)}>
              {f === 'todos' ? 'Todos' : f === 'baixo' ? 'Estoque baixo' : 'Zerados'}
            </button>
          ))}
        </div>
      </div>

      {!produtos.length ? (
        <Vazio texto="Nenhum produto cadastrado ainda. Comece cadastrando seus produtos com preço de custo e de venda.">
          <button className="btn btn-primario" onClick={() => setEditando({ unidade: 'un', estoque: 0, estoqueMinimo: 0, categoria: '' })}>
            <Icon name="add" size={18} /> Cadastrar primeiro produto
          </button>
        </Vazio>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela tabela-cards">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th className="dir">Custo</th>
                <th className="dir">Venda</th>
                <th className="dir">Margem</th>
                <th className="dir">Estoque</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const m = margem(p.custo, p.preco);
                const baixo = p.estoque <= p.estoqueMinimo;
                return (
                  <tr key={p.id}>
                    <td data-l="Produto">
                      <strong>{p.nome}</strong>
                      {p.codigo && <small className="muted"> · {p.codigo}</small>}
                    </td>
                    <td data-l="Categoria">{p.categoria}</td>
                    <td data-l="Custo" className="dir">{brl(p.custo)}</td>
                    <td data-l="Venda" className="dir"><strong>{brl(p.preco)}</strong></td>
                    <td data-l="Margem" className={'dir ' + (m < 0 ? 'neg' : m < 0.15 ? 'aviso' : 'pos')}>{pct(m)}</td>
                    <td data-l="Estoque" className="dir">
                      <span className={'chip ' + (p.estoque <= 0 ? 'chip-erro' : baixo ? 'chip-aviso' : 'chip-ok')}>
                        {num(p.estoque)} {p.unidade}
                      </span>
                    </td>
                    <td className="acoes-linha">
                      <button className="btn-icone" title="Entrada de mercadoria" onClick={() => setEntrada(p)}>
                        <Icon name="entrada" size={20} />
                      </button>
                      <button className="btn-icone" title="Ajuste / perda" onClick={() => setAjuste(p)}>
                        <Icon name="ajuste" size={20} />
                      </button>
                      <button className="btn-icone" title="Histórico" onClick={() => setHistorico(p)}>
                        <Icon name="historico" size={20} />
                      </button>
                      <button className="btn-icone" title="Editar" onClick={() => setEditando(p)}>
                        <Icon name="edit" size={20} />
                      </button>
                      <button
                        className="btn-icone perigo"
                        title="Excluir"
                        onClick={async () => {
                          if (await confirmar(`Excluir o produto "${p.nome}"? O histórico de vendas será mantido.`)) {
                            try {
                              await excluirProduto(p.id!);
                              aviso('Produto excluído.');
                            } catch (e) {
                              aviso((e as Error).message, 'erro');
                            }
                          }
                        }}
                      >
                        <Icon name="delete" size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!lista.length && (
                <tr>
                  <td colSpan={7} className="centro muted">Nenhum produto encontrado com esses filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && <FormProduto inicial={editando} categorias={categorias} onFechar={() => setEditando(null)} />}
      {entrada && <FormEntrada produto={entrada} onFechar={() => setEntrada(null)} />}
      {ajuste && <FormAjuste produto={ajuste} onFechar={() => setAjuste(null)} />}
      {historico && <Historico produto={historico} onFechar={() => setHistorico(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------

function FormProduto({ inicial, categorias, onFechar }: { inicial: Partial<Produto>; categorias: string[]; onFechar: () => void }) {
  const { aviso } = useAvisos();
  const novo = !inicial.id;
  const [f, setF] = useState({
    nome: inicial.nome ?? '',
    codigo: inicial.codigo ?? '',
    categoria: inicial.categoria ?? '',
    unidade: (inicial.unidade ?? 'un') as Unidade,
    custo: toInput(inicial.custo),
    preco: toInput(inicial.preco),
    estoque: toInput(inicial.estoque ?? 0),
    estoqueMinimo: toInput(inicial.estoqueMinimo ?? 0),
  });
  const [margemDesejada, setMargemDesejada] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const custo = parseNum(f.custo);
  const preco = parseNum(f.preco);

  const aplicarMargem = () => {
    const m = parseNum(margemDesejada) / 100;
    if (custo > 0 && m > -1) setF({ ...f, preco: toInput(round2(custo * (1 + m))) });
  };

  const salvar = async () => {
    if (!f.nome.trim()) return aviso('Informe o nome do produto.', 'erro');
    if (preco <= 0) return aviso('Informe o preço de venda.', 'erro');
    try {
      await salvarProduto({
        ...(inicial as Produto),
        id: inicial.id,
        nome: f.nome,
        codigo: f.codigo,
        categoria: f.categoria,
        unidade: f.unidade,
        custo,
        preco,
        estoque: novo ? parseNum(f.estoque) : inicial.estoque!,
        estoqueMinimo: parseNum(f.estoqueMinimo),
        ativo: true,
      });
      aviso(novo ? 'Produto cadastrado!' : 'Produto atualizado!');
      onFechar();
    } catch (e) {
      aviso((e as Error).message, 'erro');
    }
  };

  return (
    <Modal
      titulo={novo ? 'Novo produto' : 'Editar produto'}
      aberto
      onFechar={onFechar}
      rodape={
        <>
          <button className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primario" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <div className="grade-form">
        <Campo rotulo="Nome do produto *">
          <input value={f.nome} onChange={set('nome')} autoFocus placeholder="Ex.: Arroz Tio João 1kg" />
        </Campo>
        <Campo rotulo="Código de barras / código" dica="Pode usar leitor de código de barras">
          <input value={f.codigo} onChange={set('codigo')} inputMode="numeric" />
        </Campo>
        <Campo rotulo="Categoria">
          <input value={f.categoria} onChange={set('categoria')} list="lista-categorias" placeholder="Ex.: Mercearia" />
          <datalist id="lista-categorias">
            {categorias.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Campo>
        <Campo rotulo="Unidade">
          <select value={f.unidade} onChange={set('unidade')}>
            {UNIDADES.map((u) => <option key={u}>{u}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Preço de custo (R$)">
          <input value={f.custo} onChange={set('custo')} inputMode="decimal" placeholder="0,00" />
        </Campo>
        <Campo rotulo="Preço de venda (R$) *">
          <input value={f.preco} onChange={set('preco')} inputMode="decimal" placeholder="0,00" />
        </Campo>
        {novo && (
          <Campo rotulo="Estoque inicial">
            <input value={f.estoque} onChange={set('estoque')} inputMode="decimal" />
          </Campo>
        )}
        <Campo rotulo="Estoque mínimo" dica="Avisa quando o estoque chegar nesse valor">
          <input value={f.estoqueMinimo} onChange={set('estoqueMinimo')} inputMode="decimal" />
        </Campo>
      </div>

      <div className="caixa-info">
        <div>
          <span>Lucro por unidade</span>
          <strong className={preco - custo < 0 ? 'neg' : 'pos'}>{brl(preco - custo)}</strong>
        </div>
        <div>
          <span>Margem</span>
          <strong>{pct(margem(custo, preco))}</strong>
        </div>
        <div>
          <span>Markup</span>
          <strong>{pct(markup(custo, preco))}</strong>
        </div>
      </div>
      <div className="linha-margem">
        <span>Calcular preço com markup de</span>
        <input value={margemDesejada} onChange={(e) => setMargemDesejada(e.target.value)} inputMode="decimal" placeholder="30" />
        <span>%</span>
        <button className="btn btn-pequeno" onClick={aplicarMargem} disabled={!custo}>Aplicar</button>
      </div>
      {!novo && <p className="muted pequeno">Para alterar a quantidade em estoque use "Entrada de mercadoria" ou "Ajuste".</p>}
    </Modal>
  );
}

function FormEntrada({ produto, onFechar }: { produto: Produto; onFechar: () => void }) {
  const { aviso } = useAvisos();
  const [qtd, setQtd] = useState('');
  const [custo, setCusto] = useState(toInput(produto.custo));
  const [preco, setPreco] = useState(toInput(produto.preco));
  const [obs, setObs] = useState('');
  const q = parseNum(qtd);
  const c = parseNum(custo);

  const salvar = async () => {
    try {
      await registrarEntrada(produto.id!, q, c, obs || undefined, parseNum(preco) !== produto.preco ? parseNum(preco) : undefined);
      aviso('Entrada registrada!');
      onFechar();
    } catch (e) {
      aviso((e as Error).message, 'erro');
    }
  };

  return (
    <Modal
      titulo="Entrada de mercadoria"
      aberto
      onFechar={onFechar}
      rodape={
        <>
          <button className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primario" onClick={salvar} disabled={!(q > 0)}>Registrar entrada</button>
        </>
      }
    >
      <p><strong>{produto.nome}</strong> — estoque atual: {num(produto.estoque)} {produto.unidade}</p>
      <div className="grade-form">
        <Campo rotulo={`Quantidade (${produto.unidade}) *`}>
          <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" autoFocus />
        </Campo>
        <Campo rotulo="Custo unitário desta compra (R$)">
          <input value={custo} onChange={(e) => setCusto(e.target.value)} inputMode="decimal" />
        </Campo>
        <Campo rotulo="Preço de venda (R$)" dica="Altere se quiser reajustar">
          <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" />
        </Campo>
        <Campo rotulo="Observação / fornecedor">
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: NF 1234 - Atacadão" />
        </Campo>
      </div>
      {q > 0 && (
        <div className="caixa-info">
          <div><span>Total da compra</span><strong>{brl(q * c)}</strong></div>
          <div><span>Novo estoque</span><strong>{num(produto.estoque + q)} {produto.unidade}</strong></div>
          <div>
            <span>Novo custo médio</span>
            <strong>
              {brl(Math.max(produto.estoque, 0) + q > 0 ? (Math.max(produto.estoque, 0) * produto.custo + q * c) / (Math.max(produto.estoque, 0) + q) : c)}
            </strong>
          </div>
        </div>
      )}
    </Modal>
  );
}

function FormAjuste({ produto, onFechar }: { produto: Produto; onFechar: () => void }) {
  const { aviso } = useAvisos();
  const [modo, setModo] = useState<'ajuste' | 'perda'>('ajuste');
  const [valor, setValor] = useState(modo === 'ajuste' ? toInput(produto.estoque) : '');
  const [obs, setObs] = useState('');

  const salvar = async () => {
    try {
      await ajustarEstoque(produto.id!, modo, parseNum(valor), obs || undefined);
      aviso(modo === 'ajuste' ? 'Estoque ajustado!' : 'Perda registrada!');
      onFechar();
    } catch (e) {
      aviso((e as Error).message, 'erro');
    }
  };

  return (
    <Modal
      titulo="Ajuste de estoque"
      aberto
      onFechar={onFechar}
      rodape={
        <>
          <button className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primario" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <p><strong>{produto.nome}</strong> — estoque atual: {num(produto.estoque)} {produto.unidade}</p>
      <div className="segmento largo">
        <button className={modo === 'ajuste' ? 'ativo' : ''} onClick={() => { setModo('ajuste'); setValor(toInput(produto.estoque)); }}>
          Contagem (inventário)
        </button>
        <button className={modo === 'perda' ? 'ativo' : ''} onClick={() => { setModo('perda'); setValor(''); }}>
          Perda / quebra / vencido
        </button>
      </div>
      <div className="grade-form">
        <Campo rotulo={modo === 'ajuste' ? 'Quantidade contada' : 'Quantidade perdida'}>
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" autoFocus />
        </Campo>
        <Campo rotulo="Motivo">
          <input value={obs} onChange={(e) => setObs(e.target.value)} />
        </Campo>
      </div>
      {modo === 'perda' && parseNum(valor) > 0 && (
        <p className="neg">Prejuízo estimado: {brl(parseNum(valor) * produto.custo)}</p>
      )}
    </Modal>
  );
}

const NOMES_MOV: Record<TipoMovimento, string> = {
  entrada: 'Entrada',
  ajuste: 'Ajuste',
  perda: 'Perda',
  venda: 'Venda',
  cancelamento: 'Venda cancelada',
};

function Historico({ produto, onFechar }: { produto: Produto; onFechar: () => void }) {
  const movs = useLiveQuery(
    () => db.movimentos.where('produtoId').equals(produto.id!).reverse().sortBy('data'),
    [produto.id],
    [],
  );
  return (
    <Modal titulo={`Histórico — ${produto.nome}`} aberto onFechar={onFechar} largo>
      {!movs.length ? (
        <p className="muted">Sem movimentações.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th className="dir">Qtd</th>
                <th className="dir">Saldo</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {movs.slice(0, 300).map((m) => (
                <tr key={m.id}>
                  <td>{dataHora(m.data)}</td>
                  <td>{NOMES_MOV[m.tipo]}{m.vendaId ? ` #${m.vendaId}` : ''}</td>
                  <td className={'dir ' + (m.quantidade < 0 ? 'neg' : 'pos')}>
                    {m.quantidade > 0 ? '+' : ''}{num(m.quantidade)}
                  </td>
                  <td className="dir">{num(m.estoqueApos)}</td>
                  <td className="muted">{m.obs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
