import { NextRequest, NextResponse } from "next/server";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { apiErrorResponse, ValidationError } from "@/lib/api-errors";

const CHARGE_STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELLED"] as const;
type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requireSchoolContext();
    const status = request.nextUrl.searchParams.get("status");
    const studentId = request.nextUrl.searchParams.get("studentId");
    const competency = request.nextUrl.searchParams.get("competency");

    if (status !== null && !CHARGE_STATUSES.includes(status as ChargeStatus)) {
      throw new ValidationError(`\`status\` deve ser um de: ${CHARGE_STATUSES.join(", ")}.`);
    }

    let competencyYear: number | undefined;
    let competencyMonth: number | undefined;
    if (competency !== null) {
      const match = /^(\d{4})-(\d{2})$/.exec(competency);
      if (!match) throw new ValidationError("`competency` deve estar no formato YYYY-MM.");
      competencyMonth = Number(match[2]);
      if (competencyMonth < 1 || competencyMonth > 12) {
        throw new ValidationError("`competency` deve ter um mês entre 01 e 12.");
      }
      competencyYear = Number(match[1]);
    }

    const charges = await withTenantContext(schoolId, (tx) =>
      tx.charge.findMany({
        where: {
          status: (status as ChargeStatus) ?? undefined,
          studentId: studentId ?? undefined,
          competencyYear,
          competencyMonth,
        },
        orderBy: [{ competencyYear: "desc" }, { competencyMonth: "desc" }],
      }),
    );

    return NextResponse.json(charges);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
