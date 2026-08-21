import { NextRequest, NextResponse } from "next/server";
import { requireSchoolContext } from "@/lib/tenant-context";
import { generateChargeForStudent, ChargeGenerationError } from "@/lib/asaas-charges";
import { apiErrorResponse, ValidationError } from "@/lib/api-errors";
import { AsaasError } from "@/lib/asaas";

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requireSchoolContext();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ValidationError("Corpo da requisição inválido.");
    }

    const { studentId, competency } = body as Record<string, unknown>;
    if (typeof studentId !== "string") {
      throw new ValidationError("`studentId` é obrigatório.");
    }

    const now = new Date();
    let competencyYear = now.getUTCFullYear();
    let competencyMonth = now.getUTCMonth() + 1;
    if (competency !== undefined) {
      if (typeof competency !== "string") throw new ValidationError("`competency` inválido.");
      const match = /^(\d{4})-(\d{2})$/.exec(competency);
      if (!match) throw new ValidationError("`competency` deve estar no formato YYYY-MM.");
      competencyMonth = Number(match[2]);
      if (competencyMonth < 1 || competencyMonth > 12) {
        throw new ValidationError("`competency` deve ter um mês entre 01 e 12.");
      }
      competencyYear = Number(match[1]);
    }

    const charge = await generateChargeForStudent(schoolId, studentId, competencyYear, competencyMonth);

    return NextResponse.json(charge, { status: 201 });
  } catch (error) {
    if (error instanceof ChargeGenerationError) {
      return apiErrorResponse(new ValidationError(error.message));
    }
    if (error instanceof AsaasError) {
      console.error("Asaas error", error.status, error.body);
      return NextResponse.json({ error: { message: "Falha ao comunicar com o Asaas." } }, { status: 502 });
    }
    return apiErrorResponse(error);
  }
}
