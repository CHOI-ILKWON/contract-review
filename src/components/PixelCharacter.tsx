"use client";

import { type ReactElement } from "react";

const P = 5; // pixel size

type Status = "standby" | "working" | "done";

interface CharDef {
  colors: Record<string, string>;
  grid: string[];
}

// 10x18 pixel grid per character
const CHARACTERS: Record<string, CharDef> = {
  choi: {
    colors: {
      H: "#FCD34D", // yellow hard hat
      S: "#FBBF8C", // skin
      E: "#1a1a1a", // eyes
      M: "#d97070", // mouth
      U: "#1D4ED8", // blue uniform
      P: "#1E3A8A", // dark blue pants
      B: "#111827", // black boots
      T: "#F59E0B", // hat stripe
    },
    grid: [
      ".HHHHHHHH.",
      "HHHHHHHHHH",
      "TTTTTTTTTT", // hat brim stripe
      ".SSSSSSSS.",
      ".SE.SS.ES.",
      ".SSSSSSSS.",
      "..SSMSSS..",
      "..SSSSSS..",
      "...SSSS...",
      ".UUUUUUUU.",
      "UUUUUUUUUU",
      "UUUUUUUUUU",
      ".UUUUUUUU.",
      "..PPPPPP..",
      "..PP..PP..",
      "..PP..PP..",
      "..BB..BB..",
      ".BBB..BBB.",
    ],
  },
  kim: {
    colors: {
      H: "#1a1a1a", // black hair
      S: "#FBBF8C", // skin
      E: "#1a1a1a", // eyes
      M: "#d97070", // mouth
      U: "#111827", // black suit
      W: "#F8FAFC", // white shirt
      T: "#DC2626", // red tie
      P: "#111827", // dark pants
      B: "#0f172a", // black shoes
    },
    grid: [
      "..HHHHHH..",
      ".HHHHHHHH.",
      ".HSSSSSSH.",
      ".SSSSSSSS.",
      ".SE.SS.ES.",
      ".SSSSSSSS.",
      "..SSMSSS..",
      "..SSSSSS..",
      "...SSWW...",
      ".UUWWTTUU.",
      "UUUWTTUUUU",
      "UUUWTTUUU.",
      ".UUWTTUUU.",
      "..PPPPPP..",
      "..PP..PP..",
      "..PP..PP..",
      "..BB..BB..",
      ".BBB..BBB.",
    ],
  },
  lee: {
    colors: {
      H: "#92400E", // brown hair
      S: "#FBBF8C", // skin
      E: "#1a1a1a", // eyes
      M: "#d97070", // mouth
      U: "#4B5563", // gray jacket
      W: "#E5E7EB", // light shirt
      P: "#1F2937", // dark navy pants
      B: "#111827", // black shoes
      L: "#0EA5E9", // laptop blue
      D: "#1E293B", // laptop dark
    },
    grid: [
      "..HHHHHH..",
      ".HHHHHHHH.",
      ".HSSSSSSH.",
      ".SSSSSSSS.",
      ".SE.SS.ES.",
      ".SSSSSSSS.",
      "..SSMSSS..",
      "..SSSSSS..",
      "...SWWWS..",
      ".UUWWWWUU.",
      "UUUUUUUUUU",
      "UUUUUUUUUU",
      ".UUUUUUUU.",
      "..PPPPPP..",
      ".LLLPPLL..",
      ".LLLPPLL..",
      "..DDBBD...",
      ".BBB..BBB.",
    ],
  },
};

function renderGrid(char: CharDef, isGray: boolean) {
  const rects: ReactElement[] = [];
  char.grid.forEach((row, rowIdx) => {
    [...row].forEach((code, colIdx) => {
      if (code === "." || code === " ") return;
      const color = char.colors[code] ?? "#888";
      rects.push(
        <rect
          key={`${rowIdx}-${colIdx}`}
          x={colIdx * P}
          y={rowIdx * P}
          width={P}
          height={P}
          fill={isGray ? "#555" : color}
        />
      );
    });
  });
  return rects;
}

export default function PixelCharacter({
  id,
  status,
  name,
  role,
}: {
  id: "choi" | "kim" | "lee";
  status: Status;
  name: string;
  role: string;
}) {
  const char = CHARACTERS[id];
  const isGray = status === "standby";
  const isWorking = status === "working";
  const isDone = status === "done";

  const w = 10 * P;
  const h = 18 * P;

  return (
    <div
      className={`flex flex-col items-center gap-3 p-4 rounded-lg border transition-all duration-500 ${
        isWorking
          ? "border-green-500 bg-green-950 shadow-lg shadow-green-900"
          : isDone
          ? "border-green-800 bg-gray-900"
          : "border-gray-800 bg-gray-900 opacity-40"
      }`}
    >
      {/* Character SVG */}
      <div className="relative">
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{
            imageRendering: "pixelated",
            animation: isWorking ? "walk 0.35s steps(1) infinite" : "none",
            filter: isGray
              ? "grayscale(1) brightness(0.5)"
              : isDone
              ? "drop-shadow(0 0 6px #22c55e)"
              : "drop-shadow(0 0 8px #16a34a)",
          }}
        >
          {renderGrid(char, isGray)}
        </svg>

        {/* DONE badge */}
        {isDone && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-black text-xs font-bold">
            ✓
          </div>
        )}

        {/* WORKING indicator */}
        {isWorking && (
          <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-400 rounded-full animate-ping" />
        )}
      </div>

      {/* Name & role */}
      <div className="text-center">
        <p
          className={`font-mono font-bold text-sm ${
            isGray ? "text-gray-600" : "text-green-400"
          }`}
        >
          {name}
        </p>
        <p className="text-gray-600 font-mono text-xs mt-0.5">{role}</p>
      </div>

      {/* Status label */}
      <div
        className={`font-mono text-xs px-2 py-0.5 rounded border ${
          isWorking
            ? "text-green-400 border-green-700 bg-green-900 animate-pulse"
            : isDone
            ? "text-green-600 border-green-900 bg-gray-900"
            : "text-gray-700 border-gray-800"
        }`}
      >
        {isWorking ? "● 검토 중..." : isDone ? "✓ DONE" : "○ 대기"}
      </div>
    </div>
  );
}
