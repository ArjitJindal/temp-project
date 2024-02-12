import FlagrightDemoLogoSvg from '@/branding/flagright-logo-demo.svg';

interface Props {
  pdfRef: React.MutableRefObject<HTMLInputElement>;
  fileName: string;
  data?: string;
  tableTitle?: string;
}

const PAGE_WIDTH = 190;
const PAGE_HEIGHT = 295;

const DownloadAsPDF = async (props: Props) => {
  const { pdfRef, fileName, data, tableTitle } = props;
  try {
    const input = pdfRef.current;
    const logoImage = new Image();
    logoImage.src = FlagrightDemoLogoSvg;

    const { default: html2canvas } = await import('html2canvas');
    const { default: jsPDF } = await import('jspdf');

    const canvas = await html2canvas(input);

    const imgData = canvas.toDataURL('image/png');
    const imgHeight = (canvas.height * PAGE_WIDTH) / canvas.width;
    let heightLeft = imgHeight;
    const doc = new jsPDF('p', 'mm');
    let position = 30;

    addTopFormatting({ doc, logoImage });

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

    // Add table title if available
    if (tableTitle) {
      doc.setFontSize(12);
      doc.text(tableTitle, 15, position + imgHeight + 7);
    }
    // Add table if data is available
    addTable({ imgHeight, position, doc, data });

    doc.save(fileName);
  } catch (err) {
    console.error(err);
  }
};

export default DownloadAsPDF;

const getTableHeadAndBody = (data?: string) => {
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

  doc.addImage(getLogoImageData({ logoImage }), 'PNG', 10, 10, 70, 14);
};

const addTable = async ({ imgHeight, position, doc, data }) => {
  const tableData = getTableHeadAndBody(data);
  if (tableData) {
    const tableWidth = 180;
    const { default: autoTable } = await import('jspdf-autotable');
    autoTable(doc, {
      head: [tableData.head],
      body: tableData.rows,
      startY: (imgHeight + position + 10) % PAGE_HEIGHT,
      tableWidth: tableWidth,
      headStyles: { fillColor: [245, 245, 245], textColor: [38, 38, 38], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      bodyStyles: { fillColor: [245, 245, 245] },
      didParseCell: (data) => {
        switch (data.cell.text[0]) {
          case 'VERY_HIGH': {
            data.cell.styles.textColor = [245, 34, 45];
            break;
          }
          case 'HIGH': {
            data.cell.styles.textColor = [250, 140, 22];
            break;
          }
          case 'MEDIUM': {
            data.cell.styles.textColor = [245, 226, 90];
            break;
          }
          case 'LOW': {
            data.cell.styles.textColor = [82, 196, 26];
            break;
          }
          case 'VERY_LOW': {
            data.cell.styles.textColor = [173, 198, 255];
            break;
          }
        }
      },
    });
  }
};
