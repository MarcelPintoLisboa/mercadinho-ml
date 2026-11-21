import { useMemo, useRef, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, finalizarVenda, PAGAMENTOS, type FormaPagamento, type Produto, type Venda } from '../db';
import { brl, num, parseNum, toInput, round2 } from '../utils';
import { useAvisos, Vazio } from '../components/ui';
import Icon from '../components/Icon';
import Recibo from '../components/Recibo';
import { Link } from 'react-router-dom';

interface Linha {
  produto: Produto;
  qtd: string; // texto para permitir decimais (kg)
  preco: number;
}

// Mantém o carrinho ao trocar de tela durante uma venda
let carrinhoSalvo: Linha[] = [];

export default function Vender() {
  const { aviso, confirmar } = useAvisos();
  const produtos = useLiveQuery(() => db.produtos.filter((p) => p.ativo).toArray(), [], []);
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState<Linha[]>(carrinhoSalvo);
  useEffect(() => {
    carrinhoSalvo = carrinho;
  }, [carrinho]);
  const [desconto, setDesconto] = useState('');
  const [descPct, setDescPct] = useState(false);
  const [pagamento, setPagamento] = useState<FormaPagamento>('dinheiro');
  const [recebido, setRecebido] = useState('');
  const [cliente, setCliente] = useState('');
  const [aba, setAba] = useState<'produtos' | 'carrinho'>('produtos');
  const [vendaFeita, setVendaFeita] = useState<Venda | null>(null);
  const [salvando, setSalvando] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Foca a busca no desktop (leitor de código de barras funciona como teclado)
    if (window.matchMedia('(min-width: 900px)').matches) buscaRef.current?.focus();
  }, []);

  const resultados = useMemo(() => {
    const b = busca.trim().toLowerCase().replace(/^\d+([.,]\d+)?\*/, '');
    const l = b ? produtos.filter((p) => p.nome.toLowerCase().includes(b) || (p.codigo && p.codigo.includes(b))) : produtos;
    return l.sort((a, b) => a.nome.localeCompare(b.nome)).slice(0, 60);
  }, [produtos, busca]);

  const adicionar = (p: Produto, qtd = 1) => {
    setCarrinho((c) => {
      const i = c.findIndex((l) => l.produto.id === p.id);
      if (i >= 0) {
        const n = [...c];
        n[i] = { ...n[i], qtd: toInput(round2(parseNum(n[i].qtd) + qtd)) };
        return n;
      }
      return [...c, { produto: p, qtd: toInput(qtd), preco: p.preco }];
    });
    setBusca('');
    buscaRef.current?.focus();
  };

  // Enter na busca: "código" ou "quantidade*código"
  const enterBusca = () => {
    const t = busca.trim();
    if (!t) return;
    const m = t.match(/^(\d+(?:[.,]\d+)?)\*(.+)$/);
    const qtd = m ? parseNum(m[1]) : 1;
    const termo = (m ? m[2] : t).trim();
    const exato = produtos.find((p) => p.codigo && p.codigo === termo);
    if (exato) return adicionar(exato, qtd);
    if (resultados.length === 1) return adicionar(resultados[0], qtd);
    aviso('Produto não encontrado. Selecione na lista.', 'erro');
  };

  const alterarQtd = (i: number, v: string) => setCarrinho((c) => c.map((l, j) => (j === i ? { ...l, qtd: v } : l)));
  const somar = (i: number, d: number) =>
    setCarrinho((c) => c.map((l, j) => (j === i ? { ...l, qtd: toInput(Math.max(round2(parseNum(l.qtd) + d), 0)) } : l)));
  const remover = (i: number) => setCarrinho((c) => c.filter((_, j) => j !== i));

  const subtotal = round2(carrinho.reduce((s, l) => s + parseNum(l.qtd) * l.preco, 0));
  const descValor = round2(Math.min(descPct ? (subtotal * parseNum(desconto)) / 100 : parseNum(desconto), subtotal));
  const total = round2(subtotal - descValor);
  const valorRecebido = parseNum(recebido);
  const troco = round2(valorRecebido - total);
  const qtdItens = carrinho.reduce((s, l) => s + parseNum(l.qtd), 0);

  const limpar = () => {
    setCarrinho([]);
    setDesconto('');
    setRecebido('');
    setCliente('');
    setPagamento('dinheiro');
    setAba('produtos');
  };

  const finalizar = async () => {
    const itens = carrinho.filter((l) => parseNum(l.qtd) > 0);
    if (!itens.length) return aviso('Adicione produtos ao carrinho.', 'erro');
    if (pagamento === 'dinheiro' && recebido && valorRecebido < total) return aviso('Valor recebido menor que o total.', 'erro');
    if (pagamento === 'fiado' && !cliente.trim()) return aviso('Informe o nome do cliente para venda fiado.', 'erro');
    const faltando = itens.filter((l) => parseNum(l.qtd) > l.produto.estoque);
    if (faltando.length) {
      const nomes = faltando.map((l) => l.produto.nome).join(', ');
      if (!(await confirmar(`Estoque insuficiente para: ${nomes}. Deseja vender mesmo assim?`))) return;
    }
    setSalvando(true);
    try {
      const v = await finalizarVenda({
        itens: itens.map((l) => ({ produtoId: l.produto.id!, quantidade: parseNum(l.qtd), precoUnit: l.preco })),
        desconto: descValor,
        pagamento,
        valorRecebido: valorRecebido || undefined,
        cliente,
      });
      setVendaFeita(v);
      limpar();
    } catch (e) {
      aviso((e as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  };

  if (!produtos.length)
    return (
      <div className="pagina">
        <h1>Vender</h1>
        <Vazio texto="Cadastre produtos no estoque para começar a vender.">
          <Link to="/produtos" className="btn btn-primario">Ir para o estoque</Link>
        </Vazio>
      </div>
    );

  return (
    <div className="pagina pdv">
      <div className="segmento largo so-mobile">
        <button className={aba === 'produtos' ? 'ativo' : ''} onClick={() => setAba('produtos')}>Produtos</button>
        <button className={aba === 'carrinho' ? 'ativo' : ''} onClick={() => setAba('carrinho')}>
          Carrinho {carrinho.length > 0 && `(${carrinho.length}) · ${brl(total)}`}
        </button>
      </div>

      <section className={'pdv-produtos' + (aba === 'produtos' ? ' visivel' : '')}>
        <div className="busca grande">
          <Icon name="search" />
          <input
            ref={buscaRef}
            placeholder="Nome ou código de barras  (ex.: 3*7891234...)"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enterBusca()}
          />
        </div>
        <div className="grade-produtos">
          {resultados.map((p) => (
            <button key={p.id} className={'card-produto' + (p.estoque <= 0 ? ' sem-estoque' : '')} onClick={() => adicionar(p)}>
              <span className="nome">{p.nome}</span>
              <span className="preco">{brl(p.preco)}<small>/{p.unidade}</small></span>
              <span className="est">Estoque: {num(p.estoque)}</span>
            </button>
          ))}
          {!resultados.length && <p className="muted">Nenhum produto encontrado.</p>}
        </div>
      </section>

      <section className={'pdv-carrinho' + (aba === 'carrinho' ? ' visivel' : '')}>
        <div className="carrinho-topo">
          <h2>Carrinho</h2>
          {carrinho.length > 0 && (
            <button className="btn btn-pequeno" onClick={async () => (await confirmar('Limpar o carrinho?')) && limpar()}>
              Limpar
            </button>
          )}
        </div>

        <div className="carrinho-itens">
          {!carrinho.length && <p className="muted centro">Toque nos produtos para adicionar.</p>}
          {carrinho.map((l, i) => (
            <div key={l.produto.id} className="item-carrinho">
              <div className="info">
                <strong>{l.produto.nome}</strong>
                <small>{brl(l.preco)} / {l.produto.unidade}</small>
              </div>
              <div className="qtd">
                <button className="btn-icone" onClick={() => somar(i, -1)} aria-label="Diminuir"><Icon name="remove" size={18} /></button>
                <input value={l.qtd} onChange={(e) => alterarQtd(i, e.target.value)} inputMode="decimal" aria-label="Quantidade" />
                <button className="btn-icone" onClick={() => somar(i, 1)} aria-label="Aumentar"><Icon name="add" size={18} /></button>
              </div>
              <strong className="total-item">{brl(parseNum(l.qtd) * l.preco)}</strong>
              <button className="btn-icone perigo" onClick={() => remover(i)} aria-label="Remover"><Icon name="close" size={18} /></button>
            </div>
          ))}
        </div>

        <div className="carrinho-fechamento">
          <div className="linha"><span>Subtotal ({num(qtdItens)} itens)</span><span>{brl(subtotal)}</span></div>
          <div className="linha desconto">
            <span>Desconto</span>
            <div className="desc-input">
              <input value={desconto} onChange={(e) => setDesconto(e.target.value)} inputMode="decimal" placeholder="0" />
              <button className="btn btn-pequeno" onClick={() => setDescPct(!descPct)}>{descPct ? '%' : 'R$'}</button>
            </div>
          </div>
          {descValor > 0 && <div className="linha muted"><span></span><span>- {brl(descValor)}</span></div>}
          <div className="linha total"><span>Total</span><span>{brl(total)}</span></div>

          <div className="pagamentos">
            {PAGAMENTOS.map((p) => (
              <button key={p.id} className={pagamento === p.id ? 'ativo' : ''} onClick={() => setPagamento(p.id)}>
                {p.nome.replace('Cartão de ', '')}
              </button>
            ))}
          </div>

          {pagamento === 'dinheiro' && (
            <div className="linha">
              <span>Valor recebido</span>
              <input className="input-dir" value={recebido} onChange={(e) => setRecebido(e.target.value)} inputMode="decimal" placeholder="0,00" />
            </div>
          )}
          {pagamento === 'dinheiro' && valorRecebido > 0 && (
            <div className={'linha troco ' + (troco < 0 ? 'neg' : '')}>
              <span>{troco < 0 ? 'Falta' : 'Troco'}</span>
              <strong>{brl(Math.abs(troco))}</strong>
            </div>
          )}
          {(pagamento === 'fiado' || cliente) && (
            <div className="linha">
              <span>Cliente</span>
              <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
            </div>
          )}

          <button className="btn btn-primario btn-gigante" onClick={finalizar} disabled={!carrinho.length || salvando}>
            <Icon name="check" /> Finalizar venda · {brl(total)}
          </button>
        </div>
      </section>

      {vendaFeita && <Recibo venda={vendaFeita} onFechar={() => setVendaFeita(null)} titulo="Venda concluída!" />}
    </div>
  );
}
