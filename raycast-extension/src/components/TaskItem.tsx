import { Action, ActionPanel, Color, Icon, List, getPreferenceValues } from "@raycast/api";
import { Task, PRIORITY_VALUES } from "../types";
import { getCleanTitle } from "../utils/taskParser";
import { priorityToIcon } from "../utils/priority";
import { STATUS_MAP } from "../constants";
import { FilePreview } from "./FilePreview";
import { setMenubarPin } from "../utils/menubarPin";
import { refreshMenubar } from "../utils/menubarRefresh";
import type { GroupingOption, Filters } from "../list-tasks";
import path from "path";

const STATUS_ICONS: Record<string, { source: Icon; tintColor: Color }> = {
  " ": { source: Icon.Circle, tintColor: Color.SecondaryText },
  "x": { source: Icon.Checkmark, tintColor: Color.Green },
  "X": { source: Icon.Checkmark, tintColor: Color.Green },
  "/": { source: Icon.CircleProgress50, tintColor: Color.Blue },
  "-": { source: Icon.XMarkCircle, tintColor: Color.Yellow },
  ">": { source: Icon.ArrowRight, tintColor: Color.Orange },
  "?": { source: Icon.QuestionMark, tintColor: Color.Purple },
  "!": { source: Icon.ExclamationMark, tintColor: Color.Red },
};

// Status filter options — maps checkbox chars to user-facing labels
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: " ", label: "Pending" },
  { value: "x", label: "Done" },
  { value: "/", label: "In Progress" },
  { value: "-", label: "Cancelled" },
  { value: ">", label: "Forwarded" },
  { value: "?", label: "Question" },
  { value: "!", label: "Important" },
];

const DUE_DATE_OPTIONS: { value: string; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due Today" },
  { value: "thisWeek", label: "Due This Week" },
  { value: "thisMonth", label: "Due This Month" },
  { value: "none", label: "No Due Date" },
];

const CREATED_DATE_OPTIONS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "older", label: "Older" },
  { value: "none", label: "No Created Date" },
];

const GROUPING_OPTIONS: { value: GroupingOption; label: string }[] = [
  { value: "file", label: "File" },
  { value: "tag", label: "Tag" },
  { value: "priority", label: "Priority" },
  { value: "none", label: "None" },
];

