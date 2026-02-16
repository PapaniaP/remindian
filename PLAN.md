# Raycast Extension: Obsidian Tasks (Multi-Vault Fork)

## Overview

Fork the existing [ozencb/obsidian-tasks](https://github.com/raycast/extensions/tree/main/extensions/obsidian-tasks) Raycast extension and replace its single-file data layer with Remindian's multi-file vault scanning + surgical editing logic, ported from Swift to TypeScript.

**Codename:** `obsidian-tasks-vault` (to distinguish from the original during development)

---

## Architecture Decision: Fork vs. Build From Scratch

**Decision: Fork the existing extension.**

### What we keep from the existing extension (and why)

| File | What we keep | Why |
|------|-------------|-----|
| `package.json` | Command structure (5 commands), Raycast API deps, extension metadata | Saves ~1hr of Raycast boilerplate. Commands are well-designed: list, add, edit, mark-done, menubar |
| `src/list-tasks.tsx` | Overall structure: `<List>` with search filtering, detail panel, `<TaskItem>` usage | Clean pattern. We'll add a file-source dropdown filter and tag filter |
| `src/add-task.tsx` | Form layout: description, priority dropdown, date pickers, tags, recurrence | Good UX. We'll add a "Target File" dropdown (populated from vault) |
| `src/edit-task.tsx` | Task selection → push to EditTaskForm pattern | Works well. Minimal changes needed |
| `src/mark-done.tsx` | Search + mark done pattern | Keep as-is, just wire to new surgical edit backend |
| `src/menubar-item.tsx` | MenuBarExtra with task list, submenu per task, priority setting, "Open in Obsidian" | Excellent menubar UX. Add file source display, fix Obsidian URI to handle multiple files |
| `src/components/TaskItem.tsx` | Detail metadata panel, accessories (date, tags, priority icons), action panel | Very polished component. Add: source file display, client name, "Open in Obsidian" with correct file path |
| `src/components/EditTaskForm.tsx` | Form fields layout, date pickers, priority dropdown | Good form. Changes: wire to surgical edit instead of full-line rewrite |
| `src/hooks/useTasks.ts` | Hook pattern: useState/useEffect, refresh interval, sort/filter | Good structure. Rewrite internals to call new multi-file data layer |
| `src/utils/priority.ts` | `priorityToIcon()`, `priorityToValue()` mappings | Useful Raycast-specific icon/color mappings. Keep and extend |
| `src/utils/menubarRefresh.ts` | `refreshMenubar()` via `launchCommand` | Works perfectly, no changes needed |
| `src/constants/index.ts` | Emoji constants, regex patterns | Keep as reference, but rewrite regexes to match Remindian's FE0F-aware patterns |

### What we gut and rewrite (and why)

| File | Problem | Replacement |
|------|---------|-------------|
| `src/utils/fileUtils.ts` | **Single file only.** `getTasksFilePath()` returns ONE path. `readTasksFile()` reads ONE file. No vault scanning. | New `vaultScanner.ts` — port of Remindian's `ObsidianService.scanVault()` + `findMarkdownFiles()` + `parseTasksFromFile()` |
| `src/utils/taskParser.ts` | **No FE0F handling.** Emoji regexes break on variation selectors. No hierarchical tag support (`#work/clients/somfy`). No frontmatter parsing. No recurrence stripping from title. | New `taskParser.ts` — port of Remindian's `SyncTask.fromObsidianLine()` with all its robustness |
| `src/utils/taskFormatter.ts` | **Full line reconstruction.** `formatTask()` rebuilds the entire line from parsed fields — this LOSES metadata that wasn't parsed (custom annotations, unusual spacing, unknown emojis). Remindian explicitly deprecated this approach. | New `surgicalEditor.ts` — port of Remindian's surgical edit methods. NEVER reconstruct lines. |
| `src/utils/taskOperations.ts` | **Uses formatTask() for all writes.** `updateTask()`, `markTaskDone()`, `addTask()` all rewrite entire lines. `deleteTask()` uses splice by line number (fragile with multi-file). Task IDs are just line numbers. | New `taskOperations.ts` — compound IDs (filePath + lineNumber), surgical edits for updates, append-only for new tasks |
| `src/types/index.ts` | Missing: `filePath` is nullable (should be required for multi-file), no `clientName`, no `originalLine` for surgical edits, no `ObsidianSource` equivalent | New `types.ts` with Remindian-inspired `ObsidianSource` tracking |

---

## What we port from Remindian (and how)

### 1. Task Parsing — `SyncTask.fromObsidianLine()` → `taskParser.ts`

**Source:** `Obsync/Models/SyncTask.swift` lines 70-200

**Port to TypeScript:**

```
Swift: static func fromObsidianLine(_ line: String, ...) -> SyncTask?
  →  TS: export function parseTaskFromLine(line: string, filePath: string, lineNumber: number): Task | null
```

**Key logic to port:**
1. **Checkbox detection:** `- [ ]` / `- [x]` / `- [X]` — same in both, but Remindian also handles `- [*]` style
2. **Date extraction with FE0F:** `📅\u{FE0F}?\s*(\d{4}-\d{2}-\d{2})` — the existing extension does NOT handle FE0F, which causes silent parse failures on some systems
3. **Priority with FE0F:** `⏫\u{FE0F}?` — same issue
4. **Hierarchical tags:** `#[\w-]+(?:/[\w-]+)*` — existing only does `#(\w+)`, misses `#work/clients/somfy`
5. **Target list extraction:** First tag's top-level segment becomes target list (`#work/clients/somfy` → `work`)
6. **Recurrence stripping:** Both emoji-based (`🔁 every week`) and plain-text (`every month on the 1st when done`) — existing extension doesn't strip recurrence from the display title
7. **Client name:** Set later from frontmatter (not in parser)

**Why Remindian's parser is better:**
- FE0F handling prevents silent failures across macOS versions
- Hierarchical tags are critical for the user's workflow (`#work/clients/somfy`)
- Recurrence stripping keeps titles clean in the list view
- The parser is battle-tested with real vault data

### 2. Vault Scanning — `ObsidianService.scanVault()` → `vaultScanner.ts`

**Source:** `Obsync/Services/ObsidianService.swift` lines 1-150

**Port to TypeScript:**

```
Swift: func scanVault(at path: String, excludedFolders: [String], includedFolders: [String]) throws -> [SyncTask]
  →  TS: export async function scanVault(vaultPath: string, options: ScanOptions): Promise<Task[]>
```

**Key logic to port:**
1. **findMarkdownFiles():** Recursive directory walk, respecting include/exclude lists
2. **Whitelist mode:** If `includedFolders` non-empty → scan ONLY those + root `.md` files
3. **Blacklist mode:** Default excludes: `.obsidian`, `.git`, `.trash`
4. **parseTasksFromFile():** Read file, skip frontmatter, parse each line, attach filePath
5. **extractFrontmatterClient():** Parse YAML `client: "[[Bodycare Travel]]"` → `"Bodycare Travel"`

**Implementation:**
- Use `fs-extra` (already a dependency) for file operations
- Use `gray-matter` (already a dependency) for frontmatter parsing — but ALSO extract `client:` field
- Use Node.js `path` and `fs.readdir` with `recursive` option (Node 18.17+, Raycast uses Node 20+)

**Why this is the core change:**
The existing extension's `readTasksFile()` reads ONE file. This new scanner reads the ENTIRE vault (or whitelisted folders), producing tasks from every `.md` file. This is the fundamental feature gap.

### 3. Surgical Edits — `ObsidianService.markTaskComplete()` etc. → `surgicalEditor.ts`

**Source:** `Obsync/Services/ObsidianService.swift` lines 200-600

**Port to TypeScript:**

```
Swift: func markTaskComplete(filePath:, lineNumber:, originalLine:, completionDate:, vaultPath:)
  →  TS: export async function markTaskComplete(task: Task, completionDate: Date): Promise<void>

Swift: func markTaskIncomplete(filePath:, lineNumber:, originalLine:, vaultPath:)
  →  TS: export async function markTaskIncomplete(task: Task): Promise<void>

Swift: func updateTaskMetadata(filePath:, lineNumber:, originalLine:, changes:, vaultPath:)
  →  TS: export async function updateTaskMetadata(task: Task, changes: MetadataChanges): Promise<void>
```

**Key safety logic to port:**
1. **Line verification:** Before any edit, read the file and verify `lines[lineNumber] === task.originalLine`. If mismatch → abort (file was modified externally)
2. **Surgical checkbox toggle:** Only replace `- [ ]` ↔ `- [x]`, don't touch anything else on the line
3. **Surgical date update:** Replace ONLY the `YYYY-MM-DD` digits after the emoji, preserve the emoji bytes and surrounding whitespace verbatim
4. **Surgical priority update:** Replace only the priority emoji, preserve surrounding content
5. **Completion date append:** Add `✅ YYYY-MM-DD` at end of line (with FE0F-aware check for existing marker)
6. **Atomic file write:** Read-modify-write in one operation

**What we DON'T port from Remindian's surgical editor:**
- File backup service (Raycast extensions don't have a persistent app data directory in the same way; could use Raycast's `environment.supportPath` but it's lower priority)
- Audit logging (same reason — nice-to-have, not essential for v1)
- Line offset tracking for bulk operations (Raycast edits one task at a time, not bulk sync)
- Recurrence handling (creating next occurrence) — this is Apple Reminders sync logic, not relevant for a Raycast task viewer

### 4. Task ID System — `SyncState.generateObsidianId()` → built into `types.ts`

**Source:** `Obsync/Models/SyncState.swift`

**Port concept:**

```typescript
// Compound ID: filePath + lineNumber (unique within a vault at a point in time)
// For display purposes and task lookup
export interface Task {
  id: string;  // `${filePath}:${lineNumber}` — simple, human-readable
  // ...
  source: ObsidianSource;  // Tracks original line for surgical edits
}

export interface ObsidianSource {
  filePath: string;
  lineNumber: number;
  originalLine: string;  // CRITICAL for surgical edit verification
}
```

**Why `originalLine` matters:**
When you call `markTaskComplete(task)`, the editor reads the file, checks that `lines[task.source.lineNumber]` still equals `task.source.originalLine`, and ONLY THEN applies the edit. If someone edited the file in Obsidian between when you loaded the task list and when you clicked "Mark Done", the edit is safely aborted instead of corrupting the file.

### 5. Frontmatter Client Extraction — `ObsidianService.extractFrontmatterClient()` → in `vaultScanner.ts`

**Source:** `Obsync/Services/ObsidianService.swift` lines 100-130

**Port to TypeScript:**

```typescript
function extractFrontmatterClient(content: string): string | null {
  // gray-matter already parses YAML frontmatter
  const { data } = matter(content);
  if (!data.client) return null;

  let client = String(data.client);
  // Remove wikilink brackets: "[[Bodycare Travel]]" → "Bodycare Travel"
  client = client.replace(/^\[\[/, '').replace(/\]\]$/, '');
  // Remove surrounding quotes
  client = client.replace(/^["']|["']$/g, '');
  return client.trim() || null;
}
```

**Why:** The user's vault has frontmatter like `client: "[[Bodycare Travel]]"` and they want to see which client a task belongs to. This is a unique Remindian feature not found in the original extension.

---

## New Preferences (replacing existing)

### Existing preferences we keep (modified)

| Preference | Current | Change |
|-----------|---------|--------|
| `filePath` | Single file path | **Rename to `vaultPath`** — now points to vault root directory |
| `sortByPriority` | Boolean | Keep as-is |
| `showOnlyCurrent` | Boolean (due/scheduled ≤ today) | Keep as-is |
| `refreshIntervalInMinutes` | Number | Keep as-is |
| `showDueDate` | Boolean (menubar) | Keep as-is |
| `menubarTaskCount` | Boolean | Keep as-is |
| `showIcon` | Boolean (menubar) | Keep as-is |
| `maxMenubarDescriptionLength` | Number | Keep as-is |

### New preferences we add

| Preference | Type | Default | Purpose |
|-----------|------|---------|---------|
| `excludedFolders` | string (comma-separated) | `.obsidian,.git,.trash` | Folders to skip during vault scan. From Remindian's `SyncConfiguration.excludedFolders` |
| `includedFolders` | string (comma-separated) | `` (empty = scan all) | Whitelist mode: only scan these folders. From Remindian's `SyncConfiguration.includedFolders` |
| `inboxFilePath` | string | `Inbox.md` | Relative path within vault for new task creation. From Remindian's `SyncConfiguration.inboxFilePath` |
| `showCompletedTasks` | boolean | `false` | Whether to include completed tasks in the list view |

### Preferences we remove

| Preference | Why |
|-----------|-----|
| `showDescriptionInDetails` | Redundant — detail panel always shows metadata, we can always show description |

---

## File-by-File Implementation Plan

### Phase 1: New Data Layer (port from Remindian)

#### 1.1 `src/types/index.ts` — REWRITE

**From Remindian:** `SyncTask` model + `ObsidianSource`
**From existing:** `Priority` enum (keep 5 levels for compatibility, map 3 Remindian levels to 5)

```typescript
export enum Priority {
  HIGHEST = "highest",   // Remindian doesn't have this — map to HIGH for sync
  HIGH = "high",         // ⏫ — matches Remindian
  MEDIUM = "medium",     // 🔼 — matches Remindian
  LOW = "low",           // 🔽 — matches Remindian
  LOWEST = "lowest",     // Remindian doesn't have this — map to LOW for sync
}

export interface ObsidianSource {
  filePath: string;      // Absolute path to the .md file
  lineNumber: number;    // 0-indexed line number in the file
  originalLine: string;  // Exact original line content (for surgical edit verification)
}

export interface Task {
  id: string;            // `${filePath}:${lineNumber}` — compound ID
  description: string;   // Raw description (includes emojis, dates, tags)
  cleanTitle: string;    // Display title (stripped of emojis, dates, tags, recurrence)
  completed: boolean;
  dueDate?: Date;
  scheduledDate?: Date;
  startDate?: Date;
  completedAt?: Date;
  priority?: Priority;
  tags?: string[];       // Full tags including hierarchical: ["#work/clients/somfy", "#urgent"]
  targetList?: string;   // First tag's top-level: "work"
  recurrence?: string;   // Raw recurrence text: "every month on the 20th when done"
  clientName?: string;   // From frontmatter: "Bodycare Travel"
  source: ObsidianSource; // REQUIRED (not optional) — every task has a source
  indentation: string;   // Preserved for surgical edits
}

export interface TaskFile {
  filePath: string;
  fileName: string;      // Just the filename for display
  tasks: Task[];
  clientName?: string;   // From frontmatter, applied to all tasks in file
}

export interface ScanOptions {
  excludedFolders: string[];
  includedFolders: string[];
  includeCompleted: boolean;
}

export interface MetadataChanges {
  newDueDate?: Date | null;     // undefined = no change, null = remove, Date = set
  newStartDate?: Date | null;
  newScheduledDate?: Date | null;
  newPriority?: Priority;       // undefined = no change
}
```

#### 1.2 `src/utils/taskParser.ts` — REWRITE

**From Remindian:** `SyncTask.fromObsidianLine()` (Swift → TypeScript)
**From existing:** `getFormattedDescription()` concept (strip emojis for display)

New functions:
- `parseTaskFromLine(line: string, lineNumber: number): ParsedTask | null` — port of `SyncTask.fromObsidianLine()`
- `getCleanTitle(description: string, maxLength?: number): string` — improved version of existing `getFormattedDescription()` with Remindian's FE0F-aware stripping
- `extractTags(text: string): string[]` — hierarchical tag extraction
- `extractTargetList(tags: string[]): string | null` — first tag's top-level

**Key FE0F-aware regex patterns (from Remindian):**
```typescript
const DATE_PATTERNS = {
  DUE:       /📅\uFE0F?\s*(\d{4}-\d{2}-\d{2})/,
  START:     /🛫\uFE0F?\s*(\d{4}-\d{2}-\d{2})/,
  SCHEDULED: /⏳\uFE0F?\s*(\d{4}-\d{2}-\d{2})/,
  COMPLETED: /✅\uFE0F?\s*(\d{4}-\d{2}-\d{2})/,
};

const PRIORITY_PATTERNS = {
  HIGH:   /⏫\uFE0F?/,
  MEDIUM: /🔼\uFE0F?/,
  LOW:    /🔽\uFE0F?/,
  HIGHEST: /🔺\uFE0F?/,   // Keep from existing extension
  LOWEST:  /⏬\uFE0F?/,   // Keep from existing extension
};

// Hierarchical tags (from Remindian)
const TAG_PATTERN = /#[\w-]+(?:\/[\w-]+)*/g;

// Recurrence (from Remindian) — both emoji and plain-text
const RECURRENCE_EMOJI = /[🔁🔂]\uFE0F?\s*[^📅🛫⏳✅⏫🔼🔽🔺⏬#]*/;
const RECURRENCE_PLAIN = /\bevery\s+(?:month|week|day|year|other|january|february|march|april|may|june|july|august|september|october|november|december|\d+\s+days?)\b[^📅🛫⏳✅⏫🔼🔽🔺⏬#]*/i;
```

#### 1.3 `src/utils/vaultScanner.ts` — NEW FILE

**From Remindian:** `ObsidianService.scanVault()`, `findMarkdownFiles()`, `parseTasksFromFile()`, `extractFrontmatterClient()`
**From existing:** `readTasksFromFile()` structure (but expanded to multi-file)

New functions:
- `scanVault(vaultPath: string, options: ScanOptions): Promise<TaskFile[]>` — find all .md files, parse tasks from each
- `findMarkdownFiles(dirPath: string, options: ScanOptions): Promise<string[]>` — recursive walk with include/exclude logic
- `parseTasksFromFile(filePath: string): Promise<TaskFile>` — read file, extract frontmatter client, parse each line
- `extractFrontmatterClient(content: string): string | null` — YAML `client:` extraction with wikilink bracket removal

**Include/exclude logic (from Remindian):**
```typescript
// Whitelist mode: if includedFolders non-empty, ONLY scan those folders + root .md files
// Blacklist mode: skip excludedFolders by name match or path prefix
// Default excluded: [".obsidian", ".git", ".trash"]
```

**File reading (from existing, enhanced):**
```typescript
// Use gray-matter to separate frontmatter from content (already a dep)
// Parse each line of content section with parseTaskFromLine()
// Attach filePath and clientName to each task
```

#### 1.4 `src/utils/surgicalEditor.ts` — NEW FILE

**From Remindian:** `ObsidianService.markTaskComplete()`, `markTaskIncomplete()`, `updateTaskMetadata()`
**From existing:** Nothing — the existing extension reconstructs lines, which we explicitly reject

New functions:
- `markTaskComplete(task: Task, completionDate?: Date): Promise<void>` — change `- [ ]` → `- [x]`, append `✅ date`
- `markTaskIncomplete(task: Task): Promise<void>` — change `- [x]` → `- [ ]`, remove `✅ date`
- `updateTaskMetadata(task: Task, changes: MetadataChanges): Promise<void>` — surgical date/priority replacement
- `appendNewTask(filePath: string, taskLine: string): Promise<void>` — for add-task command
- `deleteTaskLine(task: Task): Promise<void>` — remove line from file

**Safety checks (from Remindian):**
```typescript
// 1. Read current file content
// 2. Verify lines[task.source.lineNumber] === task.source.originalLine
//    If mismatch → throw Error("File was modified externally, please refresh")
// 3. Apply surgical edit (regex replace on the specific part only)
// 4. Write file atomically
```

**Line verification is the KEY safety feature.** Without it, if you load the task list, then edit the file in Obsidian (which shifts line numbers), then mark a task done in Raycast, you'd corrupt the wrong line. Remindian learned this lesson.

#### 1.5 `src/utils/taskOperations.ts` — REWRITE

**From Remindian:** Operation orchestration pattern
**From existing:** Function signatures and toast notifications

```typescript
// Keep these function signatures (they're called by hooks and components):
export async function getAllTasks(): Promise<Task[]>
export async function getAllUncompletedTasks(): Promise<Task[]>
export async function getHighestPriorityTask(): Promise<Task | null>
export async function addTask(task: NewTaskInput): Promise<Task>
export async function updateTask(task: Task, changes: MetadataChanges): Promise<void>
export async function markTaskDone(task: Task): Promise<void>
export async function markTaskUndone(task: Task): Promise<void>
export async function deleteTask(task: Task): Promise<void>

// But internally, they now:
// - Call vaultScanner.scanVault() instead of readTasksFile()
// - Call surgicalEditor methods instead of formatTask() + fs.writeFile()
// - Use compound IDs (filePath:lineNumber) instead of just lineNumber
```

#### 1.6 `src/constants/index.ts` — REWRITE

**From Remindian:** FE0F-aware patterns
**From existing:** Emoji constants (keep the values, add FE0F handling)

Replace all regex patterns with FE0F-aware versions. Keep emoji constants but ensure they match Remindian's tested set.

---

### Phase 2: Adapt UI Layer (modify existing extension components)

#### 2.1 `src/hooks/useTasks.ts` — MODIFY

**From existing:** Hook structure, useState/useEffect pattern, refresh interval, sort/filter logic
**Changes:**
- Call new `scanVault()` instead of old `readTasksFile()`
- Add `vaultPath` from preferences (replaces `filePath`)
- Add `excludedFolders`/`includedFolders` from preferences
- Add optional tag filter state
- Add optional file source filter state
- Keep priority sorting (from existing)
- Keep "current only" filter (from existing)

```typescript
// New state additions:
const [selectedTag, setSelectedTag] = useState<string | null>(null);
const [selectedFile, setSelectedFile] = useState<string | null>(null);
const [availableTags, setAvailableTags] = useState<string[]>([]);
const [availableFiles, setAvailableFiles] = useState<string[]>([]);
```

#### 2.2 `src/components/TaskItem.tsx` — MODIFY

**From existing:** Detail panel with metadata, accessories, action panel
**Changes:**
- Add **source file** display in detail metadata (`task.source.filePath` → show just filename)
- Add **client name** display if present (`task.clientName`)
- Fix **"Open in Obsidian"** URI to use the correct file path (not hardcoded single file):
  ```typescript
  // Before (broken for multi-file):
  url={`obsidian://open?vault=...&file=${encodeURIComponent(task.filePath?.split("/").pop() || "")}`}

  // After (correct):
  // Extract vault name from vaultPath preference
  // Use task.source.filePath relative to vault for the file parameter
  url={`obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relativeFilePath)}`}
  ```
- Add **hierarchical tag display** in accessories (existing only shows flat tags)
- Wire `onMarkDone` to surgical editor (transparent to component — just update the operation)

#### 2.3 `src/components/EditTaskForm.tsx` — MODIFY

**From existing:** Form fields, date pickers, priority dropdown
**Changes:**
- Wire `handleSubmit` to `surgicalEditor.updateTaskMetadata()` instead of `updateTask()` which calls `formatTask()`
- The form collects changes as a `MetadataChanges` diff, NOT a full task reconstruction
- Remove: tags editing via comma-separated text field (too risky — surgical editor can't safely rewrite tags)
- Keep: priority, dates, completion status edits (these are safely surgical)
- Add: read-only display of source file and client name

**Why limit editing?** Surgical editing means we can only safely change fields we can locate precisely in the line (dates after known emojis, priority emojis, checkbox status). Changing the description text or tags requires full-line reconstruction, which is what we're trying to avoid. For those edits, the user should click "Open in Obsidian".

#### 2.4 `src/list-tasks.tsx` — MODIFY

**From existing:** List with search, detail panel
**Changes:**
- Add **dropdown filters** in the search bar:
  - Filter by source file (populated from scanned files)
  - Filter by tag (populated from all tasks' tags)
- Show **file source** as a section grouping option (group tasks by file)
- Keep text search (existing)

```typescript
<List
  searchBarAccessory={
    <List.Dropdown title="Filter" onChange={setFilter}>
      <List.Dropdown.Item title="All Files" value="all" />
      {availableFiles.map(f => (
        <List.Dropdown.Item key={f} title={f} value={f} />
      ))}
    </List.Dropdown>
  }
>
```

#### 2.5 `src/add-task.tsx` — MODIFY

**From existing:** Form with description, priority, dates, tags, recurrence
**Changes:**
- Add **"Target File" dropdown** — shows `.md` files in vault (or just the configured inbox files)
- Default to `inboxFilePath` preference
- Task is appended as a raw Obsidian Tasks format line (constructed, not surgical — this is a NEW line, not an edit)
- Use Remindian's `toObsidianLine()` logic for construction (this is the ONE place where line construction is safe — for brand new tasks)

#### 2.6 `src/menubar-item.tsx` — MODIFY

**From existing:** MenuBarExtra with task list, mark done, set priority
**Changes:**
- Fix "Open in Obsidian" to use correct per-task file path
- Show source file name in submenu title or as secondary text
- Keep all existing menubar features

#### 2.7 `src/edit-task.tsx` — MINIMAL CHANGES

**From existing:** Task selection list → push to EditTaskForm
**Changes:** Just wire to new types. Minimal.

---

### Phase 3: Preferences & Configuration

#### 3.1 `package.json` preferences update

```json
{
  "preferences": [
    {
      "name": "vaultPath",
      "title": "Obsidian Vault Path",
      "description": "Path to your Obsidian vault root directory",
      "type": "directory",
      "required": true
    },
    {
      "name": "excludedFolders",
      "title": "Excluded Folders",
      "description": "Comma-separated folder names to skip (e.g., .obsidian,.git,.trash,Archive)",
      "type": "textfield",
      "required": false,
      "default": ".obsidian,.git,.trash"
    },
    {
      "name": "includedFolders",
      "title": "Included Folders (Whitelist)",
      "description": "If set, ONLY scan these folders. Leave empty to scan entire vault.",
      "type": "textfield",
      "required": false,
      "default": ""
    },
    {
      "name": "inboxFilePath",
      "title": "Inbox File",
      "description": "Relative path within vault for new tasks (e.g., Inbox.md)",
      "type": "textfield",
      "required": false,
      "default": "Inbox.md"
    },
    {
      "name": "showCompletedTasks",
      "title": "Show Completed Tasks",
      "description": "Include completed tasks in the list view",
      "type": "checkbox",
      "required": false,
      "default": false
    },
    {
      "name": "sortByPriority",
      "title": "Sort by Priority",
      "type": "checkbox",
      "required": false,
      "default": true
    },
    {
      "name": "showOnlyCurrent",
      "title": "Show Only Current Tasks",
      "description": "Only show tasks due today or earlier",
      "type": "checkbox",
      "required": false,
      "default": false
    },
    {
      "name": "refreshIntervalInMinutes",
      "title": "Refresh Interval (minutes)",
      "type": "textfield",
      "required": false,
      "default": "1"
    },
    {
      "name": "showDueDate",
      "title": "Show Due Date in Menubar",
      "type": "checkbox",
      "required": false,
      "default": true
    },
    {
      "name": "menubarTaskCount",
      "title": "Show Task Count in Menubar",
      "type": "checkbox",
      "required": false,
      "default": false
    },
    {
      "name": "showIcon",
      "title": "Show Icon in Menubar",
      "type": "checkbox",
      "required": false,
      "default": true
    },
    {
      "name": "maxMenubarDescriptionLength",
      "title": "Menubar Description Max Length",
      "type": "textfield",
      "required": false,
      "default": "30"
    }
  ]
}
```

---

## Implementation Order

### Step 1: Scaffold
- Fork the extension (copy into our repo or clone from raycast/extensions monorepo)
- Update `package.json` (name, preferences, remove `filePath`, add `vaultPath` etc.)
- Run `npm install` to verify deps

### Step 2: Data Layer (no UI changes yet)
- Write `src/types/index.ts` (new types)
- Write `src/constants/index.ts` (FE0F-aware patterns)
- Write `src/utils/taskParser.ts` (port from Remindian)
- Write `src/utils/vaultScanner.ts` (port from Remindian)
- Write `src/utils/surgicalEditor.ts` (port from Remindian)
- Write `src/utils/taskOperations.ts` (new orchestration, same function signatures)
- **Test:** Run `npm run build` to verify TypeScript compiles

### Step 3: Wire Up UI
- Update `src/hooks/useTasks.ts` to use new data layer
- Update `src/list-tasks.tsx` with dropdown filters
- Update `src/components/TaskItem.tsx` with source file + client name
- Update `src/components/EditTaskForm.tsx` with surgical edit wiring
- Update `src/add-task.tsx` with target file picker
- Update `src/menubar-item.tsx` with per-file Obsidian URIs
- Update `src/mark-done.tsx` (minimal — just types)
- Update `src/edit-task.tsx` (minimal — just types)

### Step 4: Polish
- Update `src/utils/priority.ts` (add FE0F handling, keep Raycast icon mappings)
- Remove `src/utils/taskFormatter.ts` (replaced by surgicalEditor — explicitly delete to prevent accidental use)
- Remove `src/utils/fileUtils.ts` (replaced by vaultScanner)
- Update README
- Test with real vault

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Vault scan too slow for large vaults | Cache scan results in `useTasks` hook, only rescan on interval. Whitelist mode for large vaults. |
| Line verification fails after external edit | Show clear error toast: "Task was modified in Obsidian, refreshing..." + auto-rescan |
| FE0F regex doesn't match some edge case | Test with real vault files from user's actual Obsidian setup |
| `gray-matter` fails on unusual frontmatter | Wrap in try/catch (existing extension already does this), fall back to treating entire file as content |
| New task appended to wrong location | Always append to end of file (safe). Show toast confirming file path. |

---

## What We Explicitly Do NOT Port From Remindian

| Feature | Why not |
|---------|---------|
| Apple Reminders sync | Not relevant — this is a Raycast extension, not a sync engine |
| `SyncEngine` orchestration | The sync loop (Obsidian ↔ Reminders) is Remindian-specific |
| `SyncState` / ID mapping persistence | No need to persist cross-session mappings — Raycast rescans each time |
| `FileBackupService` | Nice-to-have for v2, not essential for v1 |
| `AuditLog` | Same — v2 feature |
| `FileWatcherService` | Raycast has its own refresh interval mechanism |
| `HotKeyService` | Raycast handles global shortcuts natively |
| `NotificationService` | Raycast has `showToast()` and `showHUD()` |
| Recurrence completion logic | Creating next occurrence is sync-engine work, not viewer work |
| Deduplication (cross-file) | Could add in v2, but for a viewer it's fine to show duplicates and let the user decide |
| `RemindersService` / EventKit | macOS-only, not applicable |
