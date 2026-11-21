# Gera a chave de assinatura (keystore) do app Android e os valores para os secrets do GitHub.
# Uso (PowerShell):  powershell -ExecutionPolicy Bypass -File scripts\gerar-keystore-android.ps1
#
# IMPORTANTE: guarde a pasta gerada em local seguro (pendrive, nuvem pessoal).
# Se perder o keystore, NÃO será possível atualizar o app já instalado nos celulares / Google Play.

$ErrorActionPreference = 'Stop'
$destino = Join-Path $env:USERPROFILE 'mercadinho-ml-chave-android'
if (Test-Path (Join-Path $destino 'mercadinho-ml.jks')) {
  Write-Host "Já existe um keystore em $destino. Nada foi alterado." -ForegroundColor Yellow
  exit 1
}

$keytool = (Get-Command keytool -ErrorAction SilentlyContinue).Source
if (-not $keytool -and $env:JAVA_HOME) { $keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe' }
if (-not $keytool -or -not (Test-Path $keytool)) {
  $keytool = Get-ChildItem 'C:\Program Files\Java', 'C:\Program Files\Android' -Recurse -Filter keytool.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $keytool) { throw 'keytool não encontrado. Instale o Java ou o Android Studio.' }

New-Item -ItemType Directory -Force $destino | Out-Null
$jks = Join-Path $destino 'mercadinho-ml.jks'
$alias = 'mercadinho-ml'
$bytes = New-Object byte[] 24
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$senha = ([Convert]::ToBase64String($bytes) -replace '[+/=]', 'x')

& $keytool -genkeypair -v -keystore $jks -storetype PKCS12 -alias $alias -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass $senha -keypass $senha -dname "CN=Mercadinho ML, O=Mercadinho ML, C=BR"
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o keystore.' }

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($jks))
[IO.File]::WriteAllText((Join-Path $destino 'ANDROID_KEYSTORE_BASE64.txt'), $b64)
@"
Secrets para cadastrar no GitHub (Settings > Secrets and variables > Actions > New repository secret):

ANDROID_KEYSTORE_BASE64   = conteúdo do arquivo ANDROID_KEYSTORE_BASE64.txt
ANDROID_KEYSTORE_PASSWORD = $senha
ANDROID_KEY_ALIAS         = $alias
ANDROID_KEY_PASSWORD      = $senha

GUARDE ESTA PASTA EM LOCAL SEGURO E NÃO A ENVIE PARA O GIT.
"@ | Set-Content (Join-Path $destino 'LEIA-ME-secrets.txt') -Encoding UTF8

Write-Host "`nKeystore criado em: $destino" -ForegroundColor Green
Write-Host "Abra o arquivo LEIA-ME-secrets.txt dessa pasta e cadastre os 4 secrets no GitHub."
