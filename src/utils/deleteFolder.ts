import rimraf from "rimraf";
import { promisify } from "util";

export const deleteFolder = promisify(rimraf);
