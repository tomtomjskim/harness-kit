import type { HarnessConfig } from '../types/index.js';

export interface BuildOptions {
  verbose?: boolean;
  dryRun?: boolean;
  outputDir?: string;
}

export async function build(config: HarnessConfig, options: BuildOptions = {}): Promise<void> {
  // Phase 1에서 구현
  // 1. Resolver
  // 2. Loader
  // 3. Validator
  // 4. Merger
  // 5. Renderer
  // 6. Writer
  console.log('Build pipeline — Phase 1 구현 예정');
}
