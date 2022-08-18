import Handlebars from 'handlebars'

Handlebars.registerHelper('possessive', function (value) {
  if (value == null || typeof value !== 'string' || value === '') {
    return value
  }
  return `${value}’s`
})

Handlebars.registerHelper('if-sender', function (ifSender, ifReceiver) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return this.hitParty.type === 'origin' ? ifSender : ifReceiver
})

Handlebars.registerHelper('format-money', function (value, currency) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return `${value.toFixed(2)} ${currency}`
  }
  return `${value} ${currency}`
})

export type Vars = {
  [key: string]: unknown // todo: improve types
}

export type CompiledTemplate = (vars: Vars) => string

export function compileTemplate(template: string): CompiledTemplate {
  const compiled = Handlebars.compile(template, { strict: true })
  return (params: Vars) => {
    return compiled(params)
  }
}
