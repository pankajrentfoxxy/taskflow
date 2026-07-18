import bcrypt from 'bcryptjs';
import { addWorkingMinutes } from './sla';

// Seed for rentfoxxy.com — rental laptop business.
// Teams: Sales, Warehouse, Support, Accounts.
export function seed(db: any) {
  const t = Date.now();
  const hash = bcrypt.hashSync('password123', 10);
  const H = 3600 * 1000, D = 24 * H;

  // ---- Teams ----
  const insTeam = db.prepare('INSERT INTO teams (name) VALUES (?)');
  const sales = Number(insTeam.run('Sales').lastInsertRowid);
  const warehouse = Number(insTeam.run('Warehouse').lastInsertRowid);
  const support = Number(insTeam.run('Support').lastInsertRowid);
  const accounts = Number(insTeam.run('Accounts').lastInsertRowid);

  // ---- Users ----
  const insUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, team_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const u = (name: string, email: string, role: string, teamId: number | null) =>
    Number(insUser.run(name, email, hash, role, teamId, t).lastInsertRowid);

  const cto = u('Kumar Bibhaw Raj (CTO)', 'admin@rentfoxxy.com', 'ADMIN', null);
  const ceo = u('CEO', 'ceo@rentfoxxy.com', 'CEO', null);
  const suresh = u('Suresh Kumar (Sales Head)', 'suresh@rentfoxxy.com', 'MANAGER', sales);
  const neha = u('Neha Kapoor', 'neha@rentfoxxy.com', 'MEMBER', sales);
  const amit = u('Amit Saxena', 'amit@rentfoxxy.com', 'MEMBER', sales);
  const manoj = u('Manoj Yadav (Warehouse Lead)', 'manoj@rentfoxxy.com', 'MANAGER', warehouse);
  const sunil = u('Sunil Pawar', 'sunil@rentfoxxy.com', 'MEMBER', warehouse);
  const rekha = u('Rekha Singh', 'rekha@rentfoxxy.com', 'MEMBER', warehouse);
  const deepak = u('Deepak Sharma (Support Lead)', 'deepak@rentfoxxy.com', 'MANAGER', support);
  const anjali = u('Anjali Verma', 'anjali@rentfoxxy.com', 'MEMBER', support);
  const vikas = u('Vikas Rathi', 'vikas@rentfoxxy.com', 'MEMBER', support);
  const meena = u('Meena Joshi (Accounts Head)', 'meena@rentfoxxy.com', 'MANAGER', accounts);
  const ravi = u('Ravi Menon', 'ravi@rentfoxxy.com', 'MEMBER', accounts);

  const setMgr = db.prepare('UPDATE teams SET manager_id = ? WHERE id = ?');
  setMgr.run(suresh, sales); setMgr.run(manoj, warehouse); setMgr.run(deepak, support); setMgr.run(meena, accounts);

  // ---- Task types — rental laptop business catalogue ----
  const insType = db.prepare(
    'INSERT INTO task_types (team_id, name, alias, description, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const tt = (teamId: number, name: string, alias: string, desc = '') =>
    Number(insType.run(teamId, name, alias, desc, t).lastInsertRowid);

  // Sales
  const ttLead = tt(sales, 'Lead Follow-up', 'Call', 'Outbound calls to rental leads and renewals');
  const ttDemo = tt(sales, 'Client Demo', 'Demo', 'Product/fleet demos for corporate prospects');
  const ttQuote = tt(sales, 'Rental Quotation', 'Quote', 'Prepare & send rental quotations');
  tt(sales, 'Contract Renewal', 'Contract', 'Follow up and close rental contract renewals');
  // Warehouse
  const ttQC = tt(warehouse, 'Laptop QC & Prep', 'Laptop', 'Format, image, test and pack laptops before dispatch');
  const ttDispatch = tt(warehouse, 'Dispatch', 'Order', 'Pick, pack and ship rental orders');
  const ttReturn = tt(warehouse, 'Return Inspection', 'Laptop', 'Inspect and grade returned laptops');
  tt(warehouse, 'Stock Audit', 'SKU', 'Physical verification of rental fleet inventory');
  tt(warehouse, 'Refurbishment', 'Laptop', 'Repair/upgrade laptops back to rentable condition');
  // Support
  const ttTicket = tt(support, 'Ticket Resolution', 'Ticket', 'Customer support ticket closure');
  const ttOnsite = tt(support, 'Onsite Repair', 'Visit', 'Engineer visits at client site');
  tt(support, 'Replacement Request', 'Replacement', 'Swap faulty rental units at client site');
  // Accounts
  const ttInvoice = tt(accounts, 'Invoice Processing', 'Invoice', 'Monthly rental invoicing');
  const ttPayment = tt(accounts, 'Payment Follow-up', 'Payment', 'Chase overdue rental payments');
  tt(accounts, 'Deposit Refund', 'Refund', 'Process security deposit refunds after returns');

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
      .run('Corporate Expansion Q3', 'Target: 500 new laptops on rent to corporate clients this quarter. Sales + Warehouse readiness.', ceo, t)
      .lastInsertRowid
  );
  const insPM = db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)');
  for (const m of [ceo, cto, suresh, neha, manoj, sunil]) insPM.run(projId, m);
  db.prepare('INSERT INTO project_notes (project_id, author_id, body, pinned, created_at) VALUES (?, ?, ?, 1, ?)')
    .run(projId, ceo, 'Fleet availability review every Monday 11:00. Corporate pricing sheet is in Files.', t);

  // 1. Sales: lead follow-ups in progress
  const t1 = task({
    title: 'Follow up 20 corporate leads for bulk laptop rentals',
    description: 'Priority: IT services companies with 50+ seat requirements. Log every call outcome in CRM.',
    status: 'IN_PROGRESS', creator: ceo, assignee: neha, priority: 'HIGH', project: projId,
    type: ttLead, target: 20, delivered: 8,
    due: t + 3 * D, eta: t + 2 * D, ack: t - 5 * H, started: t - 4 * H,
    created: t - 6 * H, sla: addWorkingMinutes(t - 6 * H, 30),
  });
  act.run(t1, ceo, 'CREATED', '{}', t - 6 * H);
  act.run(t1, neha, 'ACKNOWLEDGED', JSON.stringify({ etaAt: t + 2 * D }), t - 5 * H);
  act.run(t1, neha, 'PROGRESS', JSON.stringify({ from: 0, to: 8 }), t - 2 * H);

  // 2. Sales: fresh urgent demo (SLA running)
  const t2 = task({
    title: 'Demo for TechServe Solutions — 50-laptop requirement (tomorrow 4 PM)',
    creator: suresh, assignee: amit, priority: 'URGENT', type: ttDemo, target: 1,
    due: t + 1 * D, created: t - 10 * 60000, sla: addWorkingMinutes(t - 10 * 60000, 30),
  });
  act.run(t2, suresh, 'CREATED', '{}', t - 10 * 60000);

  // 3. Warehouse: QC & prep for a big order, in project
  task({
    title: 'QC & prep 30 laptops for Infoline Technologies order',
    description: 'i5/16GB config. Fresh Windows image, battery health > 80%, charger + bag each.',
    status: 'IN_PROGRESS', creator: manoj, assignee: sunil, project: projId, priority: 'HIGH',
    type: ttQC, target: 30, delivered: 22,
    due: t + 2 * D, eta: t + 2 * D, ack: t - 1 * D, started: t - 1 * D,
    created: t - 1 * D, sla: addWorkingMinutes(t - 1 * D, 30),
  });

  // 4. Warehouse: return inspection — target met, ready to close
  const t4 = task({
    title: 'Inspect 15 returned laptops from Vertex Consulting batch',
    status: 'IN_PROGRESS', creator: manoj, assignee: rekha,
    type: ttReturn, target: 15, delivered: 15,
    due: t + 1 * D, eta: t + 1 * D, ack: t - 2 * D, started: t - 2 * D,
    created: t - 2 * D, sla: addWorkingMinutes(t - 2 * D, 30),
  });
  act.run(t4, rekha, 'PROGRESS', JSON.stringify({ from: 12, to: 15 }), t - 1 * H);

  // 5. Support: escalated ticket backlog, awaiting mandatory explanation
  const t5 = task({
    title: 'Clear support ticket backlog before weekend',
    status: 'ESCALATED', creator: deepak, assignee: anjali,
    type: ttTicket, target: 25, delivered: 12,
    due: t - 1 * D, eta: t - 1 * D, ack: t - 3 * D, escalated: t - 18 * H,
    created: t - 3 * D, sla: addWorkingMinutes(t - 3 * D, 30),
  });
  db.prepare('INSERT INTO escalations (task_id, created_at) VALUES (?, ?)').run(t5, t - 18 * H);
  act.run(t5, null, 'ESCALATED', '{}', t - 18 * H);

  // 6. Support: onsite visits, SLA breached (no response)
  const t6 = task({
    title: 'Onsite visit — Acme Corp, 5 laptops not booting',
    creator: deepak, assignee: vikas, priority: 'URGENT',
    type: ttOnsite, target: 5,
    due: t + 1 * D, created: t - 5 * H, sla: addWorkingMinutes(t - 5 * H, 30), breached: t - 4 * H,
  });
  act.run(t6, deepak, 'CREATED', '{}', t - 5 * H);

  // 7. Accounts: monthly invoicing in progress
  task({
    title: 'Process July rental invoices',
    status: 'IN_PROGRESS', creator: meena, assignee: ravi,
    type: ttInvoice, target: 40, delivered: 17,
    due: t + 2 * D, eta: t + 2 * D, ack: t - 1 * D, started: t - 1 * D,
    created: t - 1 * D, sla: addWorkingMinutes(t - 1 * D, 30),
  });

  // 8. Accounts: payment follow-ups done on time
  const t8 = task({
    title: 'Collect overdue payments — June cycle',
    status: 'DONE', creator: meena, assignee: ravi,
    type: ttPayment, target: 12, delivered: 12,
    due: t - 12 * H, eta: t - 1 * D, ack: t - 4 * D, done: t - 1 * D,
    created: t - 4 * D, sla: addWorkingMinutes(t - 4 * D, 30),
  });
  act.run(t8, ravi, 'DONE', '{}', t - 1 * D);

  // 9. Team-level task for Warehouse
  const t9 = task({
    title: 'Prepare fleet availability report for Q3 corporate push',
    creator: ceo, team: warehouse, priority: 'HIGH', project: projId,
    due: t + 4 * D, created: t - 2 * H, sla: addWorkingMinutes(t - 2 * H, 30),
  });
  act.run(t9, ceo, 'CREATED', '{}', t - 2 * H);

  // 10. Batch: CEO sent 3 tasks in one message to Amit
  const batch = 'batch-seed-1';
  for (const title of ['Collect testimonials from top 5 rental clients', 'Update CRM stage for open corporate deals', 'Share competitor rental pricing notes']) {
    const id = task({
      title, creator: ceo, assignee: amit, batch,
      due: t + 2 * D, created: t - 1 * H, sla: addWorkingMinutes(t - 1 * H, 30),
    });
    act.run(id, ceo, 'CREATED', JSON.stringify({ batch }), t - 1 * H);
  }

  // Notifications so bells have content
  const insN = db.prepare('INSERT INTO notifications (user_id, type, title, body, task_id, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  insN.run(amit, 'ASSIGNED', 'New task: "Demo for TechServe Solutions — 50-laptop requirement (tomorrow 4 PM)"', 'Assigned by Suresh. Respond within 30 minutes.', t2, t - 10 * 60000);
  insN.run(manoj, 'PROGRESS', 'Target met: 15/15 Laptop on "Inspect 15 returned laptops from Vertex Consulting batch"', 'Ready to close.', t4, t - 1 * H);
  insN.run(anjali, 'ESCALATED', 'Escalated: "Clear support ticket backlog before weekend" passed its due date', 'A written explanation is now mandatory.', t5, t - 18 * H);
  insN.run(vikas, 'SLA_BREACH', 'No response: "Onsite visit — Acme Corp, 5 laptops not booting"', '', t6, t - 4 * H);
}
