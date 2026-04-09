"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Volume2 } from "lucide-react";
import type { QuestionType } from "@prisma/client";
import {
  AnswerInput,
  type AnswerInputHandle,
} from "@/components/quiz/AnswerInput";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { QuizAvatarHost } from "@/components/quiz/QuizAvatarHost";
import { QuizQuestionNav } from "@/components/quiz/QuizQuestionNav";
import { SessionTimerBar } from "@/components/quiz/SessionTimerBar";
import { ScorePanel } from "@/components/stats/ScorePanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { primeBrowserSpeech } from "@/lib/providers/tts/browser-tts";
import {
  wrapAutoQuestionNarration,
  wrapReplayQuestionNarration,
} from "@/lib/providers/tts/disney-style-narration";
import {
  isTtsPlaybackAvailable,
  prefetchSpeakText,
  speakText,
  speakTextAsync,
  stopSpeak,
  TTS_TEXT,
} from "@/lib/services/tts";
import {
  AVATAR_DURATIONS_MS,
  avatarInitialState,
  avatarReducer,
} from "@/lib/avatar/state-machine";
import {
  clearPersistedQuizSession,
  persistActiveQuizSession,
} from "@/lib/quiz/active-session-storage";
import { hasDedicatedClip } from "@/lib/quiz/avatarClips";
import { quizClientNeedsSpeechUnlock } from "@/lib/quiz/quiz-audio-unlock";

interface PublicQuestion {
  id: string;
  category: string;
  type: QuestionType;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  timeLimitSec: number;
  score: number;
  speakText: string;
}

interface QuizState {
  session: {
    id: string;
    nickname: string;
    /** 脱敏手机，区分重名 */
    phoneMask?: string;
    totalScore: number;
    correctCount: number;
    wrongCount: number;
    finishedAt: string | null;
    startedAt: string;
    totalDurationSec: number | null;
  };
  total: number;
  answeredCount: number;
  finished: boolean;
  finishReason: "complete" | "time_up" | null;
  sessionEndsAt: string;
  remainingSec: number;
  serverNow?: string;
  answeredQuestionIds: string[];
  questions: PublicQuestion[];
}

/**
 * 答题主流程：拉取状态、TTS 播报、计时、提交答案。
 */
