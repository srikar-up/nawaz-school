# 11 — Use-Case Catalog

> Canonical use cases for the current product and the rewrite. Each use case has an ID, actor, goal, trigger, main flow, exceptions, and current implementation status.
>
> **Status:** ✅ implemented in memory · 🟡 partial/demo · 🔴 simulated · ⚪ absent.

---

## 1. Actors

| Actor | Description |
| :--- | :--- |
| **Teacher** | Authenticated classroom teacher using the phone workspace. |
| **Class Incharge** | Teacher with roll-call rights for a section (default = Period 1 teacher). |
| **Subject Teacher** | Teacher assigned to a subject/section. |
| **Exam Assignee** | Teacher responsible for entering marks for an exam. |
| **Admin (SuperAdmin)** | Principal/owner with full control. |
| **SubAdmin** | Academic head/operator with limited admin rights. |
| **Operator** | IT/exam-cell staff without RBAC/vault access. |
| **Staff (NoAccess)** | Electrician, driver, support; appears in attendance only. |
| **System** | Import job, scheduler, notification worker, report job. |
| **Parent** | Not a system user; receives a shared report. |

---

## 2. Teacher use cases

### UC-T-01 — Open the teacher workspace

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Reach the daily dashboard. |
| **Trigger** | App launch. |
| **Preconditions** | App installed; demo identity or authenticated session. |
| **Main flow** | 1. Splash shows branding. 2. After 1 s, transition to main nav. 3. Dashboard renders. |
| **Exceptions** | Logo missing → fallback icon. |
| **Postcondition** | Teacher sees dashboard for the default class. |
| **Current** | ✅ (no login) |

### UC-T-02 — Switch active classroom

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Change the class context for attendance/marks/syllabus. |
| **Trigger** | Tap class pill in header. |
| **Main flow** | 1. Sheet lists `db.classes`. 2. Teacher selects a class. 3. `setSelectedClass` notifies. 4. Screens rebuild. |
| **Exceptions** | No classes → empty sheet. |
| **Postcondition** | Selected class changes globally. |
| **Current** | ✅ |

### UC-T-03 — Read urgent notices

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | See important/urgent broadcasts. |
| **Trigger** | Tap dashboard banner or header bell. |
| **Main flow** | 1. Open notices. 2. Stream/Fallback loads. 3. Urgent+pinned shown separately. 4. Filter by priority; expand; view image. |
| **Exceptions** | No notices → empty state. |
| **Postcondition** | Teacher is informed. |
| **Current** | ✅ |

### UC-T-04 — Take daily roll-call

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher / Class Incharge |
| **Goal** | Record attendance for a class. |
| **Trigger** | Tap Attendance. |
| **Preconditions** | Roster loaded. |
| **Main flow** | 1. Select date/class/session. 2. Roster defaults Present. 3. Tap exceptions; choose reasons. 4. Press Sync. 5. System builds record, attempts cloud, updates local roster/summaries. |
| **Exceptions** | Cloud unavailable → local still updates (silent). |
| **Postcondition** | Attendance record exists for section/date; counts update. |
| **Current** | ✅ in memory; 🟡 cloud. |

### UC-T-05 — Mark all present

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Reset the roster to Present. |
| **Trigger** | “All Present”. |
| **Main flow** | Set every student to Present; clear reasons. |
| **Exceptions** | Overwrites existing justified absences without confirmation. |
| **Postcondition** | All present in local map. |
| **Current** | ✅ (with UX risk) |

### UC-T-06 — Record an absence reason

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Explain an absence/late. |
| **Trigger** | Status change or comment icon. |
| **Main flow** | 1. Bottom sheet shows presets. 2. Select preset or type custom. 3. Reason stored; status may change. |
| **Exceptions** | Clearing reason removes it. |
| **Postcondition** | Reason appears in the row and saved daily record. |
| **Current** | ✅ |

### UC-T-07 — Hand over roll-call between periods

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Let the next period's teacher take attendance. |
| **Trigger** | Period selector. |
| **Main flow** | Select P1–P4; the saved snackbar mentions the period. |
| **Exceptions** | None. |
| **Postcondition** | Period selection is cosmetic; no period is stored. |
| **Current** | 🟡 |

### UC-T-08 — View timetable

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Know today's/this week's classes. |
| **Trigger** | Timetable tab. |
| **Main flow** | 1. Pick a day. 2. Filter All/Active/Upcoming/Labs. 3. See cards. 4. Toggle whole-school view. |
| **Exceptions** | No periods → empty state. |
| **Postcondition** | Teacher sees schedule. |
| **Current** | 🟡 fixed dates and fake live state. |

