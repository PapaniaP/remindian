/**
 * Task operations — orchestrates vault scanning and surgical editing.
 * Provides the same function signatures as the original extension
 * but internally uses multi-file scanning and surgical edits.
 */

import { showToast, Toast } from "@raycast/api";
import { Task, Priority, ScanOptions, MetadataChanges } from "../types";
import { scanVault } from "./vaultScanner";
import {
  markTaskComplete as surgicalMarkComplete,
  markTaskIncomplete as surgicalMarkIncomplete,
  updateTaskMetadata as surgicalUpdateMetadata,
  appendNewTask,
  deleteTaskLine,
  changeTaskStatus as surgicalChangeStatus,
} from "./surgicalEditor";
import { priorityToValue } from "./priority";
import { priorityToEmoji } from "./priority";
import { refreshMenubar } from "./menubarRefresh";
import { getSettings } from "./settings";
import { ICONS } from "../constants";
import path from "path";

async function getScanOptions(): Promise<{ vaultPath: string; options: ScanOptions }> {
  const settings = await getSettings();

  if (!settings.vaultPath) {
    throw new Error("Vault path is not set");
  }

  return {
    vaultPath: settings.vaultPath,
    options: {
      excludedFolders: settings.excludedFolders,
      includedFolders: settings.includedFolders,
      includeCompleted: settings.showCompletedTasks,
    },
  };
}

export async function getAllTasks(): Promise<Task[]> {
  const { vaultPath, options } = await getScanOptions();
  const optionsWithCompleted = { ...options, includeCompleted: true };
  const taskFiles = await scanVault(vaultPath, optionsWithCompleted);
  return taskFiles.flatMap((tf) => tf.tasks);
}

export async function getAllUncompletedTasks(): Promise<Task[]> {
  const { vaultPath, options } = await getScanOptions();
  const optionsUncompleted = { ...options, includeCompleted: false };
  const taskFiles = await scanVault(vaultPath, optionsUncompleted);
  return taskFiles.flatMap((tf) => tf.tasks);
}

export async function getHighestPriorityTask(): Promise<Task | null> {
  const tasks = await getAllUncompletedTasks();
  if (tasks.length === 0) return null;

  const sorted = [...tasks].sort((a, b) => {
    const priorityA = a.priority || Priority.LOWEST;
    const priorityB = b.priority || Priority.LOWEST;
    const priorityDiff = priorityToValue(priorityA) - priorityToValue(priorityB);
    if (priorityDiff !== 0) return priorityDiff;

    // Tiebreak by due date
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    // Tiebreak by scheduled date
    if (a.scheduledDate && b.scheduledDate)
      return a.scheduledDate.getTime() - b.scheduledDate.getTime();
    if (a.scheduledDate) return -1;
    if (b.scheduledDate) return 1;

    return 0;
  });

  return sorted[0];
}

/**
 * Format a new task as an Obsidian Tasks line.
 * This is the ONE place where line construction is acceptable — for brand new tasks.
 */
function formatNewTaskLine(input: {
  description: string;
  priority?: Priority;
  dueDate?: Date;
  scheduledDate?: Date;
  startDate?: Date;
  tags?: string[];
  recurrence?: string;
}): string {
  const parts: string[] = ["- [ ]", input.description.trim()];

  if (input.priority) {
    const emoji = priorityToEmoji(input.priority);
    if (emoji) parts.push(emoji);
  }

  if (input.startDate) {
    parts.push(`${ICONS.DATE.START} ${formatDate(input.startDate)}`);
  }

  if (input.scheduledDate) {
    parts.push(`${ICONS.DATE.SCHEDULED} ${formatDate(input.scheduledDate)}`);
  }

  if (input.dueDate) {
    parts.push(`${ICONS.DATE.DUE} ${formatDate(input.dueDate)}`);
  }

  if (input.recurrence) {
    parts.push(`${ICONS.RECURRING} ${input.recurrence}`);
  }

  if (input.tags && input.tags.length > 0) {
    for (const tag of input.tags) {
      const formattedTag = tag.startsWith("#") ? tag : `#${tag}`;
      parts.push(formattedTag);
    }
  }

  return parts.join(" ");
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface NewTaskInput {
  description: string;
  completed?: boolean;
  priority?: Priority;
  dueDate?: Date;
  scheduledDate?: Date;
  startDate?: Date;
  tags?: string[];
  recurrence?: string;
  targetFilePath?: string; // Absolute path, or relative to vault
}

export async function addTask(input: NewTaskInput): Promise<void> {
  try {
    const settings = await getSettings();
    const vaultPath = settings.vaultPath;

    let targetPath: string;
    if (input.targetFilePath) {
      targetPath = path.isAbsolute(input.targetFilePath)
        ? input.targetFilePath
        : path.join(vaultPath, input.targetFilePath);
    } else if (settings.inboxFilePath) {
      targetPath = path.join(vaultPath, settings.inboxFilePath);
    } else {
      throw new Error("No inbox file configured. Please set one in the setup wizard.");
    }

    const taskLine = formatNewTaskLine(input);
    await appendNewTask(targetPath, taskLine);

    await showToast({ style: Toast.Style.Success, title: "Task added" });
    await refreshMenubar();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to add task",
      message: String(error),
    });
    throw error;
  }
}

export async function markTaskDone(task: Task): Promise<void> {
  try {
    await surgicalMarkComplete(task);
    await showToast({ style: Toast.Style.Success, title: "Task completed" });
    await refreshMenubar();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to complete task",
      message: String(error),
    });
    throw error;
  }
}

export async function markTaskUndone(task: Task): Promise<void> {
  try {
    await surgicalMarkIncomplete(task);
    await refreshMenubar();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to uncomplete task",
      message: String(error),
    });
    throw error;
  }
}

export async function updateTask(
  task: Task,
  changes: MetadataChanges,
): Promise<void> {
  try {
    await surgicalUpdateMetadata(task, changes);
    await refreshMenubar();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to update task",
      message: String(error),
    });
    throw error;
  }
}

export async function deleteTask(task: Task): Promise<void> {
  try {
    await deleteTaskLine(task);
    await showToast({ style: Toast.Style.Success, title: "Task deleted" });
    await refreshMenubar();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to delete task",
      message: String(error),
    });
    throw error;
  }
}

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
