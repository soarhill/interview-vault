"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { ManualCopyDialog } from "@/components/detail/manual-copy-dialog";

const CopyContext = createContext<((text: string) => Promise<boolean>) | null>(
  null,
);
export function CopyProvider({ children }: { children: ReactNode }) {
  const [manualText, setManualText] = useState<string | null>(null);
  async function copy(text: string): Promise<boolean> {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      setManualText(text);
      return false;
    }
  }
  return (
    <CopyContext.Provider value={copy}>
      {children}
      {manualText !== null && (
        <ManualCopyDialog
          text={manualText}
          onClose={() => setManualText(null)}
        />
      )}
    </CopyContext.Provider>
  );
}
export function useCopy() {
  const copy = useContext(CopyContext);
  if (!copy) throw new Error("CopyProvider is required");
  return copy;
}
