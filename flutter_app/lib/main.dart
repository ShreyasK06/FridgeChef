// FridgeChef — Android app entry and three screens.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'api.dart';

void main() => runApp(const FridgeChefApp());

const _accent = Color(0xFF2F7D5B);

class FridgeChefApp extends StatelessWidget {
  const FridgeChefApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FridgeChef',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: _accent),
        scaffoldBackgroundColor: const Color(0xFFFAFAF7),
      ),
      home: const UploadScreen(),
    );
  }
}

// -------------------- State 1: Upload --------------------

class UploadScreen extends StatefulWidget {
  const UploadScreen({super.key});

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  final _picker = ImagePicker();
  final _api = Api();
  File? _image;
  bool _loading = false;
  String? _error;

  Future<void> _pick(ImageSource source) async {
    setState(() => _error = null);
    final picked = await _picker.pickImage(source: source, imageQuality: 85);
    if (picked == null) return;
    setState(() => _image = File(picked.path));
  }

  Future<void> _analyze() async {
    if (_image == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final ingredients = await _api.detect(_image!);
      if (!mounted) return;
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => IngredientsScreen(
          previewImage: _image!,
          initial: ingredients,
        ),
      ));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('FridgeChef'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null) _ErrorBar(message: _error!),
              const SizedBox(height: 8),
              if (_image == null)
                Expanded(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.kitchen, size: 96, color: _accent),
                        const SizedBox(height: 16),
                        const Text(
                          'Snap your fridge,\ncook something great.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 18),
                        ),
                        const SizedBox(height: 24),
                        FilledButton.icon(
                          onPressed: () => _pick(ImageSource.camera),
                          icon: const Icon(Icons.photo_camera),
                          label: const Text('Take photo'),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: () => _pick(ImageSource.gallery),
                          icon: const Icon(Icons.photo_library),
                          label: const Text('Pick from gallery'),
                        ),
                      ],
                    ),
                  ),
                )
              else
                Expanded(
                  child: Column(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.file(_image!, fit: BoxFit.contain),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _loading
                                  ? null
                                  : () => setState(() => _image = null),
                              child: const Text('Choose different photo'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: FilledButton(
                              onPressed: _loading ? null : _analyze,
                              child: _loading
                                  ? const SizedBox(
                                      height: 18,
                                      width: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text('Analyze'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// -------------------- State 2: Ingredients --------------------

class IngredientsScreen extends StatefulWidget {
  const IngredientsScreen({
    super.key,
    required this.previewImage,
    required this.initial,
  });

  final File previewImage;
  final List<String> initial;

  @override
  State<IngredientsScreen> createState() => _IngredientsScreenState();
}

class _IngredientsScreenState extends State<IngredientsScreen> {
  late final List<String> _ingredients = [...widget.initial];
  final _api = Api();
  final _addCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _addCtrl.dispose();
    super.dispose();
  }

  void _addIngredient() {
    final v = _addCtrl.text.trim().toLowerCase();
    if (v.isEmpty || _ingredients.contains(v)) {
      _addCtrl.clear();
      return;
    }
    setState(() {
      _ingredients.add(v);
      _addCtrl.clear();
    });
  }

  Future<void> _generate() async {
    if (_ingredients.isEmpty) {
      setState(() => _error = 'Add at least one ingredient.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final recipes = await _api.recipes(_ingredients);
      if (!mounted) return;
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => RecipesScreen(
          ingredients: _ingredients,
          initialRecipes: recipes,
        ),
      ));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("What's in your fridge?")),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null) _ErrorBar(message: _error!),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(
                  widget.previewImage,
                  height: 160,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Remove anything wrong. Add anything missing.',
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: SingleChildScrollView(
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (var i = 0; i < _ingredients.length; i++)
                        InputChip(
                          label: Text(_ingredients[i]),
                          deleteIcon: const Icon(Icons.close, size: 18),
                          onDeleted: () => setState(() => _ingredients.removeAt(i)),
                        ),
                    ],
                  ),
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _addCtrl,
                      maxLength: 50,
                      onSubmitted: (_) => _addIngredient(),
                      decoration: const InputDecoration(
                        hintText: 'Add an ingredient…',
                        border: OutlineInputBorder(),
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: _addIngredient,
                    child: const Text('Add'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _loading
                          ? null
                          : () => Navigator.of(context).popUntil((r) => r.isFirst),
                      child: const Text('Start over'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton(
                      onPressed: _loading ? null : _generate,
                      child: _loading
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Generate Recipes'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// -------------------- State 3: Recipes --------------------

class RecipesScreen extends StatefulWidget {
  const RecipesScreen({
    super.key,
    required this.ingredients,
    required this.initialRecipes,
  });

  final List<String> ingredients;
  final List<Recipe> initialRecipes;

  @override
  State<RecipesScreen> createState() => _RecipesScreenState();
}

class _RecipesScreenState extends State<RecipesScreen> {
  final _api = Api();
  late List<Recipe> _recipes = widget.initialRecipes;
  bool _loading = false;
  String? _error;

  Future<void> _regenerate() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final fresh = await _api.recipes(widget.ingredients);
      setState(() => _recipes = fresh);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Three ideas for you'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Edit'),
          ),
        ],
      ),
      body: SafeArea(
        child: Stack(
          children: [
            ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null) _ErrorBar(message: _error!),
                for (final r in _recipes) ...[
                  _RecipeCard(recipe: r),
                  const SizedBox(height: 12),
                ],
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: _loading ? null : _regenerate,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Generate again'),
                ),
              ],
            ),
            if (_loading)
              Container(
                color: Colors.white.withValues(alpha: 0.6),
                alignment: Alignment.center,
                child: const CircularProgressIndicator(),
              ),
          ],
        ),
      ),
    );
  }
}

class _RecipeCard extends StatelessWidget {
  const _RecipeCard({required this.recipe});
  final Recipe recipe;

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE5E5E0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              recipe.name,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Text(recipe.description, style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.timer_outlined, size: 16, color: Colors.black54),
                const SizedBox(width: 4),
                Text('${recipe.cookTimeMinutes} min',
                    style: const TextStyle(color: Colors.black54)),
                const SizedBox(width: 12),
                Text('· ${_capitalize(recipe.difficulty)}',
                    style: const TextStyle(color: Colors.black54)),
              ],
            ),
            const SizedBox(height: 12),
            const Text('INGREDIENTS',
                style: TextStyle(
                  fontSize: 12,
                  letterSpacing: 1.1,
                  color: Colors.black54,
                  fontWeight: FontWeight.w600,
                )),
            const SizedBox(height: 4),
            for (final i in recipe.ingredients)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text(
                  '${i.item} — ${i.quantity}',
                ),
              ),
            const SizedBox(height: 12),
            const Text('STEPS',
                style: TextStyle(
                  fontSize: 12,
                  letterSpacing: 1.1,
                  color: Colors.black54,
                  fontWeight: FontWeight.w600,
                )),
            const SizedBox(height: 4),
            for (var idx = 0; idx < recipe.steps.length; idx++)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text('${idx + 1}. ${recipe.steps[idx]}'),
              ),
          ],
        ),
      ),
    );
  }
}

// -------------------- Shared --------------------

class _ErrorBar extends StatelessWidget {
  const _ErrorBar({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFDECEA),
        border: Border.all(color: const Color(0xFFB3261E)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: Color(0xFFB3261E), size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(message,
                style: const TextStyle(color: Color(0xFFB3261E))),
          ),
        ],
      ),
    );
  }
}
