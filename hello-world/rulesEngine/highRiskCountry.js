// not even close to being real
module.exports = (payload, parameterName, parameterInputValue, action) => {
  const parameterValueInPayload = payload[parameterName];

  return {
    rule: "R-1",
    ruleName: "High risk country",
    ruleDescription: "Funds transfered to a high risk country",
    ruleAction: action,
    ruleHit: parameterValueInPayload.country == parameterInputValue,
  };
};
