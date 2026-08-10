"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, PenLine } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading canvas…
      </div>
    ),
  },
);

const EMPTY_SCENE = {
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
};

const DEFAULT_BOARD_NAME = "untitled board";

function normalizeScene(scene) {
  if (!scene || typeof scene !== "object") {
    return EMPTY_SCENE;
  }

  return {
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    appState: scene.appState ?? { viewBackgroundColor: "#ffffff" },
    files: scene.files ?? {},
  };
}

function buildScenePayload(scene) {
  const elements = scene.elements || [];
  if (elements.length === 0) {
    return null;
  }

  return {
    elements,
    appState: {
      viewBackgroundColor:
        scene.appState?.viewBackgroundColor || "#ffffff",
    },
    files: scene.files || {},
  };
}

function hasScribbleContent(scribble) {
  return Boolean(scribble?.elements?.length);
}

function formatUpdatedAt(timestamp) {
  if (!timestamp) return "Not updated yet";
  return new Date(Number(timestamp)).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ImportScribbleDialog({ open, onOpenChange, token, onImport }) {
  const [scribbles, setScribbles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !token) return;

    let alive = true;
    setLoading(true);
    setError("");

    apiGet("/scribble", { token })
      .then((data) => {
        if (!alive) return;
        setScribbles(data.scribbles || []);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || "Could not load scribble boards.");
        setScribbles([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, token]);

  async function handleSelect(scribble) {
    if (!token || importingId) return;

    setImportingId(scribble.scribble_id);
    setError("");
    try {
      const data = await apiGet(`/scribble/${scribble.scribble_id}`, { token });
      onImport?.(normalizeScene(data.scribble?.scene));
      onOpenChange?.(false);
    } catch (err) {
      setError(err.message || "Could not import scribble.");
    } finally {
      setImportingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(80vh,calc(100dvh-1.5rem),560px)] w-[min(96vw,520px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-14">
          <DialogTitle>Import scribble</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading boards…
            </p>
          ) : scribbles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No scribble boards found. Create one from the Scribble button first.
            </p>
          ) : (
            <ul className="space-y-2">
              {scribbles.map((scribble) => (
                <li key={scribble.scribble_id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(scribble)}
                    disabled={importingId === scribble.scribble_id}
                    className="flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
                  >
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-md border"
                      style={{
                        backgroundColor: scribble.preview_color || "#ffffff",
                      }}
                    >
                      <PenLine className="size-4 text-muted-foreground/70" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {scribble.name || DEFAULT_BOARD_NAME}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatUpdatedAt(scribble.updated_at)}
                        {scribble.element_count > 0
                          ? ` · ${scribble.element_count} element${scribble.element_count === 1 ? "" : "s"}`
                          : " · Empty board"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {importingId === scribble.scribble_id
                        ? "Importing…"
                        : "Select"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error ? (
          <p className="border-t px-4 py-3 text-xs text-destructive">{error}</p>
        ) : null}
        <DialogFooter className="shrink-0 border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            disabled={Boolean(importingId)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TaskDrawDialog({
  projectId,
  taskId,
  taskName,
  token,
  scribble,
  open,
  onOpenChange,
  onSaved,
}) {
  const sceneRef = useRef(EMPTY_SCENE);
  const [initialData, setInitialData] = useState(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setImportOpen(false);
      return;
    }

    const scene = normalizeScene(scribble);
    sceneRef.current = scene;
    setInitialData(scene);
    setCanvasKey((k) => k + 1);
    setError("");
  }, [open, scribble]);

  const onChange = useCallback((elements, appState, files) => {
    sceneRef.current = { elements, appState, files };
  }, []);

  function handleImport(scene) {
    sceneRef.current = scene;
    setInitialData(scene);
    setCanvasKey((k) => k + 1);
    setError("");
  }

  async function handleSave() {
    if (!token || !projectId || !taskId || saving) return;

    setSaving(true);
    setError("");
    try {
      const data = await apiPatch(
        `/projects/${projectId}/tasks/${taskId}`,
        { scribble: buildScenePayload(sceneRef.current) },
        { token },
      );
      onSaved?.(data.task);
      onOpenChange?.(false);
    } catch (err) {
      setError(err.message || "Could not save scribble.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex h-[min(88vh,calc(100dvh-1.5rem))] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          showCloseButton
        >
          <DialogHeader className="shrink-0 border-b px-4 py-3 pr-14">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <DialogTitle className="truncate">
                Scribble — {taskName || `Task #${taskId}`}
              </DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setImportOpen(true)}
                disabled={!token || saving}
              >
                <Download data-icon="inline-start" />
                Import scribble
              </Button>
            </div>
          </DialogHeader>
          <div className="relative min-h-0 flex-1 [&_.excalidraw]:!h-full [&_.excalidraw-container]:!h-full">
            {open && initialData ? (
              <Excalidraw
                key={canvasKey}
                initialData={initialData}
                onChange={onChange}
              />
            ) : null}
          </div>
          <DialogFooter className="shrink-0 border-t px-4 py-3 sm:justify-between">
            {error ? (
              <p className="text-xs text-destructive sm:mr-auto">{error}</p>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange?.(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !token}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportScribbleDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        token={token}
        onImport={handleImport}
      />
    </>
  );
}

export function DrawCell({
  projectId,
  taskId,
  taskName,
  token,
  scribble,
  onSaved,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [hasScribble, setHasScribble] = useState(() =>
    hasScribbleContent(scribble),
  );

  useEffect(() => {
    setHasScribble(hasScribbleContent(scribble));
  }, [scribble]);

  if (disabled || !taskId) {
    return (
      <div className="flex justify-center">
        <PenLine className="size-3.5 text-muted-foreground/25" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "relative inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground",
            hasScribble ? "text-primary" : "text-muted-foreground",
          )}
          aria-label="Open scribble board"
          title={hasScribble ? "Edit scribble" : "Add scribble"}
        >
          <PenLine className="size-3.5" />
          {hasScribble ? (
            <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-primary" />
          ) : null}
        </button>
      </div>
      <TaskDrawDialog
        projectId={projectId}
        taskId={taskId}
        taskName={taskName}
        token={token}
        scribble={scribble}
        open={open}
        onOpenChange={setOpen}
        onSaved={(task) => {
          setHasScribble(hasScribbleContent(task?.scribble));
          onSaved?.(task);
        }}
      />
    </>
  );
}
