// eslint-disable-next-line import/no-extraneous-dependencies
import type { Request, Response } from 'express';
import { parse } from 'url';
import type { NetworkAnalysisTableListItem, NetworkAnalysisTableListParams } from './data.d';

const customers = ['TransferGo', 'Wise', 'Remitly', 'Paysend', 'Azimo'];

// mock NetworkAnalysisTableListDataSource
const genList = (current: number, pageSize: number) => {
  const NetworkAnalysisTableListDataSource: NetworkAnalysisTableListItem[] = [];

  for (let i = 0; i < pageSize; i += 1) {
    const index = (current - 1) * 10 + i;
    NetworkAnalysisTableListDataSource.push({
      key: index,
      disabled: i % 6 === 0,
      name: [`ProfileId-${index + 1}`, `ProfileId-${index + 2}`, `ProfileId-${index + 3}`],
      transactionIds: [`T-${index + 1}`, `T-${index + 2}`, `T-${index + 3}`],
      tags: [{ customer: customers[Math.floor(Math.random() * customers.length)] }],
    });
  }
  NetworkAnalysisTableListDataSource.reverse();
  return NetworkAnalysisTableListDataSource;
};

let NetworkAnalysisTableListDataSource = genList(1, 20);

function getNetworkAnalysis(req: Request, res: Response, u: string) {
  let realUrl = u;
  if (!realUrl || Object.prototype.toString.call(realUrl) !== '[object String]') {
    realUrl = req.url;
  }
  const { current = 1, pageSize = 10 } = req.query;
  const params = parse(realUrl, true).query as unknown as NetworkAnalysisTableListParams;

  let dataSource = [...NetworkAnalysisTableListDataSource].slice(
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
    total: NetworkAnalysisTableListDataSource.length,
    success: true,
    pageSize: finalPageSize,
    current: parseInt(`${params.currentPage}`, 10) || 1,
  };

  return res.json(result);
}

export default {
  'GET /api/networkAnalysis': getNetworkAnalysis,
};
