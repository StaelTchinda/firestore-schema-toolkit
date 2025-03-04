import { Command } from "commander";
import { buildOption, OptionParams } from "src/lib/utils/bin/option";
import { packageInfo } from "src/lib/utils/bin/common";

interface ProgramParams {
  options: {[key: string]: OptionParams};
  parse?: boolean; // Default is true
}

export function setupProgram({options, parse = true}: ProgramParams): Command {
  const program = new Command();
  program
    .name(packageInfo.name)
    .description(packageInfo.description)
    .version(packageInfo.version);

  for (const key in options) {
    program.option(...buildOption(options[key]));
  }
  if (parse) {
    program.parse(process.argv);
  }

  return program;
}
