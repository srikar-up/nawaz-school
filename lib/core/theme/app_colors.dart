import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Primary High-Contrast Purple (Hero Action Accent)
  static const Color primaryPurple = Color(0xFF5E43F3); // Vibrant Template Purple
  static const Color primaryPurpleLight = Color(0xFF7A62F9);
  static const Color primaryPurpleDark = Color(0xFF452AC7);
  static const Color purpleTint = Color(0xFFF0EDFF);

  // Aliases for general primary color references
  static const Color primary = Color(0xFF5E43F3);
  static const Color primaryLight = Color(0xFF7A62F9);
  static const Color primaryDark = Color(0xFF452AC7);
  static const Color primaryMint = Color(0xFFF0EDFF);

  // Soft Aurora Pastel Blobs for Background
  static const Color background = Color(0xFFF8F9FE);
  static const Color auroraMint = Color(0xFFE4F8EC);
  static const Color auroraPink = Color(0xFFFCEBF2);
  static const Color auroraLavender = Color(0xFFEFEAFF);
  static const Color auroraPeach = Color(0xFFFFF0E6);

  // Surface & Floating Cards
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceSubtle = Color(0xFFF6F7FC);

  // Borders & Dividers
  static const Color border = Color(0xFFE8ECEF);
  static const Color borderSubtle = Color(0xFFF0F3F6);

  // Pastel Category Icon Badges (as in template)
  static const Color pastelPink = Color(0xFFFF6B8B);
  static const Color pastelPinkBg = Color(0xFFFEECEC);

  static const Color pastelOrange = Color(0xFFFF9A3E);
  static const Color pastelOrangeBg = Color(0xFFFEF6E9);

  static const Color pastelBlue = Color(0xFF4D96FF);
  static const Color pastelBlueBg = Color(0xFFEBF3FE);

  static const Color pastelGreen = Color(0xFF38B000);
  static const Color pastelGreenBg = Color(0xFFEDF9F1);
  static const Color brandLime = Color(0xFFB0CC5D);

  static const Color pastelPurple = Color(0xFF845EC2);
  static const Color pastelPurpleBg = Color(0xFFF3EDFF);

  static const Color secondaryTeal = Color(0xFF2E8B83);
  static const Color accentAmber = Color(0xFFF59E0B);

  // Typography & Labels
  static const Color textPrimary = Color(0xFF1E202B);
  static const Color textSecondary = Color(0xFF767A8C);
  static const Color textTertiary = Color(0xFFA0A4B8);

  // Status & Risk Alerts
  static const Color riskRed = Color(0xFFFF4757);
  static const Color riskRedBg = Color(0xFFFFECEE);
  static const Color riskHigh = Color(0xFFFF4757);
  static const Color riskHighBg = Color(0xFFFFECEE);

  static const Color success = Color(0xFF2ED573);
  static const Color successBg = Color(0xFFEAFBF1);

  // Soft Floating Drop Shadow
  static List<BoxShadow> get softCardShadow => [
        BoxShadow(
          color: const Color(0xFF5E43F3).withOpacity(0.05),
          blurRadius: 24,
          spreadRadius: 0,
          offset: const Offset(0, 8),
        ),
        BoxShadow(
          color: Colors.black.withOpacity(0.02),
          blurRadius: 10,
          spreadRadius: 0,
          offset: const Offset(0, 2),
        ),
      ];

  static List<BoxShadow> get purpleGlowShadow => [
        BoxShadow(
          color: const Color(0xFF5E43F3).withOpacity(0.35),
          blurRadius: 18,
          spreadRadius: 0,
          offset: const Offset(0, 8),
        ),
      ];
}
