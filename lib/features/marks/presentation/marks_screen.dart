import 'package:flutter/material.dart';
import '../../../core/data/mock_database.dart';
import '../../../core/models/student.dart';
import '../../../core/models/test_record.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/aurora_background.dart';
import '../../../shared/widgets/percent_ring.dart';

class MarksScreen extends StatefulWidget {
  final MockDatabase db;

  const MarksScreen({super.key, required this.db});

  @override
  State<MarksScreen> createState() => _MarksScreenState();
}

class _MarksScreenState extends State<MarksScreen> {
  int _selectedTestIndex = 0;
  // 0: All Assessments, 1: Class Tests & CAs (Teacher), 2: Formal Exams (Principal)
  int _filterCategoryIndex = 0;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.db,
      builder: (context, _) {
        final allTests = widget.db.testRecords;
        final filteredTests = _filterCategoryIndex == 1
            ? widget.db.classTestsAndCAs
            : _filterCategoryIndex == 2
                ? widget.db.principalMandatedExams
                : allTests;

        final currentTest = filteredTests.isNotEmpty
            ? filteredTests[_selectedTestIndex.clamp(0, filteredTests.length - 1)]
            : null;
        final students = widget.db.studentsInSelectedClass;
        final atRiskStudents = widget.db.getAtRiskStudents(widget.db.selectedClass);

        return AuroraBackground(
          child: Scaffold(
            backgroundColor: Colors.transparent,
            body: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 90),
              children: [
                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Assessments & Exams',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.4,
                          ),
                        ),
                        Text(
                          'Teacher CAs & Principal Institutional Exams',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    // Teacher "Set Class Test" Button
                    GestureDetector(
                      onTap: () => _showTeacherCreateTestDialog(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.primaryPurple,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: AppColors.purpleGlowShadow,
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.add_rounded, size: 16, color: Colors.white),
                            SizedBox(width: 4),
                            Text(
                              '+ Set Class Test',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Category Filter Segmented Pill
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: AppColors.softCardShadow,
                  ),
                  child: Row(
                    children: [
                      _buildFilterPill(0, 'All (${allTests.length})'),
                      _buildFilterPill(1, 'Teacher CAs (${widget.db.classTestsAndCAs.length})'),
                      _buildFilterPill(2, 'Principal Exams (${widget.db.principalMandatedExams.length})'),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Automated Risk Warning Card (If any student <35%)
                if (atRiskStudents.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.riskRedBg,
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: AppColors.softCardShadow,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.warning_amber_rounded,
                                color: AppColors.riskRed,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Critical Alert: ${atRiskStudents.length} Students Below 35% Threshold',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.riskRed,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: atRiskStudents.map((s) {
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${s.name} (${s.averageScore.toStringAsFixed(0)}%)',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.riskRed,
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                // Assessment Selector Horizontal Strip
                if (filteredTests.isNotEmpty) ...[
                  SizedBox(
                    height: 44,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: filteredTests.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (context, idx) {
                        final t = filteredTests[idx];
                        final isSelected = _selectedTestIndex == idx;
                        final isPrincipal = t.isPrincipalMandated;

                        return GestureDetector(
                          onTap: () => setState(() => _selectedTestIndex = idx),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? (isPrincipal ? const Color(0xFF0F3A24) : AppColors.primaryPurple)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: isSelected ? AppColors.purpleGlowShadow : AppColors.softCardShadow,
                              border: isPrincipal
                                  ? Border.all(color: const Color(0xFF34D399), width: 1)
                                  : null,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (isPrincipal) ...[
                                  const Icon(Icons.verified_rounded, size: 14, color: Color(0xFF34D399)),
                                  const SizedBox(width: 4),
                                ],
                                Text(
                                  t.title,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: isSelected ? Colors.white : AppColors.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                // Active Test / Exam Header Card
                if (currentTest != null) ...[
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: AppColors.softCardShadow,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Exam Authority Tag
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: currentTest.isPrincipalMandated
                                    ? const Color(0xFFE6F4EA)
                                    : AppColors.purpleTint,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    currentTest.isPrincipalMandated
                                        ? Icons.account_balance_rounded
                                        : Icons.school_rounded,
                                    size: 13,
                                    color: currentTest.isPrincipalMandated
                                        ? const Color(0xFF137333)
                                        : AppColors.primaryPurple,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    currentTest.isPrincipalMandated
                                        ? '👑 PRINCIPAL MANDATED EXAM'
                                        : 'TEACHER CONTINUOUS ASSESSMENT',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w900,
                                      color: currentTest.isPrincipalMandated
                                        ? const Color(0xFF137333)
                                        : AppColors.primaryPurple,
                                      letterSpacing: 0.4,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              'Weightage: ${currentTest.weightagePercent.toInt()}%',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    currentTest.title,
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w900,
                                      color: AppColors.textPrimary,
                                      letterSpacing: -0.3,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${currentTest.subject} • ${currentTest.className} • Created by ${currentTest.createdBy}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    '${currentTest.passCount} Passed • ${currentTest.failCount} Failing (<40%)',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            PercentRing(
                              percent: currentTest.classAveragePercentage,
                              size: 64,
                              strokeWidth: 6,
                              progressColor: currentTest.isClassAtRisk ? AppColors.riskRed : AppColors.primaryPurple,
                              backgroundColor: currentTest.isClassAtRisk ? AppColors.riskRedBg : AppColors.purpleTint,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),

                  // Student Marks Scoring Ledger
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Student Mark Entry Sheet',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                      Text(
                        'Tap score pill to edit',
                        style: TextStyle(fontSize: 10, color: AppColors.textSecondary.withOpacity(0.8), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  ...students.map((student) {
                    final score = currentTest.studentScores[student.id] ?? 0.0;
                    final percentage = (score / currentTest.maxMarks) * 100.0;
                    final isBelow35 = percentage < 35.0;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: AppColors.softCardShadow,
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: isBelow35 ? AppColors.riskRedBg : AppColors.purpleTint,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Center(
                              child: Text(
                                student.rollNumber.split('-').last,
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 12,
                                  color: isBelow35 ? AppColors.riskRed : AppColors.primaryPurple,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),

                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        student.name,
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 13,
                                          color: isBelow35 ? AppColors.riskRed : AppColors.textPrimary,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    if (isBelow35) ...[
                                      const SizedBox(width: 4),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: AppColors.riskRed,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: const Text(
                                          '<35% RISK',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 7,
                                            fontWeight: FontWeight.w900,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 1),
                                Text(
                                  'Roll: ${student.rollNumber} • Rate: ${(student.attendanceRate * 100).toInt()}%',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          GestureDetector(
                            onTap: () => _showEditScoreDialog(context, currentTest, student, score),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: isBelow35 ? AppColors.riskRedBg : AppColors.purpleTint,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${score.toStringAsFixed(0)} / ${currentTest.maxMarks.toInt()}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 12,
                                  color: isBelow35 ? AppColors.riskRed : AppColors.primaryPurple,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFilterPill(int index, String label) {
    final isSelected = _filterCategoryIndex == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          _filterCategoryIndex = index;
          _selectedTestIndex = 0;
        }),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primaryPurple : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? Colors.white : AppColors.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showEditScoreDialog(
    BuildContext context,
    TestRecord test,
    Student student,
    double currentScore,
  ) {
    final controller = TextEditingController(text: currentScore.toStringAsFixed(0));
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Text(
            'Score for ${student.name}',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${test.title} (Max Marks: ${test.maxMarks.toInt()})',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                autofocus: true,
                decoration: InputDecoration(
                  labelText: 'Marks Scored',
                  suffixText: '/ ${test.maxMarks.toInt()}',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                final val = double.tryParse(controller.text);
                if (val != null && val >= 0 && val <= test.maxMarks) {
                  widget.db.updateTestStudentScore(test.id, student.id, val);
                  Navigator.pop(ctx);
                }
              },
              child: const Text('Save Score'),
            ),
          ],
        );
      },
    );
  }

  // Teacher-Scoped Class Test / CA Creation Dialog
  void _showTeacherCreateTestDialog(BuildContext context) {
    final titleCtrl = TextEditingController();
    final marksCtrl = TextEditingController(text: '50');
    ExamCategory selectedCategory = ExamCategory.ca1;
    String selectedClass = widget.db.classes.first;
    String selectedSubject = 'Mathematics';

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Row(
                children: [
                  Icon(Icons.assignment_add, color: AppColors.primaryPurple, size: 20),
                  SizedBox(width: 8),
                  Text('Set Class Test / CA', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                ],
              ),
              content: SizedBox(
                width: 380,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Scoped to your assigned classes & subject roadmap.',
                      style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 14),

                    // Test Type
                    DropdownButtonFormField<ExamCategory>(
                      value: selectedCategory,
                      decoration: const InputDecoration(labelText: 'Assessment Category'),
                      items: const [
                        DropdownMenuItem(value: ExamCategory.ca1, child: Text('CA-1 (Continuous Assessment 1)')),
                        DropdownMenuItem(value: ExamCategory.ca2, child: Text('CA-2 (Continuous Assessment 2)')),
                        DropdownMenuItem(value: ExamCategory.classTest, child: Text('Weekly Class Test / Quiz')),
                      ],
                      onChanged: (val) {
                        if (val != null) setDialogState(() => selectedCategory = val);
                      },
                    ),
                    const SizedBox(height: 10),

                    // Target Class (Scope-locked to teacher's classes)
                    DropdownButtonFormField<String>(
                      value: selectedClass,
                      decoration: const InputDecoration(labelText: 'Assigned Class'),
                      items: widget.db.classes.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                      onChanged: (val) {
                        if (val != null) setDialogState(() => selectedClass = val);
                      },
                    ),
                    const SizedBox(height: 10),

                    // Test Title
                    TextField(
                      controller: titleCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Assessment Title',
                        hintText: 'e.g. CA-1: Chapter 2 Quadratics',
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Max Marks
                    TextField(
                      controller: marksCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Total / Max Marks',
                        hintText: '25, 50, or 100',
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: () {
                    if (titleCtrl.text.isNotEmpty) {
                      final max = double.tryParse(marksCtrl.text) ?? 50.0;
                      widget.db.createTeacherAssessment(
                        title: titleCtrl.text,
                        className: selectedClass,
                        subject: selectedSubject,
                        maxMarks: max,
                        examCategory: selectedCategory,
                        date: DateTime.now(),
                      );
                      Navigator.pop(ctx);
                      setState(() {
                        _filterCategoryIndex = 1;
                        _selectedTestIndex = 0;
                      });
                    }
                  },
                  child: const Text('Publish Test'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
