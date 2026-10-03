import { RAMOS } from "../core/config.js";
import { el, configurarAccordionPersistente } from "../core/dom.js";
import { formatarData, dataValida, erro } from "../core/utils.js";
import { definirStatus, shadow } from "../core/ui.js";
import { STORAGE_WHATSAPP_SUBMODULO_ABERTO } from "../core/storage.js";

function normalizarTexto(valor) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim();
}

function obterPrimeiroNome(nome) {
  return normalizarTexto(nome).split(" ")[0];
}

function obterItemSegurado(dados) {
  if (dados.ramo === "RESIDENCIA") {
    return dados.tipoImovel === "Casa"
      ? "da sua *casa*"
      : dados.tipoImovel === "Apartamento"
        ? "do seu *apartamento*"
        : "";
  }
  const item = normalizarTexto(
    dados.ramo === "AUTO" ? dados.modelo : dados.item,
  );
  if (dados.ramo === "AUTO") {
    const artigo = dados.artigoVeiculo === "da" ? "da" : "do";
    return item ? `${artigo} *${item}*` : "";
  }
  return item ? `do seu *${item}*` : "";
}

function validarDadosCotacao(dados) {
  if (!obterPrimeiroNome(dados.nome)) return "Informe o nome do cliente.";
  if (!RAMOS.includes(dados.ramo)) return "Selecione o ramo.";
  if (!obterItemSegurado(dados)) return "Informe o item segurado.";
  if (!dataValida(dados.vigencia))
    return "Informe uma vigência válida (DD/MM/AAAA).";
  return null;
}

function gerarMensagemCotacao(dados) {
  return `Olá, *${obterPrimeiroNome(dados.nome)}*! Tudo bem?\n\nO seguro ${obterItemSegurado(dados)} vence em *${dados.vigencia}*.\n\nSegue melhores opções para este ano.\n\nQualquer dúvida, estou a disposição!`;
}

function pareceNumeroTelefone(texto) {
  return /^[+\d\s().\-]+$/.test(texto) && /\d/.test(texto);
}

function elementoWhatsappVisivel(elemento) {
  const estilo = getComputedStyle(elemento);
  return (
    elemento.isConnected &&
    elemento.getClientRects().length > 0 &&
    estilo.visibility === "visible" &&
    estilo.display !== "none" &&
    !elemento.closest('[hidden], [aria-hidden="true"]')
  );
}

function nomeConversaValido(valor) {
  const texto = normalizarTexto(valor);
  const comparacao = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    !texto ||
    texto.length > 120 ||
    pareceNumeroTelefone(texto) ||
    !/\p{L}/u.test(texto)
  )
    return false;
  return (
    !/^(online|digitando|typing|gravando|recording|visto por ultimo|last seen|clique|click|pesquisar|search|chamada|voice call|video call|dados do contato|contact info|dados do grupo|group info|mais opcoes|more options|menu|voltar|back|whatsapp|hoje|today|ontem|yesterday)(\b|\.{2,})/.test(
      comparacao,
    ) && !/^\d{1,2}:\d{2}(\s*[ap]m)?$/i.test(texto)
  );
}

function localizarCabecalhoConversaWhatsapp(campo) {
  // Parte do footer da conversa, nunca do header geral ou da lista lateral.
  let container = campo.closest("footer")?.parentElement;
  while (
    container &&
    container !== document.body &&
    container !== document.documentElement
  ) {
    const cabecalhos = Array.from(container.querySelectorAll("header")).filter(
      elementoWhatsappVisivel,
    );
    if (cabecalhos.length)
      return cabecalhos.length === 1 ? cabecalhos[0] : null;
    container = container.parentElement;
  }
  return null;
}

function conversaPareceGrupo(cabecalho) {
  if (
    cabecalho.querySelector(
      '[data-icon="default-group"], [data-icon="group"], [data-testid="group-info"]',
    )
  )
    return true;
  const textos = [
    cabecalho.innerText || cabecalho.textContent || "",
    ...Array.from(cabecalho.querySelectorAll("[title], [aria-label]")).map(
      (elemento) =>
        `${elemento.getAttribute("title") || ""} ${elemento.getAttribute("aria-label") || ""}`,
    ),
  ].join("\n");
  return (
    /(?:dados do grupo|group info|\d+\s+(?:participantes|participants|membros|members)|clique.*(?:grupo|group))/i.test(
      textos,
    ) ||
    // A lista de participantes é um indício; na dúvida, não inventar cliente.
    /(?:^|\n)[^\n]+,\s*[^\n]+,\s*[^\n]+/.test(textos)
  );
}

