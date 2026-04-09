/**
 * 种子数据：2026 中国航天日题库（自 `航天日题库.docx` 或 `hangtian-bank.seed.json`）。
 * 执行前会清空场次与答案。
 */
import fs from "node:fs";
import path from "node:path";
import {
  PrismaClient,
  QuestionType,
  Difficulty,
  ReviewStatus,
} from "@prisma/client";
import { QUIZ_QUESTION_TIME_LIMIT_SEC } from "../lib/quiz/quiz-ui-constants";
import {
  parseHangtianBankFromDocxBuffer,
  type HangtianParsedRow,
} from "../lib/quiz/hangtian-bank-import";

const prisma = new PrismaClient();

async function loadHangtianRows(): Promise<HangtianParsedRow[]> {
  const root = process.cwd();
  const docxPath = path.join(root, "航天日题库.docx");
  if (fs.existsSync(docxPath)) {
    const buf = fs.readFileSync(docxPath);
    const rows = await parseHangtianBankFromDocxBuffer(buf);
    console.log(`已从 ${path.basename(docxPath)} 解析 ${rows.length} 道题。`);
    return rows;
  }
  const jsonPath = path.join(root, "prisma", "hangtian-bank.seed.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `未找到题库：请将「航天日题库.docx」放在项目根目录，或保留 prisma/hangtian-bank.seed.json`
    );
  }
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as HangtianParsedRow[];
  console.log(`已从 hangtian-bank.seed.json 加载 ${raw.length} 道题（根目录无 docx 时回退）。`);
  return raw;
}

async function main() {
  const parsed = await loadHangtianRows();
  if (parsed.length === 0) {
    throw new Error("题库为空");
  }

  await prisma.quizAnswer.deleteMany();
  await prisma.quizSession.deleteMany();
  await prisma.question.deleteMany();

  const rows = parsed.map((q) => ({
    category: "2026中国航天日",
    type: QuestionType.single_choice,
    difficulty: Difficulty.medium,
    question: q.question,
    aliases: "",
    canonicalAnswer: q.correctOption,
    avatarAnswer: `本题正确选项是 ${q.correctOption}。`,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctOption: q.correctOption,
    keywords: "",
    explanation: `正确答案：${q.correctOption}。`,
    score: 10,
    timeLimitSec: QUIZ_QUESTION_TIME_LIMIT_SEC,
    enabled: true,
    sourceDoc: "航天日题库.docx",
    sourceVersion: "2026航天日",
    reviewStatus: ReviewStatus.reviewed,
  }));

  await prisma.question.createMany({ data: rows });
  console.log(`Seeded ${rows.length} single_choice questions (航天日题库).`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
