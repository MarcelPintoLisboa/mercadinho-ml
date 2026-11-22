# Publicar o Mercadinho ML na Microsoft Store

Pela Loja, a Microsoft assina o app: quem instala não vê o aviso "O Windows protegeu o computador"
(SmartScreen) e recebe as atualizações automaticamente.

## 1. Criar a conta de desenvolvedor (uma vez)

1. Acesse https://storedeveloper.microsoft.com e clique em **Começar / Get started**.
2. Escolha conta **Individual** (pessoa física) e entre com sua conta Microsoft (Hotmail/Outlook).
3. Preencha os dados e a verificação de identidade (documento + selfie, quando pedido).
4. Aguarde a aprovação (normalmente de algumas horas a poucos dias).

## 2. Reservar o nome do app

1. No **Partner Center** (https://partner.microsoft.com/dashboard/apps-and-games/overview),
   clique em **Novo produto → Aplicativo MSIX ou PWA**.
2. Reserve o nome **Mercadinho ML** (ou outro, se já estiver em uso).

## 3. Copiar os dados de identidade

No app criado, abra **Gerenciamento de produtos → Identidade do produto**. Copie:

| Campo no Partner Center | Variável no GitHub |
|---|---|
| Package/Identity/Name | `MS_STORE_IDENTITY_NAME` |
| Package/Identity/Publisher (começa com `CN=`) | `MS_STORE_PUBLISHER` |
| Package/Properties/PublisherDisplayName | `MS_STORE_PUBLISHER_DISPLAY_NAME` |
| Nome reservado | `MS_STORE_APP_NAME` |

## 4. Cadastrar as variáveis no GitHub

No repositório **mercadinho-ml**: **Settings → Secrets and variables → Actions → aba Variables →
New repository variable**. Crie as 4 variáveis da tabela acima (são dados públicos, não precisam ser secrets).

## 5. Gerar o pacote

Crie uma nova versão (ex.: `git tag v1.1.1 && git push origin v1.1.1`) ou rode
**Actions → Gerar instaladores → Run workflow**. O job **Microsoft Store (pacote AppX)** gera
`Mercadinho-ML-<versão>-Microsoft-Store.appx`, que aparece na Release (ou nos artefatos do workflow).

> Esse arquivo é só para enviar à Loja: ele não instala direto no Windows (a Microsoft assina no envio).

## 6. Enviar para a Loja

No Partner Center, em **Envios → Iniciar envio**:

1. **Preços e disponibilidade:** gratuito (ou o preço desejado) e mercados (ex.: Brasil).
2. **Propriedades:** categoria **Negócios** (Business).
3. **Classificação etária:** responda o questionário.
4. **Pacotes:** envie o arquivo `.appx` gerado no passo 5.
5. **Listagem da Loja (Português do Brasil):** descrição, ao menos 1 captura de tela do app e
   **URL da política de privacidade** (obrigatória: o app usa login com e-mail).
6. Envie para certificação. A análise costuma levar de algumas horas a 3 dias.

Nas próximas versões, repita os passos 5 e 6 (as variáveis do GitHub continuam valendo).
