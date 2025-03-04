import { buildOption, type OptionParams } from 'src/lib/utils/bin/option';

describe('Option Utils', () => {
  describe('buildOption', () => {
    it('should build an option with shortKey and key', () => {
      const params: OptionParams = {
        shortKey: 'o',
        key: 'output',
        description: 'Output directory'
      };
      
      const [option, description] = buildOption(params);
      
      expect(option).toBe('-o --output ');
      expect(description).toBe('Output directory');
    });
    
    it('should build an option with args', () => {
      const params: OptionParams = {
        shortKey: 'i',
        key: 'input',
        args: '<file>',
        description: 'Input file'
      };
      
      const [option, description] = buildOption(params);
      
      expect(option).toBe('-i --input <file>');
      expect(description).toBe('Input file');
    });
    
    it('should ignore defaultValue in the option string', () => {
      const params: OptionParams = {
        shortKey: 'd',
        key: 'debug',
        description: 'Enable debug mode',
        defaultValue: true
      };
      
      const [option, description] = buildOption(params);
      
      expect(option).toBe('-d --debug ');
      expect(description).toBe('Enable debug mode');
    });
  });
});