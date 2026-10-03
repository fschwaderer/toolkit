import {
  obterDB,
  CHAVE_ARQUIVOS_PASTAS_MONITORADAS,
  salvarDB,
  STORAGE_ARQUIVOS_SUBMODULO_ABERTO,
} from "../core/storage.js";
import {
  abrirSeletorDePasta,
  arquivoExiste,
  garantirPermissao,
  consultarPermissao,
} from "../core/filesystem.js";
import { definirStatus } from "../core/ui.js";
import { el, configurarAccordionPersistente } from "../core/dom.js";

const ARQUIVOS_CATEGORIAS = [
  {
    pasta: "PDF",
    extensoes: ["pdf"],
  },
  {
    pasta: "Imagens",
    extensoes: [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
      "bmp",
      "tif",
      "tiff",
      "heic",
      "heif",
      "svg",
      "ico",
    ],
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
    extensoes: [
      "mp4",
      "mov",
      "avi",
      "mkv",
      "webm",
      "m4v",
      "wmv",
      "mpeg",
      "mpg",
    ],
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
      if (
        existente.handle &&
        typeof existente.handle.isSameEntry === "function" &&
        (await existente.handle.isSameEntry(handle))
      ) {
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
    id:
      globalThis.crypto?.randomUUID?.() ||
      `pasta-${Date.now()}-${Math.random().toString(16).slice(2)}`,

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

    throw new Error(
      `Falha ao verificar a cópia de "${item.nome}". O original foi preservado.`,
    );
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

    if (
      !window.confirm(
        `Organizar ${itens.length} arquivo(s) de "${pasta.name}"?\n\n${linhas}\n\nSomente os arquivos soltos da raiz serão movidos.`,
      )
    ) {
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

    linhas.push(
      `${resultado.pasta}: ${resultado.movidos.length} movido(s)` +
        (resultado.falhas.length
          ? ` · ${resultado.falhas.length} falha(s)`
          : ""),
    );
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
    container.appendChild(
      el(
        "div",
        "arquivo-preview-item",
        "Nenhum arquivo solto encontrado nesta pasta.",
      ),
    );

    return container;
  }

  for (const item of lista) {
    const linha = el("div", "arquivo-preview-item");

    const origem = el(
      "div",
      "",
      `${item.nome} · ${arquivosFormatarTamanho(item.tamanho)}`,
    );

    const destino = el(
      "div",
      "arquivo-preview-destino",
      `→ ${item.categoria}\\${item.nome}`,
    );

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
  const { details, corpo } = arquivosSubmodulo(
    "pasta-escolhida",
    "Organizar uma pasta",
  );

  corpo.appendChild(
    el(
      "div",
      "info",
      "Escolha uma pasta. O Toolkit analisa apenas os arquivos soltos da raiz e cria subpastas por tipo. Subpastas existentes não são alteradas.",
    ),
  );

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

      definirStatus(
        resumo.falhas
          ? `${resumo.movidos} movido(s), ${resumo.falhas} falha(s).`
          : `${resumo.movidos} arquivo(s) organizado(s).`,
        resumo.falhas ? "erro" : "ok",
      );
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
  const { details, corpo } = arquivosSubmodulo(
    "pastas-monitoradas",
    "Pastas monitoradas",
  );

  corpo.appendChild(
    el(
      "div",
      "info",
      'Adicione somente as pastas que você quer deixar aptas à organização. Depois use "Organizar pastas monitoradas" para processar todas de uma vez. O navegador pode pedir novamente a permissão após reiniciar.',
    ),
  );

  const lista = el("div");

  const resumoPermissoes = el(
    "div",
    "arquivo-resumo-permissoes",
    "Verificando permissões...",
  );

  const adicionar = el(
    "button",
    "botao btn-dark",
    "+ Adicionar pasta monitorada",
  );

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
      const estadoPermissao = item.handle
        ? await consultarPermissao(item.handle, "readwrite")
        : "indisponivel";

      if (estadoPermissao === "granted") {
        prontas++;
      } else if (estadoPermissao === "prompt") {
        precisamAutorizar++;
      } else {
        indisponiveis++;
      }

      const linha = el("div", "arquivo-padrao-linha");

      const info = el("div", "arquivo-padrao-info");

      info.appendChild(
        el(
          "div",
          "arquivo-padrao-titulo",
          item.nome || item.handle?.name || "Pasta",
        ),
      );

      info.appendChild(
        el(
          "div",
          "arquivo-padrao-caminho",
          item.handle?.name || "Pasta indisponível",
        ),
      );

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

          definirStatus(
            arquivos.length
              ? `${item.handle.name}: ${arquivos.length} arquivo(s) solto(s)${detalhes ? ` · ${detalhes}` : ""}`
              : `${item.handle.name}: nenhum arquivo solto.`,
            "ok",
          );
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

      definirStatus(
        resultado.adicionada
          ? `${resultado.pasta.handle.name} adicionada às pastas monitoradas.`
          : `${resultado.pasta.handle.name} já está nas pastas monitoradas.`,
        "ok",
      );
    } catch (e) {
      if (e.name !== "AbortError") {
        definirStatus(e.message, "erro");
      }
    }
  };

  await renderizarPastas();

  const organizarTodas = el(
    "button",
    "botao btn-green",
    "Organizar pastas monitoradas",
  );

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
        definirStatus(
          `${precisamAutorizar.length} pasta(s) precisa(m) de autorização.`,
        );

        for (const item of precisamAutorizar) {
          const autorizado = await garantirPermissao(item.handle, "readwrite");

          if (!autorizado) {
            await renderizarPastas();

            throw new Error(
              `Permissão não concedida para "${item.nome || item.handle.name}".`,
            );
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

      definirStatus(
        final.falhas
          ? `${final.movidos} movido(s), ${final.falhas} falha(s).`
          : `${final.movidos} arquivo(s) organizado(s) em ${resultados.length} pasta(s) monitorada(s).`,
        final.falhas ? "erro" : "ok",
      );
    } catch (e) {
      definirStatus(
        e.message || "Erro ao organizar as pastas monitoradas.",
        "erro",
      );
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

  configurarAccordionPersistente(
    [pastaEscolhida, pastasMonitoradas],
    STORAGE_ARQUIVOS_SUBMODULO_ABERTO,
    "submodulo",
  );

  corpo.appendChild(pastaEscolhida);

  corpo.appendChild(pastasMonitoradas);

  details.appendChild(corpo);

  return details;
}

export { criarModuloArquivos };
