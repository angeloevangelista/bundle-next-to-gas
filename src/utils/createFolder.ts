import fs from "fs";
import { promisify } from "util";

async function createFolder(folderPath: string): Promise<void> {
  const promisifiedMkdir = promisify(fs.mkdir);

  await promisifiedMkdir(folderPath, { recursive: true });
}

export { createFolder };
