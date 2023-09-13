import { Pie } from '@ant-design/plots';

type Position =
  | 'right'
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'right-top'
  | 'right-bottom'
  | 'left'
  | 'left-top'
  | 'left-bottom'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right'
  | undefined;

interface Props {
  data: Record<string, any>[];
  COLORS: Record<string, string>;
  position?: Position;
  shape?: 'CIRCLE' | 'SEMI_CIRCLE';
}

function Donut(props: Props) {
  const { data, COLORS, position, shape = 'SEMI_CIRCLE' } = props;
  const config = {
    appendPadding: 10,
    data,
    angleField: 'angleField',
    colorField: 'colorField',
    color: (data: any) => COLORS[data.colorField],
    radius: 1,
    innerRadius: 0.65,
    startAngle: shape === 'CIRCLE' ? 0 : Math.PI,
    endAngle: 2 * Math.PI,
    label: {
      type: 'inner',
      offset: '-50%',
      content: (item: any) => item.angleField,
      autoRotate: false,
      style: {
        textAlign: 'center',
        fontWeight: 600,
        fontSize: 10,
        fontFamily: 'Noto Sans',
      },
    },
    interactions: [
      {
        type: 'element-active',
      },
    ],
    pieStyle: {
      lineWidth: 0,
    },
    statistic: {
      title: undefined,
      content: {
        style: {
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        content: '',
      },
    },
  };
  return (
    <Pie
      {...config}
      legend={{
        position: position || 'bottom',
      }}
    />
  );
}

export default Donut;
