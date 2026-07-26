const TWITTER_EPOCH_MS = 1288834974657
const ids = [
  '2081258099306873241', // Romano
  '2081257858239189095', // Romano
  '2081187825832051117', // Romano
  '2081186511928639734', // Romano
  '2081099153275580540', // YanitedFever (fan)
  '2081054999677743568', // Arsenalnewschan (fan)
]
for (const id of ids) {
  const big = BigInt(id)
  const ts = Number(big >> 22n) + TWITTER_EPOCH_MS
  const d = new Date(ts)
  const ageDays = (Date.now() - d.getTime()) / (24*3600*1000)
  console.log(`${id} → ${d.toISOString()}  (age: ${ageDays.toFixed(1)} days)`)
}
console.log(`NOW: ${new Date().toISOString()}`)
