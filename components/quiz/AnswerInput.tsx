"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Send } from "lucide-react";
import type { QuestionType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AnswerInputProps {
  type: QuestionType;
  disabled?: boolean;
  onSubmit: (text: string, method: "text" | "voice") => void | Promise<void>;
}

export type AnswerInputHandle = {
  /** 简答：提交输入框。判断题：提交点选的正确/错误。 */
  submitAnswer: () => boolean;
};

/**
 * 判断 / 简答作答；单选题请在题目卡片内点选 A–D，由页面提交。
 */
export const AnswerInput = forwardRef<AnswerInputHandle, AnswerInputProps>(
  function AnswerInput({ type, disabled, onSubmit }, ref) {
    const [text, setText] = useState("");
    const [choicePick, setChoicePick] = useState<string | null>(null);
    const textRef = useRef("");
    const choicePickRef = useRef<string | null>(null);

    const submitAnswer = useCallback(() => {
      if (disabled) return false;
      if (type === "short_answer") {
        const t = textRef.current.trim();
        if (!t) return false;
        onSubmit(t, "text");
        return true;
      }
      const pick = choicePickRef.current;
      if (type === "true_false" && pick) {
        onSubmit(pick, "text");
        return true;
      }
      return false;
    }, [disabled, type, onSubmit]);

    useImperativeHandle(ref, () => ({ submitAnswer }), [submitAnswer]);

    function handleSend() {
      submitAnswer();
    }

    if (type === "short_answer") {
      return (
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => {
              textRef.current = e.target.value;
              setText(e.target.value);
            }}
            placeholder="请输入您的回答…"
            disabled={disabled}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSend} disabled={disabled} className="gap-2">
              <Send className="h-4 w-4" />
              提交答案
            </Button>
          </div>
        </div>
      );
    }

    if (type === "true_false") {
      return (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            点选正确或错误，可随时修改；确认后请按页面底部「提交本题」。
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={choicePick === "True" ? "primary" : "secondary"}
              disabled={disabled}
              onClick={() => {
                choicePickRef.current = "True";
                setChoicePick("True");
              }}
            >
              正确
            </Button>
            <Button
              type="button"
              variant={choicePick === "False" ? "primary" : "secondary"}
              disabled={disabled}
              onClick={() => {
                choicePickRef.current = "False";
                setChoicePick("False");
              }}
            >
              错误
            </Button>
          </div>
        </div>
      );
    }

    return null;
  }
);

AnswerInput.displayName = "AnswerInput";
