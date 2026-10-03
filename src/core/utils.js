function log(...args) {
  console.log("[FAUSTO TOOLKIT]", ...args);
}

function erro(...args) {
  console.error("[FAUSTO TOOLKIT]", ...args);
}

function formatarData(valor) {
  let numero = valor.replace(/\D/g, "");

  numero = numero.substring(0, 8);

  if (numero.length > 4) {
    return (
      numero.substring(0, 2) +
      "/" +
      numero.substring(2, 4) +
      "/" +
      numero.substring(4)
    );
  }

  if (numero.length > 2) {
    return numero.substring(0, 2) + "/" + numero.substring(2);
  }

  return numero;
}

function dataValida(data) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data);

  if (!match) {
    return false;
  }

  const dia = Number(match[1]);

  const mes = Number(match[2]);

  const ano = Number(match[3]);

  const dataJS = new Date(ano, mes - 1, dia);

  return (
    dataJS.getFullYear() === ano &&
    dataJS.getMonth() === mes - 1 &&
    dataJS.getDate() === dia
  );
}

function formatarComissao(valor) {
  let texto = valor.replace(",", ".").replace(/[^\d.]/g, "");

  const partes = texto.split(".");

  if (partes.length > 2) {
    texto = partes.shift() + "." + partes.join("");
  }

  return texto.substring(0, 6);
}

function comissaoValida(valor) {
  if (!valor) {
    return true;
  }

  const numero = Number(valor);

  return !Number.isNaN(numero) && numero >= 0 && numero <= 100;
}

function limparParteNome(valor) {
  return String(valor || "")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function gerarNomePadrao(seguradora, ramo, cliente) {
  seguradora = limparParteNome(seguradora).toUpperCase();

  ramo = limparParteNome(ramo).toUpperCase();

  cliente = limparParteNome(cliente).toUpperCase();

  if (!seguradora || !ramo || !cliente) {
    return null;
  }

  return `${seguradora} - ${ramo} - ${cliente}.pdf`;
}

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;

  a.download = limparParteNome(nome) || "arquivo";

  a.style.display = "none";

  document.documentElement.appendChild(a);

  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function canvasParaBlob(canvas, mime, qualidade = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Não foi possível gerar a imagem."));

          return;
        }

        resolve(blob);
      },
      mime,
      qualidade,
    );
  });
}

export {
  erro,
  formatarData,
  formatarComissao,
  dataValida,
  comissaoValida,
  gerarNomePadrao,
  limparParteNome,
  baixarBlob,
  canvasParaBlob,
};
