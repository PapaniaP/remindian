/**
 * Centralized settings reader.
 * Reads from LocalStorage (set by the setup wizard) first,
 * falling back to Raycast preferences.
 */

import { getPreferenceValues, LocalStorage } from "@raycast/api";

export interface AppSettings {
  vaultPath: string;
  excludedFolders: string[];
  includedFolders: string[];
  inboxFilePath: string;
  showCompletedTasks: boolean;
  showOnlyCurrent: boolean;
}

export async function getSettings(): Promise<AppSettings> {
  const preferences = getPreferenceValues<Preferences>();

  const excludedFoldersStr =
    (await LocalStorage.getItem<string>("excludedFolders")) ??
    preferences.excludedFolders ??
    ".obsidian,.git,.trash";

  const includedFoldersStr =
    (await LocalStorage.getItem<string>("includedFolders")) ??
    preferences.includedFolders ??
    "";

  const inboxFilePath =
    (await LocalStorage.getItem<string>("inboxFilePath")) ??
    preferences.inboxFilePath ??
    "";

  return {
    vaultPath: preferences.vaultPath,
    excludedFolders: excludedFoldersStr
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean),
    includedFolders: includedFoldersStr
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean),
    inboxFilePath,
    showCompletedTasks: preferences.showCompletedTasks || false,
    showOnlyCurrent: preferences.showOnlyCurrent || false,
  };
}

export async function getInboxFilePath(): Promise<string> {
  const preferences = getPreferenceValues<Preferences>();
  return (
    (await LocalStorage.getItem<string>("inboxFilePath")) ??
    preferences.inboxFilePath ??
    ""
  );
}
