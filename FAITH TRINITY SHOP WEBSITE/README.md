# Faith Trinity Shop Sales Management

Modern static shop sales app for Faith Trinity Shop, powered by Supabase Auth, Supabase Database, and Row Level Security.

This version does not use PHP, MySQL, XAMPP, Apache, or Node.js to run the website.

## What It Does

- Login with Supabase Auth.
- Manage users, role presets, and detailed permissions.
- Manage categories and products with product name, category, selling price, SKU/barcode, status, and created date.
- Record CASH and TILL sales.
- Save optional M-Pesa transaction codes for TILL sales.
- Show the user who made each sale in receipts, sales history, dashboard records, and reports.
- Print receipts.
- View permanent sales history with search and filters.
- View dashboard totals for the current day.
- View, print, and export daily reports.

The app intentionally does not track buying price, profit, stock quantity, stock value, stock movement, or inventory reduction.

## Supabase Setup

1. Open your Supabase project.
2. Go to SQL Editor.
3. Run [database/supabase_schema.sql](database/supabase_schema.sql).
4. Go to Authentication and create your first administrator user with an email and password.
5. Go back to SQL Editor and run this, replacing the email:

```sql
select public.bootstrap_admin('your-admin-email@example.com');
```

The SQL file creates all tables, triggers, protected sale RPCs, default settings, and Row Level Security policies.

If Supabase email confirmation is enabled, confirm the first admin email before trying to log in.

## Frontend Supabase Key

The frontend config is in [js/supabase.js](js/supabase.js).

It is configured with your Supabase Project URL and publishable key. Only a publishable anon key belongs in this file. Never add a service-role key, database password, JWT secret, or any private key to this static website.

## Running Locally

Open [login.html](login.html) in a browser, or serve the folder with any simple static server.

Do not copy this project to `C:\xampp\htdocs`. This version is no longer an XAMPP/PHP project.

The local preview URL, such as `http://127.0.0.1:4173/login.html`, is only for testing on your computer. The GitHub Pages URL will be different, but it will serve these same files.

## Deploying To GitHub Pages

1. Push this folder to a GitHub repository.
2. Open the repository settings.
3. Enable Pages from the main branch.
4. Open the published Pages URL.

Because all app pages are static HTML files, GitHub Pages can host them directly.

After GitHub Pages gives you the public URL, add it in Supabase under Authentication -> URL Configuration:

- Site URL: your GitHub Pages URL
- Redirect URL: your GitHub Pages URL, plus `login.html`

## Security Model

- Supabase Auth handles passwords and sessions.
- Row Level Security is enabled on every app table.
- The frontend uses only the publishable key.
- Sales are created through `public.create_sale`, which captures product names, selling prices, totals, payment method, optional M-Pesa code, and the signed-in seller.
- Sale deletion is done through `public.delete_sale` and requires the `delete_sale` permission.
- Deleted users do not erase old seller names because each sale stores `created_by_name`.

## Project Structure

```text
faith-trinity-shop/
|-- index.html
|-- login.html
|-- dashboard.html
|-- products.html
|-- sales.html
|-- sales-history.html
|-- reports.html
|-- receipt.html
|-- users.html
|-- settings.html
|-- css/
|   `-- style.css
|-- js/
|   |-- app.js
|   |-- auth.js
|   |-- dashboard.js
|   |-- history.js
|   |-- index.js
|   |-- products.js
|   |-- receipt.js
|   |-- reports.js
|   |-- sales.js
|   |-- settings.js
|   |-- supabase.js
|   `-- users.js
`-- database/
    `-- supabase_schema.sql
```

## Test Checklist

- Login.
- Add product.
- Edit product.
- Make CASH sale.
- Make TILL sale.
- Save M-Pesa transaction code.
- Open receipt.
- Confirm receipt shows Sold By.
- Check sales history.
- Confirm sales history shows Sold By.
- Check daily dashboard.
- Check daily reports.
- Export daily report CSV.
- Test on phone size.
