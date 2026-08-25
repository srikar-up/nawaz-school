enum AttendanceStatus { present, absent, late, excused }

class Student {
  final String id; // Internal UUID
  final String studentId; // Column A: student_id (e.g. "STU-10A-01")
  final String rollNumber;
  final String name; // Column B: name
  final String parentPhone; // Column C: phone_number
  final String className; // Column D: class (e.g. "Grade 10")
  final String classIdSection; // Column E: class_id_section (e.g. "10-A")
  final String avatarUrl;
  AttendanceStatus attendanceStatus;
  final double attendanceRate; // e.g. 0.94 -> 94%
  final List<double> recentTestScores; // scores in percentages
  final String remarks;

  Student({
    required this.id,
    String? studentId,
    required this.rollNumber,
    required this.name,
    required this.className,
    String? classIdSection,
    required this.parentPhone,
    this.avatarUrl = '',
    this.attendanceStatus = AttendanceStatus.present,
    this.attendanceRate = 0.92,
    this.recentTestScores = const [],
    this.remarks = 'Active participant',
  })  : studentId = studentId ?? 'STU-${rollNumber}',
        classIdSection = classIdSection ?? (className.contains('10') ? '10-A' : '9-A');

  // Automated Risk Profiling Rule: If drops below 35% in recent tests
  bool get isAtRisk {
    if (recentTestScores.isEmpty) return false;
    final avg = recentTestScores.reduce((a, b) => a + b) / recentTestScores.length;
    return avg < 35.0 || (recentTestScores.length >= 2 && recentTestScores.last < 35.0);
  }

  double get averageScore {
    if (recentTestScores.isEmpty) return 0.0;
    return recentTestScores.reduce((a, b) => a + b) / recentTestScores.length;
  }
}
