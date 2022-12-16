import fs from "fs";
import { promisify } from "util";

async function checkIfPathExists(folderPath: string): Promise<boolean> {
  const promisifiedExists = promisify(fs.exists);

  const folderExists = await promisifiedExists(folderPath);

  return folderExists;
}

export { checkIfPathExists };
