# Gerando os instaladores pelo GitHub

O workflow [`.github/workflows/build.yml`](../.github/workflows/build.yml) gera, nos servidores do GitHub:

| Plataforma | Arquivo | Funciona sem configurar nada? |
|---|---|---|
| Windows | `Mercadinho-ML-Setup-X.exe` (instalador) e `Mercadinho-ML-Portatil-X.exe` | ✅ Sim |
| Mac | `Mercadinho-ML-X-mac-arm64.dmg` / `-mac-x64.dmg` | ✅ Sim |
| Android | `Mercadinho-ML-X-teste.apk` | ✅ Sim, mas veja o aviso abaixo |
| Android assinado | `Mercadinho-ML-X.apk` + `.aab` (Google Play) | Precisa do keystore (passo 2) |
| iPhone/iPad | `Mercadinho-ML-X.ipa` | Precisa de conta Apple Developer (passo 3) |

## 1. Rodar o workflow

**Opção A: manual.** No GitHub, abra **Actions → Gerar instaladores → Run workflow** e informe a versão.
Ao terminar, os arquivos ficam no fim da página da execução, em **Artifacts**.

**Opção B: com Release (recomendado).** No computador:
```bash
git tag v1.0.1
git push origin v1.0.1
```
Os instaladores ficam anexados em **Releases** no GitHub, com um link fixo para baixar e compartilhar.

## 2. Android: assinar o app (fortemente recomendado)

Sem o keystore, o GitHub gera um APK de **teste**, que é assinado com uma chave diferente a cada execução.
Por isso, para instalar uma versão nova será preciso **desinstalar a anterior, e os dados do celular serão apagados**
(faça backup antes). Com o keystore, as atualizações instalam por cima e mantêm os dados.

1. No Windows, rode: `powershell -ExecutionPolicy Bypass -File scripts\gerar-keystore-android.ps1`
2. Abra a pasta `%USERPROFILE%\mercadinho-ml-chave-android` e o arquivo `LEIA-ME-secrets.txt`.
3. No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e cadastre os 4 secrets:
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
4. **Guarde essa pasta em local seguro.** Sem ela não será possível atualizar o app na Google Play.

**Instalar o APK no celular:** envie o arquivo `.apk` para o celular (WhatsApp, Drive, cabo), toque nele e permita
"instalar apps de fontes desconhecidas".

## 3. iOS: certificado da Apple

A Apple **não permite** instalar apps em iPhone sem assinatura. É necessária uma conta
[Apple Developer](https://developer.apple.com/programs/) (US$ 99/ano). Sem ela, o workflow só confirma que o app
compila e gera um `.ipa` **não assinado**, que não instala direto no aparelho.

Com a conta:
1. Em *Certificates, IDs & Profiles*, registre o App ID `br.com.mercadinhoml.app`.
2. Crie um certificado **Apple Distribution** e exporte-o do Acesso às Chaves (Keychain) como `.p12`, com senha.
3. Crie um **Provisioning Profile** para o App ID:
   - **Ad Hoc**: instala nos iPhones cadastrados (até 100 aparelhos, pelo UDID), ou
   - **App Store**: para TestFlight / App Store.
4. Converta os arquivos para base64 (no Mac: `base64 -i arquivo | pbcopy`; no Windows: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("arquivo"))`).
5. Cadastre os secrets no GitHub:
   - `IOS_CERTIFICATE_BASE64`: o `.p12` em base64
   - `IOS_CERTIFICATE_PASSWORD`: a senha do `.p12`
   - `IOS_PROVISION_PROFILE_BASE64`: o `.mobileprovision` em base64
6. (Opcional) Em **Settings → Secrets and variables → Actions → Variables**, crie `IOS_EXPORT_METHOD` com
   `ad-hoc` (padrão) ou `app-store`.

O `.ipa` Ad Hoc pode ser instalado pelo Apple Configurator, pelo Finder (arrastando para o iPhone conectado) ou por serviços
como Diawi. O de App Store é enviado pelo app Transporter para o TestFlight.

## 4. Instalar o desktop em outro computador

- **Windows**: copie `Mercadinho-ML-Setup-X.exe` para o outro computador e execute.
  O Windows pode mostrar "O Windows protegeu o computador" (o app não tem certificado de assinatura de código):
  clique em **Mais informações → Executar assim mesmo**. A versão `Portatil` roda sem instalar (bom para pendrive).
- **Mac**: abra o `.dmg` e arraste o app para Aplicativos. Na primeira vez, clique com o botão direito no app → **Abrir**.
  Use `arm64` para Macs M1/M2/M3/M4 e `x64` para Macs Intel.

**Os dados não vão junto com o instalador.** Para levar produtos e vendas: no computador antigo use
**Configurações → Fazer backup**; no novo, **Configurações → Restaurar backup**.

## Custos do GitHub Actions
Em repositório **público**, o uso é gratuito. Em repositório **privado**, o plano gratuito inclui 2.000 minutos/mês,
e minutos em Mac contam 10x. Um build completo leva cerca de 15–25 minutos, dos quais cerca de 10 em Mac.
