#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();
import colors from "colors";
import { setupProgram } from "src/lib/utils/bin/program";
import { validateCommandOptions } from "src/bin/firestore-schema/validate/params";
import { executeAsyncValidateCommand } from "src/bin/firestore-schema/validate/command";

const program = setupProgram({options: validateCommandOptions});
executeAsyncValidateCommand(program).catch((error) => {
  if (error instanceof Error) {
    console.error(colors.red(`${error.name}: ${error.message}`));
    console.error(colors.red(error.stack as string));
    process.exit(1);
  } else {
    console.error(colors.red(String(error)));
  }
});

