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

export type TableListItem = {
  key: number;
  name: string;
  progress: number;
  containers: number;
  callNumber: number;
  creator: string;
  status: string;
  createdAt: number;
  memo: string;
};

export const createTableList = () => {
  const tableListDataSource: TableListItem[] = [];

  const creators = ['付小小', '曲丽丽', '林东东', '陈帅帅', '兼某某'];

  for (let i = 0; i < 5; i += 1) {
    tableListDataSource.push({
      key: i,
      name: `Rule ${i + 1}`,
      containers: Math.floor(Math.random() * 20),
      callNumber: Math.floor(Math.random() * 2000),
      progress: Math.ceil(Math.random() * 100) + 1,
      creator: creators[Math.floor(Math.random() * creators.length)],
      status: valueEnum[Math.floor(Math.random() * 10) % 4],
      createdAt: Date.now() - Math.floor(Math.random() * 100000),
      memo:
        i % 2 === 1
          ? 'If this rule is hit, flag the user and create SAR report.'
          : 'Black list the user if this rule is hit',
    });
  }
  return tableListDataSource;
};
