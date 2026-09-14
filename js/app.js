import { APP_CONFIG, getSupabaseClient, isSupabaseConfigured } from './supabase.js';

export { getSupabaseClient } from './supabase.js';

export const PERMISSION_GROUPS = {
    Dashboard: {
        view_dashboard: 'View Dashboard',
    },
    Products: {
        view_products: 'View Products',
        add_products: 'Add Products',
        edit_products: 'Edit Products',
        delete_products: 'Delete Products',
    },
    'POS / Sales': {
        access_pos: 'Access POS',
        create_sale: 'Create Sale',
        view_sales: 'View Sales',
        edit_sale: 'Edit Sale',
        delete_sale: 'Delete Sale',
    },
    'Sales History': {
        view_sales_history: 'View Sales History',
        search_sales: 'Search Sales',
        filter_sales: 'Filter Sales',
    },
    Reports: {
        view_reports: 'View Reports',
        export_reports: 'Export Reports',
        print_reports: 'Print Reports',
    },
    Receipts: {
        view_receipts: 'View Receipts',
        print_receipts: 'Print Receipts',
    },
    Users: {
        view_users: 'View Users',
        add_users: 'Add Users',
        clone_users: 'Clone Users',
        edit_users: 'Edit Users',
        delete_users: 'Delete Users',
        manage_permissions: 'Manage Permissions',
    },
    Settings: {
        view_settings: 'View Settings',
        edit_settings: 'Edit Settings',
    },
};

export const ROLE_PRESETS = {
    administrator: allPermissionKeys(),
    manager: [
        'view_dashboard',
        'view_products',
        'add_products',
        'edit_products',
        'access_pos',
        'create_sale',
        'view_sales',
        'view_sales_history',
        'search_sales',
        'filter_sales',
        'view_reports',
        'export_reports',
        'print_reports',
        'view_receipts',
        'print_receipts',
        'view_settings',
    ],
    cashier: [
        'view_dashboard',
        'access_pos',
        'create_sale',
        'view_sales',
        'view_sales_history',
        'search_sales',
        'filter_sales',
        'view_receipts',
        'print_receipts',
    ],
    staff: [
        'view_dashboard',
        'view_products',
        'view_sales_history',
        'view_receipts',
    ],
};

const PAGE_META = {
    dashboard: ['Dashboard', "Here's what's happening with your shop today.", 'view_dashboard'],
    products: ['Products', 'Manage products, categories, and selling prices.', 'view_products'],
    sales: ['Sales / POS', 'Record customer purchases quickly.', 'access_pos'],
    history: ['Sales History', 'Search permanent sale records and receipts.', 'view_sales_history'],
    reports: ['Daily Reports', 'Review sales totals for any selected date.', 'view_reports'],
    receipt: ['Receipt', 'View and print a saved transaction.', 'view_receipts'],
    users: ['Users', 'Manage staff accounts and permissions.', 'view_users'],
    settings: ['Settings', 'Update shop details and your account password.', 'view_settings'],
};

const NAV_ITEMS = [
    ['dashboard', 'Dashboard', 'dashboard.html', 'dashboard', 'view_dashboard'],
    ['sales', 'Sales / POS', 'sales.html', 'cart', 'access_pos'],
    ['products', 'Products', 'products.html', 'box', 'view_products'],
    ['history', 'Sales History', 'sales-history.html', 'history', 'view_sales_history'],
    ['reports', 'Daily Reports', 'reports.html', 'chart', 'view_reports'],
    ['users', 'Users', 'users.html', 'users', 'view_users'],
    ['settings', 'Settings', 'settings.html', 'settings', 'view_settings'],
];

const ICONS = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    dashboard: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    cart: '<path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    box: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 16 4-4 3 3 5-8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7A2 2 0 1 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 10v.01M18 14v.01"/>',
    receipt: '<path d="M5 21V3l2 1.2L9 3l2 1.2L13 3l2 1.2L17 3l2 1.2V21l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    register: '<path d="M4 10h16v10H4z"/><path d="M7 10V6h10v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h8"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M5 5H3v2a4 4 0 0 0 4 4"/><path d="M19 5h2v2a4 4 0 0 1-4 4"/>',
};