function detectarNomeConversaWhatsapp() {
  try {
    const campo = localizarCampoMensagemWhatsapp();
    if (!campo) return null;
    const cabecalho = localizarCabecalhoConversaWhatsapp(campo);
    if (!cabecalho || conversaPareceGrupo(cabecalho)) return null;
    const estrategias = [
      ['span[title], [role="heading"][title]', "title"],
      ['[role="heading"], h1, h2, h3', null],
      ["span[aria-label]", "aria-label"],
      ['span[dir="auto"]', null],
    ];
    for (const [seletor, atributo] of estrategias) {
      const candidatos = Array.from(cabecalho.querySelectorAll(seletor))
        .filter(
          (elemento) =>
            elementoWhatsappVisivel(elemento) &&
            !elemento.closest('button, [role="menu"], [role="tooltip"]') &&
            elemento.getAttribute("role") !== "button",
        )
        .map((elemento) =>
          normalizarTexto(
            atributo
              ? elemento.getAttribute(atributo)
              : elemento.innerText || elemento.textContent,
          ),
        )
        .filter(nomeConversaValido);
      const nomes = [...new Set(candidatos)];
      if (nomes.length === 1) return nomes[0];
      if (nomes.length > 1) return null;
    }
  } catch (e) {
    erro("Detecção de nome WhatsApp:", e);
  }
  return null;
}

function obterTextoAtualCampoWhatsapp(campo) {
  // Ignora apenas espaços e marcadores invisíveis comuns a editores vazios.
  const texto = (campo.innerText || campo.textContent || "")
    .replace(/[\u200B\u200E\u200F\uFEFF]/g, "")
    .trim();
  // Emojis podem ser imagens sem texto; também são conteúdo significativo.
  return (
    texto ||
    (campo.querySelector('img, [contenteditable="false"]') ? "[conteúdo]" : "")
  );
}

async function copiarMensagem(texto) {
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("Clipboard indisponível");
    await navigator.clipboard.writeText(texto);
  } catch {
    const area = el("textarea", "whatsapp-clipboard");
    area.value = texto;
    const foco = shadow?.activeElement || document.activeElement;
    (shadow || document.body).appendChild(area);
    try {
      area.focus();
      area.select();
      if (!document.execCommand("copy"))
        throw new Error("Não foi possível copiar a mensagem.");
    } finally {
      area.remove();
      foco?.focus?.();
    }
  }
}

function localizarCampoMensagemWhatsapp() {
  if (
    window !== window.top ||
    location.hostname !== "web.whatsapp.com" ||
    location.protocol !== "https:"
  )
    return null;
  const campos = Array.from(
    document.querySelectorAll(
      'footer [contenteditable="true"][role="textbox"]',
    ),
  ).filter((campo) => {
    const estilo = getComputedStyle(campo);
    return (
      campo.isConnected &&
      campo.getClientRects().length > 0 &&
      estilo.visibility === "visible" &&
      estilo.display !== "none" &&
      !campo.closest('[hidden], [aria-hidden="true"]')
    );
  });
  // Não adivinhar a conversa quando houver mais de um editor visível.
  return campos.length === 1 ? campos[0] : null;
}

let insercaoWhatsappEmAndamento = false;

async function inserirMensagemWhatsapp(texto) {
  if (insercaoWhatsappEmAndamento) {
    throw new Error("Aguarde a inserção da mensagem em andamento.");
  }
  insercaoWhatsappEmAndamento = true;
  try {
    await inserirTextoNoEditorWhatsapp(texto);
  } finally {
    insercaoWhatsappEmAndamento = false;
  }
}

