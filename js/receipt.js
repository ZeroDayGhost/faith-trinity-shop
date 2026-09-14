import {
    bootProtectedPage,
    displayDate,
    displayTime,
    escapeHtml,
    hasPermission,
    money,
    shortMoney,
} from './app.js';

await bootProtectedPage('receipt', renderReceipt);

async function renderReceipt(context) {
    const root = document.getElementById('pageRoot');
    const id = new URLSearchParams(window.location.search).get('id');

    if (!id) {
        root.innerHTML = '<section class="panel"><p class="empty-state">Receipt was not found.</p></section>';
        return;
    }

    const { data: sale, error } = await context.client
        .from('sales')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error || !sale) {
        root.innerHTML = `<section class="panel"><p class="empty-state">${escapeHtml(error?.message || 'Receipt was not found.')}</p></section>`;
        return;
    }

    const { data: items, error: itemError } = await context.client
        .from('sale_items')
        .select('*')
        .eq('sale_id', id)
        .order('id', { ascending: true });

    if (itemError) {
        root.innerHTML = `<section class="panel"><p class="empty-state">${escapeHtml(itemError.message)}</p></section>`;
        return;
    }

    root.innerHTML = `
        <section class="receipt-actions no-print">
            ${hasPermission(context, 'access_pos') ? '<a class="btn btn-light" href="sales.html">New Sale</a>' : ''}
            ${hasPermission(context, 'view_sales_history') ? '<a class="btn btn-light" href="sales-history.html">Sales History</a>' : ''}
            ${hasPermission(context, 'print_receipts') ? '<button class="btn btn-primary" type="button" id="printReceipt">Print Receipt</button>' : ''}
        </section>

        <section class="receipt-page">
            <div class="receipt">
                <div class="receipt-head">
                    <h2>${escapeHtml((context.settings.shop_name || 'Faith Trinity Shop').toUpperCase())}</h2>
                    ${context.settings.location ? `<p>${escapeHtml(context.settings.location)}</p>` : ''}
                    ${context.settings.phone_number ? `<p>${escapeHtml(context.settings.phone_number)}</p>` : ''}
                </div>

                <div class="receipt-meta">
                    <p><span>Transaction No:</span> <strong>${escapeHtml(sale.transaction_number)}</strong></p>
                    <p><span>Date:</span> ${displayDate(sale.sale_date)}</p>
                    <p><span>Time:</span> ${displayTime(sale.sale_time)}</p>
                    <p><span>Sold By:</span> ${escapeHtml(sale.created_by_name || 'Unknown user')}</p>
                </div>

                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(items || []).map((item) => `
                            <tr>
                                <td>${escapeHtml(item.product_name)}</td>
                                <td>${item.quantity}</td>
                                <td>${shortMoney(item.selling_price, context.settings)}</td>
                                <td>${shortMoney(item.subtotal, context.settings)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="receipt-total">
                    <span>TOTAL</span>
                    <strong>${money(sale.total_amount, context.settings)}</strong>
                </div>

                <div class="receipt-meta">
                    <p><span>Payment Method:</span> <strong>${escapeHtml(sale.payment_method)}</strong></p>
                    ${sale.payment_method === 'TILL' && sale.mpesa_code ? `<p><span>M-Pesa Code:</span> <strong>${escapeHtml(sale.mpesa_code)}</strong></p>` : ''}
                </div>

                <p class="receipt-thanks">${escapeHtml(context.settings.receipt_footer || 'Thank you for shopping with us.')}</p>
            </div>
        </section>
    `;

    document.getElementById('printReceipt')?.addEventListener('click', () => window.print());
}
