
export interface OptionParams {
  shortKey: string;
  key: string;
  args?: string;
  description: string;
  defaultValue?: string | boolean | string[];
}

export const buildOption = ({shortKey, key, args = '', description}: OptionParams): [string, string] => [`-${shortKey} --${key} ${args}`, description];


