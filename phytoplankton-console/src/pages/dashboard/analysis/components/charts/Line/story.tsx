import { LineChart } from './index';
import { UseCase } from '@/pages/storybook/components';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
} from '@/components/ui/colors';

const series1 = 'First line';
const series2 = 'Second line';
const data = [
  {
    xValue: '2010-01',
    yValue: 1998,
    series: series1,
  },
  {
    xValue: '2010-02',
    yValue: 1850,
    series: series1,
  },
  {
    xValue: '2010-03',
    yValue: 1720,
    series: series1,
  },
  {
    xValue: '2010-04',
    yValue: 1818,
    series: series1,
  },
  {
    xValue: '2010-05',
    yValue: 1920,
    series: series1,
  },
  {
    xValue: '2010-06',
    yValue: 1802,
    series: series1,
  },
  {
    xValue: '2010-07',
    yValue: 1945,
    series: series1,
  },
  {
    xValue: '2010-08',
    yValue: 1856,
    series: series1,
  },
  {
    xValue: '2010-09',
    yValue: 2107,
    series: series1,
  },
  {
    xValue: '2010-10',
    yValue: 2140,
    series: series1,
  },
  {
    xValue: '2010-11',
    yValue: 2311,
    series: series1,
  },
  {
    xValue: '2010-12',
    yValue: 1972,
    series: series1,
  },
  {
    xValue: '2011-01',
    yValue: 1760,
    series: series1,
  },
  {
    xValue: '2011-02',
    yValue: 1824,
    series: series1,
  },
  {
    xValue: '2011-03',
    yValue: 1801,
    series: series1,
  },
  {
    xValue: '2011-04',
    yValue: 2001,
    series: series1,
  },
  {
    xValue: '2011-05',
    yValue: 1640,
    series: series1,
  },
  {
    xValue: '2011-06',
    yValue: 1502,
    series: series1,
  },
  {
    xValue: '2011-07',
    yValue: 1621,
    series: series1,
  },
  {
    xValue: '2011-08',
    yValue: 1480,
    series: series1,
  },
  {
    xValue: '2011-09',
    yValue: 1549,
    series: series1,
  },
  {
    xValue: '2011-10',
    yValue: 1390,
    series: series1,
  },
  {
    xValue: '2011-11',
    yValue: 1325,
    series: series1,
  },
  {
    xValue: '2011-12',
    yValue: 1250,
    series: series1,
  },
  {
    xValue: '2012-01',
    yValue: 1394,
    series: series1,
  },
  {
    xValue: '2012-02',
    yValue: 1406,
    series: series1,
  },
  {
    xValue: '2012-03',
    yValue: 1578,
    series: series1,
  },
  {
    xValue: '2012-04',
    yValue: 1465,
    series: series1,
  },
  {
    xValue: '2012-05',
    yValue: 1689,
    series: series1,
  },
  {
    xValue: '2012-06',
    yValue: 1755,
    series: series1,
  },
  {
    xValue: '2012-07',
    yValue: 1495,
    series: series1,
  },
  {
    xValue: '2012-08',
    yValue: 1508,
    series: series1,
  },
  {
    xValue: '2012-09',
    yValue: 1433,
    series: series1,
  },
  {
    xValue: '2012-10',
    yValue: 1344,
    series: series1,
  },
  {
    xValue: '2012-11',
    yValue: 1201,
    series: series1,
  },
  {
    xValue: '2012-12',
    yValue: 1065,
    series: series1,
  },
  {
    xValue: '2013-01',
    yValue: 1255,
    series: series1,
  },
  {
    xValue: '2013-02',
    yValue: 1429,
    series: series1,
  },
  {
    xValue: '2013-03',
    yValue: 1398,
    series: series1,
  },
  {
    xValue: '2013-04',
    yValue: 1678,
    series: series1,
  },
  {
    xValue: '2013-05',
    yValue: 1524,
    series: series1,
  },
  {
    xValue: '2013-06',
    yValue: 1688,
    series: series1,
  },
  {
    xValue: '2013-07',
    yValue: 1500,
    series: series1,
  },
  {
    xValue: '2013-08',
    yValue: 1670,
    series: series1,
  },
  {
    xValue: '2013-09',
    yValue: 1734,
    series: series1,
  },
  {
    xValue: '2013-10',
    yValue: 1699,
    series: series1,
  },
  {
    xValue: '2013-11',
    yValue: 1508,
    series: series1,
  },
  {
    xValue: '2013-12',
    yValue: 1680,
    series: series1,
  },
  {
    xValue: '2014-01',
    yValue: 1750,
    series: series1,
  },
  {
    xValue: '2014-02',
    yValue: 1602,
    series: series1,
  },
  {
    xValue: '2014-03',
    yValue: 1834,
    series: series1,
  },
  {
    xValue: '2014-04',
    yValue: 1722,
    series: series1,
  },
  {
    xValue: '2014-05',
    yValue: 1430,
    series: series1,
  },
  {
    xValue: '2014-06',
    yValue: 1280,
    series: series1,
  },
  {
    xValue: '2014-07',
    yValue: 1367,
    series: series1,
  },
  {
    xValue: '2014-08',
    yValue: 1155,
    series: series1,
  },
  {
    xValue: '2014-09',
    yValue: 1289,
    series: series1,
  },
  {
    xValue: '2014-10',
    yValue: 1104,
    series: series1,
  },
  {
    xValue: '2014-11',
    yValue: 1246,
    series: series1,
  },
  {
    xValue: '2014-12',
    yValue: 1098,
    series: series1,
  },
  {
    xValue: '2015-01',
    yValue: 1189,
    series: series1,
  },
  {
    xValue: '2015-02',
    yValue: 1276,
    series: series1,
  },
  {
    xValue: '2015-03',
    yValue: 1033,
    series: series1,
  },
  {
    xValue: '2015-04',
    yValue: 956,
    series: series1,
  },
  {
    xValue: '2015-05',
    yValue: 845,
    series: series1,
  },
  {
    xValue: '2015-06',
    yValue: 1089,
    series: series1,
  },
  {
    xValue: '2015-07',
    yValue: 944,
    series: series1,
  },
  {
    xValue: '2015-08',
    yValue: 1043,
    series: series1,
  },
  {
    xValue: '2015-09',
    yValue: 893,
    series: series1,
  },
  {
    xValue: '2015-10',
    yValue: 840,
    series: series1,
  },
  {
    xValue: '2015-11',
    yValue: 934,
    series: series1,
  },
  {
    xValue: '2015-12',
    yValue: 810,
    series: series1,
  },
  {
    xValue: '2016-01',
    yValue: 782,
    series: series1,
  },
  {
    xValue: '2016-02',
    yValue: 1089,
    series: series1,
  },
  {
    xValue: '2016-03',
    yValue: 745,
    series: series1,
  },
  {
    xValue: '2016-04',
    yValue: 680,
    series: series1,
  },
  {
    xValue: '2016-05',
    yValue: 802,
    series: series1,
  },
  {
    xValue: '2016-06',
    yValue: 697,
    series: series1,
  },
  {
    xValue: '2016-07',
    yValue: 583,
    series: series1,
  },
  {
    xValue: '2016-08',
    yValue: 456,
    series: series1,
  },
  {
    xValue: '2016-09',
    yValue: 524,
    series: series1,
  },
  {
    xValue: '2016-10',
    yValue: 398,
    series: series1,
  },
  {
    xValue: '2016-11',
    yValue: 278,
    series: series1,
  },
  {
    xValue: '2016-12',
    yValue: 195,
    series: series1,
  },
  {
    xValue: '2017-01',
    yValue: 145,
    series: series1,
  },
  {
    xValue: '2017-02',
    yValue: 207,
    series: series1,
  },
];

export default function (): JSX.Element {
  const colors = {
    [series1]: COLORS_V2_ANALYTICS_CHARTS_01,
    [series2]: COLORS_V2_ANALYTICS_CHARTS_02,
  };
  return (
    <>
      <UseCase title={'Basic case'}>
        <LineChart data={data} colors={colors} />
      </UseCase>
      <UseCase title={'Multiple line'}>
        <LineChart
          data={data.map((x) => ({ ...x, series: Math.random() < 0.5 ? series1 : series2 }))}
          colors={colors}
        />
      </UseCase>
    </>
  );
}
