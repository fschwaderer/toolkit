# Instalação e atualização

## Preparar o navegador

1. Instale o [Tampermonkey pelo site oficial](https://www.tampermonkey.net/), escolhendo a extensão do seu navegador.
2. No Chrome/Chromium, abra os detalhes da extensão em `chrome://extensions` e habilite **Permitir scripts de usuário**, se essa opção estiver disponível. Dependendo da versão, pode ser necessário habilitar o modo desenvolvedor. Consulte a [orientação oficial do Tampermonkey](https://www.tampermonkey.net/faq.php#Q209).
3. No Edge, verifique as opções equivalentes em `edge://extensions`.
4. Para usar páginas ou PDFs em `file://`, habilite **Permitir acesso a URLs de arquivo** nos detalhes da extensão. Isso não é necessário para Gmail ou WhatsApp Web.

## Instalar pelo link

Abra [Fausto.Toolkit.user.js](https://raw.githubusercontent.com/fschwaderer/toolkit/main/dist/Fausto.Toolkit.user.js) com o Tampermonkey ativo. Confira o nome **Fausto´s Toolkit**, a versão e as permissões e clique em **Instalar**.

Recarregue a página. O botão **FT** aparece no canto inferior direito; no WhatsApp ele fica um pouco mais alto para não cobrir a barra de mensagens. Clique em FT e escolha os módulos na área **Módulos ativos**.

## Instalação manual

Se o navegador apenas exibir ou baixar o arquivo:

1. Abra o [arquivo instalável](https://raw.githubusercontent.com/fschwaderer/toolkit/main/dist/Fausto.Toolkit.user.js) e copie todo o conteúdo, incluindo o cabeçalho `// ==UserScript==`.
2. No Tampermonkey, abra o painel e escolha **Criar novo script**.
3. Substitua todo o código inicial pelo conteúdo copiado.
4. Salve e confirme que o script está habilitado.
5. Recarregue a página onde deseja utilizá-lo.

Use apenas um dos builds: o normal ou o minificado. Evite manter duas instalações do Toolkit ativas ao mesmo tempo.

## Atualizar

Abra novamente o [link do userscript](https://raw.githubusercontent.com/fschwaderer/toolkit/main/dist/Fausto.Toolkit.user.js) e confirme a atualização quando oferecida. Se necessário, substitua o conteúdo da instalação existente pelo novo arquivo e salve.

Atualize o script existente em vez de criar outra cópia. Recarregue Gmail, WhatsApp ou as demais páginas após a atualização. Não há uma promessa de atualização automática: use o link para instalar a versão publicada.

## Primeira utilização

- **WhatsApp:** abra uma conversa, expanda **WhatsApp → Envio de cotação**, confira o nome e preencha os dados. A mensagem e o arquivo sempre precisam de revisão e envio manual.
- **Gmail:** o módulo aparece apenas no Gmail. Confira os filtros e as ações antes de executar operações sobre mensagens.
- **Arquivos:** escolha uma pasta quando solicitado e conceda a permissão de acesso. O navegador pode pedir a permissão novamente em outra sessão.
- **Outros módulos:** marque PDF, Imagens ou Página em **Módulos ativos**.

## Solução de problemas

| Sintoma | Verificação |
| --- | --- |
| FT não aparece | Script e extensão habilitados, permissão de userscripts, acesso da extensão ao site, página recarregada e domínio não bloqueado |
| WhatsApp/Gmail não aparecem | Abra o domínio correto; esses módulos não aparecem nos demais sites |
| Painel ou botões duplicados | Verifique se existem duas instalações ativas |
| Copiar não funciona | Permita o clipboard quando solicitado; use o preview para copiar manualmente |
| Inserir informa que há rascunho | Revise e limpe o texto existente antes de inserir; o Toolkit não o apaga |
| Texto inserido, mas aviso de confirmação incompleta | Confira o texto no composer; o WhatsApp pode modificar sua representação. Não clique novamente sem verificar o rascunho |
| Nome não detectado | Preencha manualmente; telefones, grupos aparentes ou candidatos ambíguos são descartados |
| Anexo não abre o seletor | Use manualmente **+ → Documento**; diferenças de DOM e restrições do navegador podem bloquear a automação |
| Acesso a pastas indisponível | Confira suporte do navegador, contexto seguro e permissões de acesso |
| Página local não funciona | Confira a opção de acesso a URLs de arquivo da extensão |

As opções de instalação manual e de arquivos locais também são descritas na [FAQ oficial do Tampermonkey](https://www.tampermonkey.net/faq.php#Q102).
