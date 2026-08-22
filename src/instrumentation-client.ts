import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Constitution, Artigo V (LGPD): não capturar corpo de requisição — nossos
  // payloads carregam CPF e dados financeiros de responsáveis/alunos.
  dataCollection: {
    httpBodies: [],
  },

  // 100% em dev, 10% em produção — volume baixo no MVP não justifica mais.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
