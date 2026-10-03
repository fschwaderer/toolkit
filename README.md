# Fausto´s Toolkit

Userscript modular para navegador, com ferramentas para PDFs, imagens, páginas, arquivos, Gmail e WhatsApp Web. Instalado pelo Tampermonkey, adiciona o botão **FT** e um painel com módulos ativáveis.

**Versão do userscript: 1.8.4.16.**

## Instalação rápida

1. Instale o [Tampermonkey](https://www.tampermonkey.net/) no navegador.
2. Habilite a execução de userscripts nas opções da extensão, se solicitado.
3. Abra o [userscript para instalar](https://raw.githubusercontent.com/fschwaderer/toolkit/main/dist/Fausto.Toolkit.user.js) e confirme a instalação no Tampermonkey.
4. Recarregue a página e clique em **FT**.
5. Em **Módulos ativos**, marque as ferramentas que deseja utilizar.

Se o link abrir como texto ou download, use a instalação manual descrita em [INSTALACAO.md](INSTALACAO.md). Não é necessário instalar Node.js para usar o Toolkit.

## Ferramentas

| Módulo | Recursos | Disponibilidade |
| --- | --- | --- |
| PDF | Proposta/impressão, salvar e nomear propostas, juntar PDFs | Páginas compatíveis com os recursos |
| Imagens | Imagens da página, conversão, redimensionamento e junção | Páginas em geral |
| Página | Capturas, seleção, extração, tabelas, links, alterações e Storage/Dev | Páginas em geral, com suporte a frames |
| Arquivos | Organizar uma pasta e trabalhar com pastas monitoradas | Navegadores com File System Access e permissão do usuário |
| Gmail | Filtros, pesquisas e ações sobre mensagens | Somente `mail.google.com` |
| WhatsApp | Gerar cotação, copiar/inserir mensagem e abrir o seletor de documentos | Somente `https://web.whatsapp.com/` |

Gmail e WhatsApp vêm ativos por padrão em seus respectivos sites. Os demais módulos podem ser habilitados no painel. Algumas funções executam ações sobre arquivos ou mensagens; confira o conteúdo e a ação escolhida antes de utilizá-las.

## WhatsApp: envio de cotação

1. Abra uma conversa e expanda **WhatsApp → Envio de cotação** no Toolkit.
2. Confira o nome detectado ou preencha o nome manualmente. **Detectar conversa** permite repetir a tentativa; a mensagem usa apenas o primeiro nome.
3. Escolha o ramo e preencha o modelo/item, tipo de imóvel e vencimento no formato `DD/MM/AAAA`.
4. Para AUTO, escolha **do** ou **da** em **Usar antes do veículo**.
5. Confira o preview e use **Copiar mensagem** ou **Inserir no WhatsApp**.
6. Use **Anexar arquivo** para abrir o seletor de documentos e escolha manualmente o PDF.
7. Revise a mensagem e o anexo no WhatsApp e envie manualmente.

Exemplo de mensagem:

```text
Olá, *Michael*! Tudo bem?

O seguro do *Up* vence em *02/10/2026*.

Segue melhores opções para este ano.

Qualquer dúvida, estou a disposição!
```

Os asteriscos são literais e correspondem ao negrito do WhatsApp. Para residência, a frase usa **da sua casa** ou **do seu apartamento**, com o item destacado por asteriscos.

O módulo não envia mensagens nem arquivos automaticamente. A inserção não substitui rascunhos existentes. O nome, o modelo e a vigência não são persistidos após recarregar a página; as preferências e estados dos accordions são persistidos.

A detecção de nome, a inserção e a abertura de anexos dependem do DOM e das permissões do WhatsApp/navegador. Se o texto for inserido corretamente mas aparecer o aviso de confirmação incompleta, confira o rascunho antes de tentar novamente. Como alternativa, copie a mensagem e cole manualmente. Em caso de falha no botão de anexo, use **+ → Documento** no próprio WhatsApp.

## Desenvolvimento

Com Node.js 18 ou superior e npm:

```bash
git clone https://github.com/fschwaderer/toolkit.git
cd toolkit
npm ci
npm run build
```

| Comando | Resultado |
| --- | --- |
| `npm run build` | Gera `dist/Fausto.Toolkit.user.js` |
| `npm run build:min` | Gera a versão compactada em `dist/Fausto.Toolkit.min.user.js` |
| `npm run format` | Formata `src/**/*.js` e `build.js` |

Faça mudanças de lógica em `src/`, e regenere os artefatos. O build usa apenas o cabeçalho de metadata de `all.js`; o corpo desse arquivo é uma referência histórica e não é o código executado pelo bundle atual.

- [Instalação e atualização](INSTALACAO.md)
- [Arquitetura](docs/ARQUITETURA.md)
- [Manutenção, builds e validação](docs/DESENVOLVIMENTO.md)
- [Histórico da modularização](MODULARIZACAO.md)

## Permissões e armazenamento

O userscript corresponde a páginas HTTP, HTTPS e `file://`, exceto os hosts explicitamente bloqueados na configuração/metadata. O painel é criado apenas no frame principal; frames continuam participando dos recursos internos.

O Tampermonkey guarda preferências do painel e módulos. IndexedDB guarda configurações e referências de pastas quando aplicável. Recursos de arquivos dependem das permissões concedidas pelo usuário. Bibliotecas PDFLib e html2canvas são carregadas pelas entradas `@require` do cabeçalho. A lista completa de permissões está no início do userscript instalável.

O repositório contém o código e os builds; não inclui `node_modules` nem os dados locais guardados pelo navegador.
