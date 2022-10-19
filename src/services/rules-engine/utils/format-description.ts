import Handlebars from 'handlebars'
import { formatCountry } from '@/utils/countries'
import { Rule } from '@/@types/openapi-internal/Rule'
import { logger } from '@/core/logger'
import { getErrorMessage } from '@/utils/lang'

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

Handlebars.registerHelper('to-fixed', function (value, options) {
  if (value == null || Number.isNaN(value)) {
    return value
  }
  const { fractionDigits = 2 } = options.hash
  return value.toFixed(fractionDigits || 2)
})

Handlebars.registerHelper('to-percent', function (value) {
  if (value == null || Number.isNaN(value)) {
    return `--.%`
  }
  return (value * 100).toFixed(2) + '%'
})

Handlebars.registerHelper('format-time-window', function (timeWindow) {
  const { units, granularity } = timeWindow
  return `${units} ${granularity}${units > 1 ? 's' : ''}`
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

export async function generateRuleDescription(
  ruleInfo: Rule,
  parameters: Vars,
  ruleResultVars?: Vars
): Promise<string> {
  if (ruleInfo.descriptionTemplate) {
    try {
      const ruleDescriptionTemplate = compileTemplate(
        ruleInfo.descriptionTemplate
      )
      return ruleDescriptionTemplate({
        ...ruleResultVars,
        parameters,
      })
    } catch (e) {
      logger.error(
        `Unable to format contextual description, using general description as a fallback. Original template: "${
          ruleInfo.descriptionTemplate
        }". Details: ${getErrorMessage(e)}`
      )
    }
  }
  return ruleInfo.description
}
