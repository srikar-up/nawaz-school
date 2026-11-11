# Nawaz School RMS: Future-Proof Architecture & Lifecycle Blueprint (`v2.0`)

**Document Purpose:** Complete architectural overhaul of the `nawaz-school-rms-csv` data layer to support multi-year academic cycles, mid-year admissions, section shuffling, staff turnover, and strict historical auditability.

---

## 1. Executive Summary: Why V1 Will Break in Production

Your current V1 schema (`nawaz-school-schema.json`) works well as a **single-snapshot prototype**, but it has four structural vulnerabilities that will break when used in a real school over multiple months or years:

1. **The "Time-Blindness" Problem:** In V1, `students.csv` directly holds `classIdSection` and `rollNumber`. When a student moves from Grade 9 to Grade 10 next year, overwriting `classIdSection` destroys the fact that they were ever in Grade 9. If you print their 9th-grade report card next year, it will mistakenly say "Grade 10".
2. **The Nested CSV Anti-Pattern:** `attendanceSessions.csv` uses `"nestedEntries": true` (packing an array of student statuses inside a single CSV column). In CSV systems, this makes querying a single student's yearly attendance slow, breaks standard spreadsheet editors, and risks corrupting an entire class's attendance if one character is malformed.
3. **Denormalized String Drift:** Tables like `testRecords.csv`, `timetable.csv`, and `classes.csv` copy names directly (`studentName`, `teacherName`, `examTitle`). If a student's name spelling is fixed in `students.csv`, historical `testRecords.csv` rows will still display the old misspelled name.
4. **Hard-Linked Staff:** Subjects and classes link directly to a `staffId`. In real schools, teachers go on maternity leave, resign mid-term, or swap sections. Overwriting `assignedStaffId` erases who taught the class during Term 1.

---

## 2. Core Architectural Upgrades (V1 $\rightarrow$ V2)

### Upgrade 1: Decouple Identity from Temporal State (The Enrollment Engine)
Never store mutable session data (Class, Section, Roll Number) on the `students` table. Introduce `studentEnrollments.csv` as the temporal bridge.

```
+--------------------+          +-------------------------+          +--------------------+
|    students.csv    | 1      N | studentEnrollments.csv  | N      1 |    classes.csv     |
+--------------------+----------+-------------------------+----------+--------------------+
| id (PK)            |          | id (PK)                 |          | id (PK)            |
| admissionNo (Uniq) |          | studentId (FK)          |          | gradeLevel         |
| fullName           |          | academicYear (FK)       |          | section            |
| dateOfBirth        |          | classIdSection (FK)     |          | displayName        |
| gender             |          | rollNumber              |          | room               |
| guardianName       |          | joinedDate              |          +--------------------+
| parentPhone        |          | exitDate                |
| globalStatus       |          | status (Active/Moved..) |
+--------------------+          +-------------------------+
                                             | 1
                                             |
                        +--------------------+--------------------+
                        | N                                       | N
         +-----------------------------+           +-----------------------------+
         |   attendanceRecords.csv     |           |       testRecords.csv       |
         +-----------------------------+           +-----------------------------+
         | id (PK)                     |           | id (PK)                     |
         | sessionId (FK)              |           | examId (FK)                 |
         | enrollmentId (FK)           |           | enrollmentId (FK)           |
         | studentId (FK)              |           | studentId (FK)              |
         | status (P/A/L/E)            |           | attendanceState (Present..) |
         +-----------------------------+           | marksObtained               |
                                                   +-----------------------------+
```

### Upgrade 2: Flatten Attendance into Master-Detail Tables
Split `attendanceSessions.csv` into two distinct files:
* **`attendanceSessions.csv` (Header):** Holds when, where, and by whom attendance was taken (`id`, `academicYear`, `classIdSection`, `date`, `sessionType`, `submittedByStaffId`, `isLocked`).
* **`attendanceRecords.csv` (Rows):** One row per student per session (`id`, `sessionId`, `enrollmentId`, `studentId`, `status`, `remarks`).

