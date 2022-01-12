// not even close to being real
export default function highRiskCountry(
  payload: any,
  parameterName: string,
  parameterInputValue: string,
  action: string
) {
  const parameterValueInPayload = payload[parameterName]

  return {
    rule: 'R-1',
    ruleName: 'High risk country',
    ruleDescription: 'Funds transfered to a high risk country',
    ruleAction: action,
    ruleHit: parameterValueInPayload.country == parameterInputValue,
  }
}
