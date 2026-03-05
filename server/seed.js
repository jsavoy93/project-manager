const { db, runMigrations } = require('./lib/db');

runMigrations();

// Clear existing data
db.exec('DELETE FROM task_history');
db.exec('DELETE FROM comments');
db.exec('DELETE FROM task_tags');
db.exec('DELETE FROM task_dependencies');
db.exec('DELETE FROM tasks');
db.exec('DELETE FROM task_groups');
db.exec('DELETE FROM team_members');
db.exec('DELETE FROM projects');

// Reset autoincrement
db.exec("DELETE FROM sqlite_sequence");

// Team members
const insertMember = db.prepare('INSERT INTO team_members (name, email, avatar_color, role) VALUES (?, ?, ?, ?)');
insertMember.run('Sarah Chen', 'sarah@example.com', '#4F46E5', 'Project Lead');
insertMember.run('Marcus Johnson', 'marcus@example.com', '#0D9488', 'Frontend Developer');
insertMember.run('Emily Rodriguez', 'emily@example.com', '#E11D48', 'Backend Developer');
insertMember.run('David Kim', 'david@example.com', '#F59E0B', 'UI/UX Designer');
insertMember.run('Alex Thompson', 'alex@example.com', '#8B5CF6', 'DevOps Engineer');

// Project
const projResult = db.prepare(
  "INSERT INTO projects (name, description, color) VALUES (?, ?, ?)"
).run('Website Redesign', 'Complete redesign of the corporate website with modern stack, improved UX, and mobile-first approach.', '#4F46E5');
const projectId = projResult.lastInsertRowid;

// Groups
const insertGroup = db.prepare('INSERT INTO task_groups (project_id, name, color, position) VALUES (?, ?, ?, ?)');
insertGroup.run(projectId, 'Discovery', '#6366F1', 1);
insertGroup.run(projectId, 'Design', '#EC4899', 2);
insertGroup.run(projectId, 'Development', '#0D9488', 3);
insertGroup.run(projectId, 'Launch', '#F59E0B', 4);

