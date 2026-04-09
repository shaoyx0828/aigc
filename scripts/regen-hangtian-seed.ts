/**
 * 从项目根目录「航天日题库.docx」重新生成 prisma/hangtian-bank.seed.json（便于 CI/无 docx 环境）。
 * 用法：pnpm exec tsx scripts/regen-hangtian-seed.ts [可选 docx 路径]
 */
import fs from "node:fs";
import path from "node:path";
import { parseHangtianBankFromDocxBuffer } from "../lib/quiz/hangtian-bank-import";

const root = process.cwd();
const docxArg = process.argv[2];
const docxPath = docxArg
  ? path.resolve(docxArg)
  : path.join(root, "航天日题库.docx");

if (!fs.existsSync(docxPath)) {
  console.error("找不到 docx:", docxPath);
  process.exit(1);
}

const buf = fs.readFileSync(docxPath);
const rows = await parseHangtianBankFromDocxBuffer(buf);
const out = path.join(root, "prisma", "hangtian-bank.seed.json");
fs.writeFileSync(out, JSON.stringify(rows, null, 2), "utf8");
console.log("已写入", out, "共", rows.length, "题");
