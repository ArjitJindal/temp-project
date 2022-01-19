// eslint-disable-next-line import/no-extraneous-dependencies
import type { Request, Response } from 'express';
import { parse } from 'url';
import type { TableListItem, TableListParams } from './data';

const sendingCountryList = ['DE', 'FR', 'GB', 'LT', 'PL', 'BL', 'NL', 'AT'];
const currencyForCountry = {
  DE: 'EUR',
  FR: 'EUR',
  NL: 'EUR',
  BL: 'EUR',
  AT: 'EUR',
  LT: 'EUR',
  PL: 'PLN',
  GB: 'GBP',
};

const customers = ['TransferGo', 'Wise', 'Remitly', 'Paysend', 'Azimo'];

const paymentMethods = ['ApplePay', 'Credit Card', 'Bank Transfer', 'Cash'];

// mock tableListDataSource
const genList = (current: number, pageSize: number) => {
  const tableListDataSource: TableListItem[] = [];

  for (let i = 0; i < pageSize; i += 1) {
    const originCountry = sendingCountryList[Math.floor(Math.random() * sendingCountryList.length)];
    const originCurrency = currencyForCountry[originCountry];
    const index = (current - 1) * 10 + i;
    tableListDataSource.push({
      key: index,
      disabled: i % 6 === 0,
      name: `ProfileId-${index + 1}`,
      rulesHit: Math.ceil(Math.random() * 4),
      amount: Math.floor(Math.random() * 10000),
      transactionId: `T-${index + 1}`,
      sendingCurrency: originCurrency,
      receivingCurrency: 'TRY',
      originCountry: originCountry,
      destinationCountry: 'TR',
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      payoutMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      status: (Math.floor(Math.random() * 10) % 4).toString(),
      tags: [{ customer: customers[Math.floor(Math.random() * customers.length)] }],
      updatedAt: new Date(),
      createdAt: new Date(),
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
        const i = Math.ceil(Math.random() * 10000);
        const newRule = {
          key: tableListDataSource.length,
          name,
          rulesHit: Math.floor(Math.random() * 4),
          transactionId: `T-1`,
          amount: Math.floor(Math.random() * 1000),
          sendingCurrency: 'EUR',
          receivingCurrency: 'TRY',
          originCountry: 'TR',
          destinationCountry: 'DE',
          paymentMethod: 'Bank Transfer',
          payoutMethod: 'ApplePay',
          status: (Math.floor(Math.random() * 10) % 2).toString(),
          tags: [{ customer: 'TransferGo' }],
          updatedAt: new Date(),
          createdAt: new Date(),
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
  'GET /api/rule': getRule,
  'POST /api/rule': postRule,
  'DELETE /api/rule': postRule,
  'PUT /api/rule': postRule,
};
