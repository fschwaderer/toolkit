# Desenvolvimento e manutenção

## Preparar o projeto

Use Node.js 18 ou superior, npm e Git. Os usuários do userscript não precisam dessas ferramentas.

```bash
git clone https://github.com/fschwaderer/toolkit.git
cd toolkit
npm ci
npm run build
```

`npm ci` usa o lockfile versionado. Não versionar `node_modules`.

## Alterar código

1. Edite os arquivos-fonte em `src/`.
2. Reutilize os helpers e padrões dos módulos existentes.
3. Preserve Shadow DOM, preferências, accordions, SPA e suporte a frames.
4. Formate os arquivos alterados; `npm run format` formata todos os fontes e o build.
5. Gere e valide os dois artefatos antes de publicar uma atualização.
6. Instale o build normal no Tampermonkey e teste as funções afetadas no site real.

Não editar diretamente `dist/`. Para modificar a metadata, altere somente o cabeçalho necessário de `all.js`; para modificar a lógica, use `src/`.

## Versionamento

As correções atuais usam versões incrementais como `1.8.4.16`. Ao publicar uma alteração funcional, mantenha iguais:

- `APP.versao` em `src/core/config.js`;
- `@version` no cabeçalho de `all.js`;
- versão indicada no README e nos builds regenerados.

A versão `1.0.0` de `package.json` identifica o pacote de build e não é a versão do userscript. Não é usada para gerar a metadata. Atualizações exclusivamente documentais não precisam incrementar a versão do userscript.

Preserve os textos definidos pelo usuário. A mensagem de WhatsApp atualmente termina exatamente com **“Qualquer dúvida, estou a disposição!”**.

## Build e verificações

```bash
npm run build
npm run build:min
node --check dist/Fausto.Toolkit.user.js
node --check dist/Fausto.Toolkit.min.user.js
```

O próprio build valida sintaxe e presença da metadata intacta no topo. Confira também versão, imports/exports e ausência da diretiva `@noframes`. Um comentário mencionando `@noframes` não é uma diretiva.

Não há script de lint nem suíte de testes automatizados versionada nesta publicação. A validação de sintaxe não substitui testes de comportamento.

## Checklist manual de WhatsApp

- Módulo exclusivo do WhatsApp Web e ativação/desativação persistente.
- Primeiro nome na mensagem, mesmo quando o campo contém nome completo.
- Edição manual preservada; detecção falha sem apagar o campo.
- AUTO com do/da; casa e apartamento com concordância correta.
- Data inválida impede copiar/inserir.
- Preview e clipboard mantêm linhas vazias e asteriscos.
- Inserção aparece uma vez, com os parágrafos preservados; rascunho existente não é substituído.
- Anexar abre o seletor de documentos; a escolha do PDF continua manual.
- A automação não envia mensagens ou anexos, não abre chats nem troca de conversa.
- Painel permanece único, inclusive em páginas com iframes.

Os testes anteriores em DOM simulado e em contenteditable genérico são úteis para verificar caminhos internos, mas não comprovam o comportamento do WhatsApp/React em uma sessão real.

## Publicar pelo Git

Após conferir os arquivos e validar os builds:

```bash
git status
git add README.md INSTALACAO.md docs src all.js build.js package.json package-lock.json dist .gitignore MODULARIZACAO.md
git commit -m "Descreva a alteração"
git push origin main
```

O build normal em `dist/` fornece o link de instalação do README. A versão minificada é uma alternativa opcional e deve ser atualizada junto com o build normal. Nenhum workflow de publicação automática foi configurado nesta etapa.
