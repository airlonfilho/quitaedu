import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { generateChargeForStudent } from "@/lib/asaas-charges";

/**
 * A-011: gera a cobrança do mês para todo aluno ativo com plano de
 * mensalidade, em todas as escolas — pensado pra rodar via cron
 * (ver src/app/api/cron/generate-charges/route.ts). Idempotente porque
 * `generateChargeForStudent` já checa a constraint única antes de chamar o
 * Asaas de novo.
 */
export async function generateMonthlyCharges(competencyYear: number, competencyMonth: number) {
  const students = await prisma.student.findMany({
    where: { status: "ACTIVE", tuitionPlanId: { not: null } },
    select: { id: true, schoolId: true },
  });

  let processed = 0;
  const errors: { studentId: string; message: string }[] = [];

  for (const student of students) {
    try {
      await generateChargeForStudent(student.schoolId, student.id, competencyYear, competencyMonth);
      processed++;
    } catch (error) {
      errors.push({ studentId: student.id, message: error instanceof Error ? error.message : String(error) });
      Sentry.captureException(error, { tags: { job: "generate-charges" }, extra: { studentId: student.id } });
    }
  }

  return { checked: students.length, processed, errors };
}