### UC-T-09 — Enter marks after an exam

| Field | Detail |
| :--- | :--- |
| **Actor** | Exam Assignee |
| **Goal** | Submit scores for an exam. |
| **Trigger** | Marks tab; exam is Open. |
| **Preconditions** | Exam scheduled; now > end time; assigned to teacher. |
| **Main flow** | 1. Exam list shows Open. 2. Tap Enter Marks. 3. Roster inputs appear. 4. Enter scores. 5. Review live average/risk. 6. Batch commit. |
| **Exceptions** | Empty roster; invalid input → 0. |
| **Postcondition** | Test records inserted; exam Submitted. |
| **Current** | ✅ in memory; 🟡 cloud. |

### UC-T-10 — Review at-risk students

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Identify students below the risk threshold. |
| **Trigger** | Dashboard alert or Marks ledger. |
| **Main flow** | System computes recent-score average/last score; lists names. |
| **Exceptions** | No scores → not flagged. |
| **Postcondition** | Teacher can act. |
| **Current** | ✅ |

### UC-T-11 — Update syllabus progress

| Field | Detail |
| :--- | :--- |
| **Actor** | Subject Teacher |
| **Goal** | Mark a chapter/topic as in progress/completed. |
| **Trigger** | Syllabus tab. |
| **Main flow** | 1. Select assigned subject. 2. Tap chapter. 3. Cycle status. 4. Completion ring updates. |
| **Exceptions** | No chapters → empty state. |
| **Postcondition** | Chapter status changes in memory. |
| **Current** | ✅ |

### UC-T-12 — View a student progress slip

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Review a student's attendance/scores/remarks. |
| **Trigger** | Reports tab. |
| **Main flow** | 1. Select student. 2. Render report card. |
| **Exceptions** | No students → no card. |
| **Postcondition** | Slip visible. |
| **Current** | ✅ |

### UC-T-13 — Share a report with a parent

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Send the slip via WhatsApp. |
| **Trigger** | Dispatch button. |
| **Main flow** | 1. Confirmation sheet shows parent phone. 2. Confirm. 3. Snackbar says dispatched. |
| **Exceptions** | No real share/PDF. |
| **Postcondition** | Nothing is sent. |
| **Current** | 🔴 |

### UC-T-14 — Raise a leave request

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Request leave. |
| **Trigger** | RMS → New Request → Leave. |
| **Main flow** | 1. Choose type/duration/reason. 2. Submit. 3. Ticket classified and inserted. |
| **Exceptions** | Empty body still creates a ticket. |
| **Postcondition** | Ticket in admin leave queue. |
| **Current** | ✅ |

### UC-T-15 — Raise a maintenance/gear request

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Report a broken item or request supplies. |
| **Trigger** | RMS → Maintenance/Gear. |
| **Main flow** | Fill issue/room/description or item/lab/quantity; submit. |
| **Exceptions** | Room fallback uses the teacher's first timetable period. |
| **Postcondition** | Ticket in maintenance queue. |
| **Current** | ✅ |

### UC-T-16 — Send a confidential note

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | Privately notify the principal. |
| **Trigger** | RMS → Confidential/Vault tab. |
| **Main flow** | Enter subject/body; submit with `isPrivate: true`; classification forces Confidential. |
| **Exceptions** | None. |
| **Postcondition** | Ticket visible in vault. |
| **Current** | ✅ (no encryption) |

### UC-T-17 — View/update profile

| Field | Detail |
| :--- | :--- |
| **Actor** | Teacher |
| **Goal** | See contact/classes/preferences. |
| **Trigger** | Header → profile. |
| **Main flow** | Render profile; toggle notifications/offline. |
| **Exceptions** | Toggles not persisted. |
| **Postcondition** | UI state only. |
| **Current** | 🟡 |

### UC-T-18 — Switch to admin console

| Field | Detail |
| :--- | :--- |
| **Actor** | Demo user |
| **Goal** | Open admin features. |
| **Trigger** | Quick action/header. |
| **Main flow** | Set role admin; admin tree renders. |
| **Exceptions** | If signed out, login appears. |
| **Postcondition** | Admin console open. |
| **Current** | 🟡 no auth barrier |

---

## 3. Admin use cases

### UC-A-01 — Sign in to the admin console

