# 13 — Glossary

## Domain terms

| Term | Meaning |
| :--- | :--- |
| **Academic year** | A school session, e.g. `2026-2027`. The current app stores it only on class incharge records; the rewrite should scope all year-sensitive data by it. |
| **Admin console** | The desktop-first Principal/Operator interface. |
| **Attendance incharge** | The staff member allowed to take roll-call for a class section. Defaults to the Period-1 teacher; can be overridden by an admin. |
| **CA-1 / CA-2** | Continuous Assessment 1 and 2; teacher-created assessments. |
| **Class** | A grade + section pair, e.g. Grade 10 Section A (`10-A`). |
| **Class incharge** | Same as attendance incharge; the class's responsible teacher. Also called homeroom incharge. |
| **Class teacher** | The teacher assigned to a class (`classes.class_teacher_email`). |
| **Exam** | A scheduled assessment (CA, mid-term, end-term) with a date, time window, max marks, and assigned teacher. |
| **Faculty** | The teaching staff subset of the universal staff directory. In the current code, `facultyList` is separate from `staffList`. |
| **Grade** | The academic level, e.g. `10` or `Grade 10`. |
| **Homeroom** | The base classroom/teacher relationship. |
| **Incharge** | See attendance incharge. |
| **Master workbook** | The 14-sheet `nawaz_school_master_database.xlsx` used for bulk import/export. |
| **Marks ledger** | The list/grid of test records and scores. |
| **Mid-term / End-term** | Formal institutional exams mandated by the principal. |
| **PTM** | Parent–Teacher Meeting (not implemented; appears in some product copy). |
| **RMS** | Relationship Management System: private staff-to-principal request channel for leave, maintenance, gear, and confidential notes. |
| **Roll-call** | Daily attendance taking. |
| **Section** | A class subdivision, e.g. `A`. Combined with grade to form `10-A`. |
| **Session** | Morning/Afternoon/Full-Day attendance period. |
| **Staff** | Any employee: principal, vice-principal, teacher, operator, electrician, driver, support. |
| **Subject** | A course, e.g. Mathematics, identified grade-wide by a code such as `MATH-10`. |
| **Subject offering** | A subject taught to a specific class section by a specific teacher. This is the missing explicit entity in the current model, which packs it into `SubjectModel`. |
| **Syllabus item** | A chapter/topic and its completion status. |
| **Test record** | A student's score for one assessment. |
| **Timetable period** | One scheduled teaching slot: day, period number, start/end, class, subject, teacher, room. |
| **Vault** | The Principal's confidential RMS queue. |

---

## 2. Technical terms

| Term | Meaning |
| :--- | :--- |
| **Aurora background** | The pastel radial-blob background used in the teacher app. |
| **Bento** | The dense card/grid layout used in the admin console. |
| **Canonical model** | The model in `core_shared/lib/models/...` that the running app uses. |
| **ChangeNotifier / AnimatedBuilder** | Flutter's built-in state notification pattern used instead of a state-management package. |
| **Deterministic ID** | An ID built from stable fields, e.g. `{section}_{date}`, so re-import upserts instead of duplicating. |
| **Firestore rules** | Server-side security rules for Cloud Firestore. |
| **Legacy layer** | `lib/models/`, `lib/services/`, and unused controllers/screens that duplicate the canonical layer. |
| **MockDatabase** | The in-memory singleton that acts as the database, auth session, import engine, and demo fixture. |
| **RBAC** | Role-Based Access Control. Current levels: SuperAdmin, SubAdmin, TeacherApp, NoAccess. |
| **RLS** | Row-Level Security; the recommended Postgres enforcement mechanism. |
| **Seed data** | Hardcoded demo records created at startup. |
| **Staging** | Parsing/validating an uploaded file before committing it. |
| **Upsert** | Insert if absent, update if present. |
| **Outbox** | A local queue of pending writes for offline sync. |

---

## 3. Acronyms

