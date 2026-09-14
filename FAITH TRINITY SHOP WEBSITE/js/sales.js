import {
    escapeHtml,
    hasPermission,
    icon,
    initProtectedPage,
    money,
    setMessage,
} from './app.js';

const context = await initProtectedPage('sales');

if (context) {
    await renderPos(context);
}

async function renderPos(context) {
    const root = document.getElementById('pageRoot');
    const state = {
        products: [],
        cart: [],
        query: '',
    };

    const { data, error } = await context.client
        .from('products')
        .select('*, categories(name)')
        .eq('is_active', true)
        .order('product_name', { ascending: true });

    if (error) {
        root.innerHTML = `<section class="panel"><p class="empty-state">${escapeHtml(error.message)}</p></section>`;
        return;
    }

    state.products = data || [];
    root.innerHTML = `
        <div id="pageMessage"></div>
        <section class="pos-layout">
            <div class="panel product-picker">
                <div class="panel-header">
                    <div>
                        <p class="eyebrow">Fast search</p>
                        <h2>Select Items</h2>
                    </div>
                    ${hasPermission(context, 'add_products') ? `<a class="btn btn-light" href="products.html">${icon('plus')} Add Product</a>` : ''}
                </div>
                <div class="form-grid pos-search-grid">
                    <div class="field">
                        <label for="productSearch">Search for an item</label>
                        <input id="productSearch" type="search" placeholder="Type item name, category, or SKU" autocomplete="off">
                    </div>
                    <div class="field">
                        <label for="productQuantity">Quantity</label>
                        <input id="productQuantity" type="number" min="1" step="1" value="1">
                    </div>
                </div>
                <div class="product-results" id="productResults"></div>
            </div>

            <div class="panel cart-panel">
                <div class="panel-header">
                    <div>
                        <p class="eyebrow">Current transaction</p>
                        <h2>Cart</h2>
                    </div>
                    <button class="btn btn-ghost" type="button" id="clearCart">Clear</button>
                </div>

                <form id="saleForm" class="form-stack">
                    <div class="cart-table-wrap">
                        <table class="cart-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="cartItems"></tbody>
                        </table>
                    </div>

                    <div class="cart-total">
                        <span>Total</span>
                        <strong id="cartTotal">KSh 0.00</strong>
                    </div>

                    <div class="payment-box">
                        <label>Payment Method</label>
                        <div class="segmented">
                            <label>
                                <input type="radio" name="payment_method" value="CASH">
                                <span>CASH</span>
                            </label>
                            <label>
                                <input type="radio" name="payment_method" value="TILL">
                                <span>TILL</span>
                            </label>
                        </div>
                    </div>

                    <div class="field hidden" id="mpesaField">
                        <label for="mpesaCode">M-Pesa Transaction Code</label>
                        <input id="mpesaCode" name="mpesa_code" type="text" maxlength="40" placeholder="Optional code">
                    </div>

                    <button class="btn btn-primary btn-block btn-lg" type="submit" ${state.products.length && hasPermission(context, 'create_sale') ? '' : 'disabled'}>Complete Sale</button>
                </form>
            </div>
        </section>
    `;

    bindPos(context, state);
    renderProducts(context, state);
    renderCart(context, state);
}

function bindPos(context, state) {
    document.getElementById('productSearch')?.addEventListener('input', (event) => {
        state.query = event.target.value;
        renderProducts(context, state);
    });

    document.getElementById('productResults')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-product-id]');

        if (!button) {
            return;
        }

        const product = state.products.find((item) => String(item.id) === String(button.dataset.productId));
        const quantity = selectedQuantity();

        if (product) {
            addToCart(state, product, quantity);
            renderCart(context, state);
            document.getElementById('productSearch')?.focus();
        }
    });

    document.getElementById('cartItems')?.addEventListener('input', (event) => {
        const input = event.target.closest('[data-cart-qty]');

        if (!input) {
            return;
        }

        const item = state.cart[Number(input.dataset.cartQty)];
        item.quantity = Math.max(1, Number.parseInt(input.value || '1', 10));
        renderCart(context, state);
    });

    document.getElementById('cartItems')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove-item]');

        if (!button) {
            return;
        }

        state.cart.splice(Number(button.dataset.removeItem), 1);
        renderCart(context, state);
    });

    document.getElementById('clearCart')?.addEventListener('click', () => {
        if (!state.cart.length || window.confirm('Clear all items from this cart?')) {
            state.cart = [];
            renderCart(context, state);
        }
    });

    document.querySelectorAll('[name="payment_method"]').forEach((input) => {
        input.addEventListener('change', toggleMpesaField);
    });

    document.getElementById('saleForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await completeSale(context, state, event.currentTarget);
    });
}

