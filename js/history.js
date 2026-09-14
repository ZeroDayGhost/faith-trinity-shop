import {
    displayDate,
    displayTime,
    escapeHtml,
    fetchSalesWithItems,
    filterSales,
    hasPermission,
    icon,
    initProtectedPage,
    money,
    setMessage,
} from './app.js';

const context = await initProtectedPage('history');

if (context) {
    await renderHistory(context);
}

async function renderHistory(context) {
    const root = document.getElementById('pageRoot');
    const state = {
        sales: [],
        date: '',
        paymentMethod: '',
        query: '',
    };

    root.innerHTML = `
        <div id="pageMessage"></div>
        <section class="panel">
            <div class="panel-header">
                <div>
                    <p class="eyebrow">Permanent records</p>
                    <h2>Sales History</h2>
                </div>
                ${hasPermission(context, 'access_pos') ? `<a class="btn btn-primary" href="sales.html">${icon('cart')} New Sale</a>` : ''}
            </div>

            ${(hasPermission(context, 'search_sales') || hasPermission(context, 'filter_sales')) ? `
                <form class="filter-bar" id="historyFilters">
                    ${hasPermission(context, 'search_sales') ? `
                        <div class="field compact">
                            <label for="historySearch">Search</label>
                            <input id="historySearch" type="search" placeholder="Transaction, user, M-Pesa, or product">
                        </div>
                    ` : ''}
                    ${hasPermission(context, 'filter_sales') ? `
                        <div class="field compact">
                            <label for="historyDate">Date</label>
                            <input id="historyDate" type="date">
                        </div>
                        <div class="field compact">
                            <label for="historyPayment">Payment</label>
                            <select id="historyPayment">
                                <option value="">All</option>
                                <option value="CASH">Cash</option>
                                <option value="TILL">Till</option>
                            </select>
                        </div>
                    ` : ''}
                    <button class="btn btn-light" type="submit">Filter</button>
                    <button class="btn btn-ghost" type="button" id="clearFilters">Clear</button>
                </form>
            ` : ''}

            <div id="historyTable"></div>
        </section>
    `;

    bindHistory(context, state);
    await loadAndRender(context, state);
}

function bindHistory(context, state) {
    document.getElementById('historyFilters')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        state.query = document.getElementById('historySearch')?.value || '';
        state.date = document.getElementById('historyDate')?.value || '';
        state.paymentMethod = document.getElementById('historyPayment')?.value || '';
        await loadAndRender(context, state);
    });

    document.getElementById('clearFilters')?.addEventListener('click', async () => {
        state.query = '';
        state.date = '';
        state.paymentMethod = '';
        document.getElementById('historySearch') && (document.getElementById('historySearch').value = '');
        document.getElementById('historyDate') && (document.getElementById('historyDate').value = '');
        document.getElementById('historyPayment') && (document.getElementById('historyPayment').value = '');
        await loadAndRender(context, state);
    });

    document.getElementById('historyTable')?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-delete-sale]');

        if (!button) {
            return;
        }

        await deleteSale(context, state, button.dataset.deleteSale);
    });
}

async function loadAndRender(context, state) {
    try {
        state.sales = await fetchSalesWithItems(context.client, {
            date: hasPermission(context, 'filter_sales') ? state.date : '',
            paymentMethod: hasPermission(context, 'filter_sales') ? state.paymentMethod : '',
            limit: 800,
        });
        renderHistoryTable(context, state);
    } catch (error) {
        setMessage('#pageMessage', 'error', error.message);
    }
}

function renderHistoryTable(context, state) {
    const table = document.getElementById('historyTable');
    const sales = hasPermission(context, 'search_sales') ? filterSales(state.sales, state.query) : state.sales;
    const canReceipt = hasPermission(context, 'view_receipts');
    const canDelete = hasPermission(context, 'delete_sale');

    if (!sales.length) {
        table.innerHTML = '<p class="empty-state">No sales found for the selected filters.</p>';
        return;
    }

    table.innerHTML = `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Transaction Number</th>
                        <th>Date/Time</th>
                        <th>Sold By</th>
                        <th>Items</th>
                        <th>Quantity</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>M-Pesa Code</th>
                        ${(canReceipt || canDelete) ? '<th class="actions-col">Actions</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${sales.map((sale) => `
                        <tr>
                            <td><strong>${escapeHtml(sale.transaction_number)}</strong></td>
                            <td>${displayDate(sale.sale_date)} ${displayTime(sale.sale_time)}</td>
                            <td>${escapeHtml(sale.created_by_name || 'Unknown user')}</td>
                            <td>${itemSummary(sale, context)}</td>
                            <td>${sale.items_count}</td>
                            <td>${money(sale.total_amount, context.settings)}</td>
                            <td><span class="badge">${sale.payment_method}</span></td>
                            <td>${escapeHtml(sale.mpesa_code || '-')}</td>
                            ${(canReceipt || canDelete) ? `
                                <td class="row-actions">
                                    ${canReceipt ? `<a class="btn btn-light btn-sm" href="receipt.html?id=${sale.id}">${icon('receipt')} Receipt</a>` : ''}
                                    ${canDelete ? `<button class="btn btn-danger btn-sm" type="button" data-delete-sale="${sale.id}">${icon('trash')} Delete</button>` : ''}
                                </td>
                            ` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function itemSummary(sale, context) {
    if (!sale.items?.length) {
        return '-';
    }

    return sale.items.map((item) => {
        return `${escapeHtml(item.product_name)} x${item.quantity} @ ${money(item.selling_price, context.settings)}`;
    }).join('<br>');
}

async function deleteSale(context, state, saleId) {
    if (!window.confirm('Are you sure you want to delete this sale? This action cannot be undone.')) {
        return;
    }

    try {
        const { error } = await context.client.rpc('delete_sale', { p_sale_id: saleId });

        if (error) {
            throw error;
        }

        setMessage('#pageMessage', 'success', 'Sale deleted.');
        await loadAndRender(context, state);
    } catch (error) {
        setMessage('#pageMessage', 'error', error.message);
    }
}
