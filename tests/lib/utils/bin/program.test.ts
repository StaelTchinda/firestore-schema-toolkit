import { Command } from 'commander';
import { setupProgram } from 'src/lib/utils/bin/program';
import { buildOption } from 'src/lib/utils/bin/option';
import { packageInfo } from 'src/lib/utils/bin/common';

// Mock dependencies
jest.mock('commander');
jest.mock('src/lib/utils/bin/option');
jest.mock('src/lib/utils/bin/common', () => ({
  packageInfo: {
    name: 'test-package',
    description: 'Test description',
    version: '1.0.0'
  }
}));

describe('setupProgram', () => {
  let mockCommand: jest.Mocked<Command>;
  let mockParse: jest.Mock;
  let mockOption: jest.Mock;

  beforeEach(() => {
    mockParse = jest.fn().mockReturnThis();
    mockOption = jest.fn().mockReturnThis();
    
    // Setup command mock
    mockCommand = {
      name: jest.fn().mockReturnThis(),
      description: jest.fn().mockReturnThis(),
      version: jest.fn().mockReturnThis(),
      option: mockOption,
      parse: mockParse
    } as unknown as jest.Mocked<Command>;
    
    (Command as jest.Mock).mockImplementation(() => mockCommand);
    (buildOption as jest.Mock).mockImplementation(() => ['--flag', 'description', 'default']);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize program with correct metadata', () => {
    setupProgram({ options: {} });
    
    expect(mockCommand.name).toHaveBeenCalledWith(packageInfo.name);
    expect(mockCommand.description).toHaveBeenCalledWith(packageInfo.description);
    expect(mockCommand.version).toHaveBeenCalledWith(packageInfo.version);
  });

  test('should add options to program', () => {
    const testOptions = {
      option1: { flag: 'flag1', description: 'desc1', shortKey: 'o1', key: 'option1' },
      option2: { flag: 'flag2', description: 'desc2', default: 'def2', shortKey: 'o2', key: 'option2' }
    };
    
    setupProgram({ options: testOptions });
    
    expect(buildOption).toHaveBeenCalledTimes(2);
    expect(buildOption).toHaveBeenCalledWith(testOptions.option1);
    expect(buildOption).toHaveBeenCalledWith(testOptions.option2);
    expect(mockOption).toHaveBeenCalledTimes(2);
  });

  test('should parse arguments by default', () => {
    setupProgram({ options: {} });
    
    expect(mockParse).toHaveBeenCalledWith(process.argv);
  });

  test('should not parse arguments when parse is false', () => {
    setupProgram({ options: {}, parse: false });
    
    expect(mockParse).not.toHaveBeenCalled();
  });

  test('should return command instance', () => {
    const result = setupProgram({ options: {} });
    
    expect(result).toBe(mockCommand);
  });
});
