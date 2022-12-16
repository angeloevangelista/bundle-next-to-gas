import fs from "fs";
import { promisify } from "util";

export const deleteFile = promisify(fs.unlink);
