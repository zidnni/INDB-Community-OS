alter table public.memories
alter column media_url drop not null;

alter table public.memories
alter column media_type drop not null;
