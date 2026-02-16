# Command Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Quick Add and Daily Review commands, disable Edit/Mark Done by default, redesign the menubar with pin system, urgency icons, and status cycling.

**Architecture:** 6 tasks, bottom-up: infrastructure first (pin storage, status change), then new commands (Quick Add, Daily Review), then menubar rewrite, then List Tasks pin actions. Each task is independently buildable and testable.

**Tech Stack:** React, Raycast API (`LocalStorage`, `MenuBarExtra`, `showToast`), existing `useTasks` hook and `surgicalEditor`.

---

### Task 1: Add `changeTaskStatus` to surgical editor

**Files:**
- Modify: `src/utils/surgicalEditor.ts`
- Modify: `src/utils/taskOperations.ts`

**Step 1: Add `changeTaskStatus` to `src/utils/surgicalEditor.ts`**

Append this function after `deleteTaskLine`:

```typescript
/**
 * Surgically change a task's checkbox status character.
 * e.g., "- [ ]" → "- [/]" or "- [x]" → "- [>]"
 */
export async function changeTaskStatus(
  task: Task,
  newStatus: string,
): Promise<void> {
  const { lines } = await readAndVerify(task);
  let line = lines[task.source.lineNumber];

  // Replace the checkbox character: - [.] → - [newStatus]
  line = line.replace(/^(\s*[-*+] \[).\]/, `$1${newStatus}]`);

  // If marking as done (x), append completion date if not present
  if (newStatus.toLowerCase() === "x") {
    const completionPattern = /✅\uFE0F?\s*\d{4}-\d{2}-\d{2}/;
    if (!completionPattern.test(line)) {
      const trimmedLine = line.replace(/\s+$/, "");
      line = `${trimmedLine} ${ICONS.DATE.COMPLETION} ${formatDate(new Date())}`;
    }
  }

  // If un-marking from done, remove completion date
  if (task.status.toLowerCase() === "x" && newStatus.toLowerCase() !== "x") {
    line = line.replace(/\s*✅\uFE0F?\s*\d{4}-\d{2}-\d{2}/, "");
  }

  lines[task.source.lineNumber] = line;
  await writeLines(task.source.filePath, lines);
}
```

**Step 2: Export `changeTaskStatus` from `src/utils/taskOperations.ts`**

Add import at top of `taskOperations.ts`:

```typescript
import {
  markTaskComplete as surgicalMarkComplete,
  markTaskIncomplete as surgicalMarkIncomplete,
  updateTaskMetadata as surgicalUpdateMetadata,
  changeTaskStatus as surgicalChangeStatus,
  appendNewTask,
  deleteTaskLine,
} from "./surgicalEditor";
```

Add this function after `deleteTask`:

```typescript
export async function changeStatus(task: Task, newStatus: string): Promise<void> {
  try {
    await surgicalChangeStatus(task, newStatus);
    await showToast({ style: Toast.Style.Success, title: `Status: ${newStatus}` });
    await refreshMenubar();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to change status",
      message: String(error),
    });
    throw error;
  }
}
```

**Step 3: Build**

Run: `bun run build`
Expected: Compiles with no errors.

**Step 4: Commit**

```bash
git add src/utils/surgicalEditor.ts src/utils/taskOperations.ts
git commit -m "feat: add changeTaskStatus surgical editor function"
```

---

### Task 2: Add menubar pin storage utility

**Files:**
- Create: `src/utils/menubarPin.ts`

**Step 1: Create `src/utils/menubarPin.ts`**

```typescript
import { LocalStorage } from "@raycast/api";

export type MenubarPin =
  | { type: "tag"; value: string }
  | { type: "file"; value: string }
  | { type: "task"; value: string }
  | null;

const STORAGE_KEY = "menubar-pin";

export async function getMenubarPin(): Promise<MenubarPin> {
  const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MenubarPin;
  } catch {
    return null;
  }
}

export async function setMenubarPin(pin: MenubarPin): Promise<void> {
  if (pin === null) {
    await LocalStorage.removeItem(STORAGE_KEY);
  } else {
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(pin));
  }
}

export async function clearMenubarPin(): Promise<void> {
  await LocalStorage.removeItem(STORAGE_KEY);
}
```

