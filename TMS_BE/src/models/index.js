import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import defineAuthentication from "./Authentication.js";
import defineRole from "./Role.js";
import defineProject from "./Project.js";
import defineProjectMember from "./ProjectMember.js";
import defineActivityLog from "./ActivityLog.js";
import defineErrorLog from "./ErrorLog.js";
import defineTaskStatus from "./TaskStatus.js";
import defineTaskType from "./TaskType.js";
import defineTask from "./Task.js";
import defineComment from "./Comment.js";
import defineCommentReaction from "./CommentReaction.js";
import defineTeam from "./Team.js";
import defineTeamMember from "./TeamMember.js";
import defineTaskAssignee from "./TaskAssignee.js";

const Authentication = defineAuthentication(sequelize, DataTypes);
const Role = defineRole(sequelize, DataTypes);
const Project = defineProject(sequelize, DataTypes);
const ProjectMember = defineProjectMember(sequelize, DataTypes);
const ActivityLog = defineActivityLog(sequelize, DataTypes);
const ErrorLog = defineErrorLog(sequelize, DataTypes);
const TaskStatus = defineTaskStatus(sequelize, DataTypes);
const TaskType = defineTaskType(sequelize, DataTypes);
const Task = defineTask(sequelize, DataTypes);
const Comment = defineComment(sequelize, DataTypes);
const CommentReaction = defineCommentReaction(sequelize, DataTypes);
const TaskAssignee = defineTaskAssignee(sequelize, DataTypes);
const Team = defineTeam(sequelize, DataTypes);
const TeamMember = defineTeamMember(sequelize, DataTypes);

Role.hasMany(Authentication, { foreignKey: "role_id", as: "users" });
Authentication.belongsTo(Role, { foreignKey: "role_id", as: "role" });

Authentication.hasMany(Project, { foreignKey: "created_by", as: "projects" });
Project.belongsTo(Authentication, { foreignKey: "created_by", as: "creator" });

Project.hasMany(ProjectMember, { foreignKey: "project_id", as: "members" });
ProjectMember.belongsTo(Project, { foreignKey: "project_id", as: "project" });

Authentication.hasMany(ProjectMember, {
  foreignKey: "user_id",
  as: "projectMemberships",
});
ProjectMember.belongsTo(Authentication, { foreignKey: "user_id", as: "user" });

Authentication.hasMany(ProjectMember, {
  foreignKey: "created_by",
  as: "addedProjectMembers",
});
ProjectMember.belongsTo(Authentication, {
  foreignKey: "created_by",
  as: "addedBy",
});

Authentication.belongsToMany(Project, {
  through: ProjectMember,
  foreignKey: "user_id",
  otherKey: "project_id",
  as: "memberProjects",
});

Project.belongsToMany(Authentication, {
  through: ProjectMember,
  foreignKey: "project_id",
  otherKey: "user_id",
  as: "memberUsers",
});

Authentication.hasMany(ActivityLog, { foreignKey: "user_id", as: "activities" });
ActivityLog.belongsTo(Authentication, { foreignKey: "user_id", as: "user" });

Authentication.hasMany(ErrorLog, { foreignKey: "user_id", as: "errors" });
ErrorLog.belongsTo(Authentication, { foreignKey: "user_id", as: "user" });

Authentication.hasMany(TaskStatus, {
  foreignKey: "created_by",
  as: "taskStatuses",
});
TaskStatus.belongsTo(Authentication, { foreignKey: "created_by", as: "creator" });

Authentication.hasMany(TaskType, {
  foreignKey: "created_by",
  as: "taskTypes",
});
TaskType.belongsTo(Authentication, { foreignKey: "created_by", as: "creator" });

Project.hasMany(Task, { foreignKey: "project_id", as: "tasks" });
Task.belongsTo(Project, { foreignKey: "project_id", as: "project" });

TaskStatus.hasMany(Task, { foreignKey: "task_status_id", as: "tasks" });
Task.belongsTo(TaskStatus, { foreignKey: "task_status_id", as: "status" });

