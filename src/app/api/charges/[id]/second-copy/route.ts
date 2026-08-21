import { NextRequest, NextResponse } from "next/server";
import { requireSchoolContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/prisma-tenant";
import { asaasRequest, resolveAsaasApiKey, AsaasError } from "@/lib/asaas";
import { apiErrorResponse, NotFoundError } from "@/lib/api-errors";

interface AsaasPayment {
  invoiceUrl: string;
  bankSlipUrl: string | null;
}

/**
 * A-015: segunda via sob demanda. Não gera cobrança nova — busca ao vivo no
 * Asaas o link atual da fatura/boleto da cobrança já existente (o link do
 * Asaas é permanente, então "segunda via" é só reexibir/reenviar o mesmo
 * link, não recriar nada).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolContext();
    const { id } = await params;

    const charge = await withTenantContext(schoolId, (tx) => tx.charge.findUnique({ where: { id } }));
    if (!charge) throw new NotFoundError("Cobrança não encontrada.");

    const apiKey = await resolveAsaasApiKey(schoolId);
    const payment = await asaasRequest<AsaasPayment>(apiKey, `/payments/${charge.asaasChargeId}`);

    let pixQrCode: string | null = charge.pixQrCode;
    try {
      const pix = await asaasRequest<{ payload: string }>(apiKey, `/payments/${charge.asaasChargeId}/pixQrCode`);
      pixQrCode = pix.payload;
    } catch {
      // Sem chave Pix cadastrada na conta, por exemplo — mantém o que já tinha local.
    }

    return NextResponse.json({
      chargeId: charge.id,
      invoiceUrl: payment.invoiceUrl,
      boletoUrl: payment.bankSlipUrl,
      pixQrCode,
    });
  } catch (error) {
    if (error instanceof AsaasError) {
      console.error("Asaas error", error.status, error.body);
      return NextResponse.json({ error: { message: "Falha ao comunicar com o Asaas." } }, { status: 502 });
    }
    return apiErrorResponse(error);
  }
}
