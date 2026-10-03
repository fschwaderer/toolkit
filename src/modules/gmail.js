import { erro } from "../core/utils.js";
import { definirStatus } from "../core/ui.js";
import { el } from "../core/dom.js";

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

        assuntos: [
          "Confirmação de Pagamento de parcela",
          "Inclusão Dados de Pagamento",
          "Parcela do seu Seguro Hdi Auto Perfil",
        ],
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

  const assuntos = regra.assuntos
    .map((assunto) => `subject:("${gmailEscaparTermoBusca(assunto)}")`)
    .join(" OR ");

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

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
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

      return normalizados.some(
        (termo) =>
          aria === termo ||
          aria.startsWith(`${termo} `) ||
          aria.includes(termo),
      );
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
  const candidatos = [
    'input[name="q"]',
    'input[placeholder="Pesquisar e-mail"]',
    'input[aria-label="Pesquisar e-mail"]',
    'input[placeholder="Search mail"]',
    'input[aria-label="Search mail"]',
  ];

  for (const seletor of candidatos) {
    const elemento = document.querySelector(seletor);

    if (gmailElementoVisivel(elemento)) {
      return elemento;
    }
  }

  return null;
}

function gmailDefinirValorInput(input, valor) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );

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

  const botaoSelecionar = Array.from(
    document.querySelectorAll(
      '[role="button"][aria-label="Selecionar"], [role="button"][aria-label="Select"]',
    ),
  ).find(gmailElementoVisivel);

  if (botaoSelecionar) {
    const checkbox = botaoSelecionar.querySelector(
      '[role="checkbox"][aria-checked]',
    );

    if (checkbox && gmailElementoVisivel(checkbox)) {
      return checkbox;
    }
  }

  // Fallback: checkbox visível fora das linhas de e-mail.
  const checkboxes = Array.from(
    document.querySelectorAll('[role="checkbox"][aria-checked]'),
  ).filter(gmailElementoVisivel);

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
    const elemento = Array.from(document.querySelectorAll(seletor)).find(
      gmailElementoVisivel,
    );

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

  const selecionar = await gmailEsperarCondicao(
    gmailEncontrarSelecionarTodos,
    8000,
    100,
  );

  if (!selecionar) {
    throw new Error('Não encontrei o checkbox "Selecionar" do Gmail.');
  }

  // Este foi o método que funcionou originalmente.
  selecionar.click();

  const selecionado = await gmailEsperarCondicao(
    gmailHaConversasSelecionadas,
    8000,
    100,
  );

  if (!selecionado) {
    throw new Error("O Gmail não confirmou a seleção dos e-mails.");
  }

  await gmailEsperar(500);

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

  const arquivar = Array.from(
    document.querySelectorAll(
      '[role="button"][act="7"][aria-label="Arquivar"], [role="button"][act="7"][aria-label="Archive"]',
    ),
  ).find(gmailElementoVisivel);

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
  const toolbar = await gmailEsperarCondicao(
    gmailEncontrarToolbarSelecao,
    8000,
    100,
  );

  if (!toolbar) {
    throw new Error(
      "A barra de ações do Gmail não apareceu após selecionar os e-mails.",
    );
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
    const HTMLElementPagina =
      typeof unsafeWindow !== "undefined" ? unsafeWindow.HTMLElement : null;

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
  return Array.from(document.querySelectorAll('tr[role="row"]')).filter(
    gmailElementoVisivel,
  );
}

function gmailAssinaturasLinhasResultados() {
  return gmailLinhasResultadosVisiveis()
    .map(
      (linha) => linha.id || linha.getAttribute("jslog") || linha.textContent,
    )
    .filter(Boolean);
}

