# Mercadinho ML

Sistema de controle de mercadinho para **Windows (desktop)**, **Android** e **iOS**, feito com um único código
(React + TypeScript). Funciona **offline**: os dados ficam guardados no próprio aparelho.

## Funcionalidades

- **Estoque**: cadastro de produtos com preço de custo e de venda, margem/markup calculados, código de barras,
  categoria, unidade (un, kg, L…), estoque mínimo com alerta, entrada de mercadoria (custo médio ponderado),
  ajuste de inventário, registro de perdas e histórico de movimentações. Exporta CSV.
- **Vender (PDV)**: busca por nome ou código de barras (aceita leitor USB e `quantidade*código`), carrinho,
  desconto em R$ ou %, formas de pagamento (dinheiro com troco, PIX, débito, crédito, fiado) e comprovante para imprimir.
- **Vendas**: histórico com filtros por período/forma de pagamento, detalhes e cancelamento (devolve ao estoque). Exporta CSV.
- **Painel de indicadores**: faturamento, lucro bruto, margem, nº de vendas, ticket médio, itens vendidos, custo,
  descontos, comparação com o período anterior, faturamento por dia/hora, formas de pagamento, vendas por categoria,
  produtos mais vendidos, valor do estoque, perdas e produtos para repor.
- **Ajuda**: contatos (WhatsApp, telefone, Instagram, e-mail) e perguntas frequentes.
- **Configurações**: nome do mercadinho, backup/restauração (arquivo .json), produtos de exemplo.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/` | Aplicação (telas em `src/pages`, banco de dados em `src/db.ts`) |
| `electron/` | Janela do app desktop |
| `android/`, `ios/` | Projetos nativos gerados pelo Capacitor |
| `assets/logo-original.png` | Logo usado para gerar todos os ícones |
| `scripts/gen-icons.mjs` | Gera os ícones de desktop/web e a base dos ícones de celular |

## Instaladores automáticos (GitHub Actions)

O workflow `.github/workflows/build.yml` gera os instaladores de **Android, iOS, Windows e Mac** no GitHub.
Para usar: **Actions → Gerar instaladores → Run workflow**, ou envie uma tag (`git tag v1.0.1 && git push origin v1.0.1`)
para publicar uma Release com todos os arquivos. Configuração de assinaturas e instalação: [docs/INSTALADORES.md](docs/INSTALADORES.md).

## Comandos

```bash
npm install            # instalar dependências
npm run dev            # abrir no navegador (http://localhost:5173)
npm run electron:dev   # abrir como app desktop em modo desenvolvimento
npm run electron:build # gerar instalador do Windows em release/
npm run android        # compilar e abrir o projeto no Android Studio
npm run ios            # compilar e abrir o projeto no Xcode (somente Mac)
```

### Desktop (Windows)
`npm run electron:build` gera em `release/`:
- `Mercadinho ML Setup 1.0.0.exe` → instalador (cria atalho na área de trabalho)
- `Mercadinho ML 1.0.0.exe` → versão portátil (não precisa instalar)

### Android
Requisitos: **Android Studio** (que já traz o Java 21). Depois:
1. `npm run android` (abre o Android Studio)
2. Para testar: conecte o celular e clique em ▶ Run
3. Para publicar: *Build → Generate Signed App Bundle / APK*

### iOS
Requer um **Mac com Xcode** e conta de desenvolvedor Apple (para publicar na App Store).
No Mac: `npm install`, `npm run ios`, selecionar o time de assinatura em *Signing & Capabilities* e rodar.

### Trocar o ícone
Substitua `assets/logo-original.png` e rode:
```bash
npm run icons
npx capacitor-assets generate --android --ios --iconBackgroundColor "#18753d" --splashBackgroundColor "#1f9d55"
```

## Observações
- Os dados ficam **no aparelho** (IndexedDB). Cada aparelho tem seu próprio banco; para passar dados entre
  aparelhos use **Configurações → Fazer backup / Restaurar backup**. Recomenda-se backup frequente.
- Se o `npm run electron:dev` falhar dentro do terminal do VS Code com "Cannot find module 'electron'",
  remova a variável de ambiente `ELECTRON_RUN_AS_NODE` (o VS Code às vezes a define).
