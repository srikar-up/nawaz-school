import 'package:flutter/material.dart';
import '../../core/data/mock_database.dart';
import '../../core/theme/app_colors.dart';

class TeacherAppHeader extends StatelessWidget {
  final MockDatabase db;

  const TeacherAppHeader({super.key, required this.db});

  @override
  Widget build(BuildContext context) {
    final isAdmin = db.isAdmin;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      decoration: const BoxDecoration(
        color: Colors.transparent,
      ),
      child: Row(
        children: [
          // Teacher / Admin Avatar & Greeting
          Expanded(
            child: GestureDetector(
              onTap: () => _showProfileRoleSheet(context),
              behavior: HitTestBehavior.opaque,
              child: Row(
                children: [
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: isAdmin
                                ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
                                : [const Color(0xFF4EE2B0), const Color(0xFF38B000)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: (isAdmin ? const Color(0xFF0F172A) : const Color(0xFF38B000)).withOpacity(0.25),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: 38,
                        height: 38,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                        ),
                        child: Center(
                          child: Text(
                            isAdmin ? 'AD' : 'SN',
                            style: TextStyle(
                              color: isAdmin ? const Color(0xFF0F172A) : AppColors.primaryPurple,
                              fontWeight: FontWeight.w900,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: [
                            Text(
                              isAdmin ? 'Admin Console' : 'Hello!',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(
                                color: isAdmin ? const Color(0xFF0F172A) : AppColors.purpleTint,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                isAdmin ? 'PRINCIPAL' : 'TEACHER',
                                style: TextStyle(
                                  fontSize: 8,
                                  fontWeight: FontWeight.w900,
                                  color: isAdmin ? AppColors.brandLime : AppColors.primaryPurple,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 1),
                        Text(
                          isAdmin ? db.adminName : db.teacherName,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.3,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(width: 6),

          // Role Switcher / Class Selector Pill
          if (!isAdmin)
            GestureDetector(
              onTap: () => _showClassSelector(context),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: AppColors.softCardShadow,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: AppColors.brandLime,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      db.selectedClass,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(width: 2),
                    const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 14,
                      color: AppColors.textSecondary,
                    ),
                  ],
                ),
              ),
            )
          else
            GestureDetector(
              onTap: () => db.setRole(UserRole.teacher),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primaryPurple,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: AppColors.purpleGlowShadow,
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.swap_horiz_rounded, color: Colors.white, size: 14),
                    SizedBox(width: 4),
                    Text(
                      'Teacher Mode',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          const SizedBox(width: 6),

          // Quick Role Toggle / Profile Icon
          GestureDetector(
            onTap: () => _showProfileRoleSheet(context),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: AppColors.softCardShadow,
              ),
              child: Icon(
                isAdmin ? Icons.admin_panel_settings_rounded : Icons.person_outline_rounded,
                size: 18,
                color: isAdmin ? const Color(0xFF0F172A) : AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showProfileRoleSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Switch Workspace Role',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Test both mobile teacher workspace and Windows desktop admin console in one unified app.',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 18),

                // Option 1: Teacher Workspace
                Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: !db.isAdmin ? AppColors.purpleTint : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: !db.isAdmin ? AppColors.primaryPurple : AppColors.surfaceSubtle,
                      width: 1.5,
                    ),
                  ),
                  child: ListTile(
                    onTap: () {
                      db.setRole(UserRole.teacher);
                      Navigator.pop(ctx);
                    },
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: !db.isAdmin ? AppColors.primaryPurple : AppColors.surfaceSubtle,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(Icons.school_rounded, color: !db.isAdmin ? Colors.white : AppColors.textSecondary, size: 20),
                    ),
                    title: const Text('Teacher Workspace', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    subtitle: const Text('Prof. Sarah Nawaz (Classroom Roll Call, Marks, Timetable, Syllabus)', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                    trailing: !db.isAdmin ? const Icon(Icons.check_circle_rounded, color: AppColors.primaryPurple) : null,
                  ),
                ),

                // Option 2: Admin Panel (Principal Controls)
                Container(
                  decoration: BoxDecoration(
                    color: db.isAdmin ? const Color(0xFF0F172A).withOpacity(0.06) : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: db.isAdmin ? const Color(0xFF0F172A) : AppColors.surfaceSubtle,
                      width: 1.5,
                    ),
                  ),
                  child: ListTile(
                    onTap: () {
                      db.setRole(UserRole.admin);
                      Navigator.pop(ctx);
                    },
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: db.isAdmin ? const Color(0xFF0F172A) : AppColors.surfaceSubtle,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(Icons.admin_panel_settings_rounded, color: db.isAdmin ? AppColors.brandLime : AppColors.textSecondary, size: 20),
                    ),
                    title: const Text('Admin Panel (Principal Console)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    subtitle: const Text('Dr. Tariq Nawaz (Excel Ingestion, Faculty Provisioning, Macro KPIs, RMS Inbox)', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                    trailing: db.isAdmin ? const Icon(Icons.check_circle_rounded, color: Color(0xFF0F172A)) : null,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showClassSelector(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Switch Active Classroom',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Select target class for attendance, marks, and syllabus sync.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 16),
                ...db.classes.map((cls) {
                  final isSelected = cls == db.selectedClass;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.purpleTint : Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: isSelected ? null : AppColors.softCardShadow,
                      border: Border.all(
                        color: isSelected ? AppColors.primaryPurple : Colors.transparent,
                        width: 1.5,
                      ),
                    ),
                    child: ListTile(
                      onTap: () {
                        db.setSelectedClass(cls);
                        Navigator.pop(ctx);
                      },
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.primaryPurple : AppColors.surfaceSubtle,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          Icons.groups_rounded,
                          color: isSelected ? Colors.white : AppColors.textSecondary,
                          size: 20,
                        ),
                      ),
                      title: Text(
                        cls,
                        style: TextStyle(
                          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                          color: isSelected ? AppColors.primaryPurpleDark : AppColors.textPrimary,
                        ),
                      ),
                      trailing: isSelected
                          ? const Icon(Icons.check_circle_rounded, color: AppColors.primaryPurple)
                          : null,
                    ),
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }
}
