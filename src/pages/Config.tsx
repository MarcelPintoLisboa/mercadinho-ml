import { useEffect, useRef, useState } from 'react';
import { exportarBackup, importarBackup, apagarTudo, getConfig, setConfig, salvarProduto } from '../db';
import { salvarArquivo, isoDate } from '../utils';
import { Campo, useAvisos } from '../components/ui';
import Icon from '../components/Icon';
import { useAuth } from '../auth';

export default function Config() {
  const { aviso, confirmar } = useAvisos();
  const { user, sair } = useAuth();
  const [nomeLoja, setNomeLoja] = useState('');
  const [ultimoBackup, setUltimoBackup] = useState<number | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getConfig('nomeLoja', '').then(setNomeLoja);
    getConfig<number | null>('ultimoBackup', null).then(setUltimoBackup);
  }, []);

  const salvarNome = async () => {
    try {
      await setConfig('nomeLoja', nomeLoja.trim());
      aviso('Nome salvo!');
    } catch (e) {
      aviso((e as Error).message, 'erro');
    }
  };

  const backup = async () => {
    try {
      const dados = await exportarBackup();
      await salvarArquivo(`backup-mercadinho-ml_${isoDate(Date.now())}.json`, JSON.stringify(dados), 'application/json');
      const agora = Date.now();
      await setConfig('ultimoBackup', agora);
      setUltimoBackup(agora);
      aviso('Backup gerado!');
    } catch (e) {
      aviso('Não foi possível gerar o backup: ' + (e as Error).message, 'erro');
    }
  };

  const restaurar = async (f: File) => {
    try {
      const json = JSON.parse(await f.text());
      if (!(await confirmar('Restaurar este backup? TODOS os dados atuais serão substituídos.'))) return;
      await importarBackup(json);
      aviso('Backup restaurado com sucesso!');
      setNomeLoja(await getConfig('nomeLoja', ''));
    } catch (e) {
      aviso((e as Error).message || 'Arquivo inválido.', 'erro');
    } finally {
      if (arquivo.current) arquivo.current.value = '';
    }
  };

  const exemplo = async () => {
    const itens: [string, string, string, number, number, number, number][] = [
      ['Arroz Branco 1kg', '7890000000011', 'Mercearia', 4.8, 6.99, 30, 10],
      ['Feijão Carioca 1kg', '7890000000028', 'Mercearia', 6.2, 8.49, 25, 10],
      ['Açúcar Cristal 1kg', '7890000000035', 'Mercearia', 3.9, 5.29, 20, 8],
      ['Café 250g', '7890000000042', 'Mercearia', 8.5, 12.9, 15, 5],
      ['Óleo de Soja 900ml', '7890000000059', 'Mercearia', 5.9, 7.99, 18, 6],
      ['Leite Integral 1L', '7890000000066', 'Laticínios', 3.6, 4.99, 40, 12],
      ['Refrigerante 2L', '7890000000073', 'Bebidas', 6.5, 9.99, 24, 8],
      ['Água Mineral 500ml', '7890000000080', 'Bebidas', 0.9, 2.5, 48, 12],
      ['Pão Francês (kg)', '', 'Padaria', 9.0, 15.9, 5, 2],
      ['Banana Prata (kg)', '', 'Hortifruti', 3.5, 6.99, 12, 3],
      ['Sabão em Pó 800g', '7890000000097', 'Limpeza', 9.9, 14.5, 10, 4],
      ['Papel Higiênico 4un', '7890000000103', 'Higiene', 4.5, 6.99, 3, 6],
    ];
    let ok = 0;
    let ultimoErro = '';
    for (const [nome, codigo, categoria, custo, preco, estoque, min] of itens) {
      await salvarProduto({ nome, codigo, categoria, unidade: nome.includes('(kg)') ? 'kg' : 'un', custo, preco, estoque, estoqueMinimo: min, ativo: true })
        .then(() => ok++)
        .catch((e: Error) => { ultimoErro = e.message; });
    }
    if (ok) aviso(`${ok} produtos de exemplo adicionados!`);
    else aviso(ultimoErro || 'Nenhum produto adicionado.', 'erro');
  };

  return (
    <div className="pagina config">
      <h1>Configurações</h1>

      <section className="painel">
        <h3>Dados do estabelecimento</h3>
        <Campo rotulo="Nome do mercadinho" dica="Aparece no menu e no comprovante de venda">
          <input value={nomeLoja} onChange={(e) => setNomeLoja(e.target.value)} placeholder="Ex.: Mercadinho do Bairro" />
        </Campo>
        <button className="btn btn-primario" onClick={salvarNome}>Salvar</button>
      </section>

      <section className="painel">
        <h3>Backup dos dados</h3>
        <p className="muted">
          Seus dados ficam salvos na nuvem, na sua conta: entre com o mesmo e-mail em outro aparelho para ver tudo.
          O backup é uma cópia extra em arquivo (guarde no Google Drive, e-mail ou WhatsApp).
        </p>
        <p className="pequeno">
          Último backup: <strong>{ultimoBackup ? new Date(ultimoBackup).toLocaleString('pt-BR') : 'nunca'}</strong>
        </p>
        <div className="acoes">
          <button className="btn btn-primario" onClick={backup}><Icon name="download" size={18} /> Fazer backup</button>
          <button className="btn" onClick={() => arquivo.current?.click()}><Icon name="upload" size={18} /> Restaurar backup</button>
          <input ref={arquivo} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && restaurar(e.target.files[0])} />
        </div>
      </section>

      <section className="painel">
        <h3>Outros</h3>
        <div className="acoes">
          <button className="btn" onClick={exemplo}>Adicionar produtos de exemplo</button>
          <button
            className="btn btn-perigo"
            onClick={async () => {
              if (!(await confirmar('Apagar TODOS os produtos, vendas e configurações? Essa ação não pode ser desfeita.'))) return;
              if (!(await confirmar('Tem certeza absoluta? Recomendamos fazer um backup antes.'))) return;
              try {
                await apagarTudo();
                setNomeLoja('');
                aviso('Todos os dados foram apagados.');
              } catch (e) {
                aviso((e as Error).message, 'erro');
              }
            }}
          >
            <Icon name="delete" size={18} /> Apagar todos os dados
          </button>
        </div>
      </section>

      <section className="painel">
        <h3>Conta</h3>
        <p className="muted">Conectado como <strong>{user?.email}</strong></p>
        <div className="acoes">
          <button
            className="btn btn-perigo"
            onClick={async () => {
              if (await confirmar('Sair da conta? Seus dados continuam salvos na nuvem.')) await sair();
            }}
          >
            Sair da conta
          </button>
        </div>
      </section>
    </div>
  );
}
