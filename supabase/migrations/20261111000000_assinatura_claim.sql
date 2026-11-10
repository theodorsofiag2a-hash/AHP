-- Evita assinaturas duplicadas: as parcelas de um pedido chegam quase juntas e cada uma processava a criação.
-- O processo que "reivindica" o pedido (coluna abaixo) é o único que cria a assinatura no Asaas.
alter table plan_orders add column if not exists subscription_claimed_at timestamptz;