### Upgrade 3: Explicit Academic Year Entities
Instead of storing `academicYear` as a loose text field inside `meta.csv`, create `academicYears.csv`. This allows the system to run queries across multiple years simultaneously, lock past years from accidental edits, and prepare next year's admissions while the current year is still running.

### Upgrade 4: Eliminate Denormalized Name Columns
Strip `studentName`, `teacherName`, `classTeacherName`, `subjectName`, and `examTitle` from transactional CSVs. Resolve names in memory at runtime via hash-map lookups (`Map<id, Record>`) when loading the CSVs.

---

## 3. Complete V2 Target Schema Specification

### 3.1 `academicYears.csv` (NEW)
Manages school sessions and prevents teachers from editing past years' marks or attendance.
* **Fields:** `id`, `name` (e.g., `2026-2027`), `startDate`, `endDate`, `status` (`Upcoming`, `Active`, `Locked`, `Archived`), `isCurrent`
* **Primary Key:** `id`

### 3.2 `students.csv` (REFACTORED)
Strictly permanent biographical and admission identity.
* **Fields:** `id`, `admissionNumber`, `name`, `gender`, `dateOfBirth`, `guardianName`, `parentPhone`, `address`, `admissionDate`, `globalStatus` (`Active`, `Alumni`, `Withdrawn`, `Expelled`), `createdAt`
* **Removed Fields:** `classIdSection`, `rollNumber` (moved to `studentEnrollments.csv`).

### 3.3 `studentEnrollments.csv` (NEW - CRITICAL)
Tracks every class placement a student has ever held.
* **Fields:**
  * `id` (PK, e.g., `enr_2026_101`)
  * `studentId` (FK $\rightarrow$ `students.id`)
  * `academicYearId` (FK $\rightarrow$ `academicYears.id`)
  * `classIdSection` (FK $\rightarrow$ `classes.id`)
  * `rollNumber` (Integer/String, scoped to `classIdSection` + `academicYearId`)
  * `startDate` (Date student entered this specific class/section)
  * `endDate` (Nullable; populated if student transfers section or leaves mid-year)
  * `enrollmentStatus` (`Active`, `TransferredSection`, `Promoted`, `Retained`, `Graduated`, `DroppedOut`)
  * `exitReason` (Nullable text)

### 3.4 `attendanceSessions.csv` & `attendanceRecords.csv` (SPLIT)
* **`attendanceSessions.csv` Fields:** `id`, `academicYearId`, `classIdSection`, `date`, `sessionType` (`Morning`, `Afternoon`, `FullDay`, `Period`), `periodNumber`, `submittedByStaffId`, `submittedAt`, `isLocked`
* **`attendanceRecords.csv` Fields:** `id`, `sessionId`, `enrollmentId`, `studentId`, `status` (`Present`, `Absent`, `Late`, `HalfDay`, `Excused`), `remarks`
* **Unique Constraint:** `(sessionId, enrollmentId)`

### 3.5 `exams.csv` & `testRecords.csv` (HARDENED)
* **`exams.csv` Fields:** `id`, `academicYearId`, `title`, `classIdSection`, `subjectId`, `category` (`classTest`, `ca1`, `ca2`, `midTerm`, `endTerm`), `date`, `maxMarks`, `passingMarks`, `weightage`, `assignedStaffId`, `marksStatus` (`Draft`, `Submitted`, `Verified`, `Locked`), `createdAt`, `submittedAt`
* **`testRecords.csv` Fields:** `id`, `examId`, `enrollmentId`, `studentId`, `attendanceStatus` (`Present`, `Absent`, `Medical`, `UnfairMeans`), `marksObtained` (Numeric, `0` or empty if absent), `remarks`, `enteredByStaffId`, `enteredAt`
* **Unique Constraint:** `(examId, enrollmentId)`

