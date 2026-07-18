import bcrypt from 'bcryptjs';
import { addWorkingMinutes } from './sla';

export function seed(db: any) {
  const t = Date.now();
  const hash = bcrypt.hashSync('password123', 10);
  const H = 3600 * 1000, D = 24 * H;

  // ---- Teams ----
  const insTeam = db.prepare('INSERT INTO teams (name) VALUES (?)');
  const sales = Number(insTeam.run('Sales').lastInsertRowid);
  const accounts = Number(insTeam.run('Accounts').lastInsertRowid);
  const warehouse = Number(insTeam.run('Warehouse').lastInsertRowid);
  const hr = Number(insTeam.run('HR').lastInsertRowid);
  const support = Number(insTeam.run('Support').lastInsertRowid);

  // ---- Users ----
  const insUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, team_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const u = (name: string, email: string, role: string, teamId: number | null) =>
    Number(insUser.run(name, email, hash, role, teamId, t).lastInsertRowid);

  const admin = u('Kumar Bibhaw Raj', 'admin@company.com', 'ADMIN', null);
  const ceo = u('CEO', 'ceo@company.com', 'CEO', null);
  const suresh = u('Suresh Kumar (Sales Head)', 'suresh@company.com', 'MANAGER', sales);
  const neha = u('Neha Kapoor', 'neha@company.com', 'MEMBER', sales);
  const amit = u('Amit Saxena', 'amit@company.com', 'MEMBER', sales);
  const meena = u('Meena Joshi (Accounts Head)', 'meena@company.com', 'MANAGER', accounts);
  const ravi = u('Ravi Menon', 'ravi@company.com', 'MEMBER', accounts);
  const manoj = u('Manoj Yadav (Warehouse Lead)', 'manoj@company.com', 'MANAGER', warehouse);
  const sunil = u('Sunil Pawar', 'sunil@company.com', 'MEMBER', warehouse);
  const kavita = u('Kavita Rao (HR Lead)', 'kavita@company.com', 'MANAGER', hr);
  const pooja = u('Pooja Bhatt', 'pooja@company.com', 'MEMBER', hr);
  const deepak = u('Deepak Sharma (Support Lead)', 'deepak@company.com', 'MANAGER', support);
  const anjali = u('Anjali Verma', 'anjali@company.com', 'MEMBER', support);

  const setMgr = db.prepare('UPDATE teams SET manager_id = ? WHERE id = ?');
  setMgr.run(suresh, sales); setMgr.run(meena, accounts); setMgr.run(manoj, warehouse);
  setMgr.run(kavita, hr); setMgr.run(deepak, support);

  // ---- Task types (team catalogue: name + alias = deliverable unit) ----
  const insType = db.prepare(
    'INSERT INTO task_types (team_id, name, alias, description, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const tt = (teamId: number, name: string, alias: string, desc = '') =>
    Number(insType.run(teamId, name, alias, desc, t).lastInsertRowid);

  const ttFollowup = tt(sales, 'Lead Follow-up', 'Call', 'Outbound follow-up calls to leads/renewals');
  const ttDemo = tt(sales, 'Client Demo', 'Demo', 'Product demonstrations to prospects');
  const ttInvoice = tt(accounts, 'Invoice Processing', 'Invoice', 'Vendor/customer invoice handling');
  tt(accounts, 'Payment Reconciliation', 'Entry', 'Bank/ledger reconciliation entries');
  const ttAudit = tt(warehouse, 'Stock Audit', 'SKU', 'Physical stock verification');
  tt(warehouse, 'Dispatch', 'Order', 'Order picking, packing and dispatch');
  const ttJobRole = tt(hr, 'Job Role', 'Resume', 'Sourcing candidates for an open role');
  tt(hr, 'Onboarding', 'Document', 'New-joiner document collection');
  const ttTicket = tt(support, 'Ticket Resolution', 'Ticket', 'Customer support ticket closure');
  tt(support, 'Escalation Handling', 'Case', 'Escalated customer cases');

  // ---- Tasks ----
  const insTask = db.prepare(`INSERT INTO tasks
    (title, description, status, priority, creator_id, assignee_id, assigned_team_id, project_id, parent_id, batch_id,
     task_type_id, target_count, delivered_count,
     due_at, eta_at, acknowledged_at, started_at, done_at, sla_deadline_at, sla_breached_at, escalated_at, created_at, updated_at)
    VALUES (@title, @description, @status, @priority, @creator, @assignee, @team, @project, @parent, @batch,
     @type, @target, @delivered,
     @due, @eta, @ack, @started, @done, @sla, @breached, @escalated, @created, @updated)`);
  const task = (o: any) =>
    Number(
      insTask.run({
        description: '', status: 'ASSIGNED', priority: 'NORMAL', assignee: null, team: null, project: null,
        parent: null, batch: null, type: null, target: null, delivered: 0,
        eta: null, ack: null, started: null, done: null,
        sla: null, breached: null, escalated: null, created: t, updated: t, ...o,
      }).lastInsertRowid
    );
  const act = db.prepare('INSERT INTO activity (task_id, actor_id, type, meta, created_at) VALUES (?, ?, ?, ?, ?)');

  // Project
  const projId = Number(
    db.prepare('INSERT INTO projects (name, description, owner_id, created_at) VALUES (?, ?, ?, ?)')
      .run('Festive Season Launch', 'Cross-team push for the festive quarter: sales targets, stock readiness, support staffing.', ceo, t)
      .lastInsertRowid
  );
  const insPM = db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)');
  for (const m of [ceo, suresh, neha, manoj, sunil, deepak]) insPM.run(projId, m);
  db.prepare('INSERT INTO project_notes (project_id, author_id, body, pinned, created_at) VALUES (?, ?, ?, 1, ?)')
    .run(projId, ceo, 'Launch window: first week of October. Daily standup 10:15 in the war room.', t);

  // 1. HR flagship: Job Role, target 10 resumes, 4 delivered
  const t1 = task({
    title: 'Find candidates for Sales Executive role',
    description: 'Source profiles with 2-4 yrs field-sales experience. Share shortlisted resumes with HR Lead; ticket closes at 10.',
    status: 'IN_PROGRESS', creator: ceo, assignee: pooja, priority: 'HIGH',
    type: ttJobRole, target: 10, delivered: 4,
    due: t + 3 * D, eta: t + 2 * D, ack: t - 5 * H, started: t - 4 * H,
    created: t - 6 * H, sla: addWorkingMinutes(t - 6 * H, 30),
  });
  act.run(t1, ceo, 'CREATED', '{}', t - 6 * H);
  act.run(t1, pooja, 'ACKNOWLEDGED', JSON.stringify({ etaAt: t + 2 * D }), t - 5 * H);
  act.run(t1, pooja, 'PROGRESS', JSON.stringify({ from: 0, to: 4 }), t - 2 * H);

  // 2. Sales: target met, ready to close
  const t2 = task({
    title: 'Q3 renewal pipeline follow-ups',
    status: 'IN_PROGRESS', creator: suresh, assignee: neha,
    type: ttFollowup, target: 15, delivered: 15,
    due: t + 1 * D, eta: t + 1 * D, ack: t - 2 * D, started: t - 2 * D,
    created: t - 2 * D, sla: addWorkingMinutes(t - 2 * D, 30),
  });
  act.run(t2, neha, 'PROGRESS', JSON.stringify({ from: 12, to: 15 }), t - 1 * H);

  // 3. Sales: fresh, awaiting acknowledgment (SLA running)
  const t3 = task({
    title: 'Demo for Meridian Retail (tomorrow 4 PM)',
    creator: suresh, assignee: amit, priority: 'URGENT', type: ttDemo, target: 1,
    due: t + 1 * D, created: t - 10 * 60000, sla: addWorkingMinutes(t - 10 * 60000, 30),
  });
  act.run(t3, suresh, 'CREATED', '{}', t - 10 * 60000);

  // 4. Accounts: invoices in progress
  task({
    title: 'Process pending vendor invoices',
    status: 'IN_PROGRESS', creator: meena, assignee: ravi,
    type: ttInvoice, target: 20, delivered: 7,
    due: t + 2 * D, eta: t + 2 * D, ack: t - 1 * D, started: t - 1 * D,
    created: t - 1 * D, sla: addWorkingMinutes(t - 1 * D, 30),
  });

  // 5. Warehouse: stock audit 80/120, in project
  task({
    title: 'Monthly stock audit — Aisle A & B',
    status: 'IN_PROGRESS', creator: manoj, assignee: sunil, project: projId,
    type: ttAudit, target: 120, delivered: 80,
    due: t + 2 * D, eta: t + 2 * D, ack: t - 1 * D, started: t - 1 * D,
    created: t - 1 * D, sla: addWorkingMinutes(t - 1 * D, 30),
  });

  // 6. Support: escalated, awaiting mandatory explanation
  const t6 = task({
    title: 'Clear backlog tickets before weekend',
    status: 'ESCALATED', creator: deepak, assignee: anjali,
    type: ttTicket, target: 25, delivered: 12,
    due: t - 1 * D, eta: t - 1 * D, ack: t - 3 * D, escalated: t - 18 * H,
    created: t - 3 * D, sla: addWorkingMinutes(t - 3 * D, 30),
  });
  db.prepare('INSERT INTO escalations (task_id, created_at) VALUES (?, ?)').run(t6, t - 18 * H);
  act.run(t6, null, 'ESCALATED', '{}', t - 18 * H);

  // 7. Accounts: done on time
  const t7 = task({
    title: 'June GST filing summary',
    status: 'DONE', creator: meena, assignee: ravi,
    due: t - 1 * D, eta: t - 2 * D, ack: t - 4 * D, done: t - 2 * D,
    created: t - 5 * D, sla: addWorkingMinutes(t - 5 * D, 30),
  });
  act.run(t7, ravi, 'DONE', '{}', t - 2 * D);

  // 8. Team-level task for Sales (Head claims/routes)
  const t8 = task({
    title: 'Update festive price list for all SKUs',
    creator: ceo, team: sales, priority: 'HIGH', project: projId,
    due: t + 4 * D, created: t - 2 * H, sla: addWorkingMinutes(t - 2 * H, 30),
  });
  act.run(t8, ceo, 'CREATED', '{}', t - 2 * H);

  // 9. Batch: CEO sent 3 tasks in one message to Amit
  const batch = 'batch-seed-1';
  for (const title of ['Collect testimonials from top 5 clients', 'Update CRM stage for open deals', 'Share competitor pricing notes']) {
    const id = task({
      title, creator: ceo, assignee: amit, batch,
      due: t + 2 * D, created: t - 1 * H, sla: addWorkingMinutes(t - 1 * H, 30),
    });
    act.run(id, ceo, 'CREATED', JSON.stringify({ batch }), t - 1 * H);
  }

  // 10. HR: no-response breach example
  const t10 = task({
    title: 'Schedule interviews for Warehouse Supervisor role',
    creator: kavita, assignee: pooja, type: ttJobRole, target: 5,
    due: t + 1 * D, created: t - 5 * H, sla: addWorkingMinutes(t - 5 * H, 30), breached: t - 4 * H,
  });
  act.run(t10, kavita, 'CREATED', '{}', t - 5 * H);

  // Notifications so bells have content
  const insN = db.prepare('INSERT INTO notifications (user_id, type, title, body, task_id, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  insN.run(amit, 'ASSIGNED', 'New task: "Demo for Meridian Retail (tomorrow 4 PM)"', 'Assigned by Suresh. Respond within 30 minutes.', t3, t - 10 * 60000);
  insN.run(suresh, 'PROGRESS', 'Target met: 15/15 Call on "Q3 renewal pipeline follow-ups"', 'Ready to close.', t2, t - 1 * H);
  insN.run(anjali, 'ESCALATED', 'Escalated: "Clear backlog tickets before weekend" passed its due date', 'A written explanation is now mandatory.', t6, t - 18 * H);
  insN.run(pooja, 'SLA_BREACH', 'No response: "Schedule interviews for Warehouse Supervisor role"', '', t10, t - 4 * H);
}
