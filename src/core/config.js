const HOSTS_BLOQUEADOS = ["work.tailbc19c7.ts.net"];

const APP = {
  nome: "Fausto´s Toolkit",
  versao: "1.8.4.16",
};

const CONFIG = {
  launcherDireita: 18,

  // No WhatsApp Web, sobe o launcher para não cobrir
  // o botão de enviar/microfone da barra de mensagens.
  launcherInferior: location.hostname === "web.whatsapp.com" ? 86 : 18,

  painelLargura: 360,

  maxProfundidadeBuscaLocal: 5,

  pdf: {
    tamanhoFonteVigencia: 20,
    margemDireitaVigencia: 22,
    margemTopoVigencia: 70,

    tamanhoFonteComissao: 12,
    margemDireitaComissao: 22,
    margemInferiorComissao: 40,
  },
};

const MODULOS = {
  pdf: {
    titulo: "PDF",
    ativoPorPadrao: false,
  },

  imagens: {
    titulo: "Imagens",
    ativoPorPadrao: false,
  },

  pagina: {
    titulo: "Página",
    ativoPorPadrao: false,
  },

  arquivos: {
    titulo: "Arquivos",
    ativoPorPadrao: false,
  },

  gmail: {
    titulo: "Gmail",
    ativoPorPadrao: true,
    somenteGmail: true,
  },
  whatsapp: {
    titulo: "WhatsApp",
    ativoPorPadrao: true,
    somenteWhatsApp: true,
  },
};

const SEGURADORAS = [
  "ALLIANZ",
  "AZUL",
  "BRADESCO",
  "CHUBB",
  "EZZE",
  "HDI",
  "MAPFRE",
  "PORTO",
  "SOMPO",
  "SUHAI",
  "SULAMÉRICA",
  "TOKIO",
  "YELUM",
  "ZURICH",
  "OUTRO",
];

const RAMOS = [
  "AUTO",
  "RESIDENCIA",
  "EMPRESARIAL",
  "CONDOMINIO",
  "VIDA",
  "AP",
  "RCP",
  "OUTRO",
];

export { MODULOS, CONFIG, SEGURADORAS, RAMOS, APP, HOSTS_BLOQUEADOS };
