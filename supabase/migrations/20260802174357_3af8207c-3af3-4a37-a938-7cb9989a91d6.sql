drop policy if exists "Public read chat uploads" on storage.objects;
drop policy if exists "Anyone can upload chat images" on storage.objects;

create policy "Staff read chat uploads"
on storage.objects for select
to authenticated
using (
  bucket_id = 'chat-uploads'
  and (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'support'::app_role))
);