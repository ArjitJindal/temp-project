import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { capitalizeWords, firstLetterUpper } from '@flagright/lib/utils/humanize';
import { RiskLevel, SimulationRiskLevelsAndRiskFactorsResult, TenantSettings } from '@/apis';
import { getRiskLevelLabel } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RISK_LEVELS } from '@/utils/risk-levels';

interface JsPDFWithAutoTable extends jsPDF {
  autoTable: (options: {
    head: string[][];
    body: string[][];
    startY: number;
    headStyles: any;
    alternateRowStyles: any;
    bodyStyles: any;
    didParseCell: (data: any) => void;
    margin: { left: number; top: number };
    willDrawPage: () => void;
    didDrawPage: (data: any) => void;
  }) => void;
  lastAutoTable: {
    finalY: number;
  };
}

const COLORS = {
  TABLE: {
    HEAD: [245, 245, 245] as [number, number, number],
    BODY: [250, 250, 250] as [number, number, number],
    ALTERNATE: [255, 255, 255] as [number, number, number],
  },
  TEXT: {
    HEADER: [38, 38, 38] as [number, number, number],
  },
  GRAPH: {
    BEFORE: {
      VERY_LOW: [76, 175, 80],
      LOW: [139, 195, 74],
      MEDIUM: [255, 235, 59],
      HIGH: [255, 152, 0],
      VERY_HIGH: [244, 67, 54],
    } as Record<RiskLevel, [number, number, number]>,
    AFTER: {
      VERY_LOW: [165, 214, 167],
      LOW: [197, 225, 165],
      MEDIUM: [255, 245, 157],
      HIGH: [255, 183, 77],
      VERY_HIGH: [239, 154, 154],
    } as Record<RiskLevel, [number, number, number]>,
  },
};

const drawBarGraph = (
  doc: jsPDF,
  data: Map<RiskLevel, { before: number; after: number }>,
  startY: number,
  title: string,
  settings: TenantSettings,
) => {
  const graphWidth = 170;
  const graphHeight = 80;
  const startX = 20;
  const barGap = 2;
  const groupGap = 8;
  const barWidth = (graphWidth - RISK_LEVELS.length * groupGap) / (RISK_LEVELS.length * 2);

  let maxValue = 0;
  data.forEach(({ before, after }) => {
    maxValue = Math.max(maxValue, before || 0, after || 0);
  });
  maxValue = Math.max(1, Math.ceil(maxValue + maxValue * 0.2));

  doc.setFontSize(12);
  doc.setFont('NotoSans-SemiBold');
  doc.text(title, startX, startY);
  startY += 8;

  doc.setFontSize(8);
  doc.setFont('NotoSans-Regular');
  for (let i = 0; i <= 4; i++) {
    const value = Math.round((maxValue * i) / 4);
    const y = startY + graphHeight - (graphHeight * i) / 4;
    doc.text(value.toString(), startX - 5, y, { align: 'right' });

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(startX, y, startX + graphWidth, y);
  }

  let x = startX + 10;
  RISK_LEVELS.forEach((level) => {
    const { before = 0, after = 0 } = data.get(level) || { before: 0, after: 0 };
    const label = getRiskLevelLabel(level, settings);

    const beforeHeight = Math.max(0, (before / maxValue) * graphHeight) || 0;
    const afterHeight = Math.max(0, (after / maxValue) * graphHeight) || 0;

    const [br, bg, bb] = COLORS.GRAPH.BEFORE[level];
    doc.setFillColor(br, bg, bb);
    if (beforeHeight > 0) {
      doc.rect(x, startY + graphHeight - beforeHeight, barWidth, beforeHeight, 'F');
    }

    const [ar, ag, ab] = COLORS.GRAPH.AFTER[level];
    doc.setFillColor(ar, ag, ab);
    if (afterHeight > 0) {
      doc.rect(
        x + barWidth + barGap,
        startY + graphHeight - afterHeight,
        barWidth,
        afterHeight,
        'F',
      );
    }

    doc.setFontSize(8);
    doc.text(label, x + barWidth, startY + graphHeight + 10, { align: 'center' });

    x += 2 * barWidth + groupGap;
  });

  return graphHeight + 15;
};

const getGraphData = (
  type: 'krs' | 'drs' | 'ars',
  settings: TenantSettings,
  iteration: {
    statistics?: {
      current: Array<{ count: number; riskLevel: RiskLevel; riskType: string }>;
      simulated: Array<{ count: number; riskLevel: RiskLevel; riskType: string }>;
    };
  },
): { data: Map<RiskLevel, { before: number; after: number }>; title: string } => {
  const distribution = new Map<RiskLevel, { before: number; after: number }>();

  RISK_LEVELS.forEach((level) => {
    distribution.set(level, { before: 0, after: 0 });
  });

  if (iteration.statistics) {
    iteration.statistics.current.forEach((stat) => {
      if (stat.riskType === type.toUpperCase()) {
        const current = distribution.get(stat.riskLevel) || { before: 0, after: 0 };
        distribution.set(stat.riskLevel, { ...current, before: stat.count });
      }
    });

    iteration.statistics.simulated.forEach((stat) => {
      if (stat.riskType === type.toUpperCase()) {
        const current = distribution.get(stat.riskLevel) || { before: 0, after: 0 };
        distribution.set(stat.riskLevel, { ...current, after: stat.count });
      }
    });
  }

  const title = `${firstLetterUpper(settings.userAlias)}s distribution based on ${
    type === 'krs' ? 'KRS' : type === 'drs' ? 'CRA' : 'TRS'
  }`;
  return { data: distribution, title };
};