// Helper for dates relative to today
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const insertTask = db.prepare(`
  INSERT INTO tasks (project_id, title, description, status, priority, start_date, end_date,
    percent_complete, assigned_to, group_id, milestone, color, position, baseline_start, baseline_end, recurrence)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Discovery tasks
insertTask.run(projectId, 'Stakeholder interviews', 'Conduct interviews with key stakeholders to gather requirements and expectations.', 'done', 'high', dateOffset(-30), dateOffset(-25), 100, '1', 1, 0, null, 1, dateOffset(-30), dateOffset(-25), null);
insertTask.run(projectId, 'Competitor analysis', 'Analyze top 5 competitor websites for design patterns and features.', 'done', 'medium', dateOffset(-28), dateOffset(-22), 100, '4', 1, 0, null, 2, dateOffset(-28), dateOffset(-22), null);
insertTask.run(projectId, 'User research & personas', 'Create user personas based on analytics data and interview findings.', 'done', 'high', dateOffset(-24), dateOffset(-18), 100, '1,4', 1, 0, null, 3, dateOffset(-24), dateOffset(-18), null);
insertTask.run(projectId, 'Discovery phase complete', 'All discovery deliverables reviewed and approved.', 'done', 'critical', dateOffset(-18), dateOffset(-18), 100, '1', 1, 1, null, 4, dateOffset(-18), dateOffset(-18), null);

// Design tasks
insertTask.run(projectId, 'Wireframes - Homepage', 'Low-fidelity wireframes for the homepage layout.', 'done', 'high', dateOffset(-17), dateOffset(-12), 100, '4', 2, 0, null, 5, dateOffset(-17), dateOffset(-12), null);
insertTask.run(projectId, 'Wireframes - Inner pages', 'Wireframes for About, Services, Contact, and Blog pages.', 'done', 'medium', dateOffset(-14), dateOffset(-8), 100, '4', 2, 0, null, 6, dateOffset(-14), dateOffset(-8), null);
insertTask.run(projectId, 'Visual design system', 'Define colors, typography, spacing, components in Figma.', 'in_progress', 'high', dateOffset(-10), dateOffset(-2), 75, '4', 2, 0, null, 7, dateOffset(-10), dateOffset(-4), null);
insertTask.run(projectId, 'High-fidelity mockups', 'Pixel-perfect mockups for all pages based on approved wireframes.', 'in_progress', 'high', dateOffset(-5), dateOffset(5), 40, '4,2', 2, 0, null, 8, dateOffset(-5), dateOffset(3), null);
insertTask.run(projectId, 'Design review & approval', 'Final design sign-off from stakeholders.', 'todo', 'critical', dateOffset(5), dateOffset(7), 0, '1,4', 2, 1, null, 9, dateOffset(5), dateOffset(7), null);

// Development tasks
insertTask.run(projectId, 'Setup project infrastructure', 'Initialize repo, CI/CD pipeline, staging environment.', 'in_progress', 'critical', dateOffset(-3), dateOffset(2), 60, '5', 3, 0, null, 10, dateOffset(-3), dateOffset(2), null);
insertTask.run(projectId, 'Frontend - Homepage', 'Implement homepage with hero, features section, testimonials.', 'todo', 'high', dateOffset(3), dateOffset(12), 0, '2', 3, 0, null, 11, dateOffset(3), dateOffset(12), null);
insertTask.run(projectId, 'Frontend - Inner pages', 'Build out all inner page templates.', 'todo', 'medium', dateOffset(8), dateOffset(18), 0, '2', 3, 0, null, 12, dateOffset(8), dateOffset(18), null);
insertTask.run(projectId, 'Backend API & CMS integration', 'Connect to headless CMS, build API endpoints for dynamic content.', 'todo', 'high', dateOffset(5), dateOffset(16), 0, '3', 3, 0, null, 13, dateOffset(5), dateOffset(16), null);
insertTask.run(projectId, 'QA & Testing', 'Cross-browser testing, accessibility audit, performance testing.', 'todo', 'high', dateOffset(16), dateOffset(22), 0, '2,3', 3, 0, null, 14, dateOffset(16), dateOffset(22), null);

// Launch
insertTask.run(projectId, 'Production deployment', 'Deploy to production with zero-downtime migration.', 'todo', 'critical', dateOffset(22), dateOffset(24), 0, '5', 4, 1, null, 15, dateOffset(22), dateOffset(24), null);

// Tags
const insertTag = db.prepare('INSERT INTO task_tags (task_id, tag) VALUES (?, ?)');
insertTag.run(1, 'research'); insertTag.run(1, 'stakeholder');
insertTag.run(2, 'research'); insertTag.run(2, 'competitive');
insertTag.run(3, 'research'); insertTag.run(3, 'ux');
insertTag.run(5, 'design'); insertTag.run(5, 'wireframe');
insertTag.run(6, 'design'); insertTag.run(6, 'wireframe');
insertTag.run(7, 'design'); insertTag.run(7, 'design-system');
insertTag.run(8, 'design'); insertTag.run(8, 'mockup');
insertTag.run(10, 'devops'); insertTag.run(10, 'infrastructure');
insertTag.run(11, 'frontend'); insertTag.run(11, 'react');
insertTag.run(12, 'frontend'); insertTag.run(12, 'react');
insertTag.run(13, 'backend'); insertTag.run(13, 'api');
insertTag.run(14, 'qa'); insertTag.run(14, 'testing');
insertTag.run(15, 'devops'); insertTag.run(15, 'deployment');

// Dependencies (Finish-to-Start)
const insertDep = db.prepare('INSERT INTO task_dependencies (predecessor_task_id, successor_task_id, dependency_type, lag_days) VALUES (?, ?, ?, ?)');
insertDep.run(1, 3, 'FS', 0);   // Interviews → Personas
insertDep.run(2, 3, 'FS', 0);   // Competitor → Personas
insertDep.run(3, 4, 'FS', 0);   // Personas → Discovery milestone
insertDep.run(4, 5, 'FS', 0);   // Discovery → Wireframes
insertDep.run(5, 6, 'SS', 2);   // Homepage wireframes → Inner pages (start-to-start with 2 day lag)
insertDep.run(5, 7, 'FS', 0);   // Wireframes → Design system
insertDep.run(6, 8, 'FS', 0);   // Inner wireframes → HiFi mockups
insertDep.run(7, 8, 'SS', 0);   // Design system → HiFi mockups (start-to-start)
insertDep.run(8, 9, 'FS', 0);   // Mockups → Design review
insertDep.run(9, 11, 'FS', 0);  // Design review → Frontend homepage
insertDep.run(10, 11, 'FS', 0); // Infrastructure → Frontend homepage
insertDep.run(11, 12, 'FS', -2);// Homepage → Inner pages (2 day lead)
insertDep.run(10, 13, 'FS', 2); // Infrastructure → Backend (2 day lag)
insertDep.run(12, 14, 'FF', 0); // Inner pages → QA (finish-to-finish)
insertDep.run(13, 14, 'FF', 0); // Backend → QA (finish-to-finish)
insertDep.run(14, 15, 'FS', 0); // QA → Deploy

// Comments
const insertComment = db.prepare('INSERT INTO comments (task_id, author_id, body) VALUES (?, ?, ?)');
insertComment.run(1, 1, 'Completed interviews with CEO, CTO, and Marketing Director. Key takeaway: mobile experience is top priority.');
insertComment.run(1, 4, 'I have the notes compiled. Will share the synthesis document by EOD.');
insertComment.run(7, 4, 'Design system is coming along nicely. Color palette and typography are locked. Working on component library now.');
insertComment.run(7, 2, 'Looking forward to the component library - will speed up frontend development significantly.');
insertComment.run(10, 5, 'CI/CD pipeline is set up with GitHub Actions. Staging deploys on every PR merge.');
insertComment.run(10, 3, 'Can we add a database migration step to the pipeline? Will need it for the CMS integration.');
insertComment.run(8, 1, 'Let\'s make sure the mockups include responsive breakpoints for tablet and mobile.');

console.log('Seed data created successfully!');
console.log('- 1 project');
console.log('- 4 groups');
console.log('- 15 tasks with dependencies');
console.log('- 5 team members');
console.log('- 7 comments');
process.exit(0);