| Field | Detail |
| :--- | :--- |
| **Actor** | SuperAdmin/SubAdmin |
| **Goal** | Access the console. |
| **Trigger** | Role switch or sign-out then switch. |
| **Main flow** | 1. Enter email/password. 2. Validate format. 3. Check email clearance. 4. Store name/role. 5. Show loading, then console. |
| **Exceptions** | Email not permitted → error. |
| **Postcondition** | Admin session in memory. |
| **Current** | 🟡 password ignored |

### UC-A-02 — View school overview

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Understand enrolment, faculty, attendance, risk. |
| **Trigger** | Dashboard. |
| **Main flow** | Read counts/rates; open attendance matrix; inspect risk list. |
| **Exceptions** | Empty DB → zeros. |
| **Postcondition** | Overview seen. |
| **Current** | 🟡 some panels static |

### UC-A-03 — Download the master workbook

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Get a fillable Excel template with current data. |
| **Trigger** | Multi-Excel Center/Download. |
| **Main flow** | Generate 14 sheets; encode; download. |
| **Exceptions** | Large data blocks UI. |
| **Postcondition** | `.xlsx` downloaded. |
| **Current** | ✅ |

### UC-A-04 — Validate and commit a master workbook

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Bulk-load a term's data. |
| **Trigger** | Upload `.xlsx`. |
| **Main flow** | 1. Pick file. 2. Stage. 3. Parse/validate per sheet. 4. Show health cards. 5. Commit. 6. Ingest into memory. |
| **Exceptions** | Missing sheets/headers → invalid; commit skips invalid sheets. |
| **Postcondition** | In-memory data updated. |
| **Current** | 🟡 non-transactional |

### UC-A-05 — Import a single CSV

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Add/update one dataset quickly. |
| **Trigger** | Paste/upload single sheet. |
| **Main flow** | Detect schema; validate headers; preview; commit. |
| **Exceptions** | Quoted commas break parsing. |
| **Postcondition** | Dataset updated in memory. |
| **Current** | 🟡 |

### UC-A-06 — Browse datasets in the live grid

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Inspect all school data. |
| **Trigger** | Live Grid. |
| **Main flow** | Pick dataset; filter by grade/section/faculty; search. |
| **Exceptions** | No rows → empty state. |
| **Postcondition** | Rows visible. |
| **Current** | ✅ |

### UC-A-07 — Add a student

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Create a student without Excel. |
| **Trigger** | Add Row → Students. |
| **Main flow** | Enter name/section/phone; commit. |
| **Exceptions** | Empty name → no-op. |
| **Postcondition** | Student in memory. |
| **Current** | ✅ |

### UC-A-08 — Edit a student inline

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Correct a name/section/phone. |
| **Trigger** | Edit row. |
| **Main flow** | Fields appear; change; Save. |
| **Exceptions** | Save does not persist. |
| **Postcondition** | Nothing changes. |
| **Current** | 🔴 |

### UC-A-09 — Delete a record

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Remove a wrong/duplicate row. |
| **Trigger** | Delete icon. |
| **Main flow** | Remove from RAM. |
| **Exceptions** | No cascade; related records remain. |
| **Postcondition** | Row gone from list. |
| **Current** | ✅ (with integrity gaps) |

### UC-A-10 — Manage staff and RBAC

| Field | Detail |
| :--- | :--- |
| **Actor** | SuperAdmin |
| **Goal** | Add/edit/disable staff and set access. |
| **Trigger** | Staff & Access Hub. |
| **Main flow** | Add or edit modal; validate unique ID/email; set type/access/department/status; save. |
| **Exceptions** | Duplicate ID/email → validation error. |
| **Postcondition** | Staff list updated in memory. |
| **Current** | ✅ |

### UC-A-11 — Override class attendance incharge

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Let a specific teacher take roll-call for a section. |
| **Trigger** | Attendance Access Desk. |
| **Main flow** | Choose section; select staff; save; badge shows override. |
| **Exceptions** | Reset returns to Period-1 default. |
| **Postcondition** | Incharge mapping updated. |
| **Current** | ✅ (not enforced in teacher UI) |

### UC-A-12 — Assign a subject teacher

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Define who teaches a subject in a section. |
| **Trigger** | Subject Assignments. |
| **Main flow** | Pick subject/section/faculty; assign; row updates. |
| **Exceptions** | No workload validation. |
| **Postcondition** | Subject offering updated. |
| **Current** | ✅ |

