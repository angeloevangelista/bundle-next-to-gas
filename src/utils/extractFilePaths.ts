import fs from "fs";
import path from "path";

function extractFilePaths(rootPath: string) {
  const isFile = (fileOrFolder: string) =>
    fs.statSync(path.join(rootPath, fileOrFolder)).isFile();

  const isDirectory = (fileOrFolder: string) =>
    fs.statSync(path.join(rootPath, fileOrFolder)).isDirectory();

  const paths = [];

  const dirContent = fs.readdirSync(rootPath);

  const files = dirContent.filter(isFile);
  const folders = dirContent.filter(isDirectory);

  if (folders.length !== 0) {
    folders.forEach((folder) => {
      const innerPaths = extractFilePaths(path.join(rootPath, folder));

      paths.push(...innerPaths);
    });
  }

  paths.push(...files.map((file) => path.join(rootPath, file)));

  return paths.sort((a, b) => a.length - b.length);
}

export { extractFilePaths };
