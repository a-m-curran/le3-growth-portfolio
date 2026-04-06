-- Recreate auth trigger with error handling
-- Run this in the Supabase SQL Editor

create or replace function link_auth_to_student()
returns trigger as $$
begin
  update student
  set auth_user_id = new.id
  where email = new.email
    and auth_user_id is null;

  update coach
  set auth_user_id = new.id
  where email = new.email
    and auth_user_id is null;

  return new;
exception when others then
  raise warning 'link_auth_to_student failed for user %: %', new.id, SQLERRM;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function link_auth_to_student();
