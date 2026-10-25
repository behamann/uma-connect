import { GRADES, type Category, type Character, type Grade, type TraineeVersion } from "./types";

const GRADE_RANK: Record<Grade, number> = Object.fromEntries(GRADES.map((g, i) => [g, i])) as Record<
  Grade,
  number
>;

export function gradeAtLeast(grade: Grade, min: Grade): boolean {
  return GRADE_RANK[grade] <= GRADE_RANK[min];
}

export function matches(
  category: Category,
  trainee: TraineeVersion,
  character: Character,
): boolean {
  const m = category.match;
  switch (m.type) {
    case "aptitude": {
      const axis = trainee.aptitudes[m.axis] as Record<string, Grade>;
      const grade = axis[m.key];
      return grade !== undefined && gradeAtLeast(grade, m.min);
    }
    case "equals":
      return (m.field === "dorm" ? character.dorm : character.irl.coat) === m.value;
    case "birthMonth":
      return m.months.includes(character.birthday.month);
    case "includes": {
      const list: readonly string[] =
        m.field === "irl.g1Wins"
          ? character.irl.g1Wins
          : m.field === "irl.maleLine"
            ? character.irl.maleLine
            : character.irl.titles;
      return m.values.some((v) => list.includes(v));
    }
    case "atLeast":
      return character.irl.g1WinCount >= m.value;
    case "range":
      return character.irl.birthYear >= m.min && character.irl.birthYear <= m.max;
  }
}
