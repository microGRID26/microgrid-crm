-- 085b-qa-seed-data.sql
-- Seed data: 8 test plans with 5-8 test cases each
-- Written for testers (Zach, Marlie, Heidi) who may not know every feature

-- ============================================================
-- PLAN 1: Project Management (critical)
-- ============================================================
INSERT INTO test_plans (id, name, description, role_filter, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000001',
   'Project Management',
   'Core project CRUD, search, stage changes, notes, dispositions, and blocker detection. These are the most-used workflows in MicroGRID.',
   'all', 1);

INSERT INTO test_cases (plan_id, title, instructions, expected_result, page_url, priority, sort_order) VALUES
-- 1.1
('a0000001-0000-0000-0000-000000000001',
 'Create a new project',
 'Step 1: Click the "+ New Project" button in the top-right of the Pipeline page (or use the Command Bar shortcut).
Step 2: Fill in the following fields — Project Name: "QA Test Home 001", Address: "123 Main St, Phoenix, AZ 85001", Phone: "(602) 555-0100", Email: "qatest@example.com".
Step 3: Assign a Project Manager from the dropdown (pick any PM).
Step 4: Click "Create" or "Save".
Step 5: Verify the new project card appears in the first pipeline stage.',
 'A new project card appears in the pipeline with the name "QA Test Home 001", the correct address, and the assigned PM displayed on the card.',
 '/pipeline', 'critical', 1),

-- 1.2
('a0000001-0000-0000-0000-000000000001',
 'Search for a project by name and ID',
 'Step 1: Navigate to the Pipeline page.
Step 2: Locate the search bar at the top of the page.
Step 3: Type "QA Test Home 001" and press Enter or wait for auto-complete.
Step 4: Verify the project appears in the results.
Step 5: Clear the search, then search by the project ID number (visible on the card or in the URL).',
 'Both searches return the correct project. The search results update as you type. No other unrelated projects appear for an exact-name search.',
 '/pipeline', 'critical', 2),

-- 1.3
('a0000001-0000-0000-0000-000000000001',
 'Open ProjectPanel and verify all tabs load',
 'Step 1: Click on any project card in the pipeline to open the ProjectPanel slideout.
Step 2: The panel should open on the right side of the screen.
Step 3: Click through EVERY tab in the panel (Overview, Documents, Notes, History, Funding, Equipment, etc.).
Step 4: Wait for each tab to fully load before moving to the next.
Step 5: Note any tabs that show errors, blank content, or infinite loading spinners.',
 'Every tab in the ProjectPanel loads without errors. Each tab displays either real data or an appropriate empty-state message (e.g., "No documents uploaded yet").',
 '/pipeline', 'critical', 3),

-- 1.4
('a0000001-0000-0000-0000-000000000001',
 'Change project stage manually',
 'Step 1: Open a project''s ProjectPanel.
Step 2: Look for the stage/status dropdown or badge (usually near the top of the panel).
Step 3: Change the stage from its current value to the next stage (e.g., "Welcome Call" to "Site Survey").
Step 4: Confirm the change if prompted.
Step 5: Close the panel and verify the project card moved to the correct column on the Kanban board.',
 'The stage updates immediately. The project card moves to the correct Kanban column. The History tab logs the stage change with timestamp.',
 '/pipeline', 'high', 4),

-- 1.5
('a0000001-0000-0000-0000-000000000001',
 'Add a project note with @mention',
 'Step 1: Open any project''s ProjectPanel and go to the Notes tab.
Step 2: Click "Add Note" or the text input area.
Step 3: Type: "QA testing note — @Zach please review this project."
Step 4: Verify the @mention auto-completes or highlights.
Step 5: Click Save/Submit.
Step 6: Refresh the page and confirm the note persists.',
 'The note saves successfully with the @mention visible and styled differently (highlighted or linked). After refresh, the note still appears in chronological order.',
 '/pipeline', 'high', 5),

-- 1.6
('a0000001-0000-0000-0000-000000000001',
 'Change project disposition (Sale to Loyalty)',
 'Step 1: Open a project in the ProjectPanel.
Step 2: Find the Disposition field (may be in Overview tab or a dropdown near the stage).
Step 3: Change the disposition from "Sale" to "Loyalty".
Step 4: Save the change.
Step 5: Confirm the disposition badge or label updates on the project card.',
 'The disposition updates without error. The project card reflects the new disposition. History tab logs the change.',
 '/pipeline', 'medium', 6),