**Step 2: Build**

Run: `bun run build`
Expected: Compiles. (File isn't imported yet, but TypeScript should still check it.)

**Step 3: Commit**

```bash
git add src/utils/menubarPin.ts
git commit -m "feat: add menubar pin LocalStorage utility"
```

---

### Task 3: Add Quick Add command

**Files:**
- Create: `src/quick-add.tsx`
- Modify: `package.json` (add command entry)

**Step 1: Create `src/quick-add.tsx`**

```tsx
import { LaunchProps, showToast, Toast, closeMainWindow } from "@raycast/api";
import { parseTaskFromLine } from "./utils/taskParser";
import { addTask } from "./utils/taskOperations";
import { getInboxFilePath } from "./utils/settings";

export default async function Command(
  props: LaunchProps<{ arguments: { description: string } }>,
) {
  const { description } = props.arguments;

  if (!description.trim()) {
    await showToast({ style: Toast.Style.Failure, title: "Description is required" });
    return;
  }

  const inboxPath = await getInboxFilePath();
  if (!inboxPath) {
    await showToast({
      style: Toast.Style.Failure,
      title: "No inbox file configured",
      message: "Run the setup wizard to set an inbox file.",
    });
    return;
  }

  // Parse the input as if it were a task line to extract metadata
  const fakeLine = `- [ ] ${description}`;
  const parsed = parseTaskFromLine(fakeLine, "", 0);

  if (!parsed) {
    // Fallback: just use the raw description
    await addTask({ description });
  } else {
    await addTask({
      description: parsed.cleanTitle,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      scheduledDate: parsed.scheduledDate,
      startDate: parsed.startDate,
      tags: parsed.tags,
      recurrence: parsed.recurrence,
    });
  }

  await showToast({
    style: Toast.Style.Success,
    title: `Added: ${parsed?.cleanTitle ?? description}`,
  });
  await closeMainWindow();
}
```

**Step 2: Add command entry to `package.json`**

Add to the `commands` array after `add-task`:

```json
{
  "name": "quick-add",
  "title": "Quick Add Task",
  "description": "Instantly add a task using Obsidian Tasks syntax",
  "mode": "no-view",
  "arguments": [
    {
      "name": "description",
      "type": "text",
      "placeholder": "Buy milk #personal 📅 2026-02-20",
      "required": true
    }
  ]
}
```

**Step 3: Build**

Run: `bun run build`
Expected: Compiles. New entry point `src/quick-add.tsx` appears in build output.

**Step 4: Manual test**

Open Raycast, type "Quick Add Task", enter: `Test task #inbox 📅 2026-02-20`
Expected: Toast shows "Added: Test task", task appears in inbox file with correct metadata.

**Step 5: Commit**

```bash
git add src/quick-add.tsx package.json
git commit -m "feat: add Quick Add no-view command with full syntax parsing"
```

---

### Task 4: Add Daily Review command

**Files:**
- Create: `src/daily-review.tsx`
- Modify: `package.json` (add command entry)

**Step 1: Create `src/daily-review.tsx`**

```tsx
import { List, getPreferenceValues } from "@raycast/api";
import { useMemo } from "react";
import { Task } from "./types";
import { TaskItem } from "./components/TaskItem";
import { useTasks } from "./hooks/useTasks";
import { useSetup } from "./hooks/useSetup";
import { SetupWizard } from "./components/SetupWizard";

function categorizeTasks(tasks: Task[]): {
  overdue: Task[];
  dueToday: Task[];
  scheduledToday: Task[];
} {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);

  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const scheduledToday: Task[] = [];
  const seen = new Set<string>();

  for (const task of tasks) {
    if (task.completed) continue;

    if (task.dueDate && task.dueDate < startOfDay) {
      overdue.push(task);
      seen.add(task.id);
    } else if (task.dueDate && task.dueDate >= startOfDay && task.dueDate <= endOfDay) {
      dueToday.push(task);
      seen.add(task.id);
    }

    if (
      !seen.has(task.id) &&
      task.scheduledDate &&
      task.scheduledDate >= startOfDay &&
      task.scheduledDate <= endOfDay
    ) {
      scheduledToday.push(task);
    }
  }

  return { overdue, dueToday, scheduledToday };
}

export default function Command() {
  const { isSetupComplete, completeSetup } = useSetup();
  const preferences = getPreferenceValues<Preferences>();
  const { allTasks, isLoading, refreshTaskList, handleMarkDone, handleDeleteTask } =
    useTasks(preferences);

  const { overdue, dueToday, scheduledToday } = useMemo(
    () => categorizeTasks(allTasks),
    [allTasks],
  );

  const totalCount = overdue.length + dueToday.length + scheduledToday.length;

  if (isSetupComplete === null) return <List isLoading />;
  if (!isSetupComplete) return <SetupWizard onComplete={completeSetup} />;

  if (!isLoading && totalCount === 0) {
    return (
      <List>
        <List.EmptyView
          title="All clear!"
          description="No overdue, due, or scheduled tasks for today."
          icon="checkmark-circle-16"
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} isShowingDetail>
      {overdue.length > 0 && (
        <List.Section title="Overdue" subtitle={overdue.length.toString()}>
          {overdue.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onMarkDone={handleMarkDone}
              onDelete={handleDeleteTask}
            />
          ))}
        </List.Section>
      )}

      {dueToday.length > 0 && (
        <List.Section title="Due Today" subtitle={dueToday.length.toString()}>
          {dueToday.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onMarkDone={handleMarkDone}
              onDelete={handleDeleteTask}
            />
          ))}
        </List.Section>
      )}

      {scheduledToday.length > 0 && (
        <List.Section title="Scheduled Today" subtitle={scheduledToday.length.toString()}>
          {scheduledToday.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onMarkDone={handleMarkDone}
              onDelete={handleDeleteTask}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}
```

**Step 2: Add command entry to `package.json`**

Add to the `commands` array:

```json
{
  "name": "daily-review",
  "title": "Daily Review",
  "description": "Review overdue, due, and scheduled tasks for today",
  "mode": "view"
}
```

**Step 3: Build**

Run: `bun run build`
Expected: Compiles. New entry point `src/daily-review.tsx` in build output.

**Step 4: Commit**

```bash
git add src/daily-review.tsx package.json
git commit -m "feat: add Daily Review command with urgency sections"
```

---

### Task 5: Redesign menubar

**Files:**
- Rewrite: `src/menubar-item.tsx`

This is the largest task. The menubar is rewritten from scratch with:
- Pin-aware title and icon
- Urgency-colored icon (red/orange/green)
- Grouped summary sections (Overdue / Due Today / Upcoming)
- Per-task status cycling actions
- Pin controls submenu

**Step 1: Rewrite `src/menubar-item.tsx`**

```tsx
import {
  Color,
  Icon,
  Image,
  MenuBarExtra,
  open,
  getPreferenceValues,
  launchCommand,
  LaunchType,
  openExtensionPreferences,
} from "@raycast/api";
import { useState, useEffect, useMemo } from "react";
import { getCleanTitle } from "./utils/taskParser";
import { Task } from "./types";
import { useTasks } from "./hooks/useTasks";
import { getInboxFilePath } from "./utils/settings";
import { getMenubarPin, setMenubarPin, clearMenubarPin, MenubarPin } from "./utils/menubarPin";
import { changeStatus } from "./utils/taskOperations";
import { STATUS_MAP } from "./constants";
import path from "path";

// --- Urgency helpers ---

function getUrgencyIcon(tasks: Task[]): Image.ImageLike {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);

  const hasOverdue = tasks.some((t) => !t.completed && t.dueDate && t.dueDate < startOfDay);
  const hasDueToday = tasks.some(
    (t) => !t.completed && t.dueDate && t.dueDate >= startOfDay && t.dueDate <= endOfDay,
  );

  if (hasOverdue) return { source: Icon.CheckList, tintColor: Color.Red };
  if (hasDueToday) return { source: Icon.CheckList, tintColor: Color.Orange };
  return { source: Icon.CheckList, tintColor: Color.Green };
}

function categorizeTasks(tasks: Task[]): {
  overdue: Task[];
  dueToday: Task[];
  upcoming: Task[];
} {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);

  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const upcoming: Task[] = [];

  for (const task of tasks) {
    if (task.dueDate && task.dueDate < startOfDay) {
      overdue.push(task);
    } else if (task.dueDate && task.dueDate >= startOfDay && task.dueDate <= endOfDay) {
      dueToday.push(task);
    } else {
      upcoming.push(task);
    }
  }

  return { overdue, dueToday, upcoming };
}

// --- Pin helpers ---

function applyPin(tasks: Task[], pin: MenubarPin): Task[] {
  if (!pin) return tasks;
  switch (pin.type) {
    case "tag":
      return tasks.filter((t) => t.tags?.includes(pin.value));
    case "file": {
      return tasks.filter((t) => {
        const fileName = t.source.filePath.split("/").pop() || "";
        return fileName === pin.value;
      });
    }
    case "task":
      return tasks.filter((t) => t.id === pin.value);
    default:
      return tasks;
  }
}

function getPinTitle(
  pin: MenubarPin,
  filteredTasks: Task[],
  topTask: Task | null,
  maxLength: number,
): string {
  if (!pin) {
    return topTask ? getCleanTitle(topTask, maxLength) : "No Tasks";
  }

  switch (pin.type) {
    case "tag":
      return `${pin.value} (${filteredTasks.length})`;
    case "file":
      return `${pin.value.replace(/\.md$/, "")} (${filteredTasks.length})`;
    case "task": {
      const task = filteredTasks[0];
      if (!task) return "Pinned task not found";
      const title = getCleanTitle(task, maxLength);
      return task.completed ? `~~${title}~~` : title;
    }
    default:
      return "No Tasks";
  }
}

// --- Component ---

const Command = () => {
  const preferences = getPreferenceValues<Preferences>();
  const maxLength = parseInt(preferences.maxMenubarDescriptionLength) || 30;
  const [inboxConfigured, setInboxConfigured] = useState(false);
  const [pin, setPin] = useState<MenubarPin>(null);

  useEffect(() => {
    getInboxFilePath().then((p) => setInboxConfigured(!!p));
    getMenubarPin().then(setPin);
  }, []);

  const {
    allTasks,
    topTask,
    isLoading,
    availableTags,
    availableFiles,
    handleMarkDone,
    handleDeleteTask,
    refreshTaskList,
  } = useTasks(preferences);

  const filteredTasks = useMemo(() => applyPin(allTasks, pin), [allTasks, pin]);
  const { overdue, dueToday, upcoming } = useMemo(
    () => categorizeTasks(filteredTasks),
    [filteredTasks],
  );

  const vaultName = path.basename(preferences.vaultPath || "");

  const handleOpenInObsidian = async (task: Task) => {
    const relPath = path.relative(preferences.vaultPath, task.source.filePath);
    const obsidianURI = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relPath.replace(/\.md$/, ""))}`;
    await open(obsidianURI);
  };

  const handleEditTask = async (task: Task) => {
    await launchCommand({
      name: "edit-task",
      type: LaunchType.UserInitiated,
      arguments: { taskId: task.id },
    });
  };

  const handleChangeStatus = async (task: Task, newStatus: string) => {
    await changeStatus(task, newStatus);
    await refreshTaskList();
  };

  const handlePin = async (newPin: MenubarPin) => {
    await setMenubarPin(newPin);
    setPin(newPin);
  };

  const handleUnpin = async () => {
    await clearMenubarPin();
    setPin(null);
  };

  // --- Task submenu (shared across sections) ---

  const TaskSubmenu = ({ task }: { task: Task }) => {
    const fileName = task.source.filePath.split("/").pop()?.replace(".md", "") || "";
    const statusLabel = (STATUS_MAP[task.status] ?? STATUS_MAP[task.status.toLowerCase()])?.label ?? task.status;
    return (
      <MenuBarExtra.Submenu
        key={task.id}
        title={`${getCleanTitle(task, maxLength)} (${fileName})`}
      >
        {/* Status cycling */}
        {task.status !== "x" && (
          <MenuBarExtra.Item
            title="Mark Done"
            icon={Icon.Checkmark}
            onAction={() => handleChangeStatus(task, "x")}
          />
        )}
        {task.status !== "/" && (
          <MenuBarExtra.Item
            title="Start (In Progress)"
            icon={Icon.CircleProgress50}
            onAction={() => handleChangeStatus(task, "/")}
          />
        )}
        {task.status !== ">" && (
          <MenuBarExtra.Item
            title="Defer"
            icon={Icon.ArrowRight}
            onAction={() => handleChangeStatus(task, ">")}
          />
        )}
        {task.status !== "-" && (
          <MenuBarExtra.Item
            title="Cancel"
            icon={Icon.XMarkCircle}
            onAction={() => handleChangeStatus(task, "-")}
          />
        )}

        <MenuBarExtra.Item
          title="Open in Obsidian"
          icon={Icon.Link}
          onAction={() => handleOpenInObsidian(task)}
        />
        <MenuBarExtra.Item
          title="Edit Task"
          icon={Icon.Pencil}
          onAction={() => handleEditTask(task)}
        />
        <MenuBarExtra.Item
          title="Pin to Menubar"
          icon={Icon.Pin}
          onAction={() => handlePin({ type: "task", value: task.id })}
        />
        <MenuBarExtra.Item
          title="Delete Task"
          icon={Icon.Trash}
          onAction={() => handleDeleteTask(task)}
        />
      </MenuBarExtra.Submenu>
    );
  };

  // --- Loading state ---

  if (isLoading) {
    return (
      <MenuBarExtra icon={Icon.Clock} tooltip="Loading tasks...">
        <MenuBarExtra.Item title="Loading..." />
      </MenuBarExtra>
    );
  }

  // --- Render ---

  const title = getPinTitle(pin, filteredTasks, topTask, maxLength);
  const icon = getUrgencyIcon(filteredTasks);

  return (
    <MenuBarExtra title={title} icon={icon}>
      {/* Overdue section */}
      {overdue.length > 0 && (
        <MenuBarExtra.Section title={`Overdue (${overdue.length})`}>
          {overdue.map((task) => (
            <TaskSubmenu key={task.id} task={task} />
          ))}
        </MenuBarExtra.Section>
      )}

      {/* Due Today section */}
      {dueToday.length > 0 && (
        <MenuBarExtra.Section title={`Due Today (${dueToday.length})`}>
          {dueToday.map((task) => (
            <TaskSubmenu key={task.id} task={task} />
          ))}
        </MenuBarExtra.Section>
      )}

      {/* Upcoming section */}
      {upcoming.length > 0 && (
        <MenuBarExtra.Section title={`Upcoming (${upcoming.length})`}>
          {upcoming.map((task) => (
            <TaskSubmenu key={task.id} task={task} />
          ))}
        </MenuBarExtra.Section>
      )}

      {/* Pin controls */}
      <MenuBarExtra.Section>
        <MenuBarExtra.Submenu title="Pin to Menubar" icon={Icon.Pin}>
          {/* Pin a tag */}
          {availableTags.length > 0 && (
            <MenuBarExtra.Submenu title="Pin Tag" icon={Icon.Tag}>
              {availableTags.map((tag) => (
                <MenuBarExtra.Item
                  key={tag}
                  title={tag}
                  icon={pin?.type === "tag" && pin.value === tag ? Icon.Checkmark : Icon.Circle}
                  onAction={() => handlePin({ type: "tag", value: tag })}
                />
              ))}
            </MenuBarExtra.Submenu>
          )}

          {/* Pin a file */}
          {availableFiles.length > 0 && (
            <MenuBarExtra.Submenu title="Pin File" icon={Icon.Document}>
              {availableFiles.map((f) => (
                <MenuBarExtra.Item
                  key={f}
                  title={f.replace(/\.md$/, "")}
                  icon={pin?.type === "file" && pin.value === f ? Icon.Checkmark : Icon.Circle}
                  onAction={() => handlePin({ type: "file", value: f })}
                />
              ))}
            </MenuBarExtra.Submenu>
          )}
        </MenuBarExtra.Submenu>

        {pin && (
          <MenuBarExtra.Item
            title="Unpin"
            icon={Icon.XMarkCircle}
            onAction={handleUnpin}
          />
        )}
      </MenuBarExtra.Section>

      {/* Bottom actions */}
      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Open List Tasks"
          icon={Icon.List}
          onAction={() => launchCommand({ name: "list-tasks", type: LaunchType.UserInitiated })}
        />
        {inboxConfigured && (
          <MenuBarExtra.Item
            title="Create Task"
            icon={Icon.Plus}
            onAction={() => launchCommand({ name: "add-task", type: LaunchType.UserInitiated })}
          />
        )}
        <MenuBarExtra.Item
          title="Preferences"
          icon={Icon.Gear}
          onAction={openExtensionPreferences}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
};

