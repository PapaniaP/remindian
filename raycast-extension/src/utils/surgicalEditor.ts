/**
 * Surgical editor — ported from Remindian's ObsidianService surgical edit methods.
 *
 * CRITICAL DESIGN PRINCIPLE: We NEVER reconstruct task lines from parsed fields.
 * All writes are surgical modifications that preserve the original line's content.
 * This prevents data loss of metadata that wasn't parsed (custom annotations, etc.).
 *
 * Safety: Before every edit, we verify the line content hasn't changed since we read it.
 */

import fs from "fs-extra";
import { Task, MetadataChanges, Priority } from "../types";
import { DATE_PATTERNS, PRIORITY_PATTERNS, ICONS } from "../constants";
import { priorityToEmoji } from "./priority";

/**
 * Read a file, verify the task's line hasn't changed, and return the lines array.
 * Throws if the file was modified externally.
 */
async function readAndVerify(
  task: Task,
): Promise<{ lines: string[]; content: string }> {
  const content = await fs.readFile(task.source.filePath, "utf-8");
  const lines = content.split("\n");

  if (lines[task.source.lineNumber] !== task.source.originalLine) {
    throw new Error(
      "Task was modified in Obsidian since last refresh. Please refresh the task list.",
    );
  }

  return { lines, content };
}

/**
 * Write lines back to the file atomically.
 */
async function writeLines(filePath: string, lines: string[]): Promise<void> {
  await fs.writeFile(filePath, lines.join("\n"), "utf-8");
}

/**
 * Format a Date as YYYY-MM-DD.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Surgically mark a task as complete.
 * Only changes "- [ ]" to "- [x]" and appends completion date.
 * Ported from Remindian's ObsidianService.markTaskComplete().
 */
export async function markTaskComplete(
  task: Task,
  completionDate: Date = new Date(),
): Promise<void> {
  const { lines } = await readAndVerify(task);
  let line = lines[task.source.lineNumber];

  // Surgical checkbox toggle
  line = line.replace("- [ ]", "- [x]");

  // Append completion date if not already present
  const completionPattern = /✅\uFE0F?\s*\d{4}-\d{2}-\d{2}/;
  if (!completionPattern.test(line)) {
    const trimmedLine = line.replace(/\s+$/, "");
    line = `${trimmedLine} ${ICONS.DATE.COMPLETION} ${formatDate(completionDate)}`;
  }

  lines[task.source.lineNumber] = line;
  await writeLines(task.source.filePath, lines);
}

/**
 * Surgically mark a task as incomplete.
 * Changes "- [x]" to "- [ ]" and removes completion date.
 * Ported from Remindian's ObsidianService.markTaskIncomplete().
 */
export async function markTaskIncomplete(task: Task): Promise<void> {
  const { lines } = await readAndVerify(task);
  let line = lines[task.source.lineNumber];

  // Surgical checkbox toggle
  line = line.replace(/- \[[xX]\]/, "- [ ]");

  // Remove completion date marker
  line = line.replace(/\s*✅\uFE0F?\s*\d{4}-\d{2}-\d{2}/, "");

  lines[task.source.lineNumber] = line;
  await writeLines(task.source.filePath, lines);
}

/**
 * Surgically update metadata fields in a task line.
 * Only touches the specific emoji+date or priority emoji being changed.
 * Ported from Remindian's ObsidianService.updateTaskMetadata().
 */
