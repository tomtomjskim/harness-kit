export { build, buildFromFile } from './commands/build.js';
export { initCommand as init } from './commands/init.js';
export type { HarnessConfig, Module, ModuleType } from './types/index.js';
export {
  HarnessError,
  ModuleNotFoundError,
  DuplicateMcpKeyError,
  UndefinedVariableError,
  CyclicDependencyError,
  ValidationError,
  PermissionConflictError,
} from './errors.js';
export { runPipeline } from './pipeline/index.js';
