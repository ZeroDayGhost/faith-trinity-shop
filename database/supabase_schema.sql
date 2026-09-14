-- Faith Trinity Shop - Supabase schema and Row Level Security
-- Run this file in your Supabase project SQL Editor.
-- After creating your first Auth user, run:
--   select public.bootstrap_admin('your-admin-email@example.com');

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null default '',
    username text not null unique,
    email text not null unique,
    role text not null default 'cashier'
        check (role in ('administrator', 'manager', 'cashier', 'staff')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.user_permissions (
    user_id uuid not null references public.profiles(id) on delete cascade,
    permission_key text not null,
    granted_at timestamptz not null default now(),
    primary key (user_id, permission_key)
);

create table if not exists public.categories (
    id uuid primary key default extensions.gen_random_uuid(),
    name text not null unique,
    description text not null default '',
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.products (
    id uuid primary key default extensions.gen_random_uuid(),
    product_name text not null,
    category_id uuid references public.categories(id) on delete set null,
    selling_price numeric(12, 2) not null check (selling_price >= 0),
    sku_barcode text,
    is_active boolean not null default true,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.sales (
    id uuid primary key default extensions.gen_random_uuid(),
    transaction_number text not null unique,
    sale_date date not null default (timezone('Africa/Nairobi', now()))::date,
    sale_time time not null default (timezone('Africa/Nairobi', now()))::time,
    total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
    payment_method text not null check (payment_method in ('CASH', 'TILL')),
    mpesa_code text,
    created_by uuid references public.profiles(id) on delete set null,
    created_by_name text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
    id uuid primary key default extensions.gen_random_uuid(),
    sale_id uuid not null references public.sales(id) on delete cascade,
    product_id uuid references public.products(id) on delete set null,
    product_name text not null,
    quantity integer not null check (quantity > 0),
    selling_price numeric(12, 2) not null check (selling_price >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    created_at timestamptz not null default now()
);

create table if not exists public.settings (
    setting_key text primary key,
    setting_value text not null default '',
    updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
    id bigint generated always as identity primary key,
    actor_user_id uuid references public.profiles(id) on delete set null,
    actor_name text not null default '',
    action text not null,
    target_type text not null,
    target_id uuid,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.profiles (lower(username));
create index if not exists idx_products_category on public.products (category_id);
create index if not exists idx_products_active on public.products (is_active);
create index if not exists idx_sales_date on public.sales (sale_date);
create index if not exists idx_sales_created_by on public.sales (created_by);
create index if not exists idx_sale_items_sale on public.sale_items (sale_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

create or replace function public.valid_permission_keys()
returns text[]
language sql
immutable
as $$
    select array[
        'view_dashboard',
        'access_pos',
        'create_sale',
        'view_sales',
        'edit_sale',
        'view_receipts',
        'print_receipts',
        'view_sales_history',
        'search_sales',
        'filter_sales',
        'delete_sale',
        'view_reports',
        'export_reports',
        'print_reports',
        'view_products',
        'add_products',
        'edit_products',
        'delete_products',
        'view_settings',
        'edit_settings',
        'view_users',
        'add_users',
        'clone_users',
        'edit_users',
        'delete_users',
        'manage_permissions'
    ]::text[];
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_active = true
    );
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_active = true
          and (
              lower(p.username) = 'admin'
              or p.role = 'administrator'
              or exists (
                  select 1
                  from public.user_permissions up
                  where up.user_id = p.id
                    and up.permission_key = p_permission
              )
          )
    );
$$;

create or replace function public.has_any_permission(p_permissions text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from unnest(p_permissions) permission_key
        where public.has_permission(permission_key)
    );
$$;

create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    cleaned text := lower(trim(coalesce(p_identifier, '')));
    resolved_email text;
begin
    if cleaned = '' then
        return null;
    end if;

    if position('@' in cleaned) > 1 then
        return cleaned;
    end if;

    select lower(p.email)
      into resolved_email
      from public.profiles p
     where lower(p.username) = cleaned
       and p.is_active = true
     limit 1;

    return resolved_email;
end;
$$;

create or replace function public.generate_transaction_number()
returns text
language sql
volatile
as $$
    select 'FTS-' || to_char(timezone('Africa/Nairobi', now()), 'YYYYMMDD-HH24MISS')
           || '-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 6));
$$;

create or replace function public.create_sale(
    p_payment_method text,
    p_mpesa_code text,
    p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    actor_row record;
    product_row record;
    item_row jsonb;
    new_sale_id uuid;
    item_product_id uuid;
    item_quantity integer;
    item_subtotal numeric(12, 2);
    sale_total numeric(12, 2) := 0;
    payment text := upper(trim(coalesce(p_payment_method, '')));
    till_code text := nullif(upper(trim(coalesce(p_mpesa_code, ''))), '');
    local_now timestamp := timezone('Africa/Nairobi', now());
begin
    if auth.uid() is null then
        raise exception 'You must be logged in to create a sale.';
    end if;

    if not public.has_permission('create_sale') then
        raise exception 'You do not have permission to create sales.';
    end if;

    if payment not in ('CASH', 'TILL') then
        raise exception 'Payment method must be CASH or TILL.';
    end if;

    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'A sale must contain at least one item.';
    end if;

    select p.id,
           p.email,
           p.username,
           p.full_name,
           coalesce(nullif(p.full_name, ''), p.username, p.email) as display_name
      into actor_row
      from public.profiles p
     where p.id = auth.uid()
       and p.is_active = true;

    if not found then
        raise exception 'Your user profile is not active.';
    end if;

    insert into public.sales (
        transaction_number,
        sale_date,
        sale_time,
        total_amount,
        payment_method,
        mpesa_code,
        created_by,
        created_by_name
    )
    values (
        public.generate_transaction_number(),
        local_now::date,
        local_now::time,
        0,
        payment,
        till_code,
        actor_row.id,
        actor_row.display_name
    )
    returning id into new_sale_id;

    for item_row in select * from jsonb_array_elements(p_items)
    loop
        item_product_id := (item_row->>'product_id')::uuid;
        item_quantity := coalesce((item_row->>'quantity')::integer, 0);

        if item_quantity <= 0 then
            raise exception 'Sale item quantity must be greater than zero.';
        end if;

        select p.id, p.product_name, p.selling_price
          into product_row
          from public.products p
         where p.id = item_product_id
           and p.is_active = true;

        if not found then
            raise exception 'One selected product is unavailable.';
        end if;

        item_subtotal := round(product_row.selling_price * item_quantity, 2);
        sale_total := sale_total + item_subtotal;

        insert into public.sale_items (
            sale_id,
            product_id,
            product_name,
            quantity,
            selling_price,
            subtotal
        )
        values (
            new_sale_id,
            product_row.id,
            product_row.product_name,
            item_quantity,
            product_row.selling_price,
            item_subtotal
        );
    end loop;

    update public.sales
       set total_amount = sale_total
     where id = new_sale_id;

    insert into public.audit_logs (
        actor_user_id,
        actor_name,
        action,
        target_type,
        target_id,
        details
    )
    values (
        actor_row.id,
        actor_row.display_name,
        'create_sale',
        'sale',
        new_sale_id,
        jsonb_build_object('total_amount', sale_total, 'payment_method', payment)
    );

    return new_sale_id;
end;
$$;

create or replace function public.delete_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    actor_row record;
    sale_row record;
begin
    if auth.uid() is null then
        raise exception 'You must be logged in to delete a sale.';
    end if;

    if not public.has_permission('delete_sale') then
        raise exception 'You do not have permission to delete sales.';
    end if;

    select coalesce(nullif(p.full_name, ''), p.username, p.email) as display_name,
           p.id
      into actor_row
      from public.profiles p
     where p.id = auth.uid()
       and p.is_active = true;

    select s.id, s.transaction_number, s.total_amount
      into sale_row
      from public.sales s
     where s.id = p_sale_id;

    if not found then
        raise exception 'Sale not found.';
    end if;

    delete from public.sales
     where id = p_sale_id;

    insert into public.audit_logs (
        actor_user_id,
        actor_name,
        action,
        target_type,
        target_id,
        details
    )
    values (
        actor_row.id,
        actor_row.display_name,
        'delete_sale',
        'sale',
        p_sale_id,
        jsonb_build_object(
            'transaction_number', sale_row.transaction_number,
            'total_amount', sale_row.total_amount
        )
    );
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    base_username text;
    final_username text;
begin
    base_username := lower(regexp_replace(
        coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1), 'user'),
        '[^a-zA-Z0-9_]+',
        '_',
        'g'
    ));

    base_username := trim(both '_' from base_username);

    if base_username = '' then
        base_username := 'user';
    end if;

    final_username := base_username;

    if exists (select 1 from public.profiles where username = final_username and id <> new.id) then
        final_username := left(base_username, 40) || '_' || substr(replace(new.id::text, '-', ''), 1, 8);
    end if;

    insert into public.profiles (id, full_name, username, email, role, is_active)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', ''),
        final_username,
        lower(new.email),
        'cashier',
        true
    )
    on conflict (id) do update
       set email = excluded.email,
           updated_at = now();

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.bootstrap_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    admin_id uuid;
begin
    select p.id
      into admin_id
      from public.profiles p
     where lower(p.email) = lower(trim(p_email))
     limit 1;

    if admin_id is null then
        raise exception 'No profile found for that email. Create the Supabase Auth user first.';
    end if;

    if exists (select 1 from public.profiles where lower(username) = 'admin' and id <> admin_id) then
        raise exception 'Another profile already uses username admin.';
    end if;

    update public.profiles
       set username = 'admin',
           role = 'administrator',
           is_active = true
     where id = admin_id;

    insert into public.user_permissions (user_id, permission_key)
    select admin_id, permission_key
      from unnest(public.valid_permission_keys()) permission_key
    on conflict (user_id, permission_key) do nothing;
end;
$$;

insert into public.settings (setting_key, setting_value)
values
    ('shop_name', 'Faith Trinity Shop'),
    ('phone_number', ''),
    ('location', ''),
    ('currency', 'KES'),
    ('currency_symbol', 'KSh'),
    ('receipt_footer', 'Thank you for shopping with us.')
on conflict (setting_key) do nothing;

alter table public.profiles enable row level security;
alter table public.user_permissions enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.has_permission('view_users'));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
for insert to authenticated
with check (public.has_permission('add_users'));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (public.has_any_permission(array['edit_users', 'manage_permissions']))
with check (public.has_any_permission(array['edit_users', 'manage_permissions']));

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
for delete to authenticated
using (
    public.has_permission('delete_users')
    and id <> auth.uid()
    and lower(username) <> 'admin'
);

drop policy if exists user_permissions_select on public.user_permissions;
create policy user_permissions_select on public.user_permissions
for select to authenticated
using (user_id = auth.uid() or public.has_any_permission(array['view_users', 'manage_permissions']));

drop policy if exists user_permissions_insert on public.user_permissions;
create policy user_permissions_insert on public.user_permissions
for insert to authenticated
with check (public.has_permission('manage_permissions'));

drop policy if exists user_permissions_delete on public.user_permissions;
create policy user_permissions_delete on public.user_permissions
for delete to authenticated
using (public.has_permission('manage_permissions'));

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
for select to authenticated
using (
    public.is_active_user()
    and public.has_any_permission(array[
        'view_products',
        'add_products',
        'edit_products',
        'delete_products',
        'access_pos',
        'create_sale'
    ])
);

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
for insert to authenticated
with check (public.has_permission('add_products'));

drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
for update to authenticated
using (public.has_permission('edit_products'))
with check (public.has_permission('edit_products'));

drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
for delete to authenticated
using (public.has_permission('delete_products'));

drop policy if exists products_select on public.products;
create policy products_select on public.products
for select to authenticated
using (
    public.is_active_user()
    and public.has_any_permission(array[
        'view_products',
        'add_products',
        'edit_products',
        'delete_products',
        'access_pos',
        'create_sale'
    ])
);

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
for insert to authenticated
with check (public.has_permission('add_products'));

drop policy if exists products_update on public.products;
create policy products_update on public.products
for update to authenticated
using (public.has_permission('edit_products'))
with check (public.has_permission('edit_products'));

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
for delete to authenticated
using (public.has_permission('delete_products'));

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
for select to authenticated
using (
    public.is_active_user()
    and public.has_any_permission(array[
        'view_dashboard',
        'access_pos',
        'create_sale',
        'view_sales',
        'search_sales',
        'filter_sales',
        'view_receipts',
        'print_receipts',
        'view_sales_history',
        'delete_sale',
        'view_reports',
        'export_reports',
        'print_reports'
    ])
);

drop policy if exists sale_items_select on public.sale_items;
create policy sale_items_select on public.sale_items
for select to authenticated
using (
    public.is_active_user()
    and public.has_any_permission(array[
        'view_dashboard',
        'access_pos',
        'create_sale',
        'view_sales',
        'search_sales',
        'filter_sales',
        'view_receipts',
        'print_receipts',
        'view_sales_history',
        'delete_sale',
        'view_reports',
        'export_reports',
        'print_reports'
    ])
);

drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
for select to authenticated
using (public.is_active_user());

drop policy if exists settings_insert on public.settings;
create policy settings_insert on public.settings
for insert to authenticated
with check (public.has_permission('edit_settings'));

drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings
for update to authenticated
using (public.has_permission('edit_settings'))
with check (public.has_permission('edit_settings'));

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
for select to authenticated
using (public.has_any_permission(array['view_users', 'manage_permissions']));

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.is_active_user() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.has_any_permission(text[]) to authenticated;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
grant execute on function public.generate_transaction_number() to authenticated;
grant execute on function public.create_sale(text, text, jsonb) to authenticated;
grant execute on function public.delete_sale(uuid) to authenticated;

revoke all on function public.bootstrap_admin(text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

commit;
