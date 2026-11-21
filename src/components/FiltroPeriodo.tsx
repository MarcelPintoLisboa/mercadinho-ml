import { PERIODOS, isoDate, type Periodo } from '../utils';

export interface EstadoPeriodo {
  periodo: Periodo;
  de: string;
  ate: string;
}

export const periodoInicial = (p: Periodo = 'hoje'): EstadoPeriodo => ({ periodo: p, de: isoDate(Date.now()), ate: isoDate(Date.now()) });

export default function FiltroPeriodo({ valor, onChange }: { valor: EstadoPeriodo; onChange: (v: EstadoPeriodo) => void }) {
  return (
    <div className="filtro-periodo">
      <select value={valor.periodo} onChange={(e) => onChange({ ...valor, periodo: e.target.value as Periodo })} aria-label="Período">
        {PERIODOS.map((p) => (
          <option key={p.id} value={p.id}>{p.nome}</option>
        ))}
      </select>
      {valor.periodo === 'custom' && (
        <>
          <input type="date" value={valor.de} onChange={(e) => onChange({ ...valor, de: e.target.value })} aria-label="De" />
          <span>até</span>
          <input type="date" value={valor.ate} onChange={(e) => onChange({ ...valor, ate: e.target.value })} aria-label="Até" />
        </>
      )}
    </div>
  );
}
