import { NextRequest, NextResponse } from "next/server";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { apiErrorResponse, ConflictError, ValidationError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requireSchoolContext();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ValidationError("Corpo da requisição inválido.");
    }

    const { name, cpf, phone, email } = body as Record<string, unknown>;
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new ValidationError("`name` é obrigatório.");
    }
    if (typeof cpf !== "string") {
      throw new ValidationError("`cpf` é obrigatório.");
    }
    if (typeof phone !== "string" || phone.trim().length === 0) {
      throw new ValidationError("`phone` é obrigatório.");
    }
    if (email !== undefined && email !== null && typeof email !== "string") {
      throw new ValidationError("`email` inválido.");
    }

    const normalizedCpf = cpf.replace(/\D/g, "");
    if (normalizedCpf.length !== 11) {
      throw new ValidationError("`cpf` deve ter 11 dígitos.");
    }

    const guardian = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.guardian.findUnique({
        where: { schoolId_cpf: { schoolId, cpf: normalizedCpf } },
      });
      if (existing) {
        throw new ConflictError("Já existe um responsável cadastrado com este CPF.");
      }

      return tx.guardian.create({
        data: {
          schoolId,
          name: name.trim(),
          cpf: normalizedCpf,
          phone: phone.trim(),
          email: typeof email === "string" ? email.trim() : null,
        },
      });
    });

    return NextResponse.json(guardian, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requireSchoolContext();
    const search = request.nextUrl.searchParams.get("search")?.trim();

    const guardians = await withTenantContext(schoolId, (tx) =>
      tx.guardian.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { cpf: { contains: search.replace(/\D/g, "") } },
              ],
            }
          : undefined,
        orderBy: { name: "asc" },
      }),
    );

    return NextResponse.json(guardians);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
