import type { ContractAnalysisResult } from '../../../types/contractAnalysis';

export async function exportAnalysisToPdf(
  element: HTMLElement,
  documentName: string,
  organisationName?: string
): Promise<void> {
  // Dynamic imports for client-side only
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas')
  ]);

  // Temporarily hide buttons for cleaner PDF
  const buttons = element.querySelectorAll('button');
  const originalButtonStyles: Array<{ display: string }> = [];
  buttons.forEach((btn) => {
    originalButtonStyles.push({ display: (btn as HTMLElement).style.display });
    (btn as HTMLElement).style.display = 'none';
  });

  try {
    // Capture the entire analysis section as canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: '#171717', // Dark background to match UI
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      allowTaint: true,
      onclone: (clonedDoc) => {
        // Ensure all styles are applied in the cloned document
        const clonedElement = clonedDoc.querySelector('[data-export-section]') as HTMLElement;
        if (clonedElement) {
          clonedElement.style.transform = 'none';
          clonedElement.style.position = 'static';
          // Hide buttons in cloned document too
          const clonedButtons = clonedElement.querySelectorAll('button');
          clonedButtons.forEach((btn) => {
            (btn as HTMLElement).style.display = 'none';
          });
        }
      }
    });

    // Calculate PDF dimensions
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth; // Maintain aspect ratio
    const pageHeight = 297; // A4 height in mm

    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = pdfHeight;
    let position = 0;

    // Add first page
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    // Generate filename
    const safeDocName = (documentName || 'document').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `contract-analysis-${safeDocName}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Save PDF
    pdf.save(filename);
  } finally {
    // Restore button visibility
    buttons.forEach((btn, idx) => {
      (btn as HTMLElement).style.display = originalButtonStyles[idx]?.display || '';
    });
  }
}

