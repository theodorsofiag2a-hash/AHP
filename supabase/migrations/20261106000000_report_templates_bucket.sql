-- Bucket PRIVADO com o modelo Word do relatório de priorização (proprietário da G2A; o repositório é público).
-- Sem políticas em storage.objects: só a service role (servidor) lê. Ver docs/RELATORIO.md.
insert into storage.buckets (id, name, public, file_size_limit)
values ('report-templates', 'report-templates', false, 5242880)
on conflict (id) do nothing;
