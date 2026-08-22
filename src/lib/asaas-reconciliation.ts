import { prisma } from "@/lib/prisma";
import { asaasRequest, resolveAsaasApiKey } from "@/lib/asaas";
import type { ChargeStatus } from "@prisma/client";

interface AsaasPaymentStatus {
  status: string;
}

/**
 * A-014: reconciliação periódica — fallback de segurança pra quando um
 * webhook se perde ou atrasa (NFR-002). Roda como job de sistema, não em
 * nome de uma sessão de escola específica — por isso usa o client admin
 * (bypassa RLS) e itera todas as escolas, não uma só.
 *
 * Escopo: só cobranças em estado não-terminal (PENDING/OVERDUE) — PAID e
 * CANCELLED não são re-checadas (reembolso pós-pagamento fica fora do
 * escopo do MVP).
 */
const ASAAS_STATUS_MAP: Record<string, ChargeStatus> = {
  PENDING: "PENDING",
  OVERDUE: "OVERDUE",
  CONFIRMED: "PAID",
  RECEIVED: "PAID",
  RECEIVED_IN_CASH: "PAID",
  REFUNDED: "CANCELLED",
  REFUND_REQUESTED: "CANCELLED",
  CHARGEBACK_REQUESTED: "CANCELLED",
  DELETED: "CANCELLED",
};

export async function reconcileCharges(): Promise<{
  checked: number;
  updated: number;
  errors: { chargeId: string; message: string }[];
}> {
  const pendingCharges = await prisma.charge.findMany({
    where: { status: { in: ["PENDING", "OVERDUE"] } },
  });

  let updated = 0;
  const errors: { chargeId: string; message: string }[] = [];

  for (const charge of pendingCharges) {
    try {
      const apiKey = await resolveAsaasApiKey(charge.schoolId);
      const payment = await asaasRequest<AsaasPaymentStatus>(apiKey, `/payments/${charge.asaasChargeId}`);
      const realStatus = ASAAS_STATUS_MAP[payment.status];

      if (realStatus && realStatus !== charge.status) {
        await prisma.charge.update({
          where: { id: charge.id },
          data: {
            status: realStatus,
            paidAt: realStatus === "PAID" ? new Date() : charge.paidAt,
          },
        });
        updated++;
      }
    } catch (error) {
      errors.push({ chargeId: charge.id, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { checked: pendingCharges.length, updated, errors };
}
