import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, cancelarVenda, nomePagamento, PAGAMENTOS, type FormaPagamento, type Venda } from '../db';
import { brl, dataHora, intervalo, baixarCSV, isoDate } from '../utils';
import { useAvisos, Vazio } from '../components/ui';
import FiltroPeriodo, { periodoInicial } from '../components/FiltroPeriodo';
import Recibo from '../components/Recibo';
import Icon from '../components/Icon';

export default function Vendas() {
  const { aviso, confirmar } = useAvisos();
  const [per, setPer] = useState(periodoInicial('hoje'));
  const [pag, setPag] = useState<FormaPagamento | ''>('');
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<Venda | null>(null);

  const [ini, fim] = intervalo(per.periodo, per.de, per.ate);
  const vendas = useLiveQuery(() => db.vendas.where('data').between(ini, fim, true, true).reverse().toArray(), [ini, fim], []);

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return vendas
      .filter((v) => mostrarCanceladas || v.status === 'concluida')
      .filter((v) => !pag || v.pagamento === pag)
      .filter(
        (v) =>
          !b ||
          String(v.id) === b.replace('#', '') ||
          v.cliente?.toLowerCase().includes(b) ||
          v.itens.some((i) => i.nome.toLowerCase().includes(b)),
      );
  }, [vendas, pag, mostrarCanceladas, busca]);

  const ok = lista.filter((v) => v.status === 'concluida');
  const total = ok.reduce((s, v) => s + v.total, 0);
  const lucro = ok.reduce((s, v) => s + v.lucro, 0);

  const exportar = () =>
    baixarCSV(`vendas_${isoDate(ini)}_${isoDate(fim)}.csv`, [
      ['Venda', 'Data', 'Status', 'Pagamento', 'Cliente', 'Itens', 'Subtotal', 'Desconto', 'Total', 'Custo', 'Lucro'],
      ...lista.map((v) => [
        v.id!,
        dataHora(v.data),
        v.status,
        nomePagamento(v.pagamento),
        v.cliente ?? '',
        v.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(' | '),
        v.subtotal,
        v.desconto,
        v.total,
        v.custoTotal,
        v.lucro,
      ]),
    ]);

  const cancelar = async (v: Venda) => {
    if (!(await confirmar(`Cancelar a venda #${v.id} de ${brl(v.total)}? Os produtos voltarão para o estoque.`))) return;
    await cancelarVenda(v.id!);
    aviso('Venda cancelada e estoque devolvido.');
    setAberta(null);
  };

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <h1>Vendas</h1>
        <div className="acoes">
          <button className="btn" onClick={exportar} disabled={!lista.length}>
            <Icon name="download" size={18} /> Exportar
          </button>
        </div>
      </div>

      <div className="filtros">
        <FiltroPeriodo valor={per} onChange={setPer} />
        <select value={pag} onChange={(e) => setPag(e.target.value as FormaPagamento | '')}>
          <option value="">Todas as formas</option>
          {PAGAMENTOS.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <div className="busca">
          <Icon name="search" size={18} />
          <input placeholder="Nº, cliente ou produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <label className="check">
          <input type="checkbox" checked={mostrarCanceladas} onChange={(e) => setMostrarCanceladas(e.target.checked)} />
          Mostrar canceladas
        </label>
      </div>

      <div className="cards-kpi kpi-3">
        <div className="kpi"><span>Vendas</span><strong>{ok.length}</strong></div>
        <div className="kpi"><span>Faturamento</span><strong>{brl(total)}</strong></div>
        <div className="kpi"><span>Lucro</span><strong className={lucro < 0 ? 'neg' : 'pos'}>{brl(lucro)}</strong></div>
      </div>

      {!lista.length ? (
        <Vazio texto="Nenhuma venda neste período." />
      ) : (
        <div className="tabela-wrap">
          <table className="tabela tabela-cards clicavel">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Data</th>
                <th>Itens</th>
                <th>Pagamento</th>
                <th className="dir">Total</th>
                <th className="dir">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => (
                <tr key={v.id} onClick={() => setAberta(v)} className={v.status === 'cancelada' ? 'cancelada' : ''}>
                  <td data-l="Nº"><strong>#{v.id}</strong>{v.status === 'cancelada' && <span className="chip chip-erro">cancelada</span>}</td>
                  <td data-l="Data">{dataHora(v.data)}</td>
                  <td data-l="Itens" className="resumo-itens">
                    {v.itens.length} {v.itens.length === 1 ? 'item' : 'itens'}
                    <small className="muted"> · {v.itens.map((i) => i.nome).join(', ')}</small>
                  </td>
                  <td data-l="Pagamento">{nomePagamento(v.pagamento)}{v.cliente ? ` · ${v.cliente}` : ''}</td>
                  <td data-l="Total" className="dir"><strong>{brl(v.total)}</strong></td>
                  <td data-l="Lucro" className={'dir ' + (v.lucro < 0 ? 'neg' : 'pos')}>{brl(v.lucro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aberta && (
        <Recibo
          venda={aberta}
          onFechar={() => setAberta(null)}
          acoesExtras={
            aberta.status === 'concluida' && (
              <button className="btn btn-perigo" onClick={() => cancelar(aberta)}>
                <Icon name="cancel" size={18} /> Cancelar venda
              </button>
            )
          }
        />
      )}
    </div>
  );
}
