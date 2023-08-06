export const addresses = [...Array(100)].map((_, i) => ({
  addressLines: [`${i}`, `Street${i}`],
  postcode: (Math.floor(Math.random() * 90000) + 10000).toString(),
  city: `City${i}`,
  state: `State${i}`,
  country: `Country${i}`,
}))
export const phoneNumber = [...Array(100)].map(() =>
  (Math.floor(Math.random() * 9_000_000) + 10_000_000).toString()
)
