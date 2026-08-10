"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, PenLine, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
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
  return {
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    appState: {
      viewBackgroundColor:
        scene.appState?.viewBackgroundColor || "#ffffff",
    },
    files: scene.files || {},
  };
}

function formatUpdatedAt(timestamp) {
  if (!timestamp) return "Not updated yet";
  return new Date(Number(timestamp)).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ScribbleBoardPicker({
  token,
  scribbles,
  loading,
  deletingId,
  error,
  onSelect,
  onCreate,
  onDelete,
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Loading boards…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <button
              type="button"
              onClick={onCreate}
              disabled={!token}
              className="group text-left"
            >
              <Card className="h-full border-dashed transition-colors hover:border-primary/40 hover:bg-muted/30">
                <CardContent className="flex h-36 flex-col items-center justify-center gap-2 pt-6">
                  <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
                    <Plus className="size-5" />
                  </div>
                  <CardTitle className="text-sm font-medium">New board</CardTitle>
                </CardContent>
              </Card>
            </button>

            {scribbles.map((scribble) => (
              <div key={scribble.scribble_id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(scribble.scribble_id)}
                  disabled={deletingId === scribble.scribble_id}
                  className="w-full text-left"
                >
                  <Card className="h-full transition-colors hover:border-primary/30 hover:bg-muted/20">
                    <CardContent className="flex h-36 flex-col gap-3 pt-4">
                      <div
                        className="flex min-h-0 flex-1 items-center justify-center rounded-lg border"
                        style={{
                          backgroundColor: scribble.preview_color || "#ffffff",
                        }}
                      >
                        {scribble.element_count > 0 ? (
                          <PenLine className="size-5 text-muted-foreground/70" />
                        ) : (
                          <span className="text-xs text-muted-foreground/70">
                            Empty board
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 pr-8">
                        <CardTitle className="truncate text-sm">
                          {scribble.name || DEFAULT_BOARD_NAME}
                        </CardTitle>
                        <CardDescription className="truncate text-xs">
                          {formatUpdatedAt(scribble.updated_at)}
                        </CardDescription>
                      </div>
                    </CardContent>
                  </Card>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-2 right-2 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  disabled={!token || deletingId === scribble.scribble_id}
                  aria-label={`Delete ${scribble.name || DEFAULT_BOARD_NAME}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(scribble);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      {error ? (
        <p className="border-t px-4 py-3 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function ScribbleBoardEditor({
  token,
  scribbleId,
  isNewBoard,
  onBack,
  onSaved,
  onDelete,
}) {
  const sceneRef = useRef(EMPTY_SCENE);
  const [initialData, setInitialData] = useState(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [boardName, setBoardName] = useState(DEFAULT_BOARD_NAME);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    if (isNewBoard) {
      sceneRef.current = EMPTY_SCENE;
      setInitialData(EMPTY_SCENE);
      setBoardName(DEFAULT_BOARD_NAME);
      setCanvasKey((k) => k + 1);
      setError("");
      return;
    }

    if (!scribbleId) return;

    let alive = true;
    setLoading(true);
    setError("");

    apiGet(`/scribble/${scribbleId}`, { token })
      .then((data) => {
        if (!alive) return;
        const scene = normalizeScene(data.scribble?.scene);
        sceneRef.current = scene;
        setInitialData(scene);
        setBoardName(data.scribble?.name?.trim() || DEFAULT_BOARD_NAME);
        setCanvasKey((k) => k + 1);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || "Could not load board.");
        sceneRef.current = EMPTY_SCENE;
        setInitialData(EMPTY_SCENE);
        setBoardName(DEFAULT_BOARD_NAME);
        setCanvasKey((k) => k + 1);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [token, scribbleId, isNewBoard]);

  const onChange = useCallback((elements, appState, files) => {
    sceneRef.current = { elements, appState, files };
  }, []);

  async function handleSave() {
    if (!token || saving) return;
    if (!isNewBoard && !scribbleId) return;

    setSaving(true);
    setError("");
    try {
      const payload = {
        scene: buildScenePayload(sceneRef.current),
        name: boardName.trim() || DEFAULT_BOARD_NAME,
      };

      if (isNewBoard) {
        await apiPost("/scribble", payload, { token });
      } else {
        await apiPut(`/scribble/${scribbleId}`, payload, { token });
      }

      onSaved?.();
    } catch (err) {
      setError(err.message || "Could not save board.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !scribbleId || isNewBoard || deleting || saving) return;

    const confirmed = window.confirm(
      `Delete "${boardName.trim() || DEFAULT_BOARD_NAME}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    try {
      await apiDelete(`/scribble/${scribbleId}`, { token });
      onDelete?.();
    } catch (err) {
      setError(err.message || "Could not delete board.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 border-b px-4 py-3 pr-14">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            disabled={saving || deleting}
            aria-label="Back to boards"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <DialogTitle className="sr-only">Edit scribble board</DialogTitle>
          <input
            value={boardName}
            onChange={(event) => setBoardName(event.target.value)}
            placeholder={DEFAULT_BOARD_NAME}
            className="min-w-0 flex-1 rounded-md bg-transparent text-base font-semibold outline-none focus:ring-1 focus:ring-ring"
            aria-label="Board name"
          />
          {!isNewBoard ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              disabled={deleting || saving || loading}
              className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete board"
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </DialogHeader>
      <div className="relative min-h-0 flex-1 [&_.excalidraw]:!h-full [&_.excalidraw-container]:!h-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading board…
          </div>
        ) : null}
        {initialData && !loading ? (
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
            onClick={onBack}
            disabled={saving || deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting || loading || !token}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

export function PersonalScribbleDialog({ token, open, onOpenChange }) {
  const [view, setView] = useState("list");
  const [activeScribbleId, setActiveScribbleId] = useState(null);
  const [isNewBoard, setIsNewBoard] = useState(false);
  const [scribbles, setScribbles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const loadScribbles = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");
    try {
      const data = await apiGet("/scribble", { token });
      setScribbles(data.scribbles || []);
    } catch (err) {
      setError(err.message || "Could not load boards.");
      setScribbles([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!open) {
      setView("list");
      setActiveScribbleId(null);
      setIsNewBoard(false);
      setError("");
      return;
    }

    loadScribbles();
  }, [open, loadScribbles]);

  function handleCreateBoard() {
    setActiveScribbleId(null);
    setIsNewBoard(true);
    setView("editor");
    setError("");
  }

  function handleOpenBoard(scribbleId) {
    setActiveScribbleId(scribbleId);
    setIsNewBoard(false);
    setView("editor");
    setError("");
  }

  function handleBackToList() {
    setView("list");
    setActiveScribbleId(null);
    setIsNewBoard(false);
    setError("");
    loadScribbles();
  }

  async function handleDeleteBoard(scribble) {
    if (!token || !scribble?.scribble_id || deletingId) return;

    const boardName = scribble.name?.trim() || DEFAULT_BOARD_NAME;
    const confirmed = window.confirm(
      `Delete "${boardName}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(scribble.scribble_id);
    setError("");
    try {
      await apiDelete(`/scribble/${scribble.scribble_id}`, { token });
      setScribbles((prev) =>
        prev.filter((item) => item.scribble_id !== scribble.scribble_id),
      );
    } catch (err) {
      setError(err.message || "Could not delete board.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleDeletedFromEditor() {
    setView("list");
    setActiveScribbleId(null);
    setIsNewBoard(false);
    setError("");
    loadScribbles();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 sm:max-w-none",
          view === "editor"
            ? "h-[min(88vh,calc(100dvh-1.5rem))] w-[96vw] max-w-[96vw]"
            : "h-[min(80vh,720px,calc(100dvh-1.5rem))] w-[96vw] max-w-[1200px]",
        )}
        showCloseButton
      >
        {view === "list" ? (
          <>
            <DialogHeader className="shrink-0 border-b px-4 py-3 pr-14">
              <DialogTitle>Your scribble boards</DialogTitle>
            </DialogHeader>
            <ScribbleBoardPicker
              token={token}
              scribbles={scribbles}
              loading={loading}
              deletingId={deletingId}
              error={error}
              onSelect={handleOpenBoard}
              onCreate={handleCreateBoard}
              onDelete={handleDeleteBoard}
            />
          </>
        ) : (
          <ScribbleBoardEditor
            token={token}
            scribbleId={activeScribbleId}
            isNewBoard={isNewBoard}
            onBack={handleBackToList}
            onSaved={handleBackToList}
            onDelete={handleDeletedFromEditor}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PersonalScribbleButton({ token }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!token}
      >
        <PenLine data-icon="inline-start" />
        Scribble
      </Button>
      <PersonalScribbleDialog
        token={token}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
