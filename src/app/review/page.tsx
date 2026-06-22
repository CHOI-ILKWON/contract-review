"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PixelCharacter from "@/components/PixelCharacter";

type AgentId = "choi" | "kim" | "lee" | "meeting";
type Status = "standby" | "working" | "done";

interface AgentState {
  id: AgentId;
  name: string;
  role: string;
  status: Status;
  emoji: string;
}

const AGENTS: AgentState[] = [
  { id: "choi", name: "기술사 CHOI", role: "기술·공사·성능·대금", status: "standby", emoji: "🏗️" },
  { id: "kim", name: "변호사 KIM", role: "법적구조·책임·분쟁", status: "standby", emoji: "⚖️" },
  { id: "lee", name: "사업개발자 LEE", role: "사업구조·재무·누락조항", status: "standby", emoji: "📊" },
];

const TAB_LABELS = ["1. 사업개요", "2. 사업구도", "3. 재무분석", "4. 검토요약", "5. 상세검토"];

function extractSection(report: string, sectionNum: number): string {
  const headers = ["## 1.", "## 2.", "## 3.", "## 4.", "## 5."];
  const start = report.indexOf(headers[sectionNum - 1]);
  if (start === -1) return report;
  const nextIdx = sectionNum < 5 ? report.indexOf(headers[sectionNum], start + 1) : -1;
  return nextIdx === -1 ? report.slice(start) : report.slice(start, nextIdx);
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/\n/g, '<br/>');
}

