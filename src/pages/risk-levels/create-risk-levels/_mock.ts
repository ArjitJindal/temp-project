// eslint-disable-next-line import/no-extraneous-dependencies
import type { Request, Response } from 'express';
import type { ParameterType, ParameterTableListItem, TableListParams } from './data.d';

import { parse } from 'url';

// mock tableListDataSource
const genList = (current: number, pageSize: number) => {
  const tableListDataSource: ParameterTableListItem[] = [];

  const parametersAndDescriptions = [
    {
      parameterName: 'Country of Residence',
      parameterDescription: 'Risk customer based on their country of residency.',
      parameterId: 'P-1',
      parameterType: 'enumeration',
    },
    {
      parameterName: 'Country of Nationality',
      parameterDescription: 'Risk customer based on their country of residency Nationality',
      parameterId: 'P-2',
      parameterType: 'enumeration',
    },
    {
      parameterName: 'Business Age',
      parameterDescription: 'Risk customer based on the Age group of their business',
      parameterId: 'P-3',
      parameterType: 'range',
    },
    {
      parameterName: 'Individual Age',
      parameterDescription: 'Risk customer based on their Age group',
      parameterId: 'P-4',
      parameterType: 'range',
    },
    {
      parameterName: 'Payment Method',
      parameterDescription: 'Risk customer based on the payment method used.',
      parameterId: 'P-4',
      parameterType: 'enumeration',
    },
    {
      parameterName: 'Payout Method',
      parameterDescription: 'Risk customer based on their payout method.',
      parameterId: 'P-5',
      parameterType: 'enumeration',
    },
    {
      parameterName: 'Business Industry Risk Level',
      parameterDescription: 'Risk customer based on their business industry.',
      parameterId: 'P-6',
      parameterType: 'enumeration',
    },
  ];

  // lol wtf
  for (let i = 0; i < parametersAndDescriptions.length; i += 1) {
    const idx = (current - 1) * 10 + i;
    const index = ((current - 1) * 10 + i) % parametersAndDescriptions.length;
    tableListDataSource.push({
      key: idx,
      name: parametersAndDescriptions[index].parameterName,
      status: (Math.floor(Math.random() * 10) % 3).toString(),
      parameterDescription: parametersAndDescriptions[index].parameterDescription,
      parameterId: parametersAndDescriptions[index].parameterId,
      parameterType: parametersAndDescriptions[index].parameterType as ParameterType,
    });
  }
  tableListDataSource.reverse();
  return tableListDataSource;
};

let tableListDataSource = genList(1, 10);

function getRiskRarameters(req: Request, res: Response, u: string) {
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

export default {
  'POST  /api/stepForm': (_: Request, res: Response) => {
    res.send({ data: { message: 'Ok' } });
  },
  'GET /api/riskRarameters': getRiskRarameters,
};
