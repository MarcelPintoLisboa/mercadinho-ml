import { useLiveQuery } from 'dexie-react-hooks';
import { db, nomePagamento, type Venda } from '../db';
import { brl, num, dataHora } from '../utils';
import { Modal } from './ui';
import Icon from './Icon';
import { useLogoPersonalizada } from '../logo';

export default function Recibo({
  venda,
  onFechar,
  titulo,
  acoesExtras,
}: {
  venda: Venda;
  onFechar: () => void;
  titulo?: string;
  acoesExtras?: React.ReactNode;
}) {
  const nomeLoja = useLiveQuery(async () => ((await db.config.get('nomeLoja'))?.valor as string) || 'Mercadinho ML');
  const logo = useLogoPersonalizada(); // no comprovante, só aparece se o usuário escolheu uma imagem

  return (
    <Modal
      titulo={titulo ?? `Venda #${venda.id}`}
      aberto
      onFechar={onFechar}
      rodape={
        <>
          {acoesExtras}
          <button className="btn" onClick={() => window.print()}>
            <Icon name="print" size={18} /> Imprimir
          </button>
          <button className="btn btn-primario" onClick={onFechar} autoFocus>
            OK
          </button>
        </>
      }
    >
      <div className="recibo" id="area-impressao">
        <div className="centro">
          {logo && <img src={logo} alt="" className="recibo-logo" />}
          <strong>{nomeLoja}</strong>
          <div className="muted pequeno">Comprovante não fiscal</div>
          <div className="pequeno">Venda #{venda.id} · {dataHora(venda.data)}</div>
          {venda.status === 'cancelada' && <div className="chip chip-erro">CANCELADA</div>}
        </div>
        <hr />
        {venda.itens.map((i, k) => (
          <div key={k} className="recibo-item">
            <div>{i.nome}</div>
            <div className="recibo-linha">
              <span>{num(i.quantidade)} {i.unidade} x {brl(i.precoUnit)}</span>
              <span>{brl(i.total)}</span>
            </div>
          </div>
        ))}
        <hr />
        <div className="recibo-linha"><span>Subtotal</span><span>{brl(venda.subtotal)}</span></div>
        {venda.desconto > 0 && <div className="recibo-linha"><span>Desconto</span><span>- {brl(venda.desconto)}</span></div>}
        <div className="recibo-linha grande"><strong>Total</strong><strong>{brl(venda.total)}</strong></div>
        <div className="recibo-linha"><span>Pagamento</span><span>{nomePagamento(venda.pagamento)}</span></div>
        {venda.valorRecebido ? <div className="recibo-linha"><span>Recebido</span><span>{brl(venda.valorRecebido)}</span></div> : null}
        {venda.troco ? <div className="recibo-linha"><span>Troco</span><strong>{brl(venda.troco)}</strong></div> : null}
        {venda.cliente && <div className="recibo-linha"><span>Cliente</span><span>{venda.cliente}</span></div>}
        <hr />
        <div className="centro pequeno">Obrigado pela preferência!</div>
      </div>
    </Modal>
  );
}
