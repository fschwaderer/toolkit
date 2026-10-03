import {
  conectarModulos,
  inicializarPreferencias,
  iniciarComDelayQuandoNecessario,
} from "./ui.js";
import { criarModuloPdf } from "../modules/pdf.js";
import { criarModuloImagens } from "../modules/imagens.js";
import {
  criarModuloPagina,
  paginaEstado,
  ftFrame,
  inicializarEstadoFrames,
  paginaIniciarConexaoFrames,
} from "../modules/pagina.js";
import { criarModuloArquivos } from "../modules/arquivos.js";
import { criarModuloGmail } from "../modules/gmail.js";
import { criarModuloWhatsapp } from "../modules/whatsapp.js";

export function iniciarToolkit() {
  inicializarPreferencias();
  inicializarEstadoFrames();
  conectarModulos({
    criarModuloPdf,
    criarModuloImagens,
    criarModuloPagina,
    criarModuloArquivos,
    criarModuloGmail,
    criarModuloWhatsapp,
    paginaEstado,
    ftFrame,
  });
  paginaIniciarConexaoFrames();

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      iniciarComDelayQuandoNecessario,
      {
        once: true,
      },
    );
  } else {
    iniciarComDelayQuandoNecessario();
  }
}
