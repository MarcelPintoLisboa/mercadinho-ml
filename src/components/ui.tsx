import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Icon from './Icon';

// ---------- Modal ----------
export function Modal({
  titulo,
  aberto,
  onFechar,
  children,
  rodape,
  largo,
}: {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largo?: boolean;
}) {
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className={'modal' + (largo ? ' modal-largo' : '')} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-topo">
          <h2>{titulo}</h2>
          <button className="btn-icone" onClick={onFechar} aria-label="Fechar">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-corpo">{children}</div>
        {rodape && <div className="modal-rodape">{rodape}</div>}
      </div>
    </div>
  );
}

// ---------- Avisos (toast) e confirmação ----------
type Toast = { id: number; texto: string; tipo: 'ok' | 'erro' };
type Confirmacao = { texto: string; resolver: (v: boolean) => void } | null;

const Ctx = createContext<{
  aviso: (texto: string, tipo?: 'ok' | 'erro') => void;
  confirmar: (texto: string) => Promise<boolean>;
}>({ aviso: () => undefined, confirmar: async () => false });

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [conf, setConf] = useState<Confirmacao>(null);

  const aviso = useCallback((texto: string, tipo: 'ok' | 'erro' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, texto, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const confirmar = useCallback((texto: string) => new Promise<boolean>((resolver) => setConf({ texto, resolver })), []);
  const responder = (v: boolean) => {
    conf?.resolver(v);
    setConf(null);
  };

  return (
    <Ctx.Provider value={{ aviso, confirmar }}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={'toast toast-' + t.tipo}>
            <Icon name={t.tipo === 'ok' ? 'check' : 'alerta'} size={18} />
            {t.texto}
          </div>
        ))}
      </div>
      <Modal
        titulo="Confirmar"
        aberto={!!conf}
        onFechar={() => responder(false)}
        rodape={
          <>
            <button className="btn" onClick={() => responder(false)}>
              Não
            </button>
            <button className="btn btn-primario" onClick={() => responder(true)} autoFocus>
              Sim
            </button>
          </>
        }
      >
        <p>{conf?.texto}</p>
      </Modal>
    </Ctx.Provider>
  );
}

export const useAvisos = () => useContext(Ctx);

// ---------- Campo ----------
export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
      {dica && <small>{dica}</small>}
    </label>
  );
}

export function Vazio({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="vazio">
      <img src="./logo.png" alt="" />
      <p>{texto}</p>
      {children}
    </div>
  );
}
