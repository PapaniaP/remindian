import { List, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { Task } from "./types";
import { useTasks } from "./hooks/useTasks";
import { TaskItem } from "./components/TaskItem";
import { useSetup } from "./hooks/useSetup";
import { SetupWizard } from "./components/SetupWizard";

export default function Command() {
  const { isSetupComplete, completeSetup } = useSetup();
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchText, setSearchText] = useState("");
  const preferences = getPreferenceValues<Preferences>();

  const { allTasks, isLoading, handleMarkDone } = useTasks(preferences);

  useEffect(() => {
    if (searchText) {
      const query = searchText.toLowerCase();
      const filtered = allTasks.filter(
        (task) =>
          task.cleanTitle.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query) ||
          task.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
          (task.recurrence && task.recurrence.toLowerCase().includes(query)),
      );
      setFilteredTasks(filtered);
    } else {
      setFilteredTasks(allTasks);
    }
  }, [searchText, allTasks]);

  if (isSetupComplete === null) return <List isLoading />;
  if (!isSetupComplete) return <SetupWizard onComplete={completeSetup} />;

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search tasks to mark as done..."
      onSearchTextChange={setSearchText}
      filtering={false}
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
            showActions={true}
          />
        ))}
      </List.Section>
    </List>
  );
}
