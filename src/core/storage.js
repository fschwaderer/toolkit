import { MODULOS } from "./config.js";

const STORAGE_MODULOS = "FAUSTO_TOOLKIT_MODULOS_V1";

const STORAGE_PAINEL_ABERTO = "FAUSTO_TOOLKIT_PAINEL_ABERTO";

const STORAGE_MODULO_ABERTO = "FAUSTO_TOOLKIT_MODULO_ABERTO";
const STORAGE_WHATSAPP_SUBMODULO_ABERTO =
  "FAUSTO_TOOLKIT_WHATSAPP_SUBMODULO_ABERTO";

const STORAGE_PDF_SUBMODULO_ABERTO = "FAUSTO_TOOLKIT_PDF_SUBMODULO_ABERTO";

const STORAGE_IMAGENS_SUBMODULO_ABERTO =
  "FAUSTO_TOOLKIT_IMAGENS_SUBMODULO_ABERTO";

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

const DB_NAME = "FAUSTO_TOOLKIT_CONFIG";

const DB_VERSION = 1;

const STORE_NAME = "config";

const CHAVE_IMPORTAR = "pasta-importar";

const CHAVE_IMPRIMIR = "pasta-imprimir";

const CHAVE_PASTAS_LOCAIS = "pastas-locais";

const CHAVE_ARQUIVOS_PASTAS_MONITORADAS = "arquivos-pastas-monitoradas-v1";

const STORAGE_ARQUIVOS_SUBMODULO_ABERTO =
  "FAUSTO_TOOLKIT_ARQUIVOS_SUBMODULO_ABERTO";

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

const STORAGE_PAGINA_SUBMODULO_ABERTO =
  "FAUSTO_TOOLKIT_PAGINA_SUBMODULO_ABERTO";

export {
  obterDB,
  CHAVE_IMPORTAR,
  CHAVE_IMPRIMIR,
  STORAGE_PDF_SUBMODULO_ABERTO,
  salvarDB,
  CHAVE_PASTAS_LOCAIS,
  carregarPreferenciasModulos,
  salvarPreferenciasModulos,
  STORAGE_MODULO_ABERTO,
  STORAGE_WHATSAPP_SUBMODULO_ABERTO,
  STORAGE_PAINEL_ABERTO,
  STORAGE_IMAGENS_SUBMODULO_ABERTO,
  STORAGE_PAGINA_SUBMODULO_ABERTO,
  CHAVE_ARQUIVOS_PASTAS_MONITORADAS,
  STORAGE_ARQUIVOS_SUBMODULO_ABERTO,
};
