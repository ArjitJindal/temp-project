import { RuleAction, ThresholdDataType, RuleTableListItem } from '../data';

export const valueEnum = {
  0: 'close',
  1: 'running',
  2: 'online',
  3: 'error',
};

export const ProcessMap = {
  close: 'normal',
  running: 'active',
  online: 'success',
  error: 'exception',
};

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
  [{ parameter: 'originCountry', defaultValue: 'AF' }],
  [
    { parameter: 'destinationCountry', defaultValue: 'PK' },
    { parameter: 'residenceCountry', defaultValue: 'AF' },
  ],
  [
    { parameter: 'amount', defaultValue: 1000 },
    { parameter: 'currency', defaultValue: 'EUR' },
  ],
];

const possibleActions = ['allow', 'flag', 'block'];

export const createTableList = () => {
  const tableListDataSource: RuleTableListItem[] = [];

  const creators = ['付小小', '曲丽丽', '林东东', '陈帅帅', '兼某某'];

  for (let i = 0; i < 5; i += 1) {
    tableListDataSource.push({
      key: i,
      name: ruleNames[i % ruleNames.length],
      ruleDescription: ruleDescription[i % ruleDescription.length],
      ruleId: `R-${(i % ruleNames.length) + 1}-${Math.floor(i / ruleNames.length) + 1}`,
      status: Math.floor(Math.random() * 2) % 2,
      thresholdData: thresholdDataList[i % thresholdDataList.length],
      ruleAction: possibleActions[Math.floor(Math.floor(Math.random() * 3)) % 3],
      activatedAt: Date.now() - Math.floor(Math.random() * 100000),
      hitRate: Math.floor(Math.random() * 100),
    });
  }
  return tableListDataSource;
};