export default Command;
```

**Step 2: Build**

Run: `bun run build`
Expected: Compiles with no errors.

**Step 3: Manual test**

- Open menubar: should show urgency-colored icon and grouped sections
- Expand a task: should see status cycling actions (Mark Done, Start, Defer, Cancel)
- Pin a tag: title should change to `#tag (count)`
- Pin a task, mark it done: title should show with strikethrough markers `~~title~~`
- Unpin: reverts to highest-priority task title

**Step 4: Commit**

```bash
git add src/menubar-item.tsx
git commit -m "feat: redesign menubar with pin system, urgency icons, status cycling"
```

---

### Task 6: Add "Pin to Menubar" actions in List Tasks + package.json cleanup

**Files:**
- Modify: `src/components/TaskItem.tsx`
- Modify: `package.json`

**Step 1: Add pin actions to `src/components/TaskItem.tsx`**

Add import at top:

```typescript
import { setMenubarPin } from "../utils/menubarPin";
import { refreshMenubar } from "../utils/menubarRefresh";
```

Add a new `onPinToMenubar` prop to `TaskItemProps`:

```typescript
interface TaskItemProps {
  // ... existing props ...
  onPinToMenubar?: (task: Task) => void;
}
```

In the action panel, add a new section before the utility actions section (Section 4):

