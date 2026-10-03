// ==UserScript==
// @name         Fausto´s Toolkit
// @namespace    fausto.develper.toolbox
// @version      1.8.4.16
// @description  Caixa de ferramentas modular para navegador, PDFs, imagens, arquivos e utilidades
//
// @match        http://*/*
// @match        https://*/*
// @match        file:///*
//
// SGS - não executar
// @exclude      https://work.tailbc19c7.ts.net/*
//
// @run-at       document-start
// Frames trabalham sem painel próprio; não adicionar @noframes.
//
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        unsafeWindow
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_deleteValue
// @grant        GM_setValue
// @connect      *
//
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
//
// ==/UserScript==

(function () {
  "use strict";

  // ============================================================
  // BLOQUEIOS
  // ============================================================

  const HOSTS_BLOQUEADOS = ["work.tailbc19c7.ts.net"];

  if (HOSTS_BLOQUEADOS.includes(location.hostname)) {
    return;
  }

  // ============================================================
  // APP
  // ============================================================

  const APP = {
    nome: "Fausto´s Toolkit",
    versao: "1.8.4.8",
  };

  const CONFIG = {
    launcherDireita: 18,

    // No WhatsApp Web, sobe o launcher para não cobrir
    // o botão de enviar/microfone da barra de mensagens.
    launcherInferior: location.hostname === "web.whatsapp.com" ? 86 : 18,

    painelLargura: 360,

    maxProfundidadeBuscaLocal: 5,

    pdf: {
      tamanhoFonteVigencia: 20,
      margemDireitaVigencia: 22,
      margemTopoVigencia: 70,

      tamanhoFonteComissao: 12,
      margemDireitaComissao: 22,
      margemInferiorComissao: 40,
    },
  };

  // ============================================================
  // MÓDULOS
  // ============================================================

  const MODULOS = {
    pdf: {
      titulo: "PDF",
      ativoPorPadrao: false,
    },

    imagens: {
      titulo: "Imagens",
      ativoPorPadrao: false,
    },

    pagina: {
      titulo: "Página",
      ativoPorPadrao: false,
    },

    arquivos: {
      titulo: "Arquivos",
      ativoPorPadrao: false,
    },

    gmail: {
      titulo: "Gmail",
      ativoPorPadrao: true,
      somenteGmail: true,
    },
  };

  // ============================================================
  // SEGURADORAS
  // ============================================================

  const SEGURADORAS = ["ALLIANZ", "AZUL", "BRADESCO", "CHUBB", "EZZE", "HDI", "MAPFRE", "PORTO", "SOMPO", "SUHAI", "SULAMÉRICA", "TOKIO", "YELUM", "ZURICH", "OUTRO"];

  // ============================================================
  // RAMOS
  // ============================================================

  const RAMOS = ["AUTO", "RESIDENCIA", "EMPRESARIAL", "CONDOMINIO", "VIDA", "AP", "RCP", "OUTRO"];

  // ============================================================
  // STORAGE
  // ============================================================
  const STORAGE_MODULOS = "FAUSTO_TOOLKIT_MODULOS_V1";

  const STORAGE_PAINEL_ABERTO = "FAUSTO_TOOLKIT_PAINEL_ABERTO";

  const STORAGE_MODULO_ABERTO = "FAUSTO_TOOLKIT_MODULO_ABERTO";

  const STORAGE_PDF_SUBMODULO_ABERTO = "FAUSTO_TOOLKIT_PDF_SUBMODULO_ABERTO";

  const STORAGE_IMAGENS_SUBMODULO_ABERTO = "FAUSTO_TOOLKIT_IMAGENS_SUBMODULO_ABERTO";

  function carregarPreferenciasModulos() {
    const padrao = {};

    for (const [chave, modulo] of Object.entries(MODULOS)) {
      padrao[chave] = !!modulo.ativoPorPadrao;
    }

    try {
      const salvo = GM_getValue(STORAGE_MODULOS, null);

      if (!salvo) {
        return padrao;
      }

      const dados = typeof salvo === "string" ? JSON.parse(salvo) : salvo;

      return {
        ...padrao,
        ...dados,
      };
    } catch {
      return padrao;
    }
  }

  function salvarPreferenciasModulos(preferencias) {
    GM_setValue(STORAGE_MODULOS, preferencias);
  }

  // ============================================================
  // INDEXED DB
  // ============================================================

  const DB_NAME = "FAUSTO_TOOLKIT_CONFIG";

  const DB_VERSION = 1;

  const STORE_NAME = "config";

  const CHAVE_IMPORTAR = "pasta-importar";

  const CHAVE_IMPRIMIR = "pasta-imprimir";

  const CHAVE_PASTAS_LOCAIS = "pastas-locais";

  const CHAVE_ARQUIVOS_PASTAS_MONITORADAS = "arquivos-pastas-monitoradas-v1";

  const STORAGE_ARQUIVOS_SUBMODULO_ABERTO = "FAUSTO_TOOLKIT_ARQUIVOS_SUBMODULO_ABERTO";

  function abrirBanco() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = function () {
        const db = req.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      req.onsuccess = () => resolve(req.result);

      req.onerror = () => reject(req.error);
    });
  }

  async function salvarDB(chave, valor) {
    const db = await abrirBanco();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");

      tx.objectStore(STORE_NAME).put(valor, chave);

      tx.oncomplete = function () {
        db.close();
        resolve();
      };

      tx.onerror = function () {
        db.close();

        reject(tx.error);
      };
    });
  }

  async function obterDB(chave) {
    const db = await abrirBanco();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");

      const req = tx.objectStore(STORE_NAME).get(chave);

      req.onsuccess = function () {
        const resultado = req.result ?? null;

        db.close();

        resolve(resultado);
      };

      req.onerror = function () {
        db.close();

        reject(req.error);
      };
    });
  }

  // ============================================================
  // CACHE PDF
  // ============================================================

  const cachePdf = {
    buffer: null,
    nome: null,
    origem: null,
  };

  function limparCachePdf() {
    cachePdf.buffer = null;

    cachePdf.nome = null;

    cachePdf.origem = null;
  }

  // ============================================================
  // LOG
  // ============================================================

  function log(...args) {
    console.log("[FAUSTO TOOLKIT]", ...args);
  }

  function erro(...args) {
    console.error("[FAUSTO TOOLKIT]", ...args);
  }

  // ============================================================
  // CRIAR ELEMENTOS
  // ============================================================

  function criarElemento(tag, texto = null) {
    const el = document.createElement(tag);

    if (texto !== null) {
      el.textContent = texto;
    }

    return el;
  }

  // ============================================================
  // ACCORDION
  // ============================================================

  function configurarAccordionPersistente(elementos, storageKey, dataKey) {
    const salvo = GM_getValue(storageKey, null);

    // Restaura o último aberto
    elementos.forEach((item) => {
      if (item.dataset[dataKey] === salvo) {
        item.open = true;
      }
    });

    elementos.forEach((atual) => {
      atual.addEventListener("toggle", function () {
        const chaveAtual = atual.dataset[dataKey];

        // --------------------------------------------
        // ABRIU
        // --------------------------------------------

        if (atual.open) {
          GM_setValue(storageKey, chaveAtual);

          elementos.forEach((outro) => {
            if (outro !== atual && outro.open) {
              outro.open = false;
            }
          });

          return;
        }

        // --------------------------------------------
        // FECHOU MANUALMENTE
        // --------------------------------------------

        const armazenado = GM_getValue(storageKey, null);

        /*
         * Só limpa se esse ainda for
         * o item armazenado.
         *
         * Isso evita que o fechamento causado
         * pelo accordion apague o módulo que
         * acabou de ser aberto.
         */
        if (armazenado === chaveAtual) {
          GM_setValue(storageKey, null);
        }
      });
    });
  }
  // ============================================================
  // DETECTAR PDF
  // ============================================================

  function paginaParecePdf() {
    if (document.contentType && document.contentType.toLowerCase().includes("application/pdf")) {
      return true;
    }

    if (/\.pdf(?:$|\?|#)/i.test(location.href)) {
      return true;
    }

    if (document.querySelector('embed[type="application/pdf"]')) {
      return true;
    }

    const path = location.pathname.toLowerCase();

    return path.includes("/pdf/") || path.includes("gerarpdf") || path.includes("gerar-pdf") || path.includes("downloadpdf") || path.includes("download-pdf");
  }

  // ============================================================
  // DATA
  // ============================================================

  function formatarData(valor) {
    let numero = valor.replace(/\D/g, "");

    numero = numero.substring(0, 8);

    if (numero.length > 4) {
      return numero.substring(0, 2) + "/" + numero.substring(2, 4) + "/" + numero.substring(4);
    }

    if (numero.length > 2) {
      return numero.substring(0, 2) + "/" + numero.substring(2);
    }

    return numero;
  }

  function dataValida(data) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data);

    if (!match) {
      return false;
    }

    const dia = Number(match[1]);

    const mes = Number(match[2]);

    const ano = Number(match[3]);

    const dataJS = new Date(ano, mes - 1, dia);

    return dataJS.getFullYear() === ano && dataJS.getMonth() === mes - 1 && dataJS.getDate() === dia;
  }

  // ============================================================
  // COMISSÃO
  // ============================================================

  function formatarComissao(valor) {
    let texto = valor.replace(",", ".").replace(/[^\d.]/g, "");

    const partes = texto.split(".");

    if (partes.length > 2) {
      texto = partes.shift() + "." + partes.join("");
    }

    return texto.substring(0, 6);
  }

  function comissaoValida(valor) {
    if (!valor) {
      return true;
    }

    const numero = Number(valor);

    return !Number.isNaN(numero) && numero >= 0 && numero <= 100;
  }

  // ============================================================
  // NOME DE ARQUIVO
  // ============================================================

  function limparParteNome(valor) {
    return String(valor || "")
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function gerarNomePadrao(seguradora, ramo, cliente) {
    seguradora = limparParteNome(seguradora).toUpperCase();

    ramo = limparParteNome(ramo).toUpperCase();

    cliente = limparParteNome(cliente).toUpperCase();

    if (!seguradora || !ramo || !cliente) {
      return null;
    }

    return `${seguradora} - ${ramo} - ${cliente}.pdf`;
  }

  // ============================================================
  // FILE SYSTEM ACCESS API
  // ============================================================

  function obterJanelaFileSystem() {
    try {
      if (typeof window.showDirectoryPicker === "function") {
        return window;
      }
    } catch {
      // ignora
    }

    try {
      if (typeof unsafeWindow !== "undefined" && typeof unsafeWindow.showDirectoryPicker === "function") {
        return unsafeWindow;
      }
    } catch {
      // ignora
    }

    return null;
  }

  async function abrirSeletorDePasta(modo = "readwrite") {
    const janela = obterJanelaFileSystem();

    if (!janela) {
      const seguro = globalThis.isSecureContext ? "sim" : "não";

      throw new Error(`Seleção de pastas indisponível neste contexto. Contexto seguro: ${seguro}.`);
    }

    return await janela.showDirectoryPicker({
      mode: modo,
    });
  }

  // ============================================================
  // PERMISSÕES
  // ============================================================

  async function garantirPermissao(handle, modo = "read") {
    try {
      const opcoes = {
        mode: modo,
      };

      if ((await handle.queryPermission(opcoes)) === "granted") {
        return true;
      }

      if ((await handle.requestPermission(opcoes)) === "granted") {
        return true;
      }
    } catch (e) {
      erro("Permissão:", e);
    }

    return false;
  }

  async function consultarPermissao(handle, modo = "read") {
    try {
      if (!handle || typeof handle.queryPermission !== "function") {
        return "indisponivel";
      }

      return await handle.queryPermission({
        mode: modo,
      });
    } catch {
      return "indisponivel";
    }
  }

  // ============================================================
  // PASTAS DESTINO
  // ============================================================

  async function escolherPastaDestino(chave) {
    const handle = await abrirSeletorDePasta("readwrite");

    await salvarDB(chave, handle);

    return handle;
  }

  async function obterPastaDestino(chave) {
    let handle = await obterDB(chave);

    if (!handle) {
      return await escolherPastaDestino(chave);
    }

    if (!(await garantirPermissao(handle, "readwrite"))) {
      handle = await escolherPastaDestino(chave);
    }

    return handle;
  }

  // ============================================================
  // PASTAS LOCAIS
  // ============================================================

  async function obterPastasLocais() {
    const valor = await obterDB(CHAVE_PASTAS_LOCAIS);

    return Array.isArray(valor) ? valor : [];
  }

  async function salvarPastasLocais(pastas) {
    await salvarDB(CHAVE_PASTAS_LOCAIS, pastas);
  }

  async function adicionarPastaLocal() {
    const handle = await abrirSeletorDePasta("read");

    const pastas = await obterPastasLocais();

    let duplicada = false;

    for (const existente of pastas) {
      try {
        if (typeof existente.isSameEntry === "function" && (await existente.isSameEntry(handle))) {
          duplicada = true;

          break;
        }
      } catch {
        // ignora
      }
    }

    if (!duplicada) {
      pastas.push(handle);

      await salvarPastasLocais(pastas);
    }

    return handle;
  }

  async function removerPastaLocal(indice) {
    const pastas = await obterPastasLocais();

    pastas.splice(indice, 1);

    await salvarPastasLocais(pastas);
  }

  // ============================================================
  // PDF LOCAL
  // ============================================================

  function nomePdfPelaUrlLocal() {
    if (location.protocol !== "file:") {
      return null;
    }

    try {
      const caminho = decodeURIComponent(location.pathname);

      const nome = caminho.split("/").filter(Boolean).pop();

      if (nome && nome.toLowerCase().endsWith(".pdf")) {
        return nome;
      }
    } catch {
      // ignora
    }

    return null;
  }

  // ============================================================
  // BUSCA RECURSIVA
  // ============================================================

  async function buscarArquivoRecursivo(pasta, nomeArquivo, profundidade = 0, caminho = "") {
    if (profundidade > CONFIG.maxProfundidadeBuscaLocal) {
      return null;
    }

    try {
      // Primeiro procura arquivos
      for await (const entry of pasta.values()) {
        if (entry.kind === "file" && entry.name.toLowerCase() === nomeArquivo.toLowerCase()) {
          return {
            handle: entry,

            caminho: caminho ? `${caminho}\\${entry.name}` : entry.name,
          };
        }
      }

      // Depois subpastas
      for await (const entry of pasta.values()) {
        if (entry.kind !== "directory") {
          continue;
        }

        const subCaminho = caminho ? `${caminho}\\${entry.name}` : entry.name;

        const encontrado = await buscarArquivoRecursivo(entry, nomeArquivo, profundidade + 1, subCaminho);

        if (encontrado) {
          return encontrado;
        }
      }
    } catch (e) {
      erro("Busca em pasta:", pasta.name, e);
    }

    return null;
  }

  async function tentarLocalizarPdfLocal() {
    if (location.protocol !== "file:") {
      return null;
    }

    const nome = nomePdfPelaUrlLocal();

    if (!nome) {
      return null;
    }

    const candidatos = [];

    const importar = await obterDB(CHAVE_IMPORTAR);

    const imprimir = await obterDB(CHAVE_IMPRIMIR);

    if (importar) {
      candidatos.push(importar);
    }

    if (imprimir) {
      candidatos.push(imprimir);
    }

    const extras = await obterPastasLocais();

    candidatos.push(...extras);

    for (const pasta of candidatos) {
      try {
        const autorizado = await garantirPermissao(pasta, "read");

        if (!autorizado) {
          continue;
        }

        const encontrado = await buscarArquivoRecursivo(pasta, nome, 0, pasta.name);

        if (!encontrado) {
          continue;
        }

        const arquivo = await encontrado.handle.getFile();

        const buffer = await arquivo.arrayBuffer();

        cachePdf.buffer = buffer.slice(0);

        cachePdf.nome = arquivo.name;

        cachePdf.origem = encontrado.caminho;

        return {
          buffer: buffer.slice(0),

          nome: arquivo.name,

          origem: encontrado.caminho,
        };
      } catch (e) {
        erro("Busca automática:", e);
      }
    }

    return null;
  }

  // ============================================================
  // SELEÇÃO DE PDF
  // ============================================================

  function selecionarUmPdf() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");

      input.type = "file";

      input.accept = "application/pdf,.pdf";

      input.style.display = "none";

      document.body.appendChild(input);

      input.addEventListener(
        "change",
        async function () {
          const arquivo = input.files?.[0];

          input.remove();

          if (!arquivo) {
            reject(new Error("Nenhum PDF selecionado."));

            return;
          }

          resolve({
            nome: arquivo.name,

            buffer: await arquivo.arrayBuffer(),
          });
        },
        {
          once: true,
        },
      );

      input.click();
    });
  }

  function selecionarVariosPdfs() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");

      input.type = "file";

      input.accept = "application/pdf,.pdf";

      input.multiple = true;

      input.style.display = "none";

      document.body.appendChild(input);

      input.addEventListener(
        "change",
        async function () {
          const arquivos = Array.from(input.files || []);

          input.remove();

          if (!arquivos.length) {
            reject(new Error("Nenhum PDF selecionado."));

            return;
          }

          const resultado = [];

          for (const arquivo of arquivos) {
            resultado.push({
              nome: arquivo.name,

              buffer: await arquivo.arrayBuffer(),
            });
          }

          resolve(resultado);
        },
        {
          once: true,
        },
      );

      input.click();
    });
  }

  async function carregarPdfManualNoCache() {
    const arquivo = await selecionarUmPdf();

    cachePdf.buffer = arquivo.buffer.slice(0);

    cachePdf.nome = arquivo.nome;

    cachePdf.origem = "Selecionado manualmente";

    return arquivo;
  }

  // ============================================================
  // PDF WEB
  // ============================================================

  function nomePelaUrlWeb(url) {
    try {
      const parsed = new URL(url);

      let nome = parsed.pathname.split("/").pop();

      nome = decodeURIComponent(nome || "");

      if (nome && nome.toLowerCase().endsWith(".pdf")) {
        return nome;
      }
    } catch {
      // ignora
    }

    return null;
  }

  function nomePorContentDisposition(headers) {
    if (!headers) {
      return null;
    }

    const linha = headers.split(/\r?\n/).find((item) => item.toLowerCase().startsWith("content-disposition:"));

    if (!linha) {
      return null;
    }

    let match = linha.match(/filename\*\s*=\s*UTF-8''([^;\r\n]+)/i);

    if (match) {
      try {
        return decodeURIComponent(match[1].replace(/^["']|["']$/g, ""));
      } catch {
        return match[1];
      }
    }

    match = linha.match(/filename\s*=\s*"([^"]+)"/i);

    if (match) {
      return match[1];
    }

    return null;
  }

  function baixarPdfWeb(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",

        url,

        responseType: "arraybuffer",

        anonymous: false,

        onload: function (res) {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error(`Erro HTTP ${res.status}`));

            return;
          }

          let nome = nomePorContentDisposition(res.responseHeaders) || nomePelaUrlWeb(url) || "documento.pdf";

          if (!nome.toLowerCase().endsWith(".pdf")) {
            nome += ".pdf";
          }

          resolve({
            buffer: res.response,

            nome,
          });
        },

        onerror: function () {
          reject(new Error("Não foi possível carregar o PDF."));
        },
      });
    });
  }

  async function obterPdfAtual() {
    if (cachePdf.buffer && cachePdf.nome) {
      return {
        buffer: cachePdf.buffer.slice(0),

        nome: cachePdf.nome,
      };
    }

    if (location.protocol === "file:") {
      const localizado = await tentarLocalizarPdfLocal();

      if (localizado) {
        return localizado;
      }

      throw new Error("PDF local não localizado automaticamente.");
    }

    if (!paginaParecePdf()) {
      throw new Error("A página atual não parece ser um PDF.");
    }

    const resultado = await baixarPdfWeb(location.href);

    cachePdf.buffer = resultado.buffer.slice(0);

    cachePdf.nome = resultado.nome;

    cachePdf.origem = location.href;

    return resultado;
  }

  // ============================================================
  // EDIÇÃO PDF
  // ============================================================

  async function aplicarDadosProposta(buffer, vigencia, comissao) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;

    const doc = await PDFDocument.load(buffer.slice(0));

    const paginas = doc.getPages();

    if (!paginas.length) {
      throw new Error("PDF sem páginas.");
    }

    const pagina = paginas[0];

    const { width, height } = pagina.getSize();

    const fonte = await doc.embedFont(StandardFonts.HelveticaBold);

    // Vigência
    if (vigencia) {
      const tamanho = CONFIG.pdf.tamanhoFonteVigencia;

      const largura = fonte.widthOfTextAtSize(vigencia, tamanho);

      pagina.drawText(vigencia, {
        x: width - largura - CONFIG.pdf.margemDireitaVigencia,

        y: height - CONFIG.pdf.margemTopoVigencia,

        size: tamanho,

        font: fonte,

        color: rgb(0, 0, 0),
      });
    }

    // Comissão
    if (comissao) {
      const texto = `C: ${comissao}%`;

      const tamanho = CONFIG.pdf.tamanhoFonteComissao;

      const largura = fonte.widthOfTextAtSize(texto, tamanho);

      pagina.drawText(texto, {
        x: width - largura - CONFIG.pdf.margemDireitaComissao,

        y: CONFIG.pdf.margemInferiorComissao,

        size: tamanho,

        font: fonte,

        color: rgb(0, 0, 0),
      });
    }

    return await doc.save();
  }

  async function juntarPdfs(arquivos) {
    const { PDFDocument } = PDFLib;

    const destino = await PDFDocument.create();

    for (const arquivo of arquivos) {
      const origem = await PDFDocument.load(arquivo.buffer.slice(0));

      const paginas = await destino.copyPages(origem, origem.getPageIndices());

      paginas.forEach((pagina) => destino.addPage(pagina));
    }

    return await destino.save();
  }

  // ============================================================
  // ABRIR PDF
  // ============================================================

  function abrirPdfGerado(bytes) {
    const blob = new Blob([bytes], {
      type: "application/pdf",
    });

    const url = URL.createObjectURL(blob);

    window.open(url, "_blank");
  }

  // ============================================================
  // SALVAR PDF
  // ============================================================

  async function arquivoExiste(pasta, nome) {
    try {
      await pasta.getFileHandle(nome);

      return true;
    } catch (e) {
      if (e.name === "NotFoundError") {
        return false;
      }

      throw e;
    }
  }

  async function gerarNomeDisponivel(pasta, nome) {
    if (!(await arquivoExiste(pasta, nome))) {
      return nome;
    }

    const indice = nome.toLowerCase().lastIndexOf(".pdf");

    const base = indice >= 0 ? nome.substring(0, indice) : nome;

    const ext = indice >= 0 ? nome.substring(indice) : "";

    for (let i = 1; i < 10000; i++) {
      const candidato = `${base} (${i})${ext}`;

      if (!(await arquivoExiste(pasta, candidato))) {
        return candidato;
      }
    }

    throw new Error("Não foi possível gerar nome disponível.");
  }

  async function salvarBufferNaPasta(pasta, nome, buffer) {
    const nomeFinal = await gerarNomeDisponivel(pasta, nome);

    const arquivo = await pasta.getFileHandle(nomeFinal, {
      create: true,
    });

    const writable = await arquivo.createWritable();

    await writable.write(buffer);

    await writable.close();

    return nomeFinal;
  }

  // ============================================================
  // SHADOW DOM
  // ============================================================

  let rootHost = null;
  let shadow = null;

  let launcher = null;
  let painel = null;
  let conteudo = null;
  let statusGlobal = null;

  let painelAberto = false;

  let preferencias = carregarPreferenciasModulos();

  // ============================================================
  // CSS
  // ============================================================

  const CSS = `

        * {
            box-sizing: border-box;
        }

        :host {
            all: initial;
        }

        button,
        input,
        select,
        summary {
            font-family: Arial, sans-serif;
        }

        .launcher {
            position: fixed;

            right:
                ${CONFIG.launcherDireita}px;

            bottom:
                ${CONFIG.launcherInferior}px;

            width: 48px;
            height: 48px;

            border: 0;
            border-radius: 50%;

            background:
                #212529;

            color:
                #fff;

            font-weight:
                700;

            cursor:
                pointer;

            box-shadow:
                0 4px 15px
                rgba(0,0,0,.35);

            z-index:
                2147483647;
        }

        .painel {
            position: fixed;

            right:
                ${CONFIG.launcherDireita}px;

            bottom:
                ${CONFIG.launcherInferior + 58}px;

            width:
                ${CONFIG.painelLargura}px;

            max-height:
                calc(100vh - 100px);

            display:
                none;

            flex-direction:
                column;

            background:
                #fff;

            color:
                #222;

            border:
                1px solid #bbb;

            border-radius:
                10px;

            box-shadow:
                0 6px 24px
                rgba(0,0,0,.30);

            overflow:
                hidden;

            z-index:
                2147483647;

            font-family:
                Arial,
                sans-serif;
        }

        .header {
            display:
                flex;

            align-items:
                center;

            justify-content:
                space-between;

            padding:
                10px 12px;

            background:
                #f8f9fa;

            border-bottom:
                1px solid #ddd;
        }

        .header-nome {
            font-size:
                14px;

            font-weight:
                bold;
        }

        .header-versao {
            font-size:
                9px;

            color:
                #999;
        }

        .conteudo {
            overflow-y:
                auto;

            padding:
                10px;
        }

        .status {
            min-height:
                28px;

            padding:
                7px 10px;

            border-top:
                1px solid #eee;

            background:
                #fafafa;

            font-size:
                10px;

            color:
                #666;

            text-align:
                center;
        }

        .box {
            padding:
                8px;

            border:
                1px solid #ddd;

            border-radius:
                7px;

            background:
                #f5f5f5;

            margin-bottom:
                10px;
        }

        .titulo-box {
            font-size:
                11px;

            font-weight:
                bold;

            color:
                #555;

            margin-bottom:
                6px;
        }

        .check-modulo {
            display:
                flex;

            align-items:
                center;

            gap:
                6px;

            font-size:
                11px;

            margin:
                5px 0;

            cursor:
                pointer;
        }

        details.modulo-principal {
            border:
                1px solid #d5d5d5;

            border-radius:
                8px;

            margin-bottom:
                8px;

            background:
                #fff;
        }

        details.modulo-principal > summary {
            padding:
                9px 10px;

            font-weight:
                bold;

            font-size:
                13px;

            cursor:
                pointer;

            background:
                #f8f9fa;

            border-radius:
                8px;
        }

        details.modulo-principal[open] >
        summary {
            border-bottom:
                1px solid #ddd;

            border-radius:
                8px 8px 0 0;
        }

        .modulo-corpo {
            padding:
                9px;
        }

        details.submodulo {
            border:
                1px solid #ddd;

            border-radius:
                7px;

            margin-bottom:
                7px;

            overflow:
                hidden;
        }

        details.submodulo >
        summary {
            padding:
                8px;

            font-size:
                11px;

            font-weight:
                bold;

            cursor:
                pointer;

            background:
                #f8f9fa;
        }

        .submodulo-corpo {
            padding:
                8px;
        }

        .label {
            display:
                block;

            font-size:
                10px;

            color:
                #666;

            margin-bottom:
                3px;
        }

        .campo {
            width:
                100%;

            padding:
                7px 8px;

            border:
                1px solid #aaa;

            border-radius:
                6px;

            background:
                white;

            color:
                #222;

            margin-bottom:
                8px;

            font-size:
                13px;

            outline:
                none;
        }

        .campo-grande {
            font-size:
                17px;

            font-weight:
                bold;

            text-align:
                center;
        }

        .uppercase {
            text-transform:
                uppercase;
        }

        .botao {
            width:
                100%;

            border:
                0;

            border-radius:
                6px;

            padding:
                8px;

            margin-bottom:
                6px;

            color:
                white;

            font-size:
                11px;

            font-weight:
                bold;

            cursor:
                pointer;
        }

        .btn-dark {
            background:
                #495057;
        }

        .btn-green {
            background:
                #198754;
        }

        .btn-blue {
            background:
                #0d6efd;
        }

        .btn-purple {
            background:
                #6f42c1;
        }

        .btn-orange {
            background:
                #fd7e14;
        }

        .botao-secundario {
            width:
                100%;

            border:
                1px solid #bbb;

            border-radius:
                6px;

            padding:
                7px;

            margin-bottom:
                6px;

            background:
                white;

            color:
                #444;

            font-size:
                10px;

            cursor:
                pointer;
        }

        .preview {
            min-height:
                30px;

            padding:
                7px;

            border:
                1px solid #ddd;

            border-radius:
                6px;

            background:
                #f5f5f5;

            color:
                #555;

            font-size:
                10px;

            word-break:
                break-word;

            margin-bottom:
                8px;
        }

        .info {
            padding:
                7px;

            background:
                #f5f5f5;

            border:
                1px solid #ddd;

            border-radius:
                6px;

            color:
                #666;

            font-size:
                10px;

            line-height:
                1.4;

            white-space:
                pre-line;

            margin-bottom:
                8px;
        }

        .info-local {
            padding:
                8px;

            background:
                #fff8e1;

            border:
                1px solid #e0c97f;

            border-radius:
                7px;

            margin-bottom:
                8px;
        }

        .linha {
            display:
                flex;

            gap:
                6px;
        }

        .flex1 {
            flex:
                1;
        }

        .oculto {
            display:
                none !important;
        }

        .texto-pequeno {
            font-size:
                10px;

            color:
                #666;

            line-height:
                1.4;

            margin-bottom:
                7px;
        }

        .pasta-linha {
            display:
                flex;

            align-items:
                center;

            gap:
                5px;

            margin-bottom:
                4px;

            font-size:
                10px;
        }

        .pasta-nome {
            flex:
                1;

            overflow:
                hidden;

            text-overflow:
                ellipsis;

            white-space:
                nowrap;
        }

        .pasta-remove {
            width:
                24px;

            height:
                24px;

            border:
                1px solid #ccc;

            border-radius:
                4px;

            background:
                white;

            color:
                #c92a2a;

            cursor:
                pointer;
        }

        .arquivo-padrao-linha {
            display:
                grid;

            grid-template-columns:
                minmax(0, 1fr) auto auto;

            gap:
                5px;

            align-items:
                center;

            padding:
                6px;

            margin-bottom:
                5px;

            border:
                1px solid #ddd;

            border-radius:
                6px;

            background:
                #fff;
        }

        .arquivo-padrao-info {
            min-width:
                0;
        }

        .arquivo-padrao-titulo {
            font-size:
                10px;

            font-weight:
                bold;

            color:
                #444;
        }

        .arquivo-padrao-caminho {
            margin-top:
                2px;

            overflow:
                hidden;

            text-overflow:
                ellipsis;

            white-space:
                nowrap;

            color:
                #888;

            font-size:
                9px;
        }


        .arquivo-permissao {
            display:
                inline-flex;

            align-items:
                center;

            gap:
                4px;

            margin-top:
                3px;

            font-size:
                9px;

            font-weight:
                bold;
        }

        .arquivo-permissao.ok {
            color:
                #198754;
        }

        .arquivo-permissao.pendente {
            color:
                #b7791f;
        }

        .arquivo-permissao.erro {
            color:
                #c92a2a;
        }

        .arquivo-resumo-permissoes {
            margin:
                7px 0;

            padding:
                7px;

            border:
                1px solid #ddd;

            border-radius:
                6px;

            background:
                #f8f9fa;

            color:
                #555;

            font-size:
                9px;

            line-height:
                1.4;
        }

        .arquivo-mini-btn {
            min-width:
                27px;

            height:
                27px;

            padding:
                0 7px;

            border:
                1px solid #bbb;

            border-radius:
                5px;

            background:
                #fff;

            color:
                #444;

            cursor:
                pointer;

            font-size:
                9px;
        }

        .arquivo-mini-btn:hover {
            background:
                #f1f3f5;
        }

        .arquivo-preview-lista {
            max-height:
                220px;

            overflow-y:
                auto;

            overflow-x:
                hidden;

            margin-bottom:
                8px;

            border:
                1px solid #ddd;

            border-radius:
                6px;

            background:
                #fff;
        }

        .arquivo-preview-item {
            padding:
                6px 7px;

            border-bottom:
                1px solid #eee;

            font-size:
                9px;

            color:
                #555;

            line-height:
                1.35;

            overflow-wrap:
                anywhere;
        }

        .arquivo-preview-item:last-child {
            border-bottom:
                0;
        }

        .arquivo-preview-destino {
            color:
                #198754;

            font-weight:
                bold;
        }


        .imagem-lista {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 8px;
        }

        .imagem-item {
            display: grid;
            grid-template-columns: 24px 54px minmax(0, 1fr);
            align-items: center;
            gap: 7px;
            padding: 6px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: #fff;
        }

        .imagem-thumb {
            width: 54px;
            height: 42px;
            object-fit: contain;
            background: #f2f2f2;
            border: 1px solid #eee;
            border-radius: 4px;
        }

        .imagem-meta {
            min-width: 0;
            font-size: 9px;
            line-height: 1.35;
            color: #555;
        }

        .imagem-url {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #777;
        }

        .imagem-acoes {
            display: flex;
            gap: 5px;
            margin-bottom: 7px;
        }

        .imagem-acoes > button {
            flex: 1;
        }

        .imagem-fila-item {
            display: grid;
            grid-template-columns: 42px minmax(0, 1fr) 26px 26px 26px;
            gap: 5px;
            align-items: center;
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: white;
            margin-bottom: 5px;
        }

        .imagem-fila-thumb {
            width: 42px;
            height: 34px;
            object-fit: contain;
            background: #f3f3f3;
            border-radius: 4px;
        }

        .imagem-fila-nome {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 9px;
        }

        .mini-botao {
            width: 26px;
            height: 26px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            padding: 0;
            font-size: 11px;
        }

        .separador {
            height: 1px;
            background: #e5e5e5;
            margin: 8px 0;
        }
    `;

  // ============================================================
  // HELPERS SHADOW
  // ============================================================

  function el(tag, classe = "", texto = null) {
    const elemento = document.createElement(tag);

    if (classe) {
      elemento.className = classe;
    }

    if (texto !== null) {
      elemento.textContent = texto;
    }

    return elemento;
  }

  function definirStatus(texto, tipo = "normal") {
    if (!statusGlobal) {
      return;
    }

    const cores = {
      normal: "#666",

      ok: "#198754",

      erro: "#c92a2a",
    };

    statusGlobal.style.color = cores[tipo] || cores.normal;

    statusGlobal.textContent = texto;
  }

  // ============================================================
  // CONFIGURAÇÃO DE MÓDULOS
  // ============================================================

  function criarConfiguracaoModulos() {
    const box = el("div", "box");

    box.appendChild(el("div", "titulo-box", "Módulos ativos"));

    for (const [chave, modulo] of Object.entries(MODULOS)) {
      if (modulo.somenteGmail && location.hostname !== "mail.google.com") {
        continue;
      }

      const label = el("label", "check-modulo");

      const check = el("input");

      check.type = "checkbox";

      check.checked = !!preferencias[chave];

      const span = el("span");

      span.textContent = modulo.titulo + (modulo.futuro ? " — em breve" : "");

      if (modulo.futuro) {
        span.style.color = "#999";
      }

      check.addEventListener("change", function () {
        preferencias[chave] = check.checked;

        salvarPreferenciasModulos(preferencias);

        renderizarConteudo();
      });

      label.appendChild(check);

      label.appendChild(span);

      box.appendChild(label);
    }

    return box;
  }

  // ============================================================
  // PDF - ARQUIVO LOCAL UI
  // ============================================================

  async function criarBlocoArquivoLocal() {
    const box = el("div", "info-local");

    box.appendChild(el("div", "titulo-box", "Arquivo local"));

    const info = el("div", "info");

    function atualizarInfo() {
      if (cachePdf.buffer && cachePdf.nome) {
        info.style.color = "#198754";

        info.textContent = `✓ ${cachePdf.nome}` + (cachePdf.origem ? `\n${cachePdf.origem}` : "");
      } else {
        info.style.color = "#666";

        info.textContent = "PDF ainda não carregado.";
      }
    }

    atualizarInfo();

    const localizar = el("button", "botao-secundario", "Procurar automaticamente");

    localizar.onclick = async function () {
      limparCachePdf();

      definirStatus("Procurando nas pastas autorizadas...");

      try {
        const resultado = await tentarLocalizarPdfLocal();

        atualizarInfo();

        if (resultado) {
          definirStatus("PDF localizado automaticamente.", "ok");
        } else {
          definirStatus("PDF não encontrado nas pastas autorizadas.", "erro");
        }
      } catch (e) {
        definirStatus(e.message, "erro");
      }
    };

    const selecionar = el("button", "botao-secundario", "Selecionar PDF manualmente");

    selecionar.onclick = async function () {
      try {
        await carregarPdfManualNoCache();

        atualizarInfo();

        definirStatus("PDF carregado.", "ok");
      } catch (e) {
        definirStatus(e.message, "erro");
      }
    };

    const adicionar = el("button", "botao-secundario", "+ Adicionar pasta de busca");

    adicionar.onclick = async function () {
      try {
        const handle = await adicionarPastaLocal();

        definirStatus(`Pasta adicionada: ${handle.name}`, "ok");

        await renderizarConteudo();
      } catch (e) {
        if (e.name !== "AbortError") {
          definirStatus(e.message, "erro");
        }
      }
    };

    box.appendChild(info);

    box.appendChild(localizar);

    box.appendChild(selecionar);

    box.appendChild(adicionar);

    const pastas = await obterPastasLocais();

    if (pastas.length) {
      box.appendChild(el("div", "texto-pequeno", `Pastas de busca: ${pastas.length}`));

      pastas.forEach((pasta, indice) => {
        const linha = el("div", "pasta-linha");

        const nome = el("div", "pasta-nome", pasta.name);

        const remover = el("button", "pasta-remove", "×");

        remover.onclick = async function () {
          await removerPastaLocal(indice);

          await renderizarConteudo();
        };

        linha.appendChild(nome);

        linha.appendChild(remover);

        box.appendChild(linha);
      });
    }

    if (!cachePdf.buffer) {
      setTimeout(async function () {
        try {
          const encontrado = await tentarLocalizarPdfLocal();

          if (encontrado) {
            atualizarInfo();

            definirStatus("PDF local localizado automaticamente.", "ok");
          }
        } catch {
          // silencioso
        }
      }, 100);
    }

    return box;
  }

  // ============================================================
  // SUBMÓDULO PROPOSTA
  // ============================================================

  function criarSubmoduloProposta() {
    const details = el("details", "submodulo");

    details.dataset.submodulo = "proposta";

    const summary = el("summary", "", "Proposta / impressão");

    const corpo = el("div", "submodulo-corpo");

    // Vigência
    const labelVigencia = el("label", "label", "Fim da vigência");

    const vigencia = el("input", "campo campo-grande");

    vigencia.type = "text";

    vigencia.placeholder = "DD/MM/AAAA";

    vigencia.maxLength = 10;

    vigencia.oninput = function () {
      vigencia.value = formatarData(vigencia.value);
    };

    // Comissão
    const labelComissao = el("label", "label", "Comissão (%)");

    const comissao = el("input", "campo campo-grande");

    comissao.type = "text";

    comissao.placeholder = "Ex.: 20";

    comissao.oninput = function () {
      comissao.value = formatarComissao(comissao.value);
    };

    const processar = el("button", "botao btn-green", "Processar para impressão");

    processar.onclick = async function () {
      const v = vigencia.value.trim();

      const c = comissao.value.trim();

      if (!v && !c) {
        definirStatus("Informe vigência ou comissão.", "erro");

        return;
      }

      if (v && !dataValida(v)) {
        definirStatus("Vigência inválida.", "erro");

        return;
      }

      if (c && !comissaoValida(c)) {
        definirStatus("Comissão inválida.", "erro");

        return;
      }

      try {
        processar.disabled = true;

        definirStatus("Processando PDF...");

        const original = await obterPdfAtual();

        const novo = await aplicarDadosProposta(original.buffer, v, c);

        abrirPdfGerado(novo);

        definirStatus("PDF pronto.", "ok");
      } catch (e) {
        definirStatus(e.message, "erro");
      } finally {
        processar.disabled = false;
      }
    };

    corpo.appendChild(labelVigencia);

    corpo.appendChild(vigencia);

    corpo.appendChild(labelComissao);

    corpo.appendChild(comissao);

    corpo.appendChild(processar);

    details.appendChild(summary);

    details.appendChild(corpo);

    return details;
  }

  // ============================================================
  // SUBMÓDULO SALVAR / NOMEAR
  // ============================================================

  async function criarSubmoduloSalvar() {
    const details = el("details", "submodulo");

    details.dataset.submodulo = "salvar";

    const summary = el("summary", "", "Salvar / nomear proposta");

    const corpo = el("div", "submodulo-corpo");

    // --------------------------------------------------------
    // SEGURADORA
    // --------------------------------------------------------

    const labelSeguradora = el("label", "label", "Seguradora");

    const seguradora = el("select", "campo");

    seguradora.appendChild(new Option("Selecione...", ""));

    SEGURADORAS.forEach((item) => {
      seguradora.appendChild(new Option(item, item));
    });

    const seguradoraOutro = el("input", "campo uppercase oculto");

    seguradoraOutro.type = "text";

    seguradoraOutro.placeholder = "Digite a seguradora";

    // --------------------------------------------------------
    // RAMO
    // --------------------------------------------------------

    const labelRamo = el("label", "label", "Ramo");

    const ramo = el("select", "campo");

    ramo.appendChild(new Option("Selecione...", ""));

    RAMOS.forEach((item) => {
      ramo.appendChild(new Option(item, item));
    });

    const ramoOutro = el("input", "campo uppercase oculto");

    ramoOutro.type = "text";

    ramoOutro.placeholder = "Digite o ramo";

    // --------------------------------------------------------
    // CLIENTE
    // --------------------------------------------------------

    const labelCliente = el("label", "label", "Cliente");

    const cliente = el("input", "campo uppercase");

    cliente.type = "text";

    cliente.placeholder = "Nome do cliente";

    // --------------------------------------------------------
    // PREVIEW
    // --------------------------------------------------------

    const preview = el("div", "preview");

    function getSeguradoraFinal() {
      return seguradora.value === "OUTRO" ? seguradoraOutro.value : seguradora.value;
    }

    function getRamoFinal() {
      return ramo.value === "OUTRO" ? ramoOutro.value : ramo.value;
    }

    function obterNomeNovo() {
      return gerarNomePadrao(getSeguradoraFinal(), getRamoFinal(), cliente.value);
    }

    function atualizarPreview() {
      preview.textContent = obterNomeNovo() || "Preencha seguradora, ramo e cliente.";
    }

    // --------------------------------------------------------
    // EVENTOS SEGURADORA
    // --------------------------------------------------------

    seguradora.onchange = function () {
      const custom = seguradora.value === "OUTRO";

      seguradoraOutro.classList.toggle("oculto", !custom);

      if (!custom) {
        seguradoraOutro.value = "";
      }

      atualizarPreview();

      if (custom) {
        setTimeout(() => seguradoraOutro.focus(), 0);
      }
    };

    seguradoraOutro.oninput = function () {
      seguradoraOutro.value = seguradoraOutro.value.toUpperCase();

      atualizarPreview();
    };

    // --------------------------------------------------------
    // EVENTOS RAMO
    // --------------------------------------------------------

    ramo.onchange = function () {
      const custom = ramo.value === "OUTRO";

      ramoOutro.classList.toggle("oculto", !custom);

      if (!custom) {
        ramoOutro.value = "";
      }

      atualizarPreview();

      if (custom) {
        setTimeout(() => ramoOutro.focus(), 0);
      }
    };

    ramoOutro.oninput = function () {
      ramoOutro.value = ramoOutro.value.toUpperCase();

      atualizarPreview();
    };

    // --------------------------------------------------------
    // CLIENTE SEMPRE UPPERCASE
    // --------------------------------------------------------

    cliente.oninput = function () {
      cliente.value = cliente.value.toUpperCase();

      atualizarPreview();
    };

    atualizarPreview();

    // --------------------------------------------------------
    // DESTINOS
    // --------------------------------------------------------

    const infoDestinos = el("div", "info");

    async function atualizarDestinos() {
      const importar = await obterDB(CHAVE_IMPORTAR);

      const imprimir = await obterDB(CHAVE_IMPRIMIR);

      infoDestinos.textContent = `IMPORTAR → ${importar ? importar.name : "não configurada"}\n` + `IMPRIMIR → ${imprimir ? imprimir.name : "não configurada"}`;
    }

    await atualizarDestinos();

    // --------------------------------------------------------
    // SALVAR
    // --------------------------------------------------------

    async function salvarEm(chave) {
      try {
        definirStatus("Obtendo PDF original...");

        const original = await obterPdfAtual();

        const pasta = await obterPastaDestino(chave);

        const nome = obterNomeNovo() || original.nome;

        const nomeFinal = await salvarBufferNaPasta(pasta, nome, original.buffer);

        definirStatus(`Salvo: ${nomeFinal}`, "ok");

        await atualizarDestinos();
      } catch (e) {
        definirStatus(e.message, "erro");
      }
    }

    const salvarImportar = el("button", "botao btn-blue", "Salvar em IMPORTAR");

    salvarImportar.onclick = () => salvarEm(CHAVE_IMPORTAR);

    const salvarImprimir = el("button", "botao btn-purple", "Salvar em IMPRIMIR");

    salvarImprimir.onclick = () => salvarEm(CHAVE_IMPRIMIR);

    // --------------------------------------------------------
    // CONFIG DESTINOS
    // --------------------------------------------------------

    const linhaConfig = el("div", "linha");

    const configImportar = el("button", "botao-secundario flex1", "⚙ IMPORTAR");

    const configImprimir = el("button", "botao-secundario flex1", "⚙ IMPRIMIR");

    configImportar.onclick = async function () {
      try {
        await escolherPastaDestino(CHAVE_IMPORTAR);

        await atualizarDestinos();

        definirStatus("Pasta IMPORTAR alterada.", "ok");
      } catch (e) {
        if (e.name !== "AbortError") {
          definirStatus(e.message, "erro");
        }
      }
    };

    configImprimir.onclick = async function () {
      try {
        await escolherPastaDestino(CHAVE_IMPRIMIR);

        await atualizarDestinos();

        definirStatus("Pasta IMPRIMIR alterada.", "ok");
      } catch (e) {
        if (e.name !== "AbortError") {
          definirStatus(e.message, "erro");
        }
      }
    };

    linhaConfig.appendChild(configImportar);

    linhaConfig.appendChild(configImprimir);

    // --------------------------------------------------------
    // MONTAGEM
    // --------------------------------------------------------

    corpo.appendChild(labelSeguradora);

    corpo.appendChild(seguradora);

    corpo.appendChild(seguradoraOutro);

    corpo.appendChild(labelRamo);

    corpo.appendChild(ramo);

    corpo.appendChild(ramoOutro);

    corpo.appendChild(labelCliente);

    corpo.appendChild(cliente);

    corpo.appendChild(preview);

    corpo.appendChild(infoDestinos);

    corpo.appendChild(salvarImportar);

    corpo.appendChild(salvarImprimir);

    corpo.appendChild(linhaConfig);

    details.appendChild(summary);

    details.appendChild(corpo);

    return details;
  }

  // ============================================================
  // SUBMÓDULO JUNTAR PDF
  // ============================================================

  function criarSubmoduloJuntar() {
    const details = el("details", "submodulo");

    details.dataset.submodulo = "juntar";

    const summary = el("summary", "", "Juntar PDFs");

    const corpo = el("div", "submodulo-corpo");

    corpo.appendChild(el("div", "texto-pequeno", "Selecione dois ou mais PDFs na ordem em que deseja juntá-los."));

    const juntar = el("button", "botao btn-orange", "Selecionar e juntar PDFs");

    juntar.onclick = async function () {
      try {
        const arquivos = await selecionarVariosPdfs();

        if (arquivos.length < 2) {
          throw new Error("Selecione pelo menos 2 PDFs.");
        }

        definirStatus(`Juntando ${arquivos.length} PDFs...`);

        const resultado = await juntarPdfs(arquivos);

        abrirPdfGerado(resultado);

        definirStatus(`${arquivos.length} PDFs unidos.`, "ok");
      } catch (e) {
        definirStatus(e.message, "erro");
      }
    };

    corpo.appendChild(juntar);

    details.appendChild(summary);

    details.appendChild(corpo);

    return details;
  }

  // ============================================================
  // MÓDULO PDF
  // ============================================================

  async function criarModuloPdf() {
    const details = el("details", "modulo-principal");

    details.dataset.modulo = "pdf";

    const summary = el("summary", "", "PDF");

    const corpo = el("div", "modulo-corpo");

    // PDF local
    if (location.protocol === "file:") {
      corpo.appendChild(await criarBlocoArquivoLocal());
    }

    const proposta = criarSubmoduloProposta();

    const salvar = await criarSubmoduloSalvar();

    const juntar = criarSubmoduloJuntar();

    // Accordion dos submódulos
    configurarAccordionPersistente([proposta, salvar, juntar], STORAGE_PDF_SUBMODULO_ABERTO, "submodulo");

    corpo.appendChild(proposta);

    corpo.appendChild(salvar);

    corpo.appendChild(juntar);

    details.appendChild(summary);

    details.appendChild(corpo);

    return details;
  }

  // ============================================================
  // IMAGENS - HELPERS
  // ============================================================

  function extensaoPorMimeImagem(mime) {
    const mapa = {
      "image/jpeg": "jpg",

      "image/png": "png",

      "image/webp": "webp",

      "image/gif": "gif",

      "image/svg+xml": "svg",

      "image/bmp": "bmp",

      "image/avif": "avif",
    };

    return mapa[String(mime || "").toLowerCase()] || "img";
  }

  function nomeArquivoDaUrlImagem(url, indice = 1) {
    try {
      if (/^data:/i.test(url)) {
        const mime = url.substring(5, url.indexOf(";") > 0 ? url.indexOf(";") : url.indexOf(","));

        return `imagem-${indice}.` + extensaoPorMimeImagem(mime);
      }

      const u = new URL(url, location.href);

      let nome = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");

      nome = limparParteNome(nome);

      if (nome && /\.[a-z0-9]{2,5}$/i.test(nome)) {
        return nome;
      }
    } catch {
      // usa nome padrão
    }

    return `imagem-${indice}.img`;
  }

  function baixarBlob(blob, nome) {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = limparParteNome(nome) || "arquivo";

    a.style.display = "none";

    document.documentElement.appendChild(a);

    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function carregarBlobUrl(url) {
    if (/^data:/i.test(url) || /^blob:/i.test(url)) {
      const resposta = await fetch(url);

      if (!resposta.ok) {
        throw new Error("Falha ao carregar a imagem.");
      }

      return await resposta.blob();
    }

    return await new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",

        url: new URL(url, location.href).href,

        responseType: "blob",

        onload: function (resposta) {
          if (resposta.status >= 200 && resposta.status < 300 && resposta.response) {
            resolve(resposta.response);

            return;
          }

          reject(new Error(`Erro HTTP ${resposta.status || "?"}.`));
        },

        onerror: function () {
          reject(new Error("Falha de rede ao carregar a imagem."));
        },
      });
    });
  }

  async function carregarImagemDeBlob(blob) {
    const url = URL.createObjectURL(blob);

    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);

        img.onerror = () => reject(new Error("Formato de imagem não suportado pelo navegador."));

        img.src = url;
      });
    } finally {
      // A URL só pode ser revogada depois do decode.
      // O setTimeout evita quebrar drawImage em alguns Chromium.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  function canvasParaBlob(canvas, mime, qualidade = 0.92) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Não foi possível gerar a imagem."));

            return;
          }

          resolve(blob);
        },
        mime,
        qualidade,
      );
    });
  }

  function mimeImagemSaida(formato) {
    if (formato === "jpg") {
      return "image/jpeg";
    }

    if (formato === "webp") {
      return "image/webp";
    }

    return "image/png";
  }

  function trocarExtensaoImagem(nome, extensao) {
    const base = limparParteNome(nome || "imagem").replace(/\.[a-z0-9]{2,6}$/i, "") || "imagem";

    return `${base}.${extensao}`;
  }

  function criarInputArquivoImagem(multiplo = false) {
    return new Promise((resolve) => {
      const input = document.createElement("input");

      input.type = "file";

      input.accept = "image/*";

      input.multiple = multiplo;

      input.style.display = "none";

      document.documentElement.appendChild(input);

      input.addEventListener(
        "change",
        function () {
          const arquivos = Array.from(input.files || []);

          input.remove();

          resolve(arquivos);
        },
        {
          once: true,
        },
      );

      input.click();
    });
  }

  function coletarImagensDaPagina() {
    const mapa = new Map();

    const imgs = Array.from(document.images || []);

    imgs.forEach((img, indice) => {
      const url = img.currentSrc || img.src || "";

      if (!url) {
        return;
      }

      if (rootHost && rootHost.contains(img)) {
        return;
      }

      const chave = String(url);

      if (mapa.has(chave)) {
        return;
      }

      mapa.set(chave, {
        url,
        largura: img.naturalWidth || img.width || 0,
        altura: img.naturalHeight || img.height || 0,
        alt: img.alt || "",
        nome: nomeArquivoDaUrlImagem(url, indice + 1),
      });
    });

    return Array.from(mapa.values());
  }

  // ============================================================
  // IMAGENS - DA PÁGINA
  // ============================================================

  function criarSubmoduloImagensPagina() {
    const details = el("details", "submodulo");

    details.dataset.submodulo = "pagina";

    const summary = el("summary", "", "Imagens da página");

    const corpo = el("div", "submodulo-corpo");

    const info = el("div", "texto-pequeno", "Lista as imagens <img> carregadas na página atual. Você pode selecionar e baixar várias de uma vez.");

    const barra = el("div", "imagem-acoes");

    const atualizar = el("button", "botao-secundario", "Atualizar lista");

    const selecionarTodos = el("button", "botao-secundario", "Selecionar todos");

    barra.appendChild(atualizar);

    barra.appendChild(selecionarTodos);

    const resumo = el("div", "info");

    const lista = el("div", "imagem-lista");

    const baixar = el("button", "botao btn-green", "Baixar selecionadas");

    let dados = [];

    function renderLista() {
      lista.replaceChildren();

      dados = coletarImagensDaPagina();

      resumo.textContent = dados.length ? `${dados.length} imagem(ns) encontrada(s).` : "Nenhuma imagem <img> encontrada nesta página.";

      dados.forEach((item, indice) => {
        const linha = el("label", "imagem-item");

        const check = el("input");

        check.type = "checkbox";

        check.dataset.indice = String(indice);

        const thumb = el("img", "imagem-thumb");

        thumb.src = item.url;

        thumb.alt = item.alt || "";

        const meta = el("div", "imagem-meta");

        const nome = el("div", "", item.nome);

        nome.style.fontWeight = "bold";

        const tamanho = el("div", "", item.largura && item.altura ? `${item.largura} × ${item.altura}px` : "Dimensões indisponíveis");

        const url = el("div", "imagem-url", item.url);

        url.title = item.url;

        meta.appendChild(nome);

        meta.appendChild(tamanho);

        meta.appendChild(url);

        linha.appendChild(check);

        linha.appendChild(thumb);

        linha.appendChild(meta);

        lista.appendChild(linha);
      });
    }

    atualizar.onclick = renderLista;

    selecionarTodos.onclick = function () {
      const checks = Array.from(lista.querySelectorAll('input[type="checkbox"]'));

      const todosMarcados = checks.length > 0 && checks.every((check) => check.checked);

      checks.forEach((check) => {
        check.checked = !todosMarcados;
      });

      selecionarTodos.textContent = todosMarcados ? "Selecionar todos" : "Desmarcar todos";
    };

    baixar.onclick = async function () {
      const selecionados = Array.from(lista.querySelectorAll('input[type="checkbox"]:checked'))
        .map((check) => dados[Number(check.dataset.indice)])
        .filter(Boolean);

      if (!selecionados.length) {
        definirStatus("Selecione pelo menos uma imagem.", "erro");

        return;
      }

      baixar.disabled = true;

      try {
        let concluidas = 0;

        for (let i = 0; i < selecionados.length; i++) {
          const item = selecionados[i];

          definirStatus(`Baixando ${i + 1}/${selecionados.length}: ${item.nome}`);

          try {
            const blob = await carregarBlobUrl(item.url);

            let nome = item.nome;

            if (!/\.[a-z0-9]{2,6}$/i.test(nome) || /\.img$/i.test(nome)) {
              nome = trocarExtensaoImagem(nome, extensaoPorMimeImagem(blob.type));
            }

            baixarBlob(blob, nome);

            concluidas++;

            // Evita o Chromium bloquear uma rajada de downloads.
            await new Promise((resolve) => setTimeout(resolve, 120));
          } catch (e) {
            erro("Falha ao baixar imagem:", item.url, e);
          }
        }

        definirStatus(`${concluidas}/${selecionados.length} imagem(ns) baixada(s).`, concluidas === selecionados.length ? "ok" : "erro");
      } finally {
        baixar.disabled = false;
      }
    };

    corpo.appendChild(info);

    corpo.appendChild(barra);

    corpo.appendChild(resumo);

    corpo.appendChild(lista);

    corpo.appendChild(baixar);

    details.addEventListener("toggle", function () {
      if (details.open && !dados.length) {
        renderLista();
      }
    });

    details.appendChild(summary);

    details.appendChild(corpo);

    return details;
  }

  // ============================================================
  // IMAGENS - CONVERTER / REDIMENSIONAR
  // ============================================================

  function criarSubmoduloConverterImagem() {
    const details = el("details", "submodulo");

    details.dataset.submodulo = "converter";

    const summary = el("summary", "", "Converter / redimensionar");

    const corpo = el("div", "submodulo-corpo");

    corpo.appendChild(el("div", "texto-pequeno", "Selecione uma ou várias imagens. O processamento é feito localmente no navegador."));

    const arquivosInfo = el("div", "info", "Nenhuma imagem selecionada.");

    const selecionar = el("button", "botao-secundario", "Selecionar imagens");

    let arquivos = [];

    selecionar.onclick = async function () {
      arquivos = await criarInputArquivoImagem(true);

      arquivosInfo.textContent = arquivos.length ? arquivos.map((arquivo) => arquivo.name).join("\n") : "Nenhuma imagem selecionada.";
    };

    const labelFormato = el("label", "label", "Formato de saída");

    const formato = el("select", "campo");

    [
      ["png", "PNG"],
      ["jpg", "JPG"],
      ["webp", "WebP"],
    ].forEach(([valor, texto]) => {
      const option = el("option", "", texto);

      option.value = valor;

      formato.appendChild(option);
    });

    const linhaDim = el("div", "linha");

    const boxLargura = el("div", "flex1");

    const largura = el("input", "campo");

    largura.type = "number";

    largura.min = "1";

    largura.placeholder = "Original";

    boxLargura.appendChild(el("label", "label", "Largura (px)"));

    boxLargura.appendChild(largura);

    const boxAltura = el("div", "flex1");

    const altura = el("input", "campo");

    altura.type = "number";

    altura.min = "1";

    altura.placeholder = "Original";

    boxAltura.appendChild(el("label", "label", "Altura (px)"));

    boxAltura.appendChild(altura);

    linhaDim.appendChild(boxLargura);

    linhaDim.appendChild(boxAltura);

    const manterLabel = el("label", "check-modulo");

    const manter = el("input");

    manter.type = "checkbox";

    manter.checked = true;

    manterLabel.appendChild(manter);

    manterLabel.appendChild(el("span", "", "Manter proporção"));

    const percentualLabel = el("label", "label", "Escala (%) — opcional");

    const percentual = el("input", "campo");

    percentual.type = "number";

    percentual.min = "1";

    percentual.max = "1000";

    percentual.placeholder = "Ex.: 50";

    const qualidadeLabel = el("label", "label", "Qualidade JPG/WebP (%)");

    const qualidade = el("input", "campo");

    qualidade.type = "number";

    qualidade.min = "1";

    qualidade.max = "100";

    qualidade.value = "92";

    const prefixoLabel = el("label", "label", "Prefixo do nome — opcional");

    const prefixo = el("input", "campo");

    prefixo.placeholder = "Ex.: REDIMENSIONADA - ";

    const processar = el("button", "botao btn-blue", "Processar e baixar");

    processar.onclick = async function () {
      if (!arquivos.length) {
        definirStatus("Selecione pelo menos uma imagem.", "erro");

        return;
      }

      const larguraInformada = Number(largura.value) || 0;

      const alturaInformada = Number(altura.value) || 0;

      const escala = Number(percentual.value) || 0;

      const q = Math.min(100, Math.max(1, Number(qualidade.value) || 92)) / 100;

      processar.disabled = true;

      try {
        for (let i = 0; i < arquivos.length; i++) {
          const arquivo = arquivos[i];

          definirStatus(`Processando ${i + 1}/${arquivos.length}: ${arquivo.name}`);

          const img = await carregarImagemDeBlob(arquivo);

          let larguraFinal = img.naturalWidth;

          let alturaFinal = img.naturalHeight;

          if (escala > 0) {
            larguraFinal = Math.max(1, Math.round((larguraFinal * escala) / 100));

            alturaFinal = Math.max(1, Math.round((alturaFinal * escala) / 100));
          } else if (larguraInformada || alturaInformada) {
            if (manter.checked) {
              if (larguraInformada && !alturaInformada) {
                larguraFinal = larguraInformada;

                alturaFinal = Math.max(1, Math.round((img.naturalHeight * larguraFinal) / img.naturalWidth));
              } else if (alturaInformada && !larguraInformada) {
                alturaFinal = alturaInformada;

                larguraFinal = Math.max(1, Math.round((img.naturalWidth * alturaFinal) / img.naturalHeight));
              } else if (larguraInformada && alturaInformada) {
                const escalaBox = Math.min(larguraInformada / img.naturalWidth, alturaInformada / img.naturalHeight);

                larguraFinal = Math.max(1, Math.round(img.naturalWidth * escalaBox));

                alturaFinal = Math.max(1, Math.round(img.naturalHeight * escalaBox));
              }
            } else {
              larguraFinal = larguraInformada || larguraFinal;

              alturaFinal = alturaInformada || alturaFinal;
            }
          }

          const canvas = document.createElement("canvas");

          canvas.width = larguraFinal;

          canvas.height = alturaFinal;

          const ctx = canvas.getContext("2d", {
            alpha: formato.value !== "jpg",
          });

          if (formato.value === "jpg") {
            ctx.fillStyle = "#ffffff";

            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          ctx.imageSmoothingEnabled = true;

          ctx.imageSmoothingQuality = "high";

          ctx.drawImage(img, 0, 0, larguraFinal, alturaFinal);

          const blob = await canvasParaBlob(canvas, mimeImagemSaida(formato.value), q);

          const nomeBase = trocarExtensaoImagem(arquivo.name, formato.value);

          const nomeFinal = limparParteNome(`${prefixo.value || ""}${nomeBase}`);

          baixarBlob(blob, nomeFinal);

          await new Promise((resolve) => setTimeout(resolve, 120));
        }

        definirStatus(`${arquivos.length} imagem(ns) processada(s).`, "ok");
      } catch (e) {
        erro(e);

        definirStatus(e.message || "Erro ao processar imagens.", "erro");
      } finally {
        processar.disabled = false;
      }
    };

    corpo.appendChild(selecionar);

    corpo.appendChild(arquivosInfo);

    corpo.appendChild(labelFormato);

    corpo.appendChild(formato);

    corpo.appendChild(linhaDim);

    corpo.appendChild(manterLabel);

    corpo.appendChild(percentualLabel);

    corpo.appendChild(percentual);

    corpo.appendChild(qualidadeLabel);

    corpo.appendChild(qualidade);

    corpo.appendChild(prefixoLabel);

    corpo.appendChild(prefixo);

    corpo.appendChild(processar);

    details.appendChild(summary);

    details.appendChild(corpo);

    return details;
  }

  // ============================================================
  // IMAGENS - JUNTAR
  // ============================================================

  function criarSubmoduloJuntarImagens() {
    const details = el("details", "submodulo");

    details.dataset.submodulo = "juntar";

    const summary = el("summary", "", "Juntar imagens");

    const corpo = el("div", "submodulo-corpo");

    corpo.appendChild(el("div", "texto-pequeno", "Selecione duas ou mais imagens, reordene e gere uma única imagem vertical ou horizontal."));

    let arquivos = [];

    const fila = el("div");

    const selecionar = el("button", "botao-secundario", "Selecionar imagens");

    function renderFila() {
      fila.replaceChildren();

      if (!arquivos.length) {
        fila.appendChild(el("div", "info", "Nenhuma imagem selecionada."));

        return;
      }

      arquivos.forEach((arquivo, indice) => {
        const linha = el("div", "imagem-fila-item");

        const thumb = el("img", "imagem-fila-thumb");

        const url = URL.createObjectURL(arquivo);

        thumb.src = url;

        thumb.onload = () => URL.revokeObjectURL(url);

        const nome = el("div", "imagem-fila-nome", arquivo.name);

        const cima = el("button", "mini-botao", "↑");

        const baixo = el("button", "mini-botao", "↓");

        const remover = el("button", "mini-botao", "×");

        cima.disabled = indice === 0;

        baixo.disabled = indice === arquivos.length - 1;

        cima.onclick = function () {
          if (indice <= 0) {
            return;
          }

          [arquivos[indice - 1], arquivos[indice]] = [arquivos[indice], arquivos[indice - 1]];

          renderFila();
        };

        baixo.onclick = function () {
          if (indice >= arquivos.length - 1) {
            return;
          }

          [arquivos[indice], arquivos[indice + 1]] = [arquivos[indice + 1], arquivos[indice]];

          renderFila();
        };

        remover.onclick = function () {
          arquivos.splice(indice, 1);

          renderFila();
        };

        linha.appendChild(thumb);

        linha.appendChild(nome);

        linha.appendChild(cima);

        linha.appendChild(baixo);

        linha.appendChild(remover);

        fila.appendChild(linha);
      });
    }

    selecionar.onclick = async function () {
      const escolhidos = await criarInputArquivoImagem(true);

      if (escolhidos.length) {
        arquivos.push(...escolhidos);

        renderFila();
      }
    };

    renderFila();

    const linhaConfig = el("div", "linha");

    const boxOrientacao = el("div", "flex1");

    const orientacao = el("select", "campo");

    [
      ["vertical", "Vertical"],
      ["horizontal", "Horizontal"],
    ].forEach(([valor, texto]) => {
      const option = el("option", "", texto);

      option.value = valor;

      orientacao.appendChild(option);
    });

    boxOrientacao.appendChild(el("label", "label", "Orientação"));

    boxOrientacao.appendChild(orientacao);

    const boxEspaco = el("div", "flex1");

    const espaco = el("input", "campo");

    espaco.type = "number";

    espaco.min = "0";

    espaco.max = "500";

    espaco.value = "0";

    boxEspaco.appendChild(el("label", "label", "Espaço (px)"));

    boxEspaco.appendChild(espaco);

    linhaConfig.appendChild(boxOrientacao);

    linhaConfig.appendChild(boxEspaco);

    const linhaSaida = el("div", "linha");

    const boxFormato = el("div", "flex1");

    const formato = el("select", "campo");

    [
      ["png", "PNG"],
      ["jpg", "JPG"],
      ["webp", "WebP"],
    ].forEach(([valor, texto]) => {
      const option = el("option", "", texto);

      option.value = valor;

      formato.appendChild(option);
    });

    boxFormato.appendChild(el("label", "label", "Formato"));

    boxFormato.appendChild(formato);

    const boxQualidade = el("div", "flex1");

    const qualidade = el("input", "campo");

    qualidade.type = "number";

    qualidade.min = "1";

    qualidade.max = "100";

    qualidade.value = "92";

    boxQualidade.appendChild(el("label", "label", "Qualidade (%)"));

    boxQualidade.appendChild(qualidade);

    linhaSaida.appendChild(boxFormato);

    linhaSaida.appendChild(boxQualidade);

    const nomeLabel = el("label", "label", "Nome do arquivo");

    const nome = el("input", "campo");

    nome.value = "IMAGENS JUNTAS";

    const gerar = el("button", "botao btn-purple", "Juntar e baixar");

    gerar.onclick = async function () {
      if (arquivos.length < 2) {
        definirStatus("Selecione pelo menos duas imagens.", "erro");

        return;
      }

      gerar.disabled = true;

      try {
        definirStatus("Carregando imagens...");

        const imagens = [];

        for (const arquivo of arquivos) {
          imagens.push(await carregarImagemDeBlob(arquivo));
        }

        const gap = Math.max(0, Number(espaco.value) || 0);

        let larguraCanvas = 0;

        let alturaCanvas = 0;

        if (orientacao.value === "horizontal") {
          larguraCanvas = imagens.reduce((total, img) => total + img.naturalWidth, 0) + gap * (imagens.length - 1);

          alturaCanvas = Math.max(...imagens.map((img) => img.naturalHeight));
        } else {
          larguraCanvas = Math.max(...imagens.map((img) => img.naturalWidth));

          alturaCanvas = imagens.reduce((total, img) => total + img.naturalHeight, 0) + gap * (imagens.length - 1);
        }

        const limiteDimensao = 32767;

        if (larguraCanvas > limiteDimensao || alturaCanvas > limiteDimensao) {
          throw new Error(`Resultado muito grande (${larguraCanvas}×${alturaCanvas}px). Reduza as imagens antes de juntar.`);
        }

        const canvas = document.createElement("canvas");

        canvas.width = larguraCanvas;

        canvas.height = alturaCanvas;

        const ctx = canvas.getContext("2d", {
          alpha: formato.value !== "jpg",
        });

        if (formato.value === "jpg") {
          ctx.fillStyle = "#ffffff";

          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        let x = 0;

        let y = 0;

        imagens.forEach((img) => {
          ctx.drawImage(img, x, y);

          if (orientacao.value === "horizontal") {
            x += img.naturalWidth + gap;
          } else {
            y += img.naturalHeight + gap;
          }
        });

        const q = Math.min(100, Math.max(1, Number(qualidade.value) || 92)) / 100;

        definirStatus("Gerando arquivo final...");

        const blob = await canvasParaBlob(canvas, mimeImagemSaida(formato.value), q);

        baixarBlob(blob, trocarExtensaoImagem(nome.value || "IMAGENS JUNTAS", formato.value));

        definirStatus(`Imagem gerada: ${larguraCanvas} × ${alturaCanvas}px.`, "ok");
      } catch (e) {
        erro(e);

        definirStatus(e.message || "Erro ao juntar imagens.", "erro");
      } finally {
        gerar.disabled = false;
      }
    };

    corpo.appendChild(selecionar);

    corpo.appendChild(fila);

    corpo.appendChild(linhaConfig);

    corpo.appendChild(linhaSaida);

    corpo.appendChild(nomeLabel);

    corpo.appendChild(nome);

    corpo.appendChild(gerar);

    details.appendChild(summary);

    details.appendChild(corpo);

    return details;
  }

  // ============================================================
  // MÓDULO IMAGENS
  // ============================================================

  function criarModuloImagens() {
    const details = el("details", "modulo-principal");

    details.dataset.modulo = "imagens";

    const summary = el("summary", "", "Imagens");

    const corpo = el("div", "modulo-corpo");

    const pagina = criarSubmoduloImagensPagina();

    const converter = criarSubmoduloConverterImagem();

    const juntar = criarSubmoduloJuntarImagens();

    configurarAccordionPersistente([pagina, converter, juntar], STORAGE_IMAGENS_SUBMODULO_ABERTO, "submodulo");

    corpo.appendChild(pagina);

    corpo.appendChild(converter);

    corpo.appendChild(juntar);

    details.appendChild(summary);

    details.appendChild(corpo);

    return details;
  }

  // ============================================================
  // MÓDULO PÁGINA — v1.5.0
  // ============================================================
  const STORAGE_PAGINA_SUBMODULO_ABERTO = "FAUSTO_TOOLKIT_PAGINA_SUBMODULO_ABERTO";
  const paginaEstado = { selecionado: null, pararSeletor: null, desfazer: [], captura: null, closeOriginal: null };

  function paginaInterno(no) {
    return paginaEhElemento(no) && (no.id === "fausto-toolkit-host" || no.closest("#fausto-toolkit-host,[data-ft-pagina-overlay]") || no.getRootNode() === shadow);
  }

  function paginaElementos(selector) {
    return Array.from(document.querySelectorAll(selector)).filter((no) => !paginaInterno(no));
  }

  function paginaTexto(no) {
    return (no.innerText ?? no.textContent ?? "").trim();
  }

  async function paginaCopiar(texto) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard indisponível");
      await navigator.clipboard.writeText(String(texto));
    } catch {
      const area = el("textarea");
      area.value = String(texto);
      area.style.cssText = "position:fixed;left:0;top:0;opacity:0";
      (shadow || document.body).appendChild(area);
      const foco = shadow?.activeElement || document.activeElement;
      area.focus();
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } finally {
        area.remove();
        foco?.focus?.();
      }
      if (!ok) throw new Error("Não foi possível copiar. Use o resultado exibido para copiar manualmente.");
    }
    definirStatus("Copiado.", "ok");
  }

  function paginaBaixarTexto(texto, nome, mime = "text/plain;charset=utf-8") {
    baixarBlob(new Blob([texto], { type: mime }), nome);
    definirStatus("Arquivo gerado.", "ok");
  }

  function paginaBotao(pai, texto, acao, classe = "botao-secundario") {
    const botao = el("button", classe, texto);
    botao.type = "button";
    botao.addEventListener("click", async () => {
      botao.disabled = true;
      const inicioDesfazer = paginaEstado.desfazer.length;
      try {
        await acao();
      } catch (erro) {
        definirStatus(erro.message || String(erro), "erro");
      } finally {
        if (paginaEstado.desfazer.length > inicioDesfazer + 1) {
          const grupo = paginaEstado.desfazer.splice(inicioDesfazer);
          paginaEstado.desfazer.push(() =>
            grupo
              .slice()
              .reverse()
              .forEach((acao) => acao()),
          );
        }
        botao.disabled = false;
      }
    });
    pai.appendChild(botao);
    return botao;
  }

  function paginaCampo(pai, titulo, tipo = "text", valor = "") {
    const label = el("label", "texto-pequeno", titulo);
    const input = el("input", "campo");
    input.type = tipo;
    input.value = valor;
    input.style.cssText = "box-sizing:border-box;width:100%;margin:4px 0 8px;padding:7px";
    label.appendChild(input);
    pai.appendChild(label);
    return input;
  }

  function paginaSelect(pai, titulo, opcoes) {
    const label = el("label", "texto-pequeno", titulo);
    const select = el("select", "campo");
    select.style.cssText = "width:100%;margin:4px 0 8px;padding:7px";
    for (const [valor, texto] of opcoes) {
      const option = el("option", "", texto);
      option.value = valor;
      select.appendChild(option);
    }
    label.appendChild(select);
    pai.appendChild(label);
    return select;
  }

  function paginaResultado(pai) {
    const area = el("textarea");
    area.readOnly = true;
    area.setAttribute("aria-label", "Resultado");
    area.style.cssText = "box-sizing:border-box;width:100%;height:150px;font:11px monospace;padding:6px;margin:6px 0;resize:vertical";
    pai.appendChild(area);
    return area;
  }

  function paginaSubmodulo(chave, titulo) {
    const details = el("details", "submodulo");
    details.dataset.submodulo = chave;
    details.appendChild(el("summary", "", titulo));
    const corpo = el("div", "submodulo-corpo");
    details.appendChild(corpo);
    return { details, corpo };
  }

  function paginaCss(no) {
    const doc = no.ownerDocument;
    const esc = (valor) => window.CSS.escape(valor);
    if (no.id) {
      const id = "#" + esc(no.id);
      if (doc.querySelectorAll(id).length === 1) return id;
    }
    const partes = [];
    for (let atual = no; paginaEhElemento(atual); atual = atual.parentElement) {
      let parte = atual.localName;
      if (atual.id && doc.querySelectorAll("#" + esc(atual.id)).length === 1) {
        partes.unshift("#" + esc(atual.id));
        break;
      }
      const irmaos = atual.parentElement ? Array.from(atual.parentElement.children).filter((x) => x.localName === atual.localName) : [];
      if (irmaos.length > 1) parte += ":nth-of-type(" + (irmaos.indexOf(atual) + 1) + ")";
      partes.unshift(parte);
    }
    return partes.join(" > ");
  }

  function paginaXpath(no) {
    const partes = [];
    for (let atual = no; paginaEhElemento(atual); atual = atual.parentElement) {
      const irmaos = atual.parentElement ? Array.from(atual.parentElement.children).filter((x) => x.localName === atual.localName) : [atual];
      partes.unshift("*[local-name()=" + JSON.stringify(atual.localName) + "][" + (irmaos.indexOf(atual) + 1) + "]");
    }
    return "/" + partes.join("/");
  }

  function paginaInspecionar(no) {
    const css = paginaCss(no);
    const contexto = paginaExpressaoDocumento(no.ownerDocument);
    const seletorCodigo = contexto.codigo + ".querySelector(" + JSON.stringify(css) + ")";
    return {
      documento: no.ownerDocument.URL,
      executarNoConsoleDoFrame: contexto.consoleFrame,
      tag: no.localName,
      id: no.id,
      classes: no.getAttribute("class") || "",
      texto: paginaTexto(no).slice(0, 20000),
      href: no.getAttribute("href"),
      src: no.getAttribute("src"),
      atributos: Object.fromEntries(Array.from(no.attributes).map((a) => [a.name, a.value])),
      css,
      xpath: paginaXpath(no),
      querySelector: seletorCodigo,
      clicar: "const elemento = " + seletorCodigo + ";\nelemento?.click();",
      preencher: "const campo = " + seletorCodigo + ';\nif (campo) {\n  campo.value = "VALOR";\n  campo.dispatchEvent(new Event("input", { bubbles: true }));\n  campo.dispatchEvent(new Event("change", { bubbles: true }));\n}',
      html: no.outerHTML.slice(0, 200000),
    };
  }

  function criarPaginaSeletor() {
    const { details, corpo } = paginaSubmodulo("seletor", "Selecionar elemento");
    corpo.appendChild(el("div", "info", "Selecione o documento de trabalho acima e clique dentro dele. CSS/XPath são relativos ao documento indicado no resultado. Para outro domínio, execute o código copiado no contexto desse iframe no DevTools. Esc cancela."));
    let dados = null,
      contextoDados = null;
    paginaBotao(
      corpo,
      "Selecionar na página",
      () =>
        paginaSelecionar((resultado) => {
          dados = resultado;
          contextoDados = ftFrame.contexto;
          area.value = JSON.stringify(dados, null, 2);
        }),
      "botao btn-blue",
    );
    paginaBotao(corpo, "Cancelar seleção", () => paginaEstado.pararSeletor?.());
    const area = paginaResultado(corpo);
    for (const [chave, titulo] of [
      ["css", "Copiar seletor CSS"],
      ["xpath", "Copiar XPath"],
      ["html", "Copiar HTML"],
      ["querySelector", "Copiar querySelector"],
      ["clicar", "Copiar código para clicar"],
      ["preencher", "Copiar código para preencher"],
    ]) {
      paginaBotao(corpo, titulo, () => {
        if (!dados || contextoDados !== ftFrame.contexto) throw new Error("Selecione um elemento no documento atual primeiro.");
        return paginaCopiar(dados[chave]);
      });
    }
    paginaBotao(corpo, "Copiar todas as informações", () => paginaCopiar(area.value));
    return details;
  }

  function paginaTextoVisivel(doc = document) {
    if (!doc.body) return "";
    const copia = doc.body.cloneNode(true);
    const originais = doc.body.querySelectorAll("*");
    const clones = copia.querySelectorAll("*");
    for (let i = originais.length - 1; i >= 0; i--) {
      const original = originais[i],
        clone = clones[i];
      const css = doc.defaultView.getComputedStyle(original);
      if (paginaInterno(original) || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(original.tagName) || css.display === "none" || css.visibility === "hidden" || css.visibility === "collapse") clone.remove();
      else if (["BR", "P", "DIV", "LI", "TR", "H1", "H2", "H3", "SECTION", "ARTICLE"].includes(original.tagName)) clone.appendChild(doc.createTextNode("\n"));
    }
    return (copia.textContent || "")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function criarPaginaExtrair() {
    const { details, corpo } = paginaSubmodulo("extrair", "Extrair conteúdo");
    corpo.appendChild(el("div", "info", "Extrai o conteúdo do documento de trabalho escolhido acima. Outros frames e conteúdo ainda não carregado não entram automaticamente. CPF/CNPJ/telefones são candidatos, sem validação."));
    const tipo = paginaSelect(corpo, "Conteúdo", [
      ["texto", "Texto visível"],
      ["selecao", "Texto selecionado"],
      ["emails", "E-mails"],
      ["telefones", "Telefones"],
      ["cpf", "CPF"],
      ["cnpj", "CNPJ"],
    ]);
    paginaBotao(
      corpo,
      "Extrair",
      async () => {
        area.value = await paginaExecutar("extrair", { tipo: tipo.value });
        definirStatus(area.value ? "Conteúdo extraído." : "Nenhum resultado.");
      },
      "botao btn-blue",
    );
    const area = paginaResultado(corpo);
    paginaBotao(corpo, "Copiar resultado", () => paginaCopiar(area.value));
    paginaBotao(corpo, "Baixar TXT", () => paginaBaixarTexto(area.value, "pagina-" + tipo.value + ".txt"));
    return details;
  }

  function paginaTabelaGrade(tabela) {
    const linhas = Array.from(tabela.rows).filter((l) => l.closest("table") === tabela);
    const grade = [];
    if (linhas.length > 20000) throw new Error("Tabela excede 20.000 linhas.");
    linhas.forEach((linha, r) => {
      grade[r] ||= [];
      let c = 0;
      for (const celula of linha.cells) {
        while (grade[r][c] !== undefined) c++;
        const altura = celula.rowSpan === 0 ? linhas.length - r : Math.max(1, celula.rowSpan);
        const largura = Math.max(1, celula.colSpan);
        if (c + largura > 1000 || altura > 20000) throw new Error("Tabela excede o limite de expansão.");
        const texto = paginaTexto(celula);
        for (let rr = r; rr < Math.min(r + altura, linhas.length); rr++) {
          grade[rr] ||= [];
          for (let cc = c; cc < c + largura; cc++) grade[rr][cc] = rr === r && cc === c ? texto : "";
        }
        c += largura;
      }
    });
    const largura = Math.max(0, ...grade.map((l) => l.length));
    return grade.map((l) => Array.from({ length: largura }, (_, c) => l[c] ?? ""));
  }

  function paginaTabelaFormato(grade, formato) {
    // Evita execução de fórmulas quando o CSV/TSV é aberto em planilhas.
    const segura = (valor) => (/^[\s]*[=+@-]/.test(valor) ? "'" + valor : valor);
    if (formato === "csv") return grade.map((l) => l.map((v) => '"' + segura(v).replace(/"/g, '""') + '"').join(";")).join("\r\n");
    if (formato === "tsv") return grade.map((l) => l.map((v) => segura(v).replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
    const linha = (l) => "| " + l.map((v) => v.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ")).join(" | ") + " |";
    return grade.length ? [linha(grade[0]), linha(grade[0].map(() => "---")), ...grade.slice(1).map(linha)].join("\n") : "";
  }

  function criarPaginaTabelas() {
    const { details, corpo } = paginaSubmodulo("tabelas", "Tabelas");
    corpo.appendChild(el("div", "info", "Detecta tabelas HTML no documento escolhido. Células mescladas são expandidas com espaços vazios. A primeira linha vira cabeçalho no Markdown."));
    const lista = el("div");
    let selecionada = null,
      contextoTabela = null;
    const atualizar = async () => {
      const contexto = ftFrame.contexto,
        tabelas = await paginaExecutar("tabelas");
      if (ftFrame.contexto !== contexto) return;
      lista.replaceChildren();
      selecionada = null;
      contextoTabela = contexto;
      for (const tabela of tabelas)
        paginaBotao(lista, "Tabela " + tabela.numero + " — " + tabela.linhas + " linhas", async () => {
          if (ftFrame.contexto !== contextoTabela) throw new Error("O documento mudou. Atualize a lista de tabelas.");
          selecionada = tabela.id;
          area.value = await paginaExecutar("tabela", { id: selecionada, formato: formato.value });
          definirStatus("Tabela " + tabela.numero + " selecionada.");
        });
      if (!tabelas.length) lista.appendChild(el("div", "info", "Nenhuma tabela HTML encontrada."));
    };
    paginaBotao(corpo, "Atualizar tabelas", atualizar, "botao btn-blue");
    corpo.appendChild(lista);
    const formato = paginaSelect(corpo, "Formato", [
      ["csv", "CSV (separador ;)"],
      ["tsv", "TSV (Excel)"],
      ["md", "Markdown"],
    ]);
    const area = paginaResultado(corpo);
    const gerar = async () => {
      if (!selecionada || contextoTabela !== ftFrame.contexto) throw new Error("Atualize as tabelas e selecione uma do documento atual.");
      area.value = await paginaExecutar("tabela", { id: selecionada, formato: formato.value });
      return area.value;
    };
    formato.addEventListener("change", () => {
      if (selecionada) gerar().catch((e) => definirStatus(e.message, "erro"));
    });
    paginaBotao(corpo, "Copiar tabela", async () => paginaCopiar(await gerar()));
    paginaBotao(corpo, "Baixar tabela", async () => paginaBaixarTexto((formato.value === "csv" ? "\uFEFF" : "") + (await gerar()), "tabela." + formato.value));
    return details;
  }

  function criarPaginaLinks() {
    const { details, corpo } = paginaSubmodulo("links", "Links");
    const filtro = paginaSelect(corpo, "Filtro", [
      ["todos", "Todos os links"],
      ["externos", "Links externos"],
      ["downloads", "Downloads (atributo/extensão)"],
    ]);
    const lista = el("div");
    lista.style.cssText = "max-height:240px;overflow:auto";
    let itens = [],
      contextoLinks = null;
    const atualizar = async () => {
      const contexto = ftFrame.contexto,
        links = await paginaExecutar("links", { filtro: filtro.value });
      if (contexto !== ftFrame.contexto) return;
      lista.replaceChildren();
      itens = [];
      contextoLinks = contexto;
      for (const link of links) {
        const label = el("label", "info");
        label.style.display = "block";
        const check = el("input");
        check.type = "checkbox";
        label.append(check, document.createTextNode(" " + (link.texto || link.url) + "\n" + link.url));
        lista.appendChild(label);
        itens.push({ check, url: link.url });
      }
      definirStatus(itens.length + " links encontrados.");
    };
    paginaBotao(corpo, "Atualizar links", atualizar, "botao btn-blue");
    corpo.appendChild(lista);
    paginaBotao(corpo, "Selecionar todos", () => itens.forEach((i) => (i.check.checked = true)));
    paginaBotao(corpo, "Limpar seleção", () => itens.forEach((i) => (i.check.checked = false)));
    const selecionados = () => {
      if (contextoLinks !== ftFrame.contexto) throw new Error("Atualize os links do documento atual.");
      return itens.filter((i) => i.check.checked).map((i) => i.url);
    };
    paginaBotao(corpo, "Copiar selecionados", () => paginaCopiar(selecionados().join("\n")));
    paginaBotao(corpo, "Baixar lista TXT", () => paginaBaixarTexto(selecionados().join("\n"), "links.txt"));
    paginaBotao(corpo, "Abrir selecionados (até 10)", () => {
      const urls = selecionados().filter((u) => /^https?:/.test(u));
      if (!urls.length) throw new Error("Selecione links HTTP/HTTPS.");
      if (urls.length > 10) throw new Error("Selecione no máximo 10 links por vez.");
      let abertos = 0;
      for (const u of urls) {
        const aba = window.open("about:blank", "_blank");
        if (aba) {
          aba.opener = null;
          aba.location.href = u;
          abertos++;
        }
      }
      definirStatus(abertos + " abas abertas. O navegador pode bloquear múltiplas abas.");
    });
    filtro.addEventListener("change", () => atualizar().catch((e) => definirStatus(e.message, "erro")));
    return details;
  }

  function paginaMudarAtributo(no, nome, valor) {
    const anterior = no.getAttribute(nome);
    paginaEstado.desfazer.push(() => {
      if (anterior === null) no.removeAttribute(nome);
      else no.setAttribute(nome, anterior);
    });
    if (valor === null) no.removeAttribute(nome);
    else no.setAttribute(nome, valor);
  }

  function criarPaginaModificar() {
    const { details, corpo } = paginaSubmodulo("modificar", "Modificar página");
    corpo.appendChild(el("div", "info", "Mudanças locais no documento escolhido. Cada documento mantém seu próprio histórico para desfazer. Habilitar campos não altera permissões do servidor."));
    const info = el("div", "preview", "Nenhum elemento selecionado nesta área.");
    paginaBotao(
      corpo,
      "Selecionar elemento para modificar",
      () =>
        paginaSelecionar((dados) => {
          info.textContent = dados.documento + "\n" + dados.css;
        }),
      "botao btn-blue",
    );
    corpo.appendChild(info);
    for (const [tipo, titulo] of [
      ["ocultar", "Ocultar selecionado"],
      ["remover", "Remover selecionado"],
      ["editar", "Tornar selecionado editável"],
      ["habilitar", "Habilitar / retirar readonly do selecionado"],
      ["mostrar", "Mostrar selecionado oculto"],
    ])
      paginaBotao(corpo, titulo, async () => {
        await paginaExecutar("modificar", { tipo });
        definirStatus("Alteração aplicada no documento escolhido.", "ok");
      });
    const css = paginaCampo(corpo, "Selecionar oculto por CSS (ex.: #campo)");
    paginaBotao(corpo, "Selecionar pelo CSS informado", async () => {
      const dados = await paginaExecutar("selecionarCss", { css: css.value });
      info.textContent = dados.documento + "\n" + dados.css;
    });
    paginaBotao(corpo, "Pausar animações", () => paginaExecutar("modificar", { tipo: "pausar" }));
    paginaBotao(corpo, "Tentar impedir window.close()", async () => {
      await paginaExecutar("modificar", { tipo: "close" });
      definirStatus("Ativado nesse documento para futuras chamadas. Não cobre referências já salvas nem fechamento pelo navegador.");
    });
    paginaBotao(corpo, "Desfazer última alteração", async () => {
      await paginaExecutar("desfazer");
      definirStatus("Alteração desfeita nesse documento.", "ok");
    });
    paginaBotao(corpo, "Desfazer todas as alterações", async () => {
      await paginaExecutar("desfazerTudo");
      definirStatus("Alterações desse documento desfeitas.", "ok");
    });
    return details;
  }

  function criarPaginaCapturar() {
    const { details, corpo } = paginaSubmodulo("capturar", "Capturar");
    corpo.appendChild(
      el("div", "info", "Captura do documento escolhido via html2canvas, sem o Toolkit. Para um frame de outro domínio, abra-o em outra aba para capturar. CSS avançado, vídeos, iframes externos e imagens sem CORS podem ficar ausentes. Não carrega automaticamente conteúdo por rolagem."),
    );
    const formato = paginaSelect(corpo, "Formato", [
      ["image/png", "PNG"],
      ["image/jpeg", "JPG"],
    ]);
    const preview = el("img");
    preview.alt = "Prévia da captura";
    preview.style.cssText = "max-width:100%;max-height:220px;object-fit:contain;display:none";
    let urlPreview = null;
    const capturar = async (inteira) => {
      const contexto = paginaContexto();
      if (!contexto.doc) throw new Error("Para capturar esse iframe de outro domínio, use Abrir documento escolhido em nova aba e faça a captura lá.");
      const doc = contexto.doc,
        janela = doc.defaultView;
      if (typeof html2canvas !== "function") throw new Error("html2canvas não carregou. Verifique o @require no Tampermonkey.");
      definirStatus("Capturando…");
      const raiz = doc.documentElement;
      const width = inteira ? Math.max(raiz.scrollWidth, janela.innerWidth) : janela.innerWidth;
      const height = inteira ? Math.max(raiz.scrollHeight, janela.innerHeight) : janela.innerHeight;
      if (width > 32767 || height > 32767 || width * height > 40000000) throw new Error("Página muito grande. Capture a área visível ou um elemento.");
      const canvas = await html2canvas(raiz, {
        scale: 1,
        useCORS: true,
        allowTaint: false,
        logging: false,
        x: inteira ? 0 : janela.scrollX,
        y: inteira ? 0 : janela.scrollY,
        width,
        height,
        scrollX: janela.scrollX,
        scrollY: janela.scrollY,
        windowWidth: janela.innerWidth,
        windowHeight: janela.innerHeight,
        ignoreElements: (no) => no.id === "fausto-toolkit-host" || no.hasAttribute("data-ft-pagina-overlay"),
      });
      if (paginaContexto().doc !== doc) throw new Error("O documento mudou durante a captura. Repita.");
      paginaEstado.captura = canvas;
      if (urlPreview) URL.revokeObjectURL(urlPreview);
      urlPreview = URL.createObjectURL(await canvasParaBlob(canvas, "image/png"));
      preview.src = urlPreview;
      preview.style.display = "block";
      definirStatus("Captura pronta: " + canvas.width + " × " + canvas.height + ".", "ok");
    };
    paginaBotao(corpo, "Capturar área visível", () => capturar(false), "botao btn-blue");
    paginaBotao(corpo, "Capturar página inteira", () => capturar(true));
    corpo.appendChild(preview);
    paginaBotao(corpo, "Salvar captura", async () => {
      if (!paginaEstado.captura) throw new Error("Faça uma captura primeiro.");
      baixarBlob(await canvasParaBlob(paginaEstado.captura, formato.value, 0.92), "pagina-" + Date.now() + (formato.value === "image/png" ? ".png" : ".jpg"));
    });
    paginaBotao(corpo, "Copiar captura (PNG)", async () => {
      if (!paginaEstado.captura) throw new Error("Faça uma captura primeiro.");
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("Cópia de imagem indisponível neste navegador/contexto. Salve o arquivo.");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": canvasParaBlob(paginaEstado.captura, "image/png") })]);
      definirStatus("Imagem copiada.", "ok");
    });
    return details;
  }

  function criarPaginaDev() {
    const { details, corpo } = paginaSubmodulo("dev", "Storage / Dev");
    corpo.appendChild(el("div", "info", "Dados do documento/domínio escolhido. Cookies HttpOnly não são acessíveis. O resultado pode conter dados de sessão: revise antes de compartilhar. Limpar storage pode desconectar você."));
    const tipo = paginaSelect(corpo, "Informações", [
      ["iframes", "Iframes"],
      ["scripts", "Scripts carregados"],
      ["cookies", "Cookies acessíveis"],
      ["local", "localStorage"],
      ["session", "sessionStorage"],
    ]);
    paginaBotao(
      corpo,
      "Listar",
      async () => {
        area.value = JSON.stringify(await paginaExecutar("dev", { tipo: tipo.value }), null, 2);
      },
      "botao btn-blue",
    );
    const area = paginaResultado(corpo);
    paginaBotao(corpo, "Copiar resultado", () => paginaCopiar(area.value));
    paginaBotao(corpo, "Baixar JSON", () => paginaBaixarTexto(area.value, "pagina-" + tipo.value + ".json", "application/json"));
    paginaBotao(corpo, "Copiar URL completa", async () => paginaCopiar(await paginaExecutar("url")));
    paginaBotao(corpo, "Copiar URL sem parâmetros / fragmento", async () => {
      const url = new URL(await paginaExecutar("url"));
      url.search = "";
      url.hash = "";
      return paginaCopiar(url.href);
    });
    paginaBotao(corpo, "Recarregar página", () => paginaExecutar("recarregar"));
    corpo.appendChild(el("div", "info", "Recarregar atua no documento escolhido. Para ignorar o cache no Chrome/Windows, use Ctrl + Shift + R."));
    const limpar = paginaSelect(corpo, "Limpeza", [
      ["local", "Somente localStorage"],
      ["session", "Somente sessionStorage"],
      ["ambos", "localStorage e sessionStorage"],
    ]);
    paginaBotao(corpo, "Limpar storage escolhido…", async () => {
      const contexto = ftFrame.contexto,
        url = await paginaExecutar("url");
      if (!window.confirm("Limpar " + limpar.selectedOptions[0].textContent + " de " + new URL(url).origin + "? Isso pode encerrar a sessão e apagar preferências do site.")) return;
      if (ftFrame.contexto !== contexto) throw new Error("O documento mudou. Repita a operação.");
      await paginaExecutar("limparStorage", { tipo: limpar.value });
      area.value = "";
      definirStatus("Storage escolhido limpo.", "ok");
    });
    return details;
  }

  function criarModuloPagina() {
    const details = el("details", "modulo-principal");
    details.dataset.modulo = "pagina";
    details.appendChild(el("summary", "", "Página"));
    const corpo = el("div", "modulo-corpo");
    criarPaginaContextos(corpo);
    const submodulos = [criarPaginaCapturar(), criarPaginaSeletor(), criarPaginaExtrair(), criarPaginaTabelas(), criarPaginaLinks(), criarPaginaModificar(), criarPaginaDev()];
    configurarAccordionPersistente(submodulos, STORAGE_PAGINA_SUBMODULO_ABERTO, "submodulo");
    submodulos.forEach((s) => corpo.appendChild(s));
    details.appendChild(corpo);
    return details;
  }

  // ============================================================
  // MÓDULO ARQUIVOS — v1.6.0
  // ============================================================

  const ARQUIVOS_CATEGORIAS = [
    {
      pasta: "PDF",
      extensoes: ["pdf"],
    },
    {
      pasta: "Imagens",
      extensoes: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff", "heic", "heif", "svg", "ico"],
    },
    {
      pasta: "Documentos",
      extensoes: ["doc", "docx", "odt", "rtf", "txt", "pages"],
    },
    {
      pasta: "Planilhas",
      extensoes: ["xls", "xlsx", "xlsm", "xlsb", "csv", "ods", "numbers"],
    },
    {
      pasta: "Apresentações",
      extensoes: ["ppt", "pptx", "odp", "key"],
    },
    {
      pasta: "Compactados",
      extensoes: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"],
    },
    {
      pasta: "Áudios",
      extensoes: ["mp3", "wav", "m4a", "ogg", "oga", "flac", "aac", "wma"],
    },
    {
      pasta: "Vídeos",
      extensoes: ["mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv", "mpeg", "mpg"],
    },
    {
      pasta: "Instaladores",
      extensoes: ["exe", "msi", "msix", "appx"],
    },
  ];

  function arquivosExtensao(nome) {
    const indice = String(nome || "").lastIndexOf(".");

    if (indice <= 0 || indice === nome.length - 1) {
      return "";
    }

    return nome.substring(indice + 1).toLowerCase();
  }

  function arquivosCategoria(nome) {
    const extensao = arquivosExtensao(nome);

    for (const categoria of ARQUIVOS_CATEGORIAS) {
      if (categoria.extensoes.includes(extensao)) {
        return categoria.pasta;
      }
    }

    return "Outros";
  }

  function arquivosFormatarTamanho(bytes) {
    const numero = Number(bytes) || 0;

    if (numero < 1024) {
      return `${numero} B`;
    }

    if (numero < 1024 * 1024) {
      return `${(numero / 1024).toFixed(1)} KB`;
    }

    if (numero < 1024 * 1024 * 1024) {
      return `${(numero / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(numero / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  async function arquivosObterPastasMonitoradas() {
    const salvo = await obterDB(CHAVE_ARQUIVOS_PASTAS_MONITORADAS);

    return Array.isArray(salvo) ? salvo : [];
  }

  async function arquivosSalvarPastasMonitoradas(pastas) {
    await salvarDB(CHAVE_ARQUIVOS_PASTAS_MONITORADAS, pastas);
  }

  async function arquivosEscolherPasta(modo = "readwrite") {
    return await abrirSeletorDePasta(modo);
  }

  async function arquivosAdicionarPastaMonitorada() {
    const handle = await arquivosEscolherPasta("readwrite");

    const pastas = await arquivosObterPastasMonitoradas();

    for (const existente of pastas) {
      try {
        if (existente.handle && typeof existente.handle.isSameEntry === "function" && (await existente.handle.isSameEntry(handle))) {
          return {
            adicionada: false,

            pasta: existente,
          };
        }
      } catch {
        // Se não der para comparar, permite adicionar.
      }
    }

    const item = {
      id: globalThis.crypto?.randomUUID?.() || `pasta-${Date.now()}-${Math.random().toString(16).slice(2)}`,

      nome: handle.name,

      handle,
    };

    pastas.push(item);

    await arquivosSalvarPastasMonitoradas(pastas);

    return {
      adicionada: true,

      pasta: item,
    };
  }

  async function arquivosRemoverPastaMonitorada(id) {
    const pastas = await arquivosObterPastasMonitoradas();

    const novas = pastas.filter((item) => item.id !== id);

    await arquivosSalvarPastasMonitoradas(novas);
  }

  async function arquivosListarRaiz(pasta) {
    const resultado = [];

    for await (const entry of pasta.values()) {
      if (entry.kind !== "file") {
        continue;
      }

      let tamanho = 0;

      try {
        const arquivo = await entry.getFile();

        tamanho = arquivo.size;
      } catch {
        // O tamanho é apenas informativo.
      }

      resultado.push({
        handle: entry,

        nome: entry.name,

        categoria: arquivosCategoria(entry.name),

        tamanho,
      });
    }

    resultado.sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", {
        sensitivity: "base",
      }),
    );

    return resultado;
  }

  async function arquivosNomeDisponivel(pasta, nome) {
    if (!(await arquivoExiste(pasta, nome))) {
      return nome;
    }

    const indice = nome.lastIndexOf(".");

    const temExtensao = indice > 0;

    const base = temExtensao ? nome.substring(0, indice) : nome;

    const extensao = temExtensao ? nome.substring(indice) : "";

    for (let i = 1; i < 10000; i++) {
      const candidato = `${base} (${i})${extensao}`;

      if (!(await arquivoExiste(pasta, candidato))) {
        return candidato;
      }
    }

    throw new Error(`Não foi possível gerar um nome livre para "${nome}".`);
  }

  async function arquivosMoverUm(pastaOrigem, item) {
    const pastaDestino = await pastaOrigem.getDirectoryHandle(item.categoria, {
      create: true,
    });

    const nomeDestino = await arquivosNomeDisponivel(pastaDestino, item.nome);

    const origem = await item.handle.getFile();

    const destinoHandle = await pastaDestino.getFileHandle(nomeDestino, {
      create: true,
    });

    const writable = await destinoHandle.createWritable();

    try {
      await writable.write(origem);

      await writable.close();
    } catch (e) {
      try {
        await writable.abort();
      } catch {
        // ignora
      }

      throw e;
    }

    const destino = await destinoHandle.getFile();

    if (destino.size !== origem.size) {
      try {
        await pastaDestino.removeEntry(nomeDestino);
      } catch {
        // Mantém o original de qualquer forma.
      }

      throw new Error(`Falha ao verificar a cópia de "${item.nome}". O original foi preservado.`);
    }

    await pastaOrigem.removeEntry(item.nome);

    return {
      ...item,

      nomeDestino,

      pastaDestino: item.categoria,
    };
  }

  async function arquivosOrganizarPasta(pasta, { pedirConfirmacao = true } = {}) {
    const autorizado = await garantirPermissao(pasta, "readwrite");

    if (!autorizado) {
      throw new Error(`Sem permissão de escrita para a pasta "${pasta.name}".`);
    }

    const itens = await arquivosListarRaiz(pasta);

    if (!itens.length) {
      return {
        pasta: pasta.name,

        total: 0,

        movidos: [],

        falhas: [],
      };
    }

    if (pedirConfirmacao) {
      const resumo = {};

      for (const item of itens) {
        resumo[item.categoria] = (resumo[item.categoria] || 0) + 1;
      }

      const linhas = Object.entries(resumo)
        .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
        .map(([categoria, quantidade]) => `${categoria}: ${quantidade}`)
        .join("\n");

      if (!window.confirm(`Organizar ${itens.length} arquivo(s) de "${pasta.name}"?\n\n${linhas}\n\nSomente os arquivos soltos da raiz serão movidos.`)) {
        return null;
      }
    }

    const movidos = [];

    const falhas = [];

    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];

      definirStatus(`Organizando ${i + 1}/${itens.length}: ${item.nome}`);

      try {
        movidos.push(await arquivosMoverUm(pasta, item));
      } catch (e) {
        falhas.push({
          nome: item.nome,

          erro: e.message || String(e),
        });
      }
    }

    return {
      pasta: pasta.name,

      total: itens.length,

      movidos,

      falhas,
    };
  }

  function arquivosResumoResultado(resultados) {
    const validos = resultados.filter(Boolean);

    let total = 0;

    let movidos = 0;

    let falhas = 0;

    const linhas = [];

    for (const resultado of validos) {
      total += resultado.total;

      movidos += resultado.movidos.length;

      falhas += resultado.falhas.length;

      linhas.push(`${resultado.pasta}: ${resultado.movidos.length} movido(s)` + (resultado.falhas.length ? ` · ${resultado.falhas.length} falha(s)` : ""));
    }

    return {
      total,
      movidos,
      falhas,
      texto: linhas.join("\n"),
    };
  }

  function arquivosCriarPreview(lista) {
    const container = el("div", "arquivo-preview-lista");

    if (!lista.length) {
      container.appendChild(el("div", "arquivo-preview-item", "Nenhum arquivo solto encontrado nesta pasta."));

      return container;
    }

    for (const item of lista) {
      const linha = el("div", "arquivo-preview-item");

      const origem = el("div", "", `${item.nome} · ${arquivosFormatarTamanho(item.tamanho)}`);

      const destino = el("div", "arquivo-preview-destino", `→ ${item.categoria}\\${item.nome}`);

      linha.appendChild(origem);

      linha.appendChild(destino);

      container.appendChild(linha);
    }

    return container;
  }

  function arquivosSubmodulo(chave, titulo) {
    const details = el("details", "submodulo");

    details.dataset.submodulo = chave;

    details.appendChild(el("summary", "", titulo));

    const corpo = el("div", "submodulo-corpo");

    details.appendChild(corpo);

    return {
      details,
      corpo,
    };
  }

  function criarArquivosPastaEscolhida() {
    const { details, corpo } = arquivosSubmodulo("pasta-escolhida", "Organizar uma pasta");

    corpo.appendChild(el("div", "info", "Escolha uma pasta. O Toolkit analisa apenas os arquivos soltos da raiz e cria subpastas por tipo. Subpastas existentes não são alteradas."));

    const pastaInfo = el("div", "preview", "Nenhuma pasta selecionada.");

    const previewHost = el("div");

    let pastaAtual = null;

    let itensAtuais = [];

    const escolher = el("button", "botao btn-dark", "Escolher pasta");

    const organizar = el("button", "botao btn-green", "Organizar arquivos");

    organizar.disabled = true;

    escolher.onclick = async function () {
      try {
        pastaAtual = await arquivosEscolherPasta("readwrite");

        itensAtuais = await arquivosListarRaiz(pastaAtual);

        pastaInfo.textContent = `${pastaAtual.name} · ${itensAtuais.length} arquivo(s) solto(s)`;

        previewHost.replaceChildren(arquivosCriarPreview(itensAtuais));

        organizar.disabled = itensAtuais.length === 0;

        definirStatus("Pasta analisada.", "ok");
      } catch (e) {
        if (e.name !== "AbortError") {
          definirStatus(e.message, "erro");
        }
      }
    };

    organizar.onclick = async function () {
      if (!pastaAtual) {
        return;
      }

      organizar.disabled = true;

      try {
        const resultado = await arquivosOrganizarPasta(pastaAtual);

        if (!resultado) {
          return;
        }

        itensAtuais = await arquivosListarRaiz(pastaAtual);

        pastaInfo.textContent = `${pastaAtual.name} · ${itensAtuais.length} arquivo(s) solto(s)`;

        previewHost.replaceChildren(arquivosCriarPreview(itensAtuais));

        const resumo = arquivosResumoResultado([resultado]);

        definirStatus(resumo.falhas ? `${resumo.movidos} movido(s), ${resumo.falhas} falha(s).` : `${resumo.movidos} arquivo(s) organizado(s).`, resumo.falhas ? "erro" : "ok");
      } catch (e) {
        definirStatus(e.message || "Erro ao organizar arquivos.", "erro");
      } finally {
        organizar.disabled = itensAtuais.length === 0;
      }
    };

    corpo.appendChild(escolher);

    corpo.appendChild(pastaInfo);

    corpo.appendChild(previewHost);

    corpo.appendChild(organizar);

    return details;
  }

  async function criarArquivosPastasMonitoradas() {
    const { details, corpo } = arquivosSubmodulo("pastas-monitoradas", "Pastas monitoradas");

    corpo.appendChild(el("div", "info", 'Adicione somente as pastas que você quer deixar aptas à organização. Depois use "Organizar pastas monitoradas" para processar todas de uma vez. O navegador pode pedir novamente a permissão após reiniciar.'));

    const lista = el("div");

    const resumoPermissoes = el("div", "arquivo-resumo-permissoes", "Verificando permissões...");

    const adicionar = el("button", "botao btn-dark", "+ Adicionar pasta monitorada");

    async function renderizarPastas() {
      const pastas = await arquivosObterPastasMonitoradas();

      lista.replaceChildren();

      let prontas = 0;

      let precisamAutorizar = 0;

      let indisponiveis = 0;

      if (!pastas.length) {
        lista.appendChild(el("div", "preview", "Nenhuma pasta monitorada."));

        resumoPermissoes.textContent = "Nenhuma pasta monitorada.";

        return;
      }

      for (const item of pastas) {
        const estadoPermissao = item.handle ? await consultarPermissao(item.handle, "readwrite") : "indisponivel";

        if (estadoPermissao === "granted") {
          prontas++;
        } else if (estadoPermissao === "prompt") {
          precisamAutorizar++;
        } else {
          indisponiveis++;
        }

        const linha = el("div", "arquivo-padrao-linha");

        const info = el("div", "arquivo-padrao-info");

        info.appendChild(el("div", "arquivo-padrao-titulo", item.nome || item.handle?.name || "Pasta"));

        info.appendChild(el("div", "arquivo-padrao-caminho", item.handle?.name || "Pasta indisponível"));

        const permissao = el("div", "arquivo-permissao");

        if (estadoPermissao === "granted") {
          permissao.classList.add("ok");

          permissao.textContent = "● Pronta";
        } else if (estadoPermissao === "prompt") {
          permissao.classList.add("pendente");

          permissao.textContent = "● Precisa reautorizar";
        } else {
          permissao.classList.add("erro");

          permissao.textContent = "● Permissão indisponível";
        }

        info.appendChild(permissao);

        const testar = el("button", "arquivo-mini-btn", "Ver");

        testar.title = "Analisar arquivos soltos desta pasta";

        testar.onclick = async function () {
          try {
            if (!item.handle) {
              throw new Error("Pasta indisponível. Remova e adicione novamente.");
            }

            const autorizado = await garantirPermissao(item.handle, "readwrite");

            if (!autorizado) {
              throw new Error("Permissão não concedida.");
            }

            const arquivos = await arquivosListarRaiz(item.handle);

            const resumo = {};

            for (const arquivo of arquivos) {
              resumo[arquivo.categoria] = (resumo[arquivo.categoria] || 0) + 1;
            }

            const detalhes = Object.entries(resumo)
              .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
              .map(([categoria, quantidade]) => `${categoria}: ${quantidade}`)
              .join(" · ");

            definirStatus(arquivos.length ? `${item.handle.name}: ${arquivos.length} arquivo(s) solto(s)${detalhes ? ` · ${detalhes}` : ""}` : `${item.handle.name}: nenhum arquivo solto.`, "ok");
          } catch (e) {
            definirStatus(e.message, "erro");
          }
        };

        const remover = el("button", "arquivo-mini-btn", "×");

        remover.title = "Remover da lista de pastas monitoradas";

        remover.onclick = async function () {
          await arquivosRemoverPastaMonitorada(item.id);

          await renderizarPastas();

          definirStatus("Pasta removida da lista de monitoradas.", "ok");
        };

        linha.appendChild(info);

        linha.appendChild(testar);

        linha.appendChild(remover);

        lista.appendChild(linha);
      }

      const partes = [];

      partes.push(`${prontas} pronta(s)`);

      if (precisamAutorizar) {
        partes.push(`${precisamAutorizar} precisa(m) reautorizar`);
      }

      if (indisponiveis) {
        partes.push(`${indisponiveis} indisponível(is)`);
      }

      resumoPermissoes.textContent = partes.join(" · ");
    }

    adicionar.onclick = async function () {
      try {
        const resultado = await arquivosAdicionarPastaMonitorada();

        await renderizarPastas();

        definirStatus(resultado.adicionada ? `${resultado.pasta.handle.name} adicionada às pastas monitoradas.` : `${resultado.pasta.handle.name} já está nas pastas monitoradas.`, "ok");
      } catch (e) {
        if (e.name !== "AbortError") {
          definirStatus(e.message, "erro");
        }
      }
    };

    await renderizarPastas();

    const organizarTodas = el("button", "botao btn-green", "Organizar pastas monitoradas");

    organizarTodas.onclick = async function () {
      organizarTodas.disabled = true;

      try {
        const pastas = await arquivosObterPastasMonitoradas();

        if (!pastas.length) {
          throw new Error("Adicione pelo menos uma pasta monitorada.");
        }

        const analises = [];

        const precisamAutorizar = [];

        for (const item of pastas) {
          if (!item.handle) {
            continue;
          }

          const estado = await consultarPermissao(item.handle, "readwrite");

          if (estado !== "granted") {
            precisamAutorizar.push(item);
          }
        }

        if (precisamAutorizar.length) {
          definirStatus(`${precisamAutorizar.length} pasta(s) precisa(m) de autorização.`);

          for (const item of precisamAutorizar) {
            const autorizado = await garantirPermissao(item.handle, "readwrite");

            if (!autorizado) {
              await renderizarPastas();

              throw new Error(`Permissão não concedida para "${item.nome || item.handle.name}".`);
            }
          }
        }

        for (const item of pastas) {
          if (!item.handle) {
            continue;
          }

          const arquivos = await arquivosListarRaiz(item.handle);

          analises.push({
            ...item,
            quantidade: arquivos.length,
          });
        }

        await renderizarPastas();

        const total = analises.reduce((soma, item) => soma + item.quantidade, 0);

        if (total === 0) {
          definirStatus("As pastas monitoradas já estão organizadas.", "ok");

          return;
        }

        const resultados = [];

        for (const item of analises) {
          if (item.quantidade === 0) {
            continue;
          }

          definirStatus(`Organizando ${item.nome || item.handle.name}...`);

          resultados.push(
            await arquivosOrganizarPasta(item.handle, {
              pedirConfirmacao: false,
            }),
          );
        }

        const final = arquivosResumoResultado(resultados);

        definirStatus(final.falhas ? `${final.movidos} movido(s), ${final.falhas} falha(s).` : `${final.movidos} arquivo(s) organizado(s) em ${resultados.length} pasta(s) monitorada(s).`, final.falhas ? "erro" : "ok");
      } catch (e) {
        definirStatus(e.message || "Erro ao organizar as pastas monitoradas.", "erro");
      } finally {
        organizarTodas.disabled = false;
      }
    };

    corpo.appendChild(resumoPermissoes);

    corpo.appendChild(adicionar);

    corpo.appendChild(lista);

    corpo.appendChild(organizarTodas);

    return details;
  }

  async function criarModuloArquivos() {
    const details = el("details", "modulo-principal");

    details.dataset.modulo = "arquivos";

    details.appendChild(el("summary", "", "Arquivos"));

    const corpo = el("div", "modulo-corpo");

    const pastaEscolhida = criarArquivosPastaEscolhida();

    const pastasMonitoradas = await criarArquivosPastasMonitoradas();

    configurarAccordionPersistente([pastaEscolhida, pastasMonitoradas], STORAGE_ARQUIVOS_SUBMODULO_ABERTO, "submodulo");

    corpo.appendChild(pastaEscolhida);

    corpo.appendChild(pastasMonitoradas);

    details.appendChild(corpo);

    return details;
  }

  // ============================================================
  // MÓDULO GMAIL — v1.7.0
  // ============================================================

  const GMAIL_PRESETS = {
    newsletters: {
      titulo: "Filtros automáticos",

      regras: [
        {
          nome: "Tokio Marine",

          remetente: "comunicacao@mail-tokiomarine.com.br",

          assuntos: null,
        },
        {
          nome: "Sicoob",

          remetente: "pravoce@campanhas.sicoob.com.br",

          assuntos: null,
        },
        {
          nome: "Zurich",

          remetente: "zurich@br.zurich.com",

          assuntos: null,
        },
        {
          nome: "HDI - Pagamentos",

          remetente: "hdi@informativohdi.com.br",

          assuntos: ["Confirmação de Pagamento de parcela", "Inclusão Dados de Pagamento", "Parcela do seu Seguro Hdi Auto Perfil"],
        },
        {
          nome: "Porto - Comissões",

          remetente: "schedulle.comissoes@portoseguro.com.br",

          assuntos: null,
        },
        {
          nome: "Porto - Financeiro",

          remetente: "financeiro@comunicados.portoseguro.com.br",

          assuntos: ["Tudo certo com seu pagamento"],
        },
        {
          nome: "Fator Seguradora - Marketing",

          remetente: "marketing@fatorseguradora.com.br",

          assuntos: null,
        },
        {
          nome: "Zurich Vida",

          remetente: "zurich.vida@br.zurich.com",

          assuntos: null,
        },
        {
          nome: "Allianz - Apólice Digital",

          remetente: "allianz@allianz.com.br",

          assuntos: ["Allianz Apólice Digital"],
        },
        {
          nome: "HDI - Apólice",

          remetente: "hdi@informativohdi.com.br",

          assuntos: ["Apólice HDI"],
        },
        {
          nome: "Yelum - Olá",

          remetente: "comunicacao.yelum@yelum.com.br",

          assuntos: ["Olá"],
        },
        {
          nome: "Seguros Unimed",

          remetente: "news@comunicacao.segurosunimed.com.br",

          assuntos: null,
        },
        {
          nome: "Porto - Apólice Auto",

          remetente: "auto@apoliceauto.portoseguro.com.br",

          assuntos: null,
        },
        {
          nome: "SulAmérica - Portal do Corretor",

          remetente: "portaldocorretor@sulamerica.com.br",

          assuntos: null,
        },
        {
          nome: "Agger",

          remetente: "naoresponda@agger.com.br",

          assuntos: null,
        },
        {
          nome: "HDI - Carta de Cobrança",

          remetente: "carta_cobranca@hdi.com.br",

          assuntos: null,
        },
      ],
    },
  };

  function gmailEscaparTermoBusca(valor) {
    return String(valor || "").replace(/"/g, '\\"');
  }

  function gmailMontarRegraBusca(regra) {
    const remetente = `from:(${regra.remetente})`;

    if (!Array.isArray(regra.assuntos) || !regra.assuntos.length) {
      return remetente;
    }

    const assuntos = regra.assuntos.map((assunto) => `subject:("${gmailEscaparTermoBusca(assunto)}")`).join(" OR ");

    return `(${remetente} (${assuntos}))`;
  }

  function gmailMontarBuscaRegras(regras) {
    const filtros = regras.map(gmailMontarRegraBusca).join(" OR ");

    return `(${filtros}) in:inbox`;
  }

  function gmailNormalizarTexto(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function gmailElementoVisivel(elemento) {
    if (!elemento || !elemento.isConnected) {
      return false;
    }

    const rect = elemento.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const style = getComputedStyle(elemento);

    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function gmailEncontrarPorAria(termos) {
    const normalizados = termos.map(gmailNormalizarTexto);

    const elementos = Array.from(document.querySelectorAll("[aria-label]"));

    return (
      elementos.find((elemento) => {
        if (!gmailElementoVisivel(elemento)) {
          return false;
        }

        const aria = gmailNormalizarTexto(elemento.getAttribute("aria-label"));

        return normalizados.some((termo) => aria === termo || aria.startsWith(`${termo} `) || aria.includes(termo));
      }) || null
    );
  }

  function gmailEsperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function gmailEsperarCondicao(teste, timeout = 10000, intervalo = 150) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
      try {
        const resultado = teste();

        if (resultado) {
          return resultado;
        }
      } catch {
        // continua tentando
      }

      await gmailEsperar(intervalo);
    }

    return null;
  }

  function gmailCaixaPesquisa() {
    const candidatos = ['input[name="q"]', 'input[placeholder="Pesquisar e-mail"]', 'input[aria-label="Pesquisar e-mail"]', 'input[placeholder="Search mail"]', 'input[aria-label="Search mail"]'];

    for (const seletor of candidatos) {
      const elemento = document.querySelector(seletor);

      if (gmailElementoVisivel(elemento)) {
        return elemento;
      }
    }

    return null;
  }

  function gmailDefinirValorInput(input, valor) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

    if (descriptor?.set) {
      descriptor.set.call(input, valor);
    } else {
      input.value = valor;
    }

    input.dispatchEvent(
      new Event("input", {
        bubbles: true,
      }),
    );

    input.dispatchEvent(
      new Event("change", {
        bubbles: true,
      }),
    );
  }

  async function gmailExecutarBusca(consulta) {
    const input = await gmailEsperarCondicao(gmailCaixaPesquisa, 10000);

    if (!input) {
      throw new Error("Não encontrei a caixa de pesquisa do Gmail.");
    }

    input.focus();

    gmailDefinirValorInput(input, consulta);

    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",

        code: "Enter",

        keyCode: 13,

        which: 13,

        bubbles: true,

        cancelable: true,
      }),
    );

    input.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Enter",

        code: "Enter",

        keyCode: 13,

        which: 13,

        bubbles: true,
      }),
    );

    const confirmado = await gmailEsperarCondicao(() => {
      const atual = gmailCaixaPesquisa();

      return atual && atual.value === consulta;
    }, 5000);

    if (!confirmado) {
      throw new Error("O Gmail não confirmou a pesquisa.");
    }

    await gmailEsperar(1200);
  }

  function gmailEncontrarSelecionarTodos() {
    // Gmail atual:
    // <div role="button" aria-label="Selecionar">
    //   <span role="checkbox" aria-checked="false">...</span>
    // </div>
    //
    // O clique mais confiável é no checkbox interno.

    const botaoSelecionar = Array.from(document.querySelectorAll('[role="button"][aria-label="Selecionar"], [role="button"][aria-label="Select"]')).find(gmailElementoVisivel);

    if (botaoSelecionar) {
      const checkbox = botaoSelecionar.querySelector('[role="checkbox"][aria-checked]');

      if (checkbox && gmailElementoVisivel(checkbox)) {
        return checkbox;
      }
    }

    // Fallback: checkbox visível fora das linhas de e-mail.
    const checkboxes = Array.from(document.querySelectorAll('[role="checkbox"][aria-checked]')).filter(gmailElementoVisivel);

    return checkboxes.find((elemento) => !elemento.closest("tr")) || null;
  }

  function gmailHaConversasSelecionadas() {
    const principal = gmailEncontrarSelecionarTodos();

    if (principal && principal.getAttribute("aria-checked") === "true") {
      return true;
    }

    // Em algumas versões do Gmail o checkbox não atualiza
    // imediatamente, mas a barra de ações já aparece.
    const acoesSelecao = [
      '[role="button"][aria-label="Arquivar"]',
      '[role="button"][aria-label="Archive"]',
      '[role="button"][aria-label="Marcar como lida"]',
      '[role="button"][aria-label="Mark as read"]',
      '[role="button"][aria-label="Marcar como não lida"]',
      '[role="button"][aria-label="Mark as unread"]',
    ];

    for (const seletor of acoesSelecao) {
      const elemento = Array.from(document.querySelectorAll(seletor)).find(gmailElementoVisivel);

      if (elemento) {
        return true;
      }
    }

    return false;
  }

  async function gmailSelecionarPagina() {
    if (gmailHaConversasSelecionadas()) {
      return true;
    }

    const selecionar = await gmailEsperarCondicao(gmailEncontrarSelecionarTodos, 8000, 100);

    if (!selecionar) {
      throw new Error('Não encontrei o checkbox "Selecionar" do Gmail.');
    }

    // Este foi o método que funcionou originalmente.
    selecionar.click();

    const selecionado = await gmailEsperarCondicao(gmailHaConversasSelecionadas, 8000, 100);

    if (!selecionado) {
      throw new Error("O Gmail não confirmou a seleção dos e-mails.");
    }

    await gmailEsperar(500);

    return true;
  }

  function gmailEncontrarAcaoPorIcone(trechosPath) {
    const paths = Array.from(document.querySelectorAll("svg path[d]"));

    for (const path of paths) {
      const d = path.getAttribute("d") || "";

      const confere = trechosPath.some((trecho) => d.includes(trecho));

      if (!confere) {
        continue;
      }

      const svg = path.closest("svg");

      if (!gmailElementoVisivel(svg)) {
        continue;
      }

      return gmailElementoClicavel(svg);
    }

    return null;
  }

  async function gmailCliqueReal(elemento) {
    if (!elemento) {
      return false;
    }

    const alvo = gmailElementoClicavel(elemento);

    try {
      alvo.scrollIntoView({
        block: "nearest",

        inline: "nearest",
      });
    } catch {
      // ignora
    }

    try {
      alvo.focus?.();
    } catch {
      // ignora
    }

    const rect = alvo.getBoundingClientRect();

    const clientX = rect.left + Math.max(1, rect.width / 2);

    const clientY = rect.top + Math.max(1, rect.height / 2);

    const eventos = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];

    for (const tipo of eventos) {
      let evento;

      if (tipo.startsWith("pointer") && typeof PointerEvent === "function") {
        evento = new PointerEvent(tipo, {
          bubbles: true,

          cancelable: true,

          composed: true,

          pointerType: "mouse",

          isPrimary: true,

          button: 0,

          buttons: tipo.endsWith("down") ? 1 : 0,

          clientX,
          clientY,
        });
      } else {
        evento = new MouseEvent(tipo, {
          bubbles: true,

          cancelable: true,

          composed: true,

          button: 0,

          buttons: tipo === "mousedown" ? 1 : 0,

          clientX,
          clientY,
        });
      }

      alvo.dispatchEvent(evento);
    }

    await gmailEsperar(350);

    return true;
  }

  function gmailEncontrarToolbarSelecao() {
    // Após selecionar mensagens, o Gmail exibe vários grupos irmãos:
    //
    // .G-tF
    //   ├─ grupo: Arquivar / Spam / Excluir
    //   ├─ grupo: Marcar como lida / não lida / Suspender...
    //   ├─ grupo: Marcadores...
    //   └─ ...
    //
    // Portanto precisamos do ancestral COMUM .G-tF, e não apenas
    // do grupo imediato onde está o botão Arquivar.

    const arquivar = Array.from(document.querySelectorAll('[role="button"][act="7"][aria-label="Arquivar"], [role="button"][act="7"][aria-label="Archive"]')).find(gmailElementoVisivel);

    if (!arquivar) {
      return null;
    }

    const toolbar = arquivar.closest(".G-tF");

    if (toolbar && gmailElementoVisivel(toolbar)) {
      return toolbar;
    }

    const toolbarGmail = arquivar.closest('[gh="mtb"]');

    if (toolbarGmail && gmailElementoVisivel(toolbarGmail)) {
      return toolbarGmail;
    }

    return null;
  }

  async function gmailEsperarToolbarSelecao() {
    const toolbar = await gmailEsperarCondicao(gmailEncontrarToolbarSelecao, 8000, 100);

    if (!toolbar) {
      throw new Error("A barra de ações do Gmail não apareceu após selecionar os e-mails.");
    }

    // Pequena folga para o Gmail terminar a troca de toolbar.
    await gmailEsperar(400);

    return toolbar;
  }

  function gmailEncontrarBotaoNaToolbar(toolbar, seletores) {
    if (!toolbar) {
      return null;
    }

    for (const seletor of seletores) {
      if (toolbar.matches?.(seletor) && gmailElementoVisivel(toolbar)) {
        return toolbar;
      }

      const candidatos = Array.from(toolbar.querySelectorAll(seletor));

      const visivel = candidatos.find(gmailElementoVisivel);

      if (visivel) {
        return visivel;
      }
    }

    return null;
  }

  async function gmailCliquePagina(elemento) {
    if (!elemento) {
      return false;
    }

    try {
      const HTMLElementPagina = typeof unsafeWindow !== "undefined" ? unsafeWindow.HTMLElement : null;

      if (HTMLElementPagina?.prototype?.click) {
        HTMLElementPagina.prototype.click.call(elemento);
      } else {
        elemento.click();
      }
    } catch {
      try {
        elemento.click();
      } catch {
        return false;
      }
    }

    await gmailEsperar(250);

    return true;
  }

  async function gmailCliquePaginaComFallback(elemento) {
    const primeiro = await gmailCliquePagina(elemento);

    if (!primeiro) {
      return false;
    }

    return true;
  }

  function gmailLinhasResultadosVisiveis() {
    return Array.from(document.querySelectorAll('tr[role="row"]')).filter(gmailElementoVisivel);
  }

  function gmailAssinaturasLinhasResultados() {
    return gmailLinhasResultadosVisiveis()
      .map((linha) => linha.id || linha.getAttribute("jslog") || linha.textContent)
      .filter(Boolean);
  }

  async function gmailDispararMousePagina(elemento) {
    if (!elemento) {
      return false;
    }

    try {
      const JanelaPagina = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

      const rect = elemento.getBoundingClientRect();

      const x = rect.left + rect.width / 2;

      const y = rect.top + rect.height / 2;

      const alvo = document.elementFromPoint(x, y) || elemento;

      for (const tipo of ["mousedown", "mouseup", "click"]) {
        alvo.dispatchEvent(
          new JanelaPagina.MouseEvent(tipo, {
            bubbles: true,

            cancelable: true,

            composed: true,

            button: 0,

            clientX: x,

            clientY: y,
          }),
        );
      }

      return true;
    } catch (e) {
      erro("Mouse Gmail:", e);

      return false;
    }
  }

  async function gmailMarcarComoLidas(toolbar) {
    const localizarBotaoLer = () => gmailEncontrarBotaoNaToolbar(toolbar, ['[role="button"][act="1"][aria-label="Marcar como lida"]', '[role="button"][act="1"][aria-label="Mark as read"]']);

    const localizarBotaoNaoLer = () => gmailEncontrarBotaoNaToolbar(toolbar, ['[role="button"][act="2"][aria-label="Marcar como não lida"]', '[role="button"][act="2"][aria-label="Mark as unread"]']);

    if (localizarBotaoNaoLer()) {
      return {
        executado: false,

        motivo: "ja-lidas",
      };
    }

    const botao = await gmailEsperarCondicao(localizarBotaoLer, 5000, 100);

    if (!botao) {
      throw new Error('A barra apareceu, mas o botão "Marcar como lida" não ficou visível.');
    }

    // Primeiro tenta o clique nativo da página.
    await gmailCliquePagina(botao);

    // Não espera 8 segundos: se o Gmail não reagir em 700 ms,
    // dispara imediatamente o fallback que já provou funcionar.
    let confirmou = await gmailEsperarCondicao(() => !!localizarBotaoNaoLer(), 700, 100);

    if (!confirmou) {
      await gmailDispararMousePagina(botao);

      confirmou = await gmailEsperarCondicao(() => !!localizarBotaoNaoLer(), 5000, 100);
    }

    if (!confirmou) {
      throw new Error('O Gmail não trocou o botão para "Marcar como não lida".');
    }

    return {
      executado: true,
    };
  }

  async function gmailArquivarSelecionadas(toolbar) {
    const botao = gmailEncontrarBotaoNaToolbar(toolbar, ['[role="button"][act="7"][aria-label="Arquivar"]', '[role="button"][act="7"][aria-label="Archive"]']);

    if (!botao) {
      throw new Error('A barra de ações está visível, mas não encontrei "Arquivar".');
    }

    // Guarda quais linhas estavam presentes antes do arquivamento.
    const antes = gmailAssinaturasLinhasResultados();

    await gmailCliquePagina(botao);

    // Se o clique simples não alterar a lista rapidamente,
    // usa o mesmo fallback de mouse que funcionou em "Marcar como lida".
    let confirmou = await gmailEsperarCondicao(
      () => {
        const depois = gmailAssinaturasLinhasResultados();

        if (depois.length < antes.length) {
          return true;
        }

        return antes.some((assinatura) => !depois.includes(assinatura));
      },
      900,
      100,
    );

    if (!confirmou) {
      await gmailDispararMousePagina(botao);

      confirmou = await gmailEsperarCondicao(
        () => {
          const depois = gmailAssinaturasLinhasResultados();

          if (depois.length < antes.length) {
            return true;
          }

          return antes.some((assinatura) => !depois.includes(assinatura));
        },
        6000,
        100,
      );
    }

    if (!confirmou) {
      throw new Error("O Gmail não confirmou a remoção dos e-mails arquivados da lista.");
    }

    return true;
  }

  async function gmailLimparPaginaAtual() {
    await gmailSelecionarPagina();

    definirStatus("Seleção feita. Aguardando barra de ações do Gmail...");

    const toolbar = await gmailEsperarToolbarSelecao();

    definirStatus("Marcando conversas como lidas...");

    const leitura = await gmailMarcarComoLidas(toolbar);

    definirStatus(leitura.executado ? "Conversas marcadas como lidas. Arquivando..." : "Conversas já estavam lidas. Arquivando...");

    const arquivado = await gmailArquivarSelecionadas(toolbar);

    if (!arquivado) {
      throw new Error("O comando de arquivar não foi executado.");
    }

    definirStatus("Arquivado. Voltando para a Caixa de entrada...");

    await gmailVoltarCaixaEntrada();

    return {
      leitura: leitura.executado,

      arquivado: true,

      voltouInbox: true,
    };
  }

  async function gmailVoltarCaixaEntrada() {
    const pagina = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

    try {
      // Caminho principal: navegação direta do Gmail.
      // Preserva /mail/u/X/ da conta atualmente aberta.
      const destino = `${pagina.location.origin}${pagina.location.pathname}#inbox`;

      pagina.location.href = destino;
    } catch (e) {
      erro("Navegação direta para Inbox:", e);
    }

    let voltou = await gmailEsperarCondicao(() => (typeof unsafeWindow !== "undefined" ? unsafeWindow.location.hash : location.hash).startsWith("#inbox"), 3000, 100);

    if (voltou) {
      await gmailEsperar(500);

      return true;
    }

    // Fallback: tenta o link visual caso a navegação direta
    // não tenha sido processada pela SPA.
    const inbox = Array.from(document.querySelectorAll('a[href*="#inbox"]')).find(gmailElementoVisivel);

    if (inbox) {
      inbox.click();

      voltou = await gmailEsperarCondicao(() => (typeof unsafeWindow !== "undefined" ? unsafeWindow.location.hash : location.hash).startsWith("#inbox"), 3000, 100);
    }

    if (!voltou) {
      throw new Error("O Gmail não confirmou o retorno à Caixa de entrada.");
    }

    await gmailEsperar(500);

    return true;
  }

  function gmailTemResultadosVisiveis() {
    return gmailLinhasResultadosVisiveis().length > 0;
  }

  async function gmailProcessarRegraIndividual(regra, indiceAtual, total) {
    const consulta = gmailMontarBuscaRegras([regra]);

    let lote = 0;

    while (lote < 50) {
      lote++;

      definirStatus(`Processando ${indiceAtual}/${total}: ${regra.remetente} — lote ${lote}...`);

      await gmailExecutarBusca(consulta);

      await gmailEsperar(500);

      if (!gmailTemResultadosVisiveis()) {
        return {
          regra: regra.nome,

          lotes: lote - 1,
        };
      }

      await gmailLimparPaginaAtual();

      // gmailLimparPaginaAtual volta para a Caixa de entrada.
      // O loop refaz a mesma busca e continua enquanto ainda
      // existirem resultados para essa regra.
      await gmailEsperar(500);
    }

    throw new Error(`Limite de segurança atingido ao processar ${regra.remetente}.`);
  }

  async function gmailProcessarRegrasSeparadamente(regras) {
    if (!Array.isArray(regras) || !regras.length) {
      throw new Error("Selecione pelo menos um filtro.");
    }

    const ordenadas = [...regras].sort((a, b) =>
      a.remetente.localeCompare(b.remetente, "pt-BR", {
        sensitivity: "base",
      }),
    );

    const resultados = [];

    for (let i = 0; i < ordenadas.length; i++) {
      resultados.push(await gmailProcessarRegraIndividual(ordenadas[i], i + 1, ordenadas.length));
    }

    await gmailVoltarCaixaEntrada();

    return resultados;
  }

  function criarModuloGmail() {
    const details = el("details", "modulo-principal");

    details.dataset.modulo = "gmail";

    details.appendChild(el("summary", "", "Gmail"));

    const corpo = el("div", "modulo-corpo");

    const preset = GMAIL_PRESETS.newsletters;

    const filtrosAtivos = new Set(preset.regras.map((_, indice) => indice));

    function obterRegrasAtivas() {
      return preset.regras.filter((_, indice) => filtrosAtivos.has(indice));
    }

    function obterBuscaAtual() {
      const regrasAtivas = obterRegrasAtivas();

      if (!regrasAtivas.length) {
        return "";
      }

      return gmailMontarBuscaRegras(regrasAtivas);
    }

    const box = el("div", "box");

    box.appendChild(el("div", "titulo-box", preset.titulo));

    const filtrosDetalhes = el("details", "submodulo");

    filtrosDetalhes.open = false;

    const filtrosSummary = el("summary", "", "");

    filtrosDetalhes.appendChild(filtrosSummary);

    const filtrosBox = el("div", "box");

    const checksFiltros = [];

    function atualizarResumoFiltros() {
      filtrosSummary.textContent = `Filtros ativos (${filtrosAtivos.size}/${preset.regras.length})`;
    }

    const acoesFiltros = el("div");

    acoesFiltros.style.display = "flex";

    acoesFiltros.style.gap = "6px";

    acoesFiltros.style.marginBottom = "8px";

    const marcarTodos = el("button", "botao-secundario", "Marcar todos");

    const desmarcarTodos = el("button", "botao-secundario", "Desmarcar todos");

    marcarTodos.onclick = function () {
      filtrosAtivos.clear();

      preset.regras.forEach((_, indice) => filtrosAtivos.add(indice));

      checksFiltros.forEach((check) => {
        check.checked = true;
      });

      atualizarBuscaExibida();
      atualizarResumoFiltros();
    };

    desmarcarTodos.onclick = function () {
      filtrosAtivos.clear();

      checksFiltros.forEach((check) => {
        check.checked = false;
      });

      atualizarBuscaExibida();
      atualizarResumoFiltros();
    };

    acoesFiltros.appendChild(marcarTodos);

    acoesFiltros.appendChild(desmarcarTodos);

    filtrosBox.appendChild(acoesFiltros);

    const filtroDetalhes = el("details", "submodulo");

    filtroDetalhes.open = false;

    filtroDetalhes.appendChild(el("summary", "", "Ver filtro da pesquisa"));

    const busca = el("div", "preview", obterBuscaAtual());

    filtroDetalhes.appendChild(busca);

    function atualizarBuscaExibida() {
      const consulta = obterBuscaAtual();

      busca.textContent = consulta || "Nenhum filtro selecionado.";
    }

    preset.regras.forEach((regra, indice) => {
      const label = el("label", "check-modulo");

      const check = el("input");

      check.type = "checkbox";

      check.checked = true;

      checksFiltros.push(check);

      const span = el("span");

      span.textContent = regra.nome;

      check.addEventListener("change", function () {
        if (check.checked) {
          filtrosAtivos.add(indice);
        } else {
          filtrosAtivos.delete(indice);
        }

        atualizarBuscaExibida();
        atualizarResumoFiltros();
      });

      label.appendChild(check);

      label.appendChild(span);

      filtrosBox.appendChild(label);
    });

    filtrosDetalhes.appendChild(filtrosBox);

    atualizarResumoFiltros();

    const localizar = el("button", "botao btn-dark", "Aplicar filtros");

    const processarSeparado = el("button", "botao btn-dark", "Processar por filtro");

    const limpar = el("button", "botao btn-green", "Marcar como lidas e arquivar");

    localizar.onclick = async function () {
      localizar.disabled = true;

      try {
        definirStatus("Aplicando filtros configurados...");

        const consulta = obterBuscaAtual();

        if (!consulta) {
          throw new Error("Selecione pelo menos um filtro.");
        }

        await gmailExecutarBusca(consulta);

        definirStatus("Filtros aplicados. Confira os resultados antes de limpar.", "ok");
      } catch (e) {
        definirStatus(e.message || "Erro ao pesquisar no Gmail.", "erro");
      } finally {
        localizar.disabled = false;
      }
    };

    processarSeparado.onclick = async function () {
      processarSeparado.disabled = true;

      localizar.disabled = true;

      limpar.disabled = true;

      try {
        const regrasAtivas = obterRegrasAtivas();

        if (!regrasAtivas.length) {
          throw new Error("Selecione pelo menos um filtro.");
        }

        definirStatus(`Processando ${regrasAtivas.length} filtro(s) separadamente...`);

        await gmailProcessarRegrasSeparadamente(regrasAtivas);

        definirStatus("Processamento por filtro concluído. Caixa de entrada restaurada.", "ok");
      } catch (e) {
        definirStatus(e.message || "Erro ao processar filtros separadamente.", "erro");
      } finally {
        processarSeparado.disabled = false;

        localizar.disabled = false;

        limpar.disabled = false;
      }
    };

    limpar.onclick = async function () {
      limpar.disabled = true;

      try {
        definirStatus("Selecionando conversas da página atual...");

        const resultado = await gmailLimparPaginaAtual();

        definirStatus(resultado.leitura ? "Mensagens filtradas marcadas como lidas, arquivadas e Caixa de entrada restaurada." : "Mensagens filtradas já estavam lidas, foram arquivadas e a Caixa de entrada foi restaurada.", "ok");
      } catch (e) {
        definirStatus(e.message || "Erro ao limpar newsletters.", "erro");
      } finally {
        limpar.disabled = false;
      }
    };

    box.appendChild(filtrosDetalhes);

    box.appendChild(filtroDetalhes);

    box.appendChild(localizar);

    box.appendChild(processarSeparado);

    box.appendChild(limpar);

    corpo.appendChild(box);

    details.appendChild(corpo);

    return details;
  }

  // ============================================================
  // PLACEHOLDERS
  // ============================================================

  function criarModuloPlaceholder(chave, titulo, descricao) {
    const details = el("details", "modulo-principal");

    details.dataset.modulo = chave;

    const summary = el("summary", "", titulo);

    const corpo = el("div", "modulo-corpo");

    corpo.appendChild(el("div", "texto-pequeno", descricao));

    details.appendChild(summary);

    details.appendChild(corpo);

    return details;
  }

  // ============================================================
  // RENDER
  // ============================================================

  async function renderizarConteudo() {
    paginaEstado.pararSeletor?.();

    if (!conteudo) {
      return;
    }

    conteudo.replaceChildren();

    conteudo.appendChild(criarConfiguracaoModulos());

    const modulosRenderizados = [];

    if (preferencias.pdf) {
      try {
        const pdf = await criarModuloPdf();

        modulosRenderizados.push(pdf);

        conteudo.appendChild(pdf);
      } catch (e) {
        erro("Módulo PDF:", e);

        conteudo.appendChild(el("div", "info", `PDF: ${e.message || "erro ao carregar"}`));
      }
    }

    if (preferencias.imagens) {
      try {
        const imagens = criarModuloImagens();

        modulosRenderizados.push(imagens);

        conteudo.appendChild(imagens);
      } catch (e) {
        erro("Módulo Imagens:", e);

        conteudo.appendChild(el("div", "info", `Imagens: ${e.message || "erro ao carregar"}`));
      }
    }

    if (preferencias.pagina) {
      try {
        const pagina = criarModuloPagina();

        modulosRenderizados.push(pagina);

        conteudo.appendChild(pagina);
      } catch (e) {
        erro("Módulo Página:", e);

        conteudo.appendChild(el("div", "info", `Página: ${e.message || "erro ao carregar"}`));
      }
    }

    if (preferencias.arquivos) {
      try {
        const arquivos = await criarModuloArquivos();

        modulosRenderizados.push(arquivos);

        conteudo.appendChild(arquivos);
      } catch (e) {
        erro("Módulo Arquivos:", e);

        conteudo.appendChild(el("div", "info", `Arquivos: ${e.message || "erro ao carregar"}`));
      }
    }

    if (preferencias.gmail && location.hostname === "mail.google.com") {
      try {
        const gmail = criarModuloGmail();

        modulosRenderizados.push(gmail);

        conteudo.appendChild(gmail);
      } catch (e) {
        erro("Módulo Gmail:", e);

        conteudo.appendChild(el("div", "info", `Gmail: ${e.message || "erro ao carregar"}`));
      }
    }

    // ========================================================
    // ACCORDION ENTRE MÓDULOS PRINCIPAIS
    // ========================================================

    configurarAccordionPersistente(modulosRenderizados, STORAGE_MODULO_ABERTO, "modulo");

    if (!modulosRenderizados.length) {
      conteudo.appendChild(el("div", "texto-pequeno", "Ative um módulo acima para começar."));
    }
  }

  // ============================================================
  // ABRIR / FECHAR
  // ============================================================

  async function abrirPainel() {
    painelAberto = true;

    GM_setValue(STORAGE_PAINEL_ABERTO, true);

    painel.style.display = "flex";

    launcher.textContent = "×";

    try {
      await renderizarConteudo();
    } catch (e) {
      erro("Render principal:", e);

      if (conteudo) {
        conteudo.replaceChildren(el("div", "info", `Erro ao montar o Toolkit: ${e.message || e}`));
      }
    }
  }

  function fecharPainel() {
    paginaEstado.pararSeletor?.();

    painelAberto = false;

    GM_setValue(STORAGE_PAINEL_ABERTO, false);

    painel.style.display = "none";

    launcher.textContent = "FT";
  }

  // ============================================================
  // CAMADAS DINÂMICAS — TOOLKIT x TRANSCRIBER
  // ============================================================

  function trazerToolkitParaFrente() {
    if (painel) {
      painel.style.zIndex = "2147483647";
    }

    if (launcher) {
      launcher.style.zIndex = "2147483647";
    }

    const transcriber = document.getElementById("wat-panel");

    if (transcriber) {
      transcriber.style.zIndex = "2147483646";
    }
  }

  // ============================================================
  // CRIAR APP
  // ============================================================

  function criarApp() {
    if (window !== window.top) return;

    const hostExistente = document.getElementById("fausto-toolkit-host");

    if (hostExistente) {
      if (rootHost !== hostExistente) {
        rootHost = hostExistente;

        shadow = rootHost.shadowRoot;

        if (shadow) {
          launcher = shadow.querySelector(".launcher");

          painel = shadow.querySelector(".painel");

          conteudo = shadow.querySelector(".conteudo");

          statusGlobal = shadow.querySelector(".status");
        }
      }

      return;
    }

    // Host
    rootHost = document.createElement("div");

    rootHost.id = "fausto-toolkit-host";

    // Shadow DOM
    shadow = rootHost.attachShadow({
      mode: "open",
    });

    // CSS isolado
    const style = document.createElement("style");

    style.textContent = CSS;

    shadow.appendChild(style);

    // Launcher
    launcher = el("button", "launcher", "FT");

    // Painel
    painel = el("div", "painel");

    // Qualquer clique/toque no Toolkit traz o FT para frente.
    painel.addEventListener("pointerdown", trazerToolkitParaFrente, true);

    launcher.addEventListener("pointerdown", trazerToolkitParaFrente, true);

    // Header
    const header = el("div", "header");

    header.appendChild(el("div", "header-nome", APP.nome));

    header.appendChild(el("div", "header-versao", `v${APP.versao}`));

    // Conteúdo
    conteudo = el("div", "conteudo");

    // Status
    statusGlobal = el("div", "status");

    painel.appendChild(header);

    painel.appendChild(conteudo);

    painel.appendChild(statusGlobal);

    launcher.onclick = function () {
      if (painelAberto) {
        fecharPainel();
      } else {
        abrirPainel();
      }
    };

    shadow.appendChild(painel);

    shadow.appendChild(launcher);

    document.body.appendChild(rootHost);

    const estavaAberto = GM_getValue(STORAGE_PAINEL_ABERTO, false);

    if (estavaAberto) {
      setTimeout(function () {
        abrirPainel();
      }, 0);
    }
  }

  function paginaIdAleatorio() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  // Um painel por aba; frames executam apenas operações solicitadas pelo painel.
  const FT_FRAME_PROTOCOLO = "FAUSTO_TOOLKIT_FRAME_V150";
  const ftFrame = {
    principal: window === window.top,
    id: paginaIdAleatorio(),
    registros: new Map(),
    contextos: new Map(),
    contexto: "principal",
    atualizarUI: null,
    estados: new WeakMap(),
    pedidos: new Set(),
    canal: "FAUSTO_TOOLKIT_FRAME_CMD_",
    limite: 8 * 1024 * 1024,
  };

  function paginaEhElemento(no) {
    return !!no && no.nodeType === 1;
  }

  function paginaEstadoDocumento(doc) {
    let estado = ftFrame.estados.get(doc);
    if (!estado) {
      estado = { selecionado: null, desfazer: doc === document ? paginaEstado.desfazer : [], tabelas: new Map(), parar: null, closeOriginal: null };
      ftFrame.estados.set(doc, estado);
    }
    return estado;
  }

  function paginaJanelas() {
    const resultado = [];
    const vistos = new Set();
    const visitar = (janela, caminho, nivel) => {
      if (!janela || vistos.has(janela) || nivel > 12 || resultado.length >= 250) return;
      vistos.add(janela);
      resultado.push({ janela, caminho });
      try {
        for (let i = 0; i < janela.length; i++) visitar(janela.frames[i], [...caminho, i], nivel + 1);
      } catch {}
    };
    visitar(window, [], 0);
    return resultado;
  }

  function paginaRpc(frame, acao, args = {}, prazo = 15000) {
    if (typeof GM_addValueChangeListener !== "function") return Promise.reject(new Error("Atualize o cabeçalho completo do userscript para habilitar a conexão com frames."));
    const id = paginaIdAleatorio(),
      comando = ftFrame.canal + frame.id;
    const resposta = comando + "_R_" + id;
    return new Promise((resolve, reject) => {
      let listener,
        timer,
        terminou = false;
      const finalizar = (erro, dados) => {
        if (terminou) return;
        terminou = true;
        clearTimeout(timer);
        if (listener !== undefined) GM_removeValueChangeListener(listener);
        GM_deleteValue(resposta);
        if (GM_getValue(comando, null)?.id === id) GM_deleteValue(comando);
        ftFrame.pedidos.delete(finalizar);
        if (erro) reject(erro);
        else resolve(dados);
      };
      listener = GM_addValueChangeListener(resposta, (_k, _old, novo) => {
        if (!novo || novo.id !== id) return;
        finalizar(novo.ok ? null : new Error(novo.erro || "Falha no iframe."), novo.dados);
      });
      timer = setTimeout(() => finalizar(new Error("O iframe não respondeu. Atualize a lista; o frame pode ter navegado ou o Tampermonkey pode estar bloqueado nele.")), prazo);
      ftFrame.pedidos.add(finalizar);
      GM_setValue(comando, { id, acao, args });
    });
  }

  function paginaDescobrirFrames() {
    const janelas = paginaJanelas();
    for (const [janela] of ftFrame.registros) if (!janelas.some((j) => j.janela === janela)) ftFrame.registros.delete(janela);
    const contextos = new Map();
    for (const { janela, caminho } of janelas) {
      const chave = caminho.length ? "frame:" + caminho.join(".") : "principal";
      let doc = null;
      try {
        doc = janela.document;
        if (!doc?.documentElement) doc = null;
      } catch {}
      const registro = ftFrame.registros.get(janela);
      const url = doc?.URL || registro?.url || "";
      const titulo = doc?.title || registro?.titulo || "";
      const nome = caminho.length ? "Iframe " + caminho.map((i) => i + 1).join(".") : "Página principal";
      const rotulo =
        nome +
        (titulo ? " — " + titulo.slice(0, 65) : "") +
        (url
          ? " [" +
            (() => {
              try {
                return new URL(url).hostname || new URL(url).protocol;
              } catch {
                return "";
              }
            })() +
            "]"
          : "") +
        (!doc && !registro ? " — sem conexão" : "");
      contextos.set(chave, { chave, janela, doc, frame: doc ? null : registro, url, rotulo });
    }
    ftFrame.contextos = contextos;
    if (!contextos.has(ftFrame.contexto)) ftFrame.contexto = "principal";
    return contextos;
  }

  function paginaContexto() {
    paginaDescobrirFrames();
    const contexto = ftFrame.contextos.get(ftFrame.contexto);
    if (!contexto || (!contexto.doc && !contexto.frame)) throw new Error("O Toolkit não está conectado a esse iframe. Habilite o script nesse domínio ou abra o frame em outra aba.");
    return contexto;
  }

  async function paginaExecutar(acao, args = {}) {
    const contexto = paginaContexto();
    const resultado = contexto.doc ? await paginaOperacaoLocal(contexto.doc, acao, args) : await paginaRpc(contexto.frame, acao, args, acao === "selecionar" ? 120000 : 15000);
    const atual = paginaContexto();
    if (atual.chave !== contexto.chave || atual.doc !== contexto.doc || atual.frame?.id !== contexto.frame?.id) throw new Error("O documento mudou durante a operação. Atualize a lista e repita.");
    return resultado;
  }

  function paginaExpressaoDocumento(doc) {
    let atual = doc,
      partes = [];
    try {
      while (atual.defaultView !== window.top) {
        const frame = atual.defaultView.frameElement;
        if (!frame) return { codigo: "document", consoleFrame: true };
        partes.unshift(".querySelector(" + JSON.stringify(paginaCss(frame)) + ").contentDocument");
        atual = frame.ownerDocument;
      }
      return { codigo: "document" + partes.join(""), consoleFrame: false };
    } catch {
      return { codigo: "document", consoleFrame: true };
    }
  }

  function paginaEscolherLocal(doc) {
    const estado = paginaEstadoDocumento(doc);
    estado.parar?.();
    return new Promise((resolve, reject) => {
      const overlay = doc.createElement("div");
      overlay.dataset.ftPaginaOverlay = "true";
      overlay.style.cssText = "position:fixed;pointer-events:none;border:2px solid #0d6efd;background:rgba(13,110,253,.12);z-index:2147483646;display:none;box-sizing:border-box";
      doc.documentElement.appendChild(overlay);
      const anterior = doc.documentElement.style.cursor;
      doc.documentElement.style.cursor = "crosshair";
      const limpar = () => {
        overlay.remove();
        doc.documentElement.style.cursor = anterior;
        doc.removeEventListener("pointermove", mover, true);
        doc.removeEventListener("click", clicar, true);
        doc.removeEventListener("keydown", tecla, true);
        estado.parar = null;
      };
      const cancelar = () => {
        limpar();
        reject(new Error("Seleção cancelada."));
      };
      const mover = (evento) => {
        const no = evento.target;
        if (!paginaEhElemento(no) || paginaInterno(no)) {
          overlay.style.display = "none";
          return;
        }
        const r = no.getBoundingClientRect();
        Object.assign(overlay.style, { display: "block", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      };
      const clicar = (evento) => {
        const no = evento.target;
        if (!paginaEhElemento(no) || paginaInterno(no)) return;
        evento.preventDefault();
        evento.stopImmediatePropagation();
        limpar();
        estado.selecionado = no;
        if (doc === document) paginaEstado.selecionado = no;
        resolve(paginaInspecionar(no));
      };
      const tecla = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelar();
        }
      };
      doc.addEventListener("pointermove", mover, true);
      doc.addEventListener("click", clicar, true);
      doc.addEventListener("keydown", tecla, true);
      estado.parar = cancelar;
    });
  }

  function paginaSelecionar(aoSelecionar) {
    paginaEstado.pararSeletor?.();
    const contexto = paginaContexto();
    let ativo = true;
    const cancelar = () => {
      if (!ativo) return;
      ativo = false;
      document.removeEventListener("keydown", esc, true);
      paginaEstado.pararSeletor = null;
      if (contexto.doc) paginaEstadoDocumento(contexto.doc).parar?.();
      else paginaRpc(contexto.frame, "cancelar").catch(() => {});
    };
    const esc = (e) => {
      if (e.key === "Escape") cancelar();
    };
    document.addEventListener("keydown", esc, true);
    paginaEstado.pararSeletor = cancelar;
    definirStatus("Clique dentro de " + contexto.rotulo + ". Esc cancela.");
    const pedido = contexto.doc ? paginaEscolherLocal(contexto.doc) : paginaRpc(contexto.frame, "selecionar", {}, 120000);
    // Não bloqueia o botão por toda a duração da escolha.
    pedido
      .then((dados) => {
        if (!ativo) return;
        ativo = false;
        document.removeEventListener("keydown", esc, true);
        paginaEstado.pararSeletor = null;
        aoSelecionar(dados);
        definirStatus("Elemento selecionado em " + contexto.rotulo, "ok");
      })
      .catch((erro) => {
        if (ativo) {
          cancelar();
          definirStatus(erro.message, erro.message === "Seleção cancelada." ? "normal" : "erro");
        }
      });
  }

  async function paginaOperacaoLocal(doc, acao, args = {}) {
    const estado = paginaEstadoDocumento(doc),
      janela = doc.defaultView;
    const elementos = (seletor) => Array.from(doc.querySelectorAll(seletor)).filter((no) => !paginaInterno(no));
    const alvo = () => {
      const no = estado.selecionado;
      if (!no?.isConnected || paginaInterno(no)) throw new Error("Selecione um elemento neste documento primeiro.");
      if (["HTML", "HEAD", "BODY"].includes(no.tagName)) throw new Error("Selecione um elemento dentro da página.");
      return no;
    };
    const atributo = (no, nome, valor) => {
      const antes = no.getAttribute(nome);
      estado.desfazer.push(() => (antes === null ? no.removeAttribute(nome) : no.setAttribute(nome, antes)));
      valor === null ? no.removeAttribute(nome) : no.setAttribute(nome, valor);
    };
    if (acao === "ping") return { url: doc.URL, titulo: doc.title };
    if (acao === "cancelar") {
      estado.parar?.();
      return true;
    }
    if (acao === "selecionar") return paginaEscolherLocal(doc);
    if (acao === "selecionarCss") {
      const no = doc.querySelector(args.css);
      if (!no || paginaInterno(no)) throw new Error("Elemento não encontrado neste documento.");
      estado.selecionado = no;
      if (doc === document) paginaEstado.selecionado = no;
      return paginaInspecionar(no);
    }
    if (acao === "extrair") {
      if (args.tipo === "selecao") return janela.getSelection()?.toString() || "";
      const texto = paginaTextoVisivel(doc),
        padroes = {
          emails: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
          telefones: /(?<!\d)(?:\+?55[\s.-]?)?(?:\(?[1-9]\d\)?[\s.-]?)?(?:9\d{4}|[2-5]\d{3})[\s.-]?\d{4}(?!\d)/g,
          cpf: /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g,
          cnpj: /(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g,
        };
      if (args.tipo === "texto") return texto;
      if (!padroes[args.tipo]) throw new Error("Tipo de extração inválido.");
      return Array.from(new Set(texto.match(padroes[args.tipo]) || [])).join("\n");
    }
    if (acao === "tabelas") {
      estado.tabelas.clear();
      return elementos("table").map((tabela, i) => {
        const id = paginaIdAleatorio();
        estado.tabelas.set(id, tabela);
        return { id, numero: i + 1, linhas: tabela.rows.length };
      });
    }
    if (acao === "tabela") {
      const tabela = estado.tabelas.get(args.id);
      if (!tabela?.isConnected) throw new Error("A tabela mudou. Atualize a lista e selecione novamente.");
      return paginaTabelaFormato(paginaTabelaGrade(tabela), args.formato);
    }
    if (acao === "links") {
      const vistos = new Set(),
        links = [];
      for (const a of elementos("a[href]")) {
        let url;
        try {
          url = new URL(a.href);
        } catch {
          continue;
        }
        if (!["http:", "https:", "mailto:", "tel:", "blob:"].includes(url.protocol)) continue;
        if (args.filtro === "externos" && (!["http:", "https:"].includes(url.protocol) || url.origin === janela.location.origin)) continue;
        if (args.filtro === "downloads" && !a.hasAttribute("download") && !/\.(pdf|zip|rar|7z|docx?|xlsx?|csv|txt|jpe?g|png|webp|mp4)$/i.test(url.pathname)) continue;
        if (vistos.has(url.href)) continue;
        vistos.add(url.href);
        links.push({ url: url.href, texto: paginaTexto(a) });
      }
      return links;
    }
    if (acao === "dev") {
      if (args.tipo === "iframes")
        return elementos("iframe,frame").map((f) => {
          let acessivel = false;
          try {
            acessivel = !!f.contentDocument?.documentElement;
          } catch {}
          return { id: f.id, nome: f.name, src: f.getAttribute("src"), acessivel };
        });
      if (args.tipo === "scripts") return elementos("script").map((s) => ({ src: s.src || "(inline)", tipo: s.type || "text/javascript", async: s.async, defer: s.defer }));
      if (args.tipo === "cookies")
        return doc.cookie
          ? doc.cookie.split(/;\s*/).map((c) => {
              const p = c.indexOf("=");
              return { nome: c.slice(0, p), valor: c.slice(p + 1) };
            })
          : [];
      if (!["local", "session"].includes(args.tipo)) throw new Error("Tipo inválido.");
      const storage = args.tipo === "local" ? janela.localStorage : janela.sessionStorage,
        dados = Object.create(null);
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        dados[k] = storage.getItem(k);
      }
      return dados;
    }
    if (acao === "url") return doc.URL;
    if (acao === "limparStorage") {
      if (!["local", "session", "ambos"].includes(args.tipo)) throw new Error("Tipo inválido.");
      if (["local", "ambos"].includes(args.tipo)) janela.localStorage.clear();
      if (["session", "ambos"].includes(args.tipo)) janela.sessionStorage.clear();
      return true;
    }
    if (acao === "recarregar") {
      setTimeout(() => janela.location.reload(), 100);
      return true;
    }
    if (acao === "desfazer") {
      const ultima = estado.desfazer.pop();
      if (!ultima) throw new Error("Nenhuma alteração neste documento para desfazer.");
      ultima();
      return true;
    }
    if (acao === "desfazerTudo") {
      while (estado.desfazer.length) estado.desfazer.pop()();
      return true;
    }
    if (acao === "modificar") {
      const inicio = estado.desfazer.length;
      try {
        if (args.tipo === "pausar") {
          const estilo = doc.createElement("style");
          estilo.textContent = "* { animation-play-state: paused !important; transition: none !important; }";
          doc.documentElement.appendChild(estilo);
          const animacoes = doc.getAnimations?.().filter((a) => a.playState === "running") || [];
          animacoes.forEach((a) => a.pause());
          estado.desfazer.push(() => {
            estilo.remove();
            animacoes.forEach((a) => {
              try {
                a.play();
              } catch {}
            });
          });
        } else if (args.tipo === "close") {
          if (estado.closeOriginal) return true;
          const principal = doc === document && typeof unsafeWindow !== "undefined" ? unsafeWindow : janela;
          const original = principal.close,
            bloqueado = () => {};
          principal.close = bloqueado;
          if (principal.close !== bloqueado) throw new Error("Não foi possível substituir window.close().");
          estado.closeOriginal = original;
          estado.desfazer.push(() => {
            if (principal.close === bloqueado) principal.close = original;
            estado.closeOriginal = null;
          });
        } else {
          const no = alvo();
          if (args.tipo === "ocultar") {
            atributo(no, "style", no.getAttribute("style") || "");
            no.style.setProperty("display", "none", "important");
          } else if (args.tipo === "remover") {
            const pai = no.parentNode,
              proximo = no.nextSibling;
            estado.desfazer.push(() => {
              if (pai.isConnected) pai.insertBefore(no, proximo?.parentNode === pai ? proximo : null);
            });
            no.remove();
          } else if (args.tipo === "editar") atributo(no, "contenteditable", "true");
          else if (args.tipo === "habilitar") {
            atributo(no, "disabled", null);
            atributo(no, "readonly", null);
            for (let pai = no.parentElement; pai; pai = pai.parentElement) if (pai.tagName === "FIELDSET" && pai.disabled) atributo(pai, "disabled", null);
          } else if (args.tipo === "mostrar") {
            atributo(no, "hidden", null);
            atributo(no, "style", no.getAttribute("style") || "");
            no.style.setProperty("display", "revert", "important");
            no.style.setProperty("visibility", "visible", "important");
            no.style.setProperty("opacity", "1", "important");
          } else throw new Error("Alteração inválida.");
        }
      } finally {
        if (estado.desfazer.length > inicio + 1) {
          const grupo = estado.desfazer.splice(inicio);
          estado.desfazer.push(() =>
            grupo
              .slice()
              .reverse()
              .forEach((f) => f()),
          );
        }
      }
      return true;
    }
    throw new Error("Operação não suportada no iframe.");
  }

  function paginaIniciarConexaoFrames() {
    if (typeof GM_addValueChangeListener !== "function") return;
    if (!ftFrame.principal) {
      const canal = ftFrame.canal + ftFrame.id;
      const listener = GM_addValueChangeListener(canal, async (_k, _old, pedido) => {
        if (!pedido || typeof pedido.id !== "string" || !/^[a-f0-9-]{36}$/i.test(pedido.id)) return;
        const resposta = canal + "_R_" + pedido.id;
        let resultado;
        try {
          const dados = await paginaOperacaoLocal(document, pedido.acao, pedido.args);
          if (JSON.stringify(dados)?.length > ftFrame.limite) throw new Error("Resultado muito grande para a conexão. Abra o iframe em outra aba.");
          resultado = { id: pedido.id, ok: true, dados };
        } catch (e) {
          resultado = { id: pedido.id, ok: false, erro: e.message };
        }
        GM_setValue(resposta, resultado);
        setTimeout(() => GM_deleteValue(resposta), 30000);
      });
      // postMessage anuncia somente o identificador aleatório. Conteúdo e comandos
      // trafegam no storage privado do userscript, nunca pelo DOM da seguradora.
      const anunciar = () => window.top.postMessage({ protocolo: FT_FRAME_PROTOCOLO, id: ftFrame.id }, "*");
      window.addEventListener("message", (e) => {
        if (e.source === window.top && e.data?.protocolo === FT_FRAME_PROTOCOLO && e.data?.descobrir === true) anunciar();
      });
      anunciar();
      setTimeout(anunciar, 1000);
      setTimeout(anunciar, 3000);
      window.addEventListener("pagehide", (evento) => {
        paginaEstadoDocumento(document).parar?.();
        if (evento.persisted) return;
        GM_removeValueChangeListener(listener);
        GM_deleteValue(canal);
      });
      window.addEventListener("pageshow", (evento) => {
        if (evento.persisted) anunciar();
      });
      return;
    }
    const pendentes = new WeakSet();
    window.addEventListener("message", async (evento) => {
      const msg = evento.data;
      if (msg?.protocolo !== FT_FRAME_PROTOCOLO || typeof msg.id !== "string" || !/^[a-f0-9-]{36}$/i.test(msg.id) || !evento.source || evento.source === window) return;
      const fonte = evento.source;
      if (!paginaJanelas().some((j) => j.janela === fonte) || pendentes.has(fonte)) return;
      const anterior = ftFrame.registros.get(fonte);
      if (anterior?.id === msg.id && Date.now() - anterior.verificadoEm < 800) return;
      pendentes.add(fonte);
      try {
        const meta = await paginaRpc({ id: msg.id }, "ping", {}, 2500);
        if (new URL(meta.url).origin !== evento.origin || !paginaJanelas().some((j) => j.janela === fonte)) return;
        ftFrame.registros.set(fonte, { id: msg.id, url: meta.url, titulo: meta.titulo, verificadoEm: Date.now() });
        ftFrame.atualizarUI?.();
      } catch {
      } finally {
        pendentes.delete(fonte);
      }
    });
    window.addEventListener(
      "pagehide",
      () => {
        for (const cancelar of [...ftFrame.pedidos]) cancelar(new Error("Página encerrada."));
      },
      { once: true },
    );
  }

  function criarPaginaContextos(corpo) {
    corpo.appendChild(el("div", "info", "Um único painel controla a página e seus iframes. Escolha o documento abaixo antes de selecionar elementos, extrair, exportar tabelas ou modificar. Frames de outro domínio precisam ter o userscript habilitado pelo Tampermonkey."));
    const select = paginaSelect(corpo, "Documento de trabalho", []);
    select.dataset.ftContexto = "true";
    const atualizar = () => {
      paginaDescobrirFrames();
      select.replaceChildren();
      for (const [chave, c] of ftFrame.contextos) {
        const opt = el("option", "", c.rotulo);
        opt.value = chave;
        select.appendChild(opt);
      }
      select.value = ftFrame.contexto;
    };
    ftFrame.atualizarUI = atualizar;
    atualizar();
    select.addEventListener("change", () => {
      paginaEstado.pararSeletor?.();
      ftFrame.contexto = select.value;
      paginaEstado.captura = null;
      corpo.querySelectorAll("textarea").forEach((a) => (a.value = ""));
      try {
        definirStatus("Documento de trabalho: " + paginaContexto().rotulo);
      } catch (erro) {
        definirStatus(erro.message, "erro");
      }
    });
    paginaBotao(corpo, "Atualizar iframes", () => {
      atualizar();
      for (const { janela, caminho } of paginaJanelas())
        if (caminho.length)
          try {
            janela.postMessage({ protocolo: FT_FRAME_PROTOCOLO, descobrir: true }, "*");
          } catch {}
      definirStatus("Lista atualizada. Frames disponíveis aparecerão após a conexão.");
    });
    paginaBotao(corpo, "Abrir documento escolhido em nova aba", async () => {
      const aba = window.open("about:blank", "_blank");
      if (!aba) throw new Error("O navegador bloqueou a nova aba.");
      aba.opener = null;
      try {
        const url = await paginaExecutar("url");
        if (!/^https?:\/\//i.test(url)) throw new Error("Esse frame não tem URL HTTP/HTTPS que possa ser aberta separadamente.");
        aba.location.href = url;
      } catch (erro) {
        aba.close();
        throw erro;
      }
    });
  }

  // ============================================================
  // RESILIÊNCIA PARA SPA (GMAIL, OUTLOOK, REACT, ANGULAR...)
  // ============================================================

  let observerToolkitSPA = null;

  let urlToolkitSPA = location.href;

  let timerToolkitSPA = null;

  function garantirToolkitAnexado() {
    if (!ftFrame.principal || !document.body) {
      return;
    }

    if (rootHost && !rootHost.isConnected) {
      document.body.appendChild(rootHost);

      if (painelAberto) {
        clearTimeout(timerToolkitSPA);

        timerToolkitSPA = setTimeout(
          function () {
            renderizarConteudo().catch((e) => erro("Render após reanexar:", e));
          },
          ehGmail() ? 500 : 80,
        );
      }
    }

    if (!rootHost || !rootHost.isConnected) {
      criarApp();
    }
  }

  function reagirNavegacaoSPA() {
    const urlAtual = location.href;

    if (urlAtual === urlToolkitSPA) {
      return;
    }

    urlToolkitSPA = urlAtual;

    garantirToolkitAnexado();

    if (painelAberto) {
      clearTimeout(timerToolkitSPA);

      timerToolkitSPA = setTimeout(function () {
        renderizarConteudo().catch((e) => erro("Render SPA:", e));
      }, 80);
    }
  }

  function iniciarProtecaoSPA() {
    if (!ftFrame.principal || observerToolkitSPA) {
      return;
    }

    observerToolkitSPA = new MutationObserver(function () {
      garantirToolkitAnexado();
      reagirNavegacaoSPA();
    });

    observerToolkitSPA.observe(document.documentElement, {
      childList: true,

      subtree: true,
    });

    window.addEventListener("popstate", reagirNavegacaoSPA, true);

    window.addEventListener("hashchange", reagirNavegacaoSPA, true);

    // Gmail e outras SPAs usam pushState/replaceState sem disparar
    // popstate. O intervalo é leve e só compara a URL.
    setInterval(function () {
      garantirToolkitAnexado();
      reagirNavegacaoSPA();
    }, 1000);
  }

  function ehGmail() {
    return location.hostname === "mail.google.com";
  }

  let inicializacaoAgendada = false;

  function iniciarComDelayQuandoNecessario() {
    if (inicializacaoAgendada) {
      return;
    }

    inicializacaoAgendada = true;

    const atraso = ehGmail() ? 2500 : 0;

    setTimeout(async function () {
      iniciar();

      // Gmail continua reconstruindo partes da interface
      // mesmo depois do primeiro paint. Faz uma segunda
      // renderização quando o painel estava aberto.
      if (ehGmail()) {
        setTimeout(async function () {
          garantirToolkitAnexado();

          if (painelAberto) {
            try {
              await renderizarConteudo();
            } catch (e) {
              erro("Render Gmail:", e);
            }
          }
        }, 1500);
      }
    }, atraso);
  }

  // ============================================================
  // START
  // ============================================================

  function iniciar() {
    if (!ftFrame.principal) return;

    if (!document.body) {
      setTimeout(iniciar, 100);

      return;
    }

    criarApp();
    iniciarProtecaoSPA();
  }

  paginaIniciarConexaoFrames();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarComDelayQuandoNecessario, {
      once: true,
    });
  } else {
    iniciarComDelayQuandoNecessario();
  }
})();
