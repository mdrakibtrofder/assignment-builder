import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { Editor } from "@tiptap/react";
import {
  FileText,
  Download,
  GraduationCap,
  CalendarIcon,
  RotateCcw,
  AlertCircle,
  Network,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { courses, getCourseByCode, ER_DIAGRAM_COURSE_CODE } from "@/lib/courseData";
import RichTextEditor from "@/components/RichTextEditor";
import LogicGatesBuilder, {
  LogicGatesData,
  createDefaultLogicGatesData,
} from "@/components/LogicGatesBuilder";
import ERDiagramEditor, {
  ERDiagramData,
  createDefaultERDiagramData,
  normalizeERDiagramData,
} from "@/components/ERDiagramEditor";
import { exportToPDF, exportToDocx } from "@/lib/exportUtils";
import { getIncompleteFields } from "@/lib/validation";
import baustLogo from "@/assets/baust-logo.jpeg";

const STORAGE_KEY = "baust-assignment-builder";

const UNIVERSITY_NAME = "Bangladesh Army University of Science and Technology";
const UNIVERSITY_SUBTITLE = "Saidpur, Nilphamari";

interface StoredData {
  courseCode: string;
  courseName: string;
  department: string;
  studentId: string;
  studentName: string;
  date: string;
  assignmentNo: string;
  logicGatesData: LogicGatesData;
  erDiagramData: ERDiagramData;
  contentMode: "editor" | "gates";
  editorHtml: string;
}

function loadFromStorage(): Partial<StoredData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore corrupt storage */
  }
  return {};
}

function saveToStorage(data: StoredData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full or unavailable */
  }
}

