import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/tenant-context";
import { apiErrorResponse, ConflictError, ValidationError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ValidationError("Corpo da requisição inválido.");
    }

    const { name, cnpj } = body as { name?: unknown; cnpj?: unknown };
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new ValidationError("`name` é obrigatório.");
    }
    if (typeof cnpj !== "string") {
      throw new ValidationError("`cnpj` é obrigatório.");
    }

    const normalizedCnpj = cnpj.replace(/\D/g, "");
    if (normalizedCnpj.length !== 14) {
      throw new ValidationError("`cnpj` deve ter 14 dígitos.");
    }

    const existing = await prisma.school.findUnique({ where: { cnpj: normalizedCnpj } });
    if (existing) {
      throw new ConflictError("Já existe uma escola cadastrada com este CNPJ.");
    }

    const school = await prisma.school.create({
      data: { name: name.trim(), cnpj: normalizedCnpj },
    });

    // TODO(A-009): disparar criação da subconta Asaas white label aqui —
    // aguardando validação de sandbox da Trilha C (A-006, ver research.md).
    // Por ora a escola nasce em SchoolStatus.ONBOARDING sem SchoolSubaccount.

    return NextResponse.json(school, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
