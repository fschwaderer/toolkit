import { erro } from "./utils.js";
import { salvarDB, obterDB, CHAVE_PASTAS_LOCAIS } from "./storage.js";
import { CONFIG } from "./config.js";

function obterJanelaFileSystem() {
  try {
    if (typeof window.showDirectoryPicker === "function") {
      return window;
    }
  } catch {
    // ignora
  }

  try {
    if (
      typeof unsafeWindow !== "undefined" &&
      typeof unsafeWindow.showDirectoryPicker === "function"
    ) {
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

    throw new Error(
      `Seleção de pastas indisponível neste contexto. Contexto seguro: ${seguro}.`,
    );
  }

  return await janela.showDirectoryPicker({
    mode: modo,
  });
}

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
      if (
        typeof existente.isSameEntry === "function" &&
        (await existente.isSameEntry(handle))
      ) {
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

async function buscarArquivoRecursivo(
  pasta,
  nomeArquivo,
  profundidade = 0,
  caminho = "",
) {
  if (profundidade > CONFIG.maxProfundidadeBuscaLocal) {
    return null;
  }

  try {
    // Primeiro procura arquivos
    for await (const entry of pasta.values()) {
      if (
        entry.kind === "file" &&
        entry.name.toLowerCase() === nomeArquivo.toLowerCase()
      ) {
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

      const encontrado = await buscarArquivoRecursivo(
        entry,
        nomeArquivo,
        profundidade + 1,
        subCaminho,
      );

      if (encontrado) {
        return encontrado;
      }
    }
  } catch (e) {
    erro("Busca em pasta:", pasta.name, e);
  }

  return null;
}

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

export {
  obterPastasLocais,
  garantirPermissao,
  buscarArquivoRecursivo,
  adicionarPastaLocal,
  removerPastaLocal,
  obterPastaDestino,
  salvarBufferNaPasta,
  escolherPastaDestino,
  abrirSeletorDePasta,
  arquivoExiste,
  consultarPermissao,
};
