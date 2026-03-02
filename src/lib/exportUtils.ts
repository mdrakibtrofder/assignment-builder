import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, TabStopPosition, TabStopType } from "docx";
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
  logoDataUrl?: string;
}

function getLogoDataUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    // Use the imported logo from assets
    const logoEl = document.querySelector('img[alt="BAUST Logo"]') as HTMLImageElement;
    if (logoEl) {
      const canvas = document.createElement("canvas");
      canvas.width = 80;
      canvas.height = 80;
      const ctx = canvas.getContext("2d")!;
      const tempImg = new window.Image();
      tempImg.crossOrigin = "anonymous";
      tempImg.onload = () => {
        ctx.drawImage(tempImg, 0, 0, 80, 80);
        resolve(canvas.toDataURL("image/png"));
      };
      tempImg.onerror = () => resolve("");
      tempImg.src = logoEl.src;
    } else {
      resolve("");
    }
  });
}

export async function exportToPDF(data: ExportData) {
  const logoDataUrl = await getLogoDataUrl();
  
  const container = document.createElement("div");
  container.style.width = "794px";
  container.style.padding = "40px";
  container.style.fontFamily = "Inter, Arial, sans-serif";
  container.style.background = "white";
  container.style.color = "#1a1a2e";
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";

  container.innerHTML = buildExportHtml(data, logoDataUrl);
  document.body.appendChild(container);

  // Wait for images to load
  const images = container.querySelectorAll("img");
  await Promise.all(
    Array.from(images).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );

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

  // Try to get logo as array buffer for DOCX
  let logoBuffer: ArrayBuffer | null = null;
  try {
    const logoDataUrl = await getLogoDataUrl();
    if (logoDataUrl) {
      const base64 = logoDataUrl.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      logoBuffer = bytes.buffer;
    }
  } catch {}

  // University header with logo
  const headerChildren: (TextRun | ImageRun)[] = [];
  if (logoBuffer) {
    headerChildren.push(
      new ImageRun({
        data: logoBuffer,
        transformation: { width: 50, height: 50 },
        type: "png",
      })
    );
    headerChildren.push(new TextRun({ text: "  ", size: 32 }));
  }
  headerChildren.push(
    new TextRun({ text: data.universityName, bold: true, size: 32, font: "Arial" })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: headerChildren,
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

  // Parse editor HTML properly
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = data.editorHtml;

  parseHtmlToDocxParagraphs(tempDiv, children);

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${data.courseName}_Assignment_${data.assignmentNo}.docx`);
}

function parseHtmlToDocxParagraphs(container: HTMLElement, children: Paragraph[]) {
  const nodes = container.childNodes;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        children.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text, size: 22, font: "Arial" })],
          })
        );
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Handle images
    if (tag === "img") {
      // Images in DOCX would need base64 conversion - skip for now, they show in PDF
      continue;
    }

    // Handle headings
    let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined;
    if (tag === "h1") heading = HeadingLevel.HEADING_1;
    else if (tag === "h2") heading = HeadingLevel.HEADING_2;
    else if (tag === "h3") heading = HeadingLevel.HEADING_3;
    else if (tag === "h4") heading = HeadingLevel.HEADING_4;
    else if (tag === "h5") heading = HeadingLevel.HEADING_5;
    else if (tag === "h6") heading = HeadingLevel.HEADING_6;

    // Handle lists
    if (tag === "ul" || tag === "ol") {
      const items = el.querySelectorAll("li");
      items.forEach((li, idx) => {
        const runs = parseInlineElements(li);
        const prefix = tag === "ol" ? `${idx + 1}. ` : "• ";
        runs.unshift(new TextRun({ text: prefix, size: 22, font: "Arial" }));
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            indent: { left: 720 },
            children: runs,
          })
        );
      });
      continue;
    }

    // Handle blockquote
    if (tag === "blockquote") {
      parseHtmlToDocxParagraphs(el, children);
      continue;
    }

    // Handle div/p/headings with inline content
    if (["p", "h1", "h2", "h3", "h4", "h5", "h6", "div"].includes(tag)) {
      // Check for images inside
      const imgs = el.querySelectorAll("img");
      if (imgs.length > 0) {
        // Add text content first
        const runs = parseInlineElements(el);
        if (runs.length > 0) {
          children.push(
            new Paragraph({
              heading,
              spacing: { after: 120 },
              children: runs,
            })
          );
        }
        // Images handled in PDF, skip for DOCX inline images
        continue;
      }

      const runs = parseInlineElements(el);
      if (runs.length > 0) {
        // Get alignment
        let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] | undefined;
        const style = el.getAttribute("style") || "";
        if (style.includes("text-align: center")) alignment = AlignmentType.CENTER;
        else if (style.includes("text-align: right")) alignment = AlignmentType.RIGHT;

        children.push(
          new Paragraph({
            heading,
            alignment,
            spacing: { after: 120 },
            children: runs,
          })
        );
      }
      continue;
    }

    // Handle pre/code blocks
    if (tag === "pre") {
      const codeText = el.textContent || "";
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({ text: codeText, font: "Courier New", size: 20 }),
          ],
        })
      );
      continue;
    }

    // Fallback: recurse
    parseHtmlToDocxParagraphs(el, children);
  }
}

function parseInlineElements(el: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];

  function walk(node: Node, parentBold: boolean, parentItalic: boolean, parentUnderline: boolean, parentStrike: boolean, parentColor?: string) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) {
        const runProps: any = {
          text,
          size: 22,
          font: "Arial",
          bold: parentBold || undefined,
          italics: parentItalic || undefined,
          underline: parentUnderline ? {} : undefined,
          strike: parentStrike || undefined,
        };
        if (parentColor) {
          runProps.color = parentColor.replace("#", "");
        }
        runs.push(new TextRun(runProps));
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const childEl = node as HTMLElement;
    const childTag = childEl.tagName.toLowerCase();

    // Skip img tags
    if (childTag === "img") return;

    let bold = parentBold;
    let italic = parentItalic;
    let underline = parentUnderline;
    let strike = parentStrike;
    let color = parentColor;

    if (childTag === "strong" || childTag === "b") bold = true;
    if (childTag === "em" || childTag === "i") italic = true;
    if (childTag === "u") underline = true;
    if (childTag === "s" || childTag === "del") strike = true;

    // Check for inline style color
    const style = childEl.getAttribute("style") || "";
    const colorMatch = style.match(/color:\s*([^;]+)/);
    if (colorMatch) {
      color = colorMatch[1].trim();
      // Convert rgb to hex if needed
      const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
        const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
        const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
        color = `#${r}${g}${b}`;
      }
    }

    // If it's a span or mark with style, just pass through
    for (let i = 0; i < childEl.childNodes.length; i++) {
      walk(childEl.childNodes[i], bold, italic, underline, strike, color);
    }
  }

  for (let i = 0; i < el.childNodes.length; i++) {
    walk(el.childNodes[i], false, false, false, false);
  }

  return runs;
}

function buildExportHtml(data: ExportData, logoDataUrl?: string): string {
  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: contain; margin-right: 16px; border: 1px solid #e0e0e0;" />`
    : "";

  return `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px;">
        ${logoHtml}
        <div>
          <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 4px 0;">${data.universityName}</h1>
          <p style="font-size: 16px; color: #555; margin: 0;">Department of ${data.department}</p>
        </div>
      </div>
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