---

## 4. Real-World School Scenarios, Edge Cases & Solutions

### Scenario A: Mid-Year New Admission (Student Joins in November)
* **The Real-World Reality:** A family relocates in November. The student joins Grade 8-A. Term 1 exams (`ca1`, `midTerm`) are already over.
* **What Goes Wrong in Naive Systems:**
  1. The system calculates annual percentage by dividing the student's marks by *all* exams held since June, giving the new student a failing `F` grade because they have `0` in June/August exams.
  2. Past attendance reports for July show the student as neither present nor absent, or worse, retroactively lower the class attendance percentage.
* **The Architectural Solution:**
  1. Insert row in `students.csv` with `admissionDate = '2026-11-11'`.
  2. Insert row in `studentEnrollments.csv` with `startDate = '2026-11-11'` and `rollNumber = max(rollNumber) + 1` (never re-sort existing roll numbers mid-year, as students have already memorized and written their roll numbers on notebooks).
  3. **Attendance Calculation Rule:** Student attendance percentage is calculated strictly over `attendanceSessions` where `session.date >= enrollment.startDate` AND (`enrollment.endDate IS NULL` OR `session.date <= enrollment.endDate`).
  4. **Exam Weightage Rule:** Any `exams.csv` record where `exam.date < enrollment.startDate` is automatically marked `Exempt` for that student, recalibrating their total denominator to only include exams conducted after `enrollment.startDate`.

### Scenario B: Mid-Year Section Transfer (`8-A` $\rightarrow$ `8-B`)
* **The Real-World Reality:** Due to disciplinary issues or section balancing, a student is moved from `8-A` to `8-B` on October 1st.
* **What Goes Wrong in Naive Systems:** If you simply update `classIdSection = '8-B'`, the student vanishes from `8-A`'s September attendance sheet and suddenly appears in `8-B` with missing marks for `8-B`'s class tests.
* **The Architectural Solution:**
  1. Do **not** overwrite the `8-A` enrollment. Update the existing `8-A` enrollment row: set `endDate = '2026-09-30'` and `enrollmentStatus = 'TransferredSection'`.
  2. Create a **new** row in `studentEnrollments.csv` for `8-B` with `startDate = '2026-10-01'` and `enrollmentStatus = 'Active'`.
  3. Because `attendanceRecords` and `testRecords` carry `enrollmentId` AND `studentId`:
     * Class teachers viewing `8-A` history for September still see the student's attendance under `enr_8A`.
     * Report card generators group by `studentId` + `academicYearId`, seamlessly stitching Term 1 marks from `8-A` with Term 2 marks from `8-B` (mapped via common `subjectCode`).

### Scenario C: Student Absent on Exam Day vs. Scoring Zero
* **The Real-World Reality:** Student A studies and gets `0/50`. Student B is hospitalized with dengue and misses the exam.
* **What Goes Wrong in Naive Systems:** In V1, `marksObtained` is a required number. Teachers enter `0` for absent students. On the report card, it prints `0/50 (Fail)` instead of `AB (Medical)`, causing parent outrage.
* **The Architectural Solution:**
  * Add `attendanceStatus` (`Present`, `Absent`, `Medical`, `Exempt`) to `testRecords.csv`.
  * If `attendanceStatus == 'Absent'`, `marksObtained` is `0` for sum calculations, but displays as `AB` on the UI.
  * If `attendanceStatus == 'Medical'` or `'Exempt'`, the exam's `maxMarks` is excluded from the student's denominator calculation (subject to principal approval).

### Scenario D: End-of-Year Promotion, Detainment (Fail), and Alumni Transition
* **The Real-World Reality:** At the end of `2026-2027`, out of 40 students in `9-A`:
  * 36 pass and move to `10-A` or `10-B`.
  * 2 fail and must repeat `9-A` in `2027-2028`.
  * 2 take a Transfer Certificate (TC) and leave the school.
  * Meanwhile, `10-A` students graduate and leave the school, freeing up the `10-A` classroom.
