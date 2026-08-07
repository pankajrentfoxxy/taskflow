import * as scribbleService from "../services/scribbleService.js";

export const listScribbles = async (req, res) => {
  const scribbles = await scribbleService.listScribbles(req.user.user_id);
  res.json({ scribbles });
};

export const createScribble = async (req, res) => {
  const scribble = await scribbleService.createScribble(
    req.user.user_id,
    req.body.name,
    req.body.scene,
  );
  res.status(201).json({ scribble });
};

export const getScribbleById = async (req, res) => {
  const scribble = await scribbleService.getScribbleById(
    req.user.user_id,
    req.params.scribbleId,
  );
  res.json({ scribble });
};

export const updateScribble = async (req, res) => {
  const scribble = await scribbleService.updateScribble(
    req.user.user_id,
    req.params.scribbleId,
    req.body.scene,
    req.body.name,
  );
  res.json({ scribble });
};

export const deleteScribble = async (req, res) => {
  await scribbleService.deleteScribble(
    req.user.user_id,
    req.params.scribbleId,
  );
  res.status(204).send();
};
