"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  QuestionType,
  Difficulty,
  ReviewStatus,
  type Question,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardTitle } from "@/components/ui/card";
import { defaultTimeLimitSecForQuestionType } from "@/lib/quiz/time-limit";

type Props = {
  /** 有 id 则为编辑模式 */
  initial?: Question | null;
};

/**
 * 管理端题目表单：创建 / 编辑，提交走 REST API + zod 服务端校验。
 */
export function QuestionForm({ initial }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    category: initial?.category ?? "",
    type: initial?.type ?? QuestionType.single_choice,
    difficulty: initial?.difficulty ?? Difficulty.easy,
    question: initial?.question ?? "",
    aliases: initial?.aliases ?? "",
    canonicalAnswer: initial?.canonicalAnswer ?? "",
    avatarAnswer: initial?.avatarAnswer ?? "",
    optionA: initial?.optionA ?? "",
    optionB: initial?.optionB ?? "",
    optionC: initial?.optionC ?? "",
    optionD: initial?.optionD ?? "",
    correctOption: initial?.correctOption ?? "",
    keywords: initial?.keywords ?? "",
    explanation: initial?.explanation ?? "",
    score: initial?.score ?? 10,
    timeLimitSec:
      initial?.timeLimitSec ??
      defaultTimeLimitSecForQuestionType(initial?.type ?? QuestionType.single_choice),
    enabled: initial?.enabled ?? true,
    sourceDoc: initial?.sourceDoc ?? "",
    sourceVersion: initial?.sourceVersion ?? "",
    reviewStatus: initial?.reviewStatus ?? ReviewStatus.draft,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = initial?.id ? `/api/questions/${initial.id}` : "/api/questions";
      const method = initial?.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          score: Number(form.score),
          timeLimitSec: Number(form.timeLimitSec),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.details?.fieldErrors &&
          Object.values(data.details.fieldErrors).flat().join("; ");
        setError(msg || data.error || "保存失败");
        return;
      }
      router.push("/admin/questions");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card className="space-y-4">
        <CardTitle>基本信息</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>分类</Label>
            <Input
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              required
            />
          </div>
          <div>
            <Label>题型</Label>
            <Select
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as QuestionType;
                setForm((f) => ({
                  ...f,
                  type,
                  timeLimitSec: defaultTimeLimitSecForQuestionType(type),
                }));
              }}
            >
              <option value={QuestionType.single_choice}>单选题</option>
              <option value={QuestionType.true_false}>判断题</option>
              <option value={QuestionType.short_answer}>简答题</option>
            </Select>
          </div>
          <div>
            <Label>难度</Label>
            <Select
              value={form.difficulty}
              onChange={(e) => update("difficulty", e.target.value as Difficulty)}
            >
              <option value={Difficulty.easy}>易</option>
              <option value={Difficulty.medium}>中</option>
              <option value={Difficulty.hard}>难</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>题干</Label>
            <Textarea
              value={form.question}
              onChange={(e) => update("question", e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label>相似问法（逗号分隔）</Label>
            <Input
              value={form.aliases}
              onChange={(e) => update("aliases", e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>答案与选项</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>标准答案（判分 / 后台）</Label>
            <Textarea
              value={form.canonicalAnswer}
              onChange={(e) => update("canonicalAnswer", e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label>数字人口播答案（自然表述，可不填）</Label>
            <Textarea
              value={form.avatarAnswer}
              onChange={(e) => update("avatarAnswer", e.target.value)}
            />
          </div>
          <div>
            <Label>选项 A</Label>
            <Input value={form.optionA} onChange={(e) => update("optionA", e.target.value)} />
          </div>
          <div>
            <Label>选项 B</Label>
            <Input value={form.optionB} onChange={(e) => update("optionB", e.target.value)} />
          </div>
          <div>
            <Label>选项 C</Label>
            <Input value={form.optionC} onChange={(e) => update("optionC", e.target.value)} />
          </div>
          <div>
            <Label>选项 D</Label>
            <Input value={form.optionD} onChange={(e) => update("optionD", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>正确选项（单选 A-D；判断 True/False）</Label>
            <Input
              value={form.correctOption}
              onChange={(e) => update("correctOption", e.target.value)}
              placeholder="如 B 或 True"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>简答题关键词（逗号分隔）</Label>
            <Input
              value={form.keywords}
              onChange={(e) => update("keywords", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>解析 / 备注</Label>
            <Textarea
              value={form.explanation}
              onChange={(e) => update("explanation", e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>分值与元数据</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>分值</Label>
            <Input
              type="number"
              min={0}
              value={form.score}
              onChange={(e) => update("score", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>限时（秒）</Label>
            <Input
              type="number"
              min={5}
              value={form.timeLimitSec}
              onChange={(e) => update("timeLimitSec", Number(e.target.value))}
            />
            <p className="text-xs text-slate-500">
              切换题型时会按默认填入：选择题 {defaultTimeLimitSecForQuestionType(QuestionType.single_choice)}{" "}
              秒、简答题 {defaultTimeLimitSecForQuestionType(QuestionType.short_answer)} 秒。
            </p>
          </div>
          <div>
            <Label>启用</Label>
            <Select
              value={form.enabled ? "1" : "0"}
              onChange={(e) => update("enabled", e.target.value === "1")}
            >
              <option value="1">启用</option>
              <option value="0">停用</option>
            </Select>
          </div>
          <div>
            <Label>审核状态</Label>
            <Select
              value={form.reviewStatus}
              onChange={(e) => update("reviewStatus", e.target.value as ReviewStatus)}
            >
              <option value={ReviewStatus.draft}>draft</option>
              <option value={ReviewStatus.reviewed}>reviewed</option>
              <option value={ReviewStatus.needs_review}>needs_review</option>
            </Select>
          </div>
          <div>
            <Label>来源文档</Label>
            <Input value={form.sourceDoc} onChange={(e) => update("sourceDoc", e.target.value)} />
          </div>
          <div>
            <Label>来源版本</Label>
            <Input
              value={form.sourceVersion}
              onChange={(e) => update("sourceVersion", e.target.value)}
            />
          </div>
        </div>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "保存中…" : "保存"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </form>
  );
}
