// Testes do leitor de legendas. Rodar com: npm test (Node 22.18+ lê TypeScript direto).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeParsed, parseCaption, parseMinutes } from '../src/lib/caption.ts'

test('legenda do Instagram com títulos, emojis e hashtags', () => {
  const p = parseCaption(`BOLO DE CENOURA FOFINHO 🥕🍰
Salve esse post para não perder!

📝 Ingredientes:
▪️ 3 cenouras médias
▪️ 4 ovos
▪️ 1 xícara de óleo
▪️ 2 xícaras de açúcar
▪️ 2 e 1/2 xícaras de farinha de trigo
▪️ 1 colher (sopa) de fermento

Cobertura:
- 4 colheres de chocolate em pó
- 1 colher de manteiga

👩‍🍳 Modo de preparo:
1️⃣ Bata no liquidificador a cenoura, os ovos e o óleo.
2️⃣ Despeje numa tigela, junte o açúcar e a farinha
e misture bem.
3️⃣ Por último o fermento. Asse a 180°C por 40 minutos.

💡 Dica: use cenouras bem laranjas.

Rende 12 fatias
⏱ Tempo: 1h10

#bolo #receitas #bolodecenoura @fulana`)
  assert.equal(p.title, 'BOLO DE CENOURA FOFINHO')
  assert.equal(
    p.ingredients,
    '3 cenouras médias\n4 ovos\n1 xícara de óleo\n2 xícaras de açúcar\n2 e 1/2 xícaras de farinha de trigo\n1 colher (sopa) de fermento\nCobertura:\n4 colheres de chocolate em pó\n1 colher de manteiga',
  )
  assert.equal(
    p.instructions,
    '1. Bata no liquidificador a cenoura, os ovos e o óleo.\n2. Despeje numa tigela, junte o açúcar e a farinha e misture bem.\n3. Por último o fermento. Asse a 180°C por 40 minutos.',
  )
  assert.equal(p.notes, 'use cenouras bem laranjas.')
  assert.equal(p.servings, '12 fatias')
  assert.equal(p.prep_minutes, 70)
  assert.equal(p.ingredientCount, 8)
  assert.equal(p.stepCount, 3)
  assert.equal(describeParsed(p), '8 ingredientes e 3 passos')
})

test('legenda sem títulos: decide pelo jeito das linhas', () => {
  const p = parseCaption(`Brigadeiro de colher que não falha
1 lata de leite condensado
1 colher de sopa de manteiga
2 colheres de chocolate em pó
Leve tudo ao fogo baixo mexendo sem parar.
Quando desgrudar do fundo, desligue e sirva.`)
  assert.equal(p.title, 'Brigadeiro de colher que não falha')
  assert.equal(p.ingredientCount, 3)
  assert.equal(p.instructions, '1. Leve tudo ao fogo baixo mexendo sem parar.\n2. Quando desgrudar do fundo, desligue e sirva.')
})

test('legenda numa linha só, como vem do TikTok', () => {
  const p = parseCaption(
    'Pão de queijo de liquidificador 🧀 Ingredientes: 2 ovos, 1 copo de leite, meio copo de óleo, 2 copos de polvilho doce e 1 xícara de queijo ralado. Modo de preparo: 1. Bata tudo no liquidificador. 2. Coloque em forminhas untadas. 3. Asse por 25 minutos. #paodequeijo #receita',
  )
  assert.equal(p.title, 'Pão de queijo de liquidificador')
  assert.deepEqual(p.ingredients.split('\n'), [
    '2 ovos',
    '1 copo de leite',
    'Meio copo de óleo',
    '2 copos de polvilho doce',
    '1 xícara de queijo ralado',
  ])
  assert.equal(p.stepCount, 3)
})

test('modo de preparo em parágrafo vira um passo só, sem número', () => {
  const p = parseCaption(`Ingredientes
2 bananas
1 ovo
Preparo
Amasse as bananas, misture o ovo e frite em fogo baixo dos dois lados.`)
  assert.equal(p.ingredients, '2 bananas\n1 ovo')
  assert.equal(p.instructions, 'Amasse as bananas, misture o ovo e frite em fogo baixo dos dois lados.')
  assert.equal(describeParsed(p), '2 ingredientes e o modo de preparo')
})

test('lista numerada de ingredientes não vira passo', () => {
  const p = parseCaption(`Ingredientes:
1. 2 xícaras de farinha
2. 1 xícara de leite
Modo de fazer:
1. Misture tudo.
2. Asse.`)
  assert.equal(p.ingredients, '2 xícaras de farinha\n1 xícara de leite')
  assert.equal(p.instructions, '1. Misture tudo.\n2. Asse.')
})

test('texto que não é receita não inventa nada', () => {
  const p = parseCaption('Que dia lindo na praia! 🌊 #ferias @amigo')
  assert.equal(p.ingredientCount, 0)
  assert.equal(p.stepCount, 0)
  assert.equal(describeParsed(p), '')
})

test('tempo de preparo', () => {
  assert.equal(parseMinutes('40 min'), 40)
  assert.equal(parseMinutes('1h30'), 90)
  assert.equal(parseMinutes('1 hora e 20 minutos'), 80)
  assert.equal(parseMinutes('2 horas'), 120)
})

test('"Receita 👇" não vira nome e sal sem quantidade fica nos ingredientes', () => {
  const p = parseCaption(`Receita 👇
Frango na airfryer
Ingredientes:
500 g de sobrecoxa
Sal e pimenta
Páprica a gosto
Como fazer:
Tempere o frango e leve à airfryer a 200 graus por 25 min.
Rendimento: 2 porções`)
  assert.equal(p.title, 'Frango na airfryer')
  assert.equal(p.ingredients, '500 g de sobrecoxa\nSal e pimenta\nPáprica a gosto')
  assert.equal(p.servings, '2 porções')
  assert.equal(p.stepCount, 1)
})
