import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  WidthType,
  BorderStyle,
  ExternalHyperlink,
  convertInchesToTwip,
} from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { LogicGatesData } from "@/components/LogicGatesBuilder";
import type { ERDiagramData } from "@/components/ERDiagramEditor";
import { renderERPageSvgCropped } from "@/components/ERDiagramEditor";
import baustLogo from "@/assets/baust-logo.jpeg";

/* ------------------------------------------------------------------ */
/* Page geometry — A4 at 96dpi                                         */
/* ------------------------------------------------------------------ */

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const PX_PER_MM = A4_WIDTH_PX / A4_WIDTH_MM;

const MARGIN_MM = 14;
const MARGIN_PX = MARGIN_MM * PX_PER_MM;

/** Printable area of one A4 page, in css pixels. */
const CONTENT_WIDTH_PX = A4_WIDTH_PX - MARGIN_PX * 2;
const CONTENT_HEIGHT_PX = A4_HEIGHT_PX - MARGIN_PX * 2;

/** Printable width of a DOCX page (A4, 1" margins) in pixels at 96dpi. */
const DOCX_CONTENT_WIDTH_PX = 620;

export interface ExportData {
  universityName: string;
  universitySubtitle?: string;
  department: string;
  courseCode: string;
  courseName: string;
  studentName: string;
  studentId: string;
  assignmentNo: string;
  date: string;
  editorHtml: string;
  logicGatesData?: LogicGatesData;
  erDiagramData?: ERDiagramData;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getFormattedDateTime(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(
    now.getHours()
  )}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
}

function buildFileName(data: ExportData, ext: string): string {
  const parts = [
    sanitizeFilePart(data.studentId),
    sanitizeFilePart(data.studentName),
    `${sanitizeFilePart(data.courseCode).replace(/\s+/g, "")}${sanitizeFilePart(data.assignmentNo)}`,
    getFormattedDateTime(),
  ].filter(Boolean);
  return `${parts.join("_")}.${ext}`;
}

let cachedLogo: string | null = null;

/** Loads the BAUST logo as a PNG data URL (square, transparent-safe). */
async function getLogoDataUrl(size = 320): Promise<string> {
  if (cachedLogo) return cachedLogo;

  const src =
    baustLogo ||
    (document.querySelector('img[alt="BAUST Logo"]') as HTMLImageElement | null)?.src ||
    "";
  if (!src) return "";

  return new Promise<string>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);

        // preserve aspect ratio, centred
        const ratio = Math.min(size / img.width, size / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

        cachedLogo = canvas.toDataURL("image/png");
        resolve(cachedLogo);
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

type DocxImageType = "png" | "jpg" | "gif" | "bmp";

function imageTypeFromDataUrl(dataUrl: string): DocxImageType {
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("bmp")) return "bmp";
  return "png";
}

function svgToDataUrl(svgString: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
}

/** Rasterises an SVG string to a PNG data URL at the requested pixel size. */
function svgToPngDataUrl(svgString: string, width: number, height: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = svgToDataUrl(svgString);
  });
}

/** Natural pixel size of an image data URL. */
function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = src;
  });
}

/* ------------------------------------------------------------------ */
/* Logic gates content (unchanged behaviour, kept intact)              */
/* ------------------------------------------------------------------ */

const GATE_NAMES = ["AND", "OR", "NOT", "NAND", "NOR", "X-OR"] as const;

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