TaskType.hasMany(Task, { foreignKey: "task_type_id", as: "tasks" });
Task.belongsTo(TaskType, { foreignKey: "task_type_id", as: "type" });

Authentication.hasMany(Task, { foreignKey: "created_by", as: "createdTasks" });
Task.belongsTo(Authentication, { foreignKey: "created_by", as: "creator" });

Task.hasMany(TaskAssignee, {
  foreignKey: "task_id",
  as: "taskAssignees",
  onDelete: "CASCADE",
});
TaskAssignee.belongsTo(Task, { foreignKey: "task_id", as: "task" });

Authentication.hasMany(TaskAssignee, {
  foreignKey: "user_id",
  as: "taskAssignments",
});
TaskAssignee.belongsTo(Authentication, { foreignKey: "user_id", as: "user" });

Authentication.hasMany(TaskAssignee, {
  foreignKey: "created_by",
  as: "addedTaskAssignees",
});
TaskAssignee.belongsTo(Authentication, {
  foreignKey: "created_by",
  as: "addedBy",
});

Task.belongsToMany(Authentication, {
  through: TaskAssignee,
  foreignKey: "task_id",
  otherKey: "user_id",
  as: "assignees",
});

Authentication.belongsToMany(Task, {
  through: TaskAssignee,
  foreignKey: "user_id",
  otherKey: "task_id",
  as: "assignedTasks",
});

Task.hasMany(Task, {
  foreignKey: "parent_task_id",
  as: "subtasks",
  onDelete: "CASCADE",
});
Task.belongsTo(Task, { foreignKey: "parent_task_id", as: "parent" });

Task.hasMany(Comment, {
  foreignKey: "task_id",
  as: "comments",
  onDelete: "CASCADE",
});
Comment.belongsTo(Task, { foreignKey: "task_id", as: "task" });

Authentication.hasMany(Comment, { foreignKey: "user_id", as: "comments" });
Comment.belongsTo(Authentication, { foreignKey: "user_id", as: "author" });

Comment.hasMany(Comment, {
  foreignKey: "parent_comment_id",
  as: "replies",
  onDelete: "CASCADE",
});
Comment.belongsTo(Comment, {
  foreignKey: "parent_comment_id",
  as: "parent",
});

Comment.hasMany(CommentReaction, {
  foreignKey: "comment_id",
  as: "reactions",
  onDelete: "CASCADE",
});
CommentReaction.belongsTo(Comment, { foreignKey: "comment_id", as: "comment" });

Authentication.hasMany(CommentReaction, {
  foreignKey: "user_id",
  as: "commentReactions",
});
CommentReaction.belongsTo(Authentication, { foreignKey: "user_id", as: "user" });

Authentication.hasMany(Team, { foreignKey: "created_by", as: "teams" });
Team.belongsTo(Authentication, { foreignKey: "created_by", as: "creator" });

Team.hasMany(TeamMember, { foreignKey: "team_id", as: "members" });
TeamMember.belongsTo(Team, { foreignKey: "team_id", as: "team" });

Authentication.hasMany(TeamMember, {
  foreignKey: "user_id",
  as: "teamMemberships",
});
TeamMember.belongsTo(Authentication, { foreignKey: "user_id", as: "user" });

Authentication.belongsToMany(Team, {
  through: TeamMember,
  foreignKey: "user_id",
  otherKey: "team_id",
  as: "memberTeams",
});

Team.belongsToMany(Authentication, {
  through: TeamMember,
  foreignKey: "team_id",
  otherKey: "user_id",
  as: "memberUsers",
});

const db = {
  sequelize,
  Role,
  Authentication,
  Project,
  ProjectMember,
  ActivityLog,
  ErrorLog,
  TaskStatus,
  TaskType,
  Task,
  TaskAssignee,
  Comment,
  CommentReaction,
  Team,
  TeamMember,
};

export {
  sequelize,
  Authentication,
  Role,
  Project,
  ProjectMember,
  ActivityLog,
  ErrorLog,
  TaskStatus,
  TaskType,
  Task,
  TaskAssignee,
  Comment,
  CommentReaction,
  Team,
  TeamMember,
  db,
};
