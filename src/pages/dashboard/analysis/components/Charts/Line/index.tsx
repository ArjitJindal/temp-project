import React from 'react';
import { Line } from '@ant-design/charts';

const Page: React.FC = () => {
  const data = [
    {
      year: 'Jan 1-15',
      value: 1,
      category: 'Proof of funds',
    },
    {
      year: 'Jan 1-15',
      value: 8,
      category: 'High Risk Country',
    },
    {
      year: 'Jan 1-15',
      value: 6,
      category: 'TC40 Hit',
    },
    {
      year: 'Jan 1-15',
      value: 4,
      category: 'UN Sactions Hit',
    },
  ];

  //Time period for X-axis
  //24 data points on x-axis
  const months = [
    'Jan 1-15',
    'Jan 16-31',
    'Feb 1-15',
    'Feb 16-28',
    'Mar 1-15',
    'Mar 16-31',
    'Apr 1-15',
    'Apr 16-30',
    'May 1-15',
    'May 16-31',
    'Jun 1-15',
    'Jun 16-30',
    'Jul 1-15',
    'Jul 16-31',
    'Aug 1-15',
    'Aug 16-31',
    'Sep 1-15',
    'Sep 16-30',
    'Oct 1-15',
    'Oct 16-31',
    'Nov 1-15',
    'Nov 16-30',
    'Dec 1-15',
    'Dec 16-31',
  ];

  //Rules hit categories :
  const rulesHit = [
    'Proof of funds',
    'High Risk Country',
    'TC40 Hit',
    'UN Sactions Hit',
    'PEP Hit',
    'High Frequency User',
    'Account inactive for more than 12 months',
  ];

  function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  const generateLineChartData = () => {
    for (let i = 1; i < 24; i++) {
      const max = getRandomInt(12, 16); //To change the max value for every time period specifically.
      for (let j = 0; j < 7; j++) {
        data.push({
          year: months[i],
          value: getRandomInt(1, max), //Random to generate data points
          category: rulesHit[j],
        });
      }
    }
  };
  generateLineChartData();
  const config = {
    data,
    padding: 'auto',
    xField: 'year',
    yField: 'value',
    seriesField: 'category',
    point: {
      size: 5,
      shape: 'diamond',
    },
    yAxis: {
      max: 20,
    },
  };
  return <Line {...config} />;
};
export default Page;
