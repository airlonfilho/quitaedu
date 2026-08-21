import { NextRequest, NextResponse } from "next/server";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { apiErrorResponse, ValidationError } from "@/lib/api-errors";

const CHARGE_STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELLED"] as const;
type ChargeStatus = (typeof CHARGE_STATUSES)[number];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * FR-007: indicadores de inadimplência (taxa geral, por turma, evolução
 * mensal). Calculado sobre o espelho local (ver Constitution, Artigo NFR-002
 * — não bloqueia se o Asaas estiver fora do ar). Volume esperado é baixo
 * (poucas escolas-piloto, até ~500 alunos — ver plan.md), então agregamos
 * em memória em vez de várias queries de groupBy.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requireSchoolContext();

    const competencyParam = request.nextUrl.searchParams.get("competency");
    const now = new Date();
    let targetYear = now.getUTCFullYear();
    let targetMonth = now.getUTCMonth() + 1;

    if (competencyParam !== null) {
      const match = /^(\d{4})-(\d{2})$/.exec(competencyParam);
      if (!match) throw new ValidationError("`competency` deve estar no formato YYYY-MM.");
      targetMonth = Number(match[2]);
      if (targetMonth < 1 || targetMonth > 12) {
        throw new ValidationError("`competency` deve ter um mês entre 01 e 12.");
      }
      targetYear = Number(match[1]);
    }

    const summary = await withTenantContext(schoolId, async (tx) => {
      const [activeStudents, inactiveStudents, charges] = await Promise.all([
        tx.student.count({ where: { status: "ACTIVE" } }),
        tx.student.count({ where: { status: "INACTIVE" } }),
        tx.charge.findMany({
          select: {
            status: true,
            value: true,
            competencyYear: true,
            competencyMonth: true,
            student: { select: { className: true } },
          },
        }),
      ]);

      const inCompetency = charges.filter(
        (c) => c.competencyYear === targetYear && c.competencyMonth === targetMonth,
      );

      const byStatus: Record<ChargeStatus, { count: number; totalValue: number }> = {
        PENDING: { count: 0, totalValue: 0 },
        PAID: { count: 0, totalValue: 0 },
        OVERDUE: { count: 0, totalValue: 0 },
        CANCELLED: { count: 0, totalValue: 0 },
      };
      for (const charge of inCompetency) {
        byStatus[charge.status].count += 1;
        byStatus[charge.status].totalValue += Number(charge.value);
      }
      for (const status of CHARGE_STATUSES) {
        byStatus[status].totalValue = round2(byStatus[status].totalValue);
      }

      const consideredForRate = byStatus.PENDING.count + byStatus.PAID.count + byStatus.OVERDUE.count;
      const delinquencyRate = consideredForRate === 0 ? 0 : round2(byStatus.OVERDUE.count / consideredForRate);

      const byClassNameMap = new Map<string, { totalCharges: number; overdueCharges: number }>();
      for (const charge of inCompetency) {
        const className = charge.student.className ?? "(sem turma)";
        const bucket = byClassNameMap.get(className) ?? { totalCharges: 0, overdueCharges: 0 };
        bucket.totalCharges += 1;
        if (charge.status === "OVERDUE") bucket.overdueCharges += 1;
        byClassNameMap.set(className, bucket);
      }
      const byClassName = Array.from(byClassNameMap.entries())
        .map(([className, stats]) => ({ className, ...stats }))
        .sort((a, b) => a.className.localeCompare(b.className));

      const monthlyTrendMap = new Map<string, { year: number; month: number; totalCharges: number; overdueCharges: number }>();
      for (const charge of charges) {
        const key = `${charge.competencyYear}-${charge.competencyMonth}`;
        const bucket = monthlyTrendMap.get(key) ?? {
          year: charge.competencyYear,
          month: charge.competencyMonth,
          totalCharges: 0,
          overdueCharges: 0,
        };
        bucket.totalCharges += 1;
        if (charge.status === "OVERDUE") bucket.overdueCharges += 1;
        monthlyTrendMap.set(key, bucket);
      }
      const monthlyTrend = Array.from(monthlyTrendMap.values()).sort(
        (a, b) => a.year - b.year || a.month - b.month,
      );

      return {
        competency: { year: targetYear, month: targetMonth },
        students: { active: activeStudents, inactive: inactiveStudents },
        charges: byStatus,
        delinquencyRate,
        byClassName,
        monthlyTrend,
      };
    });

    return NextResponse.json(summary);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
