import 'dart:io';

void downloadFile(String filename, String content) {
  try {
    final dir = Directory('C:\\SchoolManagement\\Exports\\Spreadsheets');
    if (!dir.existsSync()) {
      dir.createSync(recursive: true);
    }
    final file = File('${dir.path}\\$filename');
    file.writeAsStringSync(content);
  } catch (e) {
    // Graceful fallback
  }
}
