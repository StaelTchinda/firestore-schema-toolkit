#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();
import colors from "colors";
import { migrateCommandOptions } from "src/bin/firestore-migrate/params";
import { setupProgram } from "src/lib/utils/bin/program";
import { executeAsyncMigrateCommand } from "src/bin/firestore-migrate/command";


const program = setupProgram({options: migrateCommandOptions});
executeAsyncMigrateCommand(program).catch((error) => {
  if (error instanceof Error) {
    console.error(colors.red(`${error.name}: ${error.message}`));
    console.error(colors.red(error.stack as string));
    process.exit(1);
  } else {
    console.error(colors.red(String(error)));
  }
});

