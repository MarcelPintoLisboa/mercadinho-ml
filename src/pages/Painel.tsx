import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { db, nomePagamento, type FormaPagamento } from '../db';
import { brl, num, pct, intervalo, dataCurta, baixarCSV, isoDate, round2 } from '../utils';
import FiltroPeriodo, { periodoInicial } from '../components/FiltroPeriodo';
import Icon from '../components/Icon';

/** Lê as cores do tema (claro/escuro) definidas no CSS. */
function useCores() {
  const ler = () => {
    const s = getComputedStyle(document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    return { barra: v('--grafico'), grade: v('--borda'), texto: v('--texto-2'), fundo: v('--superficie') };
  };
  const [c, setC] = useState(ler);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => setC(ler());
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return c;
}

const DIA = 86400000;

export default function Painel() {
  const cores = useCores();
  const [per, setPer] = useState(periodoInicial('mes'));
  const [ini, fim] = intervalo(per.periodo, per.de, per.ate);

  const vendas = useLiveQuery(
    () => db.vendas.where('data').between(ini, fim, true, true).filter((v) => v.status === 'concluida').toArray(),
    [ini, fim],
    [],
  );
  // Período anterior de mesmo tamanho, para comparação
  const anteriores = useLiveQuery(
    () =>
      db.vendas
        .where('data')
        .between(ini - (fim - ini + 1), ini - 1, true, true)
        .filter((v) => v.status === 'concluida')
        .toArray(),
    [ini, fim],
    [],
  );
  const produtos = useLiveQuery(() => db.produtos.filter((p) => p.ativo).toArray(), [], []);
  const perdas = useLiveQuery(
    () => db.movimentos.where('data').between(ini, fim, true, true).filter((m) => m.tipo === 'perda').toArray(),
    [ini, fim],
    [],
  );

  const ind = useMemo(() => {
    const fat = vendas.reduce((s, v) => s + v.total, 0);
    const custo = vendas.reduce((s, v) => s + v.custoTotal, 0);
    const lucro = vendas.reduce((s, v) => s + v.lucro, 0);
    const desc = vendas.reduce((s, v) => s + v.desconto, 0);
    const itens = vendas.reduce((s, v) => s + v.itens.reduce((a, i) => a + i.quantidade, 0), 0);
    const fatAnt = anteriores.reduce((s, v) => s + v.total, 0);
    const lucroAnt = anteriores.reduce((s, v) => s + v.lucro, 0);
    const perda = perdas.reduce((s, m) => s + Math.abs(m.quantidade) * (m.custoUnit ?? 0), 0);
    return {
      fat,
      custo,
      lucro,
      desc,
      itens,
      n: vendas.length,
      ticket: vendas.length ? fat / vendas.length : 0,
      margem: fat ? lucro / fat : 0,
      varFat: fatAnt ? (fat - fatAnt) / fatAnt : null,
      varLucro: lucroAnt ? (lucro - lucroAnt) / Math.abs(lucroAnt) : null,
      perda,
    };
  }, [vendas, anteriores, perdas]);

  // Série diária (ou por hora quando o período é um único dia)
  const umDia = fim - ini < DIA;
  const serie = useMemo(() => {
    if (umDia) {
      const h = Array.from({ length: 24 }, (_, i) => ({ rotulo: `${i}h`, faturamento: 0, lucro: 0, vendas: 0 }));
      for (const v of vendas) {
        const x = h[new Date(v.data).getHours()];
        x.faturamento += v.total;
        x.lucro += v.lucro;
        x.vendas++;
      }
      const usadas = h.map((x, i) => (x.vendas ? i : -1)).filter((i) => i >= 0);
      const a = usadas.length ? Math.min(...usadas, 7) : 7;
      const b = usadas.length ? Math.max(...usadas, 19) : 19;
      return h.slice(a, b + 1).map((x) => ({ ...x, faturamento: round2(x.faturamento), lucro: round2(x.lucro) }));
    }
    const dias = new Map<string, { rotulo: string; faturamento: number; lucro: number; vendas: number }>();
    const ultimo = Math.min(fim, Date.now());
    for (let t = ini; t <= ultimo; t += DIA) dias.set(isoDate(t), { rotulo: dataCurta(t), faturamento: 0, lucro: 0, vendas: 0 });
    for (const v of vendas) {
      const x = dias.get(isoDate(v.data));
      if (!x) continue;
      x.faturamento += v.total;
      x.lucro += v.lucro;
      x.vendas++;
    }
    return [...dias.values()].map((x) => ({ ...x, faturamento: round2(x.faturamento), lucro: round2(x.lucro) }));
  }, [vendas, ini, fim, umDia]);

  const porPagamento = useMemo(() => {
    const m = new Map<FormaPagamento, { total: number; n: number }>();
    for (const v of vendas) {
      const x = m.get(v.pagamento) ?? { total: 0, n: 0 };
      x.total += v.total;
      x.n++;
      m.set(v.pagamento, x);
    }
    return [...m.entries()].map(([id, x]) => ({ nome: nomePagamento(id), ...x })).sort((a, b) => b.total - a.total);
  }, [vendas]);

  const porCategoria = useMemo(() => {
    const m = new Map<string, { total: number; lucro: number }>();
    for (const v of vendas) {
      const fator = v.subtotal ? v.total / v.subtotal : 1; // rateia o desconto
      for (const i of v.itens) {
        const x = m.get(i.categoria) ?? { total: 0, lucro: 0 };
        x.total += i.total * fator;
        x.lucro += i.total * fator - i.quantidade * i.custoUnit;
        m.set(i.categoria, x);
      }
    }
    return [...m.entries()].map(([nome, x]) => ({ nome, ...x })).sort((a, b) => b.total - a.total);
  }, [vendas]);

  const topProdutos = useMemo(() => {
    const m = new Map<number, { nome: string; unidade: string; qtd: number; total: number; lucro: number }>();
    for (const v of vendas) {
      const fator = v.subtotal ? v.total / v.subtotal : 1;
      for (const i of v.itens) {
        const x = m.get(i.produtoId) ?? { nome: i.nome, unidade: i.unidade, qtd: 0, total: 0, lucro: 0 };
        x.qtd += i.quantidade;
        x.total += i.total * fator;
        x.lucro += i.total * fator - i.quantidade * i.custoUnit;
        m.set(i.produtoId, x);
      }
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [vendas]);

  const estoque = useMemo(() => {
    const pos = produtos.filter((p) => p.estoque > 0);
    return {
      custo: pos.reduce((s, p) => s + p.estoque * p.custo, 0),
      venda: pos.reduce((s, p) => s + p.estoque * p.preco, 0),
      baixo: produtos.filter((p) => p.estoque <= p.estoqueMinimo).sort((a, b) => a.estoque - b.estoque),
    };
  }, [produtos]);

  const exportar = () =>
    baixarCSV(`produtos_vendidos_${isoDate(ini)}_${isoDate(fim)}.csv`, [
      ['Produto', 'Quantidade', 'Unidade', 'Faturamento', 'Lucro', 'Margem %'],
      ...topProdutos.map((p) => [p.nome, round2(p.qtd), p.unidade, round2(p.total), round2(p.lucro), p.total ? round2((p.lucro / p.total) * 100) : 0]),
    ]);

  const maxPag = Math.max(...porPagamento.map((p) => p.total), 1);
  const maxCat = Math.max(...porCategoria.map((p) => p.total), 1);
  const maxProd = Math.max(...topProdutos.map((p) => p.total), 1);

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <h1>Painel de indicadores</h1>
        <div className="acoes">
          <FiltroPeriodo valor={per} onChange={setPer} />
        </div>
      </div>

      <div className="cards-kpi">
        <Kpi titulo="Faturamento" valor={brl(ind.fat)} variacao={ind.varFat} destaque />
        <Kpi titulo="Lucro bruto" valor={brl(ind.lucro)} variacao={ind.varLucro} classe={ind.lucro < 0 ? 'neg' : 'pos'} />
        <Kpi titulo="Margem" valor={pct(ind.margem)} />
        <Kpi titulo="Nº de vendas" valor={String(ind.n)} />
        <Kpi titulo="Ticket médio" valor={brl(ind.ticket)} />
        <Kpi titulo="Itens vendidos" valor={num(ind.itens)} />
        <Kpi titulo="Custo das mercadorias" valor={brl(ind.custo)} />
        <Kpi titulo="Descontos dados" valor={brl(ind.desc)} />
      </div>

      <div className="grade-paineis">
        <div className="painel largo">
          <h3>{umDia ? 'Faturamento por hora' : 'Faturamento por dia'}</h3>
          {ind.n === 0 ? (
            <p className="muted centro">Sem vendas no período.</p>
          ) : (
            <div className="grafico">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                  <CartesianGrid vertical={false} stroke={cores.grade} strokeDasharray="0" />
                  <XAxis dataKey="rotulo" tick={{ fill: cores.texto, fontSize: 12 }} tickLine={false} axisLine={{ stroke: cores.grade }} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis tick={{ fill: cores.texto, fontSize: 12 }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => (v >= 1000 ? `${round2(v / 1000)}k` : String(v))} />
                  <Tooltip cursor={{ fill: cores.grade, opacity: 0.5 }} content={<DicaGrafico />} />
                  <Bar dataKey="faturamento" fill={cores.barra} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={400} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="painel">
          <h3>Formas de pagamento</h3>
          {!porPagamento.length && <p className="muted">Sem vendas no período.</p>}
          {porPagamento.map((p) => (
            <BarraH key={p.nome} rotulo={p.nome} valor={brl(p.total)} detalhe={`${p.n} vendas · ${pct(p.total / (ind.fat || 1))}`} frac={p.total / maxPag} />
          ))}
        </div>

        <div className="painel">
          <h3>Vendas por categoria</h3>
          {!porCategoria.length && <p className="muted">Sem vendas no período.</p>}
          {porCategoria.slice(0, 8).map((c) => (
            <BarraH key={c.nome} rotulo={c.nome} valor={brl(c.total)} detalhe={`lucro ${brl(c.lucro)}`} frac={c.total / maxCat} />
          ))}
        </div>

        <div className="painel largo">
          <div className="painel-topo">
            <h3>Produtos mais vendidos</h3>
            <button className="btn btn-pequeno" onClick={exportar} disabled={!topProdutos.length}>
              <Icon name="download" size={16} /> CSV
            </button>
          </div>
          {!topProdutos.length ? (
            <p className="muted">Sem vendas no período.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Produto</th>
                    <th className="dir">Qtd</th>
                    <th className="dir">Faturamento</th>
                    <th className="dir">Lucro</th>
                    <th className="dir">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {topProdutos.slice(0, 15).map((p, i) => (
                    <tr key={p.nome + i}>
                      <td className="muted">{i + 1}</td>
                      <td>
                        {p.nome}
                        <div className="mini-barra"><i style={{ width: `${(p.total / maxProd) * 100}%` }} /></div>
                      </td>
                      <td className="dir">{num(p.qtd)} {p.unidade}</td>
                      <td className="dir">{brl(p.total)}</td>
                      <td className={'dir ' + (p.lucro < 0 ? 'neg' : 'pos')}>{brl(p.lucro)}</td>
                      <td className="dir">{pct(p.total ? p.lucro / p.total : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="painel">
          <h3>Estoque</h3>
          <div className="linha-info"><span>Valor em custo</span><strong>{brl(estoque.custo)}</strong></div>
          <div className="linha-info"><span>Valor em venda</span><strong>{brl(estoque.venda)}</strong></div>
          <div className="linha-info"><span>Lucro potencial</span><strong className="pos">{brl(estoque.venda - estoque.custo)}</strong></div>
          <div className="linha-info"><span>Perdas no período</span><strong className={ind.perda ? 'neg' : ''}>{brl(ind.perda)}</strong></div>
        </div>

        <div className="painel">
          <div className="painel-topo">
            <h3>Repor estoque</h3>
            {estoque.baixo.length > 0 && <span className="chip chip-aviso"><Icon name="alerta" size={14} /> {estoque.baixo.length}</span>}
          </div>
          {!estoque.baixo.length ? (
            <p className="muted"><Icon name="check" size={16} /> Nenhum produto abaixo do mínimo.</p>
          ) : (
            <>
              {estoque.baixo.slice(0, 8).map((p) => (
                <div key={p.id} className="linha-info">
                  <span>{p.nome}</span>
                  <span className={'chip ' + (p.estoque <= 0 ? 'chip-erro' : 'chip-aviso')}>
                    {num(p.estoque)} / mín. {num(p.estoqueMinimo)} {p.unidade}
                  </span>
                </div>
              ))}
              <Link to="/produtos" className="link">Ver estoque completo →</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ titulo, valor, variacao, destaque, classe }: { titulo: string; valor: string; variacao?: number | null; destaque?: boolean; classe?: string }) {
  return (
    <div className={'kpi' + (destaque ? ' kpi-destaque' : '')}>
      <span>{titulo}</span>
      <strong className={classe}>{valor}</strong>
      {variacao !== undefined && variacao !== null && (
        <small className={variacao >= 0 ? 'pos' : 'neg'}>
          {variacao >= 0 ? '▲' : '▼'} {pct(Math.abs(variacao))} vs. período anterior
        </small>
      )}
    </div>
  );
}

function BarraH({ rotulo, valor, detalhe, frac }: { rotulo: string; valor: string; detalhe?: string; frac: number }) {
  return (
    <div className="barra-h" title={`${rotulo}: ${valor}${detalhe ? ' · ' + detalhe : ''}`}>
      <div className="barra-h-topo">
        <span>{rotulo}</span>
        <strong>{valor}</strong>
      </div>
      <div className="barra-h-trilho"><i style={{ width: `${Math.max(frac * 100, 1)}%` }} /></div>
      {detalhe && <small className="muted">{detalhe}</small>}
    </div>
  );
}

function DicaGrafico({ active, payload, label }: { active?: boolean; payload?: { payload: { faturamento: number; lucro: number; vendas: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="dica-grafico">
      <strong>{label}</strong>
      <div>Faturamento: <b>{brl(d.faturamento)}</b></div>
      <div>Lucro: <b>{brl(d.lucro)}</b></div>
      <div>Vendas: <b>{d.vendas}</b></div>
    </div>
  );
}
