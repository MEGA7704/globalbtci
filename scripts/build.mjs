import { cp, rm, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";

if (existsSync("dist")) await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });

const xlsx = "node_modules/xlsx/dist/xlsx.full.min.js";
if (!existsSync(xlsx)) {
  throw new Error("Dépendance xlsx absente. Exécutez npm install avant npm run build.");
}
await copyFile(xlsx, "dist/xlsx.full.min.js");
console.log("GLOBAL BT : build terminé dans dist/");