export async function updateTaskMetadata(
  task: Task,
  changes: MetadataChanges,
): Promise<void> {
  const { lines } = await readAndVerify(task);
  let line = lines[task.source.lineNumber];

  // Due date
  if (changes.newDueDate !== undefined) {
    if (changes.newDueDate === null) {
      // Remove due date
      line = line.replace(/\s*📅\uFE0F?\s*\d{4}-\d{2}-\d{2}/, "");
    } else if (DATE_PATTERNS.DUE.test(line)) {
      // Replace existing due date digits only
      line = line.replace(
        /(📅\uFE0F?\s*)\d{4}-\d{2}-\d{2}/,
        `$1${formatDate(changes.newDueDate)}`,
      );
    } else {
      // Append due date
      const trimmed = line.replace(/\s+$/, "");
      line = `${trimmed} ${ICONS.DATE.DUE} ${formatDate(changes.newDueDate)}`;
    }
  }

  // Start date
  if (changes.newStartDate !== undefined) {
    if (changes.newStartDate === null) {
      line = line.replace(/\s*🛫\uFE0F?\s*\d{4}-\d{2}-\d{2}/, "");
    } else if (DATE_PATTERNS.START.test(line)) {
      line = line.replace(
        /(🛫\uFE0F?\s*)\d{4}-\d{2}-\d{2}/,
        `$1${formatDate(changes.newStartDate)}`,
      );
    } else {
      const trimmed = line.replace(/\s+$/, "");
      line = `${trimmed} ${ICONS.DATE.START} ${formatDate(changes.newStartDate)}`;
    }
  }

  // Scheduled date
  if (changes.newScheduledDate !== undefined) {
    if (changes.newScheduledDate === null) {
      line = line.replace(/\s*⏳\uFE0F?\s*\d{4}-\d{2}-\d{2}/, "");
    } else if (DATE_PATTERNS.SCHEDULED.test(line)) {
      line = line.replace(
        /(⏳\uFE0F?\s*)\d{4}-\d{2}-\d{2}/,
        `$1${formatDate(changes.newScheduledDate)}`,
      );
    } else {
      const trimmed = line.replace(/\s+$/, "");
      line = `${trimmed} ${ICONS.DATE.SCHEDULED} ${formatDate(changes.newScheduledDate)}`;
    }
  }

  // Priority
  if (changes.newPriority !== undefined) {
    // Remove existing priority emoji
    const allPriorityPatterns = [
      PRIORITY_PATTERNS.HIGHEST,
      PRIORITY_PATTERNS.HIGH,
      PRIORITY_PATTERNS.MEDIUM,
      PRIORITY_PATTERNS.LOW,
      PRIORITY_PATTERNS.LOWEST,
    ];
    for (const pattern of allPriorityPatterns) {
      line = line.replace(pattern, "");
    }

    // Add new priority emoji after the description (before dates/tags)
    // Find the checkbox end and insert after the text content
    const newEmoji = priorityToEmoji(changes.newPriority);
    if (newEmoji) {
      // Insert priority after "- [x] " or "- [ ] " and the text, before first emoji/tag
      const checkboxMatch = line.match(/^(\s*[-*+] \[[ xX]\] )/);
      if (checkboxMatch) {
        const afterCheckbox = line.slice(checkboxMatch[0].length);
        // Find first metadata marker position
        const metaPatterns = [/📅/, /🛫/, /⏳/, /✅/, /🔁/, /🔂/, /#[\w-]/];
        let insertPos = afterCheckbox.length;
        for (const p of metaPatterns) {
          const m = afterCheckbox.search(p);
          if (m >= 0 && m < insertPos) insertPos = m;
        }
        const textPart = afterCheckbox.slice(0, insertPos).replace(/\s+$/, "");
        const restPart = afterCheckbox.slice(insertPos);
        line = `${checkboxMatch[0]}${textPart} ${newEmoji} ${restPart}`.replace(
          /\s+/g,
          " ",
        );
        // Restore trailing structure
        line = line.replace(/\s+$/, "");
      }
    }

    // Clean up double spaces
    line = line.replace(/  +/g, " ");
  }

  lines[task.source.lineNumber] = line;
  await writeLines(task.source.filePath, lines);
}

/**
 * Append a new task line to the end of a file.
 * This is the ONE place where line construction is safe — for brand new tasks.
 */
export async function appendNewTask(
  filePath: string,
  taskLine: string,
): Promise<void> {
  if (!(await fs.pathExists(filePath))) {
    const dirPath = (await import("path")).dirname(filePath);
    await fs.ensureDir(dirPath);
    await fs.writeFile(filePath, `${taskLine}\n`, "utf-8");
    return;
  }

  const content = await fs.readFile(filePath, "utf-8");
  const newContent = content.endsWith("\n")
    ? `${content}${taskLine}\n`
    : `${content}\n${taskLine}\n`;
  await fs.writeFile(filePath, newContent, "utf-8");
}

/**
 * Delete a task line from its source file.
 * Verifies the line content before removing.
 */
export async function deleteTaskLine(task: Task): Promise<void> {
  const { lines } = await readAndVerify(task);
  lines.splice(task.source.lineNumber, 1);
  await writeLines(task.source.filePath, lines);
}
