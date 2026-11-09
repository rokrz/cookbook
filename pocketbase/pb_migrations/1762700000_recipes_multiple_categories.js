/// <reference path="../pb_data/types.d.ts" />

// Várias categorias por receita: troca o campo `category` (uma) por `categories` (várias).
// Cada receita que tinha categoria passa a ter uma lista com essa mesma categoria; nada se perde.

migrate((app) => {
  const categories = app.findCollectionByNameOrId("categories")
  const recipes = app.findCollectionByNameOrId("recipes")

  // 1. Cria o campo novo (sem cascata: ao excluir uma categoria, ela só sai da lista da receita).
  recipes.fields.add(new RelationField({
    name: "categories",
    required: false,
    collectionId: categories.id,
    maxSelect: 999,
    cascadeDelete: false,
  }))
  app.save(recipes)

  // 2. Copia a categoria antiga para a lista, sem mexer na data de atualização das receitas.
  app.db()
    .newQuery("UPDATE recipes SET categories = json_array(category) WHERE category != ''")
    .execute()

  // 3. Remove o campo antigo e o índice que dependia dele.
  recipes.removeIndex("idx_recipes_user_category")
  recipes.fields.removeByName("category")

  // Todas as categorias escolhidas precisam ser do próprio usuário
  // (em campo com vários valores, `=` exige que todos os itens atendam).
  const ownerOnly = "@request.auth.id != '' && user = @request.auth.id"
  const createOwn = "@request.auth.id != '' && @request.body.user = @request.auth.id"
  const updateOwn = ownerOnly + " && (@request.body.user:isset = false || @request.body.user = @request.auth.id)"
  const ownCategories = "(@request.body.categories:isset = false || @request.body.categories:length = 0 || @request.body.categories.user = @request.auth.id)"
  recipes.createRule = createOwn + " && " + ownCategories
  recipes.updateRule = updateOwn + " && " + ownCategories
  app.save(recipes)
}, (app) => {
  // Volta para uma categoria só: fica a primeira da lista.
  const categories = app.findCollectionByNameOrId("categories")
  const recipes = app.findCollectionByNameOrId("recipes")

  recipes.fields.add(new RelationField({
    name: "category",
    required: false,
    collectionId: categories.id,
    maxSelect: 1,
    cascadeDelete: false,
  }))
  app.save(recipes)

  app.db()
    .newQuery("UPDATE recipes SET category = COALESCE(json_extract(categories, '$[0]'), '') WHERE json_valid(categories)")
    .execute()

  recipes.fields.removeByName("categories")
  recipes.addIndex("idx_recipes_user_category", false, "user, category", "")

  const ownerOnly = "@request.auth.id != '' && user = @request.auth.id"
  const createOwn = "@request.auth.id != '' && @request.body.user = @request.auth.id"
  const updateOwn = ownerOnly + " && (@request.body.user:isset = false || @request.body.user = @request.auth.id)"
  const ownCategory = "(@request.body.category:isset = false || @request.body.category = '' || @request.body.category.user = @request.auth.id)"
  recipes.createRule = createOwn + " && " + ownCategory
  recipes.updateRule = updateOwn + " && " + ownCategory
  app.save(recipes)
})
