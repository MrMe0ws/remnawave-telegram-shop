import fs from 'fs'
import path from 'path'

const ru = JSON.parse(fs.readFileSync('src/i18n/ru.json', 'utf8'))

function get(obj, p) {
  return p.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj)
}

const files = []
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.tsx')) files.push(p)
  }
}
walk('src/features/admin')

const keys = new Set()
const re = /t\(['"](admin\.[^'"]+)['"]/g
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  let m
  while ((m = re.exec(s))) keys.add(m[1])
}

const missing = [...keys].sort().filter((k) => get(ru.translation, k) === undefined)
console.log('Total admin keys:', keys.size)
console.log('Missing in ru.json:', missing.length)
missing.forEach((k) => console.log(' -', k))
