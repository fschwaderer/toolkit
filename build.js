import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { build } from "esbuild";
import { minify } from "terser";

const raiz = path.dirname(fileURLToPath(import.meta.url));
const minificar = process.argv.includes("--minify");
const original = await readFile(path.join(raiz, "all.js"), "utf8");
const metadata = original.match(
  /^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/,
)?.[0];
if (!metadata)
  throw new Error("Metadata Tampermonkey não encontrado no all.js.");

// Cabeçalho de lint centralizado: inserido depois do metadata, fora do bundle.
const globais = await readFile(
  path.join(raiz, "src/tampermonkey-globals.js"),
  "utf8",
);

const resultado = await build({
  absWorkingDir: raiz,
  entryPoints: ["src/main.js"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "esnext",
  charset: "utf8",
  minify: false,
  treeShaking: false,
  keepNames: true,
  legalComments: "inline",
});

let codigo = resultado.outputFiles[0].text;
if (minificar) {
  const resultadoMinificado = await minify(codigo, {
    compress: false,
    mangle: false,
    keep_fnames: true,
    keep_classnames: true,
    format: { comments: false, ascii_only: false },
  });
  if (!resultadoMinificado.code) throw new Error("Terser não gerou código.");
  codigo = resultadoMinificado.code;
}

const final = metadata + "\n\n" + globais.trimEnd() + "\n\n" + codigo + "\n";
new vm.Script(final);
if (
  final.match(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/)?.[0] !==
  metadata
) {
  throw new Error("Metadata alterado durante o build.");
}
const destino = path.join(
  raiz,
  "dist",
  minificar ? "Fausto.Toolkit.min.user.js" : "Fausto.Toolkit.user.js",
);
await mkdir(path.dirname(destino), { recursive: true });
await writeFile(destino, final, "utf8");
console.log(
  `Gerado ${path.relative(raiz, destino)} (sintaxe e metadata validados).`,
);
