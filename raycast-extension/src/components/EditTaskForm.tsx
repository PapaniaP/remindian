import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { updateTask } from "../utils/taskOperations";
import { Task, Priority, MetadataChanges } from "../types";
import { ICONS } from "../constants";
import { getCleanTitle } from "../utils/taskParser";
import path from "path";

interface EditTaskFormProps {
  task: Task;
  onTaskUpdated: () => void;
}

export function EditTaskForm({ task, onTaskUpdated }: EditTaskFormProps) {
  const [dueDate, setDueDate] = useState<Date | undefined>(task.dueDate);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    task.scheduledDate,
  );
  const [startDate, setStartDate] = useState<Date | undefined>(task.startDate);
  const [priority, setPriority] = useState<Priority | "">(
    task.priority || "",
  );
  const [isCompleted, setIsCompleted] = useState(task.completed);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { pop } = useNavigation();

  const fileName = task.source.filePath.split("/").pop() || "";

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Build a MetadataChanges diff — only include fields that actually changed
      const changes: MetadataChanges = {};

      const datesEqual = (a?: Date, b?: Date) => {
        if (!a && !b) return true;
        if (!a || !b) return false;
        return a.toDateString() === b.toDateString();
      };

      if (!datesEqual(dueDate, task.dueDate)) {
        changes.newDueDate = dueDate || null;
      }
      if (!datesEqual(scheduledDate, task.scheduledDate)) {
        changes.newScheduledDate = scheduledDate || null;
      }
      if (!datesEqual(startDate, task.startDate)) {
        changes.newStartDate = startDate || null;
      }

      const newPriority = priority || undefined;
      if (newPriority !== task.priority) {
        changes.newPriority = newPriority;
      }

      // Handle completion status change via surgical editor
      const { markTaskDone, markTaskUndone } = await import(
        "../utils/taskOperations"
      );
      if (isCompleted !== task.completed) {
        if (isCompleted) {
          await markTaskDone(task);
        } else {
          await markTaskUndone(task);
        }
      }

      // Apply metadata changes if any
      const hasMetadataChanges =
        changes.newDueDate !== undefined ||
        changes.newStartDate !== undefined ||
        changes.newScheduledDate !== undefined ||
        changes.newPriority !== undefined;

      if (hasMetadataChanges) {
        await updateTask(task, changes);
      }

      await showToast({ style: Toast.Style.Success, title: "Task updated" });
      onTaskUpdated();
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to update task",
        message: String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearDates = () => {
    setDueDate(undefined);
    setScheduledDate(undefined);
    setStartDate(undefined);
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Update Task" onSubmit={handleSubmit} />
          <Action title="Clear Dates" onAction={handleClearDates} />
        </ActionPanel>
      }
      isLoading={isSubmitting}
    >
      <Form.Description
        title="Task"
        text={getCleanTitle(task)}
      />

      <Form.Description title="File" text={fileName} />

      {task.clientName && (
        <Form.Description title="Client" text={task.clientName} />
      )}

      <Form.Dropdown
        id="priority"
        title="Priority"
        value={priority}
        onChange={(newValue) => setPriority(newValue as Priority | "")}
      >
        <Form.Dropdown.Item value="" title="No Priority" />
        <Form.Dropdown.Item
          value={Priority.HIGHEST}
          title={`${ICONS.PRIORITY.HIGHEST}  Highest`}
        />
        <Form.Dropdown.Item
          value={Priority.HIGH}
          title={`${ICONS.PRIORITY.HIGH}  High`}
        />
        <Form.Dropdown.Item
          value={Priority.MEDIUM}
          title={`${ICONS.PRIORITY.MEDIUM}  Medium`}
        />
        <Form.Dropdown.Item
          value={Priority.LOW}
          title={`${ICONS.PRIORITY.LOW}  Low`}
        />
        <Form.Dropdown.Item
          value={Priority.LOWEST}
          title={`${ICONS.PRIORITY.LOWEST}  Lowest`}
        />
      </Form.Dropdown>

      <Form.DatePicker
        id="dueDate"
        title={`${ICONS.DATE.DUE}  Due Date`}
        value={dueDate}
        onChange={(d) => setDueDate(d ?? undefined)}
      />

      <Form.DatePicker
        id="scheduledDate"
        title={`${ICONS.DATE.SCHEDULED}  Scheduled Date`}
        value={scheduledDate}
        onChange={(d) => setScheduledDate(d ?? undefined)}
      />

      <Form.DatePicker
        id="startDate"
        title={`${ICONS.DATE.START}  Start Date`}
        value={startDate}
        onChange={(d) => setStartDate(d ?? undefined)}
      />

      <Form.Checkbox
        id="completed"
        title="Completed"
        label="Mark as completed"
        value={isCompleted}
        onChange={setIsCompleted}
      />

      {task.tags && task.tags.length > 0 && (
        <Form.Description
          title="Tags"
          text={task.tags.join(", ")}
        />
      )}

      {task.recurrence && (
        <Form.Description
          title="Recurrence"
          text={task.recurrence}
        />
      )}

      <Form.Description
        title=""
        text="To edit description, tags, or recurrence, use 'Open in Obsidian'."
      />
    </Form>
  );
}