export const drawSimulationGraphs = (
  doc: jsPDF,
  iterations: Array<{
    name: string;
    description?: string;
    items: SimulationRiskLevelsAndRiskFactorsResult[];
    statistics?: {
      current: Array<{ count: number; riskLevel: RiskLevel; riskType: string }>;
      simulated: Array<{ count: number; riskLevel: RiskLevel; riskType: string }>;
    };
  }>,
  settings: TenantSettings,
  isCustomRiskFactors: boolean,
): number => {
  let currentY = 40;
  const pageHeight = doc.internal.pageSize.height;
  const marginBottom = 20;
  const userAlias = firstLetterUpper(settings.userAlias);

  const ensureSpaceForContent = (requiredHeight: number) => {
    if (currentY + requiredHeight + marginBottom > pageHeight) {
      doc.addPage();
      currentY = 40;
    }
  };

  const drawTable = (title: string, head: string[][], body: string[][], startY: number): number => {
    (doc as JsPDFWithAutoTable).autoTable({
      head,
      body,
      startY,
      headStyles: {
        fillColor: COLORS.TABLE.HEAD,
        textColor: COLORS.TEXT.HEADER,
        valign: 'middle',
        font: 'NotoSans-SemiBold',
        fontSize: 10,
      },
      alternateRowStyles: { fillColor: COLORS.TABLE.ALTERNATE },
      bodyStyles: {
        fillColor: COLORS.TABLE.BODY,
        textColor: COLORS.TEXT.HEADER,
        fontSize: 9,
        font: 'NotoSans-Regular',
      },
      didParseCell: (data) => {
        data.cell.styles.cellPadding = {
          horizontal: 5,
          vertical: 2.5,
        };
      },
      margin: { left: 20, top: 40 },
      willDrawPage: function () {
        currentY = 40;
      },
      didDrawPage: function (data) {
        data.cursor.y += 10;
      },
    });

    return (doc as JsPDFWithAutoTable).lastAutoTable.finalY;
  };

  iterations.forEach((iteration, index) => {
    doc.setFontSize(16);
    doc.setFont('NotoSans-SemiBold');
    doc.text(iteration.name, 20, currentY + 8);
    currentY += 16;

    if (iteration.description) {
      doc.setFontSize(11);
      doc.setFont('NotoSans-Regular');
      doc.text(iteration.description, 20, currentY);
      currentY += 10;
    }

    ensureSpaceForContent(30);
    currentY = drawTable(
      'Summary',
      [['Value']],
      [['Total Users', iteration.items.length.toString()]],
      currentY,
    );
    currentY += 20;

    const krsData = getGraphData('krs', settings, iteration);
    ensureSpaceForContent(80);
    const krsHeight = drawBarGraph(doc, krsData.data, currentY, krsData.title, settings);
    currentY += krsHeight + 20;

    if (isCustomRiskFactors) {
      const craData = getGraphData('drs', settings, iteration);
      ensureSpaceForContent(80);
      const craHeight = drawBarGraph(doc, craData.data, currentY, craData.title, settings);
      currentY += craHeight + 20;
    }

    const trsData = getGraphData('ars', settings, iteration);
    ensureSpaceForContent(80);
    const trsHeight = drawBarGraph(
      doc,
      trsData.data,
      currentY,
      'Transactions distribution based on TRS',
      settings,
    );
    currentY += trsHeight + 20;

    ensureSpaceForContent(100);
    const tableHead = [
      [
        `${userAlias} ID`,
        `${userAlias} name`,
        `${userAlias} type`,
        'KRS risk level before',
        'KRS risk level after',
        ...(isCustomRiskFactors ? ['CRA risk level before', 'CRA risk level after'] : []),
      ],
    ];

    const tableBody = iteration.items.map((item) => [
      item.userId,
      item.userName || '-',
      item.userType ? capitalizeWords(item.userType) : '-',
      item.current?.krs?.riskLevel ? getRiskLevelLabel(item.current.krs.riskLevel, settings) : '-',
      item.simulated?.krs?.riskLevel
        ? getRiskLevelLabel(item.simulated.krs.riskLevel, settings)
        : '-',
      ...(isCustomRiskFactors
        ? [
            item.current?.drs?.riskLevel
              ? getRiskLevelLabel(item.current.drs.riskLevel, settings)
              : '-',
            item.simulated?.drs?.riskLevel
              ? getRiskLevelLabel(item.simulated.drs.riskLevel, settings)
              : '-',
          ]
        : []),
    ]);

    currentY = drawTable(
      `${userAlias}'s Risk Level Changes - Iteration ${index + 1}`,
      tableHead,
      tableBody,
      currentY,
    );
    currentY += 20;

    if (index < iterations.length - 1) {
      doc.addPage();
      currentY = 40;
    }
  });

  return currentY + 20;
};
