import React, { useState, useRef } from "react";
import { format } from "date-fns";
import { Editor } from "@tiptap/react";
import { FileText, Download, GraduationCap, CalendarIcon } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { courses, getCourseByCode } from "@/lib/courseData";
import RichTextEditor from "@/components/RichTextEditor";
import LogicGatesBuilder, {
  LogicGatesData,
  createDefaultLogicGatesData,
} from "@/components/LogicGatesBuilder";
import { exportToPDF, exportToDocx } from "@/lib/exportUtils";
import baustLogo from "@/assets/baust-logo.jpeg";

const Index = () => {
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [department, setDepartment] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [assignmentNo, setAssignmentNo] = useState("1");
  const [logicGatesData, setLogicGatesData] = useState<LogicGatesData>(
    createDefaultLogicGatesData()
  );
  const [contentMode, setContentMode] = useState<"editor" | "gates">("editor");
  const editorRef = useRef<Editor | null>(null);

  const isLogicGatesScenario = courseCode === "CSE 2109" && assignmentNo === "1";

  const handleCourseChange = (code: string) => {
    setCourseCode(code);
    const course = getCourseByCode(code);
    if (course) {
      setCourseName(course.name);
      setDepartment(course.department);
    }
  };

  const handleStudentIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    setStudentId(value);
  };

  const getExportData = () => ({
    universityName:
      "Bangladesh Army University of Science and Technology, Saidpur",
    department,
    courseCode,
    courseName,
    studentName,
    studentId,
    assignmentNo,
    date: format(date, "PPP"),
    editorHtml: editorRef.current?.getHTML() || "",
    logicGatesData:
      isLogicGatesScenario && contentMode === "gates"
        ? logicGatesData
        : undefined,
  });

  const handleExportPDF = () => exportToPDF(getExportData());
  const handleExportDocx = () => exportToDocx(getExportData());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold text-foreground">
              Assignment Builder
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button
              size="sm"
              onClick={handleExportDocx}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              DOCX
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* University Header */}
        <Card className="mb-8 overflow-hidden border-border shadow-sm">
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <img
                src={baustLogo}
                alt="BAUST Logo"
                className="h-24 w-24 rounded-full object-contain bg-card p-1 shadow-sm border border-border"
              />
              <div>
                <h1 className="text-xl font-bold text-foreground md:text-2xl">
                  Bangladesh Army University of Science and Technology
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Saidpur, Nilphamari
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Form */}
        <Card className="mb-8 border-border shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                Assignment Details
              </h2>
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
                  placeholder="Enter student ID (digits only)"
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
                      className="p-3 pointer-events-auto"
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
          {isLogicGatesScenario ? (
            <>
              <Tabs
                value={contentMode}
                onValueChange={(v) => setContentMode(v as "editor" | "gates")}
                className="mb-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Assignment Content
                  </h2>
                </div>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="gates">Logic Gates Builder</TabsTrigger>
                  <TabsTrigger value="editor">Text Editor</TabsTrigger>
                </TabsList>
                <TabsContent value="gates" className="mt-4">
                  <LogicGatesBuilder
                    data={logicGatesData}
                    onChange={setLogicGatesData}
                  />
                </TabsContent>
                <TabsContent value="editor" className="mt-4">
                  <RichTextEditor
                    onEditorReady={(editor) => (editorRef.current = editor)}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">
                  Assignment Content
                </h2>
              </div>
              <RichTextEditor
                onEditorReady={(editor) => (editorRef.current = editor)}
              />
            </>
          )}
        </div>

        {/* Export Buttons */}
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              variant="outline"
              onClick={handleExportPDF}
              className="w-full gap-2 sm:w-auto"
            >
              <Download className="h-5 w-5" />
              Export as PDF
            </Button>
            <Button
              size="lg"
              onClick={handleExportDocx}
              className="w-full gap-2 sm:w-auto"
            >
              <Download className="h-5 w-5" />
              Export as DOCX
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