-- 1.7
('a0000001-0000-0000-0000-000000000001',
 'Verify blocker detection on stuck projects',
 'Step 1: Navigate to the Command page (/command).
Step 2: Look for the "Fix These First" section — it highlights projects with blockers.
Step 3: Identify a project that has been in the same stage for an extended time.
Step 4: Open that project and verify the blocker badge or warning is visible.
Step 5: Check if the blocker reason is descriptive (e.g., "Missing site survey photos", "Awaiting permit approval").',
 'The Command page displays projects with blockers. Each blocker shows a reason. Clicking a blocked project opens its panel with the blocker details visible.',
 '/command', 'high', 7);


-- ============================================================
-- PLAN 2: Pipeline & Queue (critical)
-- ============================================================
INSERT INTO test_plans (id, name, description, role_filter, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000002',
   'Pipeline & Queue',
   'Kanban board, queue views, command page, PM filtering, and CSV export. Tests the primary day-to-day workflow for ops staff.',
   'all', 2);

INSERT INTO test_cases (plan_id, title, instructions, expected_result, page_url, priority, sort_order) VALUES
-- 2.1
('a0000001-0000-0000-0000-000000000002',
 'View pipeline Kanban — verify all stages',
 'Step 1: Navigate to /pipeline.
Step 2: The Kanban board should load with multiple columns, one per project stage.
Step 3: Count the columns and compare to the expected stages (Welcome Call, Site Survey, Design, Permit, Install, Inspection, PTO, Complete, etc.).
Step 4: Verify each column header shows a project count.
Step 5: Scroll horizontally if needed to see all columns.',
 'All expected pipeline stages appear as columns. Each column shows a count badge. Project cards are sorted within each column. No columns are missing or duplicated.',
 '/pipeline', 'critical', 1),

-- 2.2
('a0000001-0000-0000-0000-000000000002',
 'Drag a project card to a different stage',
 'Step 1: On the Pipeline Kanban board, pick a project card in any stage.
Step 2: Click and hold the card, then drag it to the next stage column.
Step 3: Release the card in the new column.
Step 4: If drag-and-drop is not supported, note that in your feedback.
Step 5: Verify the card stays in the new column after releasing.',
 'The card moves to the new stage column. A success toast or confirmation appears. If drag-and-drop is not implemented, the test should be marked "blocked" with a note.',
 '/pipeline', 'high', 2),

-- 2.3
('a0000001-0000-0000-0000-000000000002',
 'Open Command page — verify sections',
 'Step 1: Navigate to /command.
Step 2: Look for the "Fix These First" section — this shows projects with blockers or issues.
Step 3: Look for the "Push These Forward" section — this shows projects ready for the next step.
Step 4: Click on at least one project in each section to verify the link opens the correct project.
Step 5: Check that project counts are displayed for each section.',
 'Both "Fix These First" and "Push These Forward" sections are visible and populated. Clicking a project opens the correct ProjectPanel. Counts match the visible cards.',
 '/command', 'critical', 3),

-- 2.4
('a0000001-0000-0000-0000-000000000002',
 'Use PM filter dropdown',
 'Step 1: On the Pipeline page, find the PM filter dropdown (usually top area).
Step 2: Select a specific Project Manager from the list.
Step 3: Verify the Kanban board updates to show only that PM''s projects.
Step 4: Navigate to /command while the filter is still active.
Step 5: Verify the Command page also respects the PM filter.
Step 6: Clear the filter and verify all projects return.',
 'Selecting a PM filters projects across Pipeline and Command pages. Only that PM''s projects are shown. Clearing the filter restores all projects. The filter persists across page navigation.',
 '/pipeline', 'high', 4),

-- 2.5
('a0000001-0000-0000-0000-000000000002',
 'Export projects to CSV',
 'Step 1: Navigate to /pipeline or /queue.
Step 2: Look for an "Export" or "Download CSV" button (often in the toolbar or a dropdown menu).
Step 3: Click the export button.
Step 4: A CSV file should download to your computer.
Step 5: Open the CSV and verify it contains project names, stages, PMs, dates, and other key fields.
Step 6: Verify the row count matches the visible project count (accounting for any active filters).',
 'A CSV file downloads successfully. It contains all visible projects with correct data. Column headers are readable. The file opens properly in Excel or Google Sheets.',
 '/pipeline', 'medium', 5),

