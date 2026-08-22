import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ChargeStatus } from "@prisma/client";

const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

/**
 * Mapeia eventos de payment do Asaas para o ChargeStatus local. Eventos não
 * listados (ex: SUBSCRIPTION_*) são aceitos (200) mas ignorados.
 */
const STATUS_BY_EVENT: Record<string, ChargeStatus> = {
  PAYMENT_CREATED: "PENDING",
  PAYMENT_UPDATED: "PENDING",
  PAYMENT_CONFIRMED: "PAID",
  PAYMENT_RECEIVED: "PAID",
  PAYMENT_OVERDUE: "OVERDUE",
  PAYMENT_DELETED: "CANCELLED",
  PAYMENT_REFUNDED: "CANCELLED",
};

/**
 * A-013. Sem sessão de usuário — autenticado comparando o header
 * `asaas-access-token` com o token escolhido ao registrar o webhook
 * (ver contracts/api.md, research.md A-007). Usa o client admin
 * (src/lib/prisma.ts), não o tenant-scoped: o webhook não sabe a priori de
 * qual escola é o evento, só o `asaasChargeId` — a Charge já carrega o
 * schoolId correto.
 *
 * Idempotente por natureza: aplicar o mesmo evento duas vezes (reentrega do
 * Asaas) só reescreve o mesmo status, sem efeito colateral cumulativo.
 */
export async function POST(request: NextRequest) {
  if (!WEBHOOK_TOKEN) {
    console.error("ASAAS_WEBHOOK_TOKEN não configurado.");
    return NextResponse.json({ error: { message: "Webhook não configurado." } }, { status: 500 });
  }

  const receivedToken = request.headers.get("asaas-access-token");
  if (receivedToken !== WEBHOOK_TOKEN) {
    return NextResponse.json({ error: { message: "Token inválido." } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const event = body?.event;
  const paymentId = body?.payment?.id;
  if (typeof event !== "string" || typeof paymentId !== "string") {
    return NextResponse.json({ error: { message: "Payload inválido." } }, { status: 400 });
  }

  const newStatus = STATUS_BY_EVENT[event];
  if (!newStatus) {
    return NextResponse.json({ received: true, handled: false, reason: "evento não mapeado" });
  }

  const charge = await prisma.charge.findUnique({ where: { asaasChargeId: paymentId } });
  if (!charge) {
    // NFR-002: tolerar inconsistência temporária — a Charge pode ainda não
    // existir localmente por qualquer motivo. A reconciliação periódica
    // (A-014) é o fallback de segurança pra esse caso.
    return NextResponse.json({ received: true, handled: false, reason: "charge não encontrada localmente" });
  }

  await prisma.charge.update({
    where: { id: charge.id },
    data: {
      status: newStatus,
      paidAt: newStatus === "PAID" ? new Date() : charge.paidAt,
    },
  });

  return NextResponse.json({ received: true, handled: true });
}
