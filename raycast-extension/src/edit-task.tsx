import { Action, ActionPanel, Icon, List, useNavigation, LaunchProps, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { Task } from "./types";
import { EditTaskForm } from "./components/EditTaskForm";
import { useTasks } from "./hooks/useTasks";
import { priorityToIcon } from "./utils/priority";
import { getCleanTitle } from "./utils/taskParser";

export default function Command(
  props: LaunchProps<{ arguments: { taskId: string } }>,
) {
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchText, setSearchText] = useState("");
  const { push } = useNavigation();
  const preferences = getPreferenceValues<Preferences>();

  const { allTasks, isLoading, refreshTaskList } = useTasks(preferences);

  const { taskId } = props.arguments;
  useEffect(() => {
    if (!allTasks || !taskId) return;

    const task = allTasks.find((task) => task.id === taskId);
    if (task) {
      handleSelectTask(task);
    }
  }, [allTasks, taskId]);

  useEffect(() => {
    if (searchText) {
      const query = searchText.toLowerCase();
      const filtered = allTasks.filter(
        (task) =>
          task.cleanTitle.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query) ||
          task.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
          (task.recurrence &&
            task.recurrence.toLowerCase().includes(query)),
      );
      setFilteredTasks(filtered);
    } else {
      setFilteredTasks(allTasks);
    }
  }, [searchText, allTasks]);

  const handleSelectTask = (task: Task) => {
    push(<EditTaskForm task={task} onTaskUpdated={refreshTaskList} />);
  };

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search tasks to edit..."
      onSearchTextChange={setSearchText}
      filtering={false}
    >
      <List.Section
        title="Tasks"
        subtitle={filteredTasks.length.toString()}
      >
        {filteredTasks.map((task) => {
          const priorityMeta = priorityToIcon(task.priority);
          return (
            <List.Item
              key={task.id}
              icon={
                task.completed ? Icon.Checkmark : priorityMeta.icon
              }
              title={getCleanTitle(task)}
              subtitle={task.source.filePath.split("/").pop()?.replace(".md", "")}
              actions={
                <ActionPanel>
                  <Action
                    title="Edit Task"
                    icon={Icon.Pencil}
                    onAction={() => handleSelectTask(task)}
                  />
                  <Action.CopyToClipboard
                    title="Copy Task Description"
                    content={task.cleanTitle}
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
