alter table deals
add column if not exists workflow jsonb default null;
