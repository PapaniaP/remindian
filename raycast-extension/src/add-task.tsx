import { useState, useEffect } from "react";
import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  getPreferenceValues,
} from "@raycast/api";
import { Priority } from "./types";
import { addTask } from "./utils/taskOperations";
import { ICONS } from "./constants";
import fs from "fs-extra";
import path from "path";

export default function Command() {
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [priority, setPriority] = useState<Priority | "">("");
  const [tags, setTags] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [targetFile, setTargetFile] = useState("");
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const preferences = getPreferenceValues<Preferences>();

  useEffect(() => {
    // Load available .md files from vault for the target file picker
    const loadFiles = async () => {
      try {
        const vaultPath = preferences.vaultPath;
        const inboxFile = preferences.inboxFilePath || "Inbox.md";
        setTargetFile(inboxFile);

        // Collect top-level .md files and common task locations
        const entries = await fs.readdir(vaultPath, { withFileTypes: true });
        const mdFiles: string[] = [];
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith(".md")) {
            mdFiles.push(entry.name);
          }
        }
        // Ensure inbox file is in the list
        if (!mdFiles.includes(inboxFile)) {
          mdFiles.unshift(inboxFile);
        }
        setAvailableFiles(mdFiles);
      } catch (error) {
        console.error("Error loading files:", error);
      }
    };
    loadFiles();
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Description is required",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addTask({
        description,
        priority: priority || undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        recurrence: recurrence || undefined,
        targetFilePath: targetFile || undefined,
      });

      // Reset form
      setDescription("");
      setDueDate(null);
      setScheduledDate(null);
      setStartDate(null);
      setPriority("");
      setTags("");
      setRecurrence("");
    } catch (error) {
      console.error("Error adding task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearDates = () => {
    setDueDate(null);
    setScheduledDate(null);
    setStartDate(null);
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Task" onSubmit={handleSubmit} />
          <Action title="Clear Dates" onAction={handleClearDates} />
        </ActionPanel>
      }
      isLoading={isSubmitting}
    >
      <Form.TextField
        id="description"
        title="Description"
        placeholder="Enter task description"
        value={description}
        onChange={setDescription}
        autoFocus
      />

      <Form.Dropdown
        id="targetFile"
        title="Target File"
        value={targetFile}
        onChange={setTargetFile}
      >
        {availableFiles.map((f) => (
          <Form.Dropdown.Item
            key={f}
            value={f}
            title={f.replace(".md", "")}
          />
        ))}
      </Form.Dropdown>

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
        onChange={setDueDate}
      />

      <Form.DatePicker
        id="scheduledDate"
        title={`${ICONS.DATE.SCHEDULED}  Scheduled Date`}
        value={scheduledDate}
        onChange={setScheduledDate}
      />

      <Form.DatePicker
        id="startDate"
        title={`${ICONS.DATE.START}  Start Date`}
        value={startDate}
        onChange={setStartDate}
      />

      <Form.TextField
        id="recurrence"
        title={`${ICONS.RECURRING}  Recurrence`}
        placeholder="e.g., every day, every week on Monday"
        value={recurrence}
        onChange={setRecurrence}
        info="Use natural language for recurring tasks, such as 'every day' or 'every week on Monday'"
      />

      <Form.TextField
        id="tags"
        title="Tags"
        placeholder="Enter comma-separated tags"
        value={tags}
        onChange={setTags}
        info="Enter tags separated by commas, e.g., work, personal, urgent"
      />
    </Form>
  );
}
