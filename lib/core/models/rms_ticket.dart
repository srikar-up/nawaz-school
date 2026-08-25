enum RmsCategory {
  staffLeave,
  maintenance,
  confidential,
  generalOperational,
  operationalPriority,
  facilityGearMalfunction,
  leaveRequest,
  studentDisciplinary,
  academicResource,
}

enum RmsStatus {
  pending,
  underReview,
  approved,
  rejected,
  resolved,
}

class RmsTicket {
  final String id;
  final String noteId; // Column A: note_id (e.g. "RMS-2026-001")
  final DateTime timestamp; // Column B: timestamp
  final String teacherId;
  final String teacherName; // Column C: teacher_name
  final String teacherEmail;
  final RmsCategory category; // Column D: classification_tag
  final String subject;
  final String messageBody; // Column E: message_body
  final String? roomNumber; // Extracted e.g. "Room 301"
  final bool isConfidential;
  RmsStatus adminResolutionStatus; // Column F: admin_resolution_status
  String? principalNote;

  RmsTicket({
    required this.id,
    String? noteId,
    DateTime? timestamp,
    DateTime? createdAt,
    String? teacherId,
    String? teacherName,
    String? teacherEmail,
    required this.category,
    required this.subject,
    String? messageBody,
    String? description,
    this.roomNumber,
    this.isConfidential = false,
    RmsStatus? adminResolutionStatus,
    RmsStatus? status,
    this.principalNote,
  })  : noteId = noteId ?? 'RMS-2026-${DateTime.now().millisecondsSinceEpoch % 1000}',
        timestamp = timestamp ?? createdAt ?? DateTime.now(),
        teacherId = teacherId ?? 'tch_sarah_01',
        teacherName = teacherName ?? 'Prof. Sarah Nawaz',
        teacherEmail = teacherEmail ?? 's.nawaz@school.edu',
        messageBody = messageBody ?? description ?? '',
        adminResolutionStatus = adminResolutionStatus ?? status ?? RmsStatus.pending;

  String get classificationTag {
    switch (category) {
      case RmsCategory.staffLeave:
      case RmsCategory.leaveRequest:
        return 'STAFF LEAVE REQUEST';
      case RmsCategory.maintenance:
      case RmsCategory.facilityGearMalfunction:
        return 'FACILITY MAINTENANCE';
      case RmsCategory.confidential:
        return 'CONFIDENTIAL CHANNEL';
      case RmsCategory.generalOperational:
      case RmsCategory.operationalPriority:
      case RmsCategory.studentDisciplinary:
      case RmsCategory.academicResource:
        return 'OPERATIONAL NOTE';
    }
  }

  String get categoryLabel => classificationTag;
  String get description => messageBody;
  RmsStatus get status => adminResolutionStatus;
  DateTime get createdAt => timestamp;

  // Automated Keyword Classifier Engine
  static RmsCategory classifyText(String text, {bool userToggledPrivate = false}) {
    final lower = text.toLowerCase();

    // 1. Confidential check
    if (userToggledPrivate ||
        lower.contains('confidential') ||
        lower.contains('private') ||
        lower.contains('personal') ||
        lower.contains('harassment') ||
        lower.contains('complaint')) {
      return RmsCategory.confidential;
    }

    // 2. Staff Leave Requests
    if (lower.contains('leave') ||
        lower.contains('sick') ||
        lower.contains('absent') ||
        lower.contains('casual leave') ||
        lower.contains('medical') ||
        lower.contains('emergency')) {
      return RmsCategory.staffLeave;
    }

    // 3. Maintenance Operations & Repairs
    if (lower.contains('broken') ||
        lower.contains('projector') ||
        lower.contains('repair') ||
        lower.contains('ac') ||
        lower.contains('fan') ||
        lower.contains('light') ||
        lower.contains('bench') ||
        lower.contains('wi-fi') ||
        lower.contains('wifi') ||
        lower.contains('bulb') ||
        lower.contains('desk')) {
      return RmsCategory.maintenance;
    }

    return RmsCategory.generalOperational;
  }
}
