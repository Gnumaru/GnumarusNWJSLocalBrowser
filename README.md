# NW.js Local Browser

Aplicativo desktop (Windows, Linux e macOS) que funciona ao mesmo tempo como:

- um **servidor web local** que publica um diretório do seu computador em `http://127.0.0.1:1024`;
- um **navegador** para as páginas HTML contidas nesse diretório, carregadas dentro da própria janela do app.

Ideal para desenvolvimento web: você abre uma página sua como se fosse um site real
(`http://localhost:1024/...`), com a **API do Node.js disponível dentro da página** —
coisa que um Chrome comum não oferece.

---

## Sumário

- [O que o aplicativo faz](#o-que-o-aplicativo-faz)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Compilando o código (build)](#compilando-o-código-build)
- [Gerando o executável (NW.js / nw-builder)](#gerando-o-executável-nwjs--nw-builder)
- [Usando o executável](#usando-o-executável)
  - [Servindo um diretório](#servindo-um-diretório)
  - [Abrindo uma página HTML diretamente](#abrindo-uma-página-html-diretamente)
  - [Sem argumentos: escolha na interface](#sem-argumentos-escolha-na-interface)
- [A interface](#a-interface)
- [A barra de ferramentas injetada](#a-barra-de-ferramentas-injetada)
- [Segurança](#segurança)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Scripts disponíveis](#scripts-disponíveis)
- [Exemplo showcase: gerenciador de arquivos](#exemplo-showcase-gerenciador-de-arquivos)
- [Problemas comuns](#problemas-comuns)

---

## O que o aplicativo faz

1. Você informa um **diretório** (ou um **arquivo HTML**) por linha de comando, ou escolhe
   um diretório por um diálogo nativo do sistema operacional.
2. O app sobe um servidor HTTP **apenas local**, vinculado a `127.0.0.1` na **porta 1024**,
   publicando o conteúdo daquele diretório.
3. A janela do app passa a navegar pelas páginas servidas, com uma barra de ferramentas
   injetada em toda página (voltar, avançar, barra de endereço, recarregar).
4. Se um diretório não tiver `index.html`, o servidor gera uma **listagem de arquivos**
   navegável.
5. As páginas servidas rodam com **Node.js habilitado** (`require`, `nw`, `process`,
   `fs`, `os`, ...), graças ao `node-remote` configurado no `package.json`.

---

## Requisitos

- **Node.js 18+** (desenvolvido e testado com Node 24).
- **npm 10+**.
- Para gerar pacotes: acesso à internet na primeira execução (o `nw-builder` baixa o
  runtime do NW.js ~100 MB por plataforma).

---

## Instalação

```bash
npm install
```

> O `npm install` baixa o runtime do NW.js 0.118.0 (dependência `nw`, fixada em
> `0.118.0` exato). O `postinstall` dessa dependência exige permissão — em ambientes com
> `allowScripts`/`ignore-scripts` restritivos, aprove o pacote antes:
>
> ```bash
> npm install-scripts approve nw
> ```

---

## Compilando o código (build)

O código-fonte é **TypeScript** (`src/*.ts` e `showcase/filemanager/src/*.ts`) e é
compilado para JavaScript na pasta `dist/`:

```bash
npm run build
```

Isso executa:

| Comando                    | O que faz                                                        |
| -------------------------- | ---------------------------------------------------------------- |
| `tsc`                      | compila `src/*.ts` → `dist/*.js` (app principal)                  |
| `tsc -p showcase/filemanager/tsconfig.json` | compila o showcase → `showcase/filemanager/dist/*.js` |

Sub-comandos opcionais:

```bash
npm run build:app        # só o app principal
npm run build:showcase   # só o showcase (file manager)
```

> O `dist/` está no `.gitignore` e **não** é versionado. Por isso o `build` é executado
> automaticamente antes de `npm start` e antes de gerar os executáveis.

---

## Gerando o executável (NW.js / nw-builder)

O empacotamento usa o [`nw-builder`](https://github.com/nwutils/nw-builder) (versão
`4.24.0`), com o runtime do NW.js fixado em **0.118.0** (flavor `normal`, sem devtools).

### Linux

```bash
npm run dist:linux
```

### Linux + Windows + macOS

```bash
npm run dist
```

O resultado fica em `./release/`:

```
release/
├── nwjs-local-browser          # executável Linux x64
├── nwjs-local-browser.desktop  # atalho de menu (Linux)
├── package.nw/                 # os arquivos do app (HTML, JS compilado, assets)
├── lib/  locales/  *.pak  ...  # runtime do Chromium/NW.js
```

### Comandos equivalents (avançado)

```bash
npm run build && nwbuild --mode=build --version=0.118.0 --flavor=normal \
  --platform=linux,win,osx --arch=x64 --outDir=./release \
  "./package.json ./index.html ./dist/** ./assets/** ./showcase/**"
```

- `--version=0.118.0` — versão do runtime (fixada para builds reproduzíveis).
- `--flavor=normal` — build de produção, sem ferramentas de desenvolvimento.
- A lista final de caminhos define o que entra no pacote: apenas `package.json`,
  `index.html`, `dist/`, `assets/` e `showcase/`. Nada de `node_modules`, `tmp/` ou
  tarballs.

### Onde hospedar / distribuir

O app é **desktop**, não um site: a "distribuição na web" consiste em hospedar os
arquivos de `./release/` (um diretório por plataforma) para download.

- **Linux**: distribua a pasta `release/` inteira (ou um `.tar.gz`/AppImage, se
  empacotar por conta própria).
- **Windows**: a pasta gerada contém `nwjs-local-browser.exe`.
- **macOS**: a pasta gerada contém `nwjs-local-browser.app`.

> ⚠️ Binários não assinados disparam aviso de segurança (SmartScreen no Windows,
> Gatekeeper no macOS). Para distribuição ampla é preciso assinar com certificado
> (Microsoft Authenticode / Apple Developer ID + notarização).

---

## Usando o executável

O executável aceita **um** argumento: um caminho para um diretório **ou** para um
arquivo HTML. Caminhos com espaços devem estar entre aspas.

### Servindo um diretório

```bash
# Linux
./release/nwjs-local-browser /home/usuario/meu-site

# Windows
release\nwjs-local-browser.exe "C:\Users\meu\meu-site"

# macOS
./release/nwjs-local-browser.app/Contents/MacOS/nwjs-local-browser /Users/meu/meu-site
```

O app serve `/home/usuario/meu-site` e abre
`http://127.0.0.1:1024/` no navegador embutido. Se o diretório tiver `index.html`,
essa página é aberta; caso contrário, aparece a listagem de arquivos.

### Abrindo uma página HTML diretamente

```bash
# caminho absoluto
./release/nwjs-local-browser /home/usuario/meu-site/index.html

# caminho relativo (a partir do diretório atual)
./release/nwjs-local-browser showcase/filemanager/index.html
```

Nesse caso o app:

1. **serve o diretório que contém o arquivo** (o *dirname*);
2. **abre a página imediatamente** em `http://127.0.0.1:1024/index.html`.

Ou seja, o diretório continua navegável pela listagem e pela barra de endereço, mas o
primeiro carregamento já é o arquivo indicado.

> A mesma lógica vale para o campo de texto do app: digitar o caminho de um `.html`
> inicia o servidor no diretório dele e abre o arquivo.

### Sem argumentos: escolha na interface

Iniciando sem argumento, o app exibe a tela de seleção, com duas opções:

- **Choose Directory** — abre o diálogo nativo do sistema (zenity/kdialog no Linux,
  AppleScript no macOS, `FolderBrowserDialog` no Windows);
- campo de texto + **Start** — digite o caminho de um diretório ou de um arquivo HTML.

### Verificar se o servidor está no ar

```bash
curl -I http://127.0.0.1:1024/
```

---

## A interface

A janela principal (`index.html`) é apenas um *shell*: ela coleta o diretório de
serviço, sobe o servidor e navega para `http://127.0.0.1:1024/`. Depois disso, quem
aparece é a página servida — o app funciona como um browser, com a URL real na barra
de endereço.

---

## A barra de ferramentas injetada

O servidor injeta `dist/toolbar.js` em **toda** resposta HTML, criando a barra no topo:

| Elemento              | Função                                                     |
| --------------------- | ---------------------------------------------------------- |
| `Choose Directory`    | troca o diretório servido, sem reiniciar o app              |
| `←` / `→`             | voltar / avançar (histórico nativo)                         |
| barra de endereço     | mostra a URL atual; aceita `Enter` para navegar            |
| `Go`                  | navega para o endereço digitado                             |
| `Reload`              | recarrega a página                                         |

Regras:

- só endereços locais são aceitos (`127.0.0.1:1024`, `localhost:1024`, `::1:1024`);
  a porta `:1024` é adicionada automaticamente se faltar;
- os IDs do toolbar usam o prefixo `lb-` para não colidir com IDs de páginas servidas
  (a página servida pode ter o seu próprio `#toolbar`, `#btnGo`, etc.).

---

## Segurança

- O servidor escuta **apenas** `127.0.0.1` — não é acessível pela rede.
- Toda requisição é verificada: o endereço de origem precisa ser loopback e o header
  `Host` precisa ser `localhost`/`127.0.0.1`/`::1`; caso contrário, resposta **403**.
- A resolução de arquivos passa por `safeJoin()`, que bloqueia *path traversal*
  (`../../etc/passwd`).
- Páginas servidas **têm acesso ao Node.js** — trate qualquer conteúdo servido por este
  app como código confiável (equivalente a executar um script local).

---

## Estrutura do projeto

```
.
├── index.html                  # shell do app (seleção de diretório)
├── package.json                # manifest + scripts de build/dist
├── tsconfig.json               # TypeScript strict (app principal)
├── assets/styles.css           # estilos do shell
├── src/
│   ├── shell.ts                # boot: lê argv, resolve alvo, sobe o servidor
│   ├── server.ts               # servidor HTTP local (loopback, porta 1024)
│   ├── toolbar.ts              # barra de ferramentas injetada nas páginas
│   ├── dialog.ts               # diálogos nativos de seleção de diretório
│   ├── server.test.ts          # teste do servidor (HTTP real)
│   └── types.d.ts              # tipos do global `nw`
├── showcase/filemanager/       # exemplo: gerenciador de arquivos (HTML/CSS/TS puro)
└── dist/                       # saída do build (gitignored)
```

---

## Scripts disponíveis

| Script                  | Descrição                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| `npm start -- <caminho>` | compila e abre o app com o caminho informado                    |
| `npm run build`         | compila app + showcase                                            |
| `npm run build:app`     | compila apenas o app                                              |
| `npm run build:showcase`| compila apenas o showcase                                         |
| `npm run dist:linux`    | gera o executável Linux x64 em `./release/`                       |
| `npm run dist`          | gera os executáveis Linux, Windows e macOS em `./release/`        |
| `npm run test:server`   | teste do servidor HTTP (listagem, arquivo, traversal, host block) |

> No `npm start`, tudo depois de `--` é repassado ao app:
> `npm start -- /caminho/da/pasta` ou `npm start -- /caminho/da/pagina.html`.

---

## Exemplo showcase: gerenciador de arquivos

`showcase/filemanager/` é um gerenciador de arquivos completo (HTML + CSS + TypeScript,
sem dependências externas) que usa a API do Node exposta dentro da página servida:
listagem de diretórios, criação de pastas/arquivos, metadados (tamanho, permissões,
datas), pré-visualização de texto e exclusão de itens.

```bash
npm start -- showcase/filemanager
```

Ele começa em `?dir=` → `window.__SERVED_DIR__` (o diretório servido) → home do
usuário.

---

## Problemas comuns

**A janela fica na tela de seleção e nada acontece ao clicar em Start.**
Verifique se o build está atualizado (`npm run build`) e se `dist/shell.js` existe.
`dist/shell.js` é carregado por `<script>` comum: ele **não** pode usar `export` de
TypeScript (o módulo CommonJS gerado quebraria o shell inteiro).

**`Cannot find module 'nw'` ou o app não abre após `npm install`.**
O postinstall da dependência `nw` (que baixa o runtime) pode ter sido bloqueado.
Rode `npm install-scripts approve nw` e `npm rebuild nw`.

**Porta 1024 já em uso.**
O app sempre usa a porta fixa 1024. Feche o processo que estiver ocupando-a
(`lsof -i :1024` no Linux) ou encerre uma instância anterior do app.

**A página servida aparece sem a barra de ferramentas.**
A barra é injetada apenas em respostas HTML servidas pelo app. Páginas geradas
dinamicamente ou recursos carregados via `file://` não a recebem.

**Aviso de segurança ao abrir o executável no Windows/macOS.**
Binário não assinado. Clique em "Executar mesmo assim" (Windows) ou
`xattr -d com.apple.quarantine <app>` (macOS).