function renderProducts(context, state) {
    const results = document.getElementById('productResults');
    const query = state.query.trim().toLowerCase();
    const products = state.products.filter((product) => {
        return [product.product_name, product.sku_barcode, product.categories?.name].join(' ').toLowerCase().includes(query);
    }).slice(0, 80);

    if (!state.products.length) {
        results.innerHTML = '<p class="empty-state">No active products yet. Add products before recording sales.</p>';
        return;
    }

    if (!products.length) {
        results.innerHTML = '<p class="empty-state">No active items match your search.</p>';
        return;
    }

    results.innerHTML = products.map((product) => `
        <button class="product-result" type="button" data-product-id="${product.id}">
            <span>
                <strong>${escapeHtml(product.product_name)}</strong>
                <small>${escapeHtml(product.categories?.name || 'No category')}</small>
            </span>
            <em>${money(product.selling_price, context.settings)}</em>
        </button>
    `).join('');
}

function addToCart(state, product, quantity) {
    const existing = state.cart.find((item) => String(item.product_id) === String(product.id));

    if (existing) {
        existing.quantity += quantity;
        return;
    }

    state.cart.push({
        product_id: product.id,
        product_name: product.product_name,
        selling_price: Number(product.selling_price),
        quantity,
    });
}

function renderCart(context, state) {
    const body = document.getElementById('cartItems');
    const totalNode = document.getElementById('cartTotal');
    let total = 0;

    if (!state.cart.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty-cart">Cart is empty.</td></tr>';
    } else {
        body.innerHTML = state.cart.map((item, index) => {
            const subtotal = item.selling_price * item.quantity;
            total += subtotal;
            return `
                <tr>
                    <td><strong>${escapeHtml(item.product_name)}</strong></td>
                    <td><input class="qty-input" type="number" min="1" step="1" value="${item.quantity}" data-cart-qty="${index}"></td>
                    <td>${money(item.selling_price, context.settings)}</td>
                    <td>${money(subtotal, context.settings)}</td>
                    <td><button class="btn btn-danger btn-xs" type="button" data-remove-item="${index}">Remove</button></td>
                </tr>
            `;
        }).join('');
    }

    totalNode.textContent = money(total, context.settings);
}

async function completeSale(context, state, form) {
    const paymentMethod = form.payment_method.value;
    const mpesaCode = form.mpesa_code.value.trim().toUpperCase();

    if (!hasPermission(context, 'create_sale')) {
        setMessage('#pageMessage', 'error', 'You do not have permission to create sales.');
        return;
    }

    if (!state.cart.length) {
        setMessage('#pageMessage', 'error', 'Add at least one item before completing the sale.');
        return;
    }

    if (!['CASH', 'TILL'].includes(paymentMethod)) {
        setMessage('#pageMessage', 'error', 'Choose a payment method.');
        return;
    }

    try {
        const { data, error } = await context.client.rpc('create_sale', {
            p_payment_method: paymentMethod,
            p_mpesa_code: paymentMethod === 'TILL' ? mpesaCode || null : null,
            p_items: state.cart.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
            })),
        });

        if (error) {
            throw error;
        }

        state.cart = [];
        renderCart(context, state);
        window.location.href = `receipt.html?id=${data}`;
    } catch (error) {
        setMessage('#pageMessage', 'error', error.message || 'Sale could not be completed.');
    }
}

function selectedQuantity() {
    const input = document.getElementById('productQuantity');
    const value = Math.max(1, Number.parseInt(input?.value || '1', 10));
    if (input) {
        input.value = String(value);
    }
    return value;
}

function toggleMpesaField() {
    const selected = document.querySelector('[name="payment_method"]:checked');
    const field = document.getElementById('mpesaField');
    field?.classList.toggle('hidden', selected?.value !== 'TILL');
}
