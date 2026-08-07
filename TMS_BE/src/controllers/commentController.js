import * as commentService from "../services/commentService.js";
import { logActivity } from "../services/activityLogService.js";

function logCommentActivity(req, res, overrides = {}) {
  logActivity({
    userId: req.user.user_id,
    req,
    statusCode: res.statusCode,
    ...overrides,
  }).catch(() => {});
}

export const createComment = async (req, res) => {
  const comment = await commentService.createComment(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
    req.body,
  );
  res.status(201).json({ comment });
  logCommentActivity(req, res, {
    action: "comment.create",
    entityType: "comment",
    entityId: comment.comment_id,
    taskId: Number(req.params.taskId),
    description: comment.content,
    metadata: {
      task_id: Number(req.params.taskId),
      parent_comment_id: comment.parent_comment_id,
    },
  });
};

export const listComments = async (req, res) => {
  const comments = await commentService.listComments(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
  );
  res.json({ comments });
  logCommentActivity(req, res, {
    action: "comment.list",
    entityType: "task",
    entityId: Number(req.params.taskId),
    description: `Listed ${comments.length} top-level comment(s) for task #${req.params.taskId}`,
  });
};

export const getComment = async (req, res) => {
  const comment = await commentService.getCommentById(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
    req.params.commentId,
  );
  res.json({ comment });
  logCommentActivity(req, res, {
    action: "comment.view",
    entityType: "comment",
    entityId: comment.comment_id,
    description: `Viewed comment #${comment.comment_id}`,
  });
};

export const updateComment = async (req, res) => {
  const comment = await commentService.updateComment(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
    req.params.commentId,
    req.body,
  );
  res.json({ comment });
  logCommentActivity(req, res, {
    action: "comment.update",
    entityType: "comment",
    entityId: comment.comment_id,
    taskId: Number(req.params.taskId),
    description: comment.content,
    metadata: { edited: true },
  });
};

export const deleteComment = async (req, res) => {
  const result = await commentService.deleteComment(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
    req.params.commentId,
  );
  res.json(result);
  logCommentActivity(req, res, {
    action: "comment.delete",
    entityType: "comment",
    entityId: Number(req.params.commentId),
    taskId: Number(req.params.taskId),
    description: `Deleted comment #${req.params.commentId} from task #${req.params.taskId}`,
  });
};

export const toggleCommentReaction = async (req, res) => {
  const result = await commentService.toggleCommentReaction(
    req.user.user_id,
    req.params.projectId,
    req.params.taskId,
    req.params.commentId,
    req.body.emoji,
  );
  res.json(result);
  logCommentActivity(req, res, {
    action: "comment.reaction.toggle",
    entityType: "comment",
    entityId: Number(req.params.commentId),
    taskId: Number(req.params.taskId),
    description: `Toggled reaction on comment #${req.params.commentId}`,
    metadata: { emoji: req.body.emoji, reacted: result.reacted },
  });
};