async function gmailDispararMousePagina(elemento) {
  if (!elemento) {
    return false;
  }

  try {
    const JanelaPagina =
      typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

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
  const localizarBotaoLer = () =>
    gmailEncontrarBotaoNaToolbar(toolbar, [
      '[role="button"][act="1"][aria-label="Marcar como lida"]',
      '[role="button"][act="1"][aria-label="Mark as read"]',
    ]);

  const localizarBotaoNaoLer = () =>
    gmailEncontrarBotaoNaToolbar(toolbar, [
      '[role="button"][act="2"][aria-label="Marcar como não lida"]',
      '[role="button"][act="2"][aria-label="Mark as unread"]',
    ]);

  if (localizarBotaoNaoLer()) {
    return {
      executado: false,

      motivo: "ja-lidas",
    };
  }

  const botao = await gmailEsperarCondicao(localizarBotaoLer, 5000, 100);

  if (!botao) {
    throw new Error(
      'A barra apareceu, mas o botão "Marcar como lida" não ficou visível.',
    );
  }

  // Primeiro tenta o clique nativo da página.
  await gmailCliquePagina(botao);

  // Não espera 8 segundos: se o Gmail não reagir em 700 ms,
  // dispara imediatamente o fallback que já provou funcionar.
  let confirmou = await gmailEsperarCondicao(
    () => !!localizarBotaoNaoLer(),
    700,
    100,
  );

  if (!confirmou) {
    await gmailDispararMousePagina(botao);

    confirmou = await gmailEsperarCondicao(
      () => !!localizarBotaoNaoLer(),
      5000,
      100,
    );
  }

  if (!confirmou) {
    throw new Error('O Gmail não trocou o botão para "Marcar como não lida".');
  }

  return {
    executado: true,
  };
}

async function gmailArquivarSelecionadas(toolbar) {
  const botao = gmailEncontrarBotaoNaToolbar(toolbar, [
    '[role="button"][act="7"][aria-label="Arquivar"]',
    '[role="button"][act="7"][aria-label="Archive"]',
  ]);

  if (!botao) {
    throw new Error(
      'A barra de ações está visível, mas não encontrei "Arquivar".',
    );
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
    throw new Error(
      "O Gmail não confirmou a remoção dos e-mails arquivados da lista.",
    );
  }

  return true;
}

async function gmailLimparPaginaAtual() {
  await gmailSelecionarPagina();

  definirStatus("Seleção feita. Aguardando barra de ações do Gmail...");

  const toolbar = await gmailEsperarToolbarSelecao();

  definirStatus("Marcando conversas como lidas...");

  const leitura = await gmailMarcarComoLidas(toolbar);

  definirStatus(
    leitura.executado
      ? "Conversas marcadas como lidas. Arquivando..."
      : "Conversas já estavam lidas. Arquivando...",
  );

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

  let voltou = await gmailEsperarCondicao(
    () =>
      (typeof unsafeWindow !== "undefined"
        ? unsafeWindow.location.hash
        : location.hash
      ).startsWith("#inbox"),
    3000,
    100,
  );

  if (voltou) {
    await gmailEsperar(500);

    return true;
  }

  // Fallback: tenta o link visual caso a navegação direta
  // não tenha sido processada pela SPA.
  const inbox = Array.from(document.querySelectorAll('a[href*="#inbox"]')).find(
    gmailElementoVisivel,
  );

  if (inbox) {
    inbox.click();

    voltou = await gmailEsperarCondicao(
      () =>
        (typeof unsafeWindow !== "undefined"
          ? unsafeWindow.location.hash
          : location.hash
        ).startsWith("#inbox"),
      3000,
      100,
    );
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

    definirStatus(
      `Processando ${indiceAtual}/${total}: ${regra.remetente} — lote ${lote}...`,
    );

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

  throw new Error(
    `Limite de segurança atingido ao processar ${regra.remetente}.`,
  );
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
    resultados.push(
      await gmailProcessarRegraIndividual(
        ordenadas[i],
        i + 1,
        ordenadas.length,
      ),
    );
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

  const processarSeparado = el(
    "button",
    "botao btn-dark",
    "Processar por filtro",
  );

  const limpar = el(
    "button",
    "botao btn-green",
    "Marcar como lidas e arquivar",
  );

  localizar.onclick = async function () {
    localizar.disabled = true;

    try {
      definirStatus("Aplicando filtros configurados...");

      const consulta = obterBuscaAtual();

      if (!consulta) {
        throw new Error("Selecione pelo menos um filtro.");
      }

      await gmailExecutarBusca(consulta);

      definirStatus(
        "Filtros aplicados. Confira os resultados antes de limpar.",
        "ok",
      );
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

      definirStatus(
        `Processando ${regrasAtivas.length} filtro(s) separadamente...`,
      );

      await gmailProcessarRegrasSeparadamente(regrasAtivas);

      definirStatus(
        "Processamento por filtro concluído. Caixa de entrada restaurada.",
        "ok",
      );
    } catch (e) {
      definirStatus(
        e.message || "Erro ao processar filtros separadamente.",
        "erro",
      );
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

      definirStatus(
        resultado.leitura
          ? "Mensagens filtradas marcadas como lidas, arquivadas e Caixa de entrada restaurada."
          : "Mensagens filtradas já estavam lidas, foram arquivadas e a Caixa de entrada foi restaurada.",
        "ok",
      );
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

export { criarModuloGmail };
