import { NextRequest, NextResponse } from "next/server";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { apiErrorResponse, NotFoundError, ValidationError } from "@/lib/api-errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolContext();
    const { id } = await params;

    const student = await withTenantContext(schoolId, (tx) =>
      tx.student.findUnique({
        where: { id },
        include: {
          tuitionPlan: true,
          guardians: { include: { guardian: true } },
        },
      }),
    );
    if (!student) throw new NotFoundError("Aluno não encontrado.");

    return NextResponse.json(student);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolContext();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ValidationError("Corpo da requisição inválido.");
    }

    const { name, className, tuitionPlanId, status } = body as Record<string, unknown>;
    const data: {
      name?: string;
      className?: string | null;
      tuitionPlanId?: string | null;
      status?: "ACTIVE" | "INACTIVE";
    } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) throw new ValidationError("`name` inválido.");
      data.name = name.trim();
    }
    if (className !== undefined) {
      if (className !== null && typeof className !== "string") throw new ValidationError("`className` inválido.");
      data.className = className;
    }
    if (status !== undefined) {
      if (status !== "ACTIVE" && status !== "INACTIVE") throw new ValidationError("`status` deve ser ACTIVE ou INACTIVE.");
      data.status = status;
    }
    if (tuitionPlanId !== undefined) {
      if (tuitionPlanId !== null && typeof tuitionPlanId !== "string") {
        throw new ValidationError("`tuitionPlanId` inválido.");
      }
      data.tuitionPlanId = tuitionPlanId;
    }

    const student = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.student.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Aluno não encontrado.");

      if (typeof data.tuitionPlanId === "string") {
        const plan = await tx.tuitionPlan.findUnique({ where: { id: data.tuitionPlanId } });
        if (!plan) throw new ValidationError("`tuitionPlanId` não corresponde a um plano desta escola.");
      }

      return tx.student.update({ where: { id }, data });
    });

    return NextResponse.json(student);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