-- 2.6
('a0000001-0000-0000-0000-000000000002',
 'Open Queue page and verify table view',
 'Step 1: Navigate to /queue.
Step 2: The page should display a table/list view of all projects.
Step 3: Verify the table shows columns like Project Name, Stage, PM, Address, Last Updated.
Step 4: Click a column header to sort by that column.
Step 5: Click a row to open the ProjectPanel for that project.',
 'The Queue page loads a table with all projects. Sorting works on at least the main columns. Clicking a row opens the correct project. Data matches what is shown on the Pipeline Kanban.',
 '/queue', 'high', 6);


-- ============================================================
-- PLAN 3: Scheduling & Crews (high)
-- ============================================================
INSERT INTO test_plans (id, name, description, role_filter, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000003',
   'Scheduling & Crews',
   'Schedule creation, crew assignment, batch completion, and schedule suggestions. These workflows drive field operations.',
   'all', 3);

INSERT INTO test_cases (plan_id, title, instructions, expected_result, page_url, priority, sort_order) VALUES
-- 3.1
('a0000001-0000-0000-0000-000000000003',
 'Navigate to Schedule page and view week',
 'Step 1: Navigate to /schedule.
Step 2: The calendar or schedule view should load, defaulting to the current week.
Step 3: Use the week navigation arrows (< >) to move forward and backward one week.
Step 4: Verify dates update correctly in the header.
Step 5: If there are any scheduled jobs, verify they display on the correct day.',
 'The Schedule page loads a weekly view with correct date headers. Navigation arrows move the week forward/back. Existing jobs (if any) appear on the correct day slots.',
 '/schedule', 'high', 1),

-- 3.2
('a0000001-0000-0000-0000-000000000003',
 'Create a new schedule entry',
 'Step 1: On the Schedule page, click "Add" or "+" or click on an empty day slot.
Step 2: In the scheduling form, select a Project from the dropdown (search by name if needed).
Step 3: Select a Crew from the crew dropdown.
Step 4: Choose a Date (use today or tomorrow).
Step 5: Select a Job Type (e.g., "Install", "Site Survey", "Inspection").
Step 6: Click Save.
Step 7: Verify the new entry appears on the calendar on the correct day.',
 'The schedule entry is created and immediately visible on the calendar. It shows the project name, crew, and job type. The correct date slot is populated.',
 '/schedule', 'critical', 2),

-- 3.3
('a0000001-0000-0000-0000-000000000003',
 'Complete jobs via batch complete',
 'Step 1: On the Schedule page, look for a "Batch Complete" or "Complete Day" button for a day with scheduled jobs.
Step 2: Click the batch complete action.
Step 3: A modal or checklist should appear showing all jobs for that day.
Step 4: Check off the jobs you want to mark complete.
Step 5: Click "Confirm" or "Complete".
Step 6: Verify the job cards update to show a completed status (checkmark, green highlight, or "Complete" badge).',
 'Batch completion marks selected jobs as done. The UI updates to reflect completed status. The project''s history should log the completion event.',
 '/schedule', 'high', 3),

-- 3.4
('a0000001-0000-0000-0000-000000000003',
 'View crew page and verify job cards',
 'Step 1: Navigate to /crew.
Step 2: The page should list all crews (install teams, survey teams, etc.).
Step 3: Click on a specific crew to open their detail view.
Step 4: Verify you can see their upcoming jobs, completed jobs, and any capacity information.
Step 5: Confirm job cards show project name, date, job type, and status.',
 'The Crew page lists all crews. Clicking a crew shows their schedule and job history. Job cards display project name, date, type, and status without errors.',
 '/crew', 'high', 4),

-- 3.5
('a0000001-0000-0000-0000-000000000003',
 'Check Schedule Suggestions panel',
 'Step 1: On the Schedule page, look for a "Suggestions" panel or sidebar.
Step 2: If collapsed, click to expand it.
Step 3: The panel should show projects that are ready to be scheduled but don''t have a date yet.
Step 4: Verify the suggestions include the project name and the recommended job type.
Step 5: If a "Schedule" or "Add" action is available on a suggestion, click it and verify it pre-fills the scheduling form.',
 'The Suggestions panel shows projects awaiting scheduling. Each suggestion includes project name and recommended action. Clicking a suggestion pre-fills or opens the scheduling form.',
 '/schedule', 'medium', 5),

