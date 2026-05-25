# COPOM Mulher — app Android vítima (Expo)

Aplicação para a vítima instalar no telemóvel: mostra dados da ocorrência (após código de ativação), envia **localização** e botão de **pânico** para a **Central** no sistema web (`/app/central-vitima`).

## 1. URL da API no telemóvel

O telemóvel tem de alcançar o servidor Next.js (porta **3001** por defeito). Em casa, use o IP da máquina na LAN, por exemplo:

`http://192.168.1.50:3001`

Em produção use **HTTPS** com domínio válido.

Opcional: defina variável antes de compilar:

`EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3001`

## 2. Instalar dependências

```bash
cd mobile-vitima
npm install
```

**Arquitetura (padrão Expo + LAN, como em projetos do género sisBatalhaoRural):** `app.json` + **`app.config.js`**, **`metro.config.js`**, **`scripts/expo-start.cjs`**. O arranque define **`EXPO_PACKAGER_PROXY_URL=http://<IP-PC>:8095`** (usado em primeiro por `@expo/cli`, ver `UrlCreator.js`) + `REACT_NATIVE_PACKAGER_HOSTNAME` — o manifesto **já** não fica preso a `http://127.0.0.1:8095/`. Cópia de segurança: reescrita no `metro` (`resolve-lan-host.cjs`). **`.env.local`:** `COPOM_LAN_REWRITE` se o IP automático for errado. Entrada: `index.js` (evita `AppEntry` e `%5C` no Windows).

## Se o manifesto do Expo mostrar erro com `%5C` no URL (Windows)

O `metro.config.js` força **URLs com `/`** (rewriteRequestUrl + resposta do manifesto). Sempre que mudar, faça **Metro com cache limpo**: `npm run start:clean`.

No **telemóvel**, nunca abra `http://127.0.0.1:8095` (é o aparelho). O **`expo-start.cjs`** define o proxy; no telemóvel use `http://<IP-do-PC>:8095`. Cinto no Metro: `COPOM_DISABLE_MANIFEST_LAN_REWRITE=1` desliga a reescrita extra. **Tunnel** (`npm run start:tunnel`): comente/retire `EXPO_PACKAGER_PROXY_URL` e `COPOM_LAN_REWRITE` no `.env.local` se tiver, para o ngrok mandar. Institucional no browser (sem pânico/dados): `http://<IP-do-PC>:3001/mobile-vitima`.

## 3. Emulador Android (recomendado no Windows)

1. Instale [Android Studio](https://developer.android.com/studio), abra **Device Manager** e crie um **Virtual Device** (ex.: Pixel 6, API 34).
2. Inicie o emulador (botão Play no Device Manager).
3. Na **raiz** do repositório: `npm run parar:dev` (opcional, liberta 3001/8095) e depois **`npm run dev:tudo`** — sobe o **Next em 3001** e o **Metro Expo em 8095**. A rota `http://<IP-do-PC>:3001/mobile-vitima` no browser é **só informativa**; o teste operacional é o **APK/Expo Go**. Alternativa: **`iniciar-teste.ps1`** (duas janelas).
4. No terminal do **Expo**, prima **`a`** para abrir o app no emulador.
5. No app Android (emulador), a API por defeito é **`http://10.0.2.2:3001`** (liga ao PC onde corre o Next). O Next em dev deve ouvir em **`0.0.0.0:3001`** (já configurado em `sistema/scripts/next-dev.cjs`).

### Se `http://10.0.2.2:3001` não funcionar

- **Expo Go** no emulador por vezes bloqueia HTTP para certos hosts. Solução estável: com o emulador ligado, no PC execute:
  `adb reverse tcp:3001 tcp:3001`
  e no app use **`http://127.0.0.1:3001`** como URL da API.
- **APK / `expo run:android`**: o `app.json` tem `usesCleartextTraffic: true` para permitir `http://`. Depois de alterar, faça de novo o build nativo (`npx expo prebuild` + run ou novo APK).
- **Genymotion**: experimente **`http://10.0.3.2:3001`** em vez de `10.0.2.2`.

Se `adb` não for reconhecido, em Android Studio use **File → Settings → Appearance & Behavior → System Settings → Android SDK** e confirme que **Android SDK Platform-Tools** está instalado; adicione `...\Android\Sdk\platform-tools` ao PATH.

## 4. Testar no USB (telemóvel físico)

```bash
cd mobile-vitima
npm run start
```

Prima `a` com o telemóvel em modo de depuração USB. No campo URL da API use o **IP da máquina** na Wi‑Fi (ex.: `http://192.168.1.50:3001`), não `127.0.0.1`.

## 5. Gerar APK (build local)

1. `npx expo prebuild --platform android`
2. Abra `android/` no Android Studio e faça **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

Ou use [EAS Build](https://docs.expo.dev/build/setup/) (conta Expo) para APK/AAB na nuvem.

## 6. Fluxo operacional

1. No sistema web, abra a **ocorrência** e **gere o código de ativação** (painel roxo).
2. Instale o APK na vítima e abra o app.
3. Configure o **endereço do servidor** se não estiver correto e cole o **código**.
4. Toque em **Guardar e carregar dados**.
5. A **Central app vítima** no web mostra eventos de localização e pânico.

## Permissões

O app pede **localização em primeiro plano**. Para rastreio contínuo em segundo plano seria necessário mais permissões e políticas de loja — esta versão foca em envio manual e no momento do pânico.