export default function ReviewPage() {
  const router = useRouter();
  const logRef = useRef<HTMLDivElement>(null);
  const [agents, setAgents] = useState<AgentState[]>(AGENTS.map((a) => ({ ...a })));
  const [isMeeting, setIsMeeting] = useState(false);
  const [logLines, setLogLines] = useState<string[]>(["[SYSTEM] 검토 준비 중..."]);
  const [finalReport, setFinalReport] = useState("");
  const [agentResults, setAgentResults] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState(1);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState("");
  const [streamingStage, setStreamingStage] = useState<string | null>(null);
  const [streamPreviews, setStreamPreviews] = useState<Record<string, string>>({});

  const addLog = useCallback((line: string) => {
    setLogLines((prev) => [...prev.slice(-100), line]);
  }, []);

  const setAgentStatus = useCallback((id: AgentId, status: Status) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  useEffect(() => {
    const contractText = sessionStorage.getItem("contractText");
    const userContext = sessionStorage.getItem("userContext");
    const fileNames = sessionStorage.getItem("fileNames");

    if (!contractText) {
      router.push("/");
      return;
    }

    addLog(`[SYSTEM] 파일 로드 완료: ${fileNames}`);
    addLog("[SYSTEM] 계약서 텍스트 추출 완료");
    addLog("[STAGE 1] 기술사 CHOI 검토 시작...");
    setAgentStatus("choi", "working");

    const run = async () => {
      try {
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extractedText: contractText, userContext }),
        });

        if (!res.body) throw new Error("스트림 없음");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = JSON.parse(line.slice(6));

            if (payload.type === "stage") {
              const { id, label, status } = payload.data;
              if (status === "start") {
                if (id === "meeting") {
                  setIsMeeting(true);
                  addLog("[STAGE 4] 3자 교차 검증 회의 시작...");
                  setStreamingStage("final");
                } else {
                  setStreamingStage(id);
                }
                if (id !== "meeting") setAgentStatus(id as AgentId, "working");
              } else if (status === "done") {
                if (id !== "meeting") setAgentStatus(id as AgentId, "done");
                const nextMap: Record<string, string> = {
                  choi: "[STAGE 2] 변호사 KIM 검토 시작...",
                  kim: "[STAGE 3] 사업개발자 LEE 검토 시작...",
                  lee: "[STAGE 4] 3자 교차 검증 회의 진행...",
                };
                if (nextMap[id]) {
                  addLog(`[STAGE ${id === "choi" ? 1 : id === "kim" ? 2 : 3} DONE] → ${id}_result`);
                  addLog(nextMap[id]);
                  if (id !== "meeting" && id !== "lee") {
                    const nextId = id === "choi" ? "kim" : "lee";
                    setAgentStatus(nextId as AgentId, "working");
                  }
                } else if (id === "meeting") {
                  addLog("[STAGE 4 DONE] 최종 보고서 생성 완료");
                }
              }
            } else if (payload.type === "chunk") {
              const { stage, text } = payload.data;
              setStreamPreviews((prev) => ({
                ...prev,
                [stage]: ((prev[stage] ?? "").slice(-200) + text).slice(-200),
              }));
              if (Math.random() < 0.05) {
                const preview = text.slice(0, 40).replace(/\n/g, " ");
                if (preview.trim()) addLog(`> ${preview}...`);
              }
            } else if (payload.type === "complete") {
              const { choiResult, kimResult, leeResult, finalReport: fr } = payload.data;
              setAgentResults({ choi: choiResult, kim: kimResult, lee: leeResult });
              setFinalReport(fr);
              setIsComplete(true);
              setIsMeeting(false);
              addLog("[COMPLETE] 최종 보고서 생성 완료 ✓");
            } else if (payload.type === "error") {
              setError(payload.data.message);
              addLog(`[ERROR] ${payload.data.message}`);
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        setError(msg);
        addLog(`[ERROR] ${msg}`);
      }
    };

    run();
  }, [router, addLog, setAgentStatus]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  const downloadReport = () => {
    const blob = new Blob([finalReport], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "계약서_검토_보고서.md";
    a.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="border-b border-green-900 bg-gray-900 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-green-400 text-xl font-mono font-bold">▶</span>
            <h1 className="text-green-400 font-mono font-bold tracking-wider">
              AI 계약서 검토 시스템
            </h1>
          </div>
          {isComplete && (
            <button
              onClick={() => router.push("/")}
              className="text-gray-500 hover:text-green-400 font-mono text-xs"
            >
              [새 계약서 검토]
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-6 gap-6">
        {/* Step indicator */}
        <div className="font-mono text-xs text-gray-500 flex items-center gap-2">
          <span className="text-green-400 font-bold">
            {isComplete ? "[STEP 3]" : isMeeting ? "[STEP 3]" : "[STEP 2]"}
          </span>
          <span>
            {isComplete
              ? "최종 보고서 완성"
              : isMeeting
              ? "3자 교차 검증 회의 + 최종 보고서 생성"
              : "3명 전문가 순차 검토 진행"}
          </span>
        </div>

        {/* Agent cards */}
        <div className="grid grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="flex flex-col items-center">
              <PixelCharacter
                id={agent.id as "choi" | "kim" | "lee"}
                status={agent.status}
                name={agent.name}
                role={agent.role}
              />
              {/* Streaming preview */}
              {agent.status === "working" && streamPreviews[agent.id] && (
                <p className="text-green-700 font-mono text-xs mt-2 text-center px-2 truncate w-full">
                  {streamPreviews[agent.id].slice(-50)}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Meeting animation */}
        {isMeeting && (
          <div className="border border-yellow-700 bg-yellow-950 rounded-lg p-4 text-center animate-fade-in-up">
            <p className="text-yellow-400 font-mono font-bold text-sm">
              🤝 3자 교차 검증 회의 진행 중
            </p>
            <p className="text-yellow-700 font-mono text-xs mt-1">
              CHOI ↔ KIM ↔ LEE · QA 원본 대조 · 최종 보고서 생성...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="border border-red-800 bg-red-950 rounded-lg p-4">
            <p className="text-red-400 font-mono text-sm">⚠ 오류: {error}</p>
            <p className="text-red-700 font-mono text-xs mt-1">
              ANTHROPIC_API_KEY가 설정되어 있는지 확인하세요. (.env.local 파일)
            </p>
          </div>
        )}

        {/* System log */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div className="bg-gray-900 px-3 py-2 border-b border-gray-800">
            <p className="text-gray-500 font-mono text-xs font-bold">SYSTEM LOG</p>
          </div>
          <div
            ref={logRef}
            className="bg-gray-950 p-3 h-40 overflow-y-auto space-y-0.5 scanline relative"
          >
            {logLines.map((line, i) => (
              <p key={i} className="text-green-700 font-mono text-xs leading-5">
                {line}
              </p>
            ))}
            {!isComplete && (
              <p className="text-green-500 font-mono text-xs animate-blink">█</p>
            )}
          </div>
        </div>

        {/* Final report */}
        {isComplete && finalReport && (
          <div className="border border-green-800 rounded-lg overflow-hidden animate-fade-in-up">
            <div className="bg-gray-900 px-4 py-3 border-b border-green-900 flex items-center justify-between">
              <p className="text-green-400 font-mono font-bold text-sm">
                📄 최종 통합 보고서
              </p>
              <button
                onClick={downloadReport}
                className="bg-green-800 hover:bg-green-700 text-black font-mono text-xs px-3 py-1 rounded font-bold"
              >
                ↓ 다운로드 (.md)
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 bg-gray-900">
              {TAB_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i + 1)}
                  className={`px-4 py-2 font-mono text-xs transition-all ${
                    activeTab === i + 1
                      ? "text-green-400 border-b-2 border-green-500 bg-gray-950"
                      : "text-gray-600 hover:text-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Report content */}
            <div className="bg-gray-950 p-6 min-h-96 max-h-screen overflow-y-auto">
              <div
                className="report-content"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(
                    activeTab <= 5
                      ? extractSection(finalReport, activeTab)
                      : finalReport
                  ),
                }}
              />
            </div>

            {/* Agent details toggle */}
            <div className="border-t border-gray-800 bg-gray-900 px-4 py-3">
              <p className="text-gray-600 font-mono text-xs">
                각 에이전트 상세 검토 결과는 다운로드된 .md 파일에서 확인 가능합니다.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