```tsx
{/* Section 3: Menubar pin */}
<ActionPanel.Section title="Menubar">
  <Action
    title="Pin Task to Menubar"
    icon={Icon.Pin}
    onAction={async () => {
      await setMenubarPin({ type: "task", value: task.id });
      await refreshMenubar();
    }}
  />
  {filters?.tag && (
    <Action
      title={`Pin ${filters.tag} to Menubar`}
      icon={Icon.Pin}
      onAction={async () => {
        await setMenubarPin({ type: "tag", value: filters.tag! });
        await refreshMenubar();
      }}
    />
  )}
  {filters?.file && (
    <Action
      title={`Pin ${filters.file.replace(/\.md$/, "")} to Menubar`}
      icon={Icon.Pin}
      onAction={async () => {
        await setMenubarPin({ type: "file", value: filters.file! });
        await refreshMenubar();
      }}
    />
  )}
</ActionPanel.Section>
```

**Step 2: Update `package.json` commands**

Add `disabledByDefault: true` to `edit-task` and `mark-done` commands:

```json
{
  "name": "edit-task",
  "title": "Edit Task",
  "description": "Edit an existing Obsidian task",
  "mode": "view",
  "disabledByDefault": true,
  "arguments": [...]
},
{
  "name": "mark-done",
  "title": "Mark Task Done",
  "description": "Mark an Obsidian task as done",
  "mode": "view",
  "disabledByDefault": true
}
```

**Step 3: Build**

Run: `bun run build`
Expected: Compiles with no errors.

**Step 4: Manual test**

- Open List Tasks, select a task, open action panel
- Should see "Pin Task to Menubar" action
- When a tag filter is active, should also see "Pin #tag to Menubar"
- When a file filter is active, should also see "Pin filename to Menubar"
- After pinning, menubar should update

**Step 5: Commit**

```bash
git add src/components/TaskItem.tsx package.json
git commit -m "feat: add Pin to Menubar actions, disable Edit/Mark Done by default"
```
