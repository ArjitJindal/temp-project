import type { UserOptions } from 'jspdf-autotable';
import FlagrightDemoLogoSvg from '@/branding/flagright-logo-demo.svg';

interface Props {
  pdfRef?: HTMLElement;
  fileName: string;
  reportTitle?: string;
  tableOptions?: TableOptions[];
}

export interface TableOptions {
  tableOptions: UserOptions;
  tableTitle?: string;
}

const PAGE_WIDTH = 190;
const PAGE_HEIGHT = 295;
export const FONT_FAMILY_REGULAR = 'NotoSans-Regular';
export const FONT_FAMILY_SEMIBOLD = 'NotoSans-SemiBold';

const DownloadAsPDF = async (props: Props) => {
  await import('./NotoSans-Regular');
  await import('./NotoSans-SemiBold');
  const { pdfRef, fileName, tableOptions, reportTitle } = props;
  try {
    const logoImage = new Image();
    logoImage.src = FlagrightDemoLogoSvg;

    await new Promise((resolve, reject) => {
      logoImage.onload = resolve;
      logoImage.onerror = reject;
    });

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable'); // need to be imported before creating a new Jspdf instance
    let imgHeight = 0;
    const doc = new jsPDF('p', 'mm');
    let position = 30;
    addAndSetFonts(doc);

    addTopFormatting({ doc, logoImage });
    if (reportTitle) {
      doc.setFontSize(16);
      doc.text(reportTitle, 15, position + 7);
      doc.setFontSize(12);
    }

    if (pdfRef) {
      position += reportTitle ? 16 : 0;
      const input = pdfRef;

      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(input);

      const imgData = canvas.toDataURL('image/png');
      imgHeight = (canvas.height * PAGE_WIDTH) / canvas.width;
      let heightLeft = imgHeight;

      // Add the first page
      doc.addImage(imgData, 'PNG', 10, position, PAGE_WIDTH, imgHeight);
      heightLeft -= PAGE_HEIGHT - position;

      // Add pages from 2 to n
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 10, position, PAGE_WIDTH, imgHeight);
        heightLeft -= PAGE_HEIGHT;
      }
    }

    // Add table if data is available
    addTable({ imgHeight, position, doc, tableOptions, logoImage, autoTable });

    doc.save(fileName);
  } catch (err) {
    console.error(err);
  }
};

export default DownloadAsPDF;

export const getTableHeadAndBody = (data?: string) => {
  const csvData = data
    ?.split('"')
    .join('')
    .split('\n')
    .map((row) => row.split(','));

  if (csvData && csvData.length)
    return {
      head: csvData[0],
      rows: csvData.slice(1),
    };
  return null;
};

const getLogoImageData = ({ logoImage }): string => {
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = 548;
  logoCanvas.height = 112;
  const logoContext = logoCanvas.getContext('2d');
  logoContext?.drawImage(logoImage, 0, 0, 548, 112);
  const logoData = logoCanvas.toDataURL('image/png');
  return logoData;
};

const addTopFormatting = ({ doc, logoImage }) => {
  doc.setFillColor(17, 105, 249);
  doc.rect(0, 0, 210, 1, 'F');
  const logoData = getLogoImageData({ logoImage });
  doc.addImage(logoData, 'PNG', 12, 10, 70, 14);
};

const addTable = ({ imgHeight, position, doc, tableOptions, logoImage, autoTable }) => {
  if (tableOptions?.length) {
    const tableWidth = 180;
    tableOptions.map((table: TableOptions, index) => {
      // Add table title if available
      if (table.tableTitle) {
        doc.text(
          table.tableTitle,
          15,
          (index === 0 ? (imgHeight + position) % PAGE_HEIGHT : 0) +
            (doc.autoTable?.previous?.finalY ?? 0) +
            12,
        );
      }
      autoTable.default(doc, {
        ...(index === 0
          ? { startY: (imgHeight + position + 14) % PAGE_HEIGHT }
          : { startY: (doc.autoTable?.previous?.finalY ?? 0) + 16 }),
        tableWidth: tableWidth,
        margin: { top: 32, bottom: 12 },
        styles: {
          font: FONT_FAMILY_REGULAR,
          fontSize: 10,
          fontStyle: 'bold',
        },
        ...table.tableOptions,
        willDrawPage: () => {
          addTopFormatting({ doc, logoImage });
        },
        didDrawPage: () => {
          addPageNumber({ doc });
        },
      });
    });
  }
};

function addPageNumber({ doc }) {
  const pageNumber = doc.internal.getNumberOfPages();
  doc.text(`${pageNumber}`, 190, 290);
}

function addAndSetFonts(doc) {
  doc.setFont(FONT_FAMILY_SEMIBOLD);
  doc.setFontSize(12);
}
