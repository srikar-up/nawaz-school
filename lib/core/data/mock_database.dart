import 'package:flutter/foundation.dart';
import '../models/student.dart';
import '../models/timetable.dart';
import '../models/syllabus.dart';
import '../models/rms_ticket.dart';
import '../models/test_record.dart';

enum UserRole { teacher, admin }

class TeacherAccount {
  final String id;
  final String name;
  final String email;
  final String department;
  final List<String> assignedClasses;
  final bool isActivated;

  TeacherAccount({
    required this.id,
    required this.name,
    required this.email,
    required this.department,
    required this.assignedClasses,
    this.isActivated = true,
  });
}

class IngestionResult {
  final bool isSuccess;
  final String message;
  final int rowsProcessed;
  final int rowsInserted;
  final int rowsUpdated;
  final List<String> errorLogs;

  IngestionResult({
    required this.isSuccess,
    required this.message,
    this.rowsProcessed = 0,
    this.rowsInserted = 0,
    this.rowsUpdated = 0,
    this.errorLogs = const [],
  });
}

class MockDatabase extends ChangeNotifier {
  static final MockDatabase _instance = MockDatabase._internal();
  factory MockDatabase() => _instance;

  MockDatabase._internal() {
    _initializeData();
  }

  // Active Role Switcher (Teacher vs Admin)
  UserRole _currentRole = UserRole.teacher;
  UserRole get currentRole => _currentRole;
  bool get isAdmin => _currentRole == UserRole.admin;

  void toggleRole() {
    _currentRole = (_currentRole == UserRole.teacher) ? UserRole.admin : UserRole.teacher;
    notifyListeners();
  }

  void setRole(UserRole role) {
    _currentRole = role;
    notifyListeners();
  }

  // Current Logged-in Teacher Node (RLS Scope Locked)
  final String activeTeacherId = 'tch_sarah_01';
  final String teacherName = 'Prof. Sarah Nawaz';
  final String teacherEmail = 's.nawaz@school.edu';
  final String department = 'Science & Mathematics Dept';

  // Admin Profile
  final String adminName = 'Dr. Tariq Nawaz';
  final String adminEmail = 'principal@nawazschool.edu';

  // Faculty Directory (For Admin Onboarding & Timetable Mapping)
  List<TeacherAccount> _facultyList = [];
  List<TeacherAccount> get facultyList => _facultyList;

  // Active Class selected by Teacher
  String _selectedClass = 'Class 10-A';
  String get selectedClass => _selectedClass;

  void setSelectedClass(String className) {
    _selectedClass = className;
    notifyListeners();
  }

  // Master Data Stores (Populated via 4-Excel Master Schema)
  List<Student> _students = [];
  List<TimetablePeriod> _timetable = [];
  List<SyllabusTopic> _syllabus = [];
  List<TestRecord> _testRecords = [];
  List<RmsTicket> _rmsTickets = [];

  // Global Admin Getters (Full Unrestricted CRUD Access)
  List<Student> get students => _students;
  List<TimetablePeriod> get timetable => _timetable;
  List<SyllabusTopic> get syllabus => _syllabus;
  List<TestRecord> get testRecords => _testRecords;
  List<RmsTicket> get rmsTickets => _rmsTickets;

  // ---------------------------------------------------------------------------
  // TEACHER RLS SCOPE-LOCKED GETTERS (database.record.teacher_id == active_user)
  // ---------------------------------------------------------------------------
  List<String> get classes {
    final assigned = _timetable
        .where((p) => p.teacherId == activeTeacherId)
        .map((p) => p.className)
        .toSet()
        .toList();
    if (assigned.isEmpty) return ['Class 10-A', 'Class 9-A'];
    return assigned;
  }

  List<Student> get studentsInSelectedClass =>
      _students.where((s) => s.className == _selectedClass).toList();

  List<TimetablePeriod> get teacherTimetable =>
      _timetable.where((p) => p.teacherId == activeTeacherId).toList();

  List<SyllabusTopic> get teacherSyllabus => _syllabus.where((t) {
        final teacherClassSections = _timetable
            .where((p) => p.teacherId == activeTeacherId)
            .map((p) => p.classIdSection)
            .toSet();
        return teacherClassSections.contains(t.classIdSection);
      }).toList();

  // Macro Statistics for Admin Console
  int get totalStudentsCount => _students.length;
  int get totalTeachersCount => _facultyList.length;

  double get schoolWideAttendanceRate {
    if (_students.isEmpty) return 0.0;
    final totalPresent = _students.where((s) => s.attendanceStatus == AttendanceStatus.present).length;
    return (totalPresent / _students.length) * 100.0;
  }

  List<Student> get schoolWideAtRiskStudents => _students.where((s) => s.isAtRisk).toList();

