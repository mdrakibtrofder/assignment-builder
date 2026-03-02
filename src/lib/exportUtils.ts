import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface ExportData {
  universityName: string;
  department: string;
  courseCode: string;
  courseName: string;
  studentName: string;
  studentId: string;
  assignmentNo: string;
  date: string;
  editorHtml: string;
}

export async function exportToPDF(data: ExportData) {
  const container = document.createElement("div");
  container.style.width = "794px";
  container.style.padding = "40px";
  container.style.fontFamily = "Inter, Arial, sans-serif";
  container.style.background = "white";
  container.style.color = "#1a1a2e";
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";

  container.innerHTML = buildExportHtml(data);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(`${data.courseName}_Assignment_${data.assignmentNo}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportToDocx(data: ExportData) {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: data.universityName, bold: true, size: 32, font: "Arial" }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `Department of ${data.department}`, size: 24, font: "Arial" }),
      ],
    })
  );

  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  const infoLines = [
    { label: "Course Code", value: data.courseCode },
    { label: "Course Name", value: data.courseName },
    { label: "Student Name", value: data.studentName },
    { label: "Student ID", value: data.studentId },
    { label: "Assignment No", value: data.assignmentNo },
    { label: "Date", value: data.date },
  ];

  for (const info of infoLines) {
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: `${info.label}: `, bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: info.value, size: 22, font: "Arial" }),
        ],
      })
    );
  }

  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  // Parse editor HTML to simple text paragraphs
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = data.editorHtml;
  const elements = tempDiv.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote");

  if (elements.length > 0) {
    elements.forEach((el) => {
      const tag = el.tagName.toLowerCase();
      let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined;
      if (tag === "h1") heading = HeadingLevel.HEADING_1;
      else if (tag === "h2") heading = HeadingLevel.HEADING_2;
      else if (tag === "h3") heading = HeadingLevel.HEADING_3;
      else if (tag === "h4") heading = HeadingLevel.HEADING_4;
      else if (tag === "h5") heading = HeadingLevel.HEADING_5;
      else if (tag === "h6") heading = HeadingLevel.HEADING_6;

      const textContent = el.textContent || "";
      const isBold = el.querySelector("strong") !== null;
      const isItalic = el.querySelector("em") !== null;

      children.push(
        new Paragraph({
          heading,
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: textContent,
              bold: isBold,
              italics: isItalic,
              size: heading ? undefined : 22,
              font: "Arial",
            }),
          ],
        })
      );
    });
  } else {
    // Fallback: just add innerText
    children.push(
      new Paragraph({
        children: [new TextRun({ text: tempDiv.innerText, size: 22, font: "Arial" })],
      })
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${data.courseName}_Assignment_${data.assignmentNo}.docx`);
}

function buildExportHtml(data: ExportData): string {
  return `
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 4px 0;">${data.universityName}</h1>
      <p style="font-size: 16px; color: #555; margin: 0;">Department of ${data.department}</p>
    </div>
    <hr style="border: none; border-top: 2px solid #2563eb; margin: 16px 0;" />
    <table style="width: 100%; font-size: 14px; margin-bottom: 24px; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; font-weight: 600; width: 140px;">Course Code:</td><td style="padding: 6px 0;">${data.courseCode}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600;">Course Name:</td><td style="padding: 6px 0;">${data.courseName}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600;">Student Name:</td><td style="padding: 6px 0;">${data.studentName}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600;">Student ID:</td><td style="padding: 6px 0;">${data.studentId}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600;">Assignment No:</td><td style="padding: 6px 0;">${data.assignmentNo}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600;">Date:</td><td style="padding: 6px 0;">${data.date}</td></tr>
    </table>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 16px 0;" />
    <div style="font-size: 14px; line-height: 1.7;">
      ${data.editorHtml}
    </div>
  `;
}