### UC-A-13 — Schedule and assign an exam

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Create an assessment and delegate marks entry. |
| **Trigger** | Exam Assignment Hub. |
| **Main flow** | Choose category/class/subject/teacher/date/max; publish. |
| **Exceptions** | No time fields; no conflict check. |
| **Postcondition** | Exam in teacher queue. |
| **Current** | ✅ |

### UC-A-14 — Administer/oversee attendance

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Check and correct roll-call. |
| **Trigger** | Student Attendance Hub. |
| **Main flow** | Pick section/date/session; view KPIs; toggle statuses; remark; save; view monthly matrix; inspect student. |
| **Exceptions** | Read-only for non-incharge; parent contact simulated. |
| **Postcondition** | Daily/monthly records updated in memory. |
| **Current** | ✅ |

### UC-A-15 — Approve/reject leave

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Resolve a leave request. |
| **Trigger** | Leave Desk. |
| **Main flow** | Review request; approve/reject; add principal note. |
| **Exceptions** | No leave balance/substitution. |
| **Postcondition** | Ticket status changes. |
| **Current** | ✅ |

### UC-A-16 — Resolve/assign maintenance

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Track a repair. |
| **Trigger** | Maintenance Logs. |
| **Main flow** | Review; mark resolved or assign work order. |
| **Exceptions** | No technician/ETA. |
| **Postcondition** | Ticket status changes. |
| **Current** | ✅ |

### UC-A-17 — Read confidential vault notes

| Field | Detail |
| :--- | :--- |
| **Actor** | SuperAdmin |
| **Goal** | Read private staff notes. |
| **Trigger** | Principal Vault. |
| **Main flow** | Enter PIN; unlock; read; lock. |
| **Exceptions** | PIN not checked. |
| **Postcondition** | Notes shown. |
| **Current** | 🟡 |

### UC-A-18 — Audit a teacher's screen

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Troubleshoot what a teacher sees. |
| **Trigger** | Teacher Audit Viewer. |
| **Main flow** | Select faculty; select screen; inspect phone wireframe. |
| **Exceptions** | Data/identity not scoped to selected teacher. |
| **Postcondition** | Admin sees a live preview. |
| **Current** | 🟡 |

### UC-A-19 — Compile an executive report

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Produce a board-ready PDF. |
| **Trigger** | Executive PDF. |
| **Main flow** | Click compile; snackbar claims export. |
| **Exceptions** | No PDF generated. |
| **Postcondition** | Nothing. |
| **Current** | 🔴 |

### UC-A-20 — Publish an announcement

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Broadcast a notice. |
| **Trigger** | Announcements Hub. |
| **Main flow** | Compose; choose audience/priority/pin; attach image; publish. |
| **Exceptions** | Binary image attachment bug; no real push. |
| **Postcondition** | Announcement in feed. |
| **Current** | ✅ in memory/Firestore |

### UC-A-21 — Pin/unpin/delete an announcement

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Manage the feed. |
| **Trigger** | Ledger actions. |
| **Main flow** | Toggle pin or delete. |
| **Exceptions** | Firestore failure silent. |
| **Postcondition** | Feed updated. |
| **Current** | ✅ |

### UC-A-22 — Change admin password

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Rotate credentials. |
| **Trigger** | Profile → Change Password. |
| **Main flow** | Enter old/new/confirm; submit; snackbar. |
| **Exceptions** | Nothing is verified or saved. |
| **Postcondition** | No change. |
| **Current** | 🔴 |

### UC-A-23 — Sign out

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | End the session. |
| **Trigger** | Sign Out. |
| **Main flow** | Set `isAdminAuthenticated=false`. |
| **Exceptions** | Next role switch shows login. |
| **Postcondition** | Login required (in memory). |
| **Current** | ✅ |

### UC-A-24 — Export the master workbook from the grid

| Field | Detail |
| :--- | :--- |
| **Actor** | Admin |
| **Goal** | Snapshot current data. |
| **Trigger** | Download Master button. |
| **Main flow** | Generate 14 sheets from memory; download. |
| **Exceptions** | No background job. |
| **Postcondition** | File downloaded. |
| **Current** | ✅ |

---

## 4. System use cases

### UC-S-01 — Auto-unlock an exam for marks entry

