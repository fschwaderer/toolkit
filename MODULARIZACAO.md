# Mapa do all.js (antes da extração)

O arquivo original tem 7.109 linhas e permanece como referência, inclusive para o metadata do build.

| Linhas originais | Responsabilidade | Destino |
| --- | --- | --- |
| 1–29 | Metadata Tampermonkey | Copiado literalmente pelo build |
| 35–117 | Bloqueios, APP, CONFIG, módulos, seguradoras e ramos | core/config.js |
| 120–242 | Preferências GM, chaves e IndexedDB | core/storage.js |
| 245–260 | Cache de PDF | modules/pdf.js |
| 263–272, 365–451 | Log, datas, comissão e nomes | core/utils.js |
| 275–340, 2062–2074 | Elementos e accordion persistente | core/dom.js |
| 343–362, 606–626, 671–1059 | Detecção, leitura, download, edição e junção de PDFs | modules/pdf.js |
| 454–603, 633–669, 1062–1115 | File System Access, permissões, pastas, busca e gravação | core/filesystem.js |
| 1118–2140 | Estado do painel, CSS, status e configuração de módulos | core/ui.js (helpers de elementos em dom.js) |
| 2143–2736 | Interface e submódulos PDF | modules/pdf.js |
| 2739–3721 | Imagens, conversão e junção | modules/imagens.js (download e canvas compartilhados em utils.js) |
| 3724–4284, 6416–6961 | Página, estado por documento, seleção e protocolo entre frames | modules/pagina.js |
| 4287–5042 | Organização de arquivos e pastas monitoradas | modules/arquivos.js |
| 5045–6139 | Gmail: regras, pesquisa, leitura, arquivamento e interface | modules/gmail.js |
| 6142–6414, 6964–7099 | Placeholder, render, launcher, painel, SPA e inicialização com delay | core/ui.js |
| 7101–7108 | Conexão de frames e agendamento inicial | core/app.js |

## Dependências e preservação

O painel chama os construtores dos módulos; PDF e Página também usam status, Shadow DOM e renderização do painel. Para evitar um ciclo de imports, app.js conecta esses construtores e as referências de estado existentes a ui.js antes de iniciar. São referências ao mesmo estado, sem cópias e sem novas propriedades globais.

A leitura das preferências e a criação do identificador de frame são iniciadas explicitamente, nessa ordem, depois da verificação de hosts bloqueados em main.js. As funções existentes são extraídas sem mudar seus corpos. Helpers de download e canvas ficam no core porque também são usados por Página.

O gate de Gmail permanece em criarConfiguracaoModulos e renderizarConteudo: hostname exatamente mail.google.com. Permanecem o shadow DOM, as chaves GM/IndexedDB, o protocolo entre frames, os listeners e delays de SPA e os acessos a unsafeWindow.

## Uso

- `npm run build`: dist/Fausto.Toolkit.user.js, bundle esbuild sem minificação.
- `npm run build:min`: dist/Fausto.Toolkit.min.user.js, bundle esbuild seguido de terser.
- `npm run format`: formata apenas src e build.js.

`dist/Fausto.Toolkit.user.js` é a versão recomendada para desenvolvimento, testes e uso diário no Tampermonkey. Seu código legível é a referência para revisão e debug no editor.

`dist/Fausto.Toolkit.min.user.js` é a versão compactada opcional para distribuição/produção. Não é recomendada para debug no editor do Tampermonkey; avisos específicos do código minificado não são alvo desta etapa. esbuild e Terser permanecem no projeto, com os mesmos comandos de build.

O build lê apenas o cabeçalho de all.js, mantém seu conteúdo literal no topo e valida a sintaxe do artefato como script clássico. Alterações futuras na lógica devem ser feitas em src.

## Globais e lint no Tampermonkey

As declarações `/* global ... */` estão centralizadas em `src/tampermonkey-globals.js`, um arquivo apenas de comentários lido por build.js. O build insere esse cabeçalho uma única vez em cada artefato, imediatamente após o metadata e antes do código executável. A inserção ocorre depois do esbuild/Terser, para que os comentários não sejam descartados. Nenhuma lógica ou fluxo de módulo foi alterado, e all.js permanece intacto.

