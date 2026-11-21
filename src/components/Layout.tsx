import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Icon from './Icon';
import { db } from '../db';

const MENU = [
  { to: '/', nome: 'Painel', icone: 'painel' },
  { to: '/vender', nome: 'Vender', icone: 'vender' },
  { to: '/produtos', nome: 'Estoque', icone: 'produtos' },
  { to: '/vendas', nome: 'Vendas', icone: 'vendas' },
  { to: '/ajuda', nome: 'Ajuda', icone: 'ajuda' },
];

export default function Layout() {
  const loc = useLocation();
  const nomeLoja = useLiveQuery(async () => (await db.config.get('nomeLoja'))?.valor as string | undefined);
  const baixo = useLiveQuery(() => db.produtos.filter((p) => p.ativo && p.estoque <= p.estoqueMinimo).count(), [], 0);
  const titulo = [...MENU, { to: '/config', nome: 'Configurações' }].find((m) => m.to === loc.pathname)?.nome ?? '';

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <img src="./icon-192.png" alt="Mercadinho ML" />
          <div>
            <strong>Mercadinho ML</strong>
            {nomeLoja && <small>{nomeLoja}</small>}
          </div>
        </div>
        <nav>
          {MENU.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.to === '/'} className="nav-item">
              <Icon name={m.icone} />
              <span>{m.nome}</span>
              {m.to === '/produtos' && baixo > 0 && <em className="badge">{baixo}</em>}
            </NavLink>
          ))}
          <NavLink to="/config" className="nav-item">
            <Icon name="config" />
            <span>Configurações</span>
          </NavLink>
        </nav>
      </aside>

      <header className="topo-mobile">
        <img src="./icon-192.png" alt="" />
        <strong>{titulo || 'Mercadinho ML'}</strong>
        <NavLink to="/config" className="btn-icone" aria-label="Configurações">
          <Icon name="config" />
        </NavLink>
      </header>

      <main className="conteudo">
        <Outlet />
      </main>

      <nav className="inferior">
        {MENU.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.to === '/'} className="nav-inf">
            <Icon name={m.icone} />
            <span>{m.nome}</span>
            {m.to === '/produtos' && baixo > 0 && <em className="badge">{baixo}</em>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
