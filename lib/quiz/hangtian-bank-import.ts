import JSZip from "jszip";

export type HangtianParsedRow = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
};

/** 从 Word OOXML（document.xml 字符串）提取段落纯文本 */
export function stripDocxPlainText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "");
}

/**
 * 解析「航天日题库」类纯文本：题干 + A–D + 答案：X。
 * 题干以「？」或「?」结尾；其后 4 行为选项（允许前两行缺 A./B. 前缀）。
 */
export function parseHangtianBankPlainText(text: string): HangtianParsedRow[] {
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  const re = /([\s\S]*?)答案[：:]\s*([ABCD])/g;
  const raw: { block: string; answer: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    raw.push({ block: m[1].trim(), answer: m[2] });
  }
  const out: HangtianParsedRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    let { block, answer } = raw[i];
    if (i === 0) {
      block = block.replace(/^2026中国航天日题库\s*\n?/, "").trim();
    }
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 5) {
      throw new Error(`题目块行数不足: ${block.slice(0, 80)}…`);
    }
    let qEndIdx = lines.findIndex((l) => /[？?]$/.test(l));
    if (qEndIdx < 0) {
      qEndIdx = -1;
      for (let j = 0; j < lines.length; j++) {
        if (/^[A-D][.．、]\s*.+/.test(lines[j])) {
          qEndIdx = j - 1;
          break;
        }
      }
    }
    if (qEndIdx < 0) {
      throw new Error(`无法定位题干结束: ${lines[0]?.slice(0, 60)}`);
    }
    const question = lines.slice(0, qEndIdx + 1).join("\n").trim();
    const rest = lines.slice(qEndIdx + 1, qEndIdx + 5);
    if (rest.length < 4) {
      throw new Error(`选项不足4行: ${question.slice(0, 60)}…`);
    }
    const opt = {
      A: "",
      B: "",
      C: "",
      D: "",
    };
    let expectCode = "A".charCodeAt(0);
    for (const line of rest.slice(0, 4)) {
      const labeled = line.match(/^([A-D])[.．、]\s*(.+)$/);
      if (labeled) {
        const k = labeled[1] as keyof typeof opt;
        opt[k] = labeled[2].trim();
        expectCode = k.charCodeAt(0) + 1;
      } else {
        const k = String.fromCharCode(expectCode);
        if (k > "D") {
          throw new Error(`无法分配选项行: ${line}`);
        }
        opt[k as keyof typeof opt] = line.trim();
        expectCode++;
      }
    }
    if (!opt.A || !opt.B || !opt.C || !opt.D || !question) {
      throw new Error(`解析出空字段: ${question.slice(0, 60)}`);
    }
    out.push({
      question,
      optionA: opt.A,
      optionB: opt.B,
      optionC: opt.C,
      optionD: opt.D,
      correctOption: answer,
    });
  }
  return out;
}

/** 从 .docx 二进制读取 `word/document.xml` 并解析题库 */
export async function parseHangtianBankFromDocxBuffer(
  buf: Buffer
): Promise<HangtianParsedRow[]> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("word/document.xml");
  if (!file) {
    throw new Error("docx 中缺少 word/document.xml");
  }
  const xml = await file.async("string");
  return parseHangtianBankPlainText(stripDocxPlainText(xml));
}
