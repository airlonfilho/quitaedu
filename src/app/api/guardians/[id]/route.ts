import { NextRequest, NextResponse } from "next/server";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { apiErrorResponse, NotFoundError, ValidationError } from "@/lib/api-errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolContext();
    const { id } = await params;

    // RLS filtra por schoolId no banco — um id de outro tenant simplesmente
    // não existe do ponto de vista desta conexão (ver src/lib/prisma-tenant.ts).
    const guardian = await withTenantContext(schoolId, (tx) =>
      tx.guardian.findUnique({ where: { id } }),
    );
    if (!guardian) throw new NotFoundError("Responsável não encontrado.");

    return NextResponse.json(guardian);
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

    const { name, phone, email } = body as Record<string, unknown>;
    const data: { name?: string; phone?: string; email?: string | null } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        throw new ValidationError("`name` inválido.");
      }
      data.name = name.trim();
    }
    if (phone !== undefined) {
      if (typeof phone !== "string" || phone.trim().length === 0) {
        throw new ValidationError("`phone` inválido.");
      }
      data.phone = phone.trim();
    }
    if (email !== undefined) {
      if (email !== null && typeof email !== "string") {
        throw new ValidationError("`email` inválido.");
      }
      data.email = email;
    }

    const guardian = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.guardian.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Responsável não encontrado.");
      return tx.guardian.update({ where: { id }, data });
    });

    return NextResponse.json(guardian);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