O cabeçalho declara GM_xmlhttpRequest, GM_getValue, GM_setValue, GM_deleteValue, GM_addValueChangeListener, GM_removeValueChangeListener, unsafeWindow, PDFLib e html2canvas. Também declara globalThis, preservando seus acessos existentes: um aviso de identificador indefinido pode decorrer da configuração de linguagem/ambiente do lint, sem indicar problema funcional no navegador. O ESLint reconhece os globais padrão conforme a configuração da versão ECMAScript; veja a [documentação oficial de opções de linguagem e globais](https://eslint.org/docs/latest/use/configure/language-options).

Comentários de globais têm escopo de arquivo: este cabeçalho atende ao userscript único aberto no Tampermonkey e não configura automaticamente o lint independente de cada módulo em src. Não foi adicionado `/* eslint-disable */`, nem foram ajustados warnings específicos do artefato minificado.

Após a inclusão do cabeçalho, os dois builds foram regenerados e validados: sintaxe, metadata literal no topo e @require intactos. A comparação dos ASTs dos artefatos antes e depois confirmou que somente comentários foram adicionados, sem mudança no código executável. A validação do editor real do Tampermonkey não foi executada; outras regras específicas do editor podem continuar produzindo avisos.

## Validação realizada

- 166 funções comparadas por AST: corpos, parâmetros e nomes idênticos ao original.
- 39 inicializadores comparados por AST; preferências e estado dos frames apenas deslocados para a inicialização explícita.
- Grafo dos 13 arquivos de src sem dependências circulares.
- Ambos os builds com sintaxe de script clássico válida e metadata literal idêntico.
- Inicialização comparada com all.js em ambiente simulado: página comum, Gmail, iframe e host bloqueado, para os dois builds.
- SHA-256 de all.js preservado: `668D4CC2383B31079A16008163CE104037D79F15A558AC55FF15C16DF68D7A8A`.
- package.json já continha exatamente os três scripts solicitados e as dependências necessárias; foi mantido.

Essas verificações sustentam a equivalência da extração, mas não substituem execução manual no Tampermonkey com páginas reais, permissões de pastas e as bibliotecas fornecidas por @require. Essa execução em navegador não foi realizada nesta etapa.

## Revisão posterior da modularização

- Removidos somente dois imports não usados de `erro`: em modules/arquivos.js e modules/pagina.js. A identificação usou análise de escopo, distinguindo parâmetros de catch e propriedades de objetos das referências ao import.
- Não restaram imports não usados ou exports sem consumidores.
- Nenhuma duplicação das 166 funções originais; funções e 39 inicializadores permanecem estruturalmente iguais aos de all.js, com os dois deslocamentos de inicialização documentados acima.
- Nenhum ciclo no grafo de imports. O estado de Página e dos frames é conectado ao painel por referência, depois da inicialização; rootHost e shadow usam imports com vínculo vivo. Não foi encontrado estado copiado ou compartilhado incorretamente.
- Ambos os builds regenerados e validados com sintaxe e metadata intactos.
- 18 comparações de execução simulada com o original aprovadas (nove cenários por build): inicialização comum, Gmail, iframe, host bloqueado, WhatsApp com documento pronto e alternância do painel, file:// com painel restaurado, Gmail com restauração e alternância, domínio parecido com Gmail e ausência temporária de body. Também foram comparados o DOM do Toolkit e os eventos registrados. O DOM simulado rejeita innerHTML para verificar esse aspecto da proteção Trusted Types.
- O hash do original continua preservado. Não foram encontradas diferenças funcionais introduzidas pela extração dentro das verificações realizadas.
- A referência a `gmailElementoClicavel` sem definição já existe em all.js em dois helpers sem chamadas no próprio script. Foi mantida, pois corrigir esse ponto alteraria a lógica original e ultrapassaria a revisão da separação.

A revisão não incluiu execução em navegador real nem todos os fluxos das ferramentas; permanecem os limites de validação indicados acima.

## Remoção autorizada de código morto legado

Após a inspeção, foi autorizada a remoção exclusiva de `gmailEncontrarAcaoPorIcone` e `gmailCliqueReal` de modules/gmail.js. Nenhum dos dois possuía chamadas, exportação ou registro como callback; ambos referenciavam `gmailElementoClicavel`, sem definição também no original. Todo o código exclusivo desses helpers estava dentro de seus próprios corpos.

- Removidos apenas os dois helpers e seus corpos; nenhuma outra função foi removida ou modificada.
- O AST restante do módulo foi comparado antes e depois da remoção e permaneceu idêntico, incluindo `gmailCliquePagina` e `gmailDispararMousePagina`. Os fluxos ativos do Gmail foram preservados.
- Builds normal e minificado regenerados; sintaxe e metadata novamente validados. As três referências nominais desses helpers e da função indefinida não existem mais em src nem nos artefatos gerados.
- all.js permanece intacto, com o SHA-256 registrado acima, e conserva os helpers como referência histórica.

As contagens anteriores de 166 funções descrevem as validações antes desta remoção; agora permanecem 164 funções originais em src. Esta etapa não incluiu execução em navegador real.
