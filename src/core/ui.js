import {
  carregarPreferenciasModulos,
  salvarPreferenciasModulos,
  STORAGE_MODULO_ABERTO,
  STORAGE_PAINEL_ABERTO,
} from "./storage.js";
import { CONFIG, MODULOS, APP } from "./config.js";
import { erro } from "./utils.js";
import { el, configurarAccordionPersistente } from "./dom.js";

let criarModuloPdf,
  criarModuloImagens,
  criarModuloPagina,
  criarModuloArquivos,
  criarModuloGmail,
  criarModuloWhatsapp,
  paginaEstado,
  ftFrame;

export function conectarModulos(modulos) {
  ({
    criarModuloPdf,
    criarModuloImagens,
    criarModuloPagina,
    criarModuloArquivos,
    criarModuloGmail,
    criarModuloWhatsapp,
    paginaEstado,
    ftFrame,
  } = modulos);
}

export function inicializarPreferencias() {
  preferencias = carregarPreferenciasModulos();
}

let rootHost = null;

let shadow = null;

let launcher = null;

let painel = null;

let conteudo = null;

let statusGlobal = null;

let painelAberto = false;

let preferencias = null;

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

        .whatsapp-preview {
            white-space: pre-wrap;
        }

        .whatsapp-clipboard {
            position: fixed;
            left: 0;
            top: 0;
            opacity: 0;
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

function criarConfiguracaoModulos() {
  const box = el("div", "box");

  box.appendChild(el("div", "titulo-box", "Módulos ativos"));

  for (const [chave, modulo] of Object.entries(MODULOS)) {
    if (modulo.somenteGmail && location.hostname !== "mail.google.com") {
      continue;
    }
    if (
      modulo.somenteWhatsApp &&
      (location.hostname !== "web.whatsapp.com" ||
        location.protocol !== "https:")
    ) {
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

      conteudo.appendChild(
        el("div", "info", `PDF: ${e.message || "erro ao carregar"}`),
      );
    }
  }

  if (preferencias.imagens) {
    try {
      const imagens = criarModuloImagens();

      modulosRenderizados.push(imagens);

      conteudo.appendChild(imagens);
    } catch (e) {
      erro("Módulo Imagens:", e);

      conteudo.appendChild(
        el("div", "info", `Imagens: ${e.message || "erro ao carregar"}`),
      );
    }
  }

  if (preferencias.pagina) {
    try {
      const pagina = criarModuloPagina();

      modulosRenderizados.push(pagina);

      conteudo.appendChild(pagina);
    } catch (e) {
      erro("Módulo Página:", e);

      conteudo.appendChild(
        el("div", "info", `Página: ${e.message || "erro ao carregar"}`),
      );
    }
  }

  if (preferencias.arquivos) {
    try {
      const arquivos = await criarModuloArquivos();

      modulosRenderizados.push(arquivos);

      conteudo.appendChild(arquivos);
    } catch (e) {
      erro("Módulo Arquivos:", e);

      conteudo.appendChild(
        el("div", "info", `Arquivos: ${e.message || "erro ao carregar"}`),
      );
    }
  }

  if (preferencias.gmail && location.hostname === "mail.google.com") {
    try {
      const gmail = criarModuloGmail();

      modulosRenderizados.push(gmail);

      conteudo.appendChild(gmail);
    } catch (e) {
      erro("Módulo Gmail:", e);

      conteudo.appendChild(
        el("div", "info", `Gmail: ${e.message || "erro ao carregar"}`),
      );
    }
  }

  if (
    preferencias.whatsapp &&
    location.hostname === "web.whatsapp.com" &&
    location.protocol === "https:"
  ) {
    try {
      const whatsapp = criarModuloWhatsapp();
      modulosRenderizados.push(whatsapp);
      conteudo.appendChild(whatsapp);
    } catch (e) {
      erro("Módulo WhatsApp:", e);
      conteudo.appendChild(
        el("div", "info", `WhatsApp: ${e.message || "erro ao carregar"}`),
      );
    }
  }

  // ========================================================
  // ACCORDION ENTRE MÓDULOS PRINCIPAIS
  // ========================================================

  configurarAccordionPersistente(
    modulosRenderizados,
    STORAGE_MODULO_ABERTO,
    "modulo",
  );

  if (!modulosRenderizados.length) {
    conteudo.appendChild(
      el("div", "texto-pequeno", "Ative um módulo acima para começar."),
    );
  }
}

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
      conteudo.replaceChildren(
        el("div", "info", `Erro ao montar o Toolkit: ${e.message || e}`),
      );
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

function iniciar() {
  if (!ftFrame.principal) return;

  if (!document.body) {
    setTimeout(iniciar, 100);

    return;
  }

  criarApp();
  iniciarProtecaoSPA();
}

export {
  definirStatus,
  renderizarConteudo,
  rootHost,
  shadow,
  iniciarComDelayQuandoNecessario,
};
