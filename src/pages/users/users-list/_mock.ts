// eslint-disable-next-line import/no-extraneous-dependencies
import { parse } from 'url';
import type { Request, Response } from 'express';
import type { BusinessUsersListItem, CustomerUsersListItem, TableListParams } from './data.d';

const countries = ['Germany', 'France', 'UK', 'Lithuania', 'Poland', 'India', 'Turkey'];

const customers = ['TransferGo', 'Wise', 'Remitly', 'Paysend', 'Azimo'];

const consumerNames = [
  'Scout Salazar',
  'Addison Ramsey',
  'June Lucas',
  'Luke Baxter',
  'Beata Stone',
  'Michael Lipsey',
  'Luna Males',
  'Georgia Gray',
  'Christopher Sandoval',
  'Neil Mccarthy',
  'Denton Parham',
  'Bailey Leonard',
  'Howell Houle',
  'Marlon Santos',
  'Cedric Parker',
  'Rosemary Hammond',
  'Ginger Jenning',
];
const businessNames = [
  'Volkswagen Group',
  'Daimler AG',
  'Allianz',
  'BMW',
  'Siemens',
  'Adidas',
  'Audi',
  'BioNTech',
  'Birkenstock',
  'DHL Express',
  'Dräger',
  'Ferrostaal',
  'GEA Group',
  'Katjes International',
  'LSG Sky Chefs',
  'Metro AG',
  'Robert Bosch GmbH',
];
const industries = [
  'Consumer goods',
  'Industrials',
  'Basic materials',
  'Financials',
  'Telecommunications',
  'Technology',
  'Personal products',
  'Conglomerates',
];
const genCustomerUsersList = (current: number, pageSize: number) => {
  const tableListDataSource: CustomerUsersListItem[] = [];

  for (let i = 0; i < pageSize; i += 1) {
    const index = (current - 1) * 10 + i;
    tableListDataSource.push({
      key: index,
      userId: `U-${index + 1}`,
      disabled: i % 6 === 0,
      name: consumerNames[Math.floor(Math.random() * (consumerNames.length - 1))],
      age: Math.floor(Math.random() * 50) + 20,
      countryOfResidence: countries[Math.floor(Math.random() * countries.length)],
      countryOfNationality: countries[Math.floor(Math.random() * countries.length)],
      tags: [{ customer: customers[Math.floor(Math.random() * customers.length)] }],
      updatedAt: new Date(),
      createdAt: new Date(),
    });
  }
  tableListDataSource.reverse();
  return tableListDataSource;
};

const genBusinessUsersList = (current: number, pageSize: number) => {
  const tableListDataSource: BusinessUsersListItem[] = [];

  for (let i = 0; i < pageSize; i += 1) {
    const index = (current - 1) * 10 + i;
    tableListDataSource.push({
      key: index,
      userId: `U-${index + 1}`,
      disabled: i % 6 === 0,
      name: businessNames[Math.floor(Math.random() * (businessNames.length - 1))],
      businessIndustry: industries[Math.floor(Math.random() * (industries.length - 1))],
      expectedTransactionAmountPerMonth: `${Math.floor(Math.random() * 10000) + 100000} EUR`,
      expectedTurnoverPerMonth: `${Math.floor(Math.random() * 1000000) + 1000000} EUR`,
      registrationIdentifier: `${Math.floor(Math.random() * 1000000) + 100000}`,
      registrationCountry: countries[Math.floor(Math.random() * countries.length)],
      maximumDailyTransactionLimit: `${Math.floor(Math.random() * 10000) + 10000} EUR`,
      updatedAt: new Date(),
      createdAt: new Date(),
    });
  }
  tableListDataSource.reverse();
  return tableListDataSource;
};

function getUsers(tableListDataSource: (CustomerUsersListItem | BusinessUsersListItem)[]) {
  return (req: Request, res: Response, u: string) => {
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
  };
}

export default {
  'GET /api/customerUsers': getUsers(genCustomerUsersList(1, 20)),
  'GET /api/businessUsers': getUsers(genBusinessUsersList(1, 20)),
};
