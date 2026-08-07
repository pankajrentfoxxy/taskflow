import httpStatus from "http-status";
import { Scribble } from "../models/index.js";
import ApiError from "../utils/ApiError.js";

const DEFAULT_NAME = "untitled board";
const EMPTY_SCENE = {
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
};
const now = () => Date.now();

function normalizeSceneForSave(scene) {
  if (!scene || typeof scene !== "object") {
    return EMPTY_SCENE;
  }

  return {
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    appState: scene.appState ?? { viewBackgroundColor: "#ffffff" },
    files: scene.files ?? {},
  };
}

function normalizeName(name) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed || DEFAULT_NAME;
}

function toPublicScribble(record) {
  return {
    scribble_id: record.scribble_id,
    user_id: record.user_id,
    name: record.name ?? DEFAULT_NAME,
    scene: record.scene,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function toPublicScribbleSummary(record) {
  const elements = Array.isArray(record.scene?.elements) ? record.scene.elements : [];

  return {
    scribble_id: record.scribble_id,
    name: record.name ?? DEFAULT_NAME,
    updated_at: record.updated_at,
    element_count: elements.length,
    preview_color:
      record.scene?.appState?.viewBackgroundColor ?? "#ffffff",
  };
}

async function findOwnedScribble(userId, scribbleId) {
  const record = await Scribble.findOne({
    where: { scribble_id: scribbleId, user_id: userId },
  });

  if (!record) {
    throw new ApiError(httpStatus.NOT_FOUND, "Scribble not found");
  }

  return record;
}

export async function listScribbles(userId) {
  const records = await Scribble.findAll({
    where: { user_id: userId },
    order: [["updated_at", "DESC"]],
  });

  return records.map(toPublicScribbleSummary);
}

export async function getScribbleById(userId, scribbleId) {
  const record = await findOwnedScribble(userId, scribbleId);
  return toPublicScribble(record);
}

export async function createScribble(userId, name, scenePayload) {
  const t = now();
  const scene = normalizeSceneForSave(scenePayload);
  const created = await Scribble.create({
    user_id: userId,
    name: normalizeName(name),
    scene,
    created_at: t,
    updated_at: t,
  });

  return toPublicScribble(created);
}

export async function updateScribble(userId, scribbleId, scenePayload, name) {
  const record = await findOwnedScribble(userId, scribbleId);
  const scene = normalizeSceneForSave(scenePayload);
  const boardName = normalizeName(name ?? record.name);
  const t = now();

  await record.update({ scene, name: boardName, updated_at: t });
  return toPublicScribble(record);
}

export async function deleteScribble(userId, scribbleId) {
  const record = await findOwnedScribble(userId, scribbleId);
  await record.destroy();
}
