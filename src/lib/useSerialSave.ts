"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Optimistic local value persisted with strictly ordered saves.
 *
 * - `commit(next)` applies instantly; saves run one after another, so a slow
 *   older request can never land after (and overwrite) a newer choice.
 * - A failed save reverts to the last value the server actually accepted —
 *   and only if no newer commit has happened since.
 * - Fresh server values are adopted only while nothing is pending, so a
 *   refresh triggered by an older save can't snap the UI back mid-sequence.
 */
export function useSerialSave<T>(
  serverValue: T,
  save: (value: T) => Promise<void>,
  equals: (a: T, b: T) => boolean = Object.is,
) {
  const [value, setValue] = useState(serverValue);
  const lastSaved = useRef(serverValue);
  const seq = useRef(0);
  const pending = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const serverRef = useRef(serverValue);
  useEffect(() => {
    if (equals(serverRef.current, serverValue)) return;
    serverRef.current = serverValue;
    if (pending.current > 0) return;
    lastSaved.current = serverValue;
    setValue(serverValue);
  }, [serverValue, equals]);

  const commit = useCallback((next: T) => {
    const mine = ++seq.current;
    pending.current++;
    setValue(next);
    chain.current = chain.current
      .then(() => saveRef.current(next))
      .then(
        () => {
          lastSaved.current = next;
        },
        (err) => {
          console.error("[serial-save] failed:", err);
          if (mine === seq.current) setValue(lastSaved.current);
        },
      )
      .finally(() => {
        pending.current--;
      });
  }, []);

  return [value, commit] as const;
}
