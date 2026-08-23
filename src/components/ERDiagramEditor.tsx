import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Trash2,
  Plus,
  Copy,
  ArrowUp,
  ArrowDown,
  Eraser,
  MousePointer2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Page geometry                                                       */
/* ------------------------------------------------------------------ */

/**
 * The drawing surface matches the printable area of an A4 page
 * (794 x 1123 css px at 96dpi, minus ~15mm margins on each side).
 * Because the editor canvas and the exported page share these exact
 * proportions, a diagram can never be wider or longer than one page —
 * shapes are clamped inside the canvas, and each canvas becomes exactly
 * one page in the PDF / DOCX output.
 */
export const ER_PAGE_WIDTH = 680;
export const ER_PAGE_HEIGHT = 960;

const GRID = 5;
const MIN_SIZE = 24;

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

export type ERShapeType =
  | "entity"
  | "weakEntity"
  | "relationship"
  | "weakRelationship"
  | "attribute"
  | "keyAttribute"
  | "multivaluedAttribute"
  | "derivedAttribute"
  | "text"
  | "line";

export interface ERShape {
  id: string;
  type: ERShapeType;
  /** Top-left of the bounding box. For `line`, the first endpoint. */
  x: number;
  y: number;
  /** Size of the bounding box. For `line`, the offset to the second endpoint. */
  w: number;
  h: number;
  text: string;
  fontSize: number;
}

export interface ERPage {
  id: string;
  shapes: ERShape[];
}

