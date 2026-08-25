enum ExamCategory {
  classTest, // Teacher created (CA-1, Quiz, Unit Test)
  ca1, // Continuous Assessment 1 (Teacher)
  ca2, // Continuous Assessment 2 (Teacher)
  midTerm, // Formal Institutional Exam (Principal / Admin Portal)
  endTerm, // Formal Final Examination (Principal / Admin Portal)
}

class TestRecord {
  final String id;
  final String testId; // Column A: test_id (e.g. "TST-10A-M01")
  final String studentId;
  final String studentName; // Column C: student_name
  final String classIdSection; // Column D: class_id_section (e.g. "10-A")
  final String className;
  final String subject; // Column E: subject (e.g. "Mathematics")
  final String title;
  double marksObtained; // Column B: marks_obtained
  final double maxMarks; // Column F: max_marks
  final DateTime date;
  final String feedback;
  final ExamCategory examCategory;
  final bool isPrincipalMandated;
  final String createdBy;
  final double weightagePercent;
  Map<String, double> studentScores;

  TestRecord({
    required this.id,
    String? testId,
    this.studentId = '',
    this.studentName = '',
    this.classIdSection = '10-A',
    this.className = 'Class 10-A',
    String? subject,
    String? title,
    String? testTitle,
    this.marksObtained = 0.0,
    this.maxMarks = 50.0,
    DateTime? date,
    this.feedback = '',
    ExamCategory? examCategory,
    bool? isPrincipalMandated,
    String? createdBy,
    this.weightagePercent = 20.0,
    Map<String, double>? studentScores,
  })  : testId = testId ?? 'TST-10A-${DateTime.now().millisecondsSinceEpoch % 1000}',
        subject = subject ?? 'Mathematics',
        title = title ?? testTitle ?? 'Assessment',
        date = date ?? DateTime.now(),
        examCategory = examCategory ??
            ((title ?? testTitle ?? '').toLowerCase().contains('mid')
                ? ExamCategory.midTerm
                : (title ?? testTitle ?? '').toLowerCase().contains('end') ||
                        (title ?? testTitle ?? '').toLowerCase().contains('final')
                    ? ExamCategory.endTerm
                    : ExamCategory.classTest),
        isPrincipalMandated = isPrincipalMandated ??
            ((title ?? testTitle ?? '').toLowerCase().contains('mid') ||
                (title ?? testTitle ?? '').toLowerCase().contains('end') ||
                (title ?? testTitle ?? '').toLowerCase().contains('final')),
        createdBy = createdBy ??
            (((title ?? testTitle ?? '').toLowerCase().contains('mid') ||
                    (title ?? testTitle ?? '').toLowerCase().contains('end'))
                ? 'Principal / Admin Node'
                : 'Subject Teacher'),
        studentScores = studentScores ?? {};

  String get testTitle => title;
  double get percentage => maxMarks > 0 ? (marksObtained / maxMarks) * 100.0 : 0.0;
  bool get isFailing => percentage < 35.0;

  String get categoryLabel {
    switch (examCategory) {
      case ExamCategory.classTest:
        return 'Class Test';
      case ExamCategory.ca1:
        return 'CA-1 (Continuous Assessment)';
      case ExamCategory.ca2:
        return 'CA-2 (Continuous Assessment)';
      case ExamCategory.midTerm:
        return 'Mid-Term Institutional Exam';
      case ExamCategory.endTerm:
        return 'End-Term Final Examination';
    }
  }

  double get classAveragePercentage {
    if (studentScores.isEmpty) return percentage;
    final total = studentScores.values.reduce((a, b) => a + b);
    final avg = total / studentScores.length;
    return (avg / maxMarks) * 100.0;
  }

  bool get isClassAtRisk => classAveragePercentage < 50.0;

  int get passCount {
    if (studentScores.isEmpty) return isFailing ? 0 : 1;
    return studentScores.values.where((s) => (s / maxMarks) >= 0.40).length;
  }

  int get failCount {
    if (studentScores.isEmpty) return isFailing ? 1 : 0;
    return studentScores.values.where((s) => (s / maxMarks) < 0.40).length;
  }
}
