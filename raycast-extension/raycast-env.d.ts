/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Obsidian Vault Path - Path to your Obsidian vault root directory */
  "vaultPath": string,
  /** Excluded Folders - Comma-separated folder names to skip (e.g., .obsidian,.git,.trash,Archive). Overridden by the setup wizard. */
  "excludedFolders": string,
  /** Included Folders (Whitelist) - If set, ONLY scan these folders. Leave empty to scan entire vault. Overridden by the setup wizard. */
  "includedFolders": string,
  /** Inbox File - Relative path within vault for new tasks (e.g., Inbox.md). Leave empty to disable Add Task. Overridden by the setup wizard. */
  "inboxFilePath": string,
  /** Show Completed Tasks - Include completed tasks in the list view */
  "showCompletedTasks": boolean,
  /** Sort by Priority - Sort tasks by priority */
  "sortByPriority": boolean,
  /** Show Only Current Tasks - Show only tasks with a due or scheduled date that is today or earlier */
  "showOnlyCurrent": boolean,
  /** Show Due Date in Menubar - Display the due date of tasks in the menubar */
  "showDueDate": boolean,
  /** Show Task Count in Menubar - Show the number of tasks in the menubar */
  "menubarTaskCount": boolean,
  /** Show Icon in Menubar - Show the icon of tasks in the menubar */
  "showIcon": boolean,
  /** Max Description Length - Maximum length of task description to show in menubar */
  "maxMenubarDescriptionLength": string,
  /** Refresh Interval - Refresh interval in minutes */
  "refreshIntervalInMinutes": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `list-tasks` command */
  export type ListTasks = ExtensionPreferences & {}
  /** Preferences accessible in the `add-task` command */
  export type AddTask = ExtensionPreferences & {}
  /** Preferences accessible in the `edit-task` command */
  export type EditTask = ExtensionPreferences & {}
  /** Preferences accessible in the `mark-done` command */
  export type MarkDone = ExtensionPreferences & {}
  /** Preferences accessible in the `menubar-item` command */
  export type MenubarItem = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `list-tasks` command */
  export type ListTasks = {}
  /** Arguments passed to the `add-task` command */
  export type AddTask = {}
  /** Arguments passed to the `edit-task` command */
  export type EditTask = {
  /** Task ID */
  "taskId": string
}
  /** Arguments passed to the `mark-done` command */
  export type MarkDone = {}
  /** Arguments passed to the `menubar-item` command */
  export type MenubarItem = {}
}

