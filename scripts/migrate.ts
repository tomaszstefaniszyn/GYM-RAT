import { closeDb, dbDriver, getDb } from '../src/lib/db'

async function main() {
  await getDb()
  console.log(`[gym-rat] Schemat gotowy (${dbDriver()}).`)
  await closeDb()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
