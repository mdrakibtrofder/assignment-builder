import type { LogicGatesData } from "@/components/LogicGatesBuilder";
import type { ERDiagramData } from "@/components/ERDiagramEditor";
import { erDiagramIsEmpty } from "@/components/ERDiagramEditor";

export interface AssignmentFormState {
  courseCode: string;
  courseName: string;
  department: string;
  studentId: string;
  studentName: string;
  assignmentNo: string;
  date?: Date | null;
  editorHtml: string;
  /** Only supplied when the logic gates builder is the active content mode. */
  logicGatesData?: LogicGatesData;
  /** Only supplied when the ER diagram drawer is available for the course. */
  erDiagramData?: ERDiagramData;
  /** True when the selected course unlocks the ER diagram drawer. */
  erDiagramAvailable?: boolean;
}

/** True when tiptap HTML carries no visible text and no images. */
export function isEditorEmpty(html: string): boolean {
  if (!html) return true;
  if (/<img\b/i.test(html)) return false;
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return text.length === 0;
}

/**
 * Returns a human-readable list of everything still missing.
 * An empty array means the assignment is ready to export.
 */
export function getIncompleteFields(state: AssignmentFormState): string[] {
  const missing: string[] = [];

  if (!state.courseCode.trim()) missing.push("Course Code is empty");
  if (!state.courseName.trim()) missing.push("Course Name is empty");
  if (!state.department.trim()) missing.push("Department is empty");
  if (!state.studentName.trim()) missing.push("Student Name is empty");

  if (!state.studentId.trim()) {
    missing.push("Student ID is empty");
  } else if (state.studentId.trim().length < 10) {
    missing.push("Student ID is incomplete (e.g. 0802510102161001)");
  }

  if (!state.assignmentNo.trim()) missing.push("Assignment No is empty");
  if (!state.date || Number.isNaN(state.date.getTime())) missing.push("Date is empty");

  if (state.logicGatesData) {
    const incompleteGates = Object.entries(state.logicGatesData)
      .filter(([, section]) => !section?.selectedSymbol || !section?.selectedEquation)
      .map(([gate]) => gate);

    if (incompleteGates.length > 0) {
      missing.push(
        `Logic Gates Builder is incomplete (${incompleteGates.join(", ")} — symbol or expression not selected)`
      );
    }
  } else {
    const hasText = !isEditorEmpty(state.editorHtml);
    const hasDiagram = !!state.erDiagramAvailable && !erDiagramIsEmpty(state.erDiagramData);

    if (!hasText && !hasDiagram) {
      missing.push(
        state.erDiagramAvailable
          ? "Assignment Content is empty (write text or draw an ER diagram)"
          : "Assignment Content is empty"
      );
    }
  }

  return missing;
}
