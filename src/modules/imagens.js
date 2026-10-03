import {
  limparParteNome,
  baixarBlob,
  erro,
  canvasParaBlob,
} from "../core/utils.js";
import { rootHost, definirStatus } from "../core/ui.js";
import { el, configurarAccordionPersistente } from "../core/dom.js";
import { STORAGE_IMAGENS_SUBMODULO_ABERTO } from "../core/storage.js";

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
      const mime = url.substring(
        5,
        url.indexOf(";") > 0 ? url.indexOf(";") : url.indexOf(","),
      );

      return `imagem-${indice}.` + extensaoPorMimeImagem(mime);
    }

    const u = new URL(url, location.href);

    let nome = decodeURIComponent(
      u.pathname.split("/").filter(Boolean).pop() || "",
    );

    nome = limparParteNome(nome);

    if (nome && /\.[a-z0-9]{2,5}$/i.test(nome)) {
      return nome;
    }
  } catch {
    // usa nome padrão
  }

  return `imagem-${indice}.img`;
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
        if (
          resposta.status >= 200 &&
          resposta.status < 300 &&
          resposta.response
        ) {
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

      img.onerror = () =>
        reject(new Error("Formato de imagem não suportado pelo navegador."));

      img.src = url;
    });
  } finally {
    // A URL só pode ser revogada depois do decode.
    // O setTimeout evita quebrar drawImage em alguns Chromium.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
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
  const base =
    limparParteNome(nome || "imagem").replace(/\.[a-z0-9]{2,6}$/i, "") ||
    "imagem";

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

function criarSubmoduloImagensPagina() {
  const details = el("details", "submodulo");

  details.dataset.submodulo = "pagina";

  const summary = el("summary", "", "Imagens da página");

  const corpo = el("div", "submodulo-corpo");

  const info = el(
    "div",
    "texto-pequeno",
    "Lista as imagens <img> carregadas na página atual. Você pode selecionar e baixar várias de uma vez.",
  );

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

    resumo.textContent = dados.length
      ? `${dados.length} imagem(ns) encontrada(s).`
      : "Nenhuma imagem <img> encontrada nesta página.";

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

      const tamanho = el(
        "div",
        "",
        item.largura && item.altura
          ? `${item.largura} × ${item.altura}px`
          : "Dimensões indisponíveis",
      );

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

    const todosMarcados =
      checks.length > 0 && checks.every((check) => check.checked);

    checks.forEach((check) => {
      check.checked = !todosMarcados;
    });

    selecionarTodos.textContent = todosMarcados
      ? "Selecionar todos"
      : "Desmarcar todos";
  };

  baixar.onclick = async function () {
    const selecionados = Array.from(
      lista.querySelectorAll('input[type="checkbox"]:checked'),
    )
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

      definirStatus(
        `${concluidas}/${selecionados.length} imagem(ns) baixada(s).`,
        concluidas === selecionados.length ? "ok" : "erro",
      );
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

function criarSubmoduloConverterImagem() {
  const details = el("details", "submodulo");

  details.dataset.submodulo = "converter";

  const summary = el("summary", "", "Converter / redimensionar");

  const corpo = el("div", "submodulo-corpo");

  corpo.appendChild(
    el(
      "div",
      "texto-pequeno",
      "Selecione uma ou várias imagens. O processamento é feito localmente no navegador.",
    ),
  );

  const arquivosInfo = el("div", "info", "Nenhuma imagem selecionada.");

  const selecionar = el("button", "botao-secundario", "Selecionar imagens");

  let arquivos = [];

  selecionar.onclick = async function () {
    arquivos = await criarInputArquivoImagem(true);

    arquivosInfo.textContent = arquivos.length
      ? arquivos.map((arquivo) => arquivo.name).join("\n")
      : "Nenhuma imagem selecionada.";
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

        definirStatus(
          `Processando ${i + 1}/${arquivos.length}: ${arquivo.name}`,
        );

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

              alturaFinal = Math.max(
                1,
                Math.round(
                  (img.naturalHeight * larguraFinal) / img.naturalWidth,
                ),
              );
            } else if (alturaInformada && !larguraInformada) {
              alturaFinal = alturaInformada;

              larguraFinal = Math.max(
                1,
                Math.round(
                  (img.naturalWidth * alturaFinal) / img.naturalHeight,
                ),
              );
            } else if (larguraInformada && alturaInformada) {
              const escalaBox = Math.min(
                larguraInformada / img.naturalWidth,
                alturaInformada / img.naturalHeight,
              );

              larguraFinal = Math.max(
                1,
                Math.round(img.naturalWidth * escalaBox),
              );

              alturaFinal = Math.max(
                1,
                Math.round(img.naturalHeight * escalaBox),
              );
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

        const blob = await canvasParaBlob(
          canvas,
          mimeImagemSaida(formato.value),
          q,
        );

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

function criarSubmoduloJuntarImagens() {
  const details = el("details", "submodulo");

  details.dataset.submodulo = "juntar";

  const summary = el("summary", "", "Juntar imagens");

  const corpo = el("div", "submodulo-corpo");

  corpo.appendChild(
    el(
      "div",
      "texto-pequeno",
      "Selecione duas ou mais imagens, reordene e gere uma única imagem vertical ou horizontal.",
    ),
  );

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

        [arquivos[indice - 1], arquivos[indice]] = [
          arquivos[indice],
          arquivos[indice - 1],
        ];

        renderFila();
      };

      baixo.onclick = function () {
        if (indice >= arquivos.length - 1) {
          return;
        }

        [arquivos[indice], arquivos[indice + 1]] = [
          arquivos[indice + 1],
          arquivos[indice],
        ];

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
        larguraCanvas =
          imagens.reduce((total, img) => total + img.naturalWidth, 0) +
          gap * (imagens.length - 1);

        alturaCanvas = Math.max(...imagens.map((img) => img.naturalHeight));
      } else {
        larguraCanvas = Math.max(...imagens.map((img) => img.naturalWidth));

        alturaCanvas =
          imagens.reduce((total, img) => total + img.naturalHeight, 0) +
          gap * (imagens.length - 1);
      }

      const limiteDimensao = 32767;

      if (larguraCanvas > limiteDimensao || alturaCanvas > limiteDimensao) {
        throw new Error(
          `Resultado muito grande (${larguraCanvas}×${alturaCanvas}px). Reduza as imagens antes de juntar.`,
        );
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

      const blob = await canvasParaBlob(
        canvas,
        mimeImagemSaida(formato.value),
        q,
      );

      baixarBlob(
        blob,
        trocarExtensaoImagem(nome.value || "IMAGENS JUNTAS", formato.value),
      );

      definirStatus(
        `Imagem gerada: ${larguraCanvas} × ${alturaCanvas}px.`,
        "ok",
      );
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

function criarModuloImagens() {
  const details = el("details", "modulo-principal");

  details.dataset.modulo = "imagens";

  const summary = el("summary", "", "Imagens");

  const corpo = el("div", "modulo-corpo");

  const pagina = criarSubmoduloImagensPagina();

  const converter = criarSubmoduloConverterImagem();

  const juntar = criarSubmoduloJuntarImagens();

  configurarAccordionPersistente(
    [pagina, converter, juntar],
    STORAGE_IMAGENS_SUBMODULO_ABERTO,
    "submodulo",
  );

  corpo.appendChild(pagina);

  corpo.appendChild(converter);

  corpo.appendChild(juntar);

  details.appendChild(summary);

  details.appendChild(corpo);

  return details;
}

export { criarModuloImagens };
