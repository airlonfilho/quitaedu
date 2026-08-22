import { Prisma } from "@prisma/client";
import { withTenantContext } from "@/lib/prisma-tenant";
import { asaasRequest, resolveAsaasApiKey } from "@/lib/asaas";

export class ChargeGenerationError extends Error {}

interface AsaasCustomer {
  id: string;
}

interface AsaasPayment {
  id: string;
  bankSlipUrl: string | null;
}

function computeDueDate(year: number, month: number, dueDay: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(dueDay).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * A-010: gera a cobrança de um aluno para uma competência, criando o
 * cliente no Asaas se necessário e a cobrança em si (Pix + boleto + cartão
 * via billingType UNDEFINED — o pagador escolhe como pagar).
 *
 * Idempotente: se já existe uma Charge local para
 * (studentId, competencyYear, competencyMonth), retorna ela sem chamar o
 * Asaas de novo (evita cobrança duplicada — importante pro cron de A-011).
 */
export async function generateChargeForStudent(
  schoolId: string,
  studentId: string,
  competencyYear: number,
  competencyMonth: number,
) {
  const student = await withTenantContext(schoolId, (tx) =>
    tx.student.findUnique({
      where: { id: studentId },
      include: {
        tuitionPlan: true,
        guardians: { where: { isPrimary: true }, include: { guardian: true }, take: 1 },
      },
    }),
  );

  if (!student) throw new ChargeGenerationError("Aluno não encontrado.");
  if (student.status !== "ACTIVE") throw new ChargeGenerationError("Aluno não está ativo.");
  if (!student.tuitionPlan) throw new ChargeGenerationError("Aluno não tem plano de mensalidade associado.");
  const primaryGuardian = student.guardians[0]?.guardian;
  if (!primaryGuardian) throw new ChargeGenerationError("Aluno não tem responsável financeiro principal vinculado.");

  const existing = await withTenantContext(schoolId, (tx) =>
    tx.charge.findUnique({
      where: { studentId_competencyYear_competencyMonth: { studentId, competencyYear, competencyMonth } },
    }),
  );
  if (existing) return existing;

  const apiKey = await resolveAsaasApiKey(schoolId);

  let asaasCustomerId = primaryGuardian.asaasCustomerId;
  if (!asaasCustomerId) {
    const customer = await asaasRequest<AsaasCustomer>(apiKey, "/customers", {
      method: "POST",
      body: JSON.stringify({
        name: primaryGuardian.name,
        cpfCnpj: primaryGuardian.cpf,
        mobilePhone: primaryGuardian.phone,
        email: primaryGuardian.email ?? undefined,
      }),
    });
    asaasCustomerId = customer.id;
    await withTenantContext(schoolId, (tx) =>
      tx.guardian.update({ where: { id: primaryGuardian.id }, data: { asaasCustomerId } }),
    );
  }

  const payment = await asaasRequest<AsaasPayment>(apiKey, "/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: asaasCustomerId,
      billingType: "UNDEFINED",
      value: Number(student.tuitionPlan.baseValue),
      dueDate: computeDueDate(competencyYear, competencyMonth, student.tuitionPlan.dueDay),
      description: `Mensalidade ${String(competencyMonth).padStart(2, "0")}/${competencyYear} — ${student.name}`,
      externalReference: student.id,
    }),
  });

  let pixQrCode: string | null = null;
  try {
    const pix = await asaasRequest<{ payload: string }>(apiKey, `/payments/${payment.id}/pixQrCode`);
    pixQrCode = pix.payload;
  } catch {
    // Conta sem chave Pix cadastrada, por exemplo — não impede a cobrança
    // de existir com boleto/cartão via billingType UNDEFINED.
  }

  try {
    return await withTenantContext(schoolId, (tx) =>
      tx.charge.create({
        data: {
          schoolId,
          studentId,
          guardianId: primaryGuardian.id,
          competencyMonth,
          competencyYear,
          value: student.tuitionPlan!.baseValue,
          status: "PENDING",
          asaasChargeId: payment.id,
          pixQrCode,
          boletoUrl: payment.bankSlipUrl,
        },
      }),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Corrida rara: outra chamada criou a Charge local entre o check e o
      // create. A cobrança já existe no Asaas de qualquer forma (idempotência
      // de negócio garantida pelo A-014 de reconciliação).
      const raceWinner = await withTenantContext(schoolId, (tx) =>
        tx.charge.findUniqueOrThrow({
          where: { studentId_competencyYear_competencyMonth: { studentId, competencyYear, competencyMonth } },
        }),
      );
      return raceWinner;
    }
    throw error;
  }
}
