import { List, useNavigation, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { Task } from "./types";
import { EditTaskForm } from "./components/EditTaskForm";
import { TaskItem } from "./components/TaskItem";
import { useTasks } from "./hooks/useTasks";

export default function Command() {
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchText, setSearchText] = useState("");
  const [fileFilter, setFileFilter] = useState("all");
  const { push } = useNavigation();
  const preferences = getPreferenceValues<Preferences>();

  const {
    allTasks,
    isLoading,
    availableFiles,
    refreshTaskList,
    handleMarkDone,
    handleDeleteTask,
  } = useTasks(preferences);

  useEffect(() => {
    let tasks = allTasks;

    // Apply file filter
    if (fileFilter !== "all") {
      tasks = tasks.filter((task) => {
        const fileName = task.source.filePath.split("/").pop() || "";
        return fileName === fileFilter;
      });
    }

    // Apply search text filter
    if (searchText) {
      const query = searchText.toLowerCase();
      tasks = tasks.filter(
        (task) =>
          task.cleanTitle.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query) ||
          task.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
          task.clientName?.toLowerCase().includes(query) ||
          (task.recurrence &&
            task.recurrence.toLowerCase().includes(query)),
      );
    }

    setFilteredTasks(tasks);
  }, [searchText, allTasks, fileFilter]);

  const handleEditTask = (task: Task) => {
    push(<EditTaskForm task={task} onTaskUpdated={refreshTaskList} />);
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
          tooltip="Filter by file"
          onChange={setFileFilter}
        >
          <List.Dropdown.Item title="All Files" value="all" />
          {availableFiles.map((f) => (
            <List.Dropdown.Item
              key={f}
              title={f.replace(".md", "")}
              value={f}
            />
          ))}
        </List.Dropdown>
      }
    >
      <List.Section
        title="Tasks"
        subtitle={filteredTasks.length.toString()}
      >
        {filteredTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onMarkDone={handleMarkDone}
            onDelete={handleDeleteTask}
            onEdit={handleEditTask}
          />
        ))}
      </List.Section>
    </List>
  );
}