-- 3.6
('a0000001-0000-0000-0000-000000000003',
 'Verify proximity clustering on schedule',
 'Step 1: On the Schedule page, look for a map view or a "Route" button that shows jobs grouped by location.
Step 2: If available, switch to map view.
Step 3: Verify that jobs scheduled on the same day for the same crew are clustered or shown with routing lines.
Step 4: If proximity clustering is not visible, mark as "skipped" and note in feedback.',
 'Jobs are grouped by geographic proximity. If a map view exists, pins appear for each job and crews'' routes are visible. Nearby jobs are visually clustered.',
 '/schedule', 'medium', 6);


-- ============================================================
-- PLAN 4: Funding & Finance (high)
-- ============================================================
INSERT INTO test_plans (id, name, description, role_filter, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000004',
   'Funding & Finance',
   'Milestone funding (M1/M2/M3), job costing, crew rates, and manual cost entries. Critical for revenue tracking.',
   'manager', 4);

INSERT INTO test_cases (plan_id, title, instructions, expected_result, page_url, priority, sort_order) VALUES
-- 4.1
('a0000001-0000-0000-0000-000000000004',
 'Open Funding page — verify milestones',
 'Step 1: Navigate to /funding.
Step 2: The page should load with milestone sections: M1 (Contract Signed), M2 (Install Complete), M3 (PTO/Final).
Step 3: Each milestone section should show a list of projects eligible for that milestone.
Step 4: Verify dollar amounts are displayed for each project.
Step 5: Check that the summary totals at the top match the sum of individual items.',
 'The Funding page displays three milestone sections with project lists. Dollar amounts are formatted correctly (e.g., "$12,500.00"). Summary totals are accurate.',
 '/funding', 'critical', 1),

-- 4.2
('a0000001-0000-0000-0000-000000000004',
 'Click "Ready to Collect" cards',
 'Step 1: On the Funding page, find cards or rows marked "Ready to Collect" (usually highlighted in green or with a badge).
Step 2: Click on one of them.
Step 3: A detail view or modal should open showing the funding details for that project.
Step 4: Verify you see the financier name, amount, milestone status, and any required documents.
Step 5: If a "Mark Collected" action exists, note whether it works (but do NOT actually mark it if this is production data).',
 '"Ready to Collect" items are clickable and open a detail view. The detail shows financier, amount, and milestone info. The action button is present and responsive.',
 '/funding', 'high', 2),

-- 4.3
('a0000001-0000-0000-0000-000000000004',
 'Open Job Costing — verify P&L table',
 'Step 1: Navigate to /job-costing.
Step 2: The main view should show a Profit & Loss table with columns for Revenue, COGS, Gross Profit, Overhead, and Net Profit.
Step 3: Click on a row to expand or drill into a specific project or category.
Step 4: Verify numbers are formatted as currency.
Step 5: Check that totals at the bottom add up correctly (spot-check at least one column).',
 'The P&L table loads with correct column headers. Numbers are formatted as currency. Totals appear accurate. Clicking a row provides drill-down detail.',
 '/job-costing', 'high', 3),

-- 4.4
('a0000001-0000-0000-0000-000000000004',
 'Add a crew rate in Crew Rates tab',
 'Step 1: On the Job Costing page, click the "Crew Rates" tab.
Step 2: Click "Add Rate" or the "+" button.
Step 3: Select a crew from the dropdown.
Step 4: Enter a job type (e.g., "Install"), rate amount (e.g., "$1,200"), and effective date.
Step 5: Click Save.
Step 6: Verify the new rate appears in the crew rates table.',
 'The new crew rate saves and appears in the table. The rate is associated with the correct crew and job type. The effective date is displayed correctly.',
 '/job-costing', 'medium', 4),

