import {
  obterDB,
  CHAVE_IMPORTAR,
  CHAVE_IMPRIMIR,
  STORAGE_PDF_SUBMODULO_ABERTO,
} from "../core/storage.js";
import {
  obterPastasLocais,
  garantirPermissao,
  buscarArquivoRecursivo,
  adicionarPastaLocal,
  removerPastaLocal,
  obterPastaDestino,
  salvarBufferNaPasta,
  escolherPastaDestino,
} from "../core/filesystem.js";
import {
  erro,
  formatarData,
  formatarComissao,
  dataValida,
  comissaoValida,
  gerarNomePadrao,
} from "../core/utils.js";
import { CONFIG, SEGURADORAS, RAMOS } from "../core/config.js";
import { el, configurarAccordionPersistente } from "../core/dom.js";
import { definirStatus, renderizarConteudo } from "../core/ui.js";

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

function paginaParecePdf() {
  if (
    document.contentType &&
    document.contentType.toLowerCase().includes("application/pdf")
  ) {
    return true;
  }

  if (/\.pdf(?:$|\?|#)/i.test(location.href)) {
    return true;
  }

  if (document.querySelector('embed[type="application/pdf"]')) {
    return true;
  }

  const path = location.pathname.toLowerCase();

  return (
    path.includes("/pdf/") ||
    path.includes("gerarpdf") ||
    path.includes("gerar-pdf") ||
    path.includes("downloadpdf") ||
    path.includes("download-pdf")
  );
}

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

      const encontrado = await buscarArquivoRecursivo(
        pasta,
        nome,
        0,
        pasta.name,
      );

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

  const linha = headers
    .split(/\r?\n/)
    .find((item) => item.toLowerCase().startsWith("content-disposition:"));

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

        let nome =
          nomePorContentDisposition(res.responseHeaders) ||
          nomePelaUrlWeb(url) ||
          "documento.pdf";

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

function abrirPdfGerado(bytes) {
  const blob = new Blob([bytes], {
    type: "application/pdf",
  });

  const url = URL.createObjectURL(blob);

  window.open(url, "_blank");
}

async function criarBlocoArquivoLocal() {
  const box = el("div", "info-local");

  box.appendChild(el("div", "titulo-box", "Arquivo local"));

  const info = el("div", "info");

  function atualizarInfo() {
    if (cachePdf.buffer && cachePdf.nome) {
      info.style.color = "#198754";

      info.textContent =
        `✓ ${cachePdf.nome}` + (cachePdf.origem ? `\n${cachePdf.origem}` : "");
    } else {
      info.style.color = "#666";

      info.textContent = "PDF ainda não carregado.";
    }
  }

  atualizarInfo();

  const localizar = el(
    "button",
    "botao-secundario",
    "Procurar automaticamente",
  );

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

  const selecionar = el(
    "button",
    "botao-secundario",
    "Selecionar PDF manualmente",
  );

  selecionar.onclick = async function () {
    try {
      await carregarPdfManualNoCache();

      atualizarInfo();

      definirStatus("PDF carregado.", "ok");
    } catch (e) {
      definirStatus(e.message, "erro");
    }
  };

  const adicionar = el(
    "button",
    "botao-secundario",
    "+ Adicionar pasta de busca",
  );

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
    box.appendChild(
      el("div", "texto-pequeno", `Pastas de busca: ${pastas.length}`),
    );

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
    return seguradora.value === "OUTRO"
      ? seguradoraOutro.value
      : seguradora.value;
  }

  function getRamoFinal() {
    return ramo.value === "OUTRO" ? ramoOutro.value : ramo.value;
  }

  function obterNomeNovo() {
    return gerarNomePadrao(getSeguradoraFinal(), getRamoFinal(), cliente.value);
  }

  function atualizarPreview() {
    preview.textContent =
      obterNomeNovo() || "Preencha seguradora, ramo e cliente.";
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

    infoDestinos.textContent =
      `IMPORTAR → ${importar ? importar.name : "não configurada"}\n` +
      `IMPRIMIR → ${imprimir ? imprimir.name : "não configurada"}`;
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

function criarSubmoduloJuntar() {
  const details = el("details", "submodulo");

  details.dataset.submodulo = "juntar";

  const summary = el("summary", "", "Juntar PDFs");

  const corpo = el("div", "submodulo-corpo");

  corpo.appendChild(
    el(
      "div",
      "texto-pequeno",
      "Selecione dois ou mais PDFs na ordem em que deseja juntá-los.",
    ),
  );

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
  configurarAccordionPersistente(
    [proposta, salvar, juntar],
    STORAGE_PDF_SUBMODULO_ABERTO,
    "submodulo",
  );

  corpo.appendChild(proposta);

  corpo.appendChild(salvar);

  corpo.appendChild(juntar);

  details.appendChild(summary);

  details.appendChild(corpo);

  return details;
}

export { criarModuloPdf };
