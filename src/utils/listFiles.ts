import fs from "fs";
import path from "path";
import { promisify } from "util";

async function listFiles(folderPath: string) {
  const promisifiedReadDir = promisify(fs.readdir);

  const dirContent = await promisifiedReadDir(folderPath);

  return dirContent.filter((fileOrFolder) => {
    const isFile = fs.statSync(path.join(folderPath, fileOrFolder)).isFile();

    return isFile;
  });
}

export { listFiles };
