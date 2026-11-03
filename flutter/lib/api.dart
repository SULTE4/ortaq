import 'dart:convert';
import 'package:http/http.dart' as http;
class Api {
 Future<String> upload(List<int> bytes,String filename)async { final req=http.MultipartRequest('POST',Uri.parse('$base/uploads'));req.headers['Authorization']='Bearer $token';req.files.add(http.MultipartFile.fromBytes('file',bytes,filename:filename));final res=await http.Response.fromStream(await req.send());final data=jsonDecode(res.body);if(res.statusCode>=400)throw Exception(data['error']);return data['url']; }
 Future<int> importBalances(List<int> bytes,String filename)async{final req=http.MultipartRequest('POST',Uri.parse('$base/balances/import'));req.headers['Authorization']='Bearer $token';req.files.add(http.MultipartFile.fromBytes('file',bytes,filename:filename));final res=await http.Response.fromStream(await req.send());final v=jsonDecode(res.body);if(res.statusCode>=400)throw Exception(v['error']);return v['imported'];}
 String media(String path)=>'$base$path';
 String token = '';
 final String base = '${Uri.base.origin}/api';
 Future<dynamic> request(String path, {String method='GET', dynamic body}) async {
  final req = http.Request(method, Uri.parse('$base$path'));
  req.headers.addAll({'Content-Type':'application/json', if(token.isNotEmpty) 'Authorization':'Bearer $token'});
  if(body!=null) req.body=jsonEncode(body);
  final res=await http.Response.fromStream(await req.send());
  dynamic value; try { value=jsonDecode(res.body); } catch (_) { throw Exception('The service is unavailable. Please try again.'); }
  if(res.statusCode>=400) throw Exception(value['error']??'Request failed');
  return value;
 }
}
