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
