import { NextResponse } from "next/server";
import { QuestionType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { assertAdminOr401 } from "@/lib/assert-admin-api";
import { prisma } from "@/lib/db";
import { questionWriteSchema } from "@/lib/schemas/question";

/**
 * GET：题库列表（管理端筛选）
 * POST：新增题目
 */
export async function GET(request: Request) {
  const deny = await assertAdminOr401();
  if (deny) return deny;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const category = searchParams.get("category")?.trim();
  const type = searchParams.get("type") as QuestionType | null;
  const enabledRaw = searchParams.get("enabled");

  const where: Prisma.QuestionWhereInput = {};
  if (search) {
    where.OR = [
      { question: { contains: search } },
      { category: { contains: search } },
    ];
  }
  if (category) where.category = category;
  if (type && Object.values(QuestionType).includes(type)) where.type = type;
  if (enabledRaw === "true") where.enabled = true;
  if (enabledRaw === "false") where.enabled = false;

  const items = await prisma.question.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const deny = await assertAdminOr401();
  if (deny) return deny;
  try {
    const json = await request.json();
    const parsed = questionWriteSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "校验失败", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const created = await prisma.question.create({ data: parsed.data });
    return NextResponse.json(created);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
