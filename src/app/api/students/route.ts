import { NextRequest, NextResponse } from "next/server";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { apiErrorResponse, ValidationError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requireSchoolContext();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ValidationError("Corpo da requisição inválido.");
    }

    const { name, className, tuitionPlanId } = body as Record<string, unknown>;
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new ValidationError("`name` é obrigatório.");
    }
    if (className !== undefined && className !== null && typeof className !== "string") {
      throw new ValidationError("`className` inválido.");
    }
    if (tuitionPlanId !== undefined && tuitionPlanId !== null && typeof tuitionPlanId !== "string") {
      throw new ValidationError("`tuitionPlanId` inválido.");
    }

    const student = await withTenantContext(schoolId, async (tx) => {
      if (typeof tuitionPlanId === "string") {
        // RLS garante que só um plano da própria escola é visível aqui.
        const plan = await tx.tuitionPlan.findUnique({ where: { id: tuitionPlanId } });
        if (!plan) throw new ValidationError("`tuitionPlanId` não corresponde a um plano desta escola.");
      }

      return tx.student.create({
        data: {
          schoolId,
          name: name.trim(),
          className: typeof className === "string" ? className.trim() : null,
          tuitionPlanId: typeof tuitionPlanId === "string" ? tuitionPlanId : null,
        },
      });
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requireSchoolContext();
    const status = request.nextUrl.searchParams.get("status");
    const className = request.nextUrl.searchParams.get("className");

    if (status !== null && status !== "ACTIVE" && status !== "INACTIVE") {
      throw new ValidationError("`status` deve ser ACTIVE ou INACTIVE.");
    }

    const students = await withTenantContext(schoolId, (tx) =>
      tx.student.findMany({
        where: {
          status: status ?? undefined,
          className: className ?? undefined,
        },
        orderBy: { name: "asc" },
      }),
    );

    return NextResponse.json(students);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
