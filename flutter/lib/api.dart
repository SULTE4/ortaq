import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiError implements Exception {
  final int status;
  final String message;
  ApiError(this.status, this.message);
  @override
  String toString() => message;
}

class Api {
  final String Function(String) message;
  Api(this.message);
  String token = '';
  final String base = '${Uri.base.origin}/api';
  String media(String path) => '$base$path';

  Future<dynamic> _send(http.BaseRequest request) async {
    if (token.isNotEmpty) request.headers['Authorization'] = 'Bearer $token';
    try {
      final response = await http.Response.fromStream(await request.send())
          .timeout(const Duration(seconds: 30));
      final value = jsonDecode(response.body);
      if (response.statusCode >= 400)
        throw ApiError(
            response.statusCode, value['error'] ?? message('requestFailed'));
      return value;
    } on FormatException {
      throw Exception(message('serviceUnavailable'));
    } on http.ClientException {
      throw Exception(message('serviceUnavailable'));
    } on TimeoutException {
      throw Exception(message('requestTimeout'));
    }
  }

  Future<dynamic> request(String path, {String method = 'GET', dynamic body}) {
    final request = http.Request(method, Uri.parse('$base$path'));
    request.headers['Content-Type'] = 'application/json';
    if (body != null) request.body = jsonEncode(body);
    return _send(request);
  }

  Future<String> upload(List<int> bytes, String filename) async {
    final request = http.MultipartRequest('POST', Uri.parse('$base/uploads'));
    request.files
        .add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    final value = await _send(request);
    return value['url'];
  }

  Future<int> importBalances(List<int> bytes, String filename) async {
    final request =
        http.MultipartRequest('POST', Uri.parse('$base/balances/import'));
    request.files
        .add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    final value = await _send(request);
    return value['imported'];
  }
}
