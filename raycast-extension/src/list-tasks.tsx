import { List, useNavigation, getPreferenceValues } from "@raycast/api";
import { useState, useMemo } from "react";
import { Task, Priority, PRIORITY_VALUES } from "./types";
import { EditTaskForm } from "./components/EditTaskForm";
import { TaskItem } from "./components/TaskItem";
import { useTasks } from "./hooks/useTasks";
import { useSetup } from "./hooks/useSetup";
import { SetupWizard } from "./components/SetupWizard";

// --- Sort types ---

type SortOption = "dueDate" | "priority" | "name" | "file" | "created";

const SORT_OPTIONS: { value: SortOption; title: string }[] = [
  { value: "dueDate", title: "Due Date" },
  { value: "priority", title: "Priority" },
  { value: "name", title: "Name" },
  { value: "file", title: "File" },
  { value: "created", title: "Created" },
];

// --- Grouping types ---

export type GroupingOption = "file" | "tag" | "priority" | "none";

// --- Filter types ---

export interface Filters {
  status?: string;
  priority?: string;
  tag?: string;
  file?: string;
  dueDate?: string;
  createdDate?: string;
}

// --- Sort functions ---

const PRIORITY_ORDER: Record<string, number> = {
  [Priority.HIGHEST]: 0,
  [Priority.HIGH]: 1,
  [Priority.MEDIUM]: 2,
  [Priority.LOW]: 3,
  [Priority.LOWEST]: 4,
};

function sortTasks(tasks: Task[], sort: SortOption): Task[] {
  const sorted = [...tasks];
  switch (sort) {
    case "dueDate":
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
    case "priority":
      return sorted.sort((a, b) => {
        const aOrder = a.priority ? PRIORITY_ORDER[a.priority] ?? 5 : 5;
        const bOrder = b.priority ? PRIORITY_ORDER[b.priority] ?? 5 : 5;
        return aOrder - bOrder;
      });
    case "name":
      return sorted.sort((a, b) =>
        a.cleanTitle.localeCompare(b.cleanTitle),
      );
    case "file":
      return sorted.sort((a, b) => {
        const aFile = a.source.filePath.split("/").pop() || "";
        const bFile = b.source.filePath.split("/").pop() || "";
        return aFile.localeCompare(bFile);
      });
    case "created":
      return sorted.sort((a, b) => {
        if (!a.createdDate && !b.createdDate) return 0;
        if (!a.createdDate) return 1;
        if (!b.createdDate) return -1;
        return b.createdDate.getTime() - a.createdDate.getTime(); // newest first
      });
  }
}

// --- Filter functions ---

function applyFilters(tasks: Task[], filters: Filters): Task[] {
  let result = tasks;

  if (filters.status) {
    result = result.filter((t) => t.status === filters.status);
  }
  if (filters.priority) {
    result = result.filter((t) => t.priority === filters.priority);
  }
  if (filters.tag) {
    result = result.filter((t) => t.tags?.includes(filters.tag!));
  }
  if (filters.file) {
    result = result.filter((t) => {
      const fileName = t.source.filePath.split("/").pop() || "";
      return fileName === filters.file;
    });
  }
  if (filters.dueDate) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);
    const endOfWeek = new Date(startOfDay.getTime() + 7 * 86400000 - 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    switch (filters.dueDate) {
      case "overdue":
        result = result.filter((t) => t.dueDate && t.dueDate < startOfDay);
        break;
      case "today":
        result = result.filter((t) => t.dueDate && t.dueDate >= startOfDay && t.dueDate <= endOfDay);
        break;
      case "thisWeek":
        result = result.filter((t) => t.dueDate && t.dueDate >= startOfDay && t.dueDate <= endOfWeek);
        break;
      case "thisMonth":
        result = result.filter((t) => t.dueDate && t.dueDate >= startOfDay && t.dueDate <= endOfMonth);
        break;
      case "none":
        result = result.filter((t) => !t.dueDate);
        break;
    }
  }
  if (filters.createdDate) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysAgo7 = new Date(startOfDay.getTime() - 7 * 86400000);
    const daysAgo30 = new Date(startOfDay.getTime() - 30 * 86400000);

    switch (filters.createdDate) {
      case "today":
        result = result.filter((t) => t.createdDate && t.createdDate >= startOfDay);
        break;
      case "last7":
        result = result.filter((t) => t.createdDate && t.createdDate >= daysAgo7);
        break;
      case "last30":
        result = result.filter((t) => t.createdDate && t.createdDate >= daysAgo30);
        break;
      case "older":
        result = result.filter((t) => t.createdDate && t.createdDate < daysAgo30);
        break;
      case "none":
        result = result.filter((t) => !t.createdDate);
        break;
    }
  }

  return result;
}