-- 4.5
('a0000001-0000-0000-0000-000000000004',
 'Add a manual cost entry',
 'Step 1: On the Job Costing page, find the "Add Cost" or "Manual Entry" button.
Step 2: Select a project from the dropdown.
Step 3: Choose a cost category: "Labor", "Material", or "Overhead".
Step 4: Enter an amount (e.g., "$350.00") and a description (e.g., "QA test entry — extra panel shipping").
Step 5: Click Save.
Step 6: Verify the cost appears in the project''s cost breakdown.',
 'The manual cost entry saves successfully. It appears under the correct project and category. The P&L totals update to reflect the new cost.',
 '/job-costing', 'medium', 5);


-- ============================================================
-- PLAN 5: Tickets & Support (high)
-- ============================================================
INSERT INTO test_plans (id, name, description, role_filter, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000005',
   'Tickets & Support',
   'Change-order ticket creation, status workflow, comments, attachments, and filtering. Used for internal support and change requests.',
   'all', 5);

INSERT INTO test_cases (plan_id, title, instructions, expected_result, page_url, priority, sort_order) VALUES
-- 5.1
('a0000001-0000-0000-0000-000000000005',
 'Create a new ticket',
 'Step 1: Navigate to /tickets.
Step 2: Click "New Ticket" or the "+" button.
Step 3: Fill in Title: "QA Test Ticket — Panel Swap Request".
Step 4: Select Category from the dropdown (e.g., "Change Order", "Equipment", "Design").
Step 5: Set Priority to "High".
Step 6: Add a description: "Customer requested upgrade from 400W to 430W panels. Need design revision."
Step 7: Click Submit/Create.',
 'The ticket is created and appears in the ticket list. It shows the correct title, category, priority, and description. Status defaults to "Open".',
 '/tickets', 'critical', 1),

-- 5.2
('a0000001-0000-0000-0000-000000000005',
 'Change ticket status through workflow',
 'Step 1: Open the ticket you just created (or any open ticket).
Step 2: Find the Status dropdown or workflow buttons.
Step 3: Change status from "Open" to "In Progress".
Step 4: Verify the status badge updates.
Step 5: Change status from "In Progress" to "Resolved".
Step 6: Verify the badge updates again and the resolved timestamp is recorded.',
 'Status transitions work: Open -> In Progress -> Resolved. Each change updates the badge/label immediately. Timestamps are logged for each transition.',
 '/tickets', 'high', 2),

-- 5.3
('a0000001-0000-0000-0000-000000000005',
 'Add a comment on a ticket',
 'Step 1: Open any ticket from the ticket list.
Step 2: Scroll to the comments section at the bottom.
Step 3: Type a comment: "QA test comment — confirming this ticket is visible and functional."
Step 4: Click "Post" or "Submit".
Step 5: Verify the comment appears with your name and a timestamp.
Step 6: Refresh the page and confirm the comment persists.',
 'The comment posts successfully with author name and timestamp. After page refresh, the comment is still visible in the correct order.',
 '/tickets', 'high', 3),

-- 5.4
('a0000001-0000-0000-0000-000000000005',
 'Attach a file to a ticket comment',
 'Step 1: Open any ticket.
Step 2: In the comment input area, look for a paperclip/attach icon or "Attach File" button.
Step 3: Click it and select any small image or PDF from your computer.
Step 4: Add a comment with the attachment: "See attached document for reference."
Step 5: Submit the comment.
Step 6: Verify the attachment thumbnail or link appears in the comment.
Step 7: Click the attachment to confirm it opens/downloads correctly.',
 'The file uploads and attaches to the comment. A thumbnail or file link is visible. Clicking it opens or downloads the file. Supported formats (PNG, JPG, PDF) work.',
 '/tickets', 'medium', 4),

-- 5.5
('a0000001-0000-0000-0000-000000000005',
 'Filter tickets by status and category',
 'Step 1: On the /tickets page, find the filter controls (dropdowns or tabs).
Step 2: Filter by Status: select "Open" — verify only open tickets appear.
Step 3: Clear the status filter.
Step 4: Filter by Category: select "Change Order" — verify only change order tickets appear.
Step 5: Apply both filters at once (Status = "Open" AND Category = "Change Order").
Step 6: Clear all filters and verify the full list returns.',
 'Each filter correctly narrows the ticket list. Combining filters works (AND logic). Clearing filters restores the full list. Ticket counts update to reflect the filtered results.',
 '/tickets', 'high', 5),

