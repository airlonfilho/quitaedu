import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse, ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/api-errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    // SCHOOL_MANAGER só vê a própria escola — id da sessão, nunca o
    // parâmetro da URL isolado, decide o acesso. PLATFORM_ADMIN vê qualquer.
    if (session.user.role === "SCHOOL_MANAGER" && session.user.schoolId !== id) {
      throw new ForbiddenError();
    }

    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundError("Escola não encontrada.");

    return NextResponse.json(school);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
