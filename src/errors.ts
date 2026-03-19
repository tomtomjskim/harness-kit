import type { ZodIssue } from 'zod';

export class HarnessError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'HarnessError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ModuleNotFoundError extends HarnessError {
  constructor(
    public readonly moduleName: string,
    public readonly searchedPaths: string[],
    public readonly suggestions: string[],
  ) {
    const suggestionText =
      suggestions.length > 0 ? ` Did you mean: ${suggestions.join(', ')}?` : '';
    super(
      `Module "${moduleName}" not found in search paths: ${searchedPaths.join(', ')}.${suggestionText}`,
      'MODULE_NOT_FOUND',
    );
    this.name = 'ModuleNotFoundError';
  }
}

export class DuplicateMcpKeyError extends HarnessError {
  constructor(
    public readonly key: string,
    public readonly module1: string,
    public readonly module2: string,
  ) {
    super(
      `Duplicate MCP server key "${key}" with conflicting values defined in modules "${module1}" and "${module2}".`,
      'DUPLICATE_MCP_KEY',
    );
    this.name = 'DuplicateMcpKeyError';
  }
}

export class UndefinedVariableError extends HarnessError {
  constructor(
    public readonly variableName: string,
    public readonly moduleName: string,
  ) {
    super(
      `Required variable "{{${variableName}}}" is not defined in module "${moduleName}".`,
      'UNDEFINED_VARIABLE',
    );
    this.name = 'UndefinedVariableError';
  }
}

export class CyclicDependencyError extends HarnessError {
  constructor(public readonly cycleModules: string[]) {
    super(
      `Cyclic dependency detected among modules: ${cycleModules.join(' → ')}.`,
      'CYCLIC_DEPENDENCY',
    );
    this.name = 'CyclicDependencyError';
  }
}

export class ValidationError extends HarnessError {
  constructor(
    public readonly moduleName: string,
    public readonly issues: ZodIssue[],
  ) {
    const summary = issues.map((i) => `  - [${i.path.join('.')}] ${i.message}`).join('\n');
    super(`Validation failed for module "${moduleName}":\n${summary}`, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class PermissionConflictError extends HarnessError {
  constructor(public readonly conflictingPatterns: string[]) {
    super(
      `Permission conflict: patterns appear in both allow and deny lists: ${conflictingPatterns.join(', ')}.`,
      'PERMISSION_CONFLICT',
    );
    this.name = 'PermissionConflictError';
  }
}
