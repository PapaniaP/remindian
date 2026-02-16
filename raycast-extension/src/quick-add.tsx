import { LaunchProps, showToast, Toast, closeMainWindow } from "@raycast/api";
import { parseTaskFromLine } from "./utils/taskParser";
import { addTask } from "./utils/taskOperations";
import { getInboxFilePath } from "./utils/settings";

export default async function Command(
  props: LaunchProps<{ arguments: { description: string } }>,
) {
  const { description } = props.arguments;

  if (!description.trim()) {
    await showToast({ style: Toast.Style.Failure, title: "Description is required" });
    return;
  }

  const inboxPath = await getInboxFilePath();
  if (!inboxPath) {
    await showToast({
      style: Toast.Style.Failure,
      title: "No inbox file configured",
      message: "Run the setup wizard to set an inbox file.",
    });
    return;
  }

  // Parse the input as if it were a task line to extract metadata
  const fakeLine = `- [ ] ${description}`;
  const parsed = parseTaskFromLine(fakeLine, "", 0);

  if (!parsed) {
    // Fallback: just use the raw description
    await addTask({ description });
  } else {
    await addTask({
      description: parsed.cleanTitle,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      scheduledDate: parsed.scheduledDate,
      startDate: parsed.startDate,
      tags: parsed.tags,
      recurrence: parsed.recurrence,
    });
  }

  await closeMainWindow();
}