-- 5.6
('a0000001-0000-0000-0000-000000000005',
 'Verify ticket linked to a project',
 'Step 1: Create or open a ticket that is linked to a specific project.
Step 2: Verify the project name appears on the ticket detail view (usually as a link or badge).
Step 3: Click the project name/link.
Step 4: It should navigate to the project''s ProjectPanel or detail page.
Step 5: On the project side, check if the ticket appears in a "Tickets" tab or section.',
 'Tickets are linked to projects bidirectionally. Clicking the project link from a ticket opens the correct project. The project''s detail shows the linked ticket.',
 '/tickets', 'medium', 6);


-- ============================================================
-- PLAN 6: NTP & Permits (medium)
-- ============================================================
INSERT INTO test_plans (id, name, description, role_filter, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000006',
   'NTP & Permits',
   'Notice to Proceed requests, AHJ directory, permit tracker, and permit submissions. Drives the permitting workflow.',
   'all', 6);

INSERT INTO test_cases (plan_id, title, instructions, expected_result, page_url, priority, sort_order) VALUES
-- 6.1
('a0000001-0000-0000-0000-000000000006',
 'Navigate to NTP page — verify requests load',
 'Step 1: Navigate to /ntp.
Step 2: The page should display a list or table of NTP (Notice to Proceed) requests.
Step 3: Verify you can see columns like Project Name, Status, Submitted Date, and Approved Date.
Step 4: If there are no NTP requests, verify an appropriate empty state message appears.
Step 5: Click on an NTP request to open its detail view.',
 'The NTP page loads a list of requests. Each row shows project name, status, and dates. Clicking a row opens the NTP detail. If empty, a clear empty-state message is shown.',
 '/ntp', 'high', 1),

-- 6.2
('a0000001-0000-0000-0000-000000000006',
 'Navigate to AHJ Directory',
 'Step 1: Navigate to /permits.
Step 2: Look for the "AHJ Directory" tab or section.
Step 3: Click to open it.
Step 4: The directory should list Authority Having Jurisdiction entries with city/county names, requirements, and contact info.
Step 5: Use the search or filter to find a specific AHJ (e.g., search "Phoenix" or "Maricopa").',
 'The AHJ Directory tab loads a searchable list of jurisdictions. Each entry shows name, jurisdiction area, requirements, and contact information. Search/filter works.',
 '/permits', 'medium', 2),

-- 6.3
('a0000001-0000-0000-0000-000000000006',
 'Switch to Permit Tracker tab',
 'Step 1: On the /permits page, click the "Permit Tracker" tab.
Step 2: The tracker should display a table or board of active permit submissions.
Step 3: Verify columns include Project Name, AHJ, Status (Submitted/Under Review/Approved/Rejected), and Submission Date.
Step 4: Sort by status or date to verify sorting works.
Step 5: Click a permit entry to see its detail.',
 'The Permit Tracker tab loads with active permits. Status badges are color-coded. Sorting and clicking through to details work. Data matches expectations.',
 '/permits', 'medium', 3),

-- 6.4
('a0000001-0000-0000-0000-000000000006',
 'Log a new permit submission',
 'Step 1: On the Permit Tracker, click "New Submission" or "Log Permit".
Step 2: Select a project from the dropdown.
Step 3: Select the AHJ from the directory dropdown.
Step 4: Enter submission date (use today''s date).
Step 5: Upload or reference a permit document (or skip if optional).
Step 6: Click Submit.
Step 7: Verify the new permit appears in the tracker with status "Submitted".',
 'The permit submission is created and appears in the Permit Tracker. Status shows "Submitted". The project and AHJ are correctly linked.',
 '/permits', 'high', 4),

-- 6.5
('a0000001-0000-0000-0000-000000000006',
 'Verify NTP status transitions',
 'Step 1: Open an NTP request from the /ntp page.
Step 2: Look for action buttons or a status dropdown.
Step 3: If the NTP is in "Pending" status, try to move it to "Approved" or "Rejected".
Step 4: If admin, verify you can approve. If non-admin, verify the approve button is disabled or hidden.
Step 5: Check that the project''s stage updates if NTP approval triggers a stage change.',
 'NTP status transitions follow the correct workflow. Admin users can approve/reject. Non-admin users see read-only status. Stage changes propagate to the project if applicable.',
 '/ntp', 'high', 5);