* **What Goes Wrong in Naive Systems:** Admins promote `9-A` before promoting `10-A`, mixing both batches in Grade 10! Or, a repeating student's new `9-A` marks conflict with their old `9-A` marks.
* **The Architectural Solution (The Year-End Rollover Wizard):**
  1. **Create Next Year:** Insert `2027-2028` into `academicYears.csv` with status `Upcoming`.
  2. **Stage Promotions in Reverse Grade Order (Highest Grade First):**
     * **Step 1 (Terminal Grade 10):** Mark `2026-2027` enrollments as `Graduated`. Update `students.globalStatus = 'Alumni'`.
     * **Step 2 (Grade 9 $\rightarrow$ 10):**
       * For the 36 passing students: Mark `2026-2027` enrollment as `Promoted`. Insert new `2027-2028` enrollment rows pointing to `10-A`/`10-B`.
       * For the 2 repeating students: Mark `2026-2027` enrollment as `Retained`. Insert new `2027-2028` enrollment rows pointing to `9-A` (new `enrollmentId`, clean slate for `2027-2028` exams!).
       * For the 2 TC students: Mark `2026-2027` enrollment as `LeftSchool`. Update `students.globalStatus = 'Withdrawn'`.
  3. **Roll Number Re-Indexing:** Once all `2027-2028` enrollments are staged, run an alphabetical sort per `classIdSection` to assign fresh `rollNumber` values (`1..N`) for the new academic year.
  4. **Flip the Switch:** Set `2026-2027` to `Locked` and `2027-2028` to `Active`.

### Scenario E: Teacher Resigns or Takes Leave Mid-Term
* **The Real-World Reality:** Mr. Sharma (`stf_04`) teaches Mathematics to `10-A`. He leaves in December, and Ms. Verma (`stf_19`) takes over.
* **What Goes Wrong in Naive Systems:** If you delete `stf_04` from `staff.csv`, foreign keys in `attendanceSessions.csv` and `testRecords.csv` break. If you overwrite `assignedStaffId` in `subjects.csv`, audit logs forget who taught the class in Term 1.
* **The Architectural Solution:**
  1. **Never Hard-Delete Staff:** Set `isActive = false` and `accessLevel = 'NoAccess'` on `stf_04`.
  2. **Preserve Historical Signatures:** Because `testRecords.csv` stores `enteredByStaffId` and `attendanceSessions.csv` stores `submittedByStaffId`, Term 1 records remain permanently attributed to `stf_04`.
  3. **Update Active Pointers:** Update `subjects.assignedStaffId = 'stf_19'` and `timetable.teacherStaffId = 'stf_19'` for active slots going forward.

---

## 5. CSV Storage & Concurrency Mechanics (Technical Guardrails)

Since your architecture uses CSV files (`nawaz-school-rms-csv`), you must protect against file-system corruption and race conditions:

### Mistake 1: Concurrent File Overwrites (Two Teachers Saving Attendance at 8:30 AM)
* **Problem:** Teacher A (`10-A`) and Teacher B (`10-B`) submit attendance at `08:30:02`. Both read `attendanceRecords.csv` into memory, append their 40 rows, and write the file back. Whoever writes 5 milliseconds later overwrites the other teacher's attendance!
* **Solution:**
  1. **In-Memory Mutex / Write Queue:** All CSV writes on the backend/local engine must pass through a single sequential write queue (Actor pattern or Mutex lock per collection).
  2. **Atomic Temp-File Swap:** Never write directly to `students.csv`. Write to `students.csv.tmp`, flush to disk (`fsync`), and atomically rename `students.csv.tmp` $\rightarrow$ `students.csv`. If power fails mid-write, the original CSV is untouched.
  3. **Year-Partitioned Sharding (For Scale):** As `attendanceRecords.csv` grows (~500 students $\times$ 220 days = 110,000 rows/year), partition transactional CSVs by academic year:
     * `data/2026-2027/attendanceRecords.csv`
     * `data/2026-2027/testRecords.csv`

