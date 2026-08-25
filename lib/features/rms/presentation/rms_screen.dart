import 'package:flutter/material.dart';
import '../../../core/data/mock_database.dart';
import '../../../core/models/rms_ticket.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/aurora_background.dart';

class RmsScreen extends StatefulWidget {
  final MockDatabase db;

  const RmsScreen({super.key, required this.db});

  @override
  State<RmsScreen> createState() => _RmsScreenState();
}

class _RmsScreenState extends State<RmsScreen> {
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.db,
      builder: (context, _) {
        final tickets = widget.db.rmsTickets;

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
                          'RMS Private Channel',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.4,
                          ),
                        ),
                        Text(
                          'Direct encrypted link to Principal console',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    GestureDetector(
                      onTap: () => _showNewTicketDialog(context),
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
                              'New Ticket',
                              style: TextStyle(
                                fontSize: 12,
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
                const SizedBox(height: 18),

                // Info Banner
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: AppColors.softCardShadow,
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.shield_outlined, color: AppColors.primaryPurple, size: 22),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Direct encrypted sink into Principal desk. Automated keyword classification parses leave, gear repairs, and confidential notes.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                const Text(
                  'Your Dispatched Notes & Status',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 12),

                if (tickets.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 40),
                      child: Column(
                        children: [
                          Icon(Icons.inbox_outlined, size: 48, color: AppColors.textTertiary),
                          const SizedBox(height: 8),
                          const Text('No tickets dispatched yet', style: TextStyle(color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                  )
                else
                  ...tickets.map((ticket) => _buildTicketCard(ticket)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTicketCard(RmsTicket ticket) {
    Color badgeBg;
    Color badgeText;
    String statusLabel;

    switch (ticket.adminResolutionStatus) {
      case RmsStatus.pending:
        badgeBg = AppColors.pastelOrangeBg;
        badgeText = AppColors.pastelOrange;
        statusLabel = 'Pending Review';
        break;
      case RmsStatus.underReview:
        badgeBg = AppColors.purpleTint;
        badgeText = AppColors.primaryPurple;
        statusLabel = 'Under Review / Assigned';
        break;
      case RmsStatus.approved:
        badgeBg = AppColors.successBg;
        badgeText = AppColors.success;
        statusLabel = 'Approved by Principal';
        break;
      case RmsStatus.rejected:
        badgeBg = AppColors.riskRedBg;
        badgeText = AppColors.riskRed;
        statusLabel = 'Declined';
        break;
      case RmsStatus.resolved:
        badgeBg = AppColors.successBg;
        badgeText = AppColors.success;
        statusLabel = 'Resolved';
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: AppColors.softCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.purpleTint,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  ticket.classificationTag,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primaryPurple,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: badgeText,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          Text(
            ticket.subject,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),

          Text(
            ticket.messageBody,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 12),

          if (ticket.principalNote != null && ticket.principalNote!.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(10),
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: AppColors.surfaceSubtle,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.reply_rounded, size: 14, color: AppColors.primaryPurple),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Principal Note: ${ticket.principalNote}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            ),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ID: ${ticket.noteId} • ${_formatTimeAgo(ticket.timestamp)}',
                style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
              ),
              if (ticket.roomNumber != null)
                Text(
                  'Auto-bound: ${ticket.roomNumber}',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.pastelOrange),
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatTimeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  void _showNewTicketDialog(BuildContext context) {
    final subjectCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    bool isPrivate = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 24,
                right: 24,
                top: 24,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
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
                  const SizedBox(height: 18),
                  const Text(
                    'Dispatch Priority Message to Principal',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Keywords automatically route to Leave Desk, Maintenance, or Secure Vault.',
                    style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 16),

                  TextField(
                    controller: subjectCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Subject / Title',
                      hintText: 'e.g. Projector broken in Room 204 or Sick Leave',
                    ),
                  ),
                  const SizedBox(height: 12),

                  TextField(
                    controller: descCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Message Body',
                      hintText: 'Explain issue, gear needed, or leave dates...',
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Confidential Toggle
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Confidential / Private Mode', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    subtitle: const Text('Bypasses shared boards and routes to Principal Secure Vault', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                    value: isPrivate,
                    activeColor: AppColors.primaryPurple,
                    onChanged: (val) {
                      setModalState(() => isPrivate = val);
                    },
                  ),
                  const SizedBox(height: 14),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        if (subjectCtrl.text.isNotEmpty && descCtrl.text.isNotEmpty) {
                          widget.db.submitRmsTicket(
                            subject: subjectCtrl.text,
                            messageBody: descCtrl.text,
                            isPrivate: isPrivate,
                          );
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              backgroundColor: AppColors.primaryPurpleDark,
                              behavior: SnackBarBehavior.floating,
                              content: Text('Priority ticket dispatched to Principal Console!'),
                            ),
                          );
                        }
                      },
                      icon: const Icon(Icons.send_rounded, size: 18),
                      label: const Text('Dispatch Ticket (Automated Routing)'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
