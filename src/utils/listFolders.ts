import fs from "fs";
import path from "path";
import { promisify } from "util";

async function listFolders(folderPath: string) {
  const promisifiedReadDir = promisify(fs.readdir);

  const dirContent = await promisifiedReadDir(folderPath);

  return dirContent.filter((fileOrFolder) => {
    const isFolder = fs.statSync(
      path.join(folderPath, fileOrFolder),
    ).isDirectory();

    return isFolder;
  });
}

export { listFolders };