function buildLogicGatesHtml(data: LogicGatesData): string {
  let html = '<div class="pdf-section">';
  html +=
    '<h2 style="font-size: 19px; font-weight: 700; margin: 0 0 16px 0; text-align: center; color: #1a1a2e;">Logic Gates Assignment</h2>';

  for (const gate of GATE_NAMES) {
    const section = data[gate];
    html += `<div style="margin-bottom: 22px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px;">`;
    html += `<h3 style="font-size: 16px; font-weight: 600; margin: 0 0 10px 0; color: #1a1a2e;">${gate} Gate</h3>`;

    if (section.selectedSymbol) {
      const svgStr = GATE_SVG_STRINGS[section.selectedSymbol];
      if (svgStr) {
        html += `<p style="margin: 0 0 6px 0;"><strong>Symbol:</strong></p>`;
        html += `<div style="margin-bottom: 10px;"><img src="${svgToDataUrl(
          svgStr
        )}" style="width: 150px; height: 100px;" /></div>`;
      }
    }
    if (section.selectedEquation) {
      html += `<p style="margin: 0 0 10px 0;"><strong>Boolean Expression:</strong> <span style="font-family: monospace; font-size: 15px;">${section.selectedEquation}</span></p>`;
    }

    const cols =
      section.inputType === "two" ? ["Input A", "Input B", "Output Y"] : ["Input A", "Output Y"];
    html += `<table style="border-collapse: collapse; width: 100%; max-width: 380px;">`;
    html += `<thead><tr>`;
    for (const col of cols) {
      html += `<th style="border: 1px solid #ccc; padding: 5px 10px; background: #f3f4f6; text-align: center; font-weight: 600; font-size: 13px;">${col}</th>`;
    }
    html += `</tr></thead><tbody>`;
    for (const row of section.truthTable) {
      html += `<tr>`;
      for (const cell of row) {
        html += `<td style="border: 1px solid #ccc; padding: 5px 10px; text-align: center; font-size: 13px;">${
          cell || ""
        }</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table></div>`;
  }
  html += "</div>";
  return html;
}

/* ------------------------------------------------------------------ */
/* ER diagram content                                                  */
/* ------------------------------------------------------------------ */

function nonEmptyErPages(data?: ERDiagramData) {
  if (!data) return [];
  return data.pages.filter((p) => p.shapes.length > 0);
}

async function buildErDiagramHtml(data?: ERDiagramData): Promise<string> {
  const pages = nonEmptyErPages(data);
  if (pages.length === 0) return "";

  let html = `<div class="pdf-section"><h2 style="font-size: 18px; font-weight: 700; margin: 0 0 12px 0; color: #1a1a2e;">ER Diagram</h2>`;

  for (let i = 0; i < pages.length; i++) {
    const { svg, width, height } = renderERPageSvgCropped(pages[i]);
    // Fit inside the printable column while preserving the aspect ratio.
    const scale = Math.min(1, CONTENT_WIDTH_PX / width);
    const drawW = Math.round(width * scale);
    const drawH = Math.round(height * scale);
    const png = await svgToPngDataUrl(svg, width * 2, height * 2);
    if (!png) continue;

    html += `<figure style="margin: 0 0 18px 0; text-align: center; page-break-inside: avoid;">
      <img src="${png}" style="width: ${drawW}px; height: ${drawH}px; border: 1px solid #e0e0e0;" />
      ${
        pages.length > 1
          ? `<figcaption style="font-size: 12px; color: #666; margin-top: 6px;">Figure ${
              i + 1
            }</figcaption>`
          : ""
      }
    </figure>`;
  }

  html += `</div>`;
  return html;
}

/* ------------------------------------------------------------------ */
/* Shared document header                                              */
/* ------------------------------------------------------------------ */

function buildHeaderHtml(data: ExportData, logoDataUrl: string): string {
  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" style="width: 120px; height: 120px; object-fit: contain; display: block; margin: 0 auto 12px auto;" />`
    : "";

  const infoRow = (label: string, value: string) =>
    `<tr>
      <td style="padding: 4px 0; font-weight: 600; width: 150px; vertical-align: top;">${label}</td>
      <td style="padding: 4px 0; width: 12px; vertical-align: top;">:</td>
      <td style="padding: 4px 0; vertical-align: top;">${value}</td>
    </tr>`;

  return `
    <div class="pdf-block" style="text-align: center; margin-bottom: 18px;">
      ${logoHtml}
      <h1 style="font-size: 21px; font-weight: 700; margin: 0 0 4px 0; line-height: 1.3;">${
        data.universityName
      }</h1>
      ${
        data.universitySubtitle
          ? `<p style="font-size: 14px; color: #555; margin: 0 0 4px 0;">${data.universitySubtitle}</p>`
          : ""
      }
      <p style="font-size: 15px; font-weight: 600; color: #1a1a2e; margin: 0;">${data.department}</p>
    </div>

    <table class="pdf-block" style="width: 100%; font-size: 14px; margin: 0 0 14px 0; border-collapse: collapse;">
      ${infoRow("Course Code", data.courseCode)}
      ${infoRow("Course Name", data.courseName)}
      ${infoRow("Student Name", data.studentName)}
      ${infoRow("Student ID", data.studentId)}
      ${infoRow("Assignment No", data.assignmentNo)}
      ${infoRow("Date", data.date)}
    </table>

    <hr class="pdf-block" style="border: none; border-top: 1.5px solid #1a1a2e; margin: 0 0 18px 0;" />
  `;
}

/* ------------------------------------------------------------------ */
/* PDF export — block-aware pagination                                 */
/* ------------------------------------------------------------------ */

const ATOMIC_TAGS = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "IMG",
  "PRE",
  "HR",
  "FIGURE",
  "TR",
]);

