import type { UserOptions } from 'jspdf-autotable';
import type { jsPDF } from 'jspdf';
import { getBranding } from '@/utils/branding';
import { notNullish } from '@/utils/array';

interface Props {
  pdfRef?: HTMLElement | HTMLElement[];
  fileName: string;
  reportTitle?: string;
  tableOptions?: TableOptions[];
  onCustomPdfGeneration?: (doc: jsPDF) => number;
  orientation?: 'portrait' | 'landscape' | 'auto';
}

export interface TableOptions {
  tableOptions: UserOptions;
  tableTitle?: string;
}

interface ExtractedTableData {
  headers: string[];
  rows: string[][];
  title: string;
  element: HTMLElement;
  boundingRect: DOMRect;
}

// Note: PAGE_WIDTH and PAGE_HEIGHT are now calculated dynamically based on orientation
export const FONT_FAMILY_REGULAR = 'NotoSans-Regular';
export const FONT_FAMILY_SEMIBOLD = 'NotoSans-SemiBold';

const extractNativeTables = (elements: HTMLElement[]): ExtractedTableData[] => {
  const tables: ExtractedTableData[] = [];

  elements.forEach((element) => {
    const nativeTables = element.querySelectorAll('[data-native-table="true"]');
    nativeTables.forEach((tableElement) => {
      const htmlElement = tableElement as HTMLElement;
      const tableDataStr = htmlElement.getAttribute('data-table-data');
      if (tableDataStr) {
        try {
          const tableData = JSON.parse(tableDataStr);
          const boundingRect = htmlElement.getBoundingClientRect();

          tables.push({
            headers: tableData.headers || [],
            rows: tableData.rows || [],
            title: '',
            element: htmlElement,
            boundingRect,
          });
        } catch (error) {
          console.warn('Failed to parse table data:', error);
        }
      }
    });
  });

  return tables;
};

interface RenderNativeTablesParams {
  doc: jsPDF;
  tables: ExtractedTableData[];
  input: HTMLElement;
  currentPageY: number;
  pageWidth: number;
  pageHeight: number;
  pageStartPosition: number;
  pageIndex: number;
  autoTable: any;
  logoImage: HTMLImageElement;
}

