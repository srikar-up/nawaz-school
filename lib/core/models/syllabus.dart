class SyllabusTopic {
  final String id;
  final String syllabusItemId; // Column A: syllabus_item_id (e.g. "SYL-10A-M01")
  final String classIdSection; // Column B: class_id_section (e.g. "10-A")
  final String subject; // Column C: subject (e.g. "Mathematics")
  final int chapterNumber; // Column D: chapter_number (e.g. 1)
  final String chapterTitle;
  final String topicTitle; // Column E: topic_title
  bool completionStatus; // Column F: completion_status (TRUE / FALSE)
  final DateTime? completedAt;
  final String notes;

  SyllabusTopic({
    required this.id,
    String? syllabusItemId,
    String? classIdSection,
    required this.subject,
    int? chapterNumber,
    String? chapterTitle,
    String? chapter,
    String? topicTitle,
    String? title,
    this.completionStatus = false,
    this.completedAt,
    this.notes = '',
  })  : syllabusItemId = syllabusItemId ?? 'SYL-10A-${DateTime.now().millisecondsSinceEpoch % 1000}',
        classIdSection = classIdSection ?? '10-A',
        chapterNumber = chapterNumber ?? 1,
        chapterTitle = chapterTitle ?? chapter ?? 'Chapter ${chapterNumber ?? 1}',
        topicTitle = topicTitle ?? title ?? 'General Topic';

  bool get isCompleted => completionStatus;
  String get className => classIdSection.startsWith('Class') ? classIdSection : 'Class $classIdSection';
  String get chapter => chapterTitle.isNotEmpty ? chapterTitle : 'Chapter $chapterNumber';
  String get title => topicTitle;
}