interface TaskItemProps {
  task: Task;
  onMarkDone?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  showActions?: boolean;
  // Sorting/grouping/filtering props (optional — only from list-tasks)
  availableTags?: string[];
  availableFiles?: string[];
  onGroupBy?: (grouping: string) => void;
  onFilter?: (filterType: string, value: string | null) => void;
  activeGrouping?: GroupingOption;
  filters?: Filters;
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

function buildDetailMarkdown(task: Task): string {
  const lines: string[] = [];

  lines.push("```markdown");
  lines.push(task.source.originalLine);
  lines.push("```");

  return lines.join("\n");
}

export function TaskItem({
  task,
  onMarkDone,
  onDelete,
  onEdit,
  showActions = true,
  availableTags,
  availableFiles,
  onGroupBy,
  onFilter,
  activeGrouping,
  filters,
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
      icon={STATUS_ICONS[task.status] ?? { source: Icon.Circle, tintColor: Color.SecondaryText }}
      detail={
        <List.Item.Detail
          markdown={buildDetailMarkdown(task)}
          metadata={
            <List.Item.Detail.Metadata>
              {/* ── Identity ── */}
              <List.Item.Detail.Metadata.Label
                title="Status"
                text={(STATUS_MAP[task.status] ?? STATUS_MAP[task.status.toLowerCase()])?.label ?? task.status}
                icon={STATUS_ICONS[task.status]?.source ?? Icon.Circle}
              />
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
              {task.priority && (
                <List.Item.Detail.Metadata.Label
                  title="Priority"
                  text={task.priority}
                  icon={priorityMeta.icon}
                />
              )}

              {/* ── Dates ── */}
              <List.Item.Detail.Metadata.Separator />
              {task.dueDate && (
                <List.Item.Detail.Metadata.Label
                  title="Due Date"
                  text={task.dueDate.toLocaleDateString()}
                  icon={Icon.Calendar}
                />
              )}
              {task.scheduledDate && (
                <List.Item.Detail.Metadata.Label
                  title="Scheduled"
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
              {task.createdDate && (
                <List.Item.Detail.Metadata.Label
                  title="Created"
                  text={task.createdDate.toLocaleDateString()}
                  icon={Icon.PlusCircle}
                />
              )}
              {task.completedAt && (
                <List.Item.Detail.Metadata.Label
                  title="Completed"
                  text={task.completedAt.toLocaleDateString()}
                  icon={Icon.CheckCircle}
                />
              )}
              {task.recurrence && (
                <List.Item.Detail.Metadata.Label
                  title="Recurrence"
                  text={task.recurrence}
                  icon={Icon.Repeat}
                />
              )}

              {/* ── Source ── */}
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="File"
                text={relPath}
                icon={Icon.Document}
              />
              {task.clientName && (
                <List.Item.Detail.Metadata.Label
                  title="Client"
                  text={task.clientName}
                  icon={Icon.Person}
                />
              )}

            </List.Item.Detail.Metadata>
          }
        />
      }
      accessories={[
        ...(task.tags?.map((t) => ({
          tag: { value: t, color: Color.Blue },
        })) ?? []),
      ]}
      actions={
        showActions ? (
          <ActionPanel>
            {/* Section 1: Task actions */}
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

            {/* Section 2: Group By + Filter (only when callbacks provided) */}
            {onGroupBy && onFilter && (
              <ActionPanel.Section title="View">
                <ActionPanel.Submenu title="Group By" icon={Icon.AppWindowGrid3x3}>
                  {GROUPING_OPTIONS.map((opt) => (
                    <Action
                      key={opt.value}
                      title={opt.label}
                      icon={activeGrouping === opt.value ? Icon.Checkmark : Icon.Circle}
                      onAction={() => onGroupBy(opt.value)}
                    />
                  ))}
                </ActionPanel.Submenu>

                <ActionPanel.Submenu title="Filter" icon={Icon.Filter}>
                  {/* Status */}
                  <ActionPanel.Submenu title="Status" icon={Icon.Circle}>
                    {STATUS_OPTIONS.map((opt) => (
                      <Action
                        key={opt.value}
                        title={opt.label}
                        icon={filters?.status === opt.value ? Icon.Checkmark : Icon.Circle}
                        onAction={() => onFilter("status", filters?.status === opt.value ? null : opt.value)}
                      />
                    ))}
                    {filters?.status && (
                      <Action
                        title="Clear Status Filter"
                        icon={Icon.XMarkCircle}
                        onAction={() => onFilter("status", null)}
                      />
                    )}
                  </ActionPanel.Submenu>

                  {/* Priority */}
                  <ActionPanel.Submenu title="Priority" icon={Icon.Exclamationmark}>
                    {PRIORITY_VALUES.map((p) => (
                      <Action
                        key={p}
                        title={p.charAt(0).toUpperCase() + p.slice(1)}
                        icon={filters?.priority === p ? Icon.Checkmark : Icon.Circle}
                        onAction={() => onFilter("priority", filters?.priority === p ? null : p)}
                      />
                    ))}
                    {filters?.priority && (
                      <Action
                        title="Clear Priority Filter"
                        icon={Icon.XMarkCircle}
                        onAction={() => onFilter("priority", null)}
                      />
                    )}
                  </ActionPanel.Submenu>

                  {/* Tags */}
                  {availableTags && availableTags.length > 0 && (
                    <ActionPanel.Submenu title="Tags" icon={Icon.Tag}>
                      {availableTags.map((tag) => (
                        <Action
                          key={tag}
                          title={tag}
                          icon={filters?.tag === tag ? Icon.Checkmark : Icon.Circle}
                          onAction={() => onFilter("tag", filters?.tag === tag ? null : tag)}
                        />
                      ))}
                      {filters?.tag && (
                        <Action
                          title="Clear Tag Filter"
                          icon={Icon.XMarkCircle}
                          onAction={() => onFilter("tag", null)}
                        />
                      )}
                    </ActionPanel.Submenu>
                  )}

                  {/* Files */}
                  {availableFiles && availableFiles.length > 0 && (
                    <ActionPanel.Submenu title="Files" icon={Icon.Document}>
                      {availableFiles.map((f) => (
                        <Action
                          key={f}
                          title={f.replace(/\.md$/, "")}
                          icon={filters?.file === f ? Icon.Checkmark : Icon.Circle}
                          onAction={() => onFilter("file", filters?.file === f ? null : f)}
                        />
                      ))}
                      {filters?.file && (
                        <Action
                          title="Clear File Filter"
                          icon={Icon.XMarkCircle}
                          onAction={() => onFilter("file", null)}
                        />
                      )}
                    </ActionPanel.Submenu>
                  )}

                  {/* Due Date */}
                  <ActionPanel.Submenu title="Due Date" icon={Icon.Calendar}>
                    {DUE_DATE_OPTIONS.map((opt) => (
                      <Action
                        key={opt.value}
                        title={opt.label}
                        icon={filters?.dueDate === opt.value ? Icon.Checkmark : Icon.Circle}
                        onAction={() => onFilter("dueDate", filters?.dueDate === opt.value ? null : opt.value)}
                      />
                    ))}
                    {filters?.dueDate && (
                      <Action
                        title="Clear Due Date Filter"
                        icon={Icon.XMarkCircle}
                        onAction={() => onFilter("dueDate", null)}
                      />
                    )}
                  </ActionPanel.Submenu>

                  {/* Created Date */}
                  <ActionPanel.Submenu title="Created Date" icon={Icon.PlusCircle}>
                    {CREATED_DATE_OPTIONS.map((opt) => (
                      <Action
                        key={opt.value}
                        title={opt.label}
                        icon={filters?.createdDate === opt.value ? Icon.Checkmark : Icon.Circle}
                        onAction={() => onFilter("createdDate", filters?.createdDate === opt.value ? null : opt.value)}
                      />
                    ))}
                    {filters?.createdDate && (
                      <Action
                        title="Clear Created Date Filter"
                        icon={Icon.XMarkCircle}
                        onAction={() => onFilter("createdDate", null)}
                      />
                    )}
                  </ActionPanel.Submenu>
                </ActionPanel.Submenu>
              </ActionPanel.Section>
            )}

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

            {/* Section 4: Utility actions */}
            <ActionPanel.Section>
              <Action.OpenInBrowser
                title="Open in Obsidian"
                url={`obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relPath.replace(/\.md$/, ""))}`}
                shortcut={{ modifiers: ["cmd"], key: "return" }}
              />
              <Action.Push
                title="View in Context"
                icon={Icon.Eye}
                target={<FilePreview task={task} />}
                shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
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