const renderNativeTablesForPage = (params: RenderNativeTablesParams) => {
  const {
    doc,
    tables,
    input,
    currentPageY,
    pageWidth,
    pageHeight,
    pageStartPosition,
    pageIndex,
    autoTable,
    logoImage,
  } = params;
  for (const table of tables) {
    if (table.headers.length > 0 && table.rows.length > 0) {
      const inputRect = input.getBoundingClientRect();
      const relativeY = table.boundingRect.top - inputRect.top;
      const scaledRelativeY = (relativeY * pageWidth) / inputRect.width;

      const pageContentHeight = pageHeight - pageStartPosition;
      const pageBreakY = pageIndex * pageContentHeight;

      if (scaledRelativeY >= pageBreakY && scaledRelativeY < pageBreakY + pageContentHeight) {
        const calculatedY = currentPageY + (scaledRelativeY - pageBreakY);
        const tableY = Math.max(calculatedY, 30); // Ensure minimum 30mm spacing from header

        if (table.title) {
          doc.setFontSize(12);
          doc.setFont(FONT_FAMILY_SEMIBOLD);
          doc.text(table.title, 15, Math.max(tableY - 2, 30)); // Consistent with header spacing
        }

        const isWideTable = table.headers.length > 8;
        const isVeryWideTable = table.headers.length > 12;

        const currentPageWidth = doc.internal.pageSize.getWidth() - 20;

        let tableSettings;
        if (isVeryWideTable) {
          tableSettings = {
            tableWidth: 'auto',
            margin: { left: 10, right: 10 },
            halign: 'center',
            styles: {
              font: FONT_FAMILY_REGULAR,
              fontSize: 6,
              cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
              overflow: 'linebreak',
              lineWidth: 0.1,
              halign: 'left',
              valign: 'middle',
              lineColor: [200, 200, 200],
            },
            headStyles: {
              fillColor: [245, 245, 245],
              textColor: [0, 0, 0],
              fontStyle: 'bold',
              fontSize: 6,
              halign: 'left',
              valign: 'middle',
              cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
            },
            columnStyles: {},
          };

          const availableWidth = Math.max(60, currentPageWidth - 40); // Ensure minimum usable width
          const minColumnWidth = 12;
          const maxColumnWidth = availableWidth / 2; // Prevent columns from being too wide
          table.headers.forEach((_, index) => {
            const calculatedWidth = availableWidth / table.headers.length;
            tableSettings.columnStyles[index] = {
              cellWidth: Math.min(Math.max(minColumnWidth, calculatedWidth), maxColumnWidth),
              overflow: 'linebreak',
              halign: 'left',
            };
          });
        } else if (isWideTable) {
          tableSettings = {
            tableWidth: 'auto',
            margin: { left: 10, right: 10 },
            halign: 'center',
            styles: {
              font: FONT_FAMILY_REGULAR,
              fontSize: 7,
              cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
              overflow: 'linebreak',
              halign: 'left',
              valign: 'middle',
              lineColor: [200, 200, 200],
            },
            headStyles: {
              fillColor: [245, 245, 245],
              textColor: [0, 0, 0],
              fontStyle: 'bold',
              fontSize: 7,
              halign: 'left',
              valign: 'middle',
              cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
            },
            columnStyles: {},
          };

          const availableWidth = Math.max(80, currentPageWidth - 40); // Ensure minimum usable width
          const minColumnWidth = 18;
          const maxColumnWidth = availableWidth / 2; // Prevent columns from being too wide
          table.headers.forEach((_, index) => {
            const calculatedWidth = availableWidth / table.headers.length;
            tableSettings.columnStyles[index] = {
              cellWidth: Math.min(Math.max(minColumnWidth, calculatedWidth), maxColumnWidth),
              overflow: 'linebreak',
              halign: 'left',
            };
          });
        } else {
          tableSettings = {
            tableWidth: 'auto',
            margin: { left: 10, right: 10 },
            halign: 'center',
            styles: {
              font: FONT_FAMILY_REGULAR,
              fontSize: 9,
              cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
              halign: 'left',
              valign: 'middle',
              lineColor: [200, 200, 200],
            },
            headStyles: {
              fillColor: [245, 245, 245],
              textColor: [0, 0, 0],
              fontStyle: 'bold',
              halign: 'left',
              valign: 'middle',
              cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
            },
          };
        }

        try {
          const maxTableWidth = Math.min(
            currentPageWidth - 40,
            doc.internal.pageSize.getWidth() - 40,
          );
          const totalPageWidth = doc.internal.pageSize.getWidth();
          const leftMargin = (totalPageWidth - maxTableWidth) / 2;

          // Add safety checks for table dimensions
          const finalTableSettings = {
            startY: tableY,
            head: [table.headers],
            body: table.rows,
            theme: 'grid',
            ...tableSettings,
            margin: {
              left: leftMargin,
              right: leftMargin,
              top: 35,
            },
            tableWidth: 'auto',
            halign: 'center',
            didDrawPage: (data) => {
              if (data.pageNumber > 1) {
                addTopFormatting(doc, logoImage, 'landscape');
              }
            },
          };

          (autoTable as any).default(doc, finalTableSettings);
        } catch (error) {
          console.error('Error rendering native table:', error);
          // Skip this table and continue with others
          continue;
        }
      }
    }
  }
};

