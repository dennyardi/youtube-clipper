import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const analysis = await prisma.analysis.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      progress: true,
      progressText: true,
      errorMessage: true,
    },
  });

  if (!analysis) return NextResponse.json({ error: "Analysis tidak ditemukan." }, { status: 404 });
  return NextResponse.json(analysis);
}