  // ---------------------------------------------------------------------------
  // 1. SPREADSHEET 1 ENGINE: STUDENTS MASTER (students_master.xlsx)
  // Schema: student_id | name | phone_number | class | class_id_section
  // ---------------------------------------------------------------------------
  IngestionResult ingestStudentsMaster(List<Map<String, dynamic>> rows) {
    int inserted = 0;
    int updated = 0;
    final List<String> errors = [];

    // Track uniqueness within class sections
    final Set<String> processedKeys = {};

    for (int i = 0; i < rows.length; i++) {
      final row = rows[i];
      final rowNum = i + 2; // Row in Excel (skipping header)

      final studentId = row['student_id']?.toString().trim() ?? '';
      final name = row['name']?.toString().trim() ?? '';
      final phone = row['phone_number']?.toString().trim() ?? '';
      final className = row['class']?.toString().trim() ?? 'Grade 10';
      final classIdSection = row['class_id_section']?.toString().trim() ?? '10-A';

      if (name.isEmpty) {
        errors.add('Row $rowNum: Name is empty.');
        continue;
      }

      // Duplicate Guard within this file or database
      final comboKey = '$name::$classIdSection';
      if (processedKeys.contains(comboKey)) {
        return IngestionResult(
          isSuccess: false,
          message: 'Error on Row $rowNum: Duplicate student "$name" in section $classIdSection.\nUpload aborted, no data changed.',
          errorLogs: ['Duplicate student in same class section.'],
        );
      }
      processedKeys.add(comboKey);

      // Check for UPDATE vs INSERT
      final existingIndex = _students.indexWhere(
        (s) => (studentId.isNotEmpty && s.studentId == studentId) ||
            (s.name.toLowerCase() == name.toLowerCase() && s.classIdSection == classIdSection),
      );

      if (existingIndex >= 0) {
        final existing = _students[existingIndex];
        _students[existingIndex] = Student(
          id: existing.id,
          studentId: studentId.isNotEmpty ? studentId : existing.studentId,
          rollNumber: existing.rollNumber,
          name: name,
          className: className,
          classIdSection: classIdSection,
          parentPhone: phone.isNotEmpty ? phone : existing.parentPhone,
          attendanceStatus: existing.attendanceStatus,
          attendanceRate: existing.attendanceRate,
          recentTestScores: existing.recentTestScores,
          remarks: existing.remarks,
        );
        updated++;
      } else {
        final newId = 'stu_${DateTime.now().millisecondsSinceEpoch}_$i';
        final assignedStudentId = studentId.isNotEmpty ? studentId : 'STU-${classIdSection.replaceAll('-', '')}-${(_students.length + 1).toString().padLeft(2, '0')}';
        final rollNo = '${classIdSection}-${(_students.where((s) => s.classIdSection == classIdSection).length + 1).toString().padLeft(2, '0')}';

        _students.add(Student(
          id: newId,
          studentId: assignedStudentId,
          rollNumber: rollNo,
          name: name,
          className: className,
          classIdSection: classIdSection,
          parentPhone: phone,
          attendanceStatus: AttendanceStatus.present,
          attendanceRate: 0.95,
          recentTestScores: [75.0, 80.0],
          remarks: 'Ingested via students_master.xlsx',
        ));
        inserted++;
      }
    }

    notifyListeners();
    return IngestionResult(
      isSuccess: true,
      message: 'Ingestion Completed: $inserted new students inserted, $updated records updated.',
      rowsProcessed: rows.length,
      rowsInserted: inserted,
      rowsUpdated: updated,
      errorLogs: errors,
    );
  }

  // ---------------------------------------------------------------------------
  // 2. SPREADSHEET 2 ENGINE: MARKS MASTER (marks_master.xlsx)
  // Schema: test_id | marks_obtained | student_name | class_id_section | subject | max_marks
  // ---------------------------------------------------------------------------
  IngestionResult ingestMarksMaster(List<Map<String, dynamic>> rows) {
    int updatedCount = 0;
    int insertedCount = 0;

    for (int i = 0; i < rows.length; i++) {
      final row = rows[i];
      final testId = row['test_id']?.toString().trim() ?? 'TST-${DateTime.now().millisecondsSinceEpoch}-$i';
      final marksObtained = double.tryParse(row['marks_obtained']?.toString() ?? '') ?? 0.0;
      final studentName = row['student_name']?.toString().trim() ?? '';
      final classIdSection = row['class_id_section']?.toString().trim() ?? '10-A';
      final subject = row['subject']?.toString().trim() ?? 'Mathematics';
      final maxMarks = double.tryParse(row['max_marks']?.toString() ?? '') ?? 50.0;

      final existingIndex = _testRecords.indexWhere((t) => t.testId == testId);

      if (existingIndex >= 0) {
        final existing = _testRecords[existingIndex];
        _testRecords[existingIndex] = TestRecord(
          id: existing.id,
          testId: testId,
          studentId: existing.studentId,
          studentName: studentName.isNotEmpty ? studentName : existing.studentName,
          classIdSection: classIdSection,
          subject: subject,
          testTitle: existing.testTitle,
          marksObtained: marksObtained,
          maxMarks: maxMarks,
          date: DateTime.now(),
          feedback: existing.feedback,
        );
        updatedCount++;
      } else {
        final student = _students.firstWhere(
          (s) => s.name.toLowerCase() == studentName.toLowerCase() && s.classIdSection == classIdSection,
          orElse: () => _students.first,
        );

        _testRecords.add(TestRecord(
          id: 'tst_${DateTime.now().millisecondsSinceEpoch}_$i',
          testId: testId,
          studentId: student.id,
          studentName: studentName,
          classIdSection: classIdSection,
          subject: subject,
          testTitle: '$subject Assessment',
          marksObtained: marksObtained,
          maxMarks: maxMarks,
          date: DateTime.now(),
          feedback: 'Ingested via marks_master.xlsx',
        ));
        insertedCount++;
      }
    }

    notifyListeners();
    return IngestionResult(
      isSuccess: true,
      message: 'Marks Ledger Synced: $insertedCount tests created, $updatedCount grades updated.',
      rowsProcessed: rows.length,
      rowsInserted: insertedCount,
      rowsUpdated: updatedCount,
    );
  }

