import { useState, useEffect } from "react";
import {
  getHighestPriorityTask,
  markTaskDone,
  markTaskUndone,
  deleteTask,
  updateTask,
  getAllUncompletedTasks,
  getAllTasks,
} from "../utils/taskOperations";
import { Task, MetadataChanges } from "../types";

export const useTasks = (preferences: Preferences) => {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [topTask, setTopTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const highestPriorityTask = await getHighestPriorityTask();
      setTopTask(highestPriorityTask);

      const includeCompleted = preferences.showCompletedTasks;
      let tasks = includeCompleted
        ? await getAllTasks()
        : await getAllUncompletedTasks();

      if (preferences.showOnlyCurrent) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        tasks = tasks.filter((task) => {
          const { dueDate, scheduledDate } = task;
          return (
            (dueDate && dueDate < tomorrow) ||
            (scheduledDate && scheduledDate < tomorrow)
          );
        });
      }

      // Collect unique tags and files for filtering
      const tagSet = new Set<string>();
      const fileSet = new Set<string>();
      for (const task of tasks) {
        task.tags?.forEach((t) => tagSet.add(t));
        const fileName = task.source.filePath.split("/").pop() || "";
        fileSet.add(fileName);
      }
      setAvailableTags(Array.from(tagSet).sort());
      setAvailableFiles(Array.from(fileSet).sort());

      setAllTasks(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTopTask(null);
      setAllTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTaskList = async () => {
    await fetchTasks();
  };

  const handleMarkDone = async (task: Task | null) => {
    if (!task) return;
    if (task.completed) {
      await markTaskUndone(task);
    } else {
      await markTaskDone(task);
    }
    await refreshTaskList();
  };

  const handleDeleteTask = async (task: Task) => {
    await deleteTask(task);
    await refreshTaskList();
  };

  const handleUpdateTask = async (task: Task, changes: MetadataChanges) => {
    await updateTask(task, changes);
    await refreshTaskList();
  };

  useEffect(() => {
    fetchTasks();

    const refreshIntervalInMinutes =
      parseInt(preferences.refreshIntervalInMinutes) || 1;
    const interval = setInterval(
      fetchTasks,
      refreshIntervalInMinutes * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, []);

  return {
    allTasks,
    topTask,
    isLoading,
    availableTags,
    availableFiles,
    refreshTaskList,
    handleMarkDone,
    handleDeleteTask,
    handleUpdateTask,
  };
};
