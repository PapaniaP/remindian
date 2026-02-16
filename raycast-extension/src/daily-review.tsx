import { List, getPreferenceValues } from "@raycast/api";
import { useMemo } from "react";
import { Task } from "./types";
import { TaskItem } from "./components/TaskItem";
import { useTasks } from "./hooks/useTasks";
import { useSetup } from "./hooks/useSetup";
import { SetupWizard } from "./components/SetupWizard";

function categorizeTasks(tasks: Task[]): {
  overdue: Task[];
  dueToday: Task[];
  scheduledToday: Task[];
} {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);

  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const scheduledToday: Task[] = [];
  const seen = new Set<string>();

  for (const task of tasks) {
    if (task.completed) continue;

    if (task.dueDate && task.dueDate < startOfDay) {
      overdue.push(task);
      seen.add(task.id);
    } else if (task.dueDate && task.dueDate >= startOfDay && task.dueDate <= endOfDay) {
      dueToday.push(task);
      seen.add(task.id);
    }

    if (
      !seen.has(task.id) &&
      task.scheduledDate &&
      task.scheduledDate >= startOfDay &&
      task.scheduledDate <= endOfDay
    ) {
      scheduledToday.push(task);
    }
  }

  return { overdue, dueToday, scheduledToday };
}

export default function Command() {
  const { isSetupComplete, completeSetup } = useSetup();
  const preferences = getPreferenceValues<Preferences>();
  const { allTasks, isLoading, refreshTaskList, handleMarkDone, handleDeleteTask } =
    useTasks(preferences);

  const { overdue, dueToday, scheduledToday } = useMemo(
    () => categorizeTasks(allTasks),
    [allTasks],
  );

  const totalCount = overdue.length + dueToday.length + scheduledToday.length;

  if (isSetupComplete === null) return <List isLoading />;
  if (!isSetupComplete) return <SetupWizard onComplete={completeSetup} />;

  if (!isLoading && totalCount === 0) {
    return (
      <List>
        <List.EmptyView
          title="All clear!"
          description="No overdue, due, or scheduled tasks for today."
          icon="checkmark-circle-16"
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} isShowingDetail>
      {overdue.length > 0 && (
        <List.Section title="Overdue" subtitle={overdue.length.toString()}>
          {overdue.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onMarkDone={handleMarkDone}
              onDelete={handleDeleteTask}
            />
          ))}
        </List.Section>
      )}

      {dueToday.length > 0 && (
        <List.Section title="Due Today" subtitle={dueToday.length.toString()}>
          {dueToday.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onMarkDone={handleMarkDone}
              onDelete={handleDeleteTask}
            />
          ))}
        </List.Section>
      )}

      {scheduledToday.length > 0 && (
        <List.Section title="Scheduled Today" subtitle={scheduledToday.length.toString()}>
          {scheduledToday.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onMarkDone={handleMarkDone}
              onDelete={handleDeleteTask}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}
