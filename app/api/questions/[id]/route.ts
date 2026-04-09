import { NextResponse } from "next/server";
import { assertAdminOr401 } from "@/lib/assert-admin-api";
import { prisma } from "@/lib/db";
import { questionWriteSchema } from "@/lib/schemas/question";
const patchSchema = questionWriteSchema.partial();

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const deny = await assertAdminOr401();
  if (deny) return deny;
  const { id } = await context.params;
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(q);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const deny = await assertAdminOr401();
  if (deny) return deny;
  const { id } = await context.params;
  try {
    const json = await request.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "校验失败", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const updated = await prisma.question.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const deny = await assertAdminOr401();
  if (deny) return deny;
  const { id } = await context.params;
  try {
    await prisma.question.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "删除失败，题目可能已被引用" }, { status: 400 });
  }
}
