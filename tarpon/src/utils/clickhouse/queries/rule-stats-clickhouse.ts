export const ruleStatsTransactionsMVQuery = (timeFormat: string) => `
SELECT
    ${timeFormat} AS time,
    arrayJoin(nonShadowHitRuleIdPairs).1 AS ruleInstanceId,
    arrayJoin(nonShadowHitRuleIdPairs).2 AS ruleId
FROM transactions
GROUP BY
    time,
    ruleInstanceId,
    ruleId;`
