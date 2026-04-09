"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardTitle } from "@/components/ui/card";
import {
  clearPersistedQuizSession,
  readPersistedQuizSessionId,
} from "@/lib/quiz/active-session-storage";
import {
  QUIZ_CLOSED_USER_MESSAGE,
  QUIZ_DEADLINE_LABEL,
} from "@/lib/quiz/quiz-deadline";
import {
  QUIZ_PHONE_HINT,
  QUIZ_PHONE_PATTERN,
} from "@/lib/quiz/quiz-phone";

type ResumeInfo = {
  sessionId: string;
  nickname: string;
  phoneMask: string;
  answeredCount: number;
  total: number;
};

export default function QuizStartPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [resumeChecking, setResumeChecking] = useState(true);
  /** loading / open / closed / error —— 勿把请求失败当成「已截止」 */
  const [availability, setAvailability] = useState<
    "loading" | "open" | "closed" | "error"
  >("loading");

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/quiz/availability", { cache: "no-store" });
        let d: { open?: boolean } = {};
        try {
          d = (await r.json()) as { open?: boolean };
        } catch {
          setAvailability("error");
          return;
        }
        if (!r.ok) {
          setAvailability("error");
          return;
        }
        setAvailability(d.open === true ? "open" : "closed");
      } catch {
        setAvailability("error");
      }
    })();
  }, []);

  useEffect(() => {
    const id = readPersistedQuizSessionId();
    if (!id) {
      setResumeChecking(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/quiz/${id}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          finished?: boolean;
          session?: { nickname?: string; phoneMask?: string };
          answeredCount?: number;
          currentIndex?: number;
          total?: number;
        };
        if (cancelled) return;
        if (res.status === 403 || !res.ok || data.finished) {
          clearPersistedQuizSession();
          return;
        }
        setResume({
          sessionId: id,
          nickname: data.session?.nickname ?? "答题者",
          phoneMask: data.session?.phoneMask ?? "—",
          answeredCount: data.answeredCount ?? data.currentIndex ?? 0,
          total: data.total ?? 0,
        });
      })
      .catch(() => {
        if (!cancelled) clearPersistedQuizSession();
      })
      .finally(() => {
        if (!cancelled) setResumeChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStart() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          phone: phone.trim(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
        sessionId?: string;
      };
      if (!res.ok) {
        if (res.status === 409 && data.sessionId) {
          router.push(`/quiz/${data.sessionId}`);
          return;
        }
        setError(data.error ?? "开始失败");
        return;
      }
      if (!data.sessionId) {
        setError("开始失败");
        return;
      }
      router.push(`/quiz/${data.sessionId}`);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  function dismissResume() {
    clearPersistedQuizSession();
    setResume(null);
  }

  const initBusy = resumeChecking || availability === "loading";
  const canUseQuiz = availability === "open";

  return (
    <div className="mx-auto w-full max-w-md space-y-5 sm:space-y-6">
      {availability === "closed" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          {QUIZ_CLOSED_USER_MESSAGE}
        </p>
      ) : null}
      {availability === "error" ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-800">
          <p>无法获取活动开放状态（网络或服务器异常），不等同于活动已截止。</p>
          <p className="mt-2 text-xs text-red-700">
            活动截止时间：{QUIZ_DEADLINE_LABEL}（东八区）。请刷新页面或稍后再试。
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            刷新重试
          </Button>
        </div>
      ) : null}
      {initBusy ? (
        <p className="text-center text-sm text-slate-500">加载中…</p>
      ) : null}
      {canUseQuiz && resume && !resumeChecking ? (
        <Card className="space-y-3 border-brand-200/80 bg-brand-50/40">
          <CardTitle>检测到未完成的答题</CardTitle>
          <p className="text-sm text-slate-700">
            {resume.nickname}
            <span className="tabular-nums text-slate-500">（{resume.phoneMask}）</span>
            {" · "}
            已答 {resume.answeredCount} / {resume.total} 题
          </p>
          <p className="text-xs text-slate-500">
            若此前因网络中断或误关页面退出，可直接继续，进度已保存在服务器。
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              onClick={() => router.push(`/quiz/${resume.sessionId}`)}
            >
              继续答题
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={dismissResume}>
              忽略，重新开始
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <CardTitle>填写信息</CardTitle>
        <div>
          <Label htmlFor="nick">姓名</Label>
          <Input
            id="nick"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="请输入真实姓名"
            maxLength={40}
            autoComplete="name"
            disabled={!canUseQuiz}
          />
          <p className="mt-1 text-xs text-slate-500">
            允许与他人重名，身份以手机号为准。
          </p>
        </div>
        <div>
          <Label htmlFor="phone">手机号</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="11位手机号"
            maxLength={11}
            autoComplete="tel"
            disabled={!canUseQuiz}
          />
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {QUIZ_PHONE_HINT} 同一手机号仅可完成一场；重名者请各用本人号码。
          </p>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button
          className="w-full"
          disabled={
            !canUseQuiz ||
            loading ||
            !nickname.trim() ||
            !QUIZ_PHONE_PATTERN.test(phone.trim())
          }
          onClick={handleStart}
        >
          {loading ? "创建中…" : canUseQuiz ? "开始答题" : "答题已截止"}
        </Button>
      </Card>
      <p className="text-center text-sm text-slate-500">
        <Link href="/" className="text-brand-600 hover:underline">
          返回首页
        </Link>
      </p>
    </div>
  );
}
