-- Game renamed from Umagrid to Uma-connect: reserve the new brand terms for display names.
insert into public.reserved_names (term) values
  ('uma-connect'), ('umaconnect'), ('uma connect')
on conflict do nothing;
