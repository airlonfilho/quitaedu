const ASAAS_BASE_URL = process.env.ASAAS_SANDBOX_BASE_URL;
// Guardada sem o "$" em .env (ver comentário lá — Next.js expande "$VAR" em
// env files e o dotenv puro dos scripts do Prisma não desfaz um "\$" do
// mesmo jeito). A chave real do Asaas começa com "$aact_hmlg_...".
const ASAAS_ROOT_API_KEY = process.env.ASAAS_SANDBOX_API_KEY_NO_PREFIX
  ? `$${process.env.ASAAS_SANDBOX_API_KEY_NO_PREFIX}`
  : undefined;

if (!ASAAS_BASE_URL || !ASAAS_ROOT_API_KEY) {
  throw new Error("ASAAS_SANDBOX_BASE_URL / ASAAS_SANDBOX_API_KEY_NO_PREFIX não definidos — ver .env.example.");
}

/**
 * Resolve qual apiKey usar para chamar o Asaas em nome de uma escola.
 *
 * TEMPORÁRIO (ver research.md, riscos A-006/A-009): a conta raiz do sandbox
 * é Pessoa Física e o Asaas bloqueia criação de subconta pra esse tipo de
 * conta — só CNPJ pode. Enquanto a Quitaedu não tem CNPJ próprio, toda
 * escola usa a MESMA chave raiz, como uma "escola-piloto simulada" única.
 * Quando A-009 existir de verdade, troque isto por ler e descriptografar
 * `SchoolSubaccount.apiKeyEncrypted` da escola — nenhuma outra função deste
 * arquivo precisa mudar.
 */
export async function resolveAsaasApiKey(schoolId: string): Promise<string> {
  void schoolId;
  return ASAAS_ROOT_API_KEY as string;
}

export class AsaasError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
  }
}

export async function asaasRequest<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "quitaedu",
      access_token: apiKey,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AsaasError(`Asaas ${path} -> HTTP ${res.status}`, res.status, body);
  }
  return body as T;
}