/**
 * Flattens the export container into the smallest sensible units that a
 * page break may fall between. This is what stops paragraphs, table rows
 * and images from being sliced in half across a page boundary.
 */
function collectBlocks(root: HTMLElement, maxHeight: number, out: HTMLElement[] = []): HTMLElement[] {
  for (const child of Array.from(root.children) as HTMLElement[]) {
    const tag = child.tagName;
    if (tag === "SCRIPT" || tag === "STYLE") continue;

    const height = child.getBoundingClientRect().height;
    const isAtomic = ATOMIC_TAGS.has(tag);
    const isTable = tag === "TABLE";
    const hasChildren = child.children.length > 0;

    // Tables stay whole unless they are taller than a page, in which case
    // we descend and break between rows instead.
    const shouldDescend =
      hasChildren && !isAtomic && (!isTable || height > maxHeight);

    if (shouldDescend) {
      collectBlocks(child, maxHeight, out);
    } else if (height > 0) {
      out.push(child);
    }
  }
  return out;
}

function computePageCuts(
  blocks: { top: number; height: number }[],
  totalHeight: number,
  pageHeight: number
): number[] {
  const cuts = [0];
  let pageStart = 0;

  for (const block of blocks) {
    const bottom = block.top + block.height;
    if (bottom - pageStart <= pageHeight) continue;

    // Break before this block when there is already content on the page.
    if (block.top > pageStart + 1) {
      pageStart = block.top;
      cuts.push(pageStart);
    }

    // A single block taller than one page still has to be sliced.
    while (bottom - pageStart > pageHeight) {
      pageStart += pageHeight;
      cuts.push(pageStart);
    }
  }

  if (cuts[cuts.length - 1] < totalHeight) cuts.push(totalHeight);
  return cuts.filter((v, i, arr) => i === 0 || v > arr[i - 1] + 1);
}

export async function exportToPDF(data: ExportData) {
  const logoDataUrl = await getLogoDataUrl();

  const contentHtml = data.logicGatesData
    ? buildLogicGatesHtml(data.logicGatesData)
    : `${data.editorHtml || ""}${await buildErDiagramHtml(data.erDiagramData)}`;

  const container = document.createElement("div");
  container.setAttribute("data-export-root", "true");
  container.style.cssText = [
    `width: ${CONTENT_WIDTH_PX}px`,
    "position: absolute",
    "left: -10000px",
    "top: 0",
    "background: #ffffff",
    "color: #1a1a2e",
    'font-family: Arial, "Helvetica Neue", Helvetica, sans-serif',
    "font-size: 14px",
    "line-height: 1.6",
    "box-sizing: border-box",
  ].join(";");

  container.innerHTML = `
    <style>
      [data-export-root] * { box-sizing: border-box; }
      [data-export-root] p { margin: 0 0 10px 0; }
      [data-export-root] h1, [data-export-root] h2, [data-export-root] h3,
      [data-export-root] h4, [data-export-root] h5, [data-export-root] h6 {
        margin: 14px 0 8px 0; line-height: 1.3; color: #1a1a2e;
      }
      [data-export-root] h1 { font-size: 22px; }
      [data-export-root] h2 { font-size: 19px; }
      [data-export-root] h3 { font-size: 17px; }
      [data-export-root] h4 { font-size: 15px; }
      [data-export-root] ul, [data-export-root] ol { margin: 0 0 10px 0; padding-left: 26px; }
      [data-export-root] li { margin-bottom: 4px; }
      [data-export-root] blockquote {
        margin: 0 0 10px 0; padding-left: 14px; border-left: 3px solid #d0d5dd; color: #444;
      }
      [data-export-root] pre {
        background: #f6f7f9; padding: 10px 12px; border-radius: 6px;
        font-family: "Courier New", monospace; font-size: 13px;
        white-space: pre-wrap; word-break: break-word; margin: 0 0 10px 0;
      }
      [data-export-root] code { font-family: "Courier New", monospace; font-size: 13px; }
      [data-export-root] img { max-width: 100%; height: auto; }
      [data-export-root] table { border-collapse: collapse; max-width: 100%; }
      [data-export-root] hr { border: none; border-top: 1px solid #d0d5dd; margin: 12px 0; }
    </style>
    ${buildHeaderHtml(data, logoDataUrl)}
    <div class="pdf-content">${contentHtml || "<p></p>"}</div>
  `;

  document.body.appendChild(container);

  try {
    // Wait for every image (logo, diagrams, pasted pictures) to decode.
    const images = Array.from(container.querySelectorAll("img"));
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    );
    await new Promise((r) => setTimeout(r, 120));

    const containerTop = container.getBoundingClientRect().top;
    const blocks = collectBlocks(container, CONTENT_HEIGHT_PX).map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top - containerTop, height: rect.height };
    });

    const totalHeight = container.getBoundingClientRect().height;
    const cuts = computePageCuts(blocks, totalHeight, CONTENT_HEIGHT_PX);

    const scale = 2;
    const canvas = await html2canvas(container, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const drawWidthMm = A4_WIDTH_MM - MARGIN_MM * 2;

    for (let i = 0; i < cuts.length - 1; i++) {
      const sliceTopPx = cuts[i];
      const sliceHeightPx = Math.min(cuts[i + 1] - cuts[i], CONTENT_HEIGHT_PX);
      if (sliceHeightPx <= 0) continue;

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.round(sliceHeightPx * scale);
      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, -Math.round(sliceTopPx * scale));

      if (i > 0) pdf.addPage();
      pdf.addImage(
        pageCanvas.toDataURL("image/png"),
        "PNG",
        MARGIN_MM,
        MARGIN_MM,
        drawWidthMm,
        sliceHeightPx / PX_PER_MM,
        undefined,
        "FAST"
      );
    }

    pdf.save(buildFileName(data, "pdf"));
  } finally {
    document.body.removeChild(container);
  }
}