| Acronym | Expansion |
| :--- | :--- |
| **API** | Application Programming Interface |
| **CA** | Continuous Assessment |
| **CRUD** | Create, Read, Update, Delete |
| **DTO** | Data Transfer Object |
| **E2E** | End-to-End (test) |
| **FCM** | Firebase Cloud Messaging |
| **FK** | Foreign Key |
| **ID** | Identifier |
| **MFA** | Multi-Factor Authentication |
| **OTP** | One-Time Password |
| **PDF** | Portable Document Format |
| **PK** | Primary Key |
| **PWA** | Progressive Web App |
| **RBAC** | Role-Based Access Control |
| **RLS** | Row-Level Security |
| **RMS** | Relationship Management System |
| **SLA** | Service-Level Agreement |
| **UI** | User Interface |
| **UUID** | Universally Unique Identifier |
| **XLSX** | Microsoft Excel Open XML workbook |

---

## 4. ID formats seen in the code

| Prefix / pattern | Meaning | Example |
| :--- | :--- | :--- |
| `STU-...` | Student code | `STU-10A-01` |
| `STF-...` | Staff code | `STF-001` |
| `TCH-...` | Teacher code (staff subtype) | `TCH-001` |
| `OPS-...` | Operations staff code | `OPS-001` |
| `tch_...` | Demo teacher account ID | `tch_sarah_01` |
| `10-A` | Class section | `10-A` |
| `MATH-10` | Grade-wide subject code | `MATH-10` |
| `SUB-...` | Timetable subject code | `SUB-MATH-10` |
| `TT-...` | Timetable period code | `TT-10A-P1` |
| `EXM-...` / `EXAM-...` | Exam code | `EXM-10A-MATH-CA1` |
| `TST-...` / `CA-...` | Test code | `TST-10A-01` |
| `SYL-...` | Syllabus item | `SYL-10A-M01` |
| `RMS-...` | RMS ticket | `RMS-2026-001` |
| `ANN-...` | Announcement | `ANN-2026-001` |
| `ATT_...` | Granular daily attendance | `ATT_20260830_AM_STU-10A-01` |
| `ATT-...` | Cumulative attendance row | `ATT-STU-10A-01-2026-08-26` |
| `SUM_...` | Monthly summary | `SUM_202608_STU-10A-01` |
| `SA_...` | Staff attendance | `SA_20260830_STAFF-01` |

---

## 5. Status/label glossary

| UI label | Underlying value | Meaning |
| :--- | :--- | :--- |
| Present | `present` / `P` | Attended. |
| Absent | `absent` / `A` | Did not attend. |
| Late | `late` / `L` | Attended late; counts 0.5 in monthly formula. |
| Excused | `excused` / `E` / `Leave` | Authorised absence. |
| On Leave | `onLeave` | Staff leave. |
| Half-Day | `halfDay` | Staff half-day. |
| Pending Review | `pending` | RMS not yet reviewed. |
| Under Review / Assigned | `underReview` | RMS being handled. |
| Approved / Resolved | `approved` / `resolved` | RMS closed positively. |
| Declined | `rejected` | RMS closed negatively. |
| Upcoming | `Upcoming` | Exam not yet concluded. |
| Open | `Open` | Exam concluded; marks entry allowed. |
| Submitted | `Submitted` | Marks submitted. |
| Locked | `Locked` | Marks closed (not actually enforced). |
| Optimal | ≥75% attendance | Low risk. |
| Moderate Risk | 60–74.99% attendance | Needs attention. |
| Critical Risk | <60% attendance | High risk. |
| Needs Review | Student risk flag | At-risk in report slip. |
| Passing | Student not at risk | Report slip. |

---

## 6. Naming cautions for the rewrite

- “Class” means grade+section, not a scheduled period. Use `class_section` or `class_group` explicitly.
- “Session” means attendance session, not login session. Use `attendance_session` vs `auth_session`.
- “Incharge” is used for both the default Period-1 teacher and the active override. Use `default_attendance_teacher_id` and `active_attendance_teacher_id`.
- “Teacher” is used for three different records. Use `staff` for the person, `teacher_profile` for the teaching role, and `auth_user` for the login.
- “Exam” and “test” are used interchangeably. Use `exam` for the scheduled assessment and `test_record`/`score` for the student result.
- “Subject” means both the catalog course and the class-specific offering. Use `subject` and `subject_offering`.
