"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  BrainCircuit,
  Send,
  User,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Como funciona o Home Equity e qual o LTV máximo praticado?",
  "Explique a diferença entre FIDC e CRA para estruturação de crédito",
  "Quais são os critérios para uma operação High Ticket acima de R$ 5M?",
  "Como calcular o múltiplo de EBITDA em um M&A?",
  "O que é split fiscal e como ele funciona em correspondência bancária?",
  "Quais as regras do BACEN para correspondentes bancários?",
];

export default function IAAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    try {
      const response = await fetch("/api/ia-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error("Erro na requisição");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullContent += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: fullContent,
          };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content:
            "Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.",
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-2.5rem)] max-h-[800px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">V3 IA Assistant</h1>
            <p className="text-xs text-muted-foreground">
              Especialista em mercado financeiro, crédito e M&A
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Nova conversa
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border/50 bg-[#0F172A] p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-violet-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                Como posso te ajudar?
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Tire suas dúvidas sobre linhas de crédito, mercado financeiro,
                M&A, split fiscal e muito mais.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTED_QUESTIONS.map((question, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(question)}
                  className="text-left p-3 rounded-lg border border-border/50 hover:border-violet-500/40 hover:bg-violet-500/5 text-xs text-muted-foreground hover:text-foreground transition-all"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                    <BrainCircuit className="w-4 h-4 text-violet-400" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-xl px-4 py-3 text-sm",
                    message.role === "user"
                      ? "bg-[#1B4FD8] text-white"
                      : "bg-[#1E293B] text-foreground"
                  )}
                >
                  {message.role === "assistant" ? (
                    <div
                      className="prose prose-sm prose-invert max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: formatMarkdown(message.content),
                      }}
                    />
                  ) : (
                    message.content
                  )}
                  {message.role === "assistant" &&
                    message.content === "" &&
                    isLoading && (
                      <div className="flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    )}
                </div>
                {message.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-[#1B4FD8]/20 border border-[#1B4FD8]/30 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-[#3B6EF8]" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3">
        <div className="flex gap-2 p-3 bg-[#0F172A] border border-border/50 rounded-xl">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre linhas de crédito, M&A, mercado financeiro..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[24px] max-h-24"
            style={{ height: "auto" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-lg bg-[#1B4FD8] hover:bg-[#1B4FD8]/80 flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all self-end"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </form>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="bg-secondary px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/^## (.*)/gm, '<h2 class="text-base font-bold mt-3 mb-1">$1</h2>')
    .replace(/^### (.*)/gm, '<h3 class="text-sm font-semibold mt-2 mb-1">$1</h3>')
    .replace(/^- (.*)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.*)/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, "<br>");
}
