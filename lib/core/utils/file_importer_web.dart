// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:async';

class PickedSpreadsheet {
  final String fileName;
  final String content;

  PickedSpreadsheet({required this.fileName, required this.content});
}

Future<PickedSpreadsheet?> pickSpreadsheetFile() async {
  final completer = Completer<PickedSpreadsheet?>();
  final uploadInput = html.FileUploadInputElement()
    ..accept = '.csv,.txt,.xlsx'
    ..style.display = 'none';

  html.document.body?.children.add(uploadInput);

  uploadInput.onChange.listen((e) {
    final files = uploadInput.files;
    if (files != null && files.isNotEmpty) {
      final file = files[0];
      final reader = html.FileReader();
      reader.onLoadEnd.listen((e) {
        final content = reader.result as String? ?? '';
        completer.complete(PickedSpreadsheet(fileName: file.name, content: content));
        uploadInput.remove();
      });
      reader.readAsText(file);
    } else {
      completer.complete(null);
      uploadInput.remove();
    }
  });

  uploadInput.click();
  return completer.future;
}
