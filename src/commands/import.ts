import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename, isAbsolute } from 'node:path';

// ANSI color codes
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

export interface ImportOptions {
  outputDir?: string;
}

interface Section {
  title: string;
  slug: string;
  content: string;
  level: number;
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function parseSections(markdown: string): Section[] {
  const lines = markdown.split('\n');
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  const bodyLines: string[] = [];

  // Preamble before any heading
  let preambleLines: string[] = [];
  let foundFirstHeading = false;
  let inCodeBlock = false;

  for (const line of lines) {
    // Track code block boundaries to avoid splitting inside them
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    const h2Match = !inCodeBlock ? line.match(/^##\s+(.+)/) : null;
    const h1Match = !inCodeBlock ? line.match(/^#\s+(.+)/) : null;

    if (h2Match) {
      const title = h2Match[1].trim();

      if (!foundFirstHeading && preambleLines.length > 0) {
        // Store preamble as a section if there's content
        const preambleContent = preambleLines.join('\n').trim();
        if (preambleContent) {
          sections.push({
            title: 'overview',
            slug: 'overview',
            content: preambleContent,
            level: 1,
          });
        }
        preambleLines = [];
      }

      // Save previous section
      if (currentSection) {
        currentSection.content = bodyLines.join('\n').trim();
        sections.push(currentSection);
        bodyLines.length = 0;
      }

      foundFirstHeading = true;
      currentSection = {
        title,
        slug: toKebabCase(title),
        content: '',
        level: 2,
      };
    } else if (h1Match && !foundFirstHeading) {
      // h1 is treated as document title — collect as preamble content
      preambleLines.push(line);
    } else {
      if (!foundFirstHeading) {
        preambleLines.push(line);
      } else if (currentSection) {
        bodyLines.push(line);
      }
    }
  }

  // Last section
  if (currentSection) {
    currentSection.content = bodyLines.join('\n').trim();
    if (currentSection.content) {
      sections.push(currentSection);
    }
  }

  // Filter out empty sections
  return sections.filter((s) => s.content.length > 0);
}

function generateModuleFrontmatter(section: Section): string {
  const name = section.slug || 'section';
  // Escape description for YAML safety (backticks, colons, quotes)
  const rawDesc = section.title;
  const needsQuoting = /[`:#"'{}[\]|>&*!%@]/.test(rawDesc);
  const description = needsQuoting ? `"${rawDesc.replace(/"/g, '\\"')}"` : rawDesc;
  // Auto-generate section heading from title
  const sectionHeading = section.level <= 2 ? `## ${section.title}` : `### ${section.title}`;
  return [
    '---',
    `name: ${name}`,
    `type: instruction`,
    `description: ${description}`,
    `tags: [imported]`,
    `section: "${sectionHeading}"`,
    `priority: 50`,
    '---',
  ].join('\n');
}

export async function importCommand(file: string, options: ImportOptions): Promise<void> {
  const inputPath = isAbsolute(file) ? file : join(process.cwd(), file);

  if (!existsSync(inputPath)) {
    console.error(`Error: File not found: ${file}`);
    process.exit(1);
  }

  let raw: string;
  try {
    raw = await readFile(inputPath, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error reading file: ${msg}`);
    process.exit(1);
  }

  const lineCount = raw.split('\n').length;
  const inputBasename = basename(file);
  console.log(`\nParsing: ${inputBasename} (${lineCount} lines)\n`);

  const sections = parseSections(raw);

  if (sections.length === 0) {
    console.log('No sections found. The file may not have any ## headings.');
    return;
  }

  console.log(`Extracted ${sections.length} sections:`);

  const outputDir = options.outputDir ?? '.harness/modules';
  const absoluteOutputDir = join(process.cwd(), outputDir);

  // Create output directory if it doesn't exist
  await mkdir(absoluteOutputDir, { recursive: true });

  // Ensure unique slugs
  const slugCounts = new Map<string, number>();
  for (const section of sections) {
    const count = slugCounts.get(section.slug) ?? 0;
    slugCounts.set(section.slug, count + 1);
  }

  const usedSlugs = new Map<string, number>();
  const outputFiles: Array<{ slug: string; filePath: string }> = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    let slug = section.slug || `section-${i + 1}`;

    // Handle duplicate slugs by appending index
    if ((slugCounts.get(slug) ?? 0) > 1) {
      const idx = (usedSlugs.get(slug) ?? 0) + 1;
      usedSlugs.set(slug, idx);
      if (idx > 1) slug = `${slug}-${idx}`;
    }

    const outputFileName = `${slug}.md`;
    const outputFilePath = join(absoluteOutputDir, outputFileName);
    const relativeOutputPath = join(outputDir, outputFileName);

    const frontmatter = generateModuleFrontmatter({ ...section, slug });
    const fileContent = `${frontmatter}\n\n${section.content}\n`;

    await writeFile(outputFilePath, fileContent, 'utf-8');

    const numLabel = String(i + 1).padStart(2, ' ');
    const slugPadded = slug.padEnd(20);
    console.log(`  ${numLabel}. ${slugPadded} → ${GREEN}${relativeOutputPath}${RESET}`);

    outputFiles.push({ slug, filePath: relativeOutputPath });
  }

  console.log('\nAdd to harness.config.yaml:');
  console.log('  modules:');
  for (const { slug } of outputFiles) {
    console.log(`    - name: ${slug}`);
  }
  console.log('');
}
