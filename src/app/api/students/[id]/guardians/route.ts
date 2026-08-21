import { NextRequest, NextResponse } from "next/server";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { apiErrorResponse, ConflictError, NotFoundError, ValidationError } from "@/lib/api-errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolContext();
    const { id: studentId } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ValidationError("Corpo da requisição inválido.");
    }

    const { guardianId, isPrimary } = body as Record<string, unknown>;
    if (typeof guardianId !== "string") {
      throw new ValidationError("`guardianId` é obrigatório.");
    }
    if (isPrimary !== undefined && typeof isPrimary !== "boolean") {
      throw new ValidationError("`isPrimary` deve ser booleano.");
    }

    const link = await withTenantContext(schoolId, async (tx) => {
      // RLS garante que student/guardian de outro tenant não aparecem aqui.
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundError("Aluno não encontrado.");

      const guardian = await tx.guardian.findUnique({ where: { id: guardianId } });
      if (!guardian) throw new ValidationError("`guardianId` não corresponde a um responsável desta escola.");

      const existing = await tx.studentGuardian.findUnique({
        where: { studentId_guardianId: { studentId, guardianId } },
      });
      if (existing) throw new ConflictError("Este responsável já está vinculado a este aluno.");

      return tx.studentGuardian.create({
        data: { studentId, guardianId, isPrimary: isPrimary ?? true },
        include: { guardian: true },
      });
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