  // ---------------------------------------------------------------------------
  // 3. SPREADSHEET 3 ENGINE: TIMETABLE MASTER (timetable_master.xlsx)
  // Schema: class_id_section | subject | teacher_id | day_of_week | start_time | end_time
  // ---------------------------------------------------------------------------
  IngestionResult ingestTimetableMaster(List<Map<String, dynamic>> rows) {
    // Time Collision Guard
    for (int i = 0; i < rows.length; i++) {
      final row = rows[i];
      final rowNum = i + 2;
      final classSection = row['class_id_section']?.toString().trim() ?? '';
      final teacherId = row['teacher_id']?.toString().trim() ?? '';
      final dayOfWeek = int.tryParse(row['day_of_week']?.toString() ?? '') ?? 1;
      final startTime = row['start_time']?.toString().trim() ?? '';
      final endTime = row['end_time']?.toString().trim() ?? '';

      // Check collision with other rows in the file
      for (int j = i + 1; j < rows.length; j++) {
        final other = rows[j];
        final otherClass = other['class_id_section']?.toString().trim() ?? '';
        final otherTeacher = other['teacher_id']?.toString().trim() ?? '';
        final otherDay = int.tryParse(other['day_of_week']?.toString() ?? '') ?? 1;
        final otherStart = other['start_time']?.toString().trim() ?? '';

        if (dayOfWeek == otherDay && startTime == otherStart) {
          if (teacherId == otherTeacher) {
            return IngestionResult(
              isSuccess: false,
              message: 'Time Collision on Row $rowNum & ${j + 2}: Teacher "$teacherId" is double-booked at $startTime on Day $dayOfWeek.\nUpload rejected, schedule unchanged.',
              errorLogs: ['Teacher collision conflict.'],
            );
          }
          if (classSection == otherClass) {
            return IngestionResult(
              isSuccess: false,
              message: 'Time Collision on Row $rowNum & ${j + 2}: Class "$classSection" has overlapping subjects at $startTime on Day $dayOfWeek.\nUpload rejected, schedule unchanged.',
              errorLogs: ['Class section collision conflict.'],
            );
          }
        }
      }
    }

    // If collision free, commit schedule
    _timetable.clear();
    for (int i = 0; i < rows.length; i++) {
      final row = rows[i];
      final classSection = row['class_id_section']?.toString().trim() ?? '10-A';
      final subject = row['subject']?.toString().trim() ?? 'General Science';
      final teacherId = row['teacher_id']?.toString().trim() ?? activeTeacherId;
      final dayOfWeekInt = int.tryParse(row['day_of_week']?.toString() ?? '') ?? 1;
      final startTime24 = row['start_time']?.toString().trim() ?? '08:30:00';
      final endTime24 = row['end_time']?.toString().trim() ?? '09:15:00';

      final dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      final dayName = (dayOfWeekInt >= 1 && dayOfWeekInt <= 5) ? dayNames[dayOfWeekInt - 1] : 'Monday';

      _timetable.add(TimetablePeriod(
        id: 'tt_${DateTime.now().millisecondsSinceEpoch}_$i',
        classIdSection: classSection,
        subject: subject,
        teacherId: teacherId,
        dayOfWeekInt: dayOfWeekInt,
        startTime24: startTime24,
        endTime24: endTime24,
        periodNumber: (i % 6) + 1,
        className: 'Class $classSection',
        room: 'Room ${(i % 3) + 101}',
        startTime: startTime24.substring(0, 5),
        endTime: endTime24.substring(0, 5),
        dayOfWeek: dayName,
        topicPreview: '$subject Core Curriculum',
        isLab: subject.toLowerCase().contains('lab') || subject.toLowerCase().contains('physics'),
      ));
    }

    notifyListeners();
    return IngestionResult(
      isSuccess: true,
      message: 'Master Timetable Committed: ${_timetable.length} schedule periods mapped without collisions.',
      rowsProcessed: rows.length,
      rowsInserted: _timetable.length,
    );
  }

  // ---------------------------------------------------------------------------
  // 4. SPREADSHEET 4 ENGINE: SYLLABUS MASTER (syllabus_master.xlsx)
  // Schema: syllabus_item_id | class_id_section | subject | chapter_number | topic_title | completion_status
  // ---------------------------------------------------------------------------
  IngestionResult ingestSyllabusMaster(List<Map<String, dynamic>> rows) {
    int count = 0;
    for (int i = 0; i < rows.length; i++) {
      final row = rows[i];
      final itemId = row['syllabus_item_id']?.toString().trim() ?? 'SYL-${DateTime.now().millisecondsSinceEpoch}-$i';
      final classSection = row['class_id_section']?.toString().trim() ?? '10-A';
      final subject = row['subject']?.toString().trim() ?? 'Mathematics';
      final chapterNum = int.tryParse(row['chapter_number']?.toString() ?? '') ?? 1;
      final topicTitle = row['topic_title']?.toString().trim() ?? 'General Topic';
      final statusStr = row['completion_status']?.toString().trim().toUpperCase() ?? 'FALSE';
      final isCompleted = statusStr == 'TRUE' || statusStr == '1';

      final existingIndex = _syllabus.indexWhere((s) => s.syllabusItemId == itemId);
      if (existingIndex >= 0) {
        final ex = _syllabus[existingIndex];
        _syllabus[existingIndex] = SyllabusTopic(
          id: ex.id,
          syllabusItemId: itemId,
          classIdSection: classSection,
          subject: subject,
          chapterNumber: chapterNum,
          chapterTitle: ex.chapterTitle,
          topicTitle: topicTitle,
          completionStatus: isCompleted,
          completedAt: isCompleted ? DateTime.now() : null,
          notes: ex.notes,
        );
      } else {
        _syllabus.add(SyllabusTopic(
          id: 'syl_${DateTime.now().millisecondsSinceEpoch}_$i',
          syllabusItemId: itemId,
          classIdSection: classSection,
          subject: subject,
          chapterNumber: chapterNum,
          chapterTitle: 'Chapter $chapterNum',
          topicTitle: topicTitle,
          completionStatus: isCompleted,
        ));
      }
      count++;
    }

    notifyListeners();
    return IngestionResult(
      isSuccess: true,
      message: 'Syllabus Roadmap Updated: $count curriculum items active.',
      rowsProcessed: rows.length,
      rowsInserted: count,
    );
  }

  // ---------------------------------------------------------------------------
  // 5. AUTOMATED RMS CLASSIFIER & TICKET SUBMISSION PIPELINE
  // Keyword classification + active room binding
  // ---------------------------------------------------------------------------
  void submitRmsTicket({
    required String subject,
    required String messageBody,
    bool isPrivate = false,
  }) {
    final category = RmsTicket.classifyText('$subject $messageBody', userToggledPrivate: isPrivate);

    // Extract active room if maintenance
    String? roomSection;
    if (category == RmsCategory.maintenance) {
      final activePeriod = _timetable.firstWhere(
        (p) => p.teacherId == activeTeacherId,
        orElse: () => _timetable.first,
      );
      roomSection = activePeriod.room;
    }

    final newTicket = RmsTicket(
      id: 'rms_${DateTime.now().millisecondsSinceEpoch}',
      noteId: 'RMS-2026-${(_rmsTickets.length + 1).toString().padLeft(3, '0')}',
      timestamp: DateTime.now(),
      teacherId: activeTeacherId,
      teacherName: teacherName,
      teacherEmail: teacherEmail,
      category: category,
      subject: subject,
      messageBody: messageBody,
      roomNumber: roomSection,
      isConfidential: category == RmsCategory.confidential,
      adminResolutionStatus: RmsStatus.pending,
    );

    _rmsTickets.insert(0, newTicket);
    notifyListeners();
  }

