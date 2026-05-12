"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, ChevronRight, Loader2, Award, RotateCcw } from "lucide-react";
import { type CategoryQuiz } from "@/lib/academy-quizzes";

interface Props {
  quiz: CategoryQuiz;
  categoryLabel: string;
  categoryIcon: string;
  onPass: () => void;
  onClose: () => void;
  previousScore?: number;
}

export function AcademyQuiz({ quiz, categoryLabel, categoryIcon, onPass, onClose, previousScore }: Props) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<(number | null)[]>(Array(quiz.questions.length).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number } | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const question = quiz.questions[currentQ];
  const isLast = currentQ === quiz.questions.length - 1;
  const allAnswered = selected.every(s => s !== null);

  function handleSelect(optIdx: number) {
    if (submitted) return;
    const updated = [...selected];
    updated[currentQ] = optIdx;
    setSelected(updated);
  }

  async function handleSubmit() {
    if (!allAnswered) return;
    setSaving(true);
    try {
      const res = await fetch("/api/academy/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: quiz.categoryId, answers: selected }),
      });
      const data = await res.json();
      setResult(data);
      setSubmitted(true);
      if (data.passed) {
        // Award badges
        await fetch("/api/academy/badges", { method: "POST" }).catch(() => {});
        setTimeout(() => onPass(), 2500);
      }
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSelected(Array(quiz.questions.length).fill(null));
    setSubmitted(false);
    setResult(null);
    setCurrentQ(0);
    setShowExplanation(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={submitted && !result?.passed ? onClose : undefined} />
      <div className="relative w-full max-w-lg bg-[#111F35] border border-[#243A66] rounded-2xl shadow-2xl overflow-hidden z-10">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#09081A] to-[#111F35] px-6 py-4 border-b border-[#243A66]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{categoryIcon}</span>
            <div>
              <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest">Quiz — {categoryLabel}</p>
              <p className="text-xs text-[#7A8FA8]">Nota mínima para aprovação: {quiz.passingScore}%</p>
            </div>
          </div>
          {previousScore !== undefined && (
            <div className="mt-2 text-xs text-[#7A8FA8]">Sua melhor nota anterior: <span className="text-white font-semibold">{previousScore}%</span></div>
          )}
        </div>

        <div className="p-6">
          {!submitted ? (
            <>
              {/* Progress */}
              <div className="flex items-center gap-2 mb-5">
                {quiz.questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentQ(i)}
                    className={`flex-1 h-1.5 rounded-full transition-all ${
                      selected[i] !== null ? "bg-[#C9A84C]" : i === currentQ ? "bg-[#C9A84C]/40" : "bg-[#243A66]"
                    }`}
                  />
                ))}
                <span className="text-xs text-[#7A8FA8] flex-shrink-0">{currentQ + 1}/{quiz.questions.length}</span>
              </div>

              {/* Question */}
              <p className="text-sm font-semibold text-white mb-4 leading-relaxed">{question.question}</p>

              {/* Options */}
              <div className="space-y-2 mb-6">
                {question.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(i)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs border transition-all ${
                      selected[currentQ] === i
                        ? "border-[#C9A84C] bg-[#C9A84C]/10 text-[#F0ECE4]"
                        : "border-[#243A66] bg-[#0D1929] text-[#7A8FA8] hover:border-[#C9A84C]/40 hover:text-[#F0ECE4]"
                    }`}
                  >
                    <span className="font-bold text-[#C9A84C] mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
                  disabled={currentQ === 0}
                  className="px-4 py-2 text-xs rounded-lg border border-[#243A66] text-[#7A8FA8] disabled:opacity-40 hover:text-white transition-colors"
                >
                  ← Anterior
                </button>
                {isLast ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!allAnswered || saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold transition-colors disabled:opacity-40"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {saving ? "Enviando..." : "Finalizar Quiz"}
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentQ(q => Math.min(quiz.questions.length - 1, q + 1))}
                    disabled={selected[currentQ] === null}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#243A66] text-[#F0ECE4] text-xs font-semibold disabled:opacity-40 hover:bg-[#2E4A7A] transition-colors"
                  >
                    Próxima <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </>
          ) : result ? (
            <div className="text-center">
              {/* Result */}
              <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${result.passed ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                {result.passed
                  ? <Award className="w-10 h-10 text-emerald-400" />
                  : <XCircle className="w-10 h-10 text-red-400" />}
              </div>
              <p className={`text-3xl font-bold mb-1 ${result.passed ? "text-emerald-400" : "text-red-400"}`}>{result.score}%</p>
              <p className="text-sm font-semibold text-white mb-1">
                {result.passed ? "Parabéns! Você passou!" : "Não foi dessa vez"}
              </p>
              <p className="text-xs text-[#7A8FA8] mb-5">
                {result.correct} de {result.total} respostas corretas · Mínimo: {quiz.passingScore}%
              </p>

              {/* Show correct answers */}
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                className="text-xs text-[#C9A84C] underline mb-4 block mx-auto"
              >
                {showExplanation ? "Ocultar gabarito" : "Ver gabarito e explicações"}
              </button>

              {showExplanation && (
                <div className="text-left space-y-3 mb-5 max-h-48 overflow-y-auto">
                  {quiz.questions.map((q, i) => {
                    const isCorrect = selected[i] === q.correct;
                    return (
                      <div key={q.id} className={`p-3 rounded-lg border text-xs ${isCorrect ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                        <div className="flex items-start gap-2 mb-1">
                          {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />}
                          <p className="text-[#F0ECE4] font-medium">{q.question}</p>
                        </div>
                        <p className="text-[#7A8FA8] ml-5 leading-relaxed">{q.explanation}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3">
                {!result.passed && (
                  <button
                    onClick={handleReset}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#243A66] text-[#7A8FA8] text-xs font-semibold hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Tentar Novamente
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold hover:bg-[#C9A84C]/20 transition-colors"
                >
                  {result.passed ? "Fechar e receber certificado" : "Fechar"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
