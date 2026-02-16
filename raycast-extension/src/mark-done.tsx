import { List, getPreferenceValues } from "@raycast/api";
import { useState, useMemo } from "react";
import { Task, Priority } from "./types";
import { useTasks } from "./hooks/useTasks";
import { TaskItem } from "./components/TaskItem";
import { useSetup } from "./hooks/useSetup";
import { SetupWizard } from "./components/SetupWizard";

// --- Sort (same as list-tasks) ---

type SortOption = "dueDate" | "priority" | "name" | "file" | "created";

const SORT_OPTIONS: { value: SortOption; title: string }[] = [
  { value: "dueDate", title: "Due Date" },
  { value: "priority", title: "Priority" },
  { value: "name", title: "Name" },
  { value: "file", title: "File" },
  { value: "created", title: "Created" },
];

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
      return sorted.sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle));
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
        return b.createdDate.getTime() - a.createdDate.getTime();
      });
  }
}

export default function Command() {
  const { isSetupComplete, completeSetup } = useSetup();
  const [searchText, setSearchText] = useState("");
  const [activeSort, setActiveSort] = useState<SortOption>("dueDate");
  const preferences = getPreferenceValues<Preferences>();

  const { allTasks, isLoading, handleMarkDone } = useTasks(preferences);

  const processedTasks = useMemo(() => {
    let tasks = allTasks;
    if (searchText) {
      const q = searchText.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.cleanTitle.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
          (t.recurrence && t.recurrence.toLowerCase().includes(q)),
      );
    }
    return sortTasks(tasks, activeSort);
  }, [allTasks, searchText, activeSort]);

  if (isSetupComplete === null) return <List isLoading />;
  if (!isSetupComplete) return <SetupWizard onComplete={completeSetup} />;

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search tasks to mark as done..."
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
      <List.Section
        title="Tasks"
        subtitle={processedTasks.length.toString()}
      >
        {processedTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onMarkDone={handleMarkDone}
            showActions={true}
          />
        ))}
      </List.Section>
    </List>
  );
}
