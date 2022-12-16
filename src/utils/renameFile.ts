import fs from "fs";
import { promisify } from "util";

export const renameFile = promisify(fs.rename);
