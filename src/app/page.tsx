"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [context, setContext] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ["pdf", "docx", "txt"].includes(ext ?? "");
    });
    if (valid.length < newFiles.length) {
      setError("PDF, DOCX, TXT 파일만 지원합니다.");
    } else {
      setError("");
    }
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError("계약서 파일을 먼저 업로드해주세요.");
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      formData.append("context", context);

      const res = await fetch("/api/parse", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).error ?? "파싱 실패");
      const { extractedText } = await res.json();

      sessionStorage.setItem("contractText", extractedText);
      sessionStorage.setItem("userContext", context);
      sessionStorage.setItem("fileNames", files.map((f) => f.name).join(", "));

      router.push("/review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="border-b border-green-900 bg-gray-900 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <span className="text-green-400 text-xl font-mono font-bold">▶</span>
          <div>
            <h1 className="text-green-400 font-mono font-bold text-lg tracking-wider">
              AI 계약서 검토 시스템 <span className="text-green-600 text-sm">v1.0</span>
            </h1>
            <p className="text-gray-500 text-xs font-mono">
              3-AGENT REVIEW · 누락 조항 감지 · CEO 보고서 자동 생성
            </p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 font-mono text-xs text-gray-500">
            <span className="text-green-400 font-bold">[STEP 1]</span>
            <span>계약서 업로드 + 참고 정보 입력</span>
          </div>

          {/* Upload zone */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-green-400 bg-green-950"
                : "border-gray-700 hover:border-green-700 bg-gray-900"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
            />
            <div className="text-4xl mb-3">📎</div>
            <p className="text-green-400 font-mono font-bold text-sm">
              파일 선택 또는 드래그&드롭
            </p>
            <p className="text-gray-500 font-mono text-xs mt-1">
              지원 형식: PDF / DOCX / TXT · 복수 파일 업로드 가능
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-gray-500 font-mono text-xs">[업로드된 파일]</p>
              {files.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded px-3 py-2"
                >
                  <span className="text-green-300 font-mono text-sm truncate">{f.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                    className="text-gray-600 hover:text-red-400 ml-2 font-mono text-xs"
                  >
                    [제거]
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Context input */}
          <div className="space-y-2">
            <label className="text-gray-500 font-mono text-xs">[참고 정보 입력 — 선택]</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="사업구도, 계약금 등 계약서에 명기되지 않은 참고할 만한 정보를 입력하세요.
예) 총 계약금액 500억, 국내 태양광 EPC 프로젝트, 당사는 Prime EPC로 참여"
              className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-300 font-mono text-sm resize-none focus:outline-none focus:border-green-600 placeholder-gray-700"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950 border border-red-800 rounded px-4 py-2">
              <p className="text-red-400 font-mono text-sm">⚠ {error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || files.length === 0}
            className={`w-full py-4 rounded-lg font-mono font-bold text-sm tracking-wider transition-all ${
              isLoading || files.length === 0
                ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                : "bg-green-700 hover:bg-green-600 text-black animate-pulse-green"
            }`}
          >
            {isLoading ? "⏳ 파일 분석 중..." : "🔍 계약서 검토 시작"}
          </button>

          {/* Info */}
          <div className="border border-gray-800 rounded-lg p-4 space-y-1">
            <p className="text-gray-600 font-mono text-xs font-bold">HOW IT WORKS</p>
            <p className="text-gray-600 font-mono text-xs">① 계약서 파일 자동 파싱 (텍스트 추출)</p>
            <p className="text-gray-600 font-mono text-xs">② 기술사 CHOI → 변호사 KIM → 사업개발자 LEE 순차 검토</p>
            <p className="text-gray-600 font-mono text-xs">③ 3자 교차 검증 회의 → QA → CEO 보고서 생성</p>
          </div>
        </div>
      </main>
    </div>
  );
}
