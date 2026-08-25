class TimetablePeriod {
  final String id;
  final String classIdSection; // Column A: class_id_section (e.g. "10-A")
  final String subject; // Column B: subject (e.g. "Mathematics")
  final String teacherId; // Column C: teacher_id (e.g. "tch_sarah_01")
  final int dayOfWeekInt; // Column D: day_of_week (1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri)
  final String startTime24; // Column E: start_time ("08:30:00")
  final String endTime24; // Column F: end_time ("09:15:00")
  final int periodNumber;
  final String className;
  final String room;
  final String startTime; // formatted for UI "08:30 AM"
  final String endTime; // formatted for UI "09:15 AM"
  final String dayOfWeek; // "Monday", "Tuesday", etc.
  final String topicPreview;
  final bool isLab;

  TimetablePeriod({
    required this.id,
    String? classIdSection,
    required this.subject,
    String? teacherId,
    int? dayOfWeekInt,
    String? startTime24,
    String? endTime24,
    required this.periodNumber,
    required this.className,
    required this.room,
    required this.startTime,
    required this.endTime,
    required this.dayOfWeek,
    this.topicPreview = 'General Class Work',
    this.isLab = false,
  })  : classIdSection = classIdSection ?? (className.contains('10') ? '10-A' : '9-A'),
        teacherId = teacherId ?? 'tch_sarah_01',
        dayOfWeekInt = dayOfWeekInt ?? 1,
        startTime24 = startTime24 ?? '08:30:00',
        endTime24 = endTime24 ?? '09:15:00';
}
