import React from 'react';
import { Line } from '@ant-design/charts';

const Page: React.FC = () => {
  const data = [
    {
      year: 'Jan',
      value: 1,
      category: 'Proof of funds',
    },
    {
      year: 'Jan',
      value: 8,
      category: 'High Risk Country',
    },
    {
      year: 'Jan',
      value: 6,
      category: 'TC40 Hit',
    },
    {
      year: 'Jan',
      value: 6,
      category: 'UN Sactions Hit',
    },
    {
      year: 'Feb',
      value: 7,
      category: 'Proof of funds',
    },
    {
      year: 'Feb',
      value: 4,
      category: 'High Risk Country',
    },
    {
      year: 'Feb',
      value: 8,
      category: 'TC40 Hit',
    },
    {
      year: 'Feb',
      value: 7,
      category: 'UN Sactions Hit',
    },
    {
      year: 'Mar',
      value: 8,
      category: 'Proof of funds',
    },
    {
      year: 'Mar',
      value: 4,
      category: 'High Risk Country',
    },
    {
      year: 'Mar',
      value: 2,
      category: 'TC40 Hit',
    },
    {
      year: 'Mar',
      value: 6,
      category: 'UN Sactions Hit',
    },
    {
      year: 'Apr',
      value: 2,
      category: 'Proof of funds',
    },
    {
      year: 'Apr',
      value: 5,
      category: 'High Risk Country',
    },
    {
      year: 'Apr',
      value: 7,
      category: 'TC40 Hit',
    },
    {
      year: 'Apr',
      value: 4,
      category: 'UN Sactions Hit',
    },
    {
      year: 'May',
      value: 5,
      category: 'Proof of funds',
    },
    {
      year: 'May',
      value: 3,
      category: 'High Risk Country',
    },
    {
      year: 'May',
      value: 7,
      category: 'TC40 Hit',
    },
    {
      year: 'May',
      value: 9,
      category: 'UN Sactions Hit',
    },
    {
      year: 'Jun',
      value: 7,
      category: 'Proof of funds',
    },
    {
      year: 'Jun',
      value: 4,
      category: 'High Risk Country',
    },
    {
      year: 'Jun',
      value: 7,
      category: 'TC40 Hit',
    },
    {
      year: 'Jun',
      value: 5,
      category: 'UN Sactions Hit',
    },
    {
      year: 'Jul',
      value: 7,
      category: 'Proof of funds',
    },
    {
      year: 'Jul',
      value: 6,
      category: 'High Risk Country',
    },
    {
      year: 'Jul',
      value: 2,
      category: 'TC40 Hit',
    },
    {
      year: 'Jul',
      value: 5,
      category: 'UN Sactions Hit',
    },
    {
      year: 'Aug',
      value: 9,
      category: 'Proof of funds',
    },
    {
      year: 'Aug',
      value: 6,
      category: 'High Risk Country',
    },
    {
      year: 'Aug',
      value: 4,
      category: 'TC40 Hit',
    },
    {
      year: 'Aug',
      value: 5,
      category: 'UN Sactions Hit',
    },
    {
      year: 'Sep',
      value: 3,
      category: 'Proof of funds',
    },
    {
      year: 'Sep',
      value: 2,
      category: 'High Risk Country',
    },
    {
      year: 'Sep',
      value: 6,
      category: 'TC40 Hit',
    },
    {
      year: 'Sep',
      value: 4,
      category: 'UN Sactions Hit',
    },
    {
      year: 'Oct',
      value: 6,
      category: 'Proof of funds',
    },
    {
      year: 'Oct',
      value: 4,
      category: 'High Risk Country',
    },
    {
      year: 'Oct',
      value: 9,
      category: 'TC40 Hit',
    },
    {
      year: 'Oct',
      value: 5,
      category: 'UN Sactions Hit',
    },
    {
      year: 'Nov',
      value: 2,
      category: 'Proof of funds',
    },
    {
      year: 'Nov',
      value: 6,
      category: 'High Risk Country',
    },
    {
      year: 'Nov',
      value: 7,
      category: 'TC40 Hit',
    },
    {
      year: 'Nov',
      value: 8,
      category: 'UN Sactions Hit',
    },
    {
      year: 'Dec',
      value: 4,
      category: 'Proof of funds',
    },
    {
      year: 'Dec',
      value: 6,
      category: 'High Risk Country',
    },
    {
      year: 'Dec',
      value: 8,
      category: 'TC40 Hit',
    },
    {
      year: 'Dec',
      value: 1,
      category: 'UN Sactions Hit',
    },
  ];

  const config = {
    data,
    xField: 'year',
    yField: 'value',
    seriesField: 'category',
    point: {
      size: 5,
      shape: 'diamond',
    },
  };
  return <Line {...config} />;
};
export default Page;