| Field | Detail |
| :--- | :--- |
| **Actor** | System |
| **Goal** | Open marks entry when the exam ends. |
| **Trigger** | Read of exam status. |
| **Main flow** | Compute `now > examDate + endTime`; return Open if stored Upcoming. |
| **Exceptions** | Clock/timezone issues; no scheduled job. |
| **Postcondition** | Teacher sees Enter Marks. |
| **Current** | ✅ computed on read |

### UC-S-02 — Auto-classify an RMS request

| Field | Detail |
| :--- | :--- |
| **Actor** | System |
| **Goal** | Route a request to the right queue. |
| **Trigger** | Ticket submission. |
| **Main flow** | Keyword scan: confidential → leave → maintenance → general. |
| **Exceptions** | False positives; English only. |
| **Postcondition** | Category label. |
| **Current** | ✅ |

### UC-S-03 — Recompute monthly attendance

| Field | Detail |
| :--- | :--- |
| **Actor** | System |
| **Goal** | Roll up daily attendance. |
| **Trigger** | Teacher save or admin save. |
| **Main flow** | Count present/absent/late/excused; apply formula; store summary. |
| **Exceptions** | Missing days default; excused semantics. |
| **Postcondition** | Monthly summary available. |
| **Current** | ✅ in memory |

### UC-S-04 — Bulk ingest a workbook

| Field | Detail |
| :--- | :--- |
| **Actor** | System |
| **Goal** | Parse and commit 14 sheets. |
| **Trigger** | Admin commit. |
| **Main flow** | Validate headers/rows; call per-sheet ingest; notify. |
| **Exceptions** | Partial commit; no rollback. |
| **Postcondition** | Data in memory. |
| **Current** | 🟡 |

### UC-S-05 — Generate an executive PDF

| Field | Detail |
| :--- | :--- |
| **Actor** | System |
| **Goal** | Build a report file. |
| **Trigger** | Admin compile. |
| **Main flow** | Query data; render PDF; save. |
| **Exceptions** | Not implemented. |
| **Postcondition** | File available. |
| **Current** | ⚪ |

### UC-S-06 — Deliver a push notification

| Field | Detail |
| :--- | :--- |
| **Actor** | System |
| **Goal** | Notify teachers of urgent news. |
| **Trigger** | Announcement publish. |
| **Main flow** | Send FCM payload. |
| **Exceptions** | Not implemented. |
| **Postcondition** | Device notification. |
| **Current** | ⚪ (console print) |

---

## 5. Use-case → screen matrix

| Use case | Teacher screens | Admin screens |
| :--- | :--- | :--- |
| UC-T-01/02/03 | Splash, MainNav, Dashboard, Notices | — |
| UC-T-04/05/06/07 | Attendance | Student Attendance Hub |
| UC-T-08 | Timetable | — |
| UC-T-09/10 | Marks | Analytical Trends, Exam Hub |
| UC-T-11 | Syllabus | Subject Assignments, Live Grid |
| UC-T-12/13 | Reports | — |
| UC-T-14/15/16 | RMS | Leave Desk, Maintenance, Vault |
| UC-T-17/18 | Profile, MainNav | Profile |
| UC-A-01/02 | — | Login, Loading, Dashboard |
| UC-A-03/04/05/24 | — | Multi-Excel Center, Live Grid |
| UC-A-06/07/08/09 | — | Live Grid |
| UC-A-10 | — | Staff & Access |
| UC-A-11 | — | Attendance Access |
| UC-A-12 | — | Subject Assignments |
| UC-A-13 | — | Exam Assignment |
| UC-A-14 | — | Student Attendance Hub |
| UC-A-15/16/17 | — | Leave, Maintenance, Vault |
| UC-A-18 | — | Teacher Audit Viewer |
| UC-A-19 | — | Executive PDF |
| UC-A-20/21 | Notices | Announcements |
| UC-A-22/23 | — | Profile |

---

## 6. Rewrite prioritisation

| Priority | Use cases |
| :--- | :--- |
| **P0 — must ship** | UC-T-01, 02, 04, 06, 08, 09, 11, 14, 15; UC-A-01, 02, 03, 04, 06, 10, 11, 12, 13, 14, 15, 20, 23; UC-S-01, 03, 04 |
| **P1 — should ship** | UC-T-03, 05, 07, 10, 12, 16, 17; UC-A-05, 07, 09, 16, 21; UC-S-02 |
| **P2 — later** | UC-T-13; UC-A-08, 17, 18, 19, 22; UC-S-05, 06 |
| **P3 — nice to have** | UC-T-18, richer profile, bulk actions, advanced analytics |
