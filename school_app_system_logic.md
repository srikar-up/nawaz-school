# School Management System (SMS) - Unified Logic & Product Blueprint

## 🌐 1. System Ecosystem & Multi-Platform Architecture

The application runs on a single centralized cloud database backend split across two distinct specialized frontend form-factors:

```
                  ┌──────────────────────────────┐
                  │   Central Cloud Database     │
                  │  (Supabase / PostgreSQL)      │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌──────────────────────────────┐                ┌──────────────────────────────┐
│  Windows Desktop Admin App   │                │   Android/iOS Mobile App     │
│  (Principal / Manager Controls)│              │      (Teacher Workspace)     │
└──────────────────────────────┘                └──────────────────────────────┘
```

### The Windows Desktop Admin Panel (Flutter Desktop)
* **Target User:** Principal, School Owner, or Head Manager.
* **Core Optimization:** High-density monitors, advanced bulk data loading (`.xlsx` spreadsheets), system configurations, macro data-auditing dashboards, and school-wide overrides.

### The Mobile App Workspace (Flutter Mobile)
* **Target User:** Classroom teachers on the move.
* **Core Optimization:** Clean touch targets, zero-friction workflows, offline entry cache, quick swipe utilities, and immediate integration shortcuts to native device protocols (WhatsApp document sharing).

---

## 🔑 2. Identity Verification & Multi-Tier Permissions

### Permission Matrices
1. **Admin (Global Access Engine):** Complete global `CRUD` permissions (`Create`, `Read`, `Update`, `Delete`) across all schema records.
2. **Teacher (Context-Isolated Node):** Scope-locked contextual writing (`Create`/`Update` marks & attendance logs) and strictly filtered read access.
   * *The Security Rule:* `WHERE timetables.teacher_id == current_authenticated_user_id`. Teachers cannot query records belonging to alternative faculty channels.

### Provisioning & Authentication Logic
1. **Admin Onboarding:** The Principal initiates account setup by specifying the teacher’s name and official school email inside the Windows console.
2. **Verification Loop:** The platform issues an automated identity token containing a unique validation callback URL directly to the teacher's email inbox.
3. **Activation:** Clicking the activation trigger safely bypasses local registration screens, allowing the teacher to configure security passwords and immediately map their device credentials to the mobile app profile.

---

## 📂 3. Data Ingestion Engine: Fixed Excel Parsing

To prevent repetitive manual labor, global datasets use structural processing loops mapped to standardized spreadsheets.

### Template A: Student Database Map (`students_template.xlsx`)
```
[Header Row 0] -> [roll_number] | [name] | [class_name] | [parent_phone]
```
* **Processing Sequence:** 
  1. Initialize target workbook stream.
  2. Skip Header index `0`.
  3. Validate row structures: assert `roll_number` and `class_name` strings are populated.
  4. Perform bulk transactional database insert.

### Template B: Scheduling Master Matrix (`timetable_template.xlsx`)
```
[Header Row 0] -> [class_name] | [subject] | [teacher_email] | [day_of_week] | [start_time] | [end_time]
```
* **Processing Sequence:**
  1. Scan incoming spreadsheet rows.
  2. Parse the target `teacher_email` element.
  3. Perform a relational sub-query to translate the literal text email string into the database's true system `teacher_id` UUID.
  4. Check conflict constraints: Ensure neither the designated `teacher_id` nor the specified `class_name` is booked elsewhere during overlapping `start_time` and `end_time` values.
  5. Commit schedule record block to the active cloud instance.

---

## 🎛️ 4. Master Feature Business Logic Matrix

### A. Syllabus Completion Tracker
* **Logic Formula:**
  $$\text{Syllabus Progress Ratio} = \left( \frac{\text{Total Curricular Items Completed}}{\text{Total Required Core Curriculum Elements}} \right) \times 100$$
* **Operational Flow:** Teachers tap topic checkboxes within their mobile dashboard (e.g., *"Completed: Part 1 Fractions"*). The Admin view dynamically translates this stream into macro progress indicators sorted either by specific teacher velocity metrics or holistic classroom environments.

### B. Analytical Risk Profiling & Reporting
* **Logic Engine:** Aggregates individual scores submitted from mobile test ledgers to compute immediate classroom trends:
  * **Class Average calculation:** Computes the mathematical mean score of the class group.
  * **Fail/Pass Spread:** Groups scores to show grade distribution.
  * **Automated Risk Flagging:** If a classroom group average falls beneath $50\%$, or if an individual student drops below $35\%$ performance thresholds across three sequential test iterations, the system marks the matching target rows in **Red** within the Admin console.

### C. Adaptive Timetable Box Interface
* **Today's Feed Box (Default State):** Compares the device's system time parameters with the database schedule matrix, displaying only relevant upcoming periods chronologically on the teacher's home tab.
* **Weekly Grid Box (Expanded State):** Tapping the container switches the local dashboard layout into a classic, multi-column 5-day grid schedule matrix layout for comprehensive week-at-a-glance viewing.

### D. Zero-Friction Attendance Registry
* **The Logic:** The registry instantiates all student values within the selected classroom target to a boolean state of **True (Present) by default**.
* **The Action:** The teacher skims the environment physically and hits names to invert missing students to **False (Absent)**, keeping tap cycles low. Submissions map back instantly to global attendance sync tracking profiles on the office desktop.

### E. Dynamic PDF Compilation & Shared Output Engine
* **Step 1:** The teacher initiates the print request via their smartphone.
* **Step 2:** The system queries database student markers (Grades, Attendance Rates, Text Comments) and builds a clean standard report layout saved to local device cache storage.
* **Step 3:** The app calls the OS native share panel, sending the cached file path to **WhatsApp**. The teacher picks the parent contact card to complete the document distribution seamlessly.

### F. Relationship Management System (RMS) Private Channel
* **The Flow:** Teachers use a dedicated encrypted chat input box to dispatch direct messages, gear malfunction logs, or leave requests straight to the head management panel.
* **The Sink:** All entries skip broad public school discussion forums, piping messages straight into an absolute operational priority tray on the Principal's desktop app.