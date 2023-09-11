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
  angleField: string;
  colorField: string;
  position?: Position;
}

function Donut(props: Props) {
  const { data, COLORS, angleField, colorField } = props;
  const config = {
    appendPadding: 10,
    data,
    angleField: angleField,
    colorField: colorField,
    color: (data: any) => COLORS[data.priority],
    radius: 1,
    innerRadius: 0.65,
    startAngle: Math.PI,
    endAngle: 2 * Math.PI,
    label: {
      type: 'inner',
      offset: '-50%',
      content: (item: any) => item.value,
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
        position: props.position || 'bottom',
        sort: false,
      }}
    />
  );
}

export default Donut;