/* ------------------------------------------------------------------ */
/* DOCX export                                                         */
/* ------------------------------------------------------------------ */

type DocxChild = Paragraph | DocxTable;

const BASE_FONT = "Arial";
const BASE_SIZE = 22; // half-points -> 11pt

function horizontalRuleParagraph(): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 240 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "1A1A2E", space: 4 },
    },
    children: [],
  });
}

function spacerParagraph(after = 160): Paragraph {
  return new Paragraph({ spacing: { after }, children: [] });
}

async function buildDocxHeader(data: ExportData): Promise<DocxChild[]> {
  const out: DocxChild[] = [];

  const logoDataUrl = await getLogoDataUrl();
  const logoBytes = logoDataUrl ? dataUrlToUint8Array(logoDataUrl) : null;

  if (logoBytes) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({
            data: logoBytes,
            transformation: { width: 120, height: 120 },
            type: "png",
          }),
        ],
      })
    );
  }

  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: data.universityName, bold: true, size: 30, font: BASE_FONT }),
      ],
    })
  );

  if (data.universitySubtitle) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({ text: data.universitySubtitle, size: 22, font: BASE_FONT, color: "555555" }),
        ],
      })
    );
  }

  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 260 },
      children: [new TextRun({ text: data.department, bold: true, size: 24, font: BASE_FONT })],
    })
  );

  const infoLines: [string, string][] = [
    ["Course Code", data.courseCode],
    ["Course Name", data.courseName],
    ["Student Name", data.studentName],
    ["Student ID", data.studentId],
    ["Assignment No", data.assignmentNo],
    ["Date", data.date],
  ];

  for (const [label, value] of infoLines) {
    out.push(
      new Paragraph({
        spacing: { after: 80 },
        tabStops: [{ type: "left", position: convertInchesToTwip(1.6) }],
        children: [
          new TextRun({ text: `${label}`, bold: true, size: BASE_SIZE, font: BASE_FONT }),
          new TextRun({ text: `\t: ${value}`, size: BASE_SIZE, font: BASE_FONT }),
        ],
      })
    );
  }

  out.push(horizontalRuleParagraph());
  return out;
}

