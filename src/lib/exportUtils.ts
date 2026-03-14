import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { LogicGatesData } from "@/components/LogicGatesBuilder";

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
  logicGatesData?: LogicGatesData;
}

function getLogoDataUrl(): Promise<string> {
  return new Promise((resolve) => {
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

const GATE_NAMES = ["AND", "OR", "NOT", "NAND", "NOR", "X-OR"] as const;

// SVG strings for gate symbols (for export rendering)
const GATE_SVG_STRINGS: Record<string, string> = {
  AND: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">
    <path d="M10,10 L50,10 Q100,10 100,40 Q100,70 50,70 L10,70 Z" fill="none" stroke="#1a1a2e" stroke-width="3"/>
    <line x1="0" y1="25" x2="10" y2="25" stroke="#1a1a2e" stroke-width="2"/>
    <line x1="0" y1="55" x2="10" y2="55" stroke="#1a1a2e" stroke-width="2"/>
    <line x1="100" y1="40" x2="120" y2="40" stroke="#1a1a2e" stroke-width="2"/>
    <text x="2" y="22" font-size="8" fill="#1a1a2e">A</text>
    <text x="2" y="52" font-size="8" fill="#1a1a2e">B</text>
    <text x="108" y="37" font-size="8" fill="#1a1a2e">Y</text>
  </svg>`,
  OR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">
    <path d="M10,10 Q30,10 60,10 Q95,10 105,40 Q95,70 60,70 Q30,70 10,70 Q30,40 10,10 Z" fill="none" stroke="#1a1a2e" stroke-width="3"/>
    <line x1="0" y1="25" x2="20" y2="25" stroke="#1a1a2e" stroke-width="2"/>
    <line x1="0" y1="55" x2="20" y2="55" stroke="#1a1a2e" stroke-width="2"/>
    <line x1="105" y1="40" x2="120" y2="40" stroke="#1a1a2e" stroke-width="2"/>
    <text x="2" y="22" font-size="8" fill="#1a1a2e">A</text>
    <text x="2" y="52" font-size="8" fill="#1a1a2e">B</text>
    <text x="108" y="37" font-size="8" fill="#1a1a2e">Y</text>
  </svg>`,
  NOT: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">
    <polygon points="10,10 90,40 10,70" fill="none" stroke="#1a1a2e" stroke-width="3"/>
    <circle cx="96" cy="40" r="6" fill="none" stroke="#1a1a2e" stroke-width="3"/>
    <line x1="0" y1="40" x2="10" y2="40" stroke="#1a1a2e" stroke-width="2"/>
    <line x1="102" y1="40" x2="120" y2="40" stroke="#1a1a2e" stroke-width="2"/>
    <text x="2" y="37" font-size="8" fill="#1a1a2e">A</text>
    <text x="108" y="37" font-size="8" fill="#1a1a2e">Y</text>
  </svg>`,
  NAND: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">
    <path d="M10,10 L50,10 Q95,10 95,40 Q95,70 50,70 L10,70 Z" fill="none" stroke="#1a1a2e" stroke-width="3"/>
    <circle cx="101" cy="40" r="6" fill="none" stroke="#1a1a2e" stroke-width="3"/>
    <line x1="0" y1="25" x2="10" y2="25" stroke="#1a1a2e" stroke-width="2"/>
    <line x1="0" y1="55" x2="10" y2="55" stroke="#1a1a2e" stroke-width="2"/>
    <line x1="107" y1="40" x2="120" y2="40" stroke="#1a1a2e" stroke-width="2"/>
    <text x="2" y="22" font-size="8" fill="#1a1a2e">A</text>
    <text x="2" y="52" font-size="8" fill="#1a1a2e">B</text>
    <text x="110" y="37" font-size="8" fill="#1a1a2e">Y</text>
  </svg>`,
  NOR: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">
    <path d="M10,10 Q30,10 60,10 Q90,10 100,40 Q90,70 60,70 Q30,70 10,70 Q30,40 10,10 Z" fill="none" stroke="#1a1a2e" stroke-width="3"/>
    <circle cx="106" cy="40" r="6" fill="none" stroke="#1a1a2e" stroke-width="3"/>
    <line x1="0" y1="25" x2="20" y2="25" stroke="#1a1a2e" stroke-width="2"/>
    <line x1="0" y1="55" x2="20" y2="55" stroke="#1a1a2e" stroke-width="2"/>
    <line x1="112" y1="40" x2="120" y2="40" stroke="#1a1a2e" stroke-width="2"/>
    <text x="2" y="22" font-size="8" fill="#1a1a2e">A</text>
    <text x="2" y="52" font-size="8" fill="#1a1a2e">B</text>
    <text x="113" y="37" font-size="8" fill="#1a1a2e">Y</text>
  </svg>`,
  "X-OR": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">
    <path d="M15,10 Q35,10 65,10 Q100,10 110,40 Q100,70 65,70 Q35,70 15,70 Q35,40 15,10 Z" fill="none" stroke="#1a1a2e" stroke-width="3"/>
    <path d="M8,10 Q28,40 8,70" fill="none" stroke="#1a1a2e" stroke-width="3"/>
    <line x1="0" y1="25" x2="22" y2="25" stroke="#1a1a2e" stroke-width="2"/>
    <line x1="0" y1="55" x2="22" y2="55" stroke="#1a1a2e" stroke-width="2"/>
    <line x1="110" y1="40" x2="120" y2="40" stroke="#1a1a2e" stroke-width="2"/>
    <text x="2" y="22" font-size="8" fill="#1a1a2e">A</text>
    <text x="2" y="52" font-size="8" fill="#1a1a2e">B</text>
    <text x="113" y="37" font-size="8" fill="#1a1a2e">Y</text>
  </svg>`,
};

function svgToDataUrl(svgString: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
}

async function svgToPngBuffer(svgString: string, width = 240, height = 160): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) {
          blob.arrayBuffer().then(resolve);
        } else {
          resolve(null);
        }
      }, "image/png");
    };
    img.onerror = () => resolve(null);
    img.src = svgToDataUrl(svgString);
  });
}

