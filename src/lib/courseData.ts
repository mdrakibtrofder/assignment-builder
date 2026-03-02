export interface CourseInfo {
  code: string;
  name: string;
  department: string;
}

export const courses: CourseInfo[] = [
  {
    code: "CSE 4215",
    name: "Professional Issues and Ethics in Computer Science",
    department: "Computer Science and Engineering",
  },
  {
    code: "CSE 2123",
    name: "Introduction to Computer Programming",
    department: "Civil Engineering Department",
  },
];

export function getCourseByCode(code: string): CourseInfo | undefined {
  return courses.find((c) => c.code === code);
}