async function inserirTextoNoEditorWhatsapp(texto) {
  const campo = localizarCampoMensagemWhatsapp();
  if (!campo)
    throw new Error("Abra uma conversa com o campo de mensagem visível.");
  // Preserva rascunhos já escritos pelo usuário.
  if (obterTextoAtualCampoWhatsapp(campo)) {
    throw new Error(
      "Já existe uma mensagem digitada nesta conversa. Limpe o campo antes de inserir a cotação.",
    );
  }
  campo.focus();
  const selecao = window.getSelection();
  if (!selecao)
    throw new Error("Não foi possível posicionar o cursor na conversa.");
  const faixa = document.createRange();
  faixa.selectNodeContents(campo);
  faixa.collapse(false);
  selecao.removeAllRanges();
  selecao.addRange(faixa);

  const mensagem = texto.replace(/\r\n/g, "\n");
  // Delega a construção dos parágrafos ao tratamento de colagem do WhatsApp.
  // Um único evento, sem comandos nativos, alterações de DOM ou nova tentativa.
  const dados = new DataTransfer();
  dados.setData("text/plain", mensagem);
  campo.dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      composed: true,
      clipboardData: dados,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (!campo.isConnected || localizarCampoMensagemWhatsapp() !== campo) {
    throw new Error("A conversa mudou durante a inserção. Confira o rascunho.");
  }
  campo.focus();
  const resultado = (campo.innerText || "").replace(/\r\n/g, "\n").trim();
  if (resultado !== mensagem) {
    throw new Error(
      "O editor não confirmou o texto completo. Confira o rascunho ou use Copiar mensagem.",
    );
  }
}

function normalizarRotuloWhatsapp(valor) {
  return normalizarTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function rotuloControleWhatsapp(elemento) {
  return normalizarRotuloWhatsapp(
    elemento.getAttribute("aria-label") ||
      elemento.getAttribute("title") ||
      elemento.innerText ||
      "",
  );
}

function localizarBotaoAnexoWhatsapp(campo) {
  const footer = campo.closest("footer");
  if (!footer) return null;
  const botoes = Array.from(
    footer.querySelectorAll('button, [role="button"]'),
  ).filter(
    (botao) =>
      elementoWhatsappVisivel(botao) &&
      !botao.disabled &&
      botao.getAttribute("aria-disabled") !== "true",
  );
  const estrategias = [
    (botao) =>
      /^(anexar(?: arquivo)?|anexo|attach(?:ment| file)?|adjuntar|adicionar anexo|mais|plus|\+)$/.test(
        rotuloControleWhatsapp(botao),
      ),
    (botao) =>
      !!botao.querySelector(
        '[data-icon="plus"], [data-icon="plus-rounded"], [data-icon="clip"], [data-icon="attach-menu-plus"]',
      ),
  ];
  for (const teste of estrategias) {
    const candidatos = botoes.filter(teste);
    if (candidatos.length)
      return candidatos.length === 1 ? candidatos[0] : null;
  }
  return null;
}

function localizarOpcaoDocumentoWhatsapp() {
  const candidatos = Array.from(
    document.querySelectorAll(
      '[role="menuitem"], [role="menuitemradio"], button, [role="button"], li, [title], [aria-label]',
    ),
  ).filter(
    (item) =>
      elementoWhatsappVisivel(item) &&
      !item.disabled &&
      item.getAttribute("aria-disabled") !== "true" &&
      /^(documento(?:s)?|document(?:s)?|arquivo(?:s)?|archivo(?:s)?|file(?:s)?)$/.test(
        rotuloControleWhatsapp(item),
      ),
  );
  const controles = [
    ...new Set(
      candidatos.map(
        (item) =>
          item.closest(
            '[role="menuitem"], [role="menuitemradio"], button, [role="button"], li',
          ) || item,
      ),
    ),
  ];
  if (controles.length) return controles.length === 1 ? controles[0] : null;
  const icones = Array.from(
    document.querySelectorAll(
      '[data-icon="document"], [data-icon="attach-document"]',
    ),
  )
    .map((icone) =>
      icone.closest('[role="menuitem"], button, [role="button"], li'),
    )
    .filter((item) => item && elementoWhatsappVisivel(item));
  const unicos = [...new Set(icones)];
  return unicos.length === 1 ? unicos[0] : null;
}

function localizarInputDocumentoWhatsapp(raiz) {
  if (!raiz) return null;
  // Não confundir o input de documentos com o seletor de fotos/vídeos.
  const inputs = Array.from(raiz.querySelectorAll('input[type="file"]')).filter(
    (input) => {
      if (!input.isConnected || input.disabled) return false;
      const accept = (input.getAttribute("accept") || "").toLowerCase().trim();
      const rotulo = rotuloControleWhatsapp(input);
      return (
        /application\/pdf|\.pdf(?:,|$)/.test(accept) ||
        accept === "*" ||
        accept === "*/*" ||
        (!accept &&
          /^(documento(?:s)?|document(?:s)?|arquivo(?:s)?|archivo(?:s)?|file(?:s)?)$/.test(
            rotulo,
          ))
      );
    },
  );
  return inputs.length === 1 ? inputs[0] : null;
}

function obterContainerConversaWhatsapp(campo) {
  let container = campo.closest("footer")?.parentElement;
  while (
    container &&
    container !== document.body &&
    container !== document.documentElement
  ) {
    if (container.querySelector("header")) return container;
    container = container.parentElement;
  }
  return null;
}

function abrirMenuAnexoWhatsapp(campo) {
  const botao = localizarBotaoAnexoWhatsapp(campo);
  if (!botao)
    throw new Error("Não foi possível localizar o botão de anexo da conversa.");
  if (botao.getAttribute("aria-expanded") !== "true") botao.click();
}

async function abrirSeletorDocumentoWhatsapp() {
  const campo = localizarCampoMensagemWhatsapp();
  if (!campo) throw new Error("Abra uma conversa para anexar um arquivo.");
  const input = localizarInputDocumentoWhatsapp(
    obterContainerConversaWhatsapp(campo),
  );
  if (input) {
    // Executa dentro do clique do usuário; nunca define value/files ou envia.
    input.click();
    return;
  }
  let opcao = null;
  abrirMenuAnexoWhatsapp(campo);
  // Espera limitada somente durante esta ação; sem observer/polling contínuo.
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    opcao = localizarOpcaoDocumentoWhatsapp();
    if (opcao) break;
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (localizarCampoMensagemWhatsapp() !== campo) {
      throw new Error("A conversa mudou. Clique em Anexar arquivo novamente.");
    }
  }
  if (!opcao)
    throw new Error(
      "Não foi possível localizar Documento/Arquivo no menu de anexos.",
    );
  if (localizarCampoMensagemWhatsapp() !== campo) {
    throw new Error("A conversa mudou. Clique em Anexar arquivo novamente.");
  }
  opcao.click();
}