const DownloadAsPDF = async (props: Props) => {
  await import('./NotoSans-Regular');
  await import('./NotoSans-SemiBold');
  const {
    pdfRef,
    fileName,
    tableOptions,
    reportTitle,
    onCustomPdfGeneration,
    orientation: orientationProp = 'auto',
  } = props;

  const inputArray = (Array.isArray(pdfRef) ? pdfRef : [pdfRef]).filter(notNullish);

  // Extract native table data and hide HTML tables to prevent pagination issues
  const extractedTables = extractNativeTables(inputArray);
  extractedTables.forEach((table) => {
    table.element.style.display = 'none';
  });

  try {
    const Logo = getBranding().logoDark;
    const logoImage = new Image();
    logoImage.src = Logo;

    await new Promise((resolve, reject) => {
      logoImage.onload = resolve;
      logoImage.onerror = reject;
    });

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    let imgHeight = 0;

    let orientation: 'portrait' | 'landscape';
    if (orientationProp === 'auto') {
      orientation = 'portrait';
    } else {
      orientation = orientationProp;
    }

    const doc = new jsPDF(orientation, 'mm');

    const pageWidth = doc.internal.pageSize.getWidth() - 20;
    const pageHeight = doc.internal.pageSize.getHeight() - 20;

    let position = 20;
    addAndSetFonts(doc);

    addTopFormatting(doc, logoImage, orientation);
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
          addTopFormatting(doc, logoImage, orientation);
          position = 0;
        }
        position += reportTitle ? 16 : 0;

        const canvas = await html2canvas(input);
        const imgData = canvas.toDataURL('image/png');
        imgHeight = (canvas.height * pageWidth) / canvas.width;

        // Filter tables for this input element
        const pageTables = extractedTables.filter((table) => input.contains(table.element));

        // Add the first page
        const currentPageY = position;
        doc.addImage(imgData, 'PNG', 10, position, pageWidth, imgHeight);
        renderNativeTablesForPage({
          doc,
          tables: pageTables,
          input,
          currentPageY: currentPageY,
          pageWidth,
          pageHeight,
          pageStartPosition: position,
          pageIndex: 0,
          autoTable,
          logoImage,
        });
      }
    }

    let tableStartY = position;
    if (onCustomPdfGeneration) {
      const customY = onCustomPdfGeneration(doc);
      if (customY) {
        tableStartY = customY;
      }
    }

    // Add table if data is available
    addTable({ position: tableStartY, doc, tableOptions, logoImage, autoTable });

    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addTopFormatting(doc, logoImage, orientation);
      doc.setFontSize(10);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.text(`${i}`, pageWidth - 20, pageHeight - 5);
    }

    doc.save(fileName);
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    // Restore table visibility
    extractedTables.forEach((table) => {
      table.element.style.display = '';
    });
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
  logoCanvas.width = 2192;
  logoCanvas.height = 448;
  const logoContext = logoCanvas.getContext('2d');
  logoContext?.drawImage(logoImage, 0, 0, 2192, 448);
  const logoData = logoCanvas.toDataURL('image/png');
  return logoData;
};

const addTopFormatting = (
  doc: jsPDF,
  logoImage: HTMLImageElement,
  _orientation: 'portrait' | 'landscape',
) => {
  doc.setFillColor(17, 105, 249);
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.rect(0, 0, pageWidth, 1, 'F');
  const logoData = getLogoImageData(logoImage);
  const LOGO_HEIGHT = 14;
  const scaleRatio = LOGO_HEIGHT / logoImage.height;
  doc.addImage(logoData, 'PNG', 12, 10, logoImage.width * scaleRatio, LOGO_HEIGHT);
};

const addTable = ({
  position,
  doc,
  tableOptions,
  logoImage,
  autoTable,
}: {
  position: number;
  doc: jsPDF;
  tableOptions?: TableOptions[];
  logoImage: HTMLImageElement;
  autoTable: any;
}) => {
  if (tableOptions?.length) {
    const tableWidth = 180;
    tableOptions.map((table: TableOptions, index) => {
      if (table.tableTitle) {
        doc.text(
          table.tableTitle,
          15,
          index === 0 ? position + 12 : ((doc as any).autoTable?.previous?.finalY ?? 0) + 12,
        );
      }
      autoTable.default(doc, {
        ...(index === 0
          ? { startY: position + 14 }
          : { startY: ((doc as any).autoTable?.previous?.finalY ?? 0) + 16 }),
        tableWidth: tableWidth,
        margin: { top: 40, left: 15, right: 15, bottom: 12 },
        styles: {
          font: FONT_FAMILY_REGULAR,
          fontSize: 10,
          fontStyle: 'bold',
        },
        ...table.tableOptions,
        willDrawPage: () => {
          addTopFormatting(doc, logoImage, 'portrait');
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
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.text(`${pageNumber}`, pageWidth - 20, pageHeight - 5);
}

function addAndSetFonts(doc: jsPDF) {
  doc.setFont(FONT_FAMILY_SEMIBOLD);
  doc.setFontSize(12);
}
