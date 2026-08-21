import { NextRequest, NextResponse } from "next/server";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { apiErrorResponse, NotFoundError } from "@/lib/api-errors";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; guardianId: string }> },
) {
  try {
    const { schoolId } = await requireSchoolContext();
    const { id: studentId, guardianId } = await params;

    await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.studentGuardian.findUnique({
        where: { studentId_guardianId: { studentId, guardianId } },
      });
      if (!existing) throw new NotFoundError("Vínculo não encontrado.");

      await tx.studentGuardian.delete({
        where: { studentId_guardianId: { studentId, guardianId } },
      });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
