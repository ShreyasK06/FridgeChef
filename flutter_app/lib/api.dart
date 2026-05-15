// API client and data models for the FridgeChef backend.
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

/// Base URL of the FridgeChef backend.
///
/// Android emulator: `http://10.0.2.2:8000` (alias for host's localhost).
/// Physical device on same Wi-Fi: `http://<your-laptop-LAN-IP>:8000`.
const String kBaseUrl = String.fromEnvironment(
  'FRIDGECHEF_BASE_URL',
  defaultValue: 'http://10.0.2.2:8000',
);

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class RecipeIngredient {
  RecipeIngredient({required this.item, required this.quantity});

  factory RecipeIngredient.fromJson(Map<String, dynamic> json) =>
      RecipeIngredient(
        item: json['item'] as String,
        quantity: json['quantity'] as String,
      );

  final String item;
  final String quantity;
}

class Recipe {
  Recipe({
    required this.name,
    required this.description,
    required this.cookTimeMinutes,
    required this.difficulty,
    required this.ingredients,
    required this.steps,
  });

  factory Recipe.fromJson(Map<String, dynamic> json) => Recipe(
        name: json['name'] as String,
        description: json['description'] as String,
        cookTimeMinutes: json['cook_time_minutes'] as int,
        difficulty: json['difficulty'] as String,
        ingredients: (json['ingredients'] as List<dynamic>)
            .map((e) => RecipeIngredient.fromJson(e as Map<String, dynamic>))
            .toList(),
        steps: (json['steps'] as List<dynamic>).map((e) => e as String).toList(),
      );

  final String name;
  final String description;
  final int cookTimeMinutes;
  final String difficulty;
  final List<RecipeIngredient> ingredients;
  final List<String> steps;
}

class Api {
  Api({this.baseUrl = kBaseUrl});

  final String baseUrl;

  /// Upload an image and return the detected food ingredient list.
  Future<List<String>> detect(File image) async {
    final uri = Uri.parse('$baseUrl/api/detect');
    final request = http.MultipartRequest('POST', uri)
      ..files.add(await http.MultipartFile.fromPath('image', image.path));

    try {
      final streamed = await request.send().timeout(const Duration(seconds: 30));
      final response = await http.Response.fromStream(streamed);
      if (response.statusCode != 200) {
        throw ApiException(_extractDetail(response) ?? 'Could not analyze image.');
      }
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return (body['ingredients'] as List<dynamic>).cast<String>();
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('Network error: $e');
    }
  }

  /// Send an ingredient list and return three recipes.
  Future<List<Recipe>> recipes(List<String> ingredients) async {
    final uri = Uri.parse('$baseUrl/api/recipes');
    try {
      final response = await http
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'ingredients': ingredients}),
          )
          .timeout(const Duration(seconds: 60));
      if (response.statusCode != 200) {
        throw ApiException(_extractDetail(response) ?? 'Could not generate recipes.');
      }
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return (body['recipes'] as List<dynamic>)
          .map((e) => Recipe.fromJson(e as Map<String, dynamic>))
          .toList();
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('Network error: $e');
    }
  }

  String? _extractDetail(http.Response response) {
    try {
      final body = jsonDecode(response.body);
      if (body is Map && body['detail'] is String) {
        return body['detail'] as String;
      }
    } catch (_) {}
    return null;
  }
}
