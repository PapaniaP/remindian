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
    case "file":
      return tasks.filter((t) => {
        const fileName = t.source.filePath.split("/").pop() || "";
        return fileName === pin.value;
      });
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
    return (
      <MenuBarExtra.Submenu
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
