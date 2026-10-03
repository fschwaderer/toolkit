function criarElemento(tag, texto = null) {
  const el = document.createElement(tag);

  if (texto !== null) {
    el.textContent = texto;
  }

  return el;
}

function configurarAccordionPersistente(elementos, storageKey, dataKey) {
  const salvo = GM_getValue(storageKey, null);

  // Restaura o último aberto
  elementos.forEach((item) => {
    if (item.dataset[dataKey] === salvo) {
      item.open = true;
    }
  });

  elementos.forEach((atual) => {
    atual.addEventListener("toggle", function () {
      const chaveAtual = atual.dataset[dataKey];

      // --------------------------------------------
      // ABRIU
      // --------------------------------------------

      if (atual.open) {
        GM_setValue(storageKey, chaveAtual);

        elementos.forEach((outro) => {
          if (outro !== atual && outro.open) {
            outro.open = false;
          }
        });

        return;
      }

      // --------------------------------------------
      // FECHOU MANUALMENTE
      // --------------------------------------------

      const armazenado = GM_getValue(storageKey, null);

      /*
       * Só limpa se esse ainda for
       * o item armazenado.
       *
       * Isso evita que o fechamento causado
       * pelo accordion apague o módulo que
       * acabou de ser aberto.
       */
      if (armazenado === chaveAtual) {
        GM_setValue(storageKey, null);
      }
    });
  });
}

function el(tag, classe = "", texto = null) {
  const elemento = document.createElement(tag);

  if (classe) {
    elemento.className = classe;
  }

  if (texto !== null) {
    elemento.textContent = texto;
  }

  return elemento;
}

export { el, configurarAccordionPersistente };
