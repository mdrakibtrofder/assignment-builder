import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Gate types
const GATE_NAMES = ["AND", "OR", "NOT", "NAND", "NOR", "X-OR"] as const;
type GateName = (typeof GATE_NAMES)[number];

// SVG symbols for each gate
const GateSymbolSVG: Record<GateName, React.ReactNode> = {
  AND: (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <path d="M10,10 L50,10 Q100,10 100,40 Q100,70 50,70 L10,70 Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <line x1="0" y1="25" x2="10" y2="25" stroke="currentColor" strokeWidth="2" />
      <line x1="0" y1="55" x2="10" y2="55" stroke="currentColor" strokeWidth="2" />
      <line x1="100" y1="40" x2="120" y2="40" stroke="currentColor" strokeWidth="2" />
      <text x="2" y="22" fontSize="8" fill="currentColor">A</text>
      <text x="2" y="52" fontSize="8" fill="currentColor">B</text>
      <text x="108" y="37" fontSize="8" fill="currentColor">Y</text>
    </svg>
  ),
  OR: (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <path d="M10,10 Q30,10 60,10 Q95,10 105,40 Q95,70 60,70 Q30,70 10,70 Q30,40 10,10 Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <line x1="0" y1="25" x2="20" y2="25" stroke="currentColor" strokeWidth="2" />
      <line x1="0" y1="55" x2="20" y2="55" stroke="currentColor" strokeWidth="2" />
      <line x1="105" y1="40" x2="120" y2="40" stroke="currentColor" strokeWidth="2" />
      <text x="2" y="22" fontSize="8" fill="currentColor">A</text>
      <text x="2" y="52" fontSize="8" fill="currentColor">B</text>
      <text x="108" y="37" fontSize="8" fill="currentColor">Y</text>
    </svg>
  ),
  NOT: (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <polygon points="10,10 90,40 10,70" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="96" cy="40" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
      <line x1="0" y1="40" x2="10" y2="40" stroke="currentColor" strokeWidth="2" />
      <line x1="102" y1="40" x2="120" y2="40" stroke="currentColor" strokeWidth="2" />
      <text x="2" y="37" fontSize="8" fill="currentColor">A</text>
      <text x="108" y="37" fontSize="8" fill="currentColor">Y</text>
    </svg>
  ),
  NAND: (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <path d="M10,10 L50,10 Q95,10 95,40 Q95,70 50,70 L10,70 Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="101" cy="40" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
      <line x1="0" y1="25" x2="10" y2="25" stroke="currentColor" strokeWidth="2" />
      <line x1="0" y1="55" x2="10" y2="55" stroke="currentColor" strokeWidth="2" />
      <line x1="107" y1="40" x2="120" y2="40" stroke="currentColor" strokeWidth="2" />
      <text x="2" y="22" fontSize="8" fill="currentColor">A</text>
      <text x="2" y="52" fontSize="8" fill="currentColor">B</text>
      <text x="110" y="37" fontSize="8" fill="currentColor">Y</text>
    </svg>
  ),
  NOR: (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <path d="M10,10 Q30,10 60,10 Q90,10 100,40 Q90,70 60,70 Q30,70 10,70 Q30,40 10,10 Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="106" cy="40" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
      <line x1="0" y1="25" x2="20" y2="25" stroke="currentColor" strokeWidth="2" />
      <line x1="0" y1="55" x2="20" y2="55" stroke="currentColor" strokeWidth="2" />
      <line x1="112" y1="40" x2="120" y2="40" stroke="currentColor" strokeWidth="2" />
      <text x="2" y="22" fontSize="8" fill="currentColor">A</text>
      <text x="2" y="52" fontSize="8" fill="currentColor">B</text>
      <text x="113" y="37" fontSize="8" fill="currentColor">Y</text>
    </svg>
  ),
  "X-OR": (
    <svg viewBox="0 0 120 80" className="w-full h-full">
      <path d="M15,10 Q35,10 65,10 Q100,10 110,40 Q100,70 65,70 Q35,70 15,70 Q35,40 15,10 Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M8,10 Q28,40 8,70" fill="none" stroke="currentColor" strokeWidth="3" />
      <line x1="0" y1="25" x2="22" y2="25" stroke="currentColor" strokeWidth="2" />
      <line x1="0" y1="55" x2="22" y2="55" stroke="currentColor" strokeWidth="2" />
      <line x1="110" y1="40" x2="120" y2="40" stroke="currentColor" strokeWidth="2" />
      <text x="2" y="22" fontSize="8" fill="currentColor">A</text>
      <text x="2" y="52" fontSize="8" fill="currentColor">B</text>
      <text x="113" y="37" fontSize="8" fill="currentColor">Y</text>
    </svg>
  ),
};

// Boolean expressions for each gate
const GATE_EQUATIONS: Record<GateName, string> = {
  AND: "Y = A · B",
  OR: "Y = A + B",
  NOT: "Y = A̅ (or Y = ~A)",
  NAND: "Y = (A · B)̅",
  NOR: "Y = (A + B)̅",
  "X-OR": "Y = A ⊕ B",
};

const ALL_EQUATIONS = Object.entries(GATE_EQUATIONS).map(([gate, eq]) => ({
  gate,
  equation: eq,
}));

export interface GateSectionData {
  selectedSymbol: string;
  selectedEquation: string;
  inputType: "one" | "two";
  truthTable: string[][];
}

