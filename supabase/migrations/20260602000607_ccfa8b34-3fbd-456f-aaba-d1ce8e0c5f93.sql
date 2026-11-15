insert into storage.buckets (id, name, public) values ('chat-uploads', 'chat-uploads', true) on conflict (id) do nothing;

create policy "Public read chat uploads"
on storage.objects for select
using (bucket_id = 'chat-uploads');

create policy "Anyone can upload chat images"
on storage.objects for insert
with check (bucket_id = 'chat-uploads');