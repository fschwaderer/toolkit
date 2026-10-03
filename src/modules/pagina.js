import { shadow, definirStatus } from "../core/ui.js";
import { el, configurarAccordionPersistente } from "../core/dom.js";
import { baixarBlob, canvasParaBlob } from "../core/utils.js";
import { STORAGE_PAGINA_SUBMODULO_ABERTO } from "../core/storage.js";

const paginaEstado = {
  selecionado: null,
  pararSeletor: null,
  desfazer: [],
  captura: null,
  closeOriginal: null,
};

function paginaInterno(no) {
  return (
    paginaEhElemento(no) &&
    (no.id === "fausto-toolkit-host" ||
      no.closest("#fausto-toolkit-host,[data-ft-pagina-overlay]") ||
      no.getRootNode() === shadow)
  );
}

function paginaElementos(selector) {
  return Array.from(document.querySelectorAll(selector)).filter(
    (no) => !paginaInterno(no),
  );
}

function paginaTexto(no) {
  return (no.innerText ?? no.textContent ?? "").trim();
}

async function paginaCopiar(texto) {
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("Clipboard indisponível");
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
    if (!ok)
      throw new Error(
        "Não foi possível copiar. Use o resultado exibido para copiar manualmente.",
      );
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
  input.style.cssText =
    "box-sizing:border-box;width:100%;margin:4px 0 8px;padding:7px";
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
  area.style.cssText =
    "box-sizing:border-box;width:100%;height:150px;font:11px monospace;padding:6px;margin:6px 0;resize:vertical";
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
    const irmaos = atual.parentElement
      ? Array.from(atual.parentElement.children).filter(
          (x) => x.localName === atual.localName,
        )
      : [];
    if (irmaos.length > 1)
      parte += ":nth-of-type(" + (irmaos.indexOf(atual) + 1) + ")";
    partes.unshift(parte);
  }
  return partes.join(" > ");
}

function paginaXpath(no) {
  const partes = [];
  for (let atual = no; paginaEhElemento(atual); atual = atual.parentElement) {
    const irmaos = atual.parentElement
      ? Array.from(atual.parentElement.children).filter(
          (x) => x.localName === atual.localName,
        )
      : [atual];
    partes.unshift(
      "*[local-name()=" +
        JSON.stringify(atual.localName) +
        "][" +
        (irmaos.indexOf(atual) + 1) +
        "]",
    );
  }
  return "/" + partes.join("/");
}

function paginaInspecionar(no) {
  const css = paginaCss(no);
  const contexto = paginaExpressaoDocumento(no.ownerDocument);
  const seletorCodigo =
    contexto.codigo + ".querySelector(" + JSON.stringify(css) + ")";
  return {
    documento: no.ownerDocument.URL,
    executarNoConsoleDoFrame: contexto.consoleFrame,
    tag: no.localName,
    id: no.id,
    classes: no.getAttribute("class") || "",
    texto: paginaTexto(no).slice(0, 20000),
    href: no.getAttribute("href"),
    src: no.getAttribute("src"),
    atributos: Object.fromEntries(
      Array.from(no.attributes).map((a) => [a.name, a.value]),
    ),
    css,
    xpath: paginaXpath(no),
    querySelector: seletorCodigo,
    clicar: "const elemento = " + seletorCodigo + ";\nelemento?.click();",
    preencher:
      "const campo = " +
      seletorCodigo +
      ';\nif (campo) {\n  campo.value = "VALOR";\n  campo.dispatchEvent(new Event("input", { bubbles: true }));\n  campo.dispatchEvent(new Event("change", { bubbles: true }));\n}',
    html: no.outerHTML.slice(0, 200000),
  };
}

