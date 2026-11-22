import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { exportarBackup } from './db';
import { atualizarSePreciso, baixarTudo, mensagemErro, nuvemImportar, supabase, temDadosLocaisAntigos } from './nuvem';
import { useAvisos } from './components/ui';
import { isoDate, salvarArquivo } from './utils';
import Login from './pages/Login';

interface AuthCtx {
  user: User | null;
  sair: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>({ user: null, sair: async () => undefined });
export const useAuth = () => useContext(Ctx);

/**
 * Portão do app: sem login mostra a tela de entrar; com login baixa os dados da conta
 * para o banco local (espelho) e só então mostra as telas.
 */
export function Portao({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pronto, setPronto] = useState(false);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const { aviso, confirmar } = useAvisos();
  const user = session?.user ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setPronto(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // carrega os dados da conta (e oferece enviar os dados antigos deste aparelho)
  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    (async () => {
      setEstado('carregando');
      try {
        if (await temDadosLocaisAntigos()) {
          const enviar = await confirmar(
            'Encontramos produtos e vendas salvos só neste aparelho (versão sem login). Deseja enviá-los para a sua conta? ' +
              'Se escolher "Cancelar", eles serão substituídos pelos dados da conta.',
          );
          if (enviar) {
            await nuvemImportar(await exportarBackup());
            aviso('Dados deste aparelho enviados para a sua conta!');
          } else if (await confirmar('Os dados deste aparelho serão substituídos. Deseja baixar um arquivo de backup deles antes?')) {
            await salvarArquivo(
              `backup-mercadinho-ml_aparelho_${isoDate(Date.now())}.json`,
              JSON.stringify(await exportarBackup()),
              'application/json',
            );
          }
        }
        await baixarTudo(user.id);
        if (!cancelado) setEstado('ok');
      } catch (e) {
        if (!cancelado) {
          setErro(mensagemErro(e));
          setEstado('erro');
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [user?.id, tentativa]); // eslint-disable-line react-hooks/exhaustive-deps

  // ao voltar para o app, busca o que outros aparelhos gravaram
  useEffect(() => {
    if (!user || estado !== 'ok') return;
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') atualizarSePreciso(user.id);
    };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, [user?.id, estado]); // eslint-disable-line react-hooks/exhaustive-deps

  const valor = useMemo<AuthCtx>(() => ({ user, sair: async () => { await supabase.auth.signOut(); } }), [user]);

  if (!pronto) return <div className="portao"><div className="girando" /></div>;
  if (!user) return <Login />;
  if (estado === 'carregando') {
    return (
      <div className="portao">
        <div className="girando" />
        <p>Carregando seus dados…</p>
      </div>
    );
  }
  if (estado === 'erro') {
    return (
      <div className="portao">
        <h2>Sem conexão</h2>
        <p>{erro}</p>
        <button className="btn btn-primario" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Sair da conta</button>
      </div>
    );
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
