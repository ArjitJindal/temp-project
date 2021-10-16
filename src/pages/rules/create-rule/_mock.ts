// eslint-disable-next-line import/no-extraneous-dependencies
import type { Request, Response } from 'express';
import type { TableListItem, TableListParams } from './data.d';
import { parse } from 'url';

// mock tableListDataSource
const genList = (current: number, pageSize: number) => {
  const tableListDataSource: TableListItem[] = [];

  const rulesAndDescriptions = [
    {
      ruleName: 'Proof of Funds Needed for Remittance',
      ruleDescription:
        'If a user makes a remittance transaction >= x in EUR for a given risk level, flag user & transactions and ask for proof of funds.',
      ruleId: 'R-1',
      type: ['transaction monitoring'],
    },
    {
      ruleName: 'High risk country (suspend all)',
      ruleDescription:
        'If a user is transferring funds to a High Risk country, flag user & transactions',
      ruleId: 'R-2',
      type: ['transaction monitoring'],
    },
    {
      ruleName: 'High risk country (suspend all)',
      ruleDescription:
        'If a user is transferring funds to a High Risk country, flag user & transactions',
      ruleId: 'R-3',
      type: ['aml compliance'],
    },
    {
      ruleName: 'Blacklisted receiver name and country',
      ruleDescription:
        'If a blacklisted user is transferring funds to a High Risk country, flag user & transactions',
      ruleId: 'R-4',
      type: ['sanctions'],
    },
    {
      ruleName: 'Whitelisted receiver name and country',
      ruleDescription:
        'If a whitelisted user is transferring funds to a High Risk country, allow user & transactions',
      ruleId: 'R-5',
      type: ['transaction monitoring'],
    },
  ];

  for (let i = 0; i < pageSize; i += 1) {
    const index = (current - 1) * 10 + i;
    tableListDataSource.push({
      key: index,
      disabled: i % 6 === 0,
      href: 'https://ant.design',
      name: rulesAndDescriptions[index % rulesAndDescriptions.length].ruleName,
      status: (Math.floor(Math.random() * 10) % 3).toString(),
      ruleDescription: rulesAndDescriptions[index % rulesAndDescriptions.length].ruleDescription,
      ruleId: rulesAndDescriptions[index % rulesAndDescriptions.length].ruleId,
      type: rulesAndDescriptions[index % rulesAndDescriptions.length].type,
    });
  }
  tableListDataSource.reverse();
  return tableListDataSource;
};

let tableListDataSource = genList(1, 20);

function getRule(req: Request, res: Response, u: string) {
  let realUrl = u;
  if (!realUrl || Object.prototype.toString.call(realUrl) !== '[object String]') {
    realUrl = req.url;
  }
  const { current = 1, pageSize = 10 } = req.query;
  const params = parse(realUrl, true).query as unknown as TableListParams;

  let dataSource = [...tableListDataSource].slice(
    ((current as number) - 1) * (pageSize as number),
    (current as number) * (pageSize as number),
  );
  if (params.sorter) {
    const sorter = JSON.parse(params.sorter as any);
    dataSource = dataSource.sort((prev, next) => {
      let sortNumber = 0;
      Object.keys(sorter).forEach((key) => {
        if (sorter[key] === 'descend') {
          if (prev[key] - next[key] > 0) {
            sortNumber += -1;
          } else {
            sortNumber += 1;
          }
          return;
        }
        if (prev[key] - next[key] > 0) {
          sortNumber += 1;
        } else {
          sortNumber += -1;
        }
      });
      return sortNumber;
    });
  }
  if (params.filter) {
    const filter = JSON.parse(params.filter as any) as Record<string, string[]>;
    if (Object.keys(filter).length > 0) {
      dataSource = dataSource.filter((item) => {
        return Object.keys(filter).some((key) => {
          if (!filter[key]) {
            return true;
          }
          if (filter[key].includes(`${item[key]}`)) {
            return true;
          }
          return false;
        });
      });
    }
  }

  if (params.name) {
    dataSource = dataSource.filter((data) => data.name.includes(params.name || ''));
  }

  let finalPageSize = 10;
  if (params.pageSize) {
    finalPageSize = parseInt(`${params.pageSize}`, 10);
  }

  const result = {
    data: dataSource,
    total: tableListDataSource.length,
    success: true,
    pageSize: finalPageSize,
    current: parseInt(`${params.currentPage}`, 10) || 1,
  };

  return res.json(result);
}

function postRule(req: Request, res: Response, u: string, b: Request) {
  let realUrl = u;
  if (!realUrl || Object.prototype.toString.call(realUrl) !== '[object String]') {
    realUrl = req.url;
  }

  const body = (b && b.body) || req.body;
  const { name, desc, key } = body;

  switch (req.method) {
    /* eslint no-case-declarations:0 */
    case 'DELETE':
      tableListDataSource = tableListDataSource.filter((item) => key.indexOf(item.key) === -1);
      break;
    case 'POST':
      (() => {
        const newRule: TableListItem = {
          key: tableListDataSource.length,
          href: 'https://ant.design',
          name,
          status: (Math.floor(Math.random() * 10) % 2).toString(),
          ruleDescription: 'Proof of funds',
          ruleId: 'R-1',
          type: ['Sanctions'],
        };
        tableListDataSource.unshift(newRule);
        return res.json(newRule);
      })();
      return;

    case 'PUT':
      (() => {
        let newRule = {};
        tableListDataSource = tableListDataSource.map((item) => {
          if (item.key === key) {
            newRule = { ...item, desc, name };
            return { ...item, desc, name };
          }
          return item;
        });
        return res.json(newRule);
      })();
      return;
    default:
      break;
  }

  const result = {
    list: tableListDataSource,
    pagination: {
      total: tableListDataSource.length,
    },
  };

  res.json(result);
}

export default {
  'POST  /api/stepForm': (_: Request, res: Response) => {
    res.send({ data: { message: 'Ok' } });
  },
  'GET /api/rules': getRule,
  'POST /api/rules': postRule,
  'DELETE /api/rules': postRule,
  'PUT /api/rules': postRule,
};