  void updateRmsTicketStatus(String id, RmsStatus newStatus, [String? note]) {
    final index = _rmsTickets.indexWhere((t) => t.id == id);
    if (index >= 0) {
      final ticket = _rmsTickets[index];
      ticket.adminResolutionStatus = newStatus;
      if (note != null) ticket.principalNote = note;
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // EXPORT ENGINES (Generates identical CSV/Excel snapshot strings)
  // ---------------------------------------------------------------------------
  String exportStudentsMaster({String? classFilter}) {
    final filtered = classFilter != null
        ? _students.where((s) => s.classIdSection == classFilter).toList()
        : _students;

    final buffer = StringBuffer();
    buffer.writeln('student_id,name,phone_number,class,class_id_section');
    for (final s in filtered) {
      buffer.writeln('${s.studentId},${s.name},${s.parentPhone},${s.className},${s.classIdSection}');
    }
    return buffer.toString();
  }

  String exportMarksMaster({String? classFilter}) {
    final filtered = classFilter != null
        ? _testRecords.where((t) => t.classIdSection == classFilter).toList()
        : _testRecords;

    final buffer = StringBuffer();
    buffer.writeln('test_id,marks_obtained,student_name,class_id_section,subject,max_marks');
    for (final t in filtered) {
      buffer.writeln('${t.testId},${t.marksObtained},${t.studentName},${t.classIdSection},${t.subject},${t.maxMarks}');
    }
    return buffer.toString();
  }

  String exportTimetableMaster({String? classFilter}) {
    final filtered = classFilter != null
        ? _timetable.where((p) => p.classIdSection == classFilter).toList()
        : _timetable;

    final buffer = StringBuffer();
    buffer.writeln('class_id_section,subject,teacher_id,day_of_week,start_time,end_time');
    for (final p in filtered) {
      buffer.writeln('${p.classIdSection},${p.subject},${p.teacherId},${p.dayOfWeekInt},${p.startTime24},${p.endTime24}');
    }
    return buffer.toString();
  }

  String exportSyllabusMaster({String? classFilter}) {
    final filtered = classFilter != null
        ? _syllabus.where((s) => s.classIdSection == classFilter).toList()
        : _syllabus;

    final buffer = StringBuffer();
    buffer.writeln('syllabus_item_id,class_id_section,subject,chapter_number,topic_title,completion_status');
    for (final s in filtered) {
      buffer.writeln('${s.syllabusItemId},${s.classIdSection},${s.subject},${s.chapterNumber},${s.topicTitle},${s.completionStatus ? "TRUE" : "FALSE"}');
    }
    return buffer.toString();
  }

  String exportRmsRecords() {
    final buffer = StringBuffer();
    buffer.writeln('note_id,timestamp,teacher_name,classification_tag,message_body,admin_resolution_status');
    for (final r in _rmsTickets) {
      buffer.writeln('${r.noteId},${r.timestamp.toIso8601String()},${r.teacherName},${r.classificationTag},"${r.messageBody.replaceAll('"', '""')}",${r.status.name}');
    }
    return buffer.toString();
  }

  // ---------------------------------------------------------------------------
  // RAW CSV PARSER & IN-APP SPREADSHEET INGESTION ENGINE
  // ---------------------------------------------------------------------------
  IngestionResult parseAndIngestCsv(String spreadsheetType, String rawCsv) {
    final lines = rawCsv
        .split(RegExp(r'[\r\n]+'))
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    if (lines.length <= 1) {
      return IngestionResult(
        isSuccess: false,
        message: 'Empty CSV: Provide at least a header row and 1 data row.',
      );
    }

    final headers = lines[0].split(',').map((h) => h.trim().toLowerCase()).toList();
    final List<Map<String, dynamic>> rows = [];

    for (int i = 1; i < lines.length; i++) {
      final cells = lines[i].split(',').map((c) => c.trim()).toList();
      final Map<String, dynamic> rowMap = {};
      for (int h = 0; h < headers.length; h++) {
        if (h < cells.length) {
          rowMap[headers[h]] = cells[h];
        }
      }
      rows.add(rowMap);
    }

    String targetType = spreadsheetType;
    if (targetType == 'auto' || targetType.isEmpty) {
      if (headers.contains('phone_number') || headers.contains('rollnumber') || headers.contains('student_id') || headers.contains('class_id_section')) {
        targetType = 'students_master';
      } else if (headers.contains('marks_obtained') || headers.contains('test_id')) {
        targetType = 'marks_master';
      } else if (headers.contains('start_time') || headers.contains('teacher_id') || headers.contains('day_of_week')) {
        targetType = 'timetable_master';
      } else if (headers.contains('chapter_number') || headers.contains('completion_status') || headers.contains('syllabus_item_id')) {
        targetType = 'syllabus_master';
      } else {
        targetType = 'students_master';
      }
    }

    switch (targetType) {
      case 'students_master':
        return ingestStudentsMaster(rows);
      case 'marks_master':
        return ingestMarksMaster(rows);
      case 'timetable_master':
        return ingestTimetableMaster(rows);
      case 'syllabus_master':
        return ingestSyllabusMaster(rows);
      default:
        return IngestionResult(isSuccess: false, message: 'Unknown spreadsheet type.');
    }
  }

  // ---------------------------------------------------------------------------
  // IN-APP DIRECT SPREADSHEET CRUD ACTIONS
  // ---------------------------------------------------------------------------
  void addNewStudent({
    required String name,
    required String classIdSection,
    required String phone,
  }) {
    final newId = 'stu_${DateTime.now().millisecondsSinceEpoch}';
    final rollNo = '$classIdSection-${(_students.where((s) => s.classIdSection == classIdSection).length + 1).toString().padLeft(2, '0')}';
    final stuId = 'STU-${classIdSection.replaceAll("-", "")}-${rollNo.split('-').last}';

    _students.add(Student(
      id: newId,
      studentId: stuId,
      rollNumber: rollNo,
      name: name,
      className: 'Class $classIdSection',
      classIdSection: classIdSection,
      parentPhone: phone,
      attendanceRate: 0.95,
      recentTestScores: [75.0, 80.0],
      remarks: 'Added via In-App Grid Editor',
    ));
    notifyListeners();
  }

  void deleteStudent(String id) {
    _students.removeWhere((s) => s.id == id);
    notifyListeners();
  }

  void addNewTimetablePeriod({
    required String classIdSection,
    required String subject,
    required String teacherId,
    required int dayOfWeekInt,
    required String startTime24,
    required String endTime24,
    required String room,
  }) {
    final dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    final dayName = (dayOfWeekInt >= 1 && dayOfWeekInt <= 5) ? dayNames[dayOfWeekInt - 1] : 'Monday';

    _timetable.add(TimetablePeriod(
      id: 'tt_${DateTime.now().millisecondsSinceEpoch}',
      classIdSection: classIdSection,
      subject: subject,
      teacherId: teacherId,
      dayOfWeekInt: dayOfWeekInt,
      startTime24: startTime24,
      endTime24: endTime24,
      periodNumber: (_timetable.length % 6) + 1,
      className: 'Class $classIdSection',
      room: room,
      startTime: startTime24.length >= 5 ? startTime24.substring(0, 5) : startTime24,
      endTime: endTime24.length >= 5 ? endTime24.substring(0, 5) : endTime24,
      dayOfWeek: dayName,
      topicPreview: '$subject Core',
      isLab: subject.toLowerCase().contains('lab'),
    ));
    notifyListeners();
  }

  void deleteTimetablePeriod(String id) {
    _timetable.removeWhere((p) => p.id == id);
    notifyListeners();
  }

  void addNewSyllabusTopic({
    required String classIdSection,
    required String subject,
    required int chapterNumber,
    required String topicTitle,
    bool completionStatus = false,
  }) {
    _syllabus.add(SyllabusTopic(
      id: 'syl_${DateTime.now().millisecondsSinceEpoch}',
      syllabusItemId: 'SYL-${classIdSection.replaceAll("-", "")}-${(_syllabus.length + 1).toString().padLeft(2, '0')}',
      classIdSection: classIdSection,
      subject: subject,
      chapterNumber: chapterNumber,
      chapterTitle: 'Chapter $chapterNumber',
      topicTitle: topicTitle,
      completionStatus: completionStatus,
    ));
    notifyListeners();
  }

  void deleteSyllabusTopic(String id) {
    _syllabus.removeWhere((t) => t.id == id);
    notifyListeners();
  }

  void addNewTestRecord({
    required String studentName,
    required String classIdSection,
    required String subject,
    required double marksObtained,
    double maxMarks = 50.0,
  }) {
    final student = _students.firstWhere(
      (s) => s.name.toLowerCase() == studentName.toLowerCase(),
      orElse: () => _students.first,
    );

    _testRecords.add(TestRecord(
      id: 'tst_${DateTime.now().millisecondsSinceEpoch}',
      testId: 'TST-${classIdSection.replaceAll("-", "")}-${(_testRecords.length + 1).toString().padLeft(2, '0')}',
      studentId: student.id,
      studentName: studentName,
      classIdSection: classIdSection,
      className: 'Class $classIdSection',
      subject: subject,
      title: '$subject Assessment',
      marksObtained: marksObtained,
      maxMarks: maxMarks,
      date: DateTime.now(),
      studentScores: {student.id: marksObtained},
    ));
    notifyListeners();
  }

  void deleteTestRecord(String id) {
    _testRecords.removeWhere((t) => t.id == id || t.testId == id);
    notifyListeners();
  }

  // Teacher Workspace Actions
  void toggleAttendance(String studentId) {
    final index = _students.indexWhere((s) => s.id == studentId);
    if (index >= 0) {
      final s = _students[index];
      s.attendanceStatus = (s.attendanceStatus == AttendanceStatus.present)
          ? AttendanceStatus.absent
          : AttendanceStatus.present;
      notifyListeners();
    }
  }

  void markAllPresent(String className) {
    for (var s in _students) {
      if (s.className == className) {
        s.attendanceStatus = AttendanceStatus.present;
      }
    }
    notifyListeners();
  }

  void toggleSyllabusTopic(String topicId) {
    final index = _syllabus.indexWhere((t) => t.id == topicId);
    if (index >= 0) {
      _syllabus[index].completionStatus = !_syllabus[index].completionStatus;
      notifyListeners();
    }
  }

  void updateStudentScore(String studentId, double newScore) {
    final index = _students.indexWhere((s) => s.id == studentId);
    if (index >= 0) {
      final s = _students[index];
      final scores = List<double>.from(s.recentTestScores);
      if (scores.isNotEmpty) {
        scores[scores.length - 1] = newScore;
      } else {
        scores.add(newScore);
      }
      _students[index] = Student(
        id: s.id,
        studentId: s.studentId,
        rollNumber: s.rollNumber,
        name: s.name,
        className: s.className,
        classIdSection: s.classIdSection,
        parentPhone: s.parentPhone,
        attendanceStatus: s.attendanceStatus,
        attendanceRate: s.attendanceRate,
        recentTestScores: scores,
        remarks: s.remarks,
      );
      notifyListeners();
    }
  }

  List<Student> getAtRiskStudents(String className) {
    return _students.where((s) => s.className == className && s.isAtRisk).toList();
  }

  double getSyllabusProgress(String className, String subject) {
    final cleanSection = className.replaceAll('Class', '').trim();
    final topics = _syllabus.where((t) =>
        (t.className == className || t.classIdSection == cleanSection || t.classIdSection == className) &&
        t.subject.toLowerCase().contains(subject.toLowerCase())).toList();
    if (topics.isEmpty) return 0.65;
    final completed = topics.where((t) => t.isCompleted).length;
    return completed / topics.length;
  }

  // ---------------------------------------------------------------------------
  // EXAMINATION & ASSESSMENT HIERARCHY SYSTEM
  // ---------------------------------------------------------------------------
  List<TestRecord> get classTestsAndCAs =>
      _testRecords.where((t) => !t.isPrincipalMandated).toList();

  List<TestRecord> get principalMandatedExams =>
      _testRecords.where((t) => t.isPrincipalMandated).toList();

  // Teacher-Scoped Assessment Creator (Scope-locked to assigned classes & subjects)
  bool createTeacherAssessment({
    required String title,
    required String className,
    required String subject,
    required double maxMarks,
    required ExamCategory examCategory,
    required DateTime date,
  }) {
    final cleanSection = className.replaceAll('Class', '').trim();
    final studentsInClass = _students.where((s) => s.className == className || s.classIdSection == cleanSection).toList();

    final Map<String, double> initialScores = {};
    for (var s in studentsInClass) {
      initialScores[s.id] = (maxMarks * 0.75).roundToDouble();
    }

    final newTest = TestRecord(
      id: 'tst_${DateTime.now().millisecondsSinceEpoch}',
      testId: 'CA-${cleanSection.replaceAll("-", "")}-${(_testRecords.length + 1).toString().padLeft(2, '0')}',
      studentName: 'Class Cohort',
      classIdSection: cleanSection,
      className: className,
      subject: subject,
      title: title,
      marksObtained: (maxMarks * 0.75).roundToDouble(),
      maxMarks: maxMarks,
      date: date,
      examCategory: examCategory,
      isPrincipalMandated: false,
      createdBy: teacherName,
      weightagePercent: examCategory == ExamCategory.ca1 ? 15.0 : 20.0,
      studentScores: initialScores,
    );

    _testRecords.insert(0, newTest);
    notifyListeners();
    return true;
  }

  // Principal-Scoped Institutional Exam Creator (Mid-Term & End-Term)
  void createPrincipalExamination({
    required String title,
    required String targetClass,
    required String subject,
    required double maxMarks,
    required ExamCategory examCategory,
    required DateTime date,
    double weightage = 40.0,
  }) {
    final cleanSection = targetClass.replaceAll('Class', '').trim();
    final studentsInClass = _students.where((s) => s.className == targetClass || s.classIdSection == cleanSection).toList();

    final Map<String, double> initialScores = {};
    for (var s in studentsInClass) {
      initialScores[s.id] = (maxMarks * 0.65).roundToDouble();
    }

    final newExam = TestRecord(
      id: 'exam_${DateTime.now().millisecondsSinceEpoch}',
      testId: '${examCategory == ExamCategory.midTerm ? "MID" : "END"}-${cleanSection.replaceAll("-", "")}-${(_testRecords.length + 1).toString().padLeft(2, '0')}',
      studentName: 'Institutional Cohort',
      classIdSection: cleanSection,
      className: targetClass,
      subject: subject,
      title: title,
      marksObtained: (maxMarks * 0.65).roundToDouble(),
      maxMarks: maxMarks,
      date: date,
      examCategory: examCategory,
      isPrincipalMandated: true,
      createdBy: 'Principal $adminName',
      weightagePercent: weightage,
      studentScores: initialScores,
    );

    _testRecords.insert(0, newExam);
    notifyListeners();
  }

  void updateTestStudentScore(String testId, String studentId, double score) {
    final index = _testRecords.indexWhere((t) => t.id == testId || t.testId == testId);
    if (index >= 0) {
      final t = _testRecords[index];
      final updatedMap = Map<String, double>.from(t.studentScores);
      updatedMap[studentId] = score;
      t.studentScores = updatedMap;
      updateStudentScore(studentId, score);
      notifyListeners();
    }
  }

  void createRmsTicket({
    required RmsCategory category,
    required String subject,
    required String description,
  }) {
    submitRmsTicket(
      subject: subject,
      messageBody: description,
      isPrivate: category == RmsCategory.confidential,
    );
  }

  void addFacultyMember(String name, String email, String dept, List<String> classes) {
    _facultyList.add(TeacherAccount(
      id: 'tch_${DateTime.now().millisecondsSinceEpoch}',
      name: name,
      email: email,
      department: dept,
      assignedClasses: classes,
    ));
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // INITIAL DATA INITIALIZER
  // ---------------------------------------------------------------------------
  void _initializeData() {
    _facultyList = [
      TeacherAccount(
        id: 'tch_sarah_01',
        name: 'Prof. Sarah Nawaz',
        email: 's.nawaz@school.edu',
        department: 'Science & Mathematics Dept',
        assignedClasses: ['Class 10-A', 'Class 9-A'],
      ),
      TeacherAccount(
        id: 'tch_imran_02',
        name: 'Dr. Imran Khan',
        email: 'i.khan@school.edu',
        department: 'English Literature Dept',
        assignedClasses: ['Class 10-B', 'Class 8-A'],
      ),
      TeacherAccount(
        id: 'tch_ayesha_03',
        name: 'Ms. Ayesha Siddiqa',
        email: 'a.siddiqa@school.edu',
        department: 'Computer Science Dept',
        assignedClasses: ['Class 10-A', 'Class 10-B'],
      ),
      TeacherAccount(
        id: 'tch_raheem_04',
        name: 'Engr. Raheem',
        email: 'raheem.lab@school.edu',
        department: 'Physics & Lab Infrastructure',
        assignedClasses: ['Class 10-A', 'Class 9-A'],
      ),
    ];

    _students = [
      Student(
        id: 'stu_1',
        studentId: 'STU-10A-01',
        rollNumber: '10A-01',
        name: 'Zainab Ahmed',
        className: 'Class 10-A',
        classIdSection: '10-A',
        parentPhone: '+92 300 1234567',
        attendanceRate: 0.96,
        recentTestScores: [88.0, 92.0, 85.0],
        remarks: 'Excellent in STEM concepts',
      ),
      Student(
        id: 'stu_2',
        studentId: 'STU-10A-02',
        rollNumber: '10A-02',
        name: 'Hamza Malik',
        className: 'Class 10-A',
        classIdSection: '10-A',
        parentPhone: '+92 321 7654321',
        attendanceRate: 0.84,
        recentTestScores: [65.0, 70.0, 68.0],
        remarks: 'Consistent homework submission',
      ),
      Student(
        id: 'stu_3',
        studentId: 'STU-10A-03',
        rollNumber: '10A-03',
        name: 'Bilal Farooq',
        className: 'Class 10-A',
        classIdSection: '10-A',
        parentPhone: '+92 333 9988776',
        attendanceRate: 0.62,
        recentTestScores: [28.0, 31.0, 29.0], // <35% At Risk
        remarks: 'Needs urgent remedial attention in Algebra',
      ),
      Student(
        id: 'stu_4',
        studentId: 'STU-10A-04',
        rollNumber: '10A-04',
        name: 'Amina Tariq',
        className: 'Class 10-A',
        classIdSection: '10-A',
        parentPhone: '+92 345 5544332',
        attendanceRate: 0.98,
        recentTestScores: [94.0, 96.0, 91.0],
        remarks: 'Class topper candidate',
      ),
      Student(
        id: 'stu_5',
        studentId: 'STU-10A-05',
        rollNumber: '10A-05',
        name: 'Usman Ali',
        className: 'Class 10-A',
        classIdSection: '10-A',
        parentPhone: '+92 312 1122334',
        attendanceRate: 0.88,
        recentTestScores: [74.0, 78.0, 72.0],
        remarks: 'Good lab participation',
      ),
      Student(
        id: 'stu_6',
        studentId: 'STU-10A-06',
        rollNumber: '10A-06',
        name: 'Danish Qureshi',
        className: 'Class 10-A',
        classIdSection: '10-A',
        parentPhone: '+92 301 8877665',
        attendanceRate: 0.58,
        recentTestScores: [32.0, 30.0, 34.0], // <35% At Risk
        remarks: 'Irregular attendance, missing quizzes',
      ),
      Student(
        id: 'stu_7',
        studentId: 'STU-9A-01',
        rollNumber: '9A-01',
        name: 'Fatima Noor',
        className: 'Class 9-A',
        classIdSection: '9-A',
        parentPhone: '+92 300 4433221',
        attendanceRate: 0.94,
        recentTestScores: [82.0, 86.0],
        remarks: 'Strong biology understanding',
      ),
      Student(
        id: 'stu_8',
        studentId: 'STU-9A-02',
        rollNumber: '9A-02',
        name: 'Saad Raza',
        className: 'Class 9-A',
        classIdSection: '9-A',
        parentPhone: '+92 322 6655443',
        attendanceRate: 0.90,
        recentTestScores: [78.0, 75.0],
        remarks: 'Active sports & academics',
      ),
    ];

    _timetable = [
      TimetablePeriod(
        id: 'tt_1',
        classIdSection: '10-A',
        subject: 'Mathematics (Algebra)',
        teacherId: 'tch_sarah_01',
        dayOfWeekInt: 1,
        startTime24: '08:30:00',
        endTime24: '09:15:00',
        periodNumber: 1,
        className: 'Class 10-A',
        room: 'Room 204',
        startTime: '08:30 AM',
        endTime: '09:15 AM',
        dayOfWeek: 'Monday',
        topicPreview: 'Quadratic Equations Ex 2.4',
      ),
      TimetablePeriod(
        id: 'tt_2',
        classIdSection: '10-A',
        subject: 'Physics Lab (Optics)',
        teacherId: 'tch_sarah_01',
        dayOfWeekInt: 1,
        startTime24: '09:20:00',
        endTime24: '10:05:00',
        periodNumber: 2,
        className: 'Class 10-A',
        room: 'Science Lab B',
        startTime: '09:20 AM',
        endTime: '10:05 AM',
        dayOfWeek: 'Monday',
        topicPreview: 'Refraction Index & Prism',
        isLab: true,
      ),
      TimetablePeriod(
        id: 'tt_3',
        classIdSection: '9-A',
        subject: 'General Science',
        teacherId: 'tch_sarah_01',
        dayOfWeekInt: 1,
        startTime24: '10:30:00',
        endTime24: '11:15:00',
        periodNumber: 3,
        className: 'Class 9-A',
        room: 'Room 105',
        startTime: '10:30 AM',
        endTime: '11:15 AM',
        dayOfWeek: 'Monday',
        topicPreview: 'Cell Structure & Mitochondria',
      ),
      TimetablePeriod(
        id: 'tt_4',
        classIdSection: '10-A',
        subject: 'Mathematics (Geometry)',
        teacherId: 'tch_sarah_01',
        dayOfWeekInt: 2,
        startTime24: '08:30:00',
        endTime24: '09:15:00',
        periodNumber: 1,
        className: 'Class 10-A',
        room: 'Room 204',
        startTime: '08:30 AM',
        endTime: '09:15 AM',
        dayOfWeek: 'Tuesday',
        topicPreview: 'Circle Theorems & Tangents',
      ),
    ];

    _syllabus = [
      SyllabusTopic(
        id: 'syl_1',
        syllabusItemId: 'SYL-10A-M01',
        classIdSection: '10-A',
        subject: 'Mathematics',
        chapterNumber: 1,
        chapterTitle: 'Unit 1: Quadratic Equations',
        topicTitle: 'Standard Form & Factoring Method',
        completionStatus: true,
        completedAt: DateTime.now().subtract(const Duration(days: 10)),
      ),
      SyllabusTopic(
        id: 'syl_2',
        syllabusItemId: 'SYL-10A-M02',
        classIdSection: '10-A',
        subject: 'Mathematics',
        chapterNumber: 1,
        chapterTitle: 'Unit 1: Quadratic Equations',
        topicTitle: 'Quadratic Formula Derivation',
        completionStatus: true,
        completedAt: DateTime.now().subtract(const Duration(days: 5)),
      ),
      SyllabusTopic(
        id: 'syl_3',
        syllabusItemId: 'SYL-10A-M03',
        classIdSection: '10-A',
        subject: 'Mathematics',
        chapterNumber: 1,
        chapterTitle: 'Unit 1: Quadratic Equations',
        topicTitle: 'Word Problems & Real-World Modeling',
        completionStatus: false,
      ),
      SyllabusTopic(
        id: 'syl_4',
        syllabusItemId: 'SYL-10A-P01',
        classIdSection: '10-A',
        subject: 'Physics',
        chapterNumber: 2,
        chapterTitle: 'Unit 2: Geometrical Optics',
        topicTitle: 'Snell\'s Law & Total Internal Reflection',
        completionStatus: true,
      ),
    ];

    _testRecords = [
      TestRecord(
        id: 'tst_1',
        testId: 'CA-10A-01',
        studentId: 'stu_1',
        studentName: 'Zainab Ahmed',
        classIdSection: '10-A',
        className: 'Class 10-A',
        subject: 'Mathematics',
        title: 'CA-1: Unit 1 Quadratic Equations Quiz',
        marksObtained: 46.0,
        maxMarks: 50.0,
        date: DateTime.now().subtract(const Duration(days: 7)),
        examCategory: ExamCategory.ca1,
        isPrincipalMandated: false,
        createdBy: 'Prof. Sarah Nawaz',
        weightagePercent: 15.0,
        studentScores: {
          'stu_1': 46.0,
          'stu_2': 34.0,
          'stu_3': 14.5,
          'stu_4': 48.0,
          'stu_5': 38.0,
          'stu_6': 16.0,
        },
      ),
      TestRecord(
        id: 'tst_2',
        testId: 'CA-10A-02',
        studentId: 'stu_1',
        studentName: 'Zainab Ahmed',
        classIdSection: '10-A',
        className: 'Class 10-A',
        subject: 'Physics',
        title: 'CA-2: Optics & Snell\'s Law Assessment',
        marksObtained: 42.0,
        maxMarks: 50.0,
        date: DateTime.now().subtract(const Duration(days: 3)),
        examCategory: ExamCategory.ca2,
        isPrincipalMandated: false,
        createdBy: 'Prof. Sarah Nawaz',
        weightagePercent: 15.0,
        studentScores: {
          'stu_1': 42.0,
          'stu_2': 30.0,
          'stu_3': 12.0,
          'stu_4': 45.0,
          'stu_5': 32.0,
          'stu_6': 15.0,
        },
      ),
      TestRecord(
        id: 'exam_mid_1',
        testId: 'MID-10A-01',
        studentId: 'stu_1',
        studentName: 'Zainab Ahmed',
        classIdSection: '10-A',
        className: 'Class 10-A',
        subject: 'Mathematics',
        title: 'Mid-Term Institutional Examination 2026',
        marksObtained: 88.0,
        maxMarks: 100.0,
        date: DateTime.now().add(const Duration(days: 14)),
        examCategory: ExamCategory.midTerm,
        isPrincipalMandated: true,
        createdBy: 'Principal Dr. Tariq Nawaz',
        weightagePercent: 30.0,
        studentScores: {
          'stu_1': 88.0,
          'stu_2': 72.0,
          'stu_3': 32.0, // Flagged <35%
          'stu_4': 94.0,
          'stu_5': 68.0,
          'stu_6': 28.0, // Flagged <35%
        },
      ),
      TestRecord(
        id: 'exam_end_1',
        testId: 'END-10A-01',
        studentId: 'stu_1',
        studentName: 'Zainab Ahmed',
        classIdSection: '10-A',
        className: 'Class 10-A',
        subject: 'Mathematics',
        title: 'Annual Final Examination 2026',
        marksObtained: 91.0,
        maxMarks: 100.0,
        date: DateTime.now().add(const Duration(days: 45)),
        examCategory: ExamCategory.endTerm,
        isPrincipalMandated: true,
        createdBy: 'Principal Dr. Tariq Nawaz',
        weightagePercent: 40.0,
        studentScores: {
          'stu_1': 91.0,
          'stu_2': 78.0,
          'stu_3': 34.0,
          'stu_4': 98.0,
          'stu_5': 74.0,
          'stu_6': 30.0,
        },
      ),
    ];

    _rmsTickets = [
      RmsTicket(
        id: 'rms_1',
        noteId: 'RMS-2026-001',
        timestamp: DateTime.now().subtract(const Duration(hours: 3)),
        teacherId: 'tch_sarah_01',
        teacherName: 'Prof. Sarah Nawaz',
        teacherEmail: 's.nawaz@school.edu',
        category: RmsCategory.maintenance,
        subject: 'Lab B Projector HDMI Port Damaged',
        messageBody: 'The HDMI display connection in Science Lab B is loose and flickering during optics experiments.',
        roomNumber: 'Science Lab B',
        adminResolutionStatus: RmsStatus.underReview,
        principalNote: 'Assigned to Engr. Raheem for repair.',
      ),
      RmsTicket(
        id: 'rms_2',
        noteId: 'RMS-2026-002',
        timestamp: DateTime.now().subtract(const Duration(days: 1)),
        teacherId: 'tch_imran_02',
        teacherName: 'Dr. Imran Khan',
        teacherEmail: 'i.khan@school.edu',
        category: RmsCategory.staffLeave,
        subject: 'Casual Leave Request (Medical Checkup)',
        messageBody: 'Requesting 1 day casual medical leave on Friday for routine appointment.',
        adminResolutionStatus: RmsStatus.approved,
        principalNote: 'Approved. Substitute teacher arranged.',
      ),
      RmsTicket(
        id: 'rms_3',
        noteId: 'RMS-2026-003',
        timestamp: DateTime.now().subtract(const Duration(days: 2)),
        teacherId: 'tch_ayesha_03',
        teacherName: 'Ms. Ayesha Siddiqa',
        teacherEmail: 'a.siddiqa@school.edu',
        category: RmsCategory.confidential,
        subject: 'Confidential Disciplinary Alert',
        messageBody: 'Private notification regarding recurring student behavioral disruptions in Grade 10-B computer lab.',
        isConfidential: true,
        adminResolutionStatus: RmsStatus.pending,
      ),
    ];
  }
}