### Mistake 2: Commas, Newlines, and Formula Injection in CSV Cells
* **Problem:** A teacher types `"Good progress, keep it up!"` in `remarks` or a mischievous student enters `=CMD|' /C calc'!A0` in a text field.
* **Solution:**
  1. **RFC 4180 Strict Escaping:** Wrap every field containing commas, quotes, or newlines in double quotes `""`, and escape internal quotes as `""""`.
  2. **CSV Injection Sanitization:** If any string field begins with `=`, `+`, `-`, or `@` (and isn't a signed number or phone number), prefix it with a single quote `'` or strip the leading symbol before saving to prevent Excel macro execution when admins open the CSV.

### Mistake 3: Calculated Fields Stored in CSV (`percentage`, `studentCount`)
* **Problem:** In V1, `classes.csv` stores `studentCount` and `testRecords.csv` stores `percentage`. If `maxMarks` on `exams.csv` is corrected from `50` to `40`, `percentage` in `testRecords.csv` becomes mathematically wrong.
* **Solution:** **Never store easily derived numbers in CSVs.** Compute `studentCount` by counting active `studentEnrollments` for that class, and compute `percentage` dynamically as:
  $$\text{Percentage} = \left(\frac{\text{marksObtained}}{\text{exam.maxMarks}}\right) \times 100$$

---

## 6. Step-by-Step Implementation & Migration Plan

Follow this exact sequence to upgrade your system without losing existing data:

### Phase 1: Schema & Parser Upgrade
1. Add `academicYears.csv` and seed it with `yr_2026_2027` based on `meta.academicYear`.
2. Create `studentEnrollments.csv` and `attendanceRecords.csv`.
3. Update your CSV loader/serializer to remove `"nestedEntries": true` from `attendanceSessions`.

### Phase 2: Automated Data Migration Script (V1 $\rightarrow$ V2)
Run a one-time migration script on your existing CSV bundle:
1. **Migrate Students:** For every row in `students.csv`, create a corresponding row in `studentEnrollments.csv` with:
   * `id = "enr_" + student.id`
   * `studentId = student.id`
   * `academicYearId = "yr_2026_2027"`
   * `classIdSection = student.classIdSection`
   * `rollNumber = student.rollNumber`
   * `startDate = student.admissionDate || "2026-06-01"`
   * `enrollmentStatus = "Active"`
2. **Unpack Attendance:** Loop through `attendanceSessions.csv`. Parse the nested `entries` JSON/string array and emit individual flat rows into `attendanceRecords.csv`, linking each student to their newly created `enrollmentId`. Remove the `entries` column from `attendanceSessions.csv`.
3. **Link Test Records:** For each row in `testRecords.csv`, lookup the student's `enrollmentId` for the current year and populate `enrollmentId` and `attendanceStatus = 'Present'`.

### Phase 3: Application Query Refactoring
1. **Global Context Filter:** Add an `activeAcademicYearId` selector in the top navbar of your admin/teacher UI (defaulting to `meta.academicYear`).
2. **Roster Queries:** Change every UI screen that previously queried `students.filter(s => s.classIdSection === X)` to query:
   ```javascript
   const activeEnrollments = enrollments.filter(
     e => e.academicYearId === currentYearId &&
          e.classIdSection === X &&
          e.enrollmentStatus === 'Active'
   );
   ```
3. **Locking Middleware:** Before allowing any `INSERT`, `UPDATE`, or `DELETE` on `attendanceRecords`, `testRecords`, or `exams`, verify that `academicYear.status === 'Active'` and `exam.marksStatus !== 'Locked'`.