export enum Priority {
  HIGHEST = "highest",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
  LOWEST = "lowest",
}

export const PRIORITY_VALUES = [
  Priority.HIGHEST,
  Priority.HIGH,
  Priority.MEDIUM,
  Priority.LOW,
  Priority.LOWEST,
] as const;

/**
 * Tracks the exact source location and content of a task in an Obsidian file.
 * The `originalLine` field is CRITICAL for surgical edits — it allows us to
 * verify the line hasn't changed before writing.
 */
export interface ObsidianSource {
  filePath: string;
  lineNumber: number;
  originalLine: string;
}

export interface Task {
  id: string; // `${filePath}:${lineNumber}`
  description: string; // Raw description including emojis, dates, tags
  cleanTitle: string; // Display title stripped of metadata
  completed: boolean;
  status: string; // Raw checkbox character: " ", "x", "/", "-", ">", "?", "!", etc.
  dueDate?: Date;
  scheduledDate?: Date;
  startDate?: Date;
  completedAt?: Date;
  createdDate?: Date;
  priority?: Priority;
  tags?: string[]; // Full tags: ["#work/clients/somfy", "#urgent"]
  targetList?: string; // First tag's top-level: "work"
  recurrence?: string; // Raw recurrence text
  clientName?: string; // From frontmatter
  source: ObsidianSource;
  indentation: string;
}

export interface TaskFile {
  filePath: string;
  fileName: string;
  tasks: Task[];
  clientName?: string;
}

export interface ScanOptions {
  excludedFolders: string[];
  includedFolders: string[];
  includeCompleted: boolean;
}

export interface MetadataChanges {
  newDueDate?: Date | null; // undefined = no change, null = remove, Date = set
  newStartDate?: Date | null;
  newScheduledDate?: Date | null;
  newPriority?: Priority; // undefined = no change
}
