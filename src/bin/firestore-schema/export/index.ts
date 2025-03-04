#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();
import { setupProgram } from "src/lib/utils/bin/program";
import { exportCommandOptions } from "src/bin/firestore-schema/export/params";
import { executeSyncExportCommand } from "src/bin/firestore-schema/export/command";

const program = setupProgram({options: exportCommandOptions});
executeSyncExportCommand(program);

