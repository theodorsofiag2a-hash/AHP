import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AsaasApiError, AsaasConfigError, AsaasNetworkError, createAsaasClient } from "./client";

const SANDBOX_KEY = "$aact_hmlg_teste";
const PROD_KEY = "$aact_prod_teste";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const noSleep = async () => {};

describe("configuração do cliente Asaas", () => {
  it("aceita sandbox com chave de sandbox e produção com chave de produção", () => {
    expect(() => createAsaasClient({ env: "sandbox", apiKey: SANDBOX_KEY })).not.toThrow();
    expect(() => createAsaasClient({ env: "production", apiKey: PROD_KEY })).not.toThrow();
  });

  it("recusa chave de um ambiente com a URL do outro", () => {
    expect(() => createAsaasClient({ env: "sandbox", apiKey: PROD_KEY })).toThrow(AsaasConfigError);
    expect(() => createAsaasClient({ env: "production", apiKey: SANDBOX_KEY })).toThrow(AsaasConfigError);
  });

  it("recusa chave vazia e ambiente inválido", () => {
    expect(() => createAsaasClient({ env: "sandbox", apiKey: "" })).toThrow(/vazia/);
    expect(() => createAsaasClient({ env: "staging" as never, apiKey: SANDBOX_KEY })).toThrow(AsaasConfigError);
  });
});

describe("requisições", () => {
  it("usa a URL do ambiente e envia access_token e User-Agent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "pay_1" }));
    const client = createAsaasClient({ env: "sandbox", apiKey: SANDBOX_KEY, fetchImpl, sleep: noSleep });

    await client.get("/payments/pay_1", { limit: 5 });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://api-sandbox.asaas.com/v3/payments/pay_1?limit=5");
    expect(init.headers.access_token).toBe(SANDBOX_KEY);
    expect(init.headers["User-Agent"]).toBeTruthy();
  });

  it("usa a URL de produção em production", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const client = createAsaasClient({ env: "production", apiKey: PROD_KEY, fetchImpl, sleep: noSleep });
    await client.get("/customers");
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://api.asaas.com/v3/customers");
  });

  it("converte erro da API em AsaasApiError com os códigos", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { errors: [{ code: "invalid_action", description: "Ação inválida" }] }));
    const client = createAsaasClient({ env: "sandbox", apiKey: SANDBOX_KEY, fetchImpl, sleep: noSleep });

    const error = (await client.post("/checkouts", { a: 1 }).catch((e: unknown) => e)) as AsaasApiError;
    expect(error).toBeInstanceOf(AsaasApiError);
    expect(error.status).toBe(400);
    expect(error.errors[0].code).toBe("invalid_action");
  });

  it("GET repete em 5xx e depois dá certo", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { id: "ok" }));
    const client = createAsaasClient({ env: "sandbox", apiKey: SANDBOX_KEY, fetchImpl, sleep: noSleep });

    await expect(client.get("/payments/x")).resolves.toEqual({ id: "ok" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("GET desiste depois de 3 tentativas em 5xx", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => jsonResponse(500, {}));
    const client = createAsaasClient({ env: "sandbox", apiKey: SANDBOX_KEY, fetchImpl, sleep: noSleep });

    await expect(client.get("/payments/x")).rejects.toBeInstanceOf(AsaasApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("GET repete em falha de rede e depois lança AsaasNetworkError", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const client = createAsaasClient({ env: "sandbox", apiKey: SANDBOX_KEY, fetchImpl, sleep: noSleep });

    await expect(client.get("/payments/x")).rejects.toBeInstanceOf(AsaasNetworkError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("POST nunca repete sozinho, nem em 5xx nem em falha de rede", async () => {
    const serverError = vi.fn().mockImplementation(async () => jsonResponse(500, {}));
    const a = createAsaasClient({ env: "sandbox", apiKey: SANDBOX_KEY, fetchImpl: serverError, sleep: noSleep });
    await expect(a.post("/checkouts", {})).rejects.toBeInstanceOf(AsaasApiError);
    expect(serverError).toHaveBeenCalledTimes(1);

    const network = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const b = createAsaasClient({ env: "sandbox", apiKey: SANDBOX_KEY, fetchImpl: network, sleep: noSleep });
    await expect(b.post("/checkouts", {})).rejects.toBeInstanceOf(AsaasNetworkError);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("não repete 429 na hora, nem em GET", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => jsonResponse(429, {}));
    const client = createAsaasClient({ env: "sandbox", apiKey: SANDBOX_KEY, fetchImpl, sleep: noSleep });

    const error = (await client.get("/payments/x").catch((e: unknown) => e)) as AsaasApiError;
    expect(error.status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("não repete 4xx comum", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => jsonResponse(404, {}));
    const client = createAsaasClient({ env: "sandbox", apiKey: SANDBOX_KEY, fetchImpl, sleep: noSleep });
    await expect(client.get("/payments/x")).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("não vaza a chave na mensagem de erro", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => jsonResponse(401, { errors: [{ code: "invalid_access_token", description: "Chave inválida" }] }));
    const client = createAsaasClient({ env: "sandbox", apiKey: SANDBOX_KEY, fetchImpl, sleep: noSleep });
    const error = (await client.get("/customers").catch((e: unknown) => e)) as AsaasApiError;
    expect(error.message).not.toContain(SANDBOX_KEY);
  });
});
