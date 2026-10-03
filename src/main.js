"use strict";

import { HOSTS_BLOQUEADOS } from "./core/config.js";
import { iniciarToolkit } from "./core/app.js";

if (!HOSTS_BLOQUEADOS.includes(location.hostname)) {
  iniciarToolkit();
}
