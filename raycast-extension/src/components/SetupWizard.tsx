import { useState, useEffect } from "react";
import {
  Form,
  ActionPanel,
  Action,
  Icon,
  getPreferenceValues,
  showToast,
  Toast,
} from "@raycast/api";
import fs from "fs-extra";
import { SetupSettings } from "../hooks/useSetup";

const COMMON_EXCLUDED = new Set([
  ".obsidian",
  ".git",
  ".trash",
  "node_modules",
  ".DS_Store",
  "templates",
  ".stfolder",
  ".stversions",
]);

const INBOX_CANDIDATES = [
  "Inbox.md",
  "inbox.md",
  "TODO.md",
  "todo.md",
  "Tasks.md",
  "tasks.md",
];

interface SetupWizardProps {
  onComplete: (settings: SetupSettings) => Promise<void>;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [mdFiles, setMdFiles] = useState<string[]>([]);
  const [excludedFolders, setExcludedFolders] = useState<string[]>([]);
  const [includedFolders, setIncludedFolders] = useState<string[]>([]);
  const [inboxFile, setInboxFile] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const preferences = getPreferenceValues<Preferences>();
  const vaultPath = preferences.vaultPath;

  useEffect(() => {
    const scan = async () => {
      try {
        const entries = await fs.readdir(vaultPath, { withFileTypes: true });
        const foundFolders: string[] = [];
        const foundFiles: string[] = [];

        for (const entry of entries) {
          if (entry.isDirectory()) {
            foundFolders.push(entry.name);
          } else if (entry.isFile() && entry.name.endsWith(".md")) {
            foundFiles.push(entry.name);
          }
        }

        setFolders(foundFolders.sort());
        setMdFiles(foundFiles.sort());

        // Auto-suggest excluded folders: known system dirs + hidden dirs
        const autoExcluded = foundFolders.filter(
          (f) => COMMON_EXCLUDED.has(f) || f.startsWith("."),
        );
        setExcludedFolders(autoExcluded);

        // Auto-suggest inbox file if a common candidate exists
        const suggestedInbox = INBOX_CANDIDATES.find((c) =>
          foundFiles.includes(c),
        );
        if (suggestedInbox) {
          setInboxFile(suggestedInbox);
        }
      } catch (error) {
        console.error("Error scanning vault:", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to scan vault",
          message: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    };
    scan();
  }, []);

  const handleSubmit = async () => {
    await onComplete({
      excludedFolders: excludedFolders.join(","),
      includedFolders: includedFolders.join(","),
      inboxFilePath: inboxFile,
    });
    await showToast({ style: Toast.Style.Success, title: "Setup complete" });
  };

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Complete Setup"
            onSubmit={handleSubmit}
            icon={Icon.Check}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Welcome to Remindian"
        text={`Scanning your vault at: ${vaultPath}\n\nConfigure which folders to scan and where new tasks go.`}
      />

      <Form.Separator />

      <Form.TagPicker
        id="excludedFolders"
        title="Excluded Folders"
        value={excludedFolders}
        onChange={setExcludedFolders}
        info="Folders to skip when scanning for tasks. Common system folders are pre-selected."
      >
        {folders.map((f) => (
          <Form.TagPicker.Item key={f} value={f} title={f} />
        ))}
      </Form.TagPicker>

      <Form.TagPicker
        id="includedFolders"
        title="Whitelist Folders"
        value={includedFolders}
        onChange={setIncludedFolders}
        info="If set, ONLY these folders will be scanned. Leave empty to scan the entire vault (minus excluded folders)."
      >
        {folders
          .filter((f) => !excludedFolders.includes(f))
          .map((f) => (
            <Form.TagPicker.Item key={f} value={f} title={f} />
          ))}
      </Form.TagPicker>

      <Form.Separator />

      <Form.Dropdown
        id="inboxFile"
        title="Inbox File"
        value={inboxFile}
        onChange={setInboxFile}
        info="The file where new tasks are added via Add Task. Select 'None' to disable the Add Task command."
      >
        <Form.Dropdown.Item
          value=""
          title="None (disable Add Task)"
          icon={Icon.XMarkCircle}
        />
        {mdFiles.map((f) => (
          <Form.Dropdown.Item key={f} value={f} title={f.replace(".md", "")} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