function criarPaginaSeletor() {
  const { details, corpo } = paginaSubmodulo("seletor", "Selecionar elemento");
  corpo.appendChild(
    el(
      "div",
      "info",
      "Selecione o documento de trabalho acima e clique dentro dele. CSS/XPath são relativos ao documento indicado no resultado. Para outro domínio, execute o código copiado no contexto desse iframe no DevTools. Esc cancela.",
    ),
  );
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
      if (!dados || contextoDados !== ftFrame.contexto)
        throw new Error("Selecione um elemento no documento atual primeiro.");
      return paginaCopiar(dados[chave]);
    });
  }
  paginaBotao(corpo, "Copiar todas as informações", () =>
    paginaCopiar(area.value),
  );
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
    if (
      paginaInterno(original) ||
      ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(original.tagName) ||
      css.display === "none" ||
      css.visibility === "hidden" ||
      css.visibility === "collapse"
    )
      clone.remove();
    else if (
      [
        "BR",
        "P",
        "DIV",
        "LI",
        "TR",
        "H1",
        "H2",
        "H3",
        "SECTION",
        "ARTICLE",
      ].includes(original.tagName)
    )
      clone.appendChild(doc.createTextNode("\n"));
  }
  return (copia.textContent || "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function criarPaginaExtrair() {
  const { details, corpo } = paginaSubmodulo("extrair", "Extrair conteúdo");
  corpo.appendChild(
    el(
      "div",
      "info",
      "Extrai o conteúdo do documento de trabalho escolhido acima. Outros frames e conteúdo ainda não carregado não entram automaticamente. CPF/CNPJ/telefones são candidatos, sem validação.",
    ),
  );
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
  paginaBotao(corpo, "Baixar TXT", () =>
    paginaBaixarTexto(area.value, "pagina-" + tipo.value + ".txt"),
  );
  return details;
}

function paginaTabelaGrade(tabela) {
  const linhas = Array.from(tabela.rows).filter(
    (l) => l.closest("table") === tabela,
  );
  const grade = [];
  if (linhas.length > 20000) throw new Error("Tabela excede 20.000 linhas.");
  linhas.forEach((linha, r) => {
    grade[r] ||= [];
    let c = 0;
    for (const celula of linha.cells) {
      while (grade[r][c] !== undefined) c++;
      const altura =
        celula.rowSpan === 0 ? linhas.length - r : Math.max(1, celula.rowSpan);
      const largura = Math.max(1, celula.colSpan);
      if (c + largura > 1000 || altura > 20000)
        throw new Error("Tabela excede o limite de expansão.");
      const texto = paginaTexto(celula);
      for (let rr = r; rr < Math.min(r + altura, linhas.length); rr++) {
        grade[rr] ||= [];
        for (let cc = c; cc < c + largura; cc++)
          grade[rr][cc] = rr === r && cc === c ? texto : "";
      }
      c += largura;
    }
  });
  const largura = Math.max(0, ...grade.map((l) => l.length));
  return grade.map((l) =>
    Array.from({ length: largura }, (_, c) => l[c] ?? ""),
  );
}

function paginaTabelaFormato(grade, formato) {
  // Evita execução de fórmulas quando o CSV/TSV é aberto em planilhas.
  const segura = (valor) => (/^[\s]*[=+@-]/.test(valor) ? "'" + valor : valor);
  if (formato === "csv")
    return grade
      .map((l) =>
        l.map((v) => '"' + segura(v).replace(/"/g, '""') + '"').join(";"),
      )
      .join("\r\n");
  if (formato === "tsv")
    return grade
      .map((l) => l.map((v) => segura(v).replace(/[\t\r\n]+/g, " ")).join("\t"))
      .join("\n");
  const linha = (l) =>
    "| " +
    l.map((v) => v.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ")).join(" | ") +
    " |";
  return grade.length
    ? [
        linha(grade[0]),
        linha(grade[0].map(() => "---")),
        ...grade.slice(1).map(linha),
      ].join("\n")
    : "";
}

function criarPaginaTabelas() {
  const { details, corpo } = paginaSubmodulo("tabelas", "Tabelas");
  corpo.appendChild(
    el(
      "div",
      "info",
      "Detecta tabelas HTML no documento escolhido. Células mescladas são expandidas com espaços vazios. A primeira linha vira cabeçalho no Markdown.",
    ),
  );
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
      paginaBotao(
        lista,
        "Tabela " + tabela.numero + " — " + tabela.linhas + " linhas",
        async () => {
          if (ftFrame.contexto !== contextoTabela)
            throw new Error("O documento mudou. Atualize a lista de tabelas.");
          selecionada = tabela.id;
          area.value = await paginaExecutar("tabela", {
            id: selecionada,
            formato: formato.value,
          });
          definirStatus("Tabela " + tabela.numero + " selecionada.");
        },
      );
    if (!tabelas.length)
      lista.appendChild(el("div", "info", "Nenhuma tabela HTML encontrada."));
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
    if (!selecionada || contextoTabela !== ftFrame.contexto)
      throw new Error(
        "Atualize as tabelas e selecione uma do documento atual.",
      );
    area.value = await paginaExecutar("tabela", {
      id: selecionada,
      formato: formato.value,
    });
    return area.value;
  };
  formato.addEventListener("change", () => {
    if (selecionada) gerar().catch((e) => definirStatus(e.message, "erro"));
  });
  paginaBotao(corpo, "Copiar tabela", async () => paginaCopiar(await gerar()));
  paginaBotao(corpo, "Baixar tabela", async () =>
    paginaBaixarTexto(
      (formato.value === "csv" ? "\uFEFF" : "") + (await gerar()),
      "tabela." + formato.value,
    ),
  );
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
      label.append(
        check,
        document.createTextNode(
          " " + (link.texto || link.url) + "\n" + link.url,
        ),
      );
      lista.appendChild(label);
      itens.push({ check, url: link.url });
    }
    definirStatus(itens.length + " links encontrados.");
  };
  paginaBotao(corpo, "Atualizar links", atualizar, "botao btn-blue");
  corpo.appendChild(lista);
  paginaBotao(corpo, "Selecionar todos", () =>
    itens.forEach((i) => (i.check.checked = true)),
  );
  paginaBotao(corpo, "Limpar seleção", () =>
    itens.forEach((i) => (i.check.checked = false)),
  );
  const selecionados = () => {
    if (contextoLinks !== ftFrame.contexto)
      throw new Error("Atualize os links do documento atual.");
    return itens.filter((i) => i.check.checked).map((i) => i.url);
  };
  paginaBotao(corpo, "Copiar selecionados", () =>
    paginaCopiar(selecionados().join("\n")),
  );
  paginaBotao(corpo, "Baixar lista TXT", () =>
    paginaBaixarTexto(selecionados().join("\n"), "links.txt"),
  );
  paginaBotao(corpo, "Abrir selecionados (até 10)", () => {
    const urls = selecionados().filter((u) => /^https?:/.test(u));
    if (!urls.length) throw new Error("Selecione links HTTP/HTTPS.");
    if (urls.length > 10)
      throw new Error("Selecione no máximo 10 links por vez.");
    let abertos = 0;
    for (const u of urls) {
      const aba = window.open("about:blank", "_blank");
      if (aba) {
        aba.opener = null;
        aba.location.href = u;
        abertos++;
      }
    }
    definirStatus(
      abertos + " abas abertas. O navegador pode bloquear múltiplas abas.",
    );
  });
  filtro.addEventListener("change", () =>
    atualizar().catch((e) => definirStatus(e.message, "erro")),
  );
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
  corpo.appendChild(
    el(
      "div",
      "info",
      "Mudanças locais no documento escolhido. Cada documento mantém seu próprio histórico para desfazer. Habilitar campos não altera permissões do servidor.",
    ),
  );
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
  paginaBotao(corpo, "Pausar animações", () =>
    paginaExecutar("modificar", { tipo: "pausar" }),
  );
  paginaBotao(corpo, "Tentar impedir window.close()", async () => {
    await paginaExecutar("modificar", { tipo: "close" });
    definirStatus(
      "Ativado nesse documento para futuras chamadas. Não cobre referências já salvas nem fechamento pelo navegador.",
    );
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
    el(
      "div",
      "info",
      "Captura do documento escolhido via html2canvas, sem o Toolkit. Para um frame de outro domínio, abra-o em outra aba para capturar. CSS avançado, vídeos, iframes externos e imagens sem CORS podem ficar ausentes. Não carrega automaticamente conteúdo por rolagem.",
    ),
  );
  const formato = paginaSelect(corpo, "Formato", [
    ["image/png", "PNG"],
    ["image/jpeg", "JPG"],
  ]);
  const preview = el("img");
  preview.alt = "Prévia da captura";
  preview.style.cssText =
    "max-width:100%;max-height:220px;object-fit:contain;display:none";
  let urlPreview = null;
  const capturar = async (inteira) => {
    const contexto = paginaContexto();
    if (!contexto.doc)
      throw new Error(
        "Para capturar esse iframe de outro domínio, use Abrir documento escolhido em nova aba e faça a captura lá.",
      );
    const doc = contexto.doc,
      janela = doc.defaultView;
    if (typeof html2canvas !== "function")
      throw new Error(
        "html2canvas não carregou. Verifique o @require no Tampermonkey.",
      );
    definirStatus("Capturando…");
    const raiz = doc.documentElement;
    const width = inteira
      ? Math.max(raiz.scrollWidth, janela.innerWidth)
      : janela.innerWidth;
    const height = inteira
      ? Math.max(raiz.scrollHeight, janela.innerHeight)
      : janela.innerHeight;
    if (width > 32767 || height > 32767 || width * height > 40000000)
      throw new Error(
        "Página muito grande. Capture a área visível ou um elemento.",
      );
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
      ignoreElements: (no) =>
        no.id === "fausto-toolkit-host" ||
        no.hasAttribute("data-ft-pagina-overlay"),
    });
    if (paginaContexto().doc !== doc)
      throw new Error("O documento mudou durante a captura. Repita.");
    paginaEstado.captura = canvas;
    if (urlPreview) URL.revokeObjectURL(urlPreview);
    urlPreview = URL.createObjectURL(await canvasParaBlob(canvas, "image/png"));
    preview.src = urlPreview;
    preview.style.display = "block";
    definirStatus(
      "Captura pronta: " + canvas.width + " × " + canvas.height + ".",
      "ok",
    );
  };
  paginaBotao(
    corpo,
    "Capturar área visível",
    () => capturar(false),
    "botao btn-blue",
  );
  paginaBotao(corpo, "Capturar página inteira", () => capturar(true));
  corpo.appendChild(preview);
  paginaBotao(corpo, "Salvar captura", async () => {
    if (!paginaEstado.captura) throw new Error("Faça uma captura primeiro.");
    baixarBlob(
      await canvasParaBlob(paginaEstado.captura, formato.value, 0.92),
      "pagina-" +
        Date.now() +
        (formato.value === "image/png" ? ".png" : ".jpg"),
    );
  });
  paginaBotao(corpo, "Copiar captura (PNG)", async () => {
    if (!paginaEstado.captura) throw new Error("Faça uma captura primeiro.");
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
      throw new Error(
        "Cópia de imagem indisponível neste navegador/contexto. Salve o arquivo.",
      );
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": canvasParaBlob(paginaEstado.captura, "image/png"),
      }),
    ]);
    definirStatus("Imagem copiada.", "ok");
  });
  return details;
}

