import { NextRequest, NextResponse } from "next/server";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { apiErrorResponse, ValidationError } from "@/lib/api-errors";

const NOTIFICATION_CHANNELS = ["WHATSAPP", "EMAIL", "SMS", "VOICE"] as const;
type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

function parseIntArray(value: unknown, field: string): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((n) => Number.isInteger(n) && n >= 0)) {
    throw new ValidationError(`\`${field}\` deve ser uma lista de inteiros não-negativos.`);
  }
  return value as number[];
}

function parseChannels(value: unknown): NotificationChannel[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((c) => NOTIFICATION_CHANNELS.includes(c))) {
    throw new ValidationError(`\`channels\` deve ser uma lista contendo apenas: ${NOTIFICATION_CHANNELS.join(", ")}.`);
  }
  return value as NotificationChannel[];
}

/**
 * POST cria a régua se não existir ou atualiza a existente (idempotente) —
 * studentId omitido/null = regra padrão da escola; preenchido = override de
 * um aluno específico (Constitution, Artigo VI: humano no loop por aluno).
 *
 * O schema não tem um índice único parcial para "só uma regra padrão por
 * escola" (Prisma não modela unique parcial) — a garantia vem deste
 * find-then-write ser o único caminho de escrita da régua.
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requireSchoolContext();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ValidationError("Corpo da requisição inválido.");
    }

    const { studentId, daysBefore, daysAfter, channels, active } = body as Record<string, unknown>;
    if (studentId !== undefined && studentId !== null && typeof studentId !== "string") {
      throw new ValidationError("`studentId` inválido.");
    }
    if (active !== undefined && typeof active !== "boolean") {
      throw new ValidationError("`active` deve ser booleano.");
    }
    const normalizedDaysBefore = parseIntArray(daysBefore, "daysBefore");
    const normalizedDaysAfter = parseIntArray(daysAfter, "daysAfter");
    const normalizedChannels = parseChannels(channels);
    const normalizedStudentId = typeof studentId === "string" ? studentId : null;

    let wasCreated = false;
    const rule = await withTenantContext(schoolId, async (tx) => {
      if (normalizedStudentId) {
        const student = await tx.student.findUnique({ where: { id: normalizedStudentId } });
        if (!student) throw new ValidationError("`studentId` não corresponde a um aluno desta escola.");
      }

      const existing = await tx.billingRule.findFirst({
        where: { schoolId, studentId: normalizedStudentId },
      });

      if (existing) {
        return tx.billingRule.update({
          where: { id: existing.id },
          data: {
            daysBefore: normalizedDaysBefore,
            daysAfter: normalizedDaysAfter,
            channels: normalizedChannels,
            active,
          },
        });
      }

      wasCreated = true;
      return tx.billingRule.create({
        data: {
          schoolId,
          studentId: normalizedStudentId,
          ...(normalizedDaysBefore !== undefined && { daysBefore: normalizedDaysBefore }),
          ...(normalizedDaysAfter !== undefined && { daysAfter: normalizedDaysAfter }),
          channels: normalizedChannels ?? [],
          active: active ?? true,
        },
      });
    });

    return NextResponse.json(rule, { status: wasCreated ? 201 : 200 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requireSchoolContext();
    const studentId = request.nextUrl.searchParams.get("studentId");

    const rules = await withTenantContext(schoolId, (tx) =>
      tx.billingRule.findMany({
        where: studentId !== null ? { studentId } : undefined,
      }),
    );

    return NextResponse.json(rules);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
