import Icon from '../components/Icon';

// Contatos do suporte
const TELEFONE = '81988055220';
const TELEFONE_FMT = '(81) 98805-5220';
const INSTAGRAM = 'marcelisboa';
const EMAIL = 'mapl11@hotmail.com';

const CONTATOS = [
  { icone: 'whatsapp', titulo: 'WhatsApp', valor: TELEFONE_FMT, href: `https://wa.me/55${TELEFONE}?text=${encodeURIComponent('Olá! Preciso de ajuda com o app Mercadinho ML.')}`, cor: 'whats', externo: true },
  { icone: 'phone', titulo: 'Telefone', valor: TELEFONE_FMT, href: `tel:+55${TELEFONE}`, cor: 'tel', externo: false },
  { icone: 'instagram', titulo: 'Instagram', valor: `@${INSTAGRAM}`, href: `https://instagram.com/${INSTAGRAM}`, cor: 'insta', externo: true },
  { icone: 'email', titulo: 'E-mail', valor: EMAIL, href: `mailto:${EMAIL}?subject=${encodeURIComponent('Suporte Mercadinho ML')}`, cor: 'email', externo: false },
];

const PERGUNTAS = [
  {
    p: 'Como cadastro um produto?',
    r: 'Vá em Estoque → "Novo produto". Informe nome, preço de custo, preço de venda e a quantidade inicial. O sistema mostra o lucro e a margem na hora. Use o campo "markup" para calcular o preço de venda automaticamente.',
  },
  {
    p: 'Chegou mercadoria. Como dou entrada?',
    r: 'Em Estoque, clique no ícone de seta para baixo (Entrada de mercadoria) do produto. Informe a quantidade e o custo desta compra. O custo do produto é atualizado pelo custo médio, deixando o cálculo do lucro sempre correto.',
  },
  {
    p: 'Como faço uma venda?',
    r: 'Em Vender, toque nos produtos ou digite o nome / código de barras e aperte Enter. Para vários de uma vez digite "quantidade*código" (ex.: 3*7891234567890). Escolha a forma de pagamento, informe o valor recebido para calcular o troco e finalize.',
  },
  {
    p: 'Posso usar leitor de código de barras?',
    r: 'Sim. No computador, qualquer leitor USB funciona: basta deixar o cursor no campo de busca da tela Vender e passar o produto.',
  },
  {
    p: 'Vendi errado. Como cancelo?',
    r: 'Em Vendas, abra a venda e clique em "Cancelar venda". Os produtos voltam automaticamente para o estoque e a venda sai dos indicadores.',
  },
  {
    p: 'Produto venceu ou quebrou. O que faço?',
    r: 'Em Estoque, use o ícone de Ajuste e escolha "Perda / quebra / vencido". O prejuízo aparece no Painel em "Perdas no período". Para corrigir após uma contagem, use "Contagem (inventário)".',
  },
  {
    p: 'Onde ficam meus dados? E se eu trocar de aparelho?',
    r: 'Os dados ficam guardados no próprio aparelho e o app funciona sem internet. Faça backup com frequência em Configurações → "Fazer backup" e guarde o arquivo (Google Drive, WhatsApp, e-mail). Para passar para outro aparelho, use "Restaurar backup".',
  },
];

export default function Ajuda() {
  return (
    <div className="pagina ajuda">
      <div className="ajuda-hero">
        <img src="./logo.png" alt="Mercadinho ML" />
        <div>
          <h1>Precisa de ajuda?</h1>
          <p>Fale com a gente pelos canais abaixo. Teremos prazer em ajudar!</p>
        </div>
      </div>

      <div className="contatos">
        {CONTATOS.map((c) => (
          <a key={c.titulo} className={'contato contato-' + c.cor} href={c.href} {...(c.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            <span className="contato-icone"><Icon name={c.icone} size={28} /></span>
            <span>
              <small>{c.titulo}</small>
              <strong>{c.valor}</strong>
            </span>
          </a>
        ))}
      </div>

      <h2>Perguntas frequentes</h2>
      <div className="faq">
        {PERGUNTAS.map((q) => (
          <details key={q.p}>
            <summary>{q.p}</summary>
            <p>{q.r}</p>
          </details>
        ))}
      </div>

      <p className="muted centro pequeno">Mercadinho ML · versão 1.0.0</p>
    </div>
  );
}
