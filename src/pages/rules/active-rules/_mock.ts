import type { Request, Response } from 'express';
import { RuleAction, RuleTableListItem, ThresholdAllowedDataTypes } from '../data.d';

const ruleNames = [
  'Whitelisted receiver name and country',
  'Blacklisted receiver name and country',
  'High risk country (suspend all)',
  'Proof of Funds Needed for Remittance	',
];

const ruleDescription = [
  'If a whitelisted user is transferring funds to a High Risk country, allow user & transactions',
  'If a blacklisted user is transferring funds to a High Risk country, flag user & transactions',
  'If a user is transferring funds to a High Risk country, flag user & transactions',
  'If a user is transferring funds to a High Risk country, flag user & transactions',
];

const thresholdDataList = [
  [{ parameter: 'originCountry', defaultValue: 'AF', type: 'string' as ThresholdAllowedDataTypes }],
  [
    {
      parameter: 'destinationCountry',
      defaultValue: 'PK',
      type: 'string' as ThresholdAllowedDataTypes,
    },
    {
      parameter: 'residenceCountry',
      defaultValue: 'AF',
      type: 'string' as ThresholdAllowedDataTypes,
    },
  ],
  [
    { parameter: 'amount', defaultValue: '1000', type: 'number' as ThresholdAllowedDataTypes },
    { parameter: 'currency', defaultValue: 'EUR', type: 'string' as ThresholdAllowedDataTypes },
  ],
];

const possibleActions = ['allow' as RuleAction, 'flag' as RuleAction, 'block' as RuleAction];

export const createTableList = () => {
  const tableListDataSource: RuleTableListItem[] = [];

  for (let i = 0; i < 5; i += 1) {
    tableListDataSource.push({
      key: i,
      name: ruleNames[i % ruleNames.length],
      ruleDescription: ruleDescription[i % ruleDescription.length],
      ruleId: `R-${(i % ruleNames.length) + 1}-${Math.floor(i / ruleNames.length) + 1}`,
      status: (Math.floor(Math.random() * 2) % 2).toString(),
      thresholdData: thresholdDataList[i % thresholdDataList.length],
      ruleAction: possibleActions[Math.floor(Math.floor(Math.random() * 3)) % 3],
      activatedAt: Date.now() - Math.floor(Math.random() * 100000),
      hitRate: Math.floor(Math.random() * 100),
    });
  }
  return tableListDataSource;
};

function getActiveRules(req: Request, res: Response) {
  const result = {
    data: createTableList(),
  };
  return res.json(result);
}

export default {
  'GET  /api/rules/active-rules': getActiveRules,
};
