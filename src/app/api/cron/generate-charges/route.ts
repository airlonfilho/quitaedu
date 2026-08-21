import { NextRequest, NextResponse } from "next/server";
import { requireCronOrPlatformAdmin } from "@/lib/cron-auth";
import { generateMonthlyCharges } from "@/lib/asaas-monthly-generation";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    await requireCronOrPlatformAdmin(request);

    const now = new Date();
    const result = await generateMonthlyCharges(now.getUTCFullYear(), now.getUTCMonth() + 1);

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
