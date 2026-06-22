import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    const texts: string[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      if (ext === "pdf") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(buffer);
        texts.push(`=== 파일: ${file.name} ===\n${data.text}`);
      } else if (ext === "docx") {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        texts.push(`=== 파일: ${file.name} ===\n${result.value}`);
      } else if (ext === "txt") {
        texts.push(`=== 파일: ${file.name} ===\n${buffer.toString("utf-8")}`);
      } else {
        return NextResponse.json(
          { error: `지원하지 않는 파일 형식: ${file.name}` },
          { status: 400 }
        );
      }
    }

    const extractedText = texts.join("\n\n");

    if (extractedText.trim().length < 100) {
      return NextResponse.json(
        { error: "파일에서 텍스트를 추출할 수 없습니다. 스캔 PDF나 이미지 파일은 지원하지 않습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json({ extractedText });
  } catch (e) {
    console.error("Parse error:", e);
    return NextResponse.json(
      { error: "파일 파싱 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