export interface ERDiagramData {
  pages: ERPage[];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function createDefaultERDiagramData(): ERDiagramData {
  return { pages: [{ id: uid(), shapes: [] }] };
}

/** Guards against older / partial data coming out of localStorage. */
export function normalizeERDiagramData(data?: Partial<ERDiagramData> | null): ERDiagramData {
  if (!data || !Array.isArray(data.pages) || data.pages.length === 0) {
    return createDefaultERDiagramData();
  }
  return {
    pages: data.pages.map((p) => ({
      id: p?.id || uid(),
      shapes: Array.isArray(p?.shapes) ? p.shapes : [],
    })),
  };
}

export function erDiagramIsEmpty(data?: ERDiagramData | null): boolean {
  if (!data) return true;
  return !data.pages.some((p) => p.shapes.length > 0);
}

/* ------------------------------------------------------------------ */
/* Shape catalogue                                                     */
/* ------------------------------------------------------------------ */

interface ShapeSpec {
  type: ERShapeType;
  label: string;
  hint: string;
  defaultW: number;
  defaultH: number;
  defaultText: string;
}

export const ER_SHAPE_SPECS: ShapeSpec[] = [
  { type: "entity", label: "Entity", hint: "Rectangle", defaultW: 150, defaultH: 64, defaultText: "Entity" },
  { type: "weakEntity", label: "Weak Entity", hint: "Double rectangle", defaultW: 160, defaultH: 70, defaultText: "Weak Entity" },
  { type: "relationship", label: "Relationship", hint: "Diamond", defaultW: 150, defaultH: 84, defaultText: "Relation" },
  { type: "weakRelationship", label: "Weak Relationship", hint: "Double diamond", defaultW: 165, defaultH: 94, defaultText: "Relation" },
  { type: "attribute", label: "Attribute", hint: "Ellipse", defaultW: 130, defaultH: 58, defaultText: "attribute" },
  { type: "keyAttribute", label: "Key Attribute", hint: "Underlined ellipse", defaultW: 130, defaultH: 58, defaultText: "id" },
  { type: "multivaluedAttribute", label: "Multivalued", hint: "Double ellipse", defaultW: 140, defaultH: 64, defaultText: "phones" },
  { type: "derivedAttribute", label: "Derived", hint: "Dashed ellipse", defaultW: 130, defaultH: 58, defaultText: "age" },
  { type: "line", label: "Connector", hint: "Line / link", defaultW: 130, defaultH: 0, defaultText: "" },
  { type: "text", label: "Text", hint: "Free label (1, N, M …)", defaultW: 90, defaultH: 28, defaultText: "N" },
];

const STROKE = "#1a1a2e";
const FILL = "#ffffff";

/* ------------------------------------------------------------------ */
/* SVG generation (shared by the editor and the exporters)             */
/* ------------------------------------------------------------------ */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Naive but predictable word wrap based on average glyph width. */
function wrapLines(text: string, maxWidth: number, fontSize: number): string[] {
  const hard = text.split(/\r?\n/);
  const charW = fontSize * 0.55;
  const maxChars = Math.max(4, Math.floor(maxWidth / charW));
  const out: string[] = [];

  for (const segment of hard) {
    const words = segment.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= maxChars) {
        line = candidate;
      } else {
        if (line) out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

function textMarkup(
  cx: number,
  cy: number,
  maxWidth: number,
  text: string,
  fontSize: number,
  opts: { underline?: boolean } = {}
): string {
  if (!text.trim()) return "";
  const lines = wrapLines(text, maxWidth, fontSize);
  const lineHeight = fontSize * 1.2;
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;

  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${cx}" y="${(startY + i * lineHeight).toFixed(2)}">${escapeXml(line)}</tspan>`
    )
    .join("");

  return `<text text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="${STROKE}"${
    opts.underline ? ' text-decoration="underline"' : ""
  }>${tspans}</text>`;
}

function diamondPoints(x: number, y: number, w: number, h: number, inset = 0): string {
  const l = x + inset;
  const r = x + w - inset;
  const t = y + inset;
  const b = y + h - inset;
  const mx = x + w / 2;
  const my = y + h / 2;
  return `${mx},${t} ${r},${my} ${mx},${b} ${l},${my}`;
}

/** Renders one shape as SVG markup in absolute page coordinates. */
export function shapeMarkup(shape: ERShape): string {
  const { x, y, w, h, text, fontSize, type } = shape;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const base = `fill="${FILL}" stroke="${STROKE}" stroke-width="2"`;

  switch (type) {
    case "entity":
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${base} />` +
        textMarkup(cx, cy, w - 14, text, fontSize)
      );

    case "weakEntity":
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${base} />` +
        `<rect x="${x + 6}" y="${y + 6}" width="${Math.max(0, w - 12)}" height="${Math.max(
          0,
          h - 12
        )}" fill="none" stroke="${STROKE}" stroke-width="2" />` +
        textMarkup(cx, cy, w - 24, text, fontSize)
      );

    case "relationship":
      return (
        `<polygon points="${diamondPoints(x, y, w, h)}" ${base} />` +
        textMarkup(cx, cy, w * 0.6, text, fontSize)
      );

    case "weakRelationship":
      return (
        `<polygon points="${diamondPoints(x, y, w, h)}" ${base} />` +
        `<polygon points="${diamondPoints(x, y, w, h, 8)}" fill="none" stroke="${STROKE}" stroke-width="2" />` +
        textMarkup(cx, cy, w * 0.55, text, fontSize)
      );

    case "attribute":
      return (
        `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" ${base} />` +
        textMarkup(cx, cy, w - 18, text, fontSize)
      );

    case "keyAttribute":
      return (
        `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" ${base} />` +
        textMarkup(cx, cy, w - 18, text, fontSize, { underline: true })
      );

    case "multivaluedAttribute":
      return (
        `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" ${base} />` +
        `<ellipse cx="${cx}" cy="${cy}" rx="${Math.max(1, w / 2 - 6)}" ry="${Math.max(
          1,
          h / 2 - 6
        )}" fill="none" stroke="${STROKE}" stroke-width="2" />` +
        textMarkup(cx, cy, w - 26, text, fontSize)
      );

    case "derivedAttribute":
      return (
        `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${
          h / 2
        }" fill="${FILL}" stroke="${STROKE}" stroke-width="2" stroke-dasharray="6 4" />` +
        textMarkup(cx, cy, w - 18, text, fontSize)
      );

    case "line":
      return `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${
        y + h
      }" stroke="${STROKE}" stroke-width="2" stroke-linecap="round" />`;

    case "text":
      return textMarkup(cx, cy, w, text, fontSize);

    default:
      return "";
  }
}

/** Full standalone SVG for one page — used by the PDF / DOCX exporters. */
export function renderERPageSvg(page: ERPage): string {
  const body = page.shapes.map(shapeMarkup).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ER_PAGE_WIDTH}" height="${ER_PAGE_HEIGHT}" viewBox="0 0 ${ER_PAGE_WIDTH} ${ER_PAGE_HEIGHT}"><rect x="0" y="0" width="${ER_PAGE_WIDTH}" height="${ER_PAGE_HEIGHT}" fill="#ffffff" />${body}</svg>`;
}

