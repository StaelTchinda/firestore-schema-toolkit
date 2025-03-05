import dotenv from "dotenv";
dotenv.config();
import { Command } from "commander";
import { prompt } from "enquirer";
import { parseParams, validateParams } from "src/bin/firestore-migrate/params";
import {
  FirebaseCredentials,
  getCredentialsFromFile,
  initFirestore,
} from "src/lib/utils/firestore";
import { MigrationScript, PreviewChange, PreviewFunction } from "src/types/migrate/change";
import { registerTsCompiler } from "src/lib/utils/compile";
import path from "path";
import { buildPreviewFunction } from "src/lib/migrate/template";

export async function executeAsyncMigrateCommand(
  program: Command
): Promise<void> {
  // Required to import modules later.
  await registerTsCompiler();

  const params = parseParams(program);
  validateParams(params);

  const credentials: FirebaseCredentials = await getCredentialsFromFile(
    params.accountCredentialsPath
  );
  params.verbose && console.log("Initializing Firestore client");
  const firestore = await initFirestore({
    credentials,
  });

  // Dynamically import the migration script
  params.verbose &&
    console.log(`Loading migration script from ${params.scriptPath}`);
  const migrationScript = (await import(path.resolve(process.cwd(), params.scriptPath))) as MigrationScript;

  // Run preview
  params.verbose && console.log(`Running preview`);
  let migrationPreviewFunction: PreviewFunction;
  if (migrationScript.changes) {
    migrationPreviewFunction = await buildPreviewFunction(migrationScript.changes);
  } else {
    migrationPreviewFunction = migrationScript.preview as PreviewFunction;
  }
  const changes: PreviewChange[] = await migrationPreviewFunction(firestore);

  if (changes.length === 0) {
    console.log(`No changes detected, exiting`);
    return;
  }
  console.log(`Changes detected:`);
  params.verbose && console.table(changes);

  // Prompt user to confirm migration
  const { confirm }: {confirm: boolean} = await prompt({
    type: "confirm",
    name: "confirm",
    message: "Do you want to proceed with the migration?",
  });

  if (!confirm) {
    console.log(`Migration cancelled`);
    return;
  }

  // Run migration
  params.verbose && console.log(`Running migration`);
  // await migrationScript.migrate(firestore);

  params.verbose && console.log(`Migration completed`);
}
