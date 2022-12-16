import { promisify } from "util";
import childProcess from "child_process";

async function executeCommand(
  command: string,
  directoryToExecute?: string
): Promise<string> {
  const promisifiedExec = promisify(childProcess.exec);

  try {
    const { stdout } = await promisifiedExec(
      `${directoryToExecute ? `cd ${directoryToExecute} && ` : ""} ${command}`
    );

    return stdout;
  } catch (err) {
    throw err;
  }
}

export { executeCommand };
