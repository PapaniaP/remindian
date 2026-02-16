import { Detail, ActionPanel, Action, Icon, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { Task } from "../types";
import fs from "fs-extra";
import path from "path";

interface FilePreviewProps {
  task: Task;
}

export function FilePreview({ task }: FilePreviewProps) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const preferences = getPreferenceValues<Preferences>();
  const vaultName = path.basename(preferences.vaultPath);
  const relPath = path.relative(preferences.vaultPath, task.source.filePath);

  useEffect(() => {
    const loadFile = async () => {
      try {
        const content = await fs.readFile(task.source.filePath, "utf-8");
        const lines = content.split("\n");
        const highlighted = lines.map((line, i) => {
          if (i === task.source.lineNumber) {
            return `---\n> **${line}**\n---`;
          }
          return line;
        });
        setMarkdown(highlighted.join("\n"));
      } catch (error) {
        setMarkdown(`*Error reading file: ${error}*`);
      }
    };
    loadFile();
  }, [task.source.filePath, task.source.lineNumber]);

  return (
    <Detail
      isLoading={markdown === null}
      markdown={markdown || ""}
      navigationTitle={relPath}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser
            title="Open in Obsidian"
            url={`obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relPath.replace(/\.md$/, ""))}`}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
          />
          <Action.CopyToClipboard
            title="Copy File Path"
            content={task.source.filePath}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}
