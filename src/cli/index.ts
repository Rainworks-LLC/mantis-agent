import { ensureDirs } from "../config/paths.js";
import { buildProgram } from "./program.js";

await ensureDirs();
const program = buildProgram();
program.parse();
