import fs from "fs";
import { promisify } from "util";

export const writeFile = promisify(fs.writeFile);
