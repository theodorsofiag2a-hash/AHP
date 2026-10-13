-- Permite apagar um modelo (e suas execuções) sem ficar bloqueado por transações de
-- crédito antigas que referenciam essas execuções: o registro financeiro é preservado,
-- só perde o vínculo com a execução que deixou de existir.
alter table credit_transactions drop constraint if exists credit_transactions_related_run_id_fkey;
alter table credit_transactions
  add constraint credit_transactions_related_run_id_fkey
  foreign key (related_run_id) references ahp_runs(id) on delete set null;