const GATE_EQUATIONS: Record<string, string> = {
  AND: "Y = A · B",
  OR: "Y = A + B",
  NOT: "Y = A̅ (or Y = ~A)",
  NAND: "Y = (A · B)̅",
  NOR: "Y = (A + B)̅",
  "X-OR": "Y = A ⊕ B",
};

function buildLogicGatesHtml(data: LogicGatesData): string {
  let html = '<div style="margin-top: 16px;">';
  html += '<h2 style="font-size: 20px; font-weight: 700; margin-bottom: 16px; text-align: center; color: #2563eb;">Logic Gates Assignment</h2>';

  for (const gate of GATE_NAMES) {
    const section = data[gate];
    html += `<div style="margin-bottom: 24px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">`;
    html += `<h3 style="font-size: 17px; font-weight: 600; margin-bottom: 12px; color: #1a1a2e;">${gate} Gate</h3>`;

    if (section.selectedSymbol) {
      const svgStr = GATE_SVG_STRINGS[section.selectedSymbol];
      if (svgStr) {
        const dataUrl = svgToDataUrl(svgStr);
        html += `<p style="margin-bottom: 6px;"><strong>Symbol:</strong></p>`;
        html += `<div style="margin-bottom: 12px;"><img src="${dataUrl}" style="width: 150px; height: 100px;" /></div>`;
      }
    }
    if (section.selectedEquation) {
      html += `<p style="margin-bottom: 12px;"><strong>Boolean Expression:</strong> <span style="font-family: monospace; font-size: 15px;">${section.selectedEquation}</span></p>`;
    }

    // Truth table
    const cols = section.inputType === "two" ? ["Input A", "Input B", "Output Y"] : ["Input A", "Output Y"];
    html += `<table style="border-collapse: collapse; width: 100%; max-width: 400px; margin-top: 8px;">`;
    html += `<thead><tr>`;
    for (const col of cols) {
      html += `<th style="border: 1px solid #ccc; padding: 6px 12px; background: #f3f4f6; text-align: center; font-weight: 600; font-size: 13px;">${col}</th>`;
    }
    html += `</tr></thead><tbody>`;
    for (const row of section.truthTable) {
      html += `<tr>`;
      for (const cell of row) {
        html += `<td style="border: 1px solid #ccc; padding: 6px 12px; text-align: center; font-size: 13px;">${cell || ""}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    html += `</div>`;
  }
  html += "</div>";
  return html;
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

  const contentHtml = data.logicGatesData
    ? buildLogicGatesHtml(data.logicGatesData)
    : data.editorHtml;

  container.innerHTML = buildExportHtml(data, logoDataUrl, contentHtml);
  document.body.appendChild(container);

  // Wait for all images (including SVG data URLs) to load
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

  // Small delay for rendering
  await new Promise((r) => setTimeout(r, 100));

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
        new TextRun({ text: data.department, size: 24, font: "Arial" }),
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

  if (data.logicGatesData) {
    // Logic gates content for DOCX
    const allElements: (Paragraph | DocxTable)[] = [...children];

    allElements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({ text: "Logic Gates Assignment", bold: true, size: 28, font: "Arial" }),
        ],
      })
    );

    for (const gate of GATE_NAMES) {
      const section = data.logicGatesData[gate];

      allElements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 300, after: 100 },
          children: [
            new TextRun({ text: `${gate} Gate`, bold: true, size: 24, font: "Arial" }),
          ],
        })
      );

      // Render gate symbol as image in DOCX
      if (section.selectedSymbol) {
        const svgStr = GATE_SVG_STRINGS[section.selectedSymbol];
        if (svgStr) {
          const pngBuf = await svgToPngBuffer(svgStr, 240, 160);
          if (pngBuf) {
            allElements.push(
              new Paragraph({
                spacing: { after: 80 },
                children: [
                  new TextRun({ text: "Symbol: ", bold: true, size: 22, font: "Arial" }),
                ],
              })
            );
            allElements.push(
              new Paragraph({
                spacing: { after: 120 },
                children: [
                  new ImageRun({
                    data: pngBuf,
                    transformation: { width: 180, height: 120 },
                    type: "png",
                  }),
                ],
              })
            );
          }
        }
      }

      if (section.selectedEquation) {
        allElements.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: "Boolean Expression: ", bold: true, size: 22, font: "Arial" }),
              new TextRun({ text: section.selectedEquation, size: 22, font: "Courier New" }),
            ],
          })
        );
      }

      // Truth table
      const headers = section.inputType === "two"
        ? ["Input A", "Input B", "Output Y"]
        : ["Input A", "Output Y"];

      const borderStyle = {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "999999",
      };
      const borders = {
        top: borderStyle,
        bottom: borderStyle,
        left: borderStyle,
        right: borderStyle,
      };

      const table = new DocxTable({
        width: { size: 60, type: WidthType.PERCENTAGE },
        rows: [
          new DocxTableRow({
            children: headers.map(
              (h) =>
                new DocxTableCell({
                  borders,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({ text: h, bold: true, size: 20, font: "Arial" }),
                      ],
                    }),
                  ],
                })
            ),
          }),
          ...section.truthTable.map(
            (row) =>
              new DocxTableRow({
                children: row.map(
                  (cell) =>
                    new DocxTableCell({
                      borders,
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: cell || "", size: 20, font: "Arial" }),
                          ],
                        }),
                      ],
                    })
                ),
              })
          ),
        ],
      });

      allElements.push(table);
      allElements.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    }

    const doc = new Document({
      sections: [{ children: allElements }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${data.courseName}_Assignment_${data.assignmentNo}.docx`);
    return;
  }

  // Regular editor content
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

    if (tag === "img") continue;

    let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined;
    if (tag === "h1") heading = HeadingLevel.HEADING_1;
    else if (tag === "h2") heading = HeadingLevel.HEADING_2;
    else if (tag === "h3") heading = HeadingLevel.HEADING_3;
    else if (tag === "h4") heading = HeadingLevel.HEADING_4;
    else if (tag === "h5") heading = HeadingLevel.HEADING_5;
    else if (tag === "h6") heading = HeadingLevel.HEADING_6;

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

    if (tag === "blockquote") {
      parseHtmlToDocxParagraphs(el, children);
      continue;
    }

    if (["p", "h1", "h2", "h3", "h4", "h5", "h6", "div"].includes(tag)) {
      const imgs = el.querySelectorAll("img");
      if (imgs.length > 0) {
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
        continue;
      }

      const runs = parseInlineElements(el);
      if (runs.length > 0) {
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

    const style = childEl.getAttribute("style") || "";
    const colorMatch = style.match(/color:\s*([^;]+)/);
    if (colorMatch) {
      color = colorMatch[1].trim();
      const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
        const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
        const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
        color = `#${r}${g}${b}`;
      }
    }

    for (let i = 0; i < childEl.childNodes.length; i++) {
      walk(childEl.childNodes[i], bold, italic, underline, strike, color);
    }
  }

  for (let i = 0; i < el.childNodes.length; i++) {
    walk(el.childNodes[i], false, false, false, false);
  }

  return runs;
}

function buildExportHtml(data: ExportData, logoDataUrl?: string, contentHtml?: string): string {
  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: contain; margin-right: 16px; border: 1px solid #e0e0e0;" />`
    : "";

  return `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px;">
        ${logoHtml}
        <div>
          <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 4px 0;">${data.universityName}</h1>
          <p style="font-size: 16px; color: #555; margin: 0;">${data.department}</p>
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
      ${contentHtml || data.editorHtml}
    </div>
  `;
}
