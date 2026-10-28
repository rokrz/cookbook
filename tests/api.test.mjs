// Testa regras de acesso, fotos protegidas e comportamento das coleções contra um
// PocketBase de TESTE (cria e apaga os usuários a@test.local e b@test.local).
// Uso: PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... PB_DATA_DIR=/caminho/pb_data node tests/api.test.mjs
import PocketBase from 'pocketbase'
import fs from 'node:fs'
import zlib from 'node:zlib'
const URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const DATA_DIR = process.env.PB_DATA_DIR || './pocketbase/pb_data'
let fails = 0
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++ }
const rejects = async (p) => { try { await p; return false } catch { return true } }

const admin = new PocketBase(URL)
await admin.collection('_superusers').authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD)
for (const e of ['a@test.local', 'b@test.local']) {
  const ex = await admin.collection('users').getFirstListItem(`email="${e}"`).catch(() => null)
  if (ex) await admin.collection('users').delete(ex.id)
  await admin.collection('users').create({ email: e, password: 'Senha-12345', passwordConfirm: 'Senha-12345', name: e[0].toUpperCase() })
}
const A = new PocketBase(URL), B = new PocketBase(URL), anon = new PocketBase(URL)
await A.collection('users').authWithPassword('a@test.local', 'Senha-12345')
await B.collection('users').authWithPassword('b@test.local', 'Senha-12345')
const aId = A.authStore.record.id, bId = B.authStore.record.id

ok(await rejects(anon.collection('users').create({ email: 'x@test.local', password: 'Senha-12345', passwordConfirm: 'Senha-12345' })), 'cadastro público bloqueado')

// batch categorias sugeridas
const batch = A.createBatch()
for (const n of ['Bolos e tortas', 'Lanches']) batch.collection('categories').create({ user: aId, name: n })
await batch.send()
const catsA = await A.collection('categories').getFullList({ sort: 'name' })
ok(catsA.length === 2, 'batch cria categorias')
ok(await rejects(A.collection('categories').create({ user: aId, name: 'bolos e tortas' })), 'nome duplicado (sem diferenciar maiúsculas) recusado')
ok(await rejects(A.collection('categories').create({ user: bId, name: 'Falsa' })), 'não cria categoria em nome de outro usuário')

// PNG 4x4 de uma cor, gerado na hora.
function img(shade) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(4, 0); ihdr.writeUInt32BE(4, 4); ihdr.set([8, 2, 0, 0, 0], 8)
  const raw = Buffer.concat(Array.from({ length: 4 }, () => Buffer.from([0, ...Array(12).fill(shade)])))
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
  return new Blob([png], { type: 'image/png' })
}

const fd = new FormData()
Object.entries({ user: aId, title: 'Bolo de cenoura', category: catsA[0].id, ingredients: '3 cenouras\nfarinha', notes: 'menos açúcar', favorite: 'true' }).forEach(([k, v]) => fd.append(k, v))
fd.append('image', img(200), 'bolo.png')
const r1 = await A.collection('recipes').create(fd)
await A.collection('recipes').create({ user: aId, title: 'Sanduíche', tested: true, category: catsA[1].id })
ok(Boolean(r1.image), 'receita criada com foto')

const filt = (q) => A.collection('recipes').getFullList({ filter: A.filter('(title ~ {:q} || ingredients ~ {:q} || notes ~ {:q})', { q }) })
ok((await filt('cenoura')).length === 1 && (await filt('açúcar')).length === 1 && (await filt('Sandu')).length === 1, 'busca por nome, ingrediente e anotação')
ok((await A.collection('recipes').getFullList({ filter: 'favorite = true' })).length === 1, 'filtro favoritas')
ok((await A.collection('recipes').getFullList({ filter: 'tested = true' })).length === 1, 'filtro testadas')

// privacidade
ok((await B.collection('recipes').getFullList()).length === 0, 'B não lista receitas de A')
ok((await B.collection('categories').getFullList()).length === 0, 'B não lista categorias de A')
ok(await rejects(B.collection('recipes').getOne(r1.id)), 'B não abre receita de A')
ok(await rejects(B.collection('recipes').update(r1.id, { title: 'hack' })), 'B não edita receita de A')
ok(await rejects(B.collection('recipes').delete(r1.id)), 'B não exclui receita de A')
ok(await rejects(B.collection('categories').update(catsA[0].id, { name: 'hack' })), 'B não renomeia categoria de A')
ok(await rejects(B.collection('recipes').create({ user: bId, title: 'x', category: catsA[0].id })), 'B não associa receita à categoria de A')
ok(await rejects(A.collection('recipes').update(r1.id, { user: bId })), 'A não transfere receita para B')
ok(await rejects(anon.collection('recipes').getFullList().then((l) => { if (!l.length) throw 0 })), 'anônimo não lista nada')

// arquivos protegidos
const tokA = await A.files.getToken(), tokB = await B.files.getToken()
const f = (t) => fetch(A.files.getURL(r1, r1.image, t ? { token: t } : {})).then((r) => r.status)
ok((await f(tokA)) === 200, 'A baixa a própria foto com token')
ok((await f('')) !== 200, 'foto sem token bloqueada')
ok((await f(tokB)) !== 200, 'foto com token de B bloqueada')
ok((await fetch(A.files.getURL(r1, r1.image, { token: tokA, thumb: '480x360' }))).status === 200, 'miniatura 480x360 disponível')

// troca de foto apaga a antiga
const dir = `${DATA_DIR}/storage/${r1.collectionId}/${r1.id}`
const fd2 = new FormData(); fd2.append('image', img(50), 'novo.png')
const r1b = await A.collection('recipes').update(r1.id, fd2)
ok(r1b.image !== r1.image && !fs.readdirSync(dir).includes(r1.image), 'trocar foto apaga o arquivo antigo')
const r1c = await A.collection('recipes').update(r1.id, { image: null })
ok(!r1c.image && !fs.readdirSync(dir).some((n) => n.startsWith('novo')), 'remover foto apaga o arquivo')

// excluir categoria mantém receitas
await A.collection('categories').delete(catsA[0].id)
const after = await A.collection('recipes').getOne(r1.id)
ok(after.category === '', 'excluir categoria deixa receita sem categoria')
await A.collection('recipes').delete(r1.id)
ok(!fs.existsSync(dir) || fs.readdirSync(dir).length === 0, 'excluir receita apaga a pasta de arquivos')

for (const u of [aId, bId]) await admin.collection('users').delete(u)
console.log(fails ? `${fails} falha(s)` : 'TODOS OS TESTES PASSARAM')
process.exit(fails ? 1 : 0)
