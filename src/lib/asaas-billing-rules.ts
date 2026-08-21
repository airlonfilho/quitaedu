import { withTenantContext } from "@/lib/prisma-tenant";
import { asaasRequest, resolveAsaasApiKey, AsaasError } from "@/lib/asaas";

interface AsaasNotification {
  id: string;
  event: string;
  scheduleOffset: number;
}

const CHANNEL_FIELDS = {
  WHATSAPP: "whatsappEnabledForCustomer",
  EMAIL: "emailEnabledForCustomer",
  SMS: "smsEnabledForCustomer",
  VOICE: "phoneCallEnabledForCustomer",
} as const;

type Channel = keyof typeof CHANNEL_FIELDS;

/**
 * A-012: espelha uma BillingRule (override de aluno) na configuração de
 * notificação do cliente no Asaas.
 *
 * Duas limitações reais do Asaas confirmadas em sandbox (A-006):
 * 1. Não dá pra criar notificações novas, só alterar as fixas que já
 *    existem por evento (`PAYMENT_DUEDATE_WARNING` pré-vencimento,
 *    `PAYMENT_OVERDUE` atraso) — texto da mensagem não é customizável, só
 *    canal e `scheduleOffset`.
 * 2. `scheduleOffset` NÃO aceita qualquer inteiro — cada slot de
 *    notificação só aceita um conjunto restrito de valores (ex: um slot
 *    de PAYMENT_DUEDATE_WARNING testado só aceitou {5, 10, 15, 30}; um
 *    slot de PAYMENT_OVERDUE só aceitou {0}). O conjunto exato parece
 *    variar por slot e não está documentado publicamente — daysBefore/
 *    daysAfter arbitrários da régua local podem ser rejeitados pelo Asaas
 *    mesmo com slot disponível. Cada slot é tentado individualmente e uma
 *    rejeição não aborta os demais (ver `rejected` no retorno).
 *
 * Se a régua local tiver mais entradas em `daysBefore`/`daysAfter` do que
 * slots existentes no Asaas, o excesso é reportado em `dropped`.
 *
 * Só sincroniza réguas de override por aluno (`studentId` preenchido) cujo
 * responsável já tem `asaasCustomerId` — a régua padrão da escola
 * (`studentId: null`) não tem um cliente único pra apontar, então fica só
 * local até virar override real ou até o primeiro cliente ser criado.
 */
export async function syncBillingRuleToAsaas(
  schoolId: string,
  billingRule: {
    studentId: string | null;
    daysBefore: number[];
    daysAfter: number[];
    channels: string[];
    active: boolean;
  },
): Promise<{ synced: boolean; dropped: string[]; rejected: string[] }> {
  if (!billingRule.studentId) return { synced: false, dropped: [], rejected: [] };

  const guardian = await withTenantContext(schoolId, (tx) =>
    tx.studentGuardian.findFirst({
      where: { studentId: billingRule.studentId!, isPrimary: true },
      include: { guardian: true },
    }),
  );
  const asaasCustomerId = guardian?.guardian.asaasCustomerId;
  if (!asaasCustomerId) return { synced: false, dropped: [], rejected: [] };

  const apiKey = await resolveAsaasApiKey(schoolId);
  const notifications = await asaasRequest<{ data: AsaasNotification[] }>(
    apiKey,
    `/customers/${asaasCustomerId}/notifications`,
  );

  const channelFlags = Object.fromEntries(
    (Object.keys(CHANNEL_FIELDS) as Channel[]).map((channel) => [
      CHANNEL_FIELDS[channel],
      billingRule.channels.includes(channel),
    ]),
  );

  const dropped: string[] = [];
  const rejected: string[] = [];

  async function applyOffset(slot: AsaasNotification | undefined, offset: number, label: string) {
    if (!slot) {
      dropped.push(`${label}=${offset} (sem slot disponível no Asaas para este evento)`);
      return;
    }
    try {
      await asaasRequest(apiKey, `/notifications/${slot.id}`, {
        method: "POST",
        body: JSON.stringify({ enabled: billingRule.active, scheduleOffset: offset, ...channelFlags }),
      });
    } catch (error) {
      if (error instanceof AsaasError) {
        rejected.push(`${label}=${offset} (Asaas recusou: ${JSON.stringify(error.body)})`);
        return;
      }
      throw error;
    }
  }

  const dueDateWarnings = notifications.data
    .filter((n) => n.event === "PAYMENT_DUEDATE_WARNING")
    .sort((a, b) => b.scheduleOffset - a.scheduleOffset);
  const sortedDaysBefore = [...billingRule.daysBefore].sort((a, b) => b - a);
  for (let i = 0; i < sortedDaysBefore.length; i++) {
    await applyOffset(dueDateWarnings[i], sortedDaysBefore[i], "daysBefore");
  }

  const overdueNotifications = notifications.data
    .filter((n) => n.event === "PAYMENT_OVERDUE")
    .sort((a, b) => a.scheduleOffset - b.scheduleOffset);
  const sortedDaysAfter = [...billingRule.daysAfter].sort((a, b) => a - b);
  for (let i = 0; i < sortedDaysAfter.length; i++) {
    await applyOffset(overdueNotifications[i], sortedDaysAfter[i], "daysAfter");
  }

  return { synced: true, dropped, rejected };
}
