import 'file_importer_stub.dart'
    if (dart.library.html) 'file_importer_web.dart'
    if (dart.library.io) 'file_importer_io.dart';

export 'file_importer_stub.dart'
    if (dart.library.html) 'file_importer_web.dart'
    if (dart.library.io) 'file_importer_io.dart';

class FileImporter {
  static Future<PickedSpreadsheet?> pickAndReadFile() => pickSpreadsheetFile();
}