export type LogicGatesData = Record<GateName, GateSectionData>;

const createEmptyTruthTable = (inputType: "one" | "two"): string[][] => {
  if (inputType === "one") {
    return [
      ["", ""],
      ["", ""],
    ];
  }
  return [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
  ];
};

const createDefaultGateSection = (): GateSectionData => ({
  selectedSymbol: "",
  selectedEquation: "",
  inputType: "two",
  truthTable: createEmptyTruthTable("two"),
});

export const createDefaultLogicGatesData = (): LogicGatesData => {
  const data: Partial<LogicGatesData> = {};
  for (const gate of GATE_NAMES) {
    data[gate] = createDefaultGateSection();
  }
  return data as LogicGatesData;
};

interface LogicGatesBuilderProps {
  data: LogicGatesData;
  onChange: (data: LogicGatesData) => void;
}

const LogicGatesBuilder = ({ data, onChange }: LogicGatesBuilderProps) => {
  const updateGate = (gate: GateName, updates: Partial<GateSectionData>) => {
    const newData = { ...data };
    const current = { ...newData[gate] };

    if (updates.inputType && updates.inputType !== current.inputType) {
      current.truthTable = createEmptyTruthTable(updates.inputType);
    }

    Object.assign(current, updates);
    newData[gate] = current;
    onChange(newData);
  };

  const updateTruthTableCell = (
    gate: GateName,
    rowIdx: number,
    colIdx: number,
    value: string
  ) => {
    const newData = { ...data };
    const current = { ...newData[gate] };
    const newTable = current.truthTable.map((row) => [...row]);
    newTable[rowIdx][colIdx] = value;
    current.truthTable = newTable;
    newData[gate] = current;
    onChange(newData);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
          Logic Gates Builder
        </Badge>
      </div>

      <Accordion type="multiple" defaultValue={[...GATE_NAMES]} className="space-y-3">
        {GATE_NAMES.map((gate) => {
          const section = data[gate];
          return (
            <AccordionItem
              key={gate}
              value={gate}
              className="border border-border rounded-lg overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                <span className="font-semibold text-foreground">{gate} Gate</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid gap-5 md:grid-cols-2">
                  {/* Symbol Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Select Symbol</Label>
                    <Select
                      value={section.selectedSymbol}
                      onValueChange={(v) => updateGate(gate, { selectedSymbol: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose gate symbol" />
                      </SelectTrigger>
                      <SelectContent>
                        {GATE_NAMES.map((g) => (
                          <SelectItem key={g} value={g}>
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-7">{GateSymbolSVG[g]}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {section.selectedSymbol && (
                      <div className="mt-2 p-3 border border-border rounded-md bg-muted/20 flex justify-center">
                        <div className="w-28 h-20 text-primary">
                          {GateSymbolSVG[section.selectedSymbol as GateName]}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Equation Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Select Function / Equation</Label>
                    <Select
                      value={section.selectedEquation}
                      onValueChange={(v) => updateGate(gate, { selectedEquation: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose equation" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_EQUATIONS.map((eq) => (
                          <SelectItem key={eq.gate} value={eq.equation}>
                            {eq.gate}: {eq.equation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {section.selectedEquation && (
                      <div className="mt-2 p-3 border border-border rounded-md bg-muted/20 text-center">
                        <span className="text-lg font-mono font-semibold text-foreground">
                          {section.selectedEquation}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Truth Table Type */}
                  <div className="space-y-3 md:col-span-2">
                    <Label className="text-sm font-medium">Truth Table Type</Label>
                    <RadioGroup
                      value={section.inputType}
                      onValueChange={(v) =>
                        updateGate(gate, { inputType: v as "one" | "two" })
                      }
                      className="flex gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="one" id={`${gate}-one`} />
                        <Label htmlFor={`${gate}-one`} className="cursor-pointer">
                          One Input (A → Y)
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="two" id={`${gate}-two`} />
                        <Label htmlFor={`${gate}-two`} className="cursor-pointer">
                          Two Inputs (A, B → Y)
                        </Label>
                      </div>
                    </RadioGroup>

                    {/* Truth Table */}
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full max-w-md border-collapse border border-border text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            {section.inputType === "two" ? (
                              <>
                                <th className="border border-border px-4 py-2 font-semibold text-center">
                                  Input A
                                </th>
                                <th className="border border-border px-4 py-2 font-semibold text-center">
                                  Input B
                                </th>
                                <th className="border border-border px-4 py-2 font-semibold text-center">
                                  Output Y
                                </th>
                              </>
                            ) : (
                              <>
                                <th className="border border-border px-4 py-2 font-semibold text-center">
                                  Input A
                                </th>
                                <th className="border border-border px-4 py-2 font-semibold text-center">
                                  Output Y
                                </th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {section.truthTable.map((row, rowIdx) => (
                            <tr key={rowIdx}>
                              {row.map((cell, colIdx) => (
                                <td
                                  key={colIdx}
                                  className="border border-border px-2 py-1 text-center"
                                >
                                  <Input
                                    value={cell}
                                    onChange={(e) =>
                                      updateTruthTableCell(
                                        gate,
                                        rowIdx,
                                        colIdx,
                                        e.target.value
                                      )
                                    }
                                    className="h-8 text-center border-0 bg-transparent focus-visible:ring-1"
                                    placeholder="0/1"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default LogicGatesBuilder;
