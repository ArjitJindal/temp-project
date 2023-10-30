import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import FlagrightDemoLogoSvg from '@/branding/flagright-logo-demo.svg';

interface Props {
  pdfRef: React.MutableRefObject<HTMLInputElement>;
  fileName: string;
  data?: string;
}

const PAGE_WIDTH = 190;
const PAGE_HEIGHT = 295;

const DownloadAsPDF = async (props: Props) => {
  const { pdfRef, fileName, data } = props;
  try {
    const input = pdfRef.current;
    const logoImage = new Image();
    logoImage.src = FlagrightDemoLogoSvg;

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

const addTable = ({ imgHeight, position, doc, data }) => {
  const tableData = getTableHeadAndBody(data);
  if (tableData) {
    const tableWidth = 180;
    autoTable(doc, {
      head: [tableData.head],
      body: tableData.rows,
      startY: (imgHeight + position + 10) % PAGE_HEIGHT,
      tableWidth: tableWidth,
    });
  }
};
