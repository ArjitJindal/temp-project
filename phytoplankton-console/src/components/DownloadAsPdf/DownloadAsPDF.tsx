import type { UserOptions } from 'jspdf-autotable';
import type { jsPDF } from 'jspdf';
import { getBranding } from '@/utils/branding';
import { notNullish } from '@/utils/array';

interface Props {
  pdfRef?: HTMLElement | HTMLElement[];
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
  const inputArray = (Array.isArray(pdfRef) ? pdfRef : [pdfRef]).filter(notNullish);
  try {
    const Logo = getBranding().logoDark;
    const logoImage = new Image();
    logoImage.src = Logo;

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

    addTopFormatting(doc, logoImage);
    if (reportTitle) {
      doc.setFontSize(16);
      doc.text(reportTitle, 15, position + 7);
      doc.setFontSize(12);
    }

    if (inputArray.length > 0) {
      const { default: html2canvas } = await import('html2canvas');
      for (let i = 0; i < inputArray.length; i++) {
        const input = inputArray[i];
        if (i > 0) {
          doc.addPage();
          position = 0;
        }
        position += reportTitle ? 16 : 0;
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

  if (csvData && csvData.length) {
    return {
      head: csvData[0],
      rows: csvData.slice(1),
    };
  }
  return null;
};

const getLogoImageData = (logoImage: HTMLImageElement): string => {
  const logoCanvas = document.createElement('canvas');
  // logoCanvas.width = 548;
  // logoCanvas.height = 112;
  logoCanvas.width = 2192;
  logoCanvas.height = 448;
  const logoContext = logoCanvas.getContext('2d');
  logoContext?.drawImage(logoImage, 0, 0, 2192, 448);
  const logoData = logoCanvas.toDataURL('image/png');
  return logoData;
};

const addTopFormatting = (doc: jsPDF, logoImage: HTMLImageElement) => {
  doc.setFillColor(17, 105, 249);
  doc.rect(0, 0, 210, 1, 'F');
  const logoData = getLogoImageData(logoImage);
  const LOGO_HEIGHT = 14;
  const scaleRatio = LOGO_HEIGHT / logoImage.height;
  doc.addImage(logoData, 'PNG', 12, 10, logoImage.width * scaleRatio, LOGO_HEIGHT);
};

const addTable = ({
  imgHeight,
  position,
  doc,
  tableOptions,
  logoImage,
  autoTable,
}: {
  imgHeight: number;
  position: number;
  doc: jsPDF;
  tableOptions?: TableOptions[];
  logoImage: HTMLImageElement;
  autoTable: any;
}) => {
  if (tableOptions?.length) {
    const tableWidth = 180;
    tableOptions.map((table: TableOptions, index) => {
      // Add table title if available
      if (table.tableTitle) {
        doc.text(
          table.tableTitle,
          15,
          (index === 0 ? (imgHeight + position) % PAGE_HEIGHT : 0) +
            ((doc as any).autoTable?.previous?.finalY ?? 0) +
            12,
        );
      }
      autoTable.default(doc, {
        ...(index === 0
          ? { startY: (imgHeight + position + 14) % PAGE_HEIGHT }
          : { startY: ((doc as any).autoTable?.previous?.finalY ?? 0) + 16 }),
        tableWidth: tableWidth,
        margin: { top: 32, bottom: 12 },
        styles: {
          font: FONT_FAMILY_REGULAR,
          fontSize: 10,
          fontStyle: 'bold',
        },
        ...table.tableOptions,
        willDrawPage: () => {
          addTopFormatting(doc, logoImage);
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

function addAndSetFonts(doc: jsPDF) {
  doc.setFont(FONT_FAMILY_SEMIBOLD);
  doc.setFontSize(12);
}