function criarPaginaDev() {
  const { details, corpo } = paginaSubmodulo("dev", "Storage / Dev");
  corpo.appendChild(
    el(
      "div",
      "info",
      "Dados do documento/domínio escolhido. Cookies HttpOnly não são acessíveis. O resultado pode conter dados de sessão: revise antes de compartilhar. Limpar storage pode desconectar você.",
    ),
  );
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
      area.value = JSON.stringify(
        await paginaExecutar("dev", { tipo: tipo.value }),
        null,
        2,
      );
    },
    "botao btn-blue",
  );
  const area = paginaResultado(corpo);
  paginaBotao(corpo, "Copiar resultado", () => paginaCopiar(area.value));
  paginaBotao(corpo, "Baixar JSON", () =>
    paginaBaixarTexto(
      area.value,
      "pagina-" + tipo.value + ".json",
      "application/json",
    ),
  );
  paginaBotao(corpo, "Copiar URL completa", async () =>
    paginaCopiar(await paginaExecutar("url")),
  );
  paginaBotao(corpo, "Copiar URL sem parâmetros / fragmento", async () => {
    const url = new URL(await paginaExecutar("url"));
    url.search = "";
    url.hash = "";
    return paginaCopiar(url.href);
  });
  paginaBotao(corpo, "Recarregar página", () => paginaExecutar("recarregar"));
  corpo.appendChild(
    el(
      "div",
      "info",
      "Recarregar atua no documento escolhido. Para ignorar o cache no Chrome/Windows, use Ctrl + Shift + R.",
    ),
  );
  const limpar = paginaSelect(corpo, "Limpeza", [
    ["local", "Somente localStorage"],
    ["session", "Somente sessionStorage"],
    ["ambos", "localStorage e sessionStorage"],
  ]);
  paginaBotao(corpo, "Limpar storage escolhido…", async () => {
    const contexto = ftFrame.contexto,
      url = await paginaExecutar("url");
    if (
      !window.confirm(
        "Limpar " +
          limpar.selectedOptions[0].textContent +
          " de " +
          new URL(url).origin +
          "? Isso pode encerrar a sessão e apagar preferências do site.",
      )
    )
      return;
    if (ftFrame.contexto !== contexto)
      throw new Error("O documento mudou. Repita a operação.");
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
  const submodulos = [
    criarPaginaCapturar(),
    criarPaginaSeletor(),
    criarPaginaExtrair(),
    criarPaginaTabelas(),
    criarPaginaLinks(),
    criarPaginaModificar(),
    criarPaginaDev(),
  ];
  configurarAccordionPersistente(
    submodulos,
    STORAGE_PAGINA_SUBMODULO_ABERTO,
    "submodulo",
  );
  submodulos.forEach((s) => corpo.appendChild(s));
  details.appendChild(corpo);
  return details;
}

function paginaIdAleatorio() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return (
    h.slice(0, 8) +
    "-" +
    h.slice(8, 12) +
    "-" +
    h.slice(12, 16) +
    "-" +
    h.slice(16, 20) +
    "-" +
    h.slice(20)
  );
}

const FT_FRAME_PROTOCOLO = "FAUSTO_TOOLKIT_FRAME_V150";

let ftFrame = null;

export function inicializarEstadoFrames() {
  ftFrame = {
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
}

function paginaEhElemento(no) {
  return !!no && no.nodeType === 1;
}

function paginaEstadoDocumento(doc) {
  let estado = ftFrame.estados.get(doc);
  if (!estado) {
    estado = {
      selecionado: null,
      desfazer: doc === document ? paginaEstado.desfazer : [],
      tabelas: new Map(),
      parar: null,
      closeOriginal: null,
    };
    ftFrame.estados.set(doc, estado);
  }
  return estado;
}

function paginaJanelas() {
  const resultado = [];
  const vistos = new Set();
  const visitar = (janela, caminho, nivel) => {
    if (!janela || vistos.has(janela) || nivel > 12 || resultado.length >= 250)
      return;
    vistos.add(janela);
    resultado.push({ janela, caminho });
    try {
      for (let i = 0; i < janela.length; i++)
        visitar(janela.frames[i], [...caminho, i], nivel + 1);
    } catch {}
  };
  visitar(window, [], 0);
  return resultado;
}

function paginaRpc(frame, acao, args = {}, prazo = 15000) {
  if (typeof GM_addValueChangeListener !== "function")
    return Promise.reject(
      new Error(
        "Atualize o cabeçalho completo do userscript para habilitar a conexão com frames.",
      ),
    );
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
      finalizar(
        novo.ok ? null : new Error(novo.erro || "Falha no iframe."),
        novo.dados,
      );
    });
    timer = setTimeout(
      () =>
        finalizar(
          new Error(
            "O iframe não respondeu. Atualize a lista; o frame pode ter navegado ou o Tampermonkey pode estar bloqueado nele.",
          ),
        ),
      prazo,
    );
    ftFrame.pedidos.add(finalizar);
    GM_setValue(comando, { id, acao, args });
  });
}