export function QuizPlay({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  /** 移动端等需一次手势后才允许自动朗读；桌面端由 effect 直接置 true */
  const [speechAllowed, setSpeechAllowed] = useState(false);
  const [clientMounted, setClientMounted] = useState(false);
  const [state, setState] = useState<QuizState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [avatar, dispatchAvatar] = useReducer(avatarReducer, avatarInitialState);
  const questionStartRef = useRef<number>(Date.now());
  const lastSpokenIdRef = useRef<string | null>(null);
  const idleNudgeFiredAtRef = useRef<number | null>(null);
  const lastInteractionAtRef = useRef<number>(Date.now());
  const answerInputRef = useRef<AnswerInputHandle>(null);
  const [submitHint, setSubmitHint] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);
  /** 单选题：在题目卡片内点选的 A–D */
  const [singleChoicePick, setSingleChoicePick] = useState<string | null>(null);
  const [avatarSurface, setAvatarSurface] = useState<
    "unknown" | "glb" | "video"
  >("unknown");
  const stateRef = useRef<QuizState | null>(null);
  const submitLockRef = useRef(false);
  const activeQuestionRef = useRef<PublicQuestion | null>(null);
  const answeredIdsRef = useRef<Set<string>>(new Set());
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [welcomeReady, setWelcomeReady] = useState(false);
  const welcomeInitRef = useRef(false);
  const finishTtsRef = useRef(false);

  const onAvatarSurfaceResolved = useCallback((surface: "glb" | "video") => {
    setAvatarSurface(surface);
  }, []);

  const onGreetingClipEnded = useCallback(() => {
    dispatchAvatar({ type: "GREETING_DONE" });
  }, []);

  const onWrongClipEnded = useCallback(() => {
    dispatchAvatar({ type: "FEEDBACK_DONE" });
  }, []);

  const onCorrectClipEnded = useCallback(() => {
    dispatchAvatar({ type: "FEEDBACK_DONE" });
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const q = state?.questions?.[selectedSlotIndex] ?? null;
  const answeredSet = new Set(state?.answeredQuestionIds ?? []);
  const isCurrentAnswered = q ? answeredSet.has(q.id) : false;

  useEffect(() => {
    answeredIdsRef.current = answeredSet;
  }, [state?.answeredQuestionIds]);

  useEffect(() => {
    activeQuestionRef.current = q;
  }, [q]);

  /** 提交后当前题已答：自动跳到下一道未答题 */
  useEffect(() => {
    if (!state?.questions?.length || state.finished) return;
    setSelectedSlotIndex((prev) => {
      const ids = state.questions.map((x) => x.id);
      const set = new Set(state.answeredQuestionIds);
      const cur = state.questions[prev];
      if (cur && !set.has(cur.id)) return prev;
      const next = ids.findIndex((id) => !set.has(id));
      return next >= 0 ? next : prev;
    });
  }, [state?.answeredQuestionIds, state?.questions, state?.finished]);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/quiz/${sessionId}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 404) clearPersistedQuizSession();
      setLoadError(data.error ?? "加载失败");
      return;
    }
    setLoadError(null);
    if (data.finished) {
      clearPersistedQuizSession();
    } else {
      persistActiveQuizSession(sessionId);
    }
    const d = data as Record<string, unknown>;
    setState({
      ...(data as QuizState),
      answeredQuestionIds: Array.isArray(d.answeredQuestionIds)
        ? (d.answeredQuestionIds as string[])
        : [],
      questions: Array.isArray(d.questions) ? (d.questions as PublicQuestion[]) : [],
      finishReason:
        d.finishReason === "complete" || d.finishReason === "time_up"
          ? d.finishReason
          : null,
      remainingSec:
        typeof d.remainingSec === "number" ? d.remainingSec : 0,
      sessionEndsAt:
        typeof d.sessionEndsAt === "string"
          ? d.sessionEndsAt
          : new Date().toISOString(),
      answeredCount:
        typeof d.answeredCount === "number"
          ? d.answeredCount
          : Number(d.currentIndex) || 0,
    });
  }, [sessionId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    welcomeInitRef.current = false;
    finishTtsRef.current = false;
    setWelcomeReady(
      typeof window !== "undefined" && !isTtsPlaybackAvailable()
    );
  }, [sessionId]);

  useEffect(() => {
    return () => {
      stopSpeak();
    };
  }, []);

  // 页面首次进入：先 greeting
  useEffect(() => {
    dispatchAvatar({ type: "PAGE_ENTER" });
  }, []);

  useEffect(() => {
    setClientMounted(true);
    if (!quizClientNeedsSpeechUnlock()) {
      setSpeechAllowed(true);
    }
  }, []);

  const unlockSpeechFromUser = useCallback(() => {
    primeBrowserSpeech();
    setSpeechAllowed(true);
  }, []);

  /** 欢迎语（小朋友主持口吻），读完后再允许自动播题目 */
  useEffect(() => {
    if (!speechAllowed || !state) return;
    if (state.finished) {
      setWelcomeReady(true);
      return;
    }
    if (welcomeInitRef.current) return;
    if (!isTtsPlaybackAvailable()) {
      setWelcomeReady(true);
      welcomeInitRef.current = true;
      return;
    }
    welcomeInitRef.current = true;
    let started = false;
    const t = window.setTimeout(() => {
      // 如果外部音频被自动播放策略拦截 / 外部接口失败导致一直不开始，
      // 不要卡住后续自动播题
      if (!started) setWelcomeReady(true);
    }, 1200);
    void speakText(TTS_TEXT.welcome, {
      style: "preschoolBoy",
      interrupt: true,
      segment: true,
      onStart: () => {
        started = true;
        window.clearTimeout(t);
        dispatchAvatar({ type: "SPEAK_START" });
      },
      onEnd: () => {
        window.clearTimeout(t);
        dispatchAvatar({ type: "SPEAK_END" });
        setWelcomeReady(true);
      },
    });
  }, [speechAllowed, state, state?.finished, sessionId]);

  /** 全部答完：结束语 */
  useEffect(() => {
    if (!state?.finished) return;
    if (!isTtsPlaybackAvailable()) return;
    if (finishTtsRef.current) return;
    finishTtsRef.current = true;
    void speakText(TTS_TEXT.finish, {
      style: "preschoolBoy",
      interrupt: true,
      segment: true,
      onStart: () => dispatchAvatar({ type: "SPEAK_START" }),
      onEnd: () => dispatchAvatar({ type: "SPEAK_END" }),
    });
  }, [state?.finished]);

  /** GLB 模式：问候结束后进入 idle（或 pending 的朗读态） */
  useEffect(() => {
    if (avatarSurface !== "glb") return;
    if (avatar.value !== "greeting") return;
    const t = window.setTimeout(() => {
      dispatchAvatar({ type: "GREETING_DONE" });
    }, AVATAR_DURATIONS_MS.greeting);
    return () => window.clearTimeout(t);
  }, [avatarSurface, avatar.value]);

  /** GLB 模式：答对/答错展示一小段时间后回 idle */
  useEffect(() => {
    if (avatarSurface !== "glb") return;
    if (avatar.value !== "correct" && avatar.value !== "wrong") return;
    const t = window.setTimeout(() => {
      dispatchAvatar({ type: "FEEDBACK_DONE" });
    }, AVATAR_DURATIONS_MS.feedback);
    return () => window.clearTimeout(t);
  }, [avatarSurface, avatar.value]);

  /** 视频模式且无 correct 素材时：用定时器结束反馈态（与 idle 循环片源同源，无 onEnded） */
  useEffect(() => {
    if (avatarSurface !== "video") return;
    if (avatar.value !== "correct") return;
    if (hasDedicatedClip("correct")) return;
    const t = window.setTimeout(() => {
      dispatchAvatar({ type: "FEEDBACK_DONE" });
    }, AVATAR_DURATIONS_MS.feedback);
    return () => window.clearTimeout(t);
  }, [avatarSurface, avatar.value]);

  useEffect(() => {
    setFeedback(null);
    setSubmitHint(null);
    setSingleChoicePick(null);
  }, [q?.id]);

  /** 选中未作答题目时自动朗读（已答题仅浏览，不自动播） */
  useEffect(() => {
    if (!speechAllowed || !welcomeReady) return;
    if (!q || state?.finished) return;
    if (isCurrentAnswered) return;
    if (lastSpokenIdRef.current === q.id) return;
    lastSpokenIdRef.current = q.id;
    questionStartRef.current = Date.now();

    void (async () => {
      const variant =
        (state?.answeredCount ?? 0) > 0 ? "continuation" : "first";
      void speakTextAsync(wrapAutoQuestionNarration(q.speakText, variant), {
        style: "storybookBoy",
        interrupt: true,
        segment: true,
        onStart: () => dispatchAvatar({ type: "SPEAK_START" }),
        onEnd: () => dispatchAvatar({ type: "SPEAK_END" }),
      });
    })();
  }, [
    q?.id,
    state?.finished,
    isCurrentAnswered,
    speechAllowed,
    welcomeReady,
    state?.answeredCount,
  ]);

  // 预取当前题的外部音频：让用户点击“播放题目语音”更快出声（不影响自动朗读）
  useEffect(() => {
    if (!speechAllowed || !welcomeReady) return;
    if (!q || state?.finished) return;
    if (!isTtsPlaybackAvailable()) return;
    if (isCurrentAnswered) return;
    const variant =
      (state?.answeredCount ?? 0) > 0 ? "continuation" : "first";
    const t = window.setTimeout(() => {
      void prefetchSpeakText(wrapReplayQuestionNarration(q.speakText, variant), {
        style: "storybookBoy",
      });
    }, 220);
    return () => window.clearTimeout(t);
  }, [
    q?.id,
    state?.finished,
    isCurrentAnswered,
    speechAllowed,
    welcomeReady,
    state?.answeredCount,
  ]);

  // 60s 无交互：做一次语音催促互动（不打断用户当前操作）
  useEffect(() => {
    if (!speechAllowed || !welcomeReady) return;
    if (!state || state.finished) return;
    if (!isTtsPlaybackAvailable()) return;

    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
      idleNudgeFiredAtRef.current = null;
    };

    const onVis = () => {
      if (document.visibilityState === "visible") markInteraction();
    };

    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("focus", markInteraction);
    document.addEventListener("visibilitychange", onVis);

    const id = window.setInterval(() => {
      const now = Date.now();
      const idleMs = now - lastInteractionAtRef.current;
      if (idleMs < 60_000) return;
      if (submitting || reverting) return;
      if (idleNudgeFiredAtRef.current && now - idleNudgeFiredAtRef.current < 90_000) return;
      idleNudgeFiredAtRef.current = now;
      void speakText("还在吗？需要我再播一遍题目语音吗？", {
        style: "preschoolBoy",
        interrupt: false,
        segment: true,
        forceExternalWorkingVoice: true,
        disableFallbackToBrowser: true,
        onStart: () => dispatchAvatar({ type: "SPEAK_START" }),
        onEnd: () => dispatchAvatar({ type: "SPEAK_END" }),
      }).catch(() => {});
    }, 2500);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("pointerdown", markInteraction as any);
      window.removeEventListener("keydown", markInteraction as any);
      window.removeEventListener("focus", markInteraction as any);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [speechAllowed, welcomeReady, state?.finished, submitting, reverting]);

  async function speakManual() {
    if (!q) return;
    unlockSpeechFromUser();
    const variant =
      (state?.answeredCount ?? 0) > 0 ? "continuation" : "first";
    void speakTextAsync(wrapReplayQuestionNarration(q.speakText, variant), {
      style: "storybookBoy",
      interrupt: true,
      segment: true,
      onStart: () => dispatchAvatar({ type: "SPEAK_START" }),
      onEnd: () => dispatchAvatar({ type: "SPEAK_END" }),
    });
  }

  async function revertToPreviousQuestion() {
    if (reverting || !state || state.answeredCount < 1) return;
    if (submitLockRef.current) {
      setFeedback("正在提交本题，请稍候再试返回上一题。");
      return;
    }
    setReverting(true);
    setFeedback(null);
    setSubmitHint(null);
    try {
      const res = await fetch(`/api/quiz/${sessionId}/revert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(data.error ?? "无法返回上一题");
        return;
      }
      lastSpokenIdRef.current = null;
      questionStartRef.current = Date.now();
      await fetchState();
    } catch {
      setFeedback("网络错误");
    } finally {
      setReverting(false);
    }
  }

  const submitAnswer = useCallback(
    async (text: string, method: "text" | "voice") => {
      const active = activeQuestionRef.current;
      if (!active || submitLockRef.current) return;
      if (answeredIdsRef.current.has(active.id)) return;
      submitLockRef.current = true;
      setSubmitting(true);
      setFeedback(null);
      setSubmitHint(null);
      const durationSec = Math.max(
        0,
        Math.floor((Date.now() - questionStartRef.current) / 1000)
      );
      try {
        const res = await fetch(`/api/quiz/${sessionId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: active.id,
            userAnswerText: text,
            answerMethod: method,
            durationSec,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback(data.error ?? "提交失败");
          return;
        }
        // 先播完鼓励语再拉新状态，避免与「下一题自动朗读」并发请求外部 TTS，
        // 晚返回的短音频会盖住题目长音频，表现为只听到「继续加油呀」且不念题。
        if (isTtsPlaybackAvailable()) {
          await speakText(TTS_TEXT.encourage, {
            style: "littleBoy",
            interrupt: true,
            segment: true,
          }).catch(() => {});
        }
        await fetchState();
      } catch {
        setFeedback("网络错误");
      } finally {
        submitLockRef.current = false;
        setSubmitting(false);
      }
    },
    [sessionId, fetchState]
  );

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center text-sm text-red-700">
        {loadError}
        <div className="mt-3">
          <Link href="/quiz/start" className="text-brand-600 underline">
            返回开始页
          </Link>
        </div>
      </div>
    );
  }

  if (!state) {
    return <p className="text-center text-slate-500">加载中…</p>;
  }

  if (state.finished) {
    const s = state.session;
    const timeUp = state.finishReason === "time_up";
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <Card className="space-y-5 p-6 text-center shadow-md">
          <h2 className="text-xl font-bold text-slate-900">
            {timeUp ? "本场时间已结束" : "答题完成"}
          </h2>
          <p className="text-sm text-slate-600">
            {timeUp ? (
              <>
                {s.nickname}
                {s.phoneMask ? (
                  <span className="tabular-nums text-slate-500">（{s.phoneMask}）</span>
                ) : null}
                ，本场答题限时 30 分钟已到。感谢你的参与。
              </>
            ) : (
              <>
                {s.nickname}
                {s.phoneMask ? (
                  <span className="tabular-nums text-slate-500">（{s.phoneMask}）</span>
                ) : null}
                ，你已完成全部题目。感谢你的参与。
              </>
            )}
          </p>
          <p className="text-xs leading-relaxed text-slate-500">
            同一手机号仅可完整参与一次答题，不可重复作答。
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => router.push("/")}
            >
              返回首页
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!q) {
    return (
      <p className="text-center text-slate-500">
        题目数据异常，请刷新页面或返回首页重试。
      </p>
    );
  }

  const canRevert = state.answeredCount >= 1;
  const questionIdsInOrder = state.questions.map((x) => x.id);
  const navDisabled = submitting || reverting;
  const inputLocked = submitting || isCurrentAnswered;

  return (
    <div className="quiz-page relative w-full">
      {clientMounted &&
      quizClientNeedsSpeechUnlock() &&
      !speechAllowed ? (
        <button
          type="button"
          className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center border-0 bg-black/45 p-6 backdrop-blur-[2px]"
          onClick={() => unlockSpeechFromUser()}
        >
          <span className="max-w-sm rounded-2xl bg-white px-6 py-5 text-center text-base font-medium text-slate-900 shadow-lg">
            轻触屏幕开启语音播报
            <span className="mt-2 block text-sm font-normal text-slate-500">
              手机与微信内置浏览器需先点一次，系统才允许朗读题目
            </span>
          </span>
        </button>
      ) : null}

      <div className="quiz-main-layout">
        <main className="quiz-content">
          <ScorePanel
            answeredCount={state.answeredCount}
            total={state.total}
          />

          <SessionTimerBar
            syncKey={`${state.serverNow ?? ""}-${state.remainingSec}-${state.sessionEndsAt}`}
            initialRemainingSec={state.remainingSec}
            onExpire={() => void fetchState()}
            disabled={state.finished}
          />

          <div className="flex flex-col items-stretch gap-2 sm:items-start">
            {clientMounted &&
            typeof window !== "undefined" &&
            !isTtsPlaybackAvailable() ? (
              <p className="max-w-xl text-left text-xs text-amber-800">
                当前无法使用语音播报（未配置外部 TTS 且浏览器不支持朗读）。请使用 Chrome / Edge /
                Safari 最新版，或在环境中配置 NEXT_PUBLIC_TTS_API_URL。
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => void speakManual()}
                disabled={submitting}
              >
                <Volume2 className="h-4 w-4" />
                播放题目语音
              </Button>
              {canRevert ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  disabled={submitting || reverting}
                  onClick={() => void revertToPreviousQuestion()}
                >
                  <ChevronLeft className="h-4 w-4" />
                  撤回上一笔作答
                </Button>
              ) : null}
            </div>
            {clientMounted && isTtsPlaybackAvailable() ? (
              <p className="text-left text-[11px] text-slate-400">
                无声时请点「播放题目语音」；手机端进入页面后请先按提示轻触屏幕开启朗读。
              </p>
            ) : null}
          </div>

          {isCurrentAnswered ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm text-emerald-900">
              本题已完成作答；大屏在右侧侧栏、手机在下方题号区切换题目继续。整场限时{" "}
              <strong>30 分钟</strong>。
            </p>
          ) : q.type !== "short_answer" ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-left text-sm text-slate-700">
              整场限时 <strong className="text-slate-900">30 分钟</strong>，题目可任意顺序作答。
              {q.type === "single_choice" ? (
                <>
                  请<strong className="font-semibold text-slate-900">
                    直接点击下方题目里的 A–D 选项
                  </strong>
                  ，可先听语音；改选后点底部
                  <strong className="font-semibold text-brand-700">提交本题</strong>。
                </>
              ) : (
                <>
                  可先听语音同时选题，改选后点底部
                  <strong className="font-semibold text-brand-700">提交本题</strong>。
                </>
              )}
            </p>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-left text-sm text-slate-700">
              整场限时 <strong className="text-slate-900">30 分钟</strong>，可在侧栏任意切换题号。
            </p>
          )}

          {/* 手机端：数字人放在题目上方（桌面端布局冻结，不显示此块） */}
          <div className="quiz-avatar-scene quiz-avatar-scene--mobile min-[768px]:hidden" role="presentation">
            <QuizAvatarHost
              layout="sidebar"
              state={avatar.value}
              onSurfaceResolved={onAvatarSurfaceResolved}
              onGreetingClipEnded={onGreetingClipEnded}
              onWrongClipEnded={onWrongClipEnded}
              onCorrectClipEnded={
                hasDedicatedClip("correct") ? onCorrectClipEnded : undefined
              }
            />
          </div>

          <QuestionCard
            category={q.category}
            type={q.type}
            difficulty={q.difficulty}
            question={q.question}
            optionA={q.optionA}
            optionB={q.optionB}
            optionC={q.optionC}
            optionD={q.optionD}
            {...(q.type === "single_choice"
              ? {
                  selectedSingleChoice: singleChoicePick,
                  onSelectSingleChoice: setSingleChoicePick,
                  optionSelectDisabled: inputLocked,
                }
              : {})}
          />

          {feedback ? (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-left text-sm text-slate-800">
              {feedback}
            </p>
          ) : null}

          {q.type !== "single_choice" ? (
            <AnswerInput
              ref={answerInputRef}
              key={q.id}
              type={q.type}
              disabled={inputLocked}
              onSubmit={submitAnswer}
            />
          ) : null}

          <div className="sticky bottom-0 z-20 -mx-1 flex flex-col gap-2 border-t border-slate-200 bg-white/95 py-4 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm supports-[backdrop-filter]:bg-white/90 sm:mx-0 sm:rounded-b-xl sm:shadow-md">
            <Button
              type="button"
              size="lg"
              className="w-full font-semibold"
              disabled={submitting || isCurrentAnswered}
              onClick={() => {
                setSubmitHint(null);
                if (isCurrentAnswered) return;
                if (q.type === "single_choice") {
                  if (!singleChoicePick) {
                    setSubmitHint("请先点击题目中的选项 A–D，再提交本题。");
                    return;
                  }
                  void submitAnswer(singleChoicePick, "text");
                  return;
                }
                const ok = answerInputRef.current?.submitAnswer() ?? false;
                if (!ok) {
                  setSubmitHint(
                    q.type === "short_answer"
                      ? "请先输入答案后再提交。"
                      : "请先点选正确或错误，再提交本题。"
                  );
                }
              }}
            >
              {isCurrentAnswered ? "本题已提交" : "提交本题"}
            </Button>
            {submitHint ? (
              <p className="text-center text-sm text-amber-800">{submitHint}</p>
            ) : null}
          </div>
        </main>

        <aside className="quiz-sidebar" aria-label="题号导航与场景数字人">
          <div className="quiz-number-card">
            <QuizQuestionNav
              questionIdsInOrder={questionIdsInOrder}
              answeredIds={answeredSet}
              selectedSlotIndex={selectedSlotIndex}
              onSelectSlot={setSelectedSlotIndex}
              disabled={navDisabled}
              className="rounded-none border-0 bg-transparent p-0 shadow-none"
            />
          </div>

          {/* 平板/桌面：数字人留在侧栏下方（手机端已移到题目上方） */}
          <div className="quiz-avatar-scene max-[767px]:hidden" role="presentation">
            <QuizAvatarHost
              layout="sidebar"
              state={avatar.value}
              onSurfaceResolved={onAvatarSurfaceResolved}
              onGreetingClipEnded={onGreetingClipEnded}
              onWrongClipEnded={onWrongClipEnded}
              onCorrectClipEnded={
                hasDedicatedClip("correct") ? onCorrectClipEnded : undefined
              }
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
