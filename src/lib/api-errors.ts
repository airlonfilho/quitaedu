import { NextResponse } from "next/server";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}
export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class ConflictError extends Error {}

/**
 * Formato de erro padrão da API interna (decidido aqui na implementação de
 * B-005 — ver contracts/api.md, "Erros e formato de resposta").
 */
export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: { message: "Não autenticado." } }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: { message: "Sem permissão para este recurso." } }, { status: 403 });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: { message: error.message } }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: { message: error.message } }, { status: 409 });
  }

  console.error(error);
  return NextResponse.json({ error: { message: "Erro interno." } }, { status: 500 });
}