function paginaDescobrirFrames() {
  const janelas = paginaJanelas();
  for (const [janela] of ftFrame.registros)
    if (!janelas.some((j) => j.janela === janela))
      ftFrame.registros.delete(janela);
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
    const nome = caminho.length
      ? "Iframe " + caminho.map((i) => i + 1).join(".")
      : "Página principal";
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
    contextos.set(chave, {
      chave,
      janela,
      doc,
      frame: doc ? null : registro,
      url,
      rotulo,
    });
  }
  ftFrame.contextos = contextos;
  if (!contextos.has(ftFrame.contexto)) ftFrame.contexto = "principal";
  return contextos;
}

function paginaContexto() {
  paginaDescobrirFrames();
  const contexto = ftFrame.contextos.get(ftFrame.contexto);
  if (!contexto || (!contexto.doc && !contexto.frame))
    throw new Error(
      "O Toolkit não está conectado a esse iframe. Habilite o script nesse domínio ou abra o frame em outra aba.",
    );
  return contexto;
}

async function paginaExecutar(acao, args = {}) {
  const contexto = paginaContexto();
  const resultado = contexto.doc
    ? await paginaOperacaoLocal(contexto.doc, acao, args)
    : await paginaRpc(
        contexto.frame,
        acao,
        args,
        acao === "selecionar" ? 120000 : 15000,
      );
  const atual = paginaContexto();
  if (
    atual.chave !== contexto.chave ||
    atual.doc !== contexto.doc ||
    atual.frame?.id !== contexto.frame?.id
  )
    throw new Error(
      "O documento mudou durante a operação. Atualize a lista e repita.",
    );
  return resultado;
}

function paginaExpressaoDocumento(doc) {
  let atual = doc,
    partes = [];
  try {
    while (atual.defaultView !== window.top) {
      const frame = atual.defaultView.frameElement;
      if (!frame) return { codigo: "document", consoleFrame: true };
      partes.unshift(
        ".querySelector(" +
          JSON.stringify(paginaCss(frame)) +
          ").contentDocument",
      );
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
    overlay.style.cssText =
      "position:fixed;pointer-events:none;border:2px solid #0d6efd;background:rgba(13,110,253,.12);z-index:2147483646;display:none;box-sizing:border-box";
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
      Object.assign(overlay.style, {
        display: "block",
        left: r.left + "px",
        top: r.top + "px",
        width: r.width + "px",
        height: r.height + "px",
      });
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
  const pedido = contexto.doc
    ? paginaEscolherLocal(contexto.doc)
    : paginaRpc(contexto.frame, "selecionar", {}, 120000);
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
        definirStatus(
          erro.message,
          erro.message === "Seleção cancelada." ? "normal" : "erro",
        );
      }
    });
}