async function buildDocxErDiagram(data?: ERDiagramData): Promise<DocxChild[]> {
  const pages = nonEmptyErPages(data);
  if (pages.length === 0) return [];

  const out: DocxChild[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 140 },
      children: [new TextRun({ text: "ER Diagram", bold: true, size: 28, font: BASE_FONT })],
    }),
  ];

  for (let i = 0; i < pages.length; i++) {
    const { svg, width, height } = renderERPageSvgCropped(pages[i]);
    const png = await svgToPngDataUrl(svg, width * 2, height * 2);
    const bytes = png ? dataUrlToUint8Array(png) : null;
    if (!bytes) continue;

    // Scale so it always fits the printable column of the page.
    const scale = Math.min(1, DOCX_CONTENT_WIDTH_PX / width, 820 / height);
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new ImageRun({
            data: bytes,
            transformation: {
              width: Math.round(width * scale),
              height: Math.round(height * scale),
            },
            type: "png",
          }),
        ],
      })
    );

    if (pages.length > 1) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: `Figure ${i + 1}`, size: 20, italics: true, font: BASE_FONT, color: "666666" }),
          ],
        })
      );
    }
  }

  return out;
}

/* ---------- HTML -> DOCX ---------- */

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  code?: boolean;
  superScript?: boolean;
  subScript?: boolean;
  link?: string;
}

function normalizeColor(raw: string): string | undefined {
  const value = raw.trim();
  const rgb = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgb) {
    return [1, 2, 3]
      .map((i) => parseInt(rgb[i], 10).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  const hex = value.match(/^#?([0-9a-fA-F]{6})$/);
  if (hex) return hex[1].toUpperCase();
  const short = value.match(/^#?([0-9a-fA-F]{3})$/);
  if (short) {
    return short[1]
      .split("")
      .map((c) => c + c)
      .join("")
      .toUpperCase();
  }
  return undefined;
}

/** Collects an element's inline content as docx runs, preserving formatting. */
function collectRuns(
  el: Node,
  inherited: InlineStyle = {},
  size: number = BASE_SIZE
): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];

  const makeRun = (text: string, style: InlineStyle) =>
    new TextRun({
      text,
      size,
      font: style.code ? "Courier New" : BASE_FONT,
      bold: style.bold || undefined,
      italics: style.italics || undefined,
      underline: style.underline ? {} : undefined,
      strike: style.strike || undefined,
      color: style.color,
      superScript: style.superScript || undefined,
      subScript: style.subScript || undefined,
    });

  const walk = (node: Node, style: InlineStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").replace(/\s+/g, " ");
      if (!text) return;
      if (style.link) {
        runs.push(
          new ExternalHyperlink({
            link: style.link,
            children: [makeRun(text, { ...style, color: "1155CC", underline: true })],
          })
        );
      } else {
        runs.push(makeRun(text, style));
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      runs.push(new TextRun({ text: "", break: 1 }));
      return;
    }
    if (tag === "img") return; // handled as its own paragraph

    const next: InlineStyle = { ...style };
    if (tag === "strong" || tag === "b") next.bold = true;
    if (tag === "em" || tag === "i") next.italics = true;
    if (tag === "u" || tag === "ins") next.underline = true;
    if (tag === "s" || tag === "del" || tag === "strike") next.strike = true;
    if (tag === "code" || tag === "kbd" || tag === "samp") next.code = true;
    if (tag === "sup") next.superScript = true;
    if (tag === "sub") next.subScript = true;
    if (tag === "a") next.link = el.getAttribute("href") || undefined;

    const styleAttr = el.getAttribute("style") || "";
    const colorMatch = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;]+)/);
    if (colorMatch) {
      const c = normalizeColor(colorMatch[1]);
      if (c) next.color = c;
    }
    if (/font-weight\s*:\s*(bold|[6-9]00)/.test(styleAttr)) next.bold = true;
    if (/font-style\s*:\s*italic/.test(styleAttr)) next.italics = true;

    el.childNodes.forEach((child) => walk(child, next));
  };

  el.childNodes.forEach((child) => walk(child, inherited));
  return runs;
}

function alignmentOf(el: HTMLElement): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const style = el.getAttribute("style") || "";
  if (/text-align\s*:\s*center/.test(style)) return AlignmentType.CENTER;
  if (/text-align\s*:\s*right/.test(style)) return AlignmentType.RIGHT;
  if (/text-align\s*:\s*justify/.test(style)) return AlignmentType.JUSTIFIED;
  return undefined;
}

