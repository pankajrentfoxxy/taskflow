import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { addWorkingMinutes } from "../src/lib/sla.js";
import { now } from "../src/lib/time.js";
import {
  sequelize,
  Team,
  User,
  TaskType,
  Project,
  ProjectMember,
  ProjectNote,
  Task,
  Activity,
  Escalation,
  Notification,
} from "../src/models/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

export async function seedDatabase() {
  const t = now();
  const hash = bcrypt.hashSync("password123", 10);
  const H = 3600 * 1000;
  const D = 24 * H;

  const sales = (await Team.create({ name: "Sales" })).id;
  const warehouse = (await Team.create({ name: "Warehouse" })).id;
  const support = (await Team.create({ name: "Support" })).id;
  const accounts = (await Team.create({ name: "Accounts" })).id;

  const u = async (name, email, role, teamId) => {
    const user = await User.create({
      name,
      email,
      password_hash: hash,
      role,
      team_id: teamId,
      created_at: t,
    });
    return user.id;
  };

  const cto = await u("Kumar Bibhaw Raj (CTO)", "admin@rentfoxxy.com", "ADMIN", null);
  const ceo = await u("CEO", "ceo@rentfoxxy.com", "CEO", null);
  const suresh = await u("Suresh Kumar (Sales Head)", "suresh@rentfoxxy.com", "MANAGER", sales);
  const neha = await u("Neha Kapoor", "neha@rentfoxxy.com", "MEMBER", sales);
  const amit = await u("Amit Saxena", "amit@rentfoxxy.com", "MEMBER", sales);
  const manoj = await u("Manoj Yadav (Warehouse Lead)", "manoj@rentfoxxy.com", "MANAGER", warehouse);
  const sunil = await u("Sunil Pawar", "sunil@rentfoxxy.com", "MEMBER", warehouse);
  const rekha = await u("Rekha Singh", "rekha@rentfoxxy.com", "MEMBER", warehouse);
  const deepak = await u("Deepak Sharma (Support Lead)", "deepak@rentfoxxy.com", "MANAGER", support);
  const anjali = await u("Anjali Verma", "anjali@rentfoxxy.com", "MEMBER", support);
  const vikas = await u("Vikas Rathi", "vikas@rentfoxxy.com", "MEMBER", support);
  const meena = await u("Meena Joshi (Accounts Head)", "meena@rentfoxxy.com", "MANAGER", accounts);
  const ravi = await u("Ravi Menon", "ravi@rentfoxxy.com", "MEMBER", accounts);

  await Team.update({ manager_id: suresh }, { where: { id: sales } });
  await Team.update({ manager_id: manoj }, { where: { id: warehouse } });
  await Team.update({ manager_id: deepak }, { where: { id: support } });
  await Team.update({ manager_id: meena }, { where: { id: accounts } });

  const tt = async (teamId, name, desc = "") => {
    const type = await TaskType.create({
      team_id: teamId,
      name,
      alias: name,
      description: desc,
      created_at: t,
    });
    return type.id;
  };

  const ttLead = await tt(sales, "Lead Follow-up", "Outbound calls to rental leads and renewals");
  const ttDemo = await tt(sales, "Client Demo", "Product/fleet demos for corporate prospects");
  const ttQuote = await tt(sales, "Rental Quotation", "Prepare & send rental quotations");
  await tt(sales, "Contract Renewal", "Follow up and close rental contract renewals");
  const ttQC = await tt(warehouse, "Laptop QC & Prep", "Format, image, test and pack laptops before dispatch");
  await tt(warehouse, "Dispatch", "Pick, pack and ship rental orders");
  const ttReturn = await tt(warehouse, "Return Inspection", "Inspect and grade returned laptops");
  await tt(warehouse, "Stock Audit", "Physical verification of rental fleet inventory");
  await tt(warehouse, "Refurbishment", "Repair/upgrade laptops back to rentable condition");
  const ttTicket = await tt(support, "Ticket Resolution", "Customer support ticket closure");
  const ttOnsite = await tt(support, "Onsite Repair", "Engineer visits at client site");
  await tt(support, "Replacement Request", "Swap faulty rental units at client site");
  const ttInvoice = await tt(accounts, "Invoice Processing", "Monthly rental invoicing");
  const ttPayment = await tt(accounts, "Payment Follow-up", "Chase overdue rental payments");
  await tt(accounts, "Deposit Refund", "Process security deposit refunds after returns");

  const task = async (o) => {
    const row = await Task.create({
      title: o.title,
      description: o.description ?? "",
      status: o.status ?? "ASSIGNED",
      priority: o.priority ?? "NORMAL",
      creator_id: o.creator,
      assignee_id: o.assignee ?? null,
      assigned_team_id: o.team ?? null,
      project_id: o.project ?? null,
      parent_id: o.parent ?? null,
      batch_id: o.batch ?? null,
      task_type_id: o.type ?? null,
      target_count: o.target ?? null,
      delivered_count: o.delivered ?? 0,
      due_at: o.due,
      eta_at: o.eta ?? null,
      acknowledged_at: o.ack ?? null,
      started_at: o.started ?? null,
      done_at: o.done ?? null,
      sla_deadline_at: o.sla ?? null,
      sla_breached_at: o.breached ?? null,
      escalated_at: o.escalated ?? null,
      created_at: o.created ?? t,
      updated_at: o.updated ?? t,
    });
    return row.id;
  };

  const act = async (taskId, actorId, type, meta = {}) => {
    await Activity.create({
      task_id: taskId,
      actor_id: actorId,
      type,
      meta: JSON.stringify(meta),
      created_at: t,
    });
  };

  const proj = await Project.create({
    name: "Corporate Expansion Q3",
    description:
      "Target: 500 new laptops on rent to corporate clients this quarter. Sales + Warehouse readiness.",
    owner_id: ceo,
    created_at: t,
  });
  const projId = proj.id;

  for (const m of [ceo, cto, suresh, neha, manoj, sunil]) {
    await ProjectMember.create({ project_id: projId, user_id: m });
  }

  await ProjectNote.create({
    project_id: projId,
    author_id: ceo,
    body: "Fleet availability review every Monday 11:00. Corporate pricing sheet is in Files.",
    pinned: true,
    created_at: t,
  });

  const t1 = await task({
    title: "Follow up 20 corporate leads for bulk laptop rentals",
    description:
      "Priority: IT services companies with 50+ seat requirements. Log every call outcome in CRM.",
    status: "IN_PROGRESS",
    creator: ceo,
    assignee: neha,
    priority: "HIGH",
    project: projId,
    type: ttLead,
    due: t + 3 * D,
    eta: t + 2 * D,
    ack: t - 5 * H,
    started: t - 4 * H,
    created: t - 6 * H,
    sla: addWorkingMinutes(t - 6 * H, 30),
  });
  await act(t1, ceo, "CREATED");
  await Activity.create({
    task_id: t1,
    actor_id: neha,
    type: "ACKNOWLEDGED",
    meta: JSON.stringify({ etaAt: t + 2 * D }),
    created_at: t - 5 * H,
  });

  const t2 = await task({
    title: "Demo for TechServe Solutions — 50-laptop requirement (tomorrow 4 PM)",
    creator: suresh,
    assignee: amit,
    priority: "URGENT",
    type: ttDemo,
    due: t + 1 * D,
    created: t - 10 * 60000,
    sla: addWorkingMinutes(t - 10 * 60000, 30),
  });
  await act(t2, suresh, "CREATED");

  await task({
    title: "QC & prep 30 laptops for Infoline Technologies order",
    description: "i5/16GB config. Fresh Windows image, battery health > 80%, charger + bag each.",
    status: "IN_PROGRESS",
    creator: manoj,
    assignee: sunil,
    project: projId,
    priority: "HIGH",
    type: ttQC,
    due: t + 2 * D,
    eta: t + 2 * D,
    ack: t - 1 * D,
    started: t - 1 * D,
    created: t - 1 * D,
    sla: addWorkingMinutes(t - 1 * D, 30),
  });

  await task({
    title: "Inspect 15 returned laptops from Vertex Consulting batch",
    status: "IN_PROGRESS",
    creator: manoj,
    assignee: rekha,
    type: ttReturn,
    due: t + 1 * D,
    eta: t + 1 * D,
    ack: t - 2 * D,
    started: t - 2 * D,
    created: t - 2 * D,
    sla: addWorkingMinutes(t - 2 * D, 30),
  });

  const t5 = await task({
    title: "Clear support ticket backlog before weekend",
    status: "ESCALATED",
    creator: deepak,
    assignee: anjali,
    type: ttTicket,
    due: t - 1 * D,
    eta: t - 1 * D,
    ack: t - 3 * D,
    escalated: t - 18 * H,
    created: t - 3 * D,
    sla: addWorkingMinutes(t - 3 * D, 30),
  });
  await Escalation.create({ task_id: t5, created_at: t - 18 * H });
  await Activity.create({
    task_id: t5,
    actor_id: null,
    type: "ESCALATED",
    meta: "{}",
    created_at: t - 18 * H,
  });

  const t6 = await task({
    title: "Onsite visit — Acme Corp, 5 laptops not booting",
    creator: deepak,
    assignee: vikas,
    priority: "URGENT",
    type: ttOnsite,
    due: t + 1 * D,
    created: t - 5 * H,
    sla: addWorkingMinutes(t - 5 * H, 30),
    breached: t - 4 * H,
  });
  await act(t6, deepak, "CREATED");

  await task({
    title: "Process July rental invoices",
    status: "IN_PROGRESS",
    creator: meena,
    assignee: ravi,
    type: ttInvoice,
    due: t + 2 * D,
    eta: t + 2 * D,
    ack: t - 1 * D,
    started: t - 1 * D,
    created: t - 1 * D,
    sla: addWorkingMinutes(t - 1 * D, 30),
  });

  const t8 = await task({
    title: "Collect overdue payments — June cycle",
    status: "DONE",
    creator: meena,
    assignee: ravi,
    type: ttPayment,
    due: t - 12 * H,
    eta: t - 1 * D,
    ack: t - 4 * D,
    done: t - 1 * D,
    created: t - 4 * D,
    sla: addWorkingMinutes(t - 4 * D, 30),
  });
  await Activity.create({
    task_id: t8,
    actor_id: ravi,
    type: "DONE",
    meta: "{}",
    created_at: t - 1 * D,
  });

  const t9 = await task({
    title: "Prepare fleet availability report for Q3 corporate push",
    creator: ceo,
    team: warehouse,
    priority: "HIGH",
    project: projId,
    due: t + 4 * D,
    created: t - 2 * H,
    sla: addWorkingMinutes(t - 2 * H, 30),
  });
  await act(t9, ceo, "CREATED");

  const batch = "batch-seed-1";
  for (const title of [
    "Collect testimonials from top 5 rental clients",
    "Update CRM stage for open corporate deals",
    "Share competitor rental pricing notes",
  ]) {
    const id = await task({
      title,
      creator: ceo,
      assignee: amit,
      batch,
      due: t + 2 * D,
      created: t - 1 * H,
      sla: addWorkingMinutes(t - 1 * H, 30),
    });
    await Activity.create({
      task_id: id,
      actor_id: ceo,
      type: "CREATED",
      meta: JSON.stringify({ batch }),
      created_at: t - 1 * H,
    });
  }

  await Notification.bulkCreate([
    {
      user_id: amit,
      type: "ASSIGNED",
      title: 'New task: "Demo for TechServe Solutions — 50-laptop requirement (tomorrow 4 PM)"',
      body: "Assigned by Suresh. Respond within 30 minutes.",
      task_id: t2,
      created_at: t - 10 * 60000,
    },
    {
      user_id: anjali,
      type: "ESCALATED",
      title: 'Escalated: "Clear support ticket backlog before weekend" passed its due date',
      body: "A written explanation is now mandatory.",
      task_id: t5,
      created_at: t - 18 * H,
    },
    {
      user_id: vikas,
      type: "SLA_BREACH",
      title: 'No response: "Onsite visit — Acme Corp, 5 laptops not booting"',
      body: "",
      task_id: t6,
      created_at: t - 4 * H,
    },
  ]);

  console.log("Seed complete.");
}

const isDirectRun = process.argv[1]?.endsWith("seed.js");

if (isDirectRun) {
  import("../src/app.js")
    .then(({ initApp }) => initApp())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export default seedDatabase;
