import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { apiErrorResponse, ValidationError } from "@/lib/api-errors";

const MIN_DUE_DAY = 1;
const MAX_DUE_DAY = 28;

function parseDiscountRules(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("`discountRules` deve ser um objeto JSON.");
  }
  return value as Prisma.InputJsonValue;
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requireSchoolContext();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ValidationError("Corpo da requisição inválido.");
    }

    const { name, baseValue, dueDay, discountRules } = body as Record<string, unknown>;
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new ValidationError("`name` é obrigatório.");
    }
    if (typeof baseValue !== "number" || !Number.isFinite(baseValue) || baseValue <= 0) {
      throw new ValidationError("`baseValue` deve ser um número maior que zero.");
    }
    if (!Number.isInteger(dueDay) || (dueDay as number) < MIN_DUE_DAY || (dueDay as number) > MAX_DUE_DAY) {
      throw new ValidationError(`\`dueDay\` deve ser um inteiro entre ${MIN_DUE_DAY} e ${MAX_DUE_DAY}.`);
    }
    const normalizedDiscountRules = parseDiscountRules(discountRules);

    const plan = await withTenantContext(schoolId, (tx) =>
      tx.tuitionPlan.create({
        data: {
          schoolId,
          name: name.trim(),
          baseValue,
          dueDay: dueDay as number,
          discountRules: normalizedDiscountRules,
        },
      }),
    );

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET() {
  try {
    const { schoolId } = await requireSchoolContext();

    const plans = await withTenantContext(schoolId, (tx) =>
      tx.tuitionPlan.findMany({ orderBy: { name: "asc" } }),
    );

    return NextResponse.json(plans);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