const HEADING_MAP: Record<string, { heading: (typeof HeadingLevel)[keyof typeof HeadingLevel]; size: number }> = {
  h1: { heading: HeadingLevel.HEADING_1, size: 32 },
  h2: { heading: HeadingLevel.HEADING_2, size: 28 },
  h3: { heading: HeadingLevel.HEADING_3, size: 26 },
  h4: { heading: HeadingLevel.HEADING_4, size: 24 },
  h5: { heading: HeadingLevel.HEADING_5, size: 22 },
  h6: { heading: HeadingLevel.HEADING_6, size: 22 },
};

async function imageParagraph(img: HTMLImageElement): Promise<Paragraph | null> {
  const src = img.getAttribute("src") || "";
  if (!src.startsWith("data:image/")) return null;

  const bytes = dataUrlToUint8Array(src);
  if (!bytes) return null;

  const { width, height } = await measureImage(src);
  const scale = Math.min(1, DOCX_CONTENT_WIDTH_PX / width, 800 / height);

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 160 },
    children: [
      new ImageRun({
        data: bytes,
        transformation: {
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
        },
        type: imageTypeFromDataUrl(src),
      }),
    ],
  });
}

function htmlTableToDocx(table: HTMLTableElement): DocxTable | null {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) return null;

  const line = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
  const borders = { top: line, bottom: line, left: line, right: line };

  const docxRows = rows.map((tr) => {
    const cells = Array.from(tr.children) as HTMLTableCellElement[];
    return new DocxTableRow({
      children: cells.map((td) => {
        const isHeader = td.tagName.toLowerCase() === "th";
        const runs = collectRuns(td, isHeader ? { bold: true } : {});
        return new DocxTableCell({
          borders,
          columnSpan: td.colSpan > 1 ? td.colSpan : undefined,
          rowSpan: td.rowSpan > 1 ? td.rowSpan : undefined,
          children: [
            new Paragraph({
              alignment: isHeader ? AlignmentType.CENTER : undefined,
              children: runs.length ? runs : [new TextRun({ text: "", size: BASE_SIZE })],
            }),
          ],
        });
      }),
    });
  });

  return new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: docxRows,
  });
}

async function htmlToDocx(
  container: HTMLElement,
  out: DocxChild[],
  listDepth = 0
): Promise<void> {
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").trim();
      if (text) {
        out.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text, size: BASE_SIZE, font: BASE_FONT })],
          })
        );
      }
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "img") {
      const p = await imageParagraph(el as HTMLImageElement);
      if (p) out.push(p);
      continue;
    }

    if (tag === "hr") {
      out.push(horizontalRuleParagraph());
      continue;
    }

    if (tag === "table") {
      const t = htmlTableToDocx(el as HTMLTableElement);
      if (t) {
        out.push(t);
        out.push(spacerParagraph(160));
      }
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(el.children).filter(
        (c) => c.tagName.toLowerCase() === "li"
      ) as HTMLElement[];

      for (let i = 0; i < items.length; i++) {
        const li = items[i];
        const nested = Array.from(li.children).filter((c) =>
          ["ul", "ol"].includes(c.tagName.toLowerCase())
        ) as HTMLElement[];

        // Runs for the item itself, excluding any nested list markup.
        const clone = li.cloneNode(true) as HTMLElement;
        Array.from(clone.querySelectorAll("ul, ol")).forEach((n) => n.remove());

        const inlineImages = Array.from(clone.querySelectorAll("img"));
        const runs = collectRuns(clone);
        const marker = tag === "ol" ? `${i + 1}. ` : listDepth % 2 === 0 ? "• " : "◦ ";

        if (runs.length > 0) {
          out.push(
            new Paragraph({
              spacing: { after: 60 },
              indent: { left: 360 + listDepth * 360, hanging: 240 },
              children: [
                new TextRun({ text: marker, size: BASE_SIZE, font: BASE_FONT }),
                ...runs,
              ],
            })
          );
        }

        for (const img of inlineImages) {
          const p = await imageParagraph(img as HTMLImageElement);
          if (p) out.push(p);
        }

        for (const child of nested) {
          await htmlToDocx(
            wrapAsFragment(child.outerHTML),
            out,
            listDepth + 1
          );
        }
      }
      out.push(spacerParagraph(80));
      continue;
    }

    if (tag === "pre") {
      const lines = (el.textContent || "").split(/\r?\n/);
      out.push(
        new Paragraph({
          spacing: { before: 100, after: 140 },
          shading: { fill: "F4F5F7" },
          children: lines.flatMap((line, i) => [
            ...(i > 0 ? [new TextRun({ text: "", break: 1 })] : []),
            new TextRun({ text: line, font: "Courier New", size: 20 }),
          ]),
        })
      );
      continue;
    }

    if (tag === "blockquote") {
      const quoted: DocxChild[] = [];
      await htmlToDocx(el, quoted, listDepth);
      for (const child of quoted) {
        if (child instanceof Paragraph) {
          out.push(child);
        } else {
          out.push(child);
        }
      }
      continue;
    }

    if (HEADING_MAP[tag]) {
      const { heading, size } = HEADING_MAP[tag];
      const runs = collectRuns(el, { bold: true }, size);
      if (runs.length > 0) {
        out.push(
          new Paragraph({
            heading,
            alignment: alignmentOf(el),
            spacing: { before: 200, after: 100 },
            children: runs,
          })
        );
      }
      continue;
    }

    if (tag === "p" || tag === "div" || tag === "section" || tag === "figure") {
      const images = Array.from(el.querySelectorAll("img"));
      const runs = collectRuns(el);

      if (runs.length > 0) {
        out.push(
          new Paragraph({
            alignment: alignmentOf(el),
            spacing: { after: 140 },
            children: runs,
          })
        );
      }
      for (const img of images) {
        const p = await imageParagraph(img as HTMLImageElement);
        if (p) out.push(p);
      }
      // Empty paragraph in the editor = intentional blank line.
      if (runs.length === 0 && images.length === 0 && tag === "p") {
        out.push(spacerParagraph(120));
      }
      continue;
    }

    // Anything else: recurse so nothing is silently dropped.
    await htmlToDocx(el, out, listDepth);
  }
}

