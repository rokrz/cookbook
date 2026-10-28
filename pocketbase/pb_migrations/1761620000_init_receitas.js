/// <reference path="../pb_data/types.d.ts" />

// Migração inicial do "Meu Caderno de Receitas" (PocketBase v0.23 ou superior).
// Cria as coleções `categories` e `recipes`, com regras de API que substituem o RLS
// do Supabase, e fecha o cadastro público na coleção `users`.
// Colocar este arquivo em `pb_migrations/` ao lado do executável do PocketBase:
// ele é aplicado automaticamente na próxima inicialização do `pocketbase serve`.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  // Somente o dono do registro autenticado enxerga e altera os próprios dados.
  const ownerOnly = "@request.auth.id != '' && user = @request.auth.id"
  // Na criação, o campo `user` precisa ser o próprio usuário logado.
  const createOwn = "@request.auth.id != '' && @request.body.user = @request.auth.id"
  // Na edição, não é permitido transferir o registro para outro usuário.
  const updateOwn = ownerOnly + " && (@request.body.user:isset = false || @request.body.user = @request.auth.id)"

  // ---------------------------------------------------------------- categories
  const categories = new Collection({
    type: "base",
    name: "categories",
    listRule: ownerOnly,
    viewRule: ownerOnly,
    createRule: createOwn,
    updateRule: updateOwn,
    deleteRule: ownerOnly,
    fields: [
      {
        type: "relation",
        name: "user",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      { type: "text", name: "name", required: true, min: 1, max: 80 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      // Equivale ao UNIQUE (user_id, name) do Postgres, ignorando maiúsculas/minúsculas.
      "CREATE UNIQUE INDEX idx_categories_user_name ON categories (user, name COLLATE NOCASE)",
    ],
  })
  app.save(categories)

  // ------------------------------------------------------------------- recipes
  // A categoria escolhida, se houver, também precisa pertencer ao usuário.
  const ownCategory = "(@request.body.category:isset = false || @request.body.category = '' || @request.body.category.user = @request.auth.id)"

  const recipes = new Collection({
    type: "base",
    name: "recipes",
    listRule: ownerOnly,
    viewRule: ownerOnly,
    createRule: createOwn + " && " + ownCategory,
    updateRule: updateOwn + " && " + ownCategory,
    deleteRule: ownerOnly,
    fields: [
      {
        type: "relation",
        name: "user",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      { type: "text", name: "title", required: true, min: 1, max: 200 },
      {
        // Opcional e sem cascata: ao excluir a categoria, a receita fica sem categoria.
        type: "relation",
        name: "category",
        required: false,
        collectionId: categories.id,
        maxSelect: 1,
        cascadeDelete: false,
      },
      { type: "text", name: "ingredients", max: 20000 },
      { type: "text", name: "instructions", max: 50000 },
      { type: "text", name: "notes", max: 20000 },
      { type: "url", name: "source_url" },
      { type: "number", name: "prep_minutes", min: 0, max: 10000, onlyInt: true },
      { type: "text", name: "servings", max: 100 },
      { type: "bool", name: "favorite" },
      { type: "bool", name: "tested" },
      {
        // Substitui o bucket privado + image_path. `protected` exige token para baixar.
        type: "file",
        name: "image",
        maxSelect: 1,
        maxSize: 5 * 1024 * 1024,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
        thumbs: ["480x360", "1200x0"],
        protected: true,
      },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_recipes_user_created ON recipes (user, created)",
      "CREATE INDEX idx_recipes_user_category ON recipes (user, category)",
    ],
  })
  app.save(recipes)

  // --------------------------------------------------------------------- users
  // App pessoal: ninguém se cadastra pela internet. Contas são criadas pelo painel
  // de superusuário. Para reabrir o cadastro, troque por "" (qualquer visitante).
  users.createRule = null
  app.save(users)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("recipes"))
  app.delete(app.findCollectionByNameOrId("categories"))

  const users = app.findCollectionByNameOrId("users")
  users.createRule = ""
  app.save(users)
})
