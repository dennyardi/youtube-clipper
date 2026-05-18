import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getErrorMessage, getErrorStack } from "@/lib/errors";

export async function logError(scope: string, error: unknown, metadata?: Record<string, unknown>) {
  try {
    await prisma.errorLog.create({
      data: {
        scope,
        message: getErrorMessage(error),
        stack: getErrorStack(error),
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (logFailure) {
    console.error("Failed to write ErrorLog", logFailure);
  }
}
