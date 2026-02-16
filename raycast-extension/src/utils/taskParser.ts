/**
 * Task parser — ported from Remindian's SyncTask.fromObsidianLine() (Swift → TypeScript).
 *
 * Key improvements over the original Raycast extension parser:
 * - FE0F variation selector handling on all emoji patterns
 * - Hierarchical tag support (#work/clients/somfy)
 * - Recurrence stripping from display title (both emoji and plain-text)
 * - Target list extraction from first tag
 */

import { Task, Priority } from "../types";
import {
  DATE_PATTERNS,
  PRIORITY_PATTERNS,
  TAG_PATTERN,
  TASK_REGEX,
  STATUS_MAP,
  RECURRENCE_EMOJI_PATTERN,
  RECURRENCE_PLAIN_PATTERN,
} from "../constants";

/**
 * Extract a date from content and remove the matched portion.
 * Handles optional FE0F variation selector after emoji.
 */
function extractDate(
  content: string,
  pattern: RegExp,
): { date: Date | undefined; remaining: string } {
  const match = content.match(pattern);
  if (!match || !match[1]) return { date: undefined, remaining: content };

  const dateStr = match[1];
  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date.getTime())) return { date: undefined, remaining: content };

  const remaining = content.replace(match[0], "");
  return { date, remaining };
}

/**
 * Extract priority from content. Returns the priority level and remaining content.
 * Checks in order: HIGHEST, HIGH, MEDIUM, LOW, LOWEST.
 */
function extractPriority(
  content: string,
): { priority: Priority | undefined; remaining: string } {
  const priorityOrder: { pattern: RegExp; level: Priority }[] = [
    { pattern: PRIORITY_PATTERNS.HIGHEST, level: Priority.HIGHEST },
    { pattern: PRIORITY_PATTERNS.HIGH, level: Priority.HIGH },
    { pattern: PRIORITY_PATTERNS.MEDIUM, level: Priority.MEDIUM },
    { pattern: PRIORITY_PATTERNS.LOW, level: Priority.LOW },
    { pattern: PRIORITY_PATTERNS.LOWEST, level: Priority.LOWEST },
  ];

  for (const { pattern, level } of priorityOrder) {
    const match = content.match(pattern);
    if (match) {
      return {
        priority: level,
        remaining: content.replace(match[0], ""),
      };
    }
  }

  return { priority: undefined, remaining: content };
}

/**
 * Extract tags from content, supporting hierarchical tags like #work/clients/somfy.
 */
export function extractTags(text: string): string[] {
  const tags: string[] = [];
  // Reset lastIndex since TAG_PATTERN has global flag
  const regex = new RegExp(TAG_PATTERN.source, "g");
  let match;
  while ((match = regex.exec(text)) !== null) {
    tags.push(match[0]);
  }
  return tags;
}

/**
 * Extract the target list from tags.
 * First tag's top-level segment becomes the target list.
 * e.g., #work/clients/somfy → "work"
 */
export function extractTargetList(tags: string[]): string | undefined {
  if (tags.length === 0) return undefined;
  const firstTag = tags[0].replace(/^#/, "");
  if (firstTag.includes("/")) {
    return firstTag.split("/")[0];
  }
  return firstTag;
}

/**
 * Strip recurrence markers from text.
 * Handles both emoji-based (🔁 every week) and plain-text (every month on the 1st).
 * Returns the recurrence text and the cleaned string.
 */
function extractRecurrence(
  content: string,
): { recurrence: string | undefined; remaining: string } {
  // Try emoji-based recurrence first
  const emojiMatch = content.match(RECURRENCE_EMOJI_PATTERN);
  if (emojiMatch) {
    const recurrenceText = emojiMatch[0]
      .replace(/^[🔁🔂]\uFE0F?\s*/, "")
      .trim();
    return {
      recurrence: recurrenceText || undefined,
      remaining: content.replace(emojiMatch[0], ""),
    };
  }

  // Try plain-text recurrence
  const plainMatch = content.match(RECURRENCE_PLAIN_PATTERN);
  if (plainMatch) {
    return {
      recurrence: plainMatch[0].trim(),
      remaining: content.replace(plainMatch[0], ""),
    };
  }

  return { recurrence: undefined, remaining: content };
}

/**
 * Parse a single line of Obsidian Tasks format into a Task object.
 * Ported from Remindian's SyncTask.fromObsidianLine().
 *
 * Format: - [x] Task title ⏫ 🛫 2024-01-15 📅 2024-01-20 ✅ 2024-01-21 🔁 every week #work #tag2
 */
export function parseTaskFromLine(
  line: string,
  filePath: string,
  lineNumber: number,
): Task | null {
  const match = TASK_REGEX.exec(line);
  if (!match) return null;

  const indentation = match[1];
  const statusChar = match[2];
  const statusInfo = STATUS_MAP[statusChar] ?? STATUS_MAP[statusChar.toLowerCase()] ?? { label: statusChar, completed: false };
  const completed = statusInfo.completed;
  let content = match[3];

  // Extract dates — order matters, each extraction removes the match from content
  const dueResult = extractDate(content, DATE_PATTERNS.DUE);
  content = dueResult.remaining;

  const startResult = extractDate(content, DATE_PATTERNS.START);
  content = startResult.remaining;

  const scheduledResult = extractDate(content, DATE_PATTERNS.SCHEDULED);
  content = scheduledResult.remaining;

  const completedResult = extractDate(content, DATE_PATTERNS.COMPLETED);
  content = completedResult.remaining;

  const createdResult = extractDate(content, DATE_PATTERNS.CREATED);
  content = createdResult.remaining;

  // Extract priority
  const priorityResult = extractPriority(content);
  content = priorityResult.remaining;

  // Extract recurrence
  const recurrenceResult = extractRecurrence(content);
  content = recurrenceResult.remaining;

  // Extract tags
  const tags = extractTags(content);
  const targetList = extractTargetList(tags);

  // Build clean title — remove tags from content
  let cleanTitle = content;
  for (const tag of tags) {
    cleanTitle = cleanTitle.replace(tag, "");
  }

  // Clean up whitespace
  cleanTitle = cleanTitle.replace(/\s+/g, " ").trim();

  if (!cleanTitle) return null;

  return {
    id: `${filePath}:${lineNumber}`,
    description: match[3], // Raw description preserving everything
    cleanTitle,
    completed,
    status: statusChar,
    dueDate: dueResult.date,
    startDate: startResult.date,
    scheduledDate: scheduledResult.date,
    completedAt: completed ? completedResult.date || undefined : undefined,
    createdDate: createdResult.date,
    priority: priorityResult.priority,
    tags: tags.length > 0 ? tags : undefined,
    targetList,
    recurrence: recurrenceResult.recurrence,
    source: {
      filePath,
      lineNumber,
      originalLine: line,
    },
    indentation,
  };
}

/**
 * Get a clean display title for a task, with optional max length truncation.
 * Strips all metadata emojis, dates, tags, and recurrence from the description.
 */
export function getCleanTitle(task: Task, maxLength = 100): string {
  let title = task.cleanTitle;
  if (title.length > maxLength) {
    title = title.substring(0, maxLength) + "...";
  }
  return title;
}
