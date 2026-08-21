import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { apiErrorResponse, NotFoundError, ValidationError } from "@/lib/api-errors";

const MIN_DUE_DAY = 1;
const MAX_DUE_DAY = 28;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolContext();
    const { id } = await params;

    const plan = await withTenantContext(schoolId, (tx) => tx.tuitionPlan.findUnique({ where: { id } }));
    if (!plan) throw new NotFoundError("Plano de mensalidade não encontrado.");

    return NextResponse.json(plan);
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

    const { name, baseValue, dueDay, discountRules } = body as Record<string, unknown>;
    const data: Prisma.TuitionPlanUpdateInput = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) throw new ValidationError("`name` inválido.");
      data.name = name.trim();
    }
    if (baseValue !== undefined) {
      if (typeof baseValue !== "number" || !Number.isFinite(baseValue) || baseValue <= 0) {
        throw new ValidationError("`baseValue` deve ser um número maior que zero.");
      }
      data.baseValue = baseValue;
    }
    if (dueDay !== undefined) {
      if (!Number.isInteger(dueDay) || (dueDay as number) < MIN_DUE_DAY || (dueDay as number) > MAX_DUE_DAY) {
        throw new ValidationError(`\`dueDay\` deve ser um inteiro entre ${MIN_DUE_DAY} e ${MAX_DUE_DAY}.`);
      }
      data.dueDay = dueDay as number;
    }
    if (discountRules !== undefined) {
      if (discountRules !== null && (typeof discountRules !== "object" || Array.isArray(discountRules))) {
        throw new ValidationError("`discountRules` deve ser um objeto JSON.");
      }
      data.discountRules = discountRules === null ? Prisma.JsonNull : (discountRules as Prisma.InputJsonValue);
    }

    const plan = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.tuitionPlan.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Plano de mensalidade não encontrado.");
      return tx.tuitionPlan.update({ where: { id }, data });
    });

    return NextResponse.json(plan);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
