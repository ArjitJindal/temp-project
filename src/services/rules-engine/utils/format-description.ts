import Handlebars from 'handlebars'
import { formatCountry } from '@/utils/countries'

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

function formatMoney(value: any, currency: any): string {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return `${value.toFixed(2)} ${currency}`
  }
  if (value != null && typeof value === 'object') {
    if (
      typeof value.amount === 'number' &&
      typeof value.currency === 'string'
    ) {
      return formatMoney(value.amount, value.currency)
    }
    if (
      typeof value.transactionAmount === 'number' &&
      typeof value.transactionCurrency === 'string'
    ) {
      return formatMoney(value.transactionAmount, value.transactionCurrency)
    }
    if (
      typeof value.amountValue === 'number' &&
      typeof value.amountCurrency === 'string'
    ) {
      return formatMoney(value.amountValue, value.amountCurrency)
    }
    throw new Error(`Unable to format object ${JSON.stringify(value)} as money`)
  }

  return `${value} ${currency}`
}

Handlebars.registerHelper('format-money', formatMoney)

Handlebars.registerHelper('format-country', function (value) {
  return formatCountry(value)
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