function wrapAsFragment(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

function buildLogicGatesDocx(data: LogicGatesData): Promise<DocxChild[]> {
  const out: DocxChild[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "Logic Gates Assignment", bold: true, size: 28, font: BASE_FONT }),
      ],
    }),
  ];

  const line = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
  const borders = { top: line, bottom: line, left: line, right: line };

  return (async () => {
    for (const gate of GATE_NAMES) {
      const section = data[gate];

      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 280, after: 100 },
          children: [new TextRun({ text: `${gate} Gate`, bold: true, size: 26, font: BASE_FONT })],
        })
      );

      if (section.selectedSymbol) {
        const svgStr = GATE_SVG_STRINGS[section.selectedSymbol];
        if (svgStr) {
          const png = await svgToPngDataUrl(svgStr, 360, 240);
          const bytes = png ? dataUrlToUint8Array(png) : null;
          if (bytes) {
            out.push(
              new Paragraph({
                spacing: { after: 60 },
                children: [new TextRun({ text: "Symbol:", bold: true, size: BASE_SIZE, font: BASE_FONT })],
              })
            );
            out.push(
              new Paragraph({
                spacing: { after: 140 },
                children: [
                  new ImageRun({
                    data: bytes,
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
        out.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "Boolean Expression: ", bold: true, size: BASE_SIZE, font: BASE_FONT }),
              new TextRun({ text: section.selectedEquation, size: BASE_SIZE, font: "Courier New" }),
            ],
          })
        );
      }

      const headers =
        section.inputType === "two" ? ["Input A", "Input B", "Output Y"] : ["Input A", "Output Y"];

      out.push(
        new DocxTable({
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
                        children: [new TextRun({ text: h, bold: true, size: 20, font: BASE_FONT })],
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
                            children: [new TextRun({ text: cell || "", size: 20, font: BASE_FONT })],
                          }),
                        ],
                      })
                  ),
                })
            ),
          ],
        })
      );

      out.push(spacerParagraph(200));
    }
    return out;
  })();
}

export async function exportToDocx(data: ExportData) {
  const children: DocxChild[] = await buildDocxHeader(data);

  if (data.logicGatesData) {
    children.push(...(await buildLogicGatesDocx(data.logicGatesData)));
  } else {
    const body = wrapAsFragment(data.editorHtml || "");
    await htmlToDocx(body, children);
    children.push(...(await buildDocxErDiagram(data.erDiagramData)));
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: BASE_FONT, size: BASE_SIZE, color: "1A1A2E" },
          paragraph: { spacing: { line: 300 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, buildFileName(data, "docx"));
}
