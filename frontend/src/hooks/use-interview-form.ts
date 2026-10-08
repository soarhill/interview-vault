"use client";
import { useState } from "react";
import type { InterviewChangePayload } from "@/lib/api/types";
import {
  editorPayload,
  editorValueFromPayload,
  type InterviewEditorValue,
} from "@/components/submission/form-model";

export function useInterviewForm(initialPayload: InterviewChangePayload) {
  const [value, setValue] = useState(() =>
    editorValueFromPayload(initialPayload),
  );
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(editorPayload(value)),
  );
  const payload = editorPayload(value);
  return {
    value,
    setValue,
    payload,
    dirty: JSON.stringify(payload) !== baseline,
    markSaved(canonical: InterviewChangePayload) {
      setValue((previous: InterviewEditorValue) =>
        editorValueFromPayload(canonical, previous),
      );
      setBaseline(JSON.stringify(canonical));
    },
    markClean() {
      setBaseline(JSON.stringify(payload));
    },
  };
}
