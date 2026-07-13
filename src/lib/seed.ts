import bcrypt from 'bcryptjs';
import { addWorkingMinutes } from './sla';

export function seed(db: any) {
  const t = Date.now();
  const hash = bcrypt.hashSync('password123', 10);
  const H = 3600 * 1000, D = 24 * H;

  const insTeam = db.prepare('INSERT INTO teams (name) VALUES (?)');
  const engId = Number(insTeam.run('Engineering').lastInsertRowid);
  const desId = Number(insTeam.run('Design').lastInsertRowid);
  const mktId = Number(insTeam.run('Marketing').lastInsertRowid);

  const insUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, team_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const u = (name: string, email: string, role: string, teamId: number | null) =>
    Number(insUser.run(name, email, hash, role, teamId, t).lastInsertRowid);

  const admin = u('Kumar Bibhaw Raj', 'admin@company.com', 'ADMIN', null);
  const ceo = u('CEO', 'ceo@company.com', 'CEO', null);
  const rohan = u('Rohan Mehta', 'rohan@company.com', 'MANAGER', engId);
  const priya = u('Priya Sharma', 'priya@company.com', 'MANAGER', desId);
  const arjun = u('Arjun Verma', 'arjun@company.com', 'MANAGER', mktId);
  const ananya = u('Ananya Iyer', 'ananya@company.com', 'MEMBER', engId);
  const vikram = u('Vikram Singh', 'vikram@company.com', 'MEMBER', engId);
  const sneha = u('Sneha Patel', 'sneha@company.com', 'MEMBER', desId);
  const karan = u('Karan Gupta', 'karan@company.com', 'MEMBER', desId);
  const divya = u('Divya Nair', 'divya@company.com', 'MEMBER', mktId);
  const rahul = u('Rahul Joshi', 'rahul@company.com', 'MEMBER', mktId);

  db.prepare('UPDATE teams SET manager_id = ? WHERE id = ?').run(rohan, engId);
  db.prepare('UPDATE teams SET manager_id = ? WHERE id = ?').run(priya, desId);
  db.prepare('UPDATE teams SET manager_id = ? WHERE id = ?').run(arjun, mktId);

  const insTask = db.prepare(`INSERT INTO tasks
    (title, description, status, priority, creator_id, assignee_id, assigned_team_id, project_id, parent_id, batch_id,
     due_at, eta_at, acknowledged_at, started_at, done_at, sla_deadline_at, sla_breached_at, escalated_at, created_at, updated_at)
    VALUES (@title, @description, @status, @priority, @creator, @assignee, @team, @project, @parent, @batch,
     @due, @eta, @ack, @started, @done, @sla, @breached, @escalated, @created, @updated)`);
  const task = (o: any) =>
    Number(
      insTask.run({
        description: '', status: 'ASSIGNED', priority: 'NORMAL', assignee: null, team: null, project: null,
        parent: null, batch: null, eta: null, ack: null, started: null, done: null,
        sla: null, breached: null, escalated: null, created: t, updated: t, ...o,
      }).lastInsertRowid
    );

  const act = db.prepare('INSERT INTO activity (task_id, actor_id, type, meta, created_at) VALUES (?, ?, ?, ?, ?)');

  // Project
  const projId = Number(
    db.prepare('INSERT INTO projects (name, description, owner_id, created_at) VALUES (?, ?, ?, ?)')
      .run('Website Revamp', 'Complete redesign of the corporate website: new brand, new CMS, mobile-first.', ceo, t)
      .lastInsertRowid
  );
  const insPM = db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)');
  for (const m of [ceo, priya, sneha, karan, ananya]) insPM.run(projId, m);
  db.prepare('INSERT INTO project_notes (project_id, author_id, body, pinned, created_at) VALUES (?, ?, ?, 1, ?)')
    .run(projId, ceo, 'Launch target: end of this quarter. Weekly sync every Monday 11:00.', t);
  db.prepare('INSERT INTO project_notes (project_id, author_id, body, pinned, created_at) VALUES (?, ?, ?, 0, ?)')
    .run(projId, priya, 'Moodboard and typography options are in the Files tab.', t);

  // 1. In-progress, acknowledged
  const t1 = task({
    title: 'Prepare Q3 sales dashboard', description: 'Consolidate region-wise numbers, add YoY comparison.',
    status: 'IN_PROGRESS', creator: ceo, assignee: ananya, priority: 'HIGH',
    due: t + 2 * D, eta: t + 1 * D, ack: t - 3 * H, started: t - 2 * H,
    created: t - 4 * H, sla: addWorkingMinutes(t - 4 * H, 30),
  });
  act.run(t1, ceo, 'CREATED', '{}', t - 4 * H);
  act.run(t1, ananya, 'ACKNOWLEDGED', JSON.stringify({ etaAt: t + 1 * D }), t - 3 * H);

  // 2. Fresh, awaiting acknowledgment (SLA running)
  const t2 = task({
    title: 'Fix login page redirect bug', description: 'Users report a loop after password reset.',
    creator: ceo, assignee: vikram, priority: 'URGENT',
    due: t + 1 * D, created: t - 5 * 60000, sla: addWorkingMinutes(t - 5 * 60000, 30),
  });
  act.run(t2, ceo, 'CREATED', '{}', t - 5 * 60000);

  // 3. Batch of 3 (one message -> 3 tasks)
  const batch = 'batch-seed-1';
  for (const title of ['Update API documentation', 'Write integration tests for payments', 'Deploy staging environment']) {
    const id = task({
      title, creator: rohan, assignee: ananya, batch,
      due: t + 1 * D, created: t - 1 * H, sla: addWorkingMinutes(t - 1 * H, 30),
    });
    act.run(id, rohan, 'CREATED', JSON.stringify({ batch }), t - 1 * H);
  }

  // 4. Task with 3 subtasks, 1 done — in Website Revamp project
  const t4 = task({
    title: 'Landing page redesign', description: 'New hero, testimonials section and pricing table.',
    status: 'IN_PROGRESS', creator: ceo, assignee: sneha, project: projId, priority: 'HIGH',
    due: t + 3 * D, eta: t + 2 * D, ack: t - 1 * D, started: t - 20 * H,
    created: t - 26 * H, sla: addWorkingMinutes(t - 26 * H, 30),
  });
  act.run(t4, ceo, 'CREATED', '{}', t - 26 * H);
  const s1 = task({
    title: 'Hero section mockup', status: 'DONE', creator: sneha, assignee: sneha, parent: t4, project: projId,
    due: t + 1 * D, done: t - 2 * H, created: t - 20 * H,
  });
  act.run(s1, sneha, 'DONE', '{}', t - 2 * H);
  task({ title: 'Testimonials carousel', creator: sneha, assignee: karan, parent: t4, project: projId, due: t + 2 * D, created: t - 20 * H, sla: addWorkingMinutes(t - 20 * H, 30) });
  task({ title: 'Pricing table responsive layout', creator: sneha, assignee: sneha, parent: t4, project: projId, due: t + 3 * D, created: t - 20 * H });

  // 5. Escalated, awaiting mandatory explanation
  const t5 = task({
    title: 'Brand guidelines document', status: 'ESCALATED', creator: priya, assignee: karan,
    due: t - 1 * D, eta: t - 1 * D, ack: t - 3 * D, escalated: t - 20 * H,
    created: t - 4 * D, sla: addWorkingMinutes(t - 4 * D, 30),
  });
  db.prepare('INSERT INTO escalations (task_id, created_at) VALUES (?, ?)').run(t5, t - 20 * H);
  act.run(t5, null, 'ESCALATED', '{}', t - 20 * H);

  // 6. Escalated, explanation submitted, pending review
  const t6 = task({
    title: 'Festive campaign creatives', status: 'ESCALATED', creator: arjun, assignee: divya,
    due: t - 2 * D, eta: t - 2 * D, ack: t - 4 * D, escalated: t - 2 * D,
    created: t - 5 * D, sla: addWorkingMinutes(t - 5 * D, 30),
  });
  db.prepare(`INSERT INTO escalations (task_id, explanation, explanation_at, proposed_eta_at, review_status, created_at)
    VALUES (?, ?, ?, ?, 'PENDING', ?)`)
    .run(t6, 'Vendor delivered raw footage two days late; editing is underway and final cut needs one more day.', t - 1 * D, t + 1 * D, t - 2 * D);
  act.run(t6, divya, 'EXPLANATION', '{}', t - 1 * D);

  // 7. Done on time
  const t7 = task({
    title: 'Social media calendar for July', status: 'DONE', creator: arjun, assignee: rahul,
    due: t - 12 * H, eta: t - 1 * D, ack: t - 3 * D, done: t - 1 * D,
    created: t - 4 * D, sla: addWorkingMinutes(t - 4 * D, 30),
  });
  act.run(t7, rahul, 'DONE', '{}', t - 1 * D);

  // 8. No-response (SLA breached)
  const t8 = task({
    title: 'Compile competitor pricing sheet', creator: ceo, assignee: rahul,
    due: t + 1 * D, created: t - 5 * H, sla: addWorkingMinutes(t - 5 * H, 30), breached: t - 4 * H,
  });
  act.run(t8, ceo, 'CREATED', '{}', t - 5 * H);

  // 9. Team-level task
  const t9 = task({
    title: 'Quarterly server security audit', creator: admin, team: engId, priority: 'HIGH',
    due: t + 5 * D, created: t - 2 * H, sla: addWorkingMinutes(t - 2 * H, 30),
  });
  act.run(t9, admin, 'CREATED', '{}', t - 2 * H);

  // A few notifications so the bell has content
  const insN = db.prepare('INSERT INTO notifications (user_id, type, title, body, task_id, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  insN.run(vikram, 'ASSIGNED', 'New task: "Fix login page redirect bug"', 'Assigned by CEO. Respond within 30 minutes.', t2, t - 5 * 60000);
  insN.run(rahul, 'SLA_BREACH', 'No response: "Compile competitor pricing sheet"', '', t8, t - 4 * H);
  insN.run(karan, 'ESCALATED', 'Escalated: "Brand guidelines document" passed its due date', 'A written explanation is now mandatory.', t5, t - 20 * H);
}
