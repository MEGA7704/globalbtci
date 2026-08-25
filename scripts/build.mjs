import { cp, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

if (existsSync("dist")) await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
console.log("GLOBAL BT build OK -> dist/");
