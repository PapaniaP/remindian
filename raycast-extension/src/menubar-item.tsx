import {
  Icon,
  MenuBarExtra,
  open,
  getPreferenceValues,
  launchCommand,
  LaunchType,
  openExtensionPreferences,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { getCleanTitle } from "./utils/taskParser";
import { PRIORITY_VALUES, Task } from "./types";
import { useTasks } from "./hooks/useTasks";
import { priorityToIcon } from "./utils/priority";
import { getInboxFilePath } from "./utils/settings";
import path from "path";

const Command = () => {
  const preferences = getPreferenceValues<Preferences>();
  const maxLength =
    parseInt(preferences.maxMenubarDescriptionLength) || 30;
  const [inboxConfigured, setInboxConfigured] = useState(false);

  useEffect(() => {
    getInboxFilePath().then((p) => setInboxConfigured(!!p));
  }, []);

  const {
    allTasks,
    topTask,
    isLoading,
    handleMarkDone,
    handleDeleteTask,
    refreshTaskList,
  } = useTasks(preferences);

  const getMenubarTitle = (task: Task): string => {
    if (!task) return "No Tasks";

    if (preferences.menubarTaskCount) {
      return `${allTasks.length.toString()}`;
    }

    const parts: string[] = [getCleanTitle(task, maxLength)];

    if (preferences.showDueDate && task.dueDate) {
      parts.push(`${task.dueDate.toLocaleDateString()}`);
    }

    return parts.join(" • ");
  };

  const vaultName = path.basename(preferences.vaultPath || "");

  const handleOpenInObsidian = async (task: Task) => {
    const relPath = path.relative(
      preferences.vaultPath,
      task.source.filePath,
    );
    const obsidianURI = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relPath.replace(/\.md$/, ""))}`;
    await open(obsidianURI);
  };

  const handleLaunchCommand = async (command: string) => {
    await launchCommand({
      name: command,
      type: LaunchType.UserInitiated,
    });
  };

  const handleEditTask = async (task: Task) => {
    await launchCommand({
      name: "edit-task",
      type: LaunchType.UserInitiated,
      arguments: { taskId: task.id },
    });
  };

  const handleDone = async (task: Task) => {
    await handleMarkDone(task);
    await refreshTaskList();
  };

  const BottomSection = (
    <>
      {inboxConfigured && (
        <MenuBarExtra.Item
          title="Create Task"
          icon={Icon.Plus}
          onAction={() => handleLaunchCommand("add-task")}
        />
      )}
      <MenuBarExtra.Item
        title="Open Extension Preferences"
        icon={Icon.Gear}
        onAction={openExtensionPreferences}
        shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
      />
    </>
  );

  if (isLoading) {
    return (
      <MenuBarExtra icon={Icon.Clock} tooltip="Loading tasks...">
        <MenuBarExtra.Item title="Obsidian Tasks is loading..." />
      </MenuBarExtra>
    );
  }

  if (!topTask) {
    return (
      <MenuBarExtra title="No Tasks" tooltip="No pending tasks">
        {BottomSection}
      </MenuBarExtra>
    );
  }

  const icon = preferences.menubarTaskCount
    ? Icon.CheckList
    : priorityToIcon(topTask.priority).icon;

  return (
    <MenuBarExtra
      title={getMenubarTitle(topTask)}
      {...(preferences.showIcon ? { icon } : {})}
    >
      <MenuBarExtra.Item
        title="Mark as Done"
        icon={Icon.Checkmark}
        onAction={() => handleDone(topTask)}
      />

      <MenuBarExtra.Section>
        {allTasks?.map((task) => {
          const fileName =
            task.source.filePath.split("/").pop()?.replace(".md", "") ||
            "";
          return (
            <MenuBarExtra.Submenu
              key={task.id}
              title={`${getCleanTitle(task, maxLength)} (${fileName})`}
              icon={priorityToIcon(task.priority).icon}
            >
              <MenuBarExtra.Item
                title="Mark as Done"
                icon={Icon.Checkmark}
                onAction={() => handleDone(task)}
              />
              <MenuBarExtra.Submenu
                title="Set Priority"
                icon={Icon.ArrowUp}
              >
                {PRIORITY_VALUES.map((p) => (
                  <MenuBarExtra.Item
                    key={p}
                    title={`${p}`}
                    icon={priorityToIcon(p).icon}
                    onAction={async () => {
                      const { updateTask } = await import(
                        "./utils/taskOperations"
                      );
                      await updateTask(task, { newPriority: p });
                      await refreshTaskList();
                    }}
                  />
                ))}
              </MenuBarExtra.Submenu>
              <MenuBarExtra.Item
                title="Edit Task"
                icon={Icon.Pencil}
                onAction={() => handleEditTask(task)}
              />
              <MenuBarExtra.Item
                title="Open in Obsidian"
                icon={Icon.Link}
                onAction={() => handleOpenInObsidian(task)}
              />
              <MenuBarExtra.Item
                title="Delete Task"
                icon={Icon.Trash}
                onAction={() => handleDeleteTask(task)}
              />
            </MenuBarExtra.Submenu>
          );
        })}
      </MenuBarExtra.Section>

      <MenuBarExtra.Section>{BottomSection}</MenuBarExtra.Section>
    </MenuBarExtra>
  );
};

export default Command;
