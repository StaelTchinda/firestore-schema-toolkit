import * as path from "path";
import { register } from "ts-node";
import * as fs from "fs/promises";

const logger = console;

export async function registerTsCompiler(tsconfigPath?: string) {
  const defaultTSConfig = {
    compilerOptions: {
      noImplicitAny: false,
      target: "ESNext",
      module: "CommonJS",
    },
  };
  const absoluteTsConfigPath = tsconfigPath
    ? path.isAbsolute(tsconfigPath)
      ? tsconfigPath
      : path.join(process.cwd(), tsconfigPath)
    : null;
  const tsConfigExists = absoluteTsConfigPath
    ? await fs
        .access(absoluteTsConfigPath)
        .then(() => true)
        .catch(() => false)
    : false;

  if (absoluteTsConfigPath && !tsConfigExists) {
    logger.warn(
      `No tsconfig file found at ${absoluteTsConfigPath}. Using default configuration`
    );
  }
  const tsConfig =
    absoluteTsConfigPath && tsConfigExists
      ? JSON.parse(await fs.readFile(absoluteTsConfigPath, "utf-8"))
      : defaultTSConfig;

  register(tsConfig);
}