-- ============================================================
-- PLAN 7: Engineering & Work Orders (medium)
-- ============================================================
INSERT INTO test_plans (id, name, description, role_filter, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000007',
   'Engineering & Work Orders',
   'Engineering assignments, work order checklists, and vendor scorecards. Supports the design and installation QC process.',
   'all', 7);

INSERT INTO test_cases (plan_id, title, instructions, expected_result, page_url, priority, sort_order) VALUES
-- 7.1
('a0000001-0000-0000-0000-000000000007',
 'Create a new engineering assignment',
 'Step 1: Navigate to /engineering.
Step 2: Click "New Assignment" or the "+" button.
Step 3: Select a project from the dropdown.
Step 4: Select an engineering type (e.g., "Structural", "Electrical", "Plan Set").
Step 5: Assign to an engineer or engineering firm from the dropdown.
Step 6: Set a due date (e.g., 5 business days from today).
Step 7: Click Save/Submit.',
 'The engineering assignment is created and appears in the list. It shows the project name, type, assignee, and due date. Status defaults to "Pending" or "Assigned".',
 '/engineering', 'high', 1),

-- 7.2
('a0000001-0000-0000-0000-000000000007',
 'View work order detail — verify checklist',
 'Step 1: Navigate to /work-orders.
Step 2: Open any work order from the list.
Step 3: The detail view should display a checklist of items (e.g., "Verify panel layout", "Confirm racking type", "Check inverter specs").
Step 4: Count the checklist items and verify they are relevant to the job type.
Step 5: Verify each item has a checkbox and a label.',
 'The work order detail page loads with a checklist. Each item has a checkbox and descriptive label. The checklist is relevant to the work order type.',
 '/work-orders', 'high', 2),

-- 7.3
('a0000001-0000-0000-0000-000000000007',
 'Toggle a checklist item complete',
 'Step 1: On an open work order, find an unchecked checklist item.
Step 2: Click the checkbox to mark it complete.
Step 3: Verify the checkbox fills in and the item text may show a strikethrough or green highlight.
Step 4: Refresh the page.
Step 5: Verify the item is still checked after refresh (change was saved).',
 'Clicking the checkbox marks the item complete with visual feedback. The change persists after page refresh. The work order''s completion percentage updates if shown.',
 '/work-orders', 'medium', 3),

-- 7.4
('a0000001-0000-0000-0000-000000000007',
 'Add a checklist item to a work order',
 'Step 1: On an open work order, scroll to the bottom of the checklist.
Step 2: Look for an "Add Item" input field or "+" button.
Step 3: Type a new checklist item: "QA Test — verify conduit routing matches plan."
Step 4: Press Enter or click Add.
Step 5: Verify the new item appears at the bottom of the checklist as unchecked.',
 'The new checklist item is added and visible. It starts as unchecked. The item text matches what was entered. It can be toggled complete like other items.',
 '/work-orders', 'medium', 4),

-- 7.5
('a0000001-0000-0000-0000-000000000007',
 'View vendor scorecard tab',
 'Step 1: Navigate to /vendors.
Step 2: Look for a "Scorecard" tab or section.
Step 3: Click to open it.
Step 4: Verify the scorecard displays vendor ratings or metrics (e.g., on-time delivery %, quality score, number of assignments).
Step 5: Click on a vendor to see their detail view.',
 'The vendor scorecard loads with meaningful metrics. Each vendor shows a score or rating. Clicking a vendor opens their detail page with history and performance data.',
 '/vendors', 'medium', 5),

-- 7.6
('a0000001-0000-0000-0000-000000000007',
 'Verify engineering assignment status updates',
 'Step 1: Open an engineering assignment from /engineering.
Step 2: Change the status (e.g., from "Assigned" to "In Progress" to "Complete").
Step 3: Verify each status change updates the badge/label.
Step 4: Check if completing the engineering assignment triggers any downstream updates (e.g., project stage progression).
Step 5: Verify a completion timestamp is recorded.',
 'Status transitions work correctly. Badges update in real-time. Completion triggers expected side effects. Timestamps are logged for each status change.',
 '/engineering', 'high', 6);


