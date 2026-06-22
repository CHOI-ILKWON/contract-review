import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  PART1_PRINCIPLES,
  PART3_CHOI,
  PART4_KIM,
  PART5_LEE,
  PART6_FINAL_REPORT,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sseEvent(type: string, data: unknown): string {
  return `data: ${JSON.stringify({ type, data })}\n\n`;
}

async function callClaudeStreaming(
  system: string,
  userMessage: string,
  onChunk: (text: string) => void
): Promise<string> {
  let fullText = "";

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      onChunk(event.delta.text);
      fullText += event.delta.text;
    }
  }

  return fullText;
}

export async function POST(req: NextRequest) {
  const { extractedText, userContext } = await req.json();

  if (!extractedText) {
    return new Response("extractedText가 없습니다.", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(type, data)));
      };

      try {
        const baseUserMsg = `[계약서 원문]\n${extractedText}\n\n[참고 정보]\n${userContext || "없음"}`;

        // Stage 1: 기술사 CHOI
        send("stage", { id: "choi", label: "기술사 CHOI", status: "start" });

        const choiResult = await callClaudeStreaming(
          PART1_PRINCIPLES + "\n\n" + PART3_CHOI,
          baseUserMsg,
          (chunk) => send("chunk", { stage: "choi", text: chunk })
        );

        send("stage", { id: "choi", label: "기술사 CHOI", status: "done" });

        // Stage 2: 변호사 KIM
        send("stage", { id: "kim", label: "변호사 KIM", status: "start" });

        const kimResult = await callClaudeStreaming(
          PART1_PRINCIPLES + "\n\n" + PART4_KIM,
          baseUserMsg + "\n\n[기술사 CHOI 검토 결과]\n" + choiResult,
          (chunk) => send("chunk", { stage: "kim", text: chunk })
        );

        send("stage", { id: "kim", label: "변호사 KIM", status: "done" });

        // Stage 3: 사업개발자 LEE
        send("stage", { id: "lee", label: "사업개발자 LEE", status: "start" });

        const leeResult = await callClaudeStreaming(
          PART1_PRINCIPLES + "\n\n" + PART5_LEE,
          baseUserMsg +
            "\n\n[기술사 CHOI 검토 결과]\n" +
            choiResult +
            "\n\n[변호사 KIM 검토 결과]\n" +
            kimResult,
          (chunk) => send("chunk", { stage: "lee", text: chunk })
        );

        send("stage", { id: "lee", label: "사업개발자 LEE", status: "done" });

        // Stage 4: 3자 교차 검증 + 최종 보고서
        send("stage", { id: "meeting", label: "3자 교차 검증 회의", status: "start" });

        const finalReport = await callClaudeStreaming(
          PART1_PRINCIPLES + "\n\n" + PART6_FINAL_REPORT,
          baseUserMsg +
            "\n\n[기술사 CHOI 검토 결과]\n" +
            choiResult +
            "\n\n[변호사 KIM 검토 결과]\n" +
            kimResult +
            "\n\n[사업개발자 LEE 검토 결과]\n" +
            leeResult,
          (chunk) => send("chunk", { stage: "final", text: chunk })
        );

        send("stage", { id: "meeting", label: "3자 교차 검증 회의", status: "done" });
        send("complete", {
          choiResult,
          kimResult,
          leeResult,
          finalReport,
        });
      } catch (e) {
        console.error("Review error:", e);
        send("error", {
          message: e instanceof Error ? e.message : "AI 검토 중 오류가 발생했습니다.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