const Index = () => {
  const stored = useRef(loadFromStorage()).current;

  const [courseCode, setCourseCode] = useState(stored.courseCode || "");
  const [courseName, setCourseName] = useState(stored.courseName || "");
  const [department, setDepartment] = useState(stored.department || "");
  const [studentId, setStudentId] = useState(stored.studentId || "");
  const [studentName, setStudentName] = useState(stored.studentName || "");
  const [date, setDate] = useState<Date>(stored.date ? new Date(stored.date) : new Date());
  const [assignmentNo, setAssignmentNo] = useState(stored.assignmentNo || "1");
  const [logicGatesData, setLogicGatesData] = useState<LogicGatesData>(
    stored.logicGatesData || createDefaultLogicGatesData()
  );
  const [erDiagramData, setErDiagramData] = useState<ERDiagramData>(() =>
    stored.erDiagramData ? normalizeERDiagramData(stored.erDiagramData) : createDefaultERDiagramData()
  );
  const [contentMode, setContentMode] = useState<"editor" | "gates">(stored.contentMode || "gates");
  const [editorHtml, setEditorHtml] = useState(stored.editorHtml || "");
  const editorRef = useRef<Editor | null>(null);

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  const [incompleteFields, setIncompleteFields] = useState<string[]>([]);
  const [incompleteDialogOpen, setIncompleteDialogOpen] = useState(false);
  const [exporting, setExporting] = useState<null | "pdf" | "docx">(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const isLogicGatesScenario = courseCode === "CSE 2109" && assignmentNo === "1";
  const isErDiagramScenario = courseCode === ER_DIAGRAM_COURSE_CODE;

  // Persist to localStorage
  useEffect(() => {
    saveToStorage({
      courseCode,
      courseName,
      department,
      studentId,
      studentName,
      date: date.toISOString(),
      assignmentNo,
      logicGatesData,
      erDiagramData,
      contentMode,
      editorHtml,
    });
  }, [
    courseCode,
    courseName,
    department,
    studentId,
    studentName,
    date,
    assignmentNo,
    logicGatesData,
    erDiagramData,
    contentMode,
    editorHtml,
  ]);

  const handleEditorUpdate = useCallback((editor: Editor) => {
    setEditorHtml(editor.getHTML());
  }, []);

  const attachEditor = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      if (editorHtml && !editor.getHTML().replace(/<[^>]*>/g, "").trim()) {
        editor.commands.setContent(editorHtml);
      }
    },
    [editorHtml]
  );

  const handleCourseChange = (code: string) => {
    setCourseCode(code);
    const course = getCourseByCode(code);
    if (course) {
      // Course Name and Department are always derived from the course code.
      setCourseName(course.name);
      setDepartment(course.department);
    } else {
      setCourseName("");
      setDepartment("");
    }
  };

  const handleStudentIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStudentId(e.target.value.replace(/\D/g, "").slice(0, 20));
  };

  const handleReset = () => {
    if (resetConfirmText !== "Yes") return;
    setCourseCode("");
    setCourseName("");
    setDepartment("");
    setStudentId("");
    setStudentName("");
    setDate(new Date());
    setAssignmentNo("1");
    setLogicGatesData(createDefaultLogicGatesData());
    setErDiagramData(createDefaultERDiagramData());
    setContentMode("gates");
    setEditorHtml("");
    editorRef.current?.commands.setContent("");
    localStorage.removeItem(STORAGE_KEY);
    setResetDialogOpen(false);
    setResetConfirmText("");
  };

  /**
   * Radix unmounts inactive tab panels, which destroys the tiptap instance.
   * Reading from a destroyed editor throws, so always fall back to the last
   * HTML we stored in state.
   */
  const currentEditorHtml = useCallback((): string => {
    const editor = editorRef.current;
    try {
      if (editor && !editor.isDestroyed) {
        const html = editor.getHTML();
        if (html) return html;
      }
    } catch {
      /* editor was torn down — fall through to state */
    }
    return editorHtml;
  }, [editorHtml]);

  const activeLogicGatesData = useMemo(
    () => (isLogicGatesScenario && contentMode === "gates" ? logicGatesData : undefined),
    [isLogicGatesScenario, contentMode, logicGatesData]
  );

  const getExportData = () => ({
    universityName: UNIVERSITY_NAME,
    universitySubtitle: UNIVERSITY_SUBTITLE,
    department,
    courseCode,
    courseName,
    studentName,
    studentId,
    assignmentNo,
    date: format(date, "PPP"),
    editorHtml: currentEditorHtml(),
    logicGatesData: activeLogicGatesData,
    erDiagramData: isErDiagramScenario ? erDiagramData : undefined,
  });

  /** Runs validation; returns true when the export may proceed. */
  const validateBeforeExport = (): boolean => {
    const missing = getIncompleteFields({
      courseCode,
      courseName,
      department,
      studentId,
      studentName,
      assignmentNo,
      date,
      editorHtml: currentEditorHtml(),
      logicGatesData: activeLogicGatesData,
      erDiagramData: isErDiagramScenario ? erDiagramData : undefined,
      erDiagramAvailable: isErDiagramScenario,
    });

    if (missing.length > 0) {
      setIncompleteFields(missing);
      setIncompleteDialogOpen(true);
      return false;
    }
    return true;
  };

  const runExport = async (kind: "pdf" | "docx") => {
    if (exporting) return;
    if (!validateBeforeExport()) return;

    setExportError(null);
    setExporting(kind);
    try {
      const data = getExportData();
      if (kind === "pdf") {
        await exportToPDF(data);
      } else {
        await exportToDocx(data);
      }
    } catch (err) {
      console.error(`${kind.toUpperCase()} export failed`, err);
      setExportError(
        err instanceof Error ? err.message : "Something went wrong while generating the file."
      );
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = () => runExport("pdf");
  const handleExportDocx = () => runExport("docx");

  const editorBlock = (
    <RichTextEditor
      onEditorReady={attachEditor}
      onUpdate={handleEditorUpdate}
      initialContent={editorHtml}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold text-foreground">Assignment Builder</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResetDialogOpen(true)}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exporting !== null}
              className="gap-1.5"
            >
              {exporting === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PDF
            </Button>
            <Button size="sm" onClick={handleExportDocx} disabled={exporting !== null} className="gap-1.5">
              {exporting === "docx" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              DOCX
            </Button>
          </div>
        </div>
      </header>

      {/* Incomplete fields dialog */}
      <Dialog open={incompleteDialogOpen} onOpenChange={setIncompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Incomplete Information
            </DialogTitle>
            <DialogDescription>
              Please complete the following {incompleteFields.length === 1 ? "field" : "fields"}{" "}
              before downloading your assignment as PDF or DOCX.
            </DialogDescription>
          </DialogHeader>
          <ul className="my-2 space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
            {incompleteFields.map((field) => (
              <li key={field} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                <span>{field}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setIncompleteDialogOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export error dialog */}
      <Dialog open={exportError !== null} onOpenChange={() => setExportError(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Export Failed
            </DialogTitle>
            <DialogDescription>{exportError}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setExportError(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset All Data</DialogTitle>
            <DialogDescription>
              This will clear all your assignment data including form fields, editor content, ER
              diagram, and logic gates builder data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Label htmlFor="resetConfirm">
              Type <span className="font-bold text-destructive">Yes</span> to confirm
            </Label>
            <Input
              id="resetConfirm"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder='Type "Yes" to confirm'
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetDialogOpen(false);
                setResetConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetConfirmText !== "Yes"}>
              Reset Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* University Header */}
        <Card className="mb-8 overflow-hidden border-border shadow-sm">
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <img
                src={baustLogo}
                alt="BAUST Logo"
                className="h-24 w-24 rounded-full border border-border bg-card object-contain p-1 shadow-sm"
              />
              <div>
                <h1 className="text-xl font-bold text-foreground md:text-2xl">{UNIVERSITY_NAME}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{UNIVERSITY_SUBTITLE}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Form */}
        <Card className="mb-8 border-border shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Assignment Details</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Course Code */}
              <div className="space-y-2">
                <Label htmlFor="courseCode">Course Code</Label>
                <Select value={courseCode} onValueChange={handleCourseChange}>
                  <SelectTrigger id="courseCode">
                    <SelectValue placeholder="Select course code" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Course Name */}
              <div className="space-y-2">
                <Label htmlFor="courseName">Course Name</Label>
                <Input
                  id="courseName"
                  value={courseName}
                  readOnly
                  placeholder="Auto-selected"
                  className="bg-muted/50"
                />
              </div>

              {/* Department */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={department}
                  readOnly
                  placeholder="Auto-selected"
                  className="bg-muted/50"
                />
              </div>

              {/* Student ID */}
              <div className="space-y-2">
                <Label htmlFor="studentId">Student ID</Label>
                <Input
                  id="studentId"
                  value={studentId}
                  onChange={handleStudentIdChange}
                  placeholder="e.g. 0802510102161001"
                  inputMode="numeric"
                />
              </div>

              {/* Student Name */}
              <div className="space-y-2">
                <Label htmlFor="studentName">Student Name</Label>
                <Input
                  id="studentName"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter student name"
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      initialFocus
                      className="pointer-events-auto p-3"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Assignment No */}
              <div className="space-y-2">
                <Label htmlFor="assignmentNo">Assignment No</Label>
                <Select value={assignmentNo} onValueChange={setAssignmentNo}>
                  <SelectTrigger id="assignmentNo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Assignment {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Area */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Assignment Content</h2>
          </div>

          {isLogicGatesScenario ? (
            <Tabs
              value={contentMode}
              onValueChange={(v) => setContentMode(v as "editor" | "gates")}
              className="mb-4"
            >
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="gates">Logic Gates Builder</TabsTrigger>
                <TabsTrigger value="editor">Text Editor</TabsTrigger>
              </TabsList>
              <TabsContent value="gates" className="mt-4">
                <LogicGatesBuilder data={logicGatesData} onChange={setLogicGatesData} />
              </TabsContent>
              <TabsContent value="editor" className="mt-4">
                {editorBlock}
              </TabsContent>
            </Tabs>
          ) : isErDiagramScenario ? (
            <Tabs defaultValue="editor">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="editor">Text Editor</TabsTrigger>
                <TabsTrigger value="er" className="gap-1.5">
                  <Network className="h-3.5 w-3.5" />
                  ER Diagram
                </TabsTrigger>
              </TabsList>
              <TabsContent value="editor" className="mt-4">
                {editorBlock}
              </TabsContent>
              <TabsContent value="er" className="mt-4">
                <ERDiagramEditor data={erDiagramData} onChange={setErDiagramData} />
              </TabsContent>
            </Tabs>
          ) : (
            editorBlock
          )}

          {isErDiagramScenario && (
            <p className="mt-3 text-xs text-muted-foreground">
              {ER_DIAGRAM_COURSE_CODE} unlocks the ER Diagram drawer. Anything you draw is appended
              after your written content in both the PDF and DOCX export.
            </p>
          )}
        </div>

        {/* Export Buttons */}
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              variant="outline"
              onClick={handleExportPDF}
              disabled={exporting !== null}
              className="w-full gap-2 sm:w-auto"
            >
              {exporting === "pdf" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              {exporting === "pdf" ? "Preparing PDF…" : "Export as PDF"}
            </Button>
            <Button
              size="lg"
              onClick={handleExportDocx}
              disabled={exporting !== null}
              className="w-full gap-2 sm:w-auto"
            >
              {exporting === "docx" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              {exporting === "docx" ? "Preparing DOCX…" : "Export as DOCX"}
            </Button>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-border py-6 text-center text-sm text-muted-foreground">
        Assignment Builder — BAUST, Saidpur
      </footer>
    </div>
  );
};

export default Index;
