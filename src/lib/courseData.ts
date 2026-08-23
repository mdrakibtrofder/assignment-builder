export interface CourseInfo {
  code: string;
  name: string;
  department: string;
}

const CSE_DEPARTMENT = "Department of Computer Science and Engineering";

/**
 * Order matters — the first four entries are pinned to the top of the
 * Course Code dropdown, with CSE 2205 first.
 */
export const courses: CourseInfo[] = [
  {
    code: "CSE 2205",
    name: "Database Management Systems",
    department: CSE_DEPARTMENT,
  },
  {
    code: "CSE 2206",
    name: "Database Management Systems Sessional",
    department: CSE_DEPARTMENT,
  },
  {
    code: "CSE 3100",
    name: "Software Development Project II",
    department: CSE_DEPARTMENT,
  },
  {
    code: "CSE 3102",
    name: "Software Engineering Sessional",
    department: CSE_DEPARTMENT,
  },
  {
    code: "CSE 4215",
    name: "Professional Issues and Ethics in Computer Science",
    department: CSE_DEPARTMENT,
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

/** Course code that unlocks the ER Diagram drawer. */
export const ER_DIAGRAM_COURSE_CODE = "CSE 2205";

export function getCourseByCode(code: string): CourseInfo | undefined {
  return courses.find((c) => c.code === code);
}