// --- Search filter ---

function applySearch(tasks: Task[], query: string): Task[] {
  if (!query) return tasks;
  const q = query.toLowerCase();
  return tasks.filter(
    (t) =>
      t.cleanTitle.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
      t.clientName?.toLowerCase().includes(q) ||
      (t.recurrence && t.recurrence.toLowerCase().includes(q)),
  );
}

// --- Grouping functions ---

function groupTasksByFile(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const fileName = task.source.filePath.split("/").pop() || "";
    const key = fileName.replace(/\.md$/, "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(task);
  }
  return groups;
}

function groupTasksByTag(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const tag = task.tags && task.tags.length > 0 ? task.tags[0] : "Untagged";
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag)!.push(task);
  }
  return groups;
}

function groupTasksByPriority(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  // Insert in priority order
  for (const p of PRIORITY_VALUES) {
    const label = p.charAt(0).toUpperCase() + p.slice(1);
    const matching = tasks.filter((t) => t.priority === p);
    if (matching.length > 0) groups.set(label, matching);
  }
  const noPriority = tasks.filter((t) => !t.priority);
  if (noPriority.length > 0) groups.set("No Priority", noPriority);
  return groups;
}

function groupTasks(tasks: Task[], grouping: GroupingOption): Map<string, Task[]> | null {
  switch (grouping) {
    case "file":
      return groupTasksByFile(tasks);
    case "tag":
      return groupTasksByTag(tasks);
    case "priority":
      return groupTasksByPriority(tasks);
    case "none":
      return null;
  }
}

// --- Component ---

export default function Command() {
  const { isSetupComplete, completeSetup } = useSetup();
  const [searchText, setSearchText] = useState("");
  const [activeSort, setActiveSort] = useState<SortOption>("dueDate");
  const preferences = getPreferenceValues<Preferences>();
  const defaultGrouping = (preferences as Record<string, string>).defaultGrouping as GroupingOption | undefined;
  const [activeGrouping, setActiveGrouping] = useState<GroupingOption>(defaultGrouping || "file");
  const [filters, setFilters] = useState<Filters>({});
  const { push } = useNavigation();

  const {
    allTasks,
    isLoading,
    availableFiles,
    availableTags,
    refreshTaskList,
    handleMarkDone,
    handleDeleteTask,
  } = useTasks(preferences);

  // Pipeline: filter → search → sort → group
  const processedTasks = useMemo(() => {
    let tasks = applyFilters(allTasks, filters);
    tasks = applySearch(tasks, searchText);
    tasks = sortTasks(tasks, activeSort);
    return tasks;
  }, [allTasks, filters, searchText, activeSort]);

  const taskGroups = useMemo(
    () => groupTasks(processedTasks, activeGrouping),
    [processedTasks, activeGrouping],
  );

  const handleEditTask = (task: Task) => {
    push(<EditTaskForm task={task} onTaskUpdated={refreshTaskList} />);
  };

  const handleGroupBy = (grouping: string) => {
    setActiveGrouping(grouping as GroupingOption);
  };

  const handleFilter = (filterType: string, value: string | null) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value ?? undefined,
    }));
  };

  if (isSetupComplete === null) return <List isLoading />;
  if (!isSetupComplete) return <SetupWizard onComplete={completeSetup} />;

  const taskItemProps = {
    onMarkDone: handleMarkDone,
    onDelete: handleDeleteTask,
    onEdit: handleEditTask,
    availableTags,
    availableFiles,
    onGroupBy: handleGroupBy,
    onFilter: handleFilter,
    activeGrouping,
    filters,
  };

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search tasks..."
      onSearchTextChange={setSearchText}
      filtering={false}
      isShowingDetail
      searchBarAccessory={
        <List.Dropdown
          tooltip="Sort tasks"
          onChange={(val) => setActiveSort(val as SortOption)}
          value={activeSort}
        >
          {SORT_OPTIONS.map((opt) => (
            <List.Dropdown.Item
              key={opt.value}
              title={opt.title}
              value={opt.value}
            />
          ))}
        </List.Dropdown>
      }
    >
      {taskGroups
        ? Array.from(taskGroups.entries()).map(([groupName, tasks]) => (
            <List.Section
              key={groupName}
              title={groupName}
              subtitle={tasks.length.toString()}
            >
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  {...taskItemProps}
                />
              ))}
            </List.Section>
          ))
        : (
          <List.Section
            title="Tasks"
            subtitle={processedTasks.length.toString()}
          >
            {processedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                {...taskItemProps}
              />
            ))}
          </List.Section>
        )}
    </List>
  );
}
