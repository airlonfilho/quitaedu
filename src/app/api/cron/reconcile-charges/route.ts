import { NextRequest, NextResponse } from "next/server";
import { requireCronOrPlatformAdmin } from "@/lib/cron-auth";
import { reconcileCharges } from "@/lib/asaas-reconciliation";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    await requireCronOrPlatformAdmin(request);

    const result = await reconcileCharges();

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
