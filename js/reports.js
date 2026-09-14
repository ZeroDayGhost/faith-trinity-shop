import {
    csvEscape,
    displayDate,
    displayTime,
    escapeHtml,
    fetchSalesWithItems,
    hasPermission,
    initProtectedPage,
    money,
    setMessage,
    summarizeSales,
    todayISO,
    topSellingItems,
} from './app.js';

const context = await initProtectedPage('reports');

if (context) {
    await renderReports(context);
}

async function renderReports(context) {
    const root = document.getElementById('pageRoot');
    const state = {
        date: todayISO(),
        sales: [],
    };

    root.innerHTML = `
        <div id="pageMessage"></div>
        <section class="panel no-print">
            <form class="report-toolbar" id="reportForm">
                <div class="field compact">
                    <label for="reportDate">Select Date</label>
                    <input id="reportDate" type="date" value="${state.date}">
                </div>
                <button class="btn btn-primary" type="submit">View Report</button>
                ${hasPermission(context, 'export_reports') ? '<button class="btn btn-light" type="button" id="exportCsv">Export CSV</button>' : ''}
                ${hasPermission(context, 'print_reports') ? '<button class="btn btn-light" type="button" id="printReport">Print Report</button>' : ''}
            </form>
        </section>
        <section id="reportContent" class="report-print-area"></section>
    `;

    document.getElementById('reportForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        state.date = document.getElementById('reportDate').value || todayISO();
        await loadAndRender(context, state);
    });

    document.getElementById('exportCsv')?.addEventListener('click', () => exportCsv(context, state));
    document.getElementById('printReport')?.addEventListener('click', () => window.print());
    await loadAndRender(context, state);
}

async function loadAndRender(context, state) {
    try {
        state.sales = await fetchSalesWithItems(context.client, { date: state.date, limit: 1000 });
        renderReport(context, state);
    } catch (error) {
        setMessage('#pageMessage', 'error', error.message);
    }
}

function renderReport(context, state) {
    const root = document.getElementById('reportContent');
    const summary = summarizeSales(state.sales);
    const topItems = topSellingItems(state.sales, 10);

    root.innerHTML = `
        <div class="report-title">
            <p>${escapeHtml((context.settings.shop_name || 'Faith Trinity Shop').toUpperCase())}</p>
            <h2>Daily Sales Report</h2>
            <span>Date: ${displayDate(state.date)}</span>
        </div>

        <section class="dashboard-grid report-metrics">
            ${metric('Total Sales', money(summary.total_sales, context.settings), 'accent-blue')}
            ${metric('Items Sold', summary.items_sold, 'accent-green')}
            ${metric('Transactions', summary.transactions, 'accent-orange')}
            ${metric('Cash Received', money(summary.cash_total, context.settings), 'accent-cyan')}
            ${metric('Till Received', money(summary.till_total, context.settings), 'accent-purple')}
        </section>

        <section class="split-grid">
            <div class="panel report-panel">
                <div class="panel-header">
                    <div>
                        <p class="eyebrow">Payment breakdown</p>
                        <h2>Cash, Till, Total</h2>
                    </div>
                </div>
                <div class="breakdown">
                    <div><span>Cash</span><strong>${money(summary.cash_total, context.settings)}</strong></div>
                    <div><span>Till</span><strong>${money(summary.till_total, context.settings)}</strong></div>
                    <div><span>Total</span><strong>${money(summary.total_sales, context.settings)}</strong></div>
                </div>
            </div>
            <div class="panel report-panel">
                <div class="panel-header">
                    <div>
                        <p class="eyebrow">Most sold</p>
                        <h2>Top Selling Items</h2>
                    </div>
                </div>
                ${topItems.length ? topItemsMarkup(topItems) : '<p class="empty-state">No items sold on this date.</p>'}
            </div>
        </section>

        <section class="panel report-panel">
            <div class="panel-header">
                <div>
                    <p class="eyebrow">Transactions</p>
                    <h2>Sales Details</h2>
                </div>
            </div>
            ${state.sales.length ? detailsTable(context, state.sales) : '<p class="empty-state">No sales were recorded on this date.</p>'}
        </section>
    `;
}

function metric(label, value, className) {
    return `<article class="metric-card ${className}"><span>${label}</span><strong>${value}</strong></article>`;
}

function topItemsMarkup(items) {
    return `
        <div class="compact-list numbered-list">
            ${items.map((item, index) => `
                <div class="compact-row">
                    <span>${index + 1}. ${escapeHtml(item.product_name)}</span>
                    <strong>${item.units_sold} units</strong>
                </div>
            `).join('')}
        </div>
    `;
}

function detailsTable(context, sales) {
    return `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Transaction Number</th>
                        <th>Sold By</th>
                        <th>Items</th>
                        <th>Quantity</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>M-Pesa Code</th>
                    </tr>
                </thead>
                <tbody>
                    ${sales.map((sale) => `
                        <tr>
                            <td>${displayTime(sale.sale_time)}</td>
                            <td>${escapeHtml(sale.transaction_number)}</td>
                            <td>${escapeHtml(sale.created_by_name || 'Unknown user')}</td>
                            <td>${escapeHtml(sale.items_summary || '-')}</td>
                            <td>${sale.items_count}</td>
                            <td>${money(sale.total_amount, context.settings)}</td>
                            <td>${escapeHtml(sale.payment_method)}</td>
                            <td>${escapeHtml(sale.mpesa_code || '-')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function exportCsv(context, state) {
    const rows = [
        ['Date', 'Time', 'Transaction Number', 'Sold By', 'Items', 'Quantity', 'Total', 'Payment Method', 'M-Pesa Transaction Code'],
        ...state.sales.map((sale) => [
            sale.sale_date,
            displayTime(sale.sale_time),
            sale.transaction_number,
            sale.created_by_name || 'Unknown user',
            sale.items_summary,
            sale.items_count,
            sale.total_amount,
            sale.payment_method,
            sale.mpesa_code || '',
        ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `faith-trinity-sales-${state.date}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}