/**
 * Tight bounding box of everything drawn on a page, padded a little.
 * The exporter uses this to crop away empty space so a short diagram
 * does not occupy a whole page.
 */
export function erPageBounds(page: ERPage) {
  if (page.shapes.length === 0) {
    return { x: 0, y: 0, width: ER_PAGE_WIDTH, height: ER_PAGE_HEIGHT };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of page.shapes) {
    const x1 = Math.min(s.x, s.x + s.w);
    const x2 = Math.max(s.x, s.x + s.w);
    const y1 = Math.min(s.y, s.y + s.h);
    const y2 = Math.max(s.y, s.y + s.h);
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }

  const pad = 16;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const width = Math.min(ER_PAGE_WIDTH - x, maxX - minX + pad * 2);
  const height = Math.min(ER_PAGE_HEIGHT - y, maxY - minY + pad * 2);
  return { x, y, width: Math.max(1, width), height: Math.max(1, height) };
}

/** Cropped SVG for a page — same drawing, trimmed to its content. */
export function renderERPageSvgCropped(page: ERPage): {
  svg: string;
  width: number;
  height: number;
} {
  const b = erPageBounds(page);
  const body = page.shapes.map(shapeMarkup).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${b.width}" height="${b.height}" viewBox="${b.x} ${b.y} ${b.width} ${b.height}"><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#ffffff" />${body}</svg>`;
  return { svg, width: b.width, height: b.height };
}

/* ------------------------------------------------------------------ */
/* Palette preview                                                     */
/* ------------------------------------------------------------------ */

function PalettePreview({ type }: { type: ERShapeType }) {
  const preview: ERShape = {
    id: "preview",
    type,
    x: 4,
    y: type === "line" ? 16 : 4,
    w: 52,
    h: type === "line" ? 0 : 24,
    text: "",
    fontSize: 12,
  };
  return (
    <svg viewBox="0 0 60 32" className="h-6 w-14 shrink-0" aria-hidden="true">
      <g dangerouslySetInnerHTML={{ __html: shapeMarkup(preview) }} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

type DragMode = "move" | "resize" | "start" | "end";

interface DragState {
  id: string;
  mode: DragMode;
  pointerX: number;
  pointerY: number;
  origin: ERShape;
}

interface ERDiagramEditorProps {
  data: ERDiagramData;
  onChange: (data: ERDiagramData) => void;
}

const ERDiagramEditor = ({ data, onChange }: ERDiagramEditorProps) => {
  const pages = data.pages;
  const [activePage, setActivePage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const pageIndex = Math.min(activePage, pages.length - 1);
  const page = pages[pageIndex];
  const selected = useMemo(
    () => page.shapes.find((s) => s.id === selectedId) || null,
    [page.shapes, selectedId]
  );

  const updatePage = useCallback(
    (updater: (p: ERPage) => ERPage) => {
      onChange({
        pages: pages.map((p, i) => (i === pageIndex ? updater(p) : p)),
      });
    },
    [onChange, pages, pageIndex]
  );

  const updateShape = useCallback(
    (id: string, patch: Partial<ERShape>) => {
      updatePage((p) => ({
        ...p,
        shapes: p.shapes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }));
    },
    [updatePage]
  );

  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * ER_PAGE_WIDTH,
      y: ((clientY - rect.top) / rect.height) * ER_PAGE_HEIGHT,
    };
  }, []);

  const addShape = useCallback(
    (spec: ShapeSpec) => {
      const offset = (page.shapes.length % 8) * 18;
      const shape: ERShape = {
        id: uid(),
        type: spec.type,
        x: Math.min(60 + offset, ER_PAGE_WIDTH - spec.defaultW - 10),
        y: Math.min(60 + offset, ER_PAGE_HEIGHT - Math.max(spec.defaultH, 20) - 10),
        w: spec.defaultW,
        h: spec.defaultH,
        text: spec.defaultText,
        fontSize: spec.type === "text" ? 15 : 14,
      };
      updatePage((p) => ({ ...p, shapes: [...p.shapes, shape] }));
      setSelectedId(shape.id);
    },
    [page.shapes.length, updatePage]
  );

  const removeShape = useCallback(
    (id: string) => {
      updatePage((p) => ({ ...p, shapes: p.shapes.filter((s) => s.id !== id) }));
      setSelectedId(null);
    },
    [updatePage]
  );

  const duplicateShape = useCallback(
    (shape: ERShape) => {
      const copy: ERShape = {
        ...shape,
        id: uid(),
        x: Math.min(shape.x + 20, ER_PAGE_WIDTH - Math.abs(shape.w) - 5),
        y: Math.min(shape.y + 20, ER_PAGE_HEIGHT - Math.abs(shape.h) - 5),
      };
      updatePage((p) => ({ ...p, shapes: [...p.shapes, copy] }));
      setSelectedId(copy.id);
    },
    [updatePage]
  );

  const reorder = useCallback(
    (id: string, direction: 1 | -1) => {
      updatePage((p) => {
        const idx = p.shapes.findIndex((s) => s.id === id);
        const target = idx + direction;
        if (idx < 0 || target < 0 || target >= p.shapes.length) return p;
        const next = [...p.shapes];
        [next[idx], next[target]] = [next[target], next[idx]];
        return { ...p, shapes: next };
      });
    },
    [updatePage]
  );

  /* ---------------- dragging ---------------- */

  const beginDrag = (e: React.PointerEvent, shape: ERShape, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    const pt = toSvgPoint(e.clientX, e.clientY);
    dragRef.current = { id: shape.id, mode, pointerX: pt.x, pointerY: pt.y, origin: { ...shape } };
    setSelectedId(shape.id);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pt = toSvgPoint(e.clientX, e.clientY);
    const dx = pt.x - drag.pointerX;
    const dy = pt.y - drag.pointerY;
    const snap = (v: number) => Math.round(v / GRID) * GRID;
    const o = drag.origin;

    if (drag.mode === "move") {
      if (o.type === "line") {
        const minX = Math.min(0, o.w);
        const maxX = ER_PAGE_WIDTH - Math.max(0, o.w);
        const minY = Math.min(0, o.h);
        const maxY = ER_PAGE_HEIGHT - Math.max(0, o.h);
        updateShape(o.id, {
          x: clamp(snap(o.x + dx), -minX, maxX),
          y: clamp(snap(o.y + dy), -minY, maxY),
        });
      } else {
        updateShape(o.id, {
          x: clamp(snap(o.x + dx), 0, ER_PAGE_WIDTH - o.w),
          y: clamp(snap(o.y + dy), 0, ER_PAGE_HEIGHT - o.h),
        });
      }
      return;
    }

    if (drag.mode === "resize") {
      updateShape(o.id, {
        w: clamp(snap(o.w + dx), MIN_SIZE, ER_PAGE_WIDTH - o.x),
        h: clamp(snap(o.h + dy), MIN_SIZE, ER_PAGE_HEIGHT - o.y),
      });
      return;
    }

    if (drag.mode === "start") {
      const nx = clamp(snap(o.x + dx), 0, ER_PAGE_WIDTH);
      const ny = clamp(snap(o.y + dy), 0, ER_PAGE_HEIGHT);
      updateShape(o.id, { x: nx, y: ny, w: o.x + o.w - nx, h: o.y + o.h - ny });
      return;
    }

    if (drag.mode === "end") {
      updateShape(o.id, {
        w: clamp(snap(o.w + dx), -o.x, ER_PAGE_WIDTH - o.x),
        h: clamp(snap(o.h + dy), -o.y, ER_PAGE_HEIGHT - o.y),
      });
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragRef.current) {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      dragRef.current = null;
    }
  };

  /* ---------------- pages ---------------- */

  const addPage = () => {
    onChange({ pages: [...pages, { id: uid(), shapes: [] }] });
    setActivePage(pages.length);
    setSelectedId(null);
  };

  const removePage = (index: number) => {
    if (pages.length === 1) {
      onChange({ pages: [{ id: uid(), shapes: [] }] });
      setSelectedId(null);
      return;
    }
    onChange({ pages: pages.filter((_, i) => i !== index) });
    setActivePage(Math.max(0, index - 1));
    setSelectedId(null);
  };

  const clearPage = () => {
    updatePage((p) => ({ ...p, shapes: [] }));
    setSelectedId(null);
  };

  /* ---------------- render ---------------- */

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">ER Diagram Drawer</h3>
            <p className="text-xs text-muted-foreground">
              Click a symbol to add it, then drag to position. Each page matches one A4 page in the
              exported PDF / DOCX, so diagrams never overflow.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {pages.map((p, i) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={i === pageIndex ? "default" : "outline"}
                onClick={() => {
                  setActivePage(i);
                  setSelectedId(null);
                }}
                className="h-8 px-3 text-xs"
              >
                Page {i + 1}
              </Button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={addPage} className="h-8 gap-1 px-2 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Page
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[210px_1fr]">
          {/* Palette + properties */}
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                Symbols
              </Label>
              <div className="grid grid-cols-1 gap-1">
                {ER_SHAPE_SPECS.map((spec) => (
                  <button
                    key={spec.type}
                    type="button"
                    onClick={() => addShape(spec)}
                    title={spec.hint}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                  >
                    <PalettePreview type={spec.type} />
                    <span className="truncate font-medium">{spec.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {selected ? (
              <div className="space-y-3">
                <Label className="block text-xs uppercase tracking-wide text-muted-foreground">
                  Selected shape
                </Label>

                {selected.type !== "line" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="erText" className="text-xs">
                      Text
                    </Label>
                    <Textarea
                      id="erText"
                      value={selected.text}
                      rows={2}
                      onChange={(e) => updateShape(selected.id, { text: e.target.value })}
                      placeholder="Label…"
                      className="text-sm"
                    />
                  </div>
                )}

                {selected.type !== "line" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="erFontSize" className="text-xs">
                      Font size
                    </Label>
                    <Input
                      id="erFontSize"
                      type="number"
                      min={8}
                      max={40}
                      value={selected.fontSize}
                      onChange={(e) =>
                        updateShape(selected.id, {
                          fontSize: clamp(Number(e.target.value) || 14, 8, 40),
                        })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="erW" className="text-xs">
                      {selected.type === "line" ? "Δ X" : "Width"}
                    </Label>
                    <Input
                      id="erW"
                      type="number"
                      value={Math.round(selected.w)}
                      onChange={(e) => updateShape(selected.id, { w: Number(e.target.value) || 0 })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="erH" className="text-xs">
                      {selected.type === "line" ? "Δ Y" : "Height"}
                    </Label>
                    <Input
                      id="erH"
                      type="number"
                      value={Math.round(selected.h)}
                      onChange={(e) => updateShape(selected.id, { h: Number(e.target.value) || 0 })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => duplicateShape(selected)}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" title="Bring forward" onClick={() => reorder(selected.id, 1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" title="Send backward" onClick={() => reorder(selected.id, -1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="sm" variant="destructive" className="h-8 gap-1 px-2 text-xs" onClick={() => removeShape(selected.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <MousePointer2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Select a shape on the canvas to edit its text, size, or order.
              </p>
            )}

            <Separator />

            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={clearPage}>
                <Eraser className="h-3.5 w-3.5" />
                Clear page
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => removePage(pageIndex)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete page
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <div className="overflow-hidden rounded-lg border border-border bg-muted/20 p-3">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${ER_PAGE_WIDTH} ${ER_PAGE_HEIGHT}`}
              className="h-auto w-full touch-none rounded-md bg-white shadow-sm"
              style={{ aspectRatio: `${ER_PAGE_WIDTH} / ${ER_PAGE_HEIGHT}` }}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerDown={() => setSelectedId(null)}
            >
              <defs>
                <pattern id="erGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#eef1f6" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={ER_PAGE_WIDTH} height={ER_PAGE_HEIGHT} fill="url(#erGrid)" />

              {page.shapes.map((shape) => {
                const isSelected = shape.id === selectedId;
                const hitX = Math.min(shape.x, shape.x + shape.w);
                const hitY = Math.min(shape.y, shape.y + shape.h);
                const hitW = Math.max(Math.abs(shape.w), 10);
                const hitH = Math.max(Math.abs(shape.h), 10);

                return (
                  <g key={shape.id}>
                    <g dangerouslySetInnerHTML={{ __html: shapeMarkup(shape) }} />

                    {/* invisible hit area for dragging */}
                    <rect
                      x={shape.type === "line" ? hitX : shape.x}
                      y={shape.type === "line" ? hitY - 6 : shape.y}
                      width={shape.type === "line" ? hitW : shape.w}
                      height={shape.type === "line" ? hitH + 12 : shape.h}
                      fill="transparent"
                      style={{ cursor: "move" }}
                      onPointerDown={(e) => beginDrag(e, shape, "move")}
                    />

                    {isSelected && shape.type !== "line" && (
                      <>
                        <rect
                          x={shape.x - 3}
                          y={shape.y - 3}
                          width={shape.w + 6}
                          height={shape.h + 6}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="1.5"
                          strokeDasharray="5 4"
                          pointerEvents="none"
                        />
                        <rect
                          x={shape.x + shape.w - 5}
                          y={shape.y + shape.h - 5}
                          width="12"
                          height="12"
                          fill="#2563eb"
                          rx="2"
                          style={{ cursor: "nwse-resize" }}
                          onPointerDown={(e) => beginDrag(e, shape, "resize")}
                        />
                      </>
                    )}

                    {isSelected && shape.type === "line" && (
                      <>
                        <circle
                          cx={shape.x}
                          cy={shape.y}
                          r="7"
                          fill="#2563eb"
                          style={{ cursor: "grab" }}
                          onPointerDown={(e) => beginDrag(e, shape, "start")}
                        />
                        <circle
                          cx={shape.x + shape.w}
                          cy={shape.y + shape.h}
                          r="7"
                          fill="#2563eb"
                          style={{ cursor: "grab" }}
                          onPointerDown={(e) => beginDrag(e, shape, "end")}
                        />
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Page {pageIndex + 1} of {pages.length} · A4 printable area ({ER_PAGE_WIDTH} ×{" "}
              {ER_PAGE_HEIGHT})
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export default ERDiagramEditor;
