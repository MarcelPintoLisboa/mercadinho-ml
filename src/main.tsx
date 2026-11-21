import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import Layout from './components/Layout';
import { AvisosProvider } from './components/ui';
import Painel from './pages/Painel';
import Vender from './pages/Vender';
import Produtos from './pages/Produtos';
import Vendas from './pages/Vendas';
import Ajuda from './pages/Ajuda';
import Config from './pages/Config';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AvisosProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Painel />} />
            <Route path="/vender" element={<Vender />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/vendas" element={<Vendas />} />
            <Route path="/ajuda" element={<Ajuda />} />
            <Route path="/config" element={<Config />} />
          </Route>
        </Routes>
      </HashRouter>
    </AvisosProvider>
  </React.StrictMode>,
);
