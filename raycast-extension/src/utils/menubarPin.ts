import { LocalStorage } from "@raycast/api";

export type MenubarPin =
  | { type: "tag"; value: string }
  | { type: "file"; value: string }
  | { type: "task"; value: string }
  | null;

const STORAGE_KEY = "menubar-pin";

export async function getMenubarPin(): Promise<MenubarPin> {
  const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MenubarPin;
  } catch {
    return null;
  }
}

export async function setMenubarPin(pin: MenubarPin): Promise<void> {
  if (pin === null) {
    await LocalStorage.removeItem(STORAGE_KEY);
  } else {
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(pin));
  }
}

export async function clearMenubarPin(): Promise<void> {
  await LocalStorage.removeItem(STORAGE_KEY);
}