function criarWhatsappCotacao() {
  const details = el("details", "submodulo");
  details.dataset.submodulo = "cotacao";
  const corpo = el("div", "submodulo-corpo");

  function adicionarCampo(titulo, tag = "input", opcoes = []) {
    const label = el("label", "label", titulo);
    const campo = el(tag, "campo");
    if (tag === "input") campo.type = "text";
    opcoes.forEach((texto) => {
      const opcao = el("option", "", texto);
      opcao.value = texto;
      campo.appendChild(opcao);
    });
    label.appendChild(campo);
    corpo.appendChild(label);
    return { campo, label };
  }

  const nome = adicionarCampo("Nome do cliente").campo;
  let nomeAlteradoManualmente = false;
  nome.addEventListener("input", () => {
    nomeAlteradoManualmente = true;
  });
  nome.addEventListener("change", () => {
    nomeAlteradoManualmente = true;
  });
  const detectar = el("button", "botao-secundario", "Detectar conversa");
  detectar.type = "button";
  corpo.appendChild(detectar);
  const ramo = adicionarCampo("Ramo", "select", RAMOS).campo;
  const modelo = adicionarCampo("Modelo do veículo");
  const artigoVeiculo = adicionarCampo("Usar antes do veículo", "select", [
    "do",
    "da",
  ]);
  const tipoImovel = adicionarCampo("Tipo do imóvel", "select", [
    "Casa",
    "Apartamento",
  ]);
  const item = adicionarCampo("Item segurado");
  const vigencia = adicionarCampo("Vencimento / vigência").campo;
  vigencia.placeholder = "DD/MM/AAAA";
  vigencia.inputMode = "numeric";
  vigencia.maxLength = 10;
  const preview = el("div", "preview whatsapp-preview");

  function obterDados() {
    return {
      nome: nome.value,
      ramo: ramo.value,
      modelo: modelo.campo.value,
      artigoVeiculo: artigoVeiculo.campo.value,
      tipoImovel: tipoImovel.campo.value,
      item: item.campo.value,
      vigencia: vigencia.value,
    };
  }

  function atualizarPreview() {
    modelo.label.classList.toggle("oculto", ramo.value !== "AUTO");
    artigoVeiculo.label.classList.toggle("oculto", ramo.value !== "AUTO");
    tipoImovel.label.classList.toggle("oculto", ramo.value !== "RESIDENCIA");
    item.label.classList.toggle(
      "oculto",
      ["AUTO", "RESIDENCIA"].includes(ramo.value),
    );
    const dados = obterDados();
    preview.textContent = validarDadosCotacao(dados)
      ? "Preencha os dados acima para gerar a mensagem."
      : gerarMensagemCotacao(dados);
  }
  function preencherNomeConversa(explicito = false) {
    if (!explicito && nomeAlteradoManualmente) return;
    const identificado = detectarNomeConversaWhatsapp();
    if (identificado) {
      nome.value = identificado;
      atualizarPreview();
    }
    if (explicito)
      definirStatus(
        identificado
          ? "Cliente identificado na conversa."
          : "Não foi possível identificar o nome da conversa.",
        identificado ? "ok" : "erro",
      );
  }
  detectar.onclick = () => preencherNomeConversa(true);
  details.addEventListener("toggle", () => {
    if (details.open) preencherNomeConversa();
  });
  corpo.addEventListener("input", () => {
    vigencia.value = formatarData(vigencia.value);
    atualizarPreview();
  });
  corpo.addEventListener("change", atualizarPreview);

  function adicionarBotao(titulo, classe, acao, sucesso) {
    const botao = el("button", classe, titulo);
    botao.type = "button";
    botao.onclick = async () => {
      const dados = obterDados();
      const falha = validarDadosCotacao(dados);
      if (falha) {
        definirStatus(falha, "erro");
        return;
      }
      botao.disabled = true;
      try {
        await acao(gerarMensagemCotacao(dados));
        definirStatus(sucesso, "ok");
      } catch (e) {
        erro("Cotação WhatsApp:", e);
        definirStatus(e.message || "Erro ao preparar mensagem.", "erro");
      } finally {
        botao.disabled = false;
      }
    };
    corpo.appendChild(botao);
  }
  corpo.appendChild(preview);
  adicionarBotao(
    "Copiar mensagem",
    "botao btn-blue",
    copiarMensagem,
    "Mensagem de cotação copiada.",
  );
  adicionarBotao(
    "Inserir no WhatsApp",
    "botao btn-green",
    inserirMensagemWhatsapp,
    "Mensagem inserida. Revise antes de enviar.",
  );
  const anexar = el("button", "botao-secundario", "Anexar arquivo");
  anexar.type = "button";
  anexar.onclick = async () => {
    if (anexar.disabled) return;
    anexar.disabled = true;
    try {
      await abrirSeletorDocumentoWhatsapp();
      definirStatus(
        "Selecione o arquivo e revise o anexo antes de enviar.",
        "ok",
      );
    } catch (e) {
      erro("Anexo WhatsApp:", e);
      definirStatus(
        e.message || "Não foi possível abrir o seletor de documentos.",
        "erro",
      );
    } finally {
      anexar.disabled = false;
    }
  };
  corpo.appendChild(anexar);
  preencherNomeConversa();
  atualizarPreview();
  details.appendChild(el("summary", "", "Envio de cotação"));
  details.appendChild(corpo);
  return details;
}

export function criarModuloWhatsapp() {
  const details = el("details", "modulo-principal");
  details.dataset.modulo = "whatsapp";
  const corpo = el("div", "modulo-corpo");
  const cotacao = criarWhatsappCotacao();
  configurarAccordionPersistente(
    [cotacao],
    STORAGE_WHATSAPP_SUBMODULO_ABERTO,
    "submodulo",
  );
  corpo.appendChild(cotacao);
  details.appendChild(el("summary", "", "WhatsApp"));
  details.appendChild(corpo);
  return details;
}
