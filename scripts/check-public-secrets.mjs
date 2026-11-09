import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
const root = new URL("../", import.meta.url).pathname;
const ignore = new Set([".git", "node_modules", "dist", ".env", "coverage"]);
const allowedExt =
  /\.(?:js|jsx|ts|tsx|html|css|md|sql|json|mjs|yml|yaml|example)$/;
const patterns = [
  {
    label: "Supabase URL de produção conhecida",
    re: new RegExp(["ezct", "picq", "omsz", "xtdg", "ebfq"].join(""), "i"),
  },
  { label: "Segredo Supabase", re: /sb_secret_[A-Za-z0-9_-]{8,}/ },
  {
    label: "Chave service_role em JWT",
    re: /eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/,
  },
  { label: "Chave AWS", re: /AKIA[0-9A-Z]{16}/ },
];
let failures = 0;
async function visit(dir) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (ignore.has(ent.name) || ent.name.startsWith(".env.")) continue;
    const path = join(dir, ent.name);
    if (ent.isDirectory()) await visit(path);
    else if (allowedExt.test(ent.name)) {
      const content = await readFile(path, "utf8");
      for (const p of patterns)
        if (p.re.test(content)) {
          console.error(
            `Possível segredo em ${relative(root, path)}: ${p.label}`,
          );
          failures++;
        }
    }
  }
}
await visit(root);
if (failures) {
  process.exitCode = 1;
} else console.log("Verificação local de padrões de segredos: sem achados.");
