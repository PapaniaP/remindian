/**
 * Vault scanner — ported from Remindian's ObsidianService.scanVault() (Swift → TypeScript).
 *
 * Scans an entire Obsidian vault for tasks, supporting:
 * - Whitelist mode (includedFolders) and blacklist mode (excludedFolders)
 * - Frontmatter client extraction
 * - Multi-file task collection
 */

import fs from "fs-extra";
import path from "path";
import matter from "gray-matter";
import { Task, TaskFile, ScanOptions } from "../types";
import { parseTaskFromLine } from "./taskParser";

/**
 * Extract the `client` property from YAML frontmatter.
 * Handles formats like: client: "[[Bodycare Travel]]", client: Somfy, client: "[[Clay]]"
 * Ported from Remindian's ObsidianService.extractFrontmatterClient().
 */
export function extractFrontmatterClient(content: string): string | null {
  try {
    const { data } = matter(content);
    if (!data.client) return null;

    let client = String(data.client);
    // Remove wikilink brackets: "[[Bodycare Travel]]" → "Bodycare Travel"
    client = client.replace(/^\[\[/, "").replace(/\]\]$/, "");
    // Remove surrounding quotes
    client = client.replace(/^["']|["']$/g, "");
    return client.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Check if a folder should be excluded based on the exclude list.
 * Matches by folder name, relative path, or path prefix.
 * Ported from Remindian's findMarkdownFiles() exclude logic.
 */
function shouldExcludeFolder(
  folderName: string,
  relativePath: string,
  excludedFolders: string[],
): boolean {
  for (const excluded of excludedFolders) {
    const trimmed = excluded.trim();
    if (!trimmed) continue;
    if (folderName === trimmed) return true;
    if (relativePath === trimmed) return true;
    if (relativePath.startsWith(trimmed + "/")) return true;
  }
  return false;
}

/**
 * Recursively find all markdown files in a directory, respecting include/exclude lists.
 * Ported from Remindian's ObsidianService.findMarkdownFiles().
 *
 * Whitelist mode: if includedFolders is non-empty, scan ONLY those folders + root .md files.
 * Blacklist mode: otherwise, scan all, excluding specified folders.
 */
async function findMarkdownFiles(
  dirPath: string,
  vaultPath: string,
  options: ScanOptions,
): Promise<string[]> {
  const results: string[] = [];
  const { excludedFolders, includedFolders } = options;
  const useWhitelist =
    includedFolders.length > 0 &&
    includedFolders.some((f) => f.trim().length > 0);

  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(vaultPath, fullPath);

    if (entry.isDirectory()) {
      // Skip hidden directories always
      if (entry.name.startsWith(".") && !includedFolders.includes(entry.name)) {
        continue;
      }

      if (useWhitelist) {
        // Whitelist mode: only descend into included folders
        const isIncluded = includedFolders.some((f) => {
          const trimmed = f.trim();
          return (
            trimmed === entry.name ||
            trimmed === relativePath ||
            relativePath.startsWith(trimmed + "/") ||
            trimmed.startsWith(relativePath + "/")
          );
        });
        if (isIncluded) {
          const subFiles = await findMarkdownFiles(fullPath, vaultPath, options);
          results.push(...subFiles);
        }
      } else {
        // Blacklist mode: skip excluded folders
        if (shouldExcludeFolder(entry.name, relativePath, excludedFolders)) {
          continue;
        }
        const subFiles = await findMarkdownFiles(fullPath, vaultPath, options);
        results.push(...subFiles);
      }
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Parse tasks from a single markdown file.
 * Extracts frontmatter client and parses each line for tasks.
 * Ported from Remindian's ObsidianService.parseTasksFromFile().
 */
export async function parseTasksFromFile(
  filePath: string,
): Promise<TaskFile> {
  const content = await fs.readFile(filePath, "utf-8");
  const clientName = extractFrontmatterClient(content);

  // Get content after frontmatter
  let fileContent: string;
  try {
    const parsed = matter(content);
    fileContent = parsed.content;
  } catch {
    fileContent = content;
  }

  const lines = fileContent.split("\n");
  const tasks: Task[] = [];

  // Calculate line offset if frontmatter was present
  // gray-matter's .content starts after the frontmatter block
  const fullLines = content.split("\n");
  let frontmatterLineCount = 0;
  if (content.startsWith("---")) {
    for (let i = 1; i < fullLines.length; i++) {
      if (fullLines[i].trim() === "---") {
        frontmatterLineCount = i + 1;
        break;
      }
    }
  }

  lines.forEach((line, index) => {
    const actualLineNumber = index + frontmatterLineCount;
    // Pass the original full line (including from the original content) for surgical edits
    const originalLine = fullLines[actualLineNumber];
    if (!originalLine) return;

    const task = parseTaskFromLine(originalLine, filePath, actualLineNumber);
    if (task) {
      if (clientName) {
        task.clientName = clientName;
      }
      tasks.push(task);
    }
  });

  return {
    filePath,
    fileName: path.basename(filePath),
    tasks,
    clientName: clientName || undefined,
  };
}

/**
 * Scan an entire Obsidian vault for tasks.
 * Ported from Remindian's ObsidianService.scanVault().
 */
export async function scanVault(
  vaultPath: string,
  options: ScanOptions,
): Promise<TaskFile[]> {
  if (!(await fs.pathExists(vaultPath))) {
    throw new Error(`Vault path does not exist: ${vaultPath}`);
  }

  const mdFiles = await findMarkdownFiles(vaultPath, vaultPath, options);
  const taskFiles: TaskFile[] = [];

  for (const filePath of mdFiles) {
    try {
      const taskFile = await parseTasksFromFile(filePath);
      if (taskFile.tasks.length > 0) {
        if (!options.includeCompleted) {
          taskFile.tasks = taskFile.tasks.filter((t) => !t.completed);
        }
        if (taskFile.tasks.length > 0) {
          taskFiles.push(taskFile);
        }
      }
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error);
    }
  }

  return taskFiles;
}