async function paginaOperacaoLocal(doc, acao, args = {}) {
  const estado = paginaEstadoDocumento(doc),
    janela = doc.defaultView;
  const elementos = (seletor) =>
    Array.from(doc.querySelectorAll(seletor)).filter(
      (no) => !paginaInterno(no),
    );
  const alvo = () => {
    const no = estado.selecionado;
    if (!no?.isConnected || paginaInterno(no))
      throw new Error("Selecione um elemento neste documento primeiro.");
    if (["HTML", "HEAD", "BODY"].includes(no.tagName))
      throw new Error("Selecione um elemento dentro da página.");
    return no;
  };
  const atributo = (no, nome, valor) => {
    const antes = no.getAttribute(nome);
    estado.desfazer.push(() =>
      antes === null ? no.removeAttribute(nome) : no.setAttribute(nome, antes),
    );
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
    if (!no || paginaInterno(no))
      throw new Error("Elemento não encontrado neste documento.");
    estado.selecionado = no;
    if (doc === document) paginaEstado.selecionado = no;
    return paginaInspecionar(no);
  }
  if (acao === "extrair") {
    if (args.tipo === "selecao") return janela.getSelection()?.toString() || "";
    const texto = paginaTextoVisivel(doc),
      padroes = {
        emails: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
        telefones:
          /(?<!\d)(?:\+?55[\s.-]?)?(?:\(?[1-9]\d\)?[\s.-]?)?(?:9\d{4}|[2-5]\d{3})[\s.-]?\d{4}(?!\d)/g,
        cpf: /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g,
        cnpj: /(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g,
      };
    if (args.tipo === "texto") return texto;
    if (!padroes[args.tipo]) throw new Error("Tipo de extração inválido.");
    return Array.from(new Set(texto.match(padroes[args.tipo]) || [])).join(
      "\n",
    );
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
    if (!tabela?.isConnected)
      throw new Error(
        "A tabela mudou. Atualize a lista e selecione novamente.",
      );
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
      if (
        !["http:", "https:", "mailto:", "tel:", "blob:"].includes(url.protocol)
      )
        continue;
      if (
        args.filtro === "externos" &&
        (!["http:", "https:"].includes(url.protocol) ||
          url.origin === janela.location.origin)
      )
        continue;
      if (
        args.filtro === "downloads" &&
        !a.hasAttribute("download") &&
        !/\.(pdf|zip|rar|7z|docx?|xlsx?|csv|txt|jpe?g|png|webp|mp4)$/i.test(
          url.pathname,
        )
      )
        continue;
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
        return {
          id: f.id,
          nome: f.name,
          src: f.getAttribute("src"),
          acessivel,
        };
      });
    if (args.tipo === "scripts")
      return elementos("script").map((s) => ({
        src: s.src || "(inline)",
        tipo: s.type || "text/javascript",
        async: s.async,
        defer: s.defer,
      }));
    if (args.tipo === "cookies")
      return doc.cookie
        ? doc.cookie.split(/;\s*/).map((c) => {
            const p = c.indexOf("=");
            return { nome: c.slice(0, p), valor: c.slice(p + 1) };
          })
        : [];
    if (!["local", "session"].includes(args.tipo))
      throw new Error("Tipo inválido.");
    const storage =
        args.tipo === "local" ? janela.localStorage : janela.sessionStorage,
      dados = Object.create(null);
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      dados[k] = storage.getItem(k);
    }
    return dados;
  }
  if (acao === "url") return doc.URL;
  if (acao === "limparStorage") {
    if (!["local", "session", "ambos"].includes(args.tipo))
      throw new Error("Tipo inválido.");
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
    if (!ultima)
      throw new Error("Nenhuma alteração neste documento para desfazer.");
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
        estilo.textContent =
          "* { animation-play-state: paused !important; transition: none !important; }";
        doc.documentElement.appendChild(estilo);
        const animacoes =
          doc.getAnimations?.().filter((a) => a.playState === "running") || [];
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
        const principal =
          doc === document && typeof unsafeWindow !== "undefined"
            ? unsafeWindow
            : janela;
        const original = principal.close,
          bloqueado = () => {};
        principal.close = bloqueado;
        if (principal.close !== bloqueado)
          throw new Error("Não foi possível substituir window.close().");
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
            if (pai.isConnected)
              pai.insertBefore(
                no,
                proximo?.parentNode === pai ? proximo : null,
              );
          });
          no.remove();
        } else if (args.tipo === "editar")
          atributo(no, "contenteditable", "true");
        else if (args.tipo === "habilitar") {
          atributo(no, "disabled", null);
          atributo(no, "readonly", null);
          for (let pai = no.parentElement; pai; pai = pai.parentElement)
            if (pai.tagName === "FIELDSET" && pai.disabled)
              atributo(pai, "disabled", null);
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
    const listener = GM_addValueChangeListener(
      canal,
      async (_k, _old, pedido) => {
        if (
          !pedido ||
          typeof pedido.id !== "string" ||
          !/^[a-f0-9-]{36}$/i.test(pedido.id)
        )
          return;
        const resposta = canal + "_R_" + pedido.id;
        let resultado;
        try {
          const dados = await paginaOperacaoLocal(
            document,
            pedido.acao,
            pedido.args,
          );
          if (JSON.stringify(dados)?.length > ftFrame.limite)
            throw new Error(
              "Resultado muito grande para a conexão. Abra o iframe em outra aba.",
            );
          resultado = { id: pedido.id, ok: true, dados };
        } catch (e) {
          resultado = { id: pedido.id, ok: false, erro: e.message };
        }
        GM_setValue(resposta, resultado);
        setTimeout(() => GM_deleteValue(resposta), 30000);
      },
    );
    // postMessage anuncia somente o identificador aleatório. Conteúdo e comandos
    // trafegam no storage privado do userscript, nunca pelo DOM da seguradora.
    const anunciar = () =>
      window.top.postMessage(
        { protocolo: FT_FRAME_PROTOCOLO, id: ftFrame.id },
        "*",
      );
    window.addEventListener("message", (e) => {
      if (
        e.source === window.top &&
        e.data?.protocolo === FT_FRAME_PROTOCOLO &&
        e.data?.descobrir === true
      )
        anunciar();
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
    if (
      msg?.protocolo !== FT_FRAME_PROTOCOLO ||
      typeof msg.id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(msg.id) ||
      !evento.source ||
      evento.source === window
    )
      return;
    const fonte = evento.source;
    if (
      !paginaJanelas().some((j) => j.janela === fonte) ||
      pendentes.has(fonte)
    )
      return;
    const anterior = ftFrame.registros.get(fonte);
    if (anterior?.id === msg.id && Date.now() - anterior.verificadoEm < 800)
      return;
    pendentes.add(fonte);
    try {
      const meta = await paginaRpc({ id: msg.id }, "ping", {}, 2500);
      if (
        new URL(meta.url).origin !== evento.origin ||
        !paginaJanelas().some((j) => j.janela === fonte)
      )
        return;
      ftFrame.registros.set(fonte, {
        id: msg.id,
        url: meta.url,
        titulo: meta.titulo,
        verificadoEm: Date.now(),
      });
      ftFrame.atualizarUI?.();
    } catch {
    } finally {
      pendentes.delete(fonte);
    }
  });
  window.addEventListener(
    "pagehide",
    () => {
      for (const cancelar of [...ftFrame.pedidos])
        cancelar(new Error("Página encerrada."));
    },
    { once: true },
  );
}

function criarPaginaContextos(corpo) {
  corpo.appendChild(
    el(
      "div",
      "info",
      "Um único painel controla a página e seus iframes. Escolha o documento abaixo antes de selecionar elementos, extrair, exportar tabelas ou modificar. Frames de outro domínio precisam ter o userscript habilitado pelo Tampermonkey.",
    ),
  );
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
          janela.postMessage(
            { protocolo: FT_FRAME_PROTOCOLO, descobrir: true },
            "*",
          );
        } catch {}
    definirStatus(
      "Lista atualizada. Frames disponíveis aparecerão após a conexão.",
    );
  });
  paginaBotao(corpo, "Abrir documento escolhido em nova aba", async () => {
    const aba = window.open("about:blank", "_blank");
    if (!aba) throw new Error("O navegador bloqueou a nova aba.");
    aba.opener = null;
    try {
      const url = await paginaExecutar("url");
      if (!/^https?:\/\//i.test(url))
        throw new Error(
          "Esse frame não tem URL HTTP/HTTPS que possa ser aberta separadamente.",
        );
      aba.location.href = url;
    } catch (erro) {
      aba.close();
      throw erro;
    }
  });
}

export { criarModuloPagina, paginaEstado, ftFrame, paginaIniciarConexaoFrames };
