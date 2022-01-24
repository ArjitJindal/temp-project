export type Address = {
  addressLines: string[]
  postcode: string
  city: string
  state: string
  country: string
  tags: { [key: string]: string }
}
