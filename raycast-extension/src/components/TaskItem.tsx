import { Action, ActionPanel, Color, Icon, List, getPreferenceValues } from "@raycast/api";
import { Task } from "../types";
import { getCleanTitle } from "../utils/taskParser";
import { priorityToIcon } from "../utils/priority";
import path from "path";

interface TaskItemProps {
  task: Task;
  onMarkDone?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  showActions?: boolean;
}

function getRelativeFilePath(task: Task): string {
  const preferences = getPreferenceValues<Preferences>();
  const vaultPath = preferences.vaultPath;
  return path.relative(vaultPath, task.source.filePath);
}

function getVaultName(): string {
  const preferences = getPreferenceValues<Preferences>();
  return path.basename(preferences.vaultPath);
}

export function TaskItem({
  task,
  onMarkDone,
  onDelete,
  onEdit,
  showActions = true,
}: TaskItemProps) {
  const taskDesc = getCleanTitle(task);
  const priorityMeta = priorityToIcon(task.priority);
  const relPath = getRelativeFilePath(task);
  const fileName = task.source.filePath.split("/").pop() || "";
  const vaultName = getVaultName();

  return (
    <List.Item
      key={task.id}
      title={taskDesc}
      icon={task.completed ? Icon.Checkmark : priorityMeta.icon}
      detail={
        <List.Item.Detail
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Status"
                text={task.completed ? "Completed" : "Pending"}
                icon={task.completed ? Icon.Checkmark : Icon.Circle}
              />

              {task.priority && (
                <List.Item.Detail.Metadata.Label
                  title="Priority"
                  text={task.priority}
                  icon={priorityMeta.icon}
                />
              )}

              {task.dueDate && (
                <List.Item.Detail.Metadata.Label
                  title="Due Date"
                  text={task.dueDate.toLocaleDateString()}
                  icon={Icon.Calendar}
                />
              )}

              {task.scheduledDate && (
                <List.Item.Detail.Metadata.Label
                  title="Scheduled Date"
                  text={task.scheduledDate.toLocaleDateString()}
                  icon={Icon.Clock}
                />
              )}

              {task.startDate && (
                <List.Item.Detail.Metadata.Label
                  title="Start Date"
                  text={task.startDate.toLocaleDateString()}
                  icon={Icon.ArrowRight}
                />
              )}

              {task.recurrence && (
                <List.Item.Detail.Metadata.Label
                  title="Recurrence"
                  text={task.recurrence}
                  icon={Icon.Repeat}
                />
              )}

              {task.tags && task.tags.length > 0 && (
                <List.Item.Detail.Metadata.TagList title="Tags">
                  {task.tags.map((tag) => (
                    <List.Item.Detail.Metadata.TagList.Item
                      key={tag}
                      text={tag}
                      color={Color.Blue}
                    />
                  ))}
                </List.Item.Detail.Metadata.TagList>
              )}

              {task.clientName && (
                <List.Item.Detail.Metadata.Label
                  title="Client"
                  text={task.clientName}
                  icon={Icon.Person}
                />
              )}

              <List.Item.Detail.Metadata.Separator />

              <List.Item.Detail.Metadata.Label
                title="File"
                text={relPath}
                icon={Icon.Document}
              />

              {task.completedAt && (
                <List.Item.Detail.Metadata.Label
                  title="Completed At"
                  text={task.completedAt.toLocaleDateString()}
                  icon={Icon.CheckCircle}
                />
              )}
            </List.Item.Detail.Metadata>
          }
        />
      }
      accessories={[
        {
          icon: task.dueDate ? Icon.Calendar : undefined,
          date: task.dueDate,
          tooltip: task.dueDate
            ? `Due: ${task.dueDate.toLocaleDateString()}`
            : undefined,
        },
        {
          icon:
            task.tags && task.tags.length > 0 ? Icon.Tag : undefined,
          text: task.tags?.join(", "),
          tooltip: task.tags
            ? `Tags: ${task.tags.join(", ")}`
            : undefined,
        },
        {
          text: fileName.replace(".md", ""),
          tooltip: `File: ${relPath}`,
        },
      ]}
      actions={
        showActions ? (
          <ActionPanel>
            <ActionPanel.Section>
              {onMarkDone && (
                <Action
                  title={task.completed ? "Mark as Not Done" : "Mark as Done"}
                  icon={task.completed ? Icon.Circle : Icon.Checkmark}
                  onAction={() => onMarkDone(task)}
                />
              )}
              {onEdit && (
                <Action
                  title="Edit Task"
                  icon={Icon.Pencil}
                  onAction={() => onEdit(task)}
                />
              )}
              {onDelete && (
                <Action
                  title="Delete Task"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={() => onDelete(task)}
                />
              )}
            </ActionPanel.Section>

            <ActionPanel.Section>
              <Action.OpenInBrowser
                title="Open in Obsidian"
                url={`obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relPath.replace(/\.md$/, ""))}`}
                shortcut={{ modifiers: ["cmd"], key: "o" }}
              />
              <Action.CopyToClipboard
                title="Copy Task Description"
                content={task.cleanTitle}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
              />
            </ActionPanel.Section>
          </ActionPanel>
        ) : undefined
      }
    />
  );
}
