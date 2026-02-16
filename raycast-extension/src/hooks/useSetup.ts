import { useState, useEffect } from "react";
import { LocalStorage } from "@raycast/api";

export interface SetupSettings {
  excludedFolders: string;
  includedFolders: string;
  inboxFilePath: string;
}

export function useSetup() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    LocalStorage.getItem<string>("setupComplete").then((value) => {
      setIsSetupComplete(value === "true");
    });
  }, []);

  const completeSetup = async (settings: SetupSettings) => {
    await LocalStorage.setItem("excludedFolders", settings.excludedFolders);
    await LocalStorage.setItem("includedFolders", settings.includedFolders);
    await LocalStorage.setItem("inboxFilePath", settings.inboxFilePath);
    await LocalStorage.setItem("setupComplete", "true");
    setIsSetupComplete(true);
  };

  const resetSetup = async () => {
    await LocalStorage.removeItem("excludedFolders");
    await LocalStorage.removeItem("includedFolders");
    await LocalStorage.removeItem("inboxFilePath");
    await LocalStorage.removeItem("setupComplete");
    setIsSetupComplete(false);
  };

  return { isSetupComplete, completeSetup, resetSetup };
}
