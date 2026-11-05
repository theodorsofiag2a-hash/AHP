import "server-only";
import type { AsaasApiErrorItem, AsaasEnv } from "./types";

const BASE_URLS: Record<AsaasEnv, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

const KEY_PREFIXES: Record<AsaasEnv, string> = {
  sandbox: "$aact_hmlg_",
  production: "$aact_prod_",
};

const USER_AGENT = "AHP-G2A/1.0";
const TIMEOUT_MS = 15_000;
const MAX_GET_RETRIES = 2;

/** Configuração inválida (ambiente ausente, chave de outro ambiente...). Nunca é repetida. */
export class AsaasConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsaasConfigError";
  }
}

/** Resposta de erro da API (4xx/5xx). `errors` traz os códigos do Asaas. */
export class AsaasApiError extends Error {
  readonly status: number;
  readonly errors: AsaasApiErrorItem[];

  constructor(status: number, errors: AsaasApiErrorItem[], path: string) {
    const detail = errors.map((e) => `${e.code}: ${e.description}`).join("; ");
    super(`Asaas ${status} em ${path}${detail ? ` — ${detail}` : ""}`);
    this.name = "AsaasApiError";
    this.status = status;
    this.errors = errors;
  }
}

/** Falha de rede/timeout: o resultado da chamada é desconhecido (para POST, conferir antes de refazer). */
export class AsaasNetworkError extends Error {
  constructor(path: string, cause: unknown) {
    super(`Asaas sem resposta em ${path}`, { cause });
    this.name = "AsaasNetworkError";
  }
}

export type AsaasClientOptions = {
  env: AsaasEnv;
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** Injetável para teste (não esperar de verdade). */
  sleep?: (ms: number) => Promise<void>;
};

type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

export type AsaasClient = ReturnType<typeof createAsaasClient>;

/**
 * Valida a combinação ambiente + chave. A chave de um ambiente dá 401 no outro, e usar a chave de
 * produção com a URL do Sandbox (ou o contrário) seria um erro silencioso de configuração.
 */
export function assertAsaasConfig(env: string | undefined, apiKey: string | undefined): asserts env is AsaasEnv {
  if (env !== "sandbox" && env !== "production") {
    throw new AsaasConfigError('ASAAS_ENV precisa ser "sandbox" ou "production".');
  }
  if (!apiKey) {
    throw new AsaasConfigError(
      "ASAAS_API_KEY vazia. Em .env.local escreva a chave com \\$ no começo (o Next expande $VAR)."
    );
  }
  if (!apiKey.startsWith(KEY_PREFIXES[env])) {
    throw new AsaasConfigError(`A chave não é de ${env} (esperado prefixo ${KEY_PREFIXES[env]}…).`);
  }
}

export function createAsaasClient(options: AsaasClientOptions) {
  assertAsaasConfig(options.env, options.apiKey);
  const baseUrl = BASE_URLS[options.env];
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function request<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(baseUrl + path);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    // Só GET se repete sozinho (e só em falha de rede/5xx). POST/PUT/DELETE nunca: repetir pode duplicar
    // uma cobrança; quem chama confere por externalReference antes de refazer. 429 também não se repete
    // na hora (o Asaas pede para esperar).
    const maxAttempts = method === "GET" ? MAX_GET_RETRIES + 1 : 1;

    for (let attempt = 1; ; attempt++) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method,
          headers: {
            access_token: options.apiKey,
            "User-Agent": USER_AGENT,
            ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        });
      } catch (cause) {
        if (attempt < maxAttempts) {
          await sleep(300 * 3 ** (attempt - 1));
          continue;
        }
        throw new AsaasNetworkError(path, cause);
      }

      if (response.ok) {
        const text = await response.text();
        return (text ? JSON.parse(text) : {}) as T;
      }

      if (response.status >= 500 && attempt < maxAttempts) {
        await sleep(300 * 3 ** (attempt - 1));
        continue;
      }

      throw new AsaasApiError(response.status, await readErrors(response), path);
    }
  }

  return {
    env: options.env,
    get: <T>(path: string, query?: RequestOptions["query"]) => request<T>("GET", path, { query }),
    post: <T>(path: string, body: unknown) => request<T>("POST", path, { body }),
    put: <T>(path: string, body: unknown) => request<T>("PUT", path, { body }),
    delete: <T>(path: string) => request<T>("DELETE", path),
  };
}

async function readErrors(response: Response): Promise<AsaasApiErrorItem[]> {
  try {
    const json = (await response.json()) as { errors?: AsaasApiErrorItem[] };
    return Array.isArray(json.errors) ? json.errors : [];
  } catch {
    return [];
  }
}

/** Cliente configurado pelas variáveis de ambiente do servidor. */
export function getAsaasClient(): AsaasClient {
  return createAsaasClient({
    env: process.env.ASAAS_ENV as AsaasEnv,
    apiKey: process.env.ASAAS_API_KEY ?? "",
  });
}

/** Ambiente atual, para gravar em `environment` nas tabelas. Lança se ASAAS_ENV for inválido. */
export function getAsaasEnv(): AsaasEnv {
  const env = process.env.ASAAS_ENV;
  if (env !== "sandbox" && env !== "production") {
    throw new AsaasConfigError('ASAAS_ENV precisa ser "sandbox" ou "production".');
  }
  return env;
}
