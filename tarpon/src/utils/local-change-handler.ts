import { envIs } from './env'

let localChangeHandlerEnabled = false
let localChangeHandlerDisabled = false

export function disableLocalChangeHandler() {
  localChangeHandlerEnabled = false
  localChangeHandlerDisabled = true
}
export function enableLocalChangeHandler() {
  localChangeHandlerEnabled = true
  localChangeHandlerDisabled = false
}

export function withLocalChangeHandler() {
  beforeAll(() => {
    enableLocalChangeHandler()
  })

  afterAll(() => {
    disableLocalChangeHandler()
  })
}

export function runLocalChangeHandler(): boolean {
  if (localChangeHandlerDisabled) {
    return false
  }
  return (
    envIs('local') ||
    Boolean(process.env.__INTERNAL_MONGODB_MIRROR__) ||
    localChangeHandlerEnabled
  )
}
