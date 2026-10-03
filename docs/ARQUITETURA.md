# Arquitetura do Toolkit

## Estrutura

```text
src/
  main.js                   Entrada e bloqueio de hosts
  tampermonkey-globals.js    Declarações para o editor/lint do userscript
  core/
    app.js                  Inicialização e conexão dos módulos
    config.js               APP, versão, módulos, ramos e seguradoras
    ui.js                   Painel, CSS, Shadow DOM e proteção de SPA
    storage.js              Preferências GM e configurações IndexedDB
    dom.js                  Elementos e accordions persistentes
    utils.js                Datas, nomes, downloads e helpers
    filesystem.js           Acesso e permissões de pastas/arquivos
  modules/
    pdf.js
    imagens.js
    pagina.js
    arquivos.js
    gmail.js
    whatsapp.js
build.js                    Empacotamento e validação dos artefatos
all.js                      Referência histórica e fonte da metadata
dist/                       Userscripts instaláveis gerados pelo build
```

## Inicialização

`main.js` verifica os hosts bloqueados e chama `iniciarToolkit()` em `core/app.js`. O app carrega preferências, inicializa o estado dos frames e passa construtores e referências para `conectarModulos()` em `core/ui.js`.

O painel renderiza os módulos ativos e inclui cada `details.modulo-principal` no accordion principal. Os submódulos usam `details.submodulo`. `configurarAccordionPersistente()` restaura e salva o item aberto usando `GM_getValue` e `GM_setValue`.

O conteúdo do painel fica em Shadow DOM. A infraestrutura existente acompanha navegação SPA e reanexa o host quando necessário. O painel só é criado em `window.top`; os frames mantêm as rotinas internas de Página. Não adicionar `@noframes`.

## Módulos exclusivos de sites

Gmail e WhatsApp têm flags em `MODULOS` e filtros tanto na configuração de módulos ativos quanto na renderização. WhatsApp exige hostname `web.whatsapp.com` e protocolo HTTPS; Gmail exige `mail.google.com`.

Novos módulos devem usar esse mecanismo, com construtor conectado por `app.js`, tratamento de erros em `ui.js` e participação no accordion principal. Não criar um painel paralelo ou observer global separado para cada módulo.

## WhatsApp

O módulo separa geração/validação da mensagem, detecção do nome, clipboard, inserção no editor e abertura de anexos. A detecção ocorre na criação/abertura e pelo botão explícito; edição manual tem prioridade sobre preenchimentos automáticos.

O composer é procurado no footer, por atributos semânticos e visibilidade. A inserção atual delega a mensagem inteira ao handler de colagem do WhatsApp com `text/plain`, sem segunda tentativa. Rascunhos existentes impedem a inserção. O Toolkit não aciona o envio.

O botão de anexo prioriza um input de documentos identificado dentro da conversa; quando ele não é encontrado, usa o botão de anexo e a opção Documento/Arquivo. A busca do menu tem espera limitada à ação. Nenhum arquivo é atribuído por código ao input.

Os seletores dependem do DOM real do WhatsApp e precisam de manutenção quando esse DOM mudar. Os testes de DOM não garantem a abertura do seletor nativo nem a compatibilidade com todas as versões do editor.

## Builds e versão

`build.js` empacota `src/main.js` com esbuild em formato IIFE. O cabeçalho é extraído de `all.js`, os comentários de globais são acrescentados e o resultado é validado como script clássico antes da escrita em `dist/`.

O corpo legado de `all.js` pode ter uma versão interna antiga: ele não integra o bundle. A versão executável vem de `APP.versao` em `src/core/config.js`; a versão para o Tampermonkey vem da linha `@version` no cabeçalho de `all.js`.

`MODULARIZACAO.md` registra verificações históricas da extração inicial. Contagens, hashes e declarações de preservação nele se referem às respectivas etapas, não ao estado atual após a evolução dos módulos.