-- ============================================================
-- PLAN 8: Admin & Configuration (medium)
-- ============================================================
INSERT INTO test_plans (id, name, description, role_filter, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000008',
   'Admin & Configuration',
   'System settings, analytics, infographic pages, and role-based access control. Admin-only features and dashboards.',
   'admin', 8);

INSERT INTO test_cases (plan_id, title, instructions, expected_result, page_url, priority, sort_order) VALUES
-- 8.1
('a0000001-0000-0000-0000-000000000008',
 'Access System page (admin only)',
 'Step 1: Log in as an admin user.
Step 2: Navigate to /system.
Step 3: Verify the System settings page loads with configuration sections (e.g., email settings, API keys, feature flags, user management).
Step 4: Try navigating to /system as a non-admin user (in a separate session or by switching roles).
Step 5: Verify non-admin users see an "Access Denied" page or are redirected.',
 'Admin users can access /system and see configuration options. Non-admin users are blocked with an access-denied message or redirect. No errors on the admin view.',
 '/system', 'critical', 1),

-- 8.2
('a0000001-0000-0000-0000-000000000008',
 'Access Analytics — cycle through all 10 tabs',
 'Step 1: Navigate to /analytics.
Step 2: The page should show multiple tabs (up to 10: Overview, Pipeline, Revenue, Scheduling, Crew Performance, Funding, Permits, Engineering, Tickets, Custom).
Step 3: Click through EVERY tab one by one.
Step 4: For each tab, verify that charts/graphs/tables load without errors.
Step 5: Note any tabs that show blank content, broken charts, or error messages.',
 'All 10 analytics tabs load successfully. Each tab displays relevant charts, graphs, or tables. No blank tabs, broken charts, or JavaScript errors.',
 '/analytics', 'high', 2),

-- 8.3
('a0000001-0000-0000-0000-000000000008',
 'View infographic page — verify all tabs',
 'Step 1: Navigate to /infographic.
Step 2: The page should display visual summaries of key business metrics.
Step 3: Click through each available tab or section.
Step 4: Verify each infographic panel renders correctly (no broken images, no "NaN" values, no missing data).
Step 5: Check that the data shown is recent (not stale or from months ago).',
 'All infographic tabs render with proper visuals and current data. No broken images or NaN values. Each panel shows meaningful business metrics.',
 '/infographic', 'medium', 3),

-- 8.4
('a0000001-0000-0000-0000-000000000008',
 'Verify non-admin cannot access admin pages',
 'Step 1: Log in as a non-admin user (role = "user" or "manager").
Step 2: Try to navigate directly to /system by typing it in the URL bar.
Step 3: Verify you are either redirected to the dashboard or shown an "Access Denied" message.
Step 4: Check the sidebar/navigation — the "System" link should be hidden for non-admin users.
Step 5: Try /admin or any other admin-only route if they exist.',
 'Non-admin users cannot access admin pages. They see an access-denied message or are redirected. Admin-only nav links are hidden from the sidebar for non-admin roles.',
 '/system', 'critical', 4),

-- 8.5
('a0000001-0000-0000-0000-000000000008',
 'Verify Audit Trail page loads',
 'Step 1: Navigate to /audit-trail (or /audit).
Step 2: Verify the page loads with a log of recent system actions.
Step 3: Check that each entry shows: action type, user who performed it, timestamp, and affected record.
Step 4: Use any available filters (date range, user, action type) to narrow results.
Step 5: Click on an audit entry to see its detail (if drill-down is supported).',
 'The Audit Trail page loads a chronological log of actions. Each entry shows action, user, timestamp, and record. Filters work. The log reflects recent activity.',
 '/audit-trail', 'high', 5),

-- 8.6
('a0000001-0000-0000-0000-000000000008',
 'View Dashboard — verify widget data',
 'Step 1: Navigate to /dashboard (the home page after login).
Step 2: Verify the dashboard loads with summary widgets (e.g., projects in progress, installs this week, revenue, pending permits).
Step 3: Cross-reference at least one widget count with the actual page (e.g., "12 installs this week" should match /schedule).
Step 4: Check that the dashboard loads within 3 seconds.
Step 5: Verify no widgets show "0" when there is clearly data in the system.',
 'Dashboard loads with populated widgets. Counts are accurate and match corresponding pages. Load time is under 3 seconds. No widgets display stale or zero data incorrectly.',
 '/dashboard', 'high', 6);
