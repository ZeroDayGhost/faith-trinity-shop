import {
    bootProtectedPage,
    displayDate,
    displayTime,
    escapeHtml,
    fetchSalesWithItems,
    hasPermission,
    icon,
    money,
    summarizeSales,
    todayISO,
    topSellingItems,
} from './app.js';

await bootProtectedPage('dashboard', renderDashboard);

async function renderDashboard(context) {
    const root = document.getElementById('pageRoot');
    const today = todayISO();
    const yesterday = shiftDate(today, -1);
    const todaySales = await fetchSalesWithItems(context.client, { date: today, limit: 500 });
    const yesterdaySales = await fetchSalesWithItems(context.client, { date: yesterday, limit: 500 });
    const summary = summarizeSales(todaySales);
    const previous = summarizeSales(yesterdaySales);
    const week = [];

    for (let index = 6; index >= 0; index -= 1) {
        const date = shiftDate(today, -index);
        const sales = await fetchSalesWithItems(context.client, { date, limit: 500 });
        week.push({ date, label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' }), amount: summarizeSales(sales).total_sales });
    }

    const topItems = topSellingItems(todaySales, 5);
    const recentSales = (await fetchSalesWithItems(context.client, { limit: 6 })).slice(0, 6);
    const cards = [
        ['Today\'s Sales', money(summary.total_sales, context.settings), summary.total_sales, previous.total_sales, 'cart', 'metric-blue'],
        ['Items Sold Today', summary.items_sold, summary.items_sold, previous.items_sold, 'box', 'metric-green'],
        ['Transactions Today', summary.transactions, summary.transactions, previous.transactions, 'receipt', 'metric-orange'],
        ['Cash Received Today', money(summary.cash_total, context.settings), summary.cash_total, previous.cash_total, 'cash', 'metric-purple'],
        ['Till Received Today', money(summary.till_total, context.settings), summary.till_total, previous.till_total, 'register', 'metric-pink'],
    ];

    root.innerHTML = `
        <section class="dashboard-grid">
            ${cards.map(([label, value, current, oldValue, cardIcon, className]) => metricCard(label, value, current, oldValue, cardIcon, className)).join('')}
        </section>

        <section class="split-grid">
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <span class="panel-icon panel-icon-blue">${icon('chart')}</span>
                        <div>
                            <h2>Sales Chart</h2>
                            <p>Showing sales for the last 7 days</p>
                        </div>
                    </div>
                    <div class="panel-filter-pill">${icon('calendar')}<span>Last 7 days</span></div>
                </div>
                <div class="chart-card">
                    <canvas id="salesChart" height="260"></canvas>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <span class="panel-icon panel-icon-purple">${icon('trophy')}</span>
                        <div>
                            <h2>Top Selling Items</h2>
                            <p>Best performing products today</p>
                        </div>
                    </div>
                    ${hasPermission(context, 'view_reports') ? '<a class="btn btn-light" href="reports.html">View all</a>' : ''}
                </div>
                ${topItems.length ? topList(topItems, context) : emptyState('No items sold today yet.')}
            </div>
        </section>

        <section class="split-grid">
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <span class="panel-icon panel-icon-blue-soft">${icon('cart')}</span>
                        <div>
                            <h2>Fast Actions</h2>
                            <p>Quick access to common tasks</p>
                        </div>
                    </div>
                </div>
                <div class="action-grid">
                    ${hasPermission(context, 'access_pos') ? actionCard('Record Sale', 'Open POS and complete payment', 'sales.html', 'cart', 'action-card-blue') : ''}
                    ${hasPermission(context, 'add_products') ? actionCard('Add Product', 'Create a product with selling price', 'products.html', 'plus', 'action-card-green') : ''}
                    ${hasPermission(context, 'view_reports') ? actionCard('Daily Report', 'Review payment breakdown', 'reports.html', 'chart', 'action-card-purple') : ''}
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <span class="panel-icon panel-icon-blue-soft">${icon('history')}</span>
                        <div>
                            <h2>Latest Records</h2>
                            <p>Recent sales activity</p>
                        </div>
                    </div>
                    ${hasPermission(context, 'view_sales_history') ? '<a class="btn btn-light" href="sales-history.html">View all</a>' : ''}
                </div>
                ${recentSales.length ? latestTable(recentSales, context) : emptyState('No sales have been recorded yet.')}
            </div>
        </section>
    `;

    drawChart(week);
}

function metricCard(label, value, current, previous, cardIcon, className) {
    const trend = trendLabel(current, previous);
    return `
        <article class="metric-card ${className}">
            <div class="metric-content">
                <div class="metric-left">
                    <span class="metric-icon">${icon(cardIcon)}</span>
                    <div>
                        <span class="metric-label">${label}</span>
                        <strong>${value}</strong>
                    </div>
                </div>
                <div class="metric-trend ${trend.direction === 'down' ? 'metric-trend-down' : 'metric-trend-up'}">
                    <span>${trend.label}</span>
                    <small>vs yesterday</small>
                </div>
            </div>
        </article>
    `;
}

function trendLabel(current, previous) {
    const currentValue = Number(current || 0);
    const previousValue = Number(previous || 0);
    const percent = previousValue <= 0 ? (currentValue > 0 ? 100 : 0) : ((currentValue - previousValue) / previousValue) * 100;

    return {
        direction: percent < 0 ? 'down' : 'up',
        label: `${percent < 0 ? '-' : '+'} ${Math.abs(percent).toFixed(0)}%`,
    };
}

function topList(items, context) {
    return `
        <div class="compact-list">
            ${items.map((item, index) => `
                <div class="compact-row">
                    <span>${index + 1}. ${escapeHtml(item.product_name)}</span>
                    <strong>${item.units_sold} units</strong>
                    <small>${money(item.total_sales, context.settings)}</small>
                </div>
            `).join('')}
        </div>
    `;
}

function latestTable(sales, context) {
    return `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Transaction</th>
                        <th>Sold By</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Items</th>
                    </tr>
                </thead>
                <tbody>
                    ${sales.map((sale) => `
                        <tr>
                            <td>${hasPermission(context, 'view_receipts') ? `<a href="receipt.html?id=${sale.id}">${sale.transaction_number}</a>` : sale.transaction_number}</td>
                            <td>${escapeHtml(sale.created_by_name || 'Unknown user')}</td>
                            <td>${displayDate(sale.sale_date)} ${displayTime(sale.sale_time)}</td>
                            <td>${money(sale.total_amount, context.settings)}</td>
                            <td><span class="badge">${sale.payment_method}</span></td>
                            <td>${sale.items_count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function actionCard(title, subtitle, href, actionIcon, className) {
    return `
        <a class="action-card ${className}" href="${href}">
            <span class="action-icon">${icon(actionIcon)}</span>
            <span class="action-copy"><strong>${title}</strong><small>${subtitle}</small></span>
            ${icon('chevron-right', 'action-arrow')}
        </a>
    `;
}

function emptyState(message) {
    return `<div class="empty-state"><p>${message}</p></div>`;
}

function drawChart(rows) {
    const canvas = document.getElementById('salesChart');

    if (!canvas) {
        return;
    }

    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const height = Number(canvas.getAttribute('height') || 260);
    const width = Math.max(rect.width, 320);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.scale(dpr, dpr);
    context.clearRect(0, 0, width, height);

    const padding = { left: 48, right: 18, top: 18, bottom: 36 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const max = Math.max(1, ...rows.map((row) => Number(row.amount || 0)));
    const step = chartWidth / Math.max(rows.length - 1, 1);

    context.strokeStyle = '#dfe8f6';
    context.fillStyle = '#6680aa';
    context.font = '12px Arial, sans-serif';
    context.textAlign = 'right';
    context.textBaseline = 'middle';

    for (let index = 0; index <= 4; index += 1) {
        const y = padding.top + (chartHeight / 4) * index;
        const value = max - (max / 4) * index;
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(width - padding.right, y);
        context.stroke();
        context.fillText(value >= 10 ? Math.round(value).toLocaleString() : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''), padding.left - 12, y);
    }

    const points = rows.map((row, index) => ({
        x: padding.left + index * step,
        y: padding.top + chartHeight - (Number(row.amount || 0) / max) * chartHeight,
        label: row.label,
    }));

    context.beginPath();
    points.forEach((point, index) => {
        if (index === 0) {
            context.moveTo(point.x, point.y);
        } else {
            context.lineTo(point.x, point.y);
        }
    });
    context.lineWidth = 4;
    context.strokeStyle = '#1677ff';
    context.stroke();

    context.lineTo(points[points.length - 1].x, padding.top + chartHeight);
    context.lineTo(points[0].x, padding.top + chartHeight);
    context.closePath();
    const gradient = context.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, 'rgba(22, 119, 255, 0.22)');
    gradient.addColorStop(1, 'rgba(22, 119, 255, 0)');
    context.fillStyle = gradient;
    context.fill();

    context.fillStyle = '#6079a6';
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    rows.forEach((row, index) => {
        context.fillText(row.label, padding.left + index * step, height - 10);
    });
}

function shiftDate(date, days) {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + days);
    return next.toISOString().slice(0, 10);
}