export function icon(name, className = '') {
    const cls = className ? ` class="${escapeHtml(className)}"` : '';
    return `<svg${cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.dashboard}</svg>`;
}

export function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach((node) => {
        node.innerHTML = icon(node.dataset.icon || 'dashboard');
    });
}

export function allPermissionKeys() {
    return Object.values(PERMISSION_GROUPS).flatMap((group) => Object.keys(group));
}

export function permissionLabel(permission) {
    for (const group of Object.values(PERMISSION_GROUPS)) {
        if (group[permission]) {
            return group[permission];
        }
    }

    return String(permission || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function money(value, settings = {}) {
    const symbol = settings.currency_symbol || APP_CONFIG.currencySymbol;
    return `${symbol} ${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export function shortMoney(value, settings = {}) {
    const symbol = settings.currency_symbol || APP_CONFIG.currencySymbol;
    return `${symbol} ${Number(value || 0).toLocaleString(undefined, {
        maximumFractionDigits: 0,
    })}`;
}

export function todayISO() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function currentTime() {
    return new Date().toTimeString().slice(0, 8);
}

export function displayDate(value) {
    if (!value) {
        return '-';
    }

    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function displayTime(value) {
    if (!value) {
        return '-';
    }

    return String(value).slice(0, 5);
}

export function normalizeRole(role) {
    const clean = String(role || 'staff').toLowerCase();
    return ['administrator', 'manager', 'cashier', 'staff'].includes(clean) ? clean : 'staff';
}

export function displayRole(role) {
    return normalizeRole(role).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function hasPermission(context, permission) {
    if (!context || !permission) {
        return false;
    }

    if (context.profile?.username === 'admin' || context.profile?.role === 'administrator') {
        return true;
    }

    return context.permissions.has(permission);
}

export function firstAllowedPage(context) {
    const first = NAV_ITEMS.find((item) => hasPermission(context, item[4]));
    return first ? first[2] : 'login.html';
}

export async function initProtectedPage(pageKey) {
    const pageRoot = document.getElementById('pageRoot');
    const client = getSupabaseClient();

    if (!client) {
        renderSetupMessage(pageRoot);
        renderStaticChrome(pageKey);
        return null;
    }

    let session;

    try {
        const response = await client.auth.getSession();
        session = response.data.session;
    } catch (error) {
        renderError(pageRoot, error.message);
        return null;
    }

    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

    const context = await loadAuthContext(client, session);

    if (!context) {
        return null;
    }

    renderChrome(pageKey, context);

    const requiredPermission = PAGE_META[pageKey]?.[2];
    if (requiredPermission && !hasPermission(context, requiredPermission)) {
        renderAccessDenied(pageRoot, context);
        return null;
    }

    return context;
}

export async function loadAuthContext(client, session) {
    const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

    if (profileError || !profile || profile.is_active === false) {
        await client.auth.signOut();
        window.location.href = 'login.html';
        return null;
    }

    const permissions = await fetchPermissions(client, profile);
    const settings = await fetchSettings(client);

    return { client, session, profile, permissions, settings };
}

export async function fetchPermissions(client, profile) {
    if (profile.username === 'admin') {
        return new Set(allPermissionKeys());
    }

    const { data, error } = await client
        .from('user_permissions')
        .select('permission_key')
        .eq('user_id', profile.id);

    if (error) {
        throw error;
    }

    return new Set((data || []).map((row) => row.permission_key));
}

export async function fetchSettings(client) {
    const defaults = {
        shop_name: APP_CONFIG.shopName,
        phone_number: '',
        location: '',
        currency: 'KES',
        currency_symbol: APP_CONFIG.currencySymbol,
        receipt_footer: 'Thank you for shopping with us.',
    };

    const { data, error } = await client.from('settings').select('setting_key, setting_value');

    if (error) {
        return defaults;
    }

    return (data || []).reduce((settings, row) => {
        settings[row.setting_key] = row.setting_value;
        return settings;
    }, defaults);
}

export function renderStaticChrome(pageKey) {
    const sidebar = document.getElementById('appSidebar');
    const topbar = document.getElementById('appTopbar');

    if (sidebar) {
        sidebar.innerHTML = brandMarkup(APP_CONFIG.shopName) + '<nav class="sidebar-nav"></nav>';
    }

    if (topbar) {
        const [title, subtitle] = PAGE_META[pageKey] || ['Faith Trinity Shop', ''];
        topbar.innerHTML = topbarMarkup(title, subtitle, 'Setup');
        hydrateIcons(topbar);
    }
}

export function renderChrome(pageKey, context) {
    const sidebar = document.getElementById('appSidebar');
    const topbar = document.getElementById('appTopbar');
    const settings = context.settings || {};

    if (sidebar) {
        const links = NAV_ITEMS
            .filter((item) => hasPermission(context, item[4]))
            .map(([key, label, href, iconName]) => {
                const active = key === pageKey ? ' active' : '';
                return `<a class="${active.trim()}" href="${href}">${icon(iconName, 'nav-icon')}<span>${escapeHtml(label)}</span></a>`;
            })
            .join('');

        sidebar.innerHTML = `
            ${brandMarkup(settings.shop_name || APP_CONFIG.shopName)}
            <nav class="sidebar-nav" aria-label="Main navigation">${links}</nav>
            <div class="sidebar-footer">
                <button class="logout-link" type="button" data-logout>${icon('logout', 'nav-icon')}<span>Logout</span></button>
            </div>
        `;
    }

    if (topbar) {
        const [title, subtitle] = PAGE_META[pageKey] || ['Faith Trinity Shop', ''];
        topbar.innerHTML = topbarMarkup(title, subtitle, context.profile.full_name || context.profile.username);
        hydrateIcons(topbar);
    }

    bindChrome(context);
}

function brandMarkup(shopName) {
    return `
        <div class="brand">
            <div class="brand-mark">FT</div>
            <div>
                <strong>${escapeHtml(shopName)}</strong>
                <span>Sales Management</span>
            </div>
        </div>
    `;
}

function topbarMarkup(title, subtitle, userName) {
    return `
        <button class="topbar-menu" type="button" aria-label="Open menu" data-sidebar-toggle>${icon('menu')}</button>
        <div class="topbar-title">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
        </div>
        <div class="topbar-actions">
            <button class="topbar-icon-button" type="button" aria-label="Notifications">${icon('bell')}<span></span></button>
            <div class="topbar-user">
                <span class="user-avatar">${icon('user')}</span>
                <span>${escapeHtml(userName)}</span>
                ${icon('chevron-down', 'chevron-icon')}
            </div>
        </div>
    `;
}

function bindChrome(context) {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const toggle = document.querySelector('[data-sidebar-toggle]');

    const closeSidebar = () => {
        sidebar?.classList.remove('open');
        backdrop?.classList.remove('show');
    };

    toggle?.addEventListener('click', () => {
        sidebar?.classList.toggle('open');
        backdrop?.classList.toggle('show');
    });

    backdrop?.addEventListener('click', closeSidebar);

    document.querySelector('[data-logout]')?.addEventListener('click', async () => {
        await context.client.auth.signOut();
        window.location.href = 'login.html';
    });
}

export function renderSetupMessage(root) {
    root.innerHTML = `
        <section class="panel narrow-panel">
            <p class="eyebrow">Supabase setup required</p>
            <h2>Connect Faith Trinity Shop to Supabase</h2>
            <p class="muted">Open <strong>js/supabase.js</strong>, add your Supabase project URL and public anon key, then run <strong>database/supabase_schema.sql</strong> in the Supabase SQL editor.</p>
            <p class="muted">Only the public anon key belongs in this frontend app. Do not place service role keys or database passwords in GitHub Pages.</p>
        </section>
    `;
}

export function renderError(root, message) {
    root.innerHTML = `
        <section class="panel narrow-panel">
            <p class="eyebrow">Something went wrong</p>
            <h2>Could not load this page</h2>
            <p class="muted">${escapeHtml(message)}</p>
        </section>
    `;
}

export function renderAccessDenied(root, context) {
    const destination = firstAllowedPage(context);
    root.innerHTML = `
        <section class="panel narrow-panel">
            <p class="eyebrow">Access denied</p>
            <h2>Permission Required</h2>
            <p class="muted">Your account does not have permission to open this area.</p>
            <a class="btn btn-primary" href="${destination}">Go to allowed page</a>
        </section>
    `;
}

export function setMessage(target, type, message) {
    const node = typeof target === 'string' ? document.querySelector(target) : target;

    if (!node) {
        return;
    }

    node.innerHTML = message ? `<div class="alert alert-${type}">${escapeHtml(message)}</div>` : '';
}

export function bindPasswordToggles(root = document) {
    root.querySelectorAll('[data-password-toggle]').forEach((button) => {
        const shell = button.closest('.input-shell, .field');
        const input = shell?.querySelector('input[type="password"], input[type="text"]');

        if (!input) {
            return;
        }

        button.addEventListener('click', () => {
            const showing = input.type === 'password';
            input.type = showing ? 'text' : 'password';
            button.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
        });
    });
}

export function bindConfirmForms(root = document) {
    root.querySelectorAll('[data-confirm]').forEach((form) => {
        form.addEventListener('submit', (event) => {
            const message = form.dataset.confirm || 'Are you sure?';
            if (!window.confirm(message)) {
                event.preventDefault();
            }
        });
    });
}

export async function fetchSalesWithItems(client, options = {}) {
    let query = client
        .from('sales')
        .select('*')
        .order('sale_date', { ascending: false })
        .order('sale_time', { ascending: false })
        .order('id', { ascending: false })
        .limit(options.limit || 500);

    if (options.date) {
        query = query.eq('sale_date', options.date);
    }

    if (options.paymentMethod) {
        query = query.eq('payment_method', options.paymentMethod);
    }

    const { data: sales, error } = await query;

    if (error) {
        throw error;
    }

    if (!sales?.length) {
        return [];
    }

    const ids = sales.map((sale) => sale.id);
    const { data: items, error: itemError } = await client
        .from('sale_items')
        .select('*')
        .in('sale_id', ids)
        .order('id', { ascending: true });

    if (itemError) {
        throw itemError;
    }

    const grouped = new Map();

    for (const item of items || []) {
        if (!grouped.has(item.sale_id)) {
            grouped.set(item.sale_id, []);
        }
        grouped.get(item.sale_id).push(item);
    }

    return sales.map((sale) => {
        const saleItems = grouped.get(sale.id) || [];
        return {
            ...sale,
            items: saleItems,
            items_count: saleItems.reduce((total, item) => total + Number(item.quantity || 0), 0),
            items_summary: saleItems.map((item) => `${item.product_name} x${item.quantity}`).join(', '),
        };
    });
}

export function summarizeSales(sales) {
    return sales.reduce((summary, sale) => {
        const amount = Number(sale.total_amount || 0);
        summary.total_sales += amount;
        summary.transactions += 1;

        if (sale.payment_method === 'CASH') {
            summary.cash_total += amount;
        }

        if (sale.payment_method === 'TILL') {
            summary.till_total += amount;
        }

        summary.items_sold += Number(sale.items_count || 0);
        return summary;
    }, {
        total_sales: 0,
        items_sold: 0,
        transactions: 0,
        cash_total: 0,
        till_total: 0,
    });
}

export function topSellingItems(sales, limit = 10) {
    const totals = new Map();

    for (const sale of sales) {
        for (const item of sale.items || []) {
            const current = totals.get(item.product_name) || { product_name: item.product_name, units_sold: 0, total_sales: 0 };
            current.units_sold += Number(item.quantity || 0);
            current.total_sales += Number(item.subtotal || 0);
            totals.set(item.product_name, current);
        }
    }

    return [...totals.values()]
        .sort((a, b) => b.units_sold - a.units_sold || b.total_sales - a.total_sales)
        .slice(0, limit);
}

export function filterSales(sales, term) {
    const clean = String(term || '').trim().toLowerCase();

    if (!clean) {
        return sales;
    }

    return sales.filter((sale) => {
        const haystack = [
            sale.transaction_number,
            sale.created_by_name,
            sale.payment_method,
            sale.mpesa_code,
            sale.items_summary,
        ].join(' ').toLowerCase();

        return haystack.includes(clean);
    });
}

export function csvEscape(value) {
    const text = String(value ?? '');
    return `"${text.replaceAll('"', '""')}"`;
}

export function requireConfiguredOnPublicPage() {
    if (!isSupabaseConfigured()) {
        return false;
    }

    getSupabaseClient();
    return true;
}
