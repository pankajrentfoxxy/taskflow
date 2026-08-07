import httpStatus from "http-status";
import { Comment, CommentReaction, Authentication, Task } from "../models/index.js";
import * as projectService from "./projectService.js";
import ApiError from "../utils/ApiError.js";

const now = () => Date.now();

const authorInclude = {
  model: Authentication,
  as: "author",
  attributes: ["user_id", "email", "full_name"],
};

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function groupReactions(reactionRows) {
  const byCommentId = new Map();

  for (const reaction of reactionRows) {
    const commentReactions = byCommentId.get(reaction.comment_id) ?? new Map();
    const emojiReactions = commentReactions.get(reaction.emoji) ?? [];
    emojiReactions.push(reaction.user_id);
    commentReactions.set(reaction.emoji, emojiReactions);
    byCommentId.set(reaction.comment_id, commentReactions);
  }

  return byCommentId;
}

function reactionsForComment(reactionsByCommentId, commentId) {
  const emojiMap = reactionsByCommentId.get(commentId);
  if (!emojiMap) {
    return [];
  }

  return Array.from(emojiMap.entries()).map(([emoji, user_ids]) => ({
    emoji,
    count: user_ids.length,
    user_ids,
  }));
}

const toPublicComment = (comment, reactionsByCommentId = new Map()) => ({
  comment_id: comment.comment_id,
  task_id: comment.task_id,
  user_id: comment.user_id,
  parent_comment_id: comment.parent_comment_id,
  content: comment.content,
  edited: comment.edited,
  edited_at: normalizeTimestamp(comment.edited_at),
  created_at: normalizeTimestamp(comment.created_at),
  updated_at: normalizeTimestamp(comment.updated_at),
  author: comment.author
    ? {
        user_id: comment.author.user_id,
        email: comment.author.email,
        full_name: comment.author.full_name,
      }
    : undefined,
  reactions: reactionsForComment(reactionsByCommentId, comment.comment_id),
  replies: comment.replies
    ? comment.replies.map((reply) => toPublicComment(reply, reactionsByCommentId))
    : undefined,
});

async function loadReactionsByCommentId(commentIds) {
  if (!commentIds.length) {
    return new Map();
  }

  const reactions = await CommentReaction.findAll({
    where: { comment_id: commentIds },
    attributes: ["comment_id", "user_id", "emoji"],
    order: [["created_at", "ASC"]],
  });

  return groupReactions(reactions);
}

async function assertTaskAccess(userId, projectId, taskId) {
  const task = await Task.findOne({
    where: { task_id: taskId, project_id: projectId },
  });

  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, "Task not found");
  }

  await projectService.getProjectById(userId, projectId);
  return task;
}

async function getCommentRecord(commentId, taskId) {
  const comment = await Comment.findOne({
    where: { comment_id: commentId, task_id: taskId },
  });

  if (!comment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Comment not found");
  }

  return comment;
}

async function assertParentComment(taskId, parentCommentId) {
  if (parentCommentId == null) {
    return;
  }

  const parent = await Comment.findOne({
    where: { comment_id: parentCommentId, task_id: taskId },
  });

  if (!parent) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Parent comment not found on this task",
    );
  }
}

function assertCommentAuthor(userId, comment) {
  if (comment.user_id !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the comment author can perform this action",
    );
  }
}

function buildCommentTree(comments, reactionsByCommentId) {
  const byId = new Map();
  const roots = [];

  for (const comment of comments) {
    byId.set(comment.comment_id, {
      ...toPublicComment(comment, reactionsByCommentId),
      replies: [],
    });
  }

  for (const comment of comments) {
    const node = byId.get(comment.comment_id);
    if (comment.parent_comment_id) {
      const parent = byId.get(comment.parent_comment_id);
      if (parent) {
        parent.replies.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function createComment(userId, projectId, taskId, payload) {
  await assertTaskAccess(userId, projectId, taskId);
  await assertParentComment(taskId, payload.parent_comment_id ?? null);

  const timestamp = now();
  const comment = await Comment.create({
    task_id: taskId,
    user_id: userId,
    parent_comment_id: payload.parent_comment_id ?? null,
    content: payload.content,
    edited: false,
    edited_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  });

  return getCommentById(userId, projectId, taskId, comment.comment_id);
}

export async function listComments(userId, projectId, taskId) {
  await assertTaskAccess(userId, projectId, taskId);

  const comments = await Comment.findAll({
    where: { task_id: taskId },
    include: [authorInclude],
    order: [["created_at", "ASC"]],
  });

  const reactionsByCommentId = await loadReactionsByCommentId(
    comments.map((comment) => comment.comment_id),
  );

  return buildCommentTree(comments, reactionsByCommentId);
}

export async function getCommentById(userId, projectId, taskId, commentId) {
  await assertTaskAccess(userId, projectId, taskId);

  const comment = await Comment.findOne({
    where: { comment_id: commentId, task_id: taskId },
    include: [authorInclude],
  });

  if (!comment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Comment not found");
  }

  const reactionsByCommentId = await loadReactionsByCommentId([commentId]);
  return toPublicComment(comment, reactionsByCommentId);
}

export async function updateComment(
  userId,
  projectId,
  taskId,
  commentId,
  payload,
) {
  await assertTaskAccess(userId, projectId, taskId);
  const comment = await getCommentRecord(commentId, taskId);
  assertCommentAuthor(userId, comment);

  const timestamp = now();
  await comment.update({
    content: payload.content,
    edited: true,
    edited_at: timestamp,
    updated_at: timestamp,
  });

  return getCommentById(userId, projectId, taskId, commentId);
}

export async function deleteComment(userId, projectId, taskId, commentId) {
  await assertTaskAccess(userId, projectId, taskId);
  const comment = await getCommentRecord(commentId, taskId);
  assertCommentAuthor(userId, comment);

  await comment.destroy();
  return { message: "Comment deleted" };
}

export async function toggleCommentReaction(
  userId,
  projectId,
  taskId,
  commentId,
  emoji,
) {
  await assertTaskAccess(userId, projectId, taskId);
  await getCommentRecord(commentId, taskId);

  const normalizedEmoji = emoji.trim();
  if (!normalizedEmoji) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Emoji is required");
  }

  const existing = await CommentReaction.findOne({
    where: {
      comment_id: commentId,
      user_id: userId,
      emoji: normalizedEmoji,
    },
  });

  if (existing) {
    await existing.destroy();
  } else {
    await CommentReaction.create({
      comment_id: commentId,
      user_id: userId,
      emoji: normalizedEmoji,
      created_at: now(),
    });
  }

  const reactionsByCommentId = await loadReactionsByCommentId([commentId]);

  return {
    reacted: !existing,
    reactions: reactionsForComment(reactionsByCommentId, commentId),
  };
}
