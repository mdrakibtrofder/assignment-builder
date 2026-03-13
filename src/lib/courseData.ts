export interface CourseInfo {
  code: string;
  name: string;
  department: string;
}

export const courses: CourseInfo[] = [
  {
    code: "CSE 4215",
    name: "Professional Issues and Ethics in Computer Science",
    department: "Department of Computer Science and Engineering",
  },
  {
    code: "CSE 2123",
    name: "Introduction to Computer Programming",
    department: "Department of Civil Engineering",
  },
  {
    code: "CSE 2124",
    name: "Introduction to Computer Programming Sessional",
    department: "Department of Civil Engineering",
  },
  {
    code: "CSE 2109",
    name: "Computer Fundamentals",
    department: "Department of English",
  },
  {
    code: "CSE 2110",
    name: "Computer Fundamentals Sessional",
    department: "Department of English",
  },
  {
    code: "CSE 1204",
    name: "Computer Applications in Business Sessional",
    department: "Department of Business Administration",
  },
];

export function getCourseByCode(code: string): CourseInfo | undefined {
  return courses.find((c) => c.code === code);
}
