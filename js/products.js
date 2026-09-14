import {
    bootProtectedPage,
    escapeHtml,
    hasPermission,
    icon,
    money,
    setMessage,
} from './app.js';

await bootProtectedPage('products', renderProductsPage);

async function renderProductsPage(context) {
    const root = document.getElementById('pageRoot');
    const state = {
        products: [],
        categories: [],
        editingProduct: null,
        editingCategory: null,
        productQuery: '',
        categoryFilter: '',
        statusFilter: '',
    };

    root.innerHTML = `
        <div id="pageMessage"></div>
        <section class="split-grid products-layout">
            <div class="panel">
                <div class="panel-header">
                    <div>
                        <p class="eyebrow">Shop items</p>
                        <h2>Products</h2>
                    </div>
                    ${hasPermission(context, 'add_products') ? `<button class="btn btn-primary" type="button" data-new-product>${icon('plus')} Add Product</button>` : ''}
                </div>
                <form class="filter-bar" data-product-filters>
                    <div class="field compact">
                        <label for="productSearch">Search</label>
                        <input id="productSearch" type="search" placeholder="Name or SKU">
                    </div>
                    <div class="field compact">
                        <label for="categoryFilter">Category</label>
                        <select id="categoryFilter"></select>
                    </div>
                    <div class="field compact">
                        <label for="statusFilter">Status</label>
                        <select id="statusFilter">
                            <option value="">All</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </form>
                <div id="productTable"></div>
            </div>

            <div class="side-stack">
                ${hasPermission(context, 'add_products') || hasPermission(context, 'edit_products') ? productFormMarkup(context) : ''}
                <div class="panel">
                    <div class="panel-header">
                        <div>
                            <p class="eyebrow">Item grouping</p>
                            <h2>Categories</h2>
                        </div>
                    </div>
                    ${hasPermission(context, 'add_products') || hasPermission(context, 'edit_products') ? categoryFormMarkup() : ''}
                    <div id="categoryList"></div>
                </div>
            </div>
        </section>
    `;

    await loadData(context, state);
    bindProducts(context, state);
    renderAll(context, state);
}

async function loadData(context, state) {
    const [productResponse, categoryResponse] = await Promise.all([
        context.client
            .from('products')
            .select('*, categories(name)')
            .order('product_name', { ascending: true }),
        context.client
            .from('categories')
            .select('*')
            .order('name', { ascending: true }),
    ]);

    if (productResponse.error) {
        throw productResponse.error;
    }

    if (categoryResponse.error) {
        throw categoryResponse.error;
    }

    state.products = productResponse.data || [];
    state.categories = categoryResponse.data || [];
}

function bindProducts(context, state) {
    document.querySelectorAll('[data-new-product]').forEach((button) => button.addEventListener('click', () => {
        state.editingProduct = null;
        resetProductForm(state);
    }));

    document.querySelector('[data-clear-category]')?.addEventListener('click', () => {
        state.editingCategory = null;
        resetCategoryForm(state);
    });

    document.getElementById('productSearch')?.addEventListener('input', (event) => {
        state.productQuery = event.target.value;
        renderProductTable(context, state);
    });

    document.getElementById('categoryFilter')?.addEventListener('change', (event) => {
        state.categoryFilter = event.target.value;
        renderProductTable(context, state);
    });

    document.getElementById('statusFilter')?.addEventListener('change', (event) => {
        state.statusFilter = event.target.value;
        renderProductTable(context, state);
    });

    document.getElementById('productForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveProduct(context, state, event.currentTarget);
    });

    document.getElementById('categoryForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveCategory(context, state, event.currentTarget);
    });

    document.getElementById('productTable')?.addEventListener('click', async (event) => {
        const editButton = event.target.closest('[data-edit-product]');
        const deleteButton = event.target.closest('[data-delete-product]');
        const statusButton = event.target.closest('[data-toggle-product]');

        if (editButton) {
            const product = state.products.find((item) => String(item.id) === String(editButton.dataset.editProduct));
            state.editingProduct = product || null;
            resetProductForm(state);
        }

        if (statusButton) {
            await updateProductStatus(context, state, statusButton.dataset.toggleProduct, statusButton.dataset.active === 'true');
        }

        if (deleteButton) {
            await deleteProduct(context, state, deleteButton.dataset.deleteProduct);
        }
    });

    document.getElementById('categoryList')?.addEventListener('click', async (event) => {
        const editButton = event.target.closest('[data-edit-category]');
        const deleteButton = event.target.closest('[data-delete-category]');

        if (editButton) {
            const category = state.categories.find((item) => String(item.id) === String(editButton.dataset.editCategory));
            state.editingCategory = category || null;
            resetCategoryForm(state);
        }

        if (deleteButton) {
            await deleteCategory(context, state, deleteButton.dataset.deleteCategory);
        }
    });
}

function renderAll(context, state) {
    renderCategoryOptions(state);
    renderProductTable(context, state);
    renderCategoryList(context, state);
}

function renderCategoryOptions(state) {
    const filter = document.getElementById('categoryFilter');
    const formSelect = document.getElementById('productCategory');
    const options = [
        '<option value="">All categories</option>',
        ...state.categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`),
    ].join('');

    if (filter) {
        filter.innerHTML = options;
    }

    if (formSelect) {
        formSelect.innerHTML = '<option value="">No category</option>' + state.categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('');
    }
}

function renderProductTable(context, state) {
    const table = document.getElementById('productTable');
    const canEdit = hasPermission(context, 'edit_products');
    const canDelete = hasPermission(context, 'delete_products');
    const query = state.productQuery.trim().toLowerCase();

    const products = state.products.filter((product) => {
        const statusMatch = state.statusFilter === '' ||
            (state.statusFilter === 'active' && product.is_active) ||
            (state.statusFilter === 'inactive' && !product.is_active);
        const categoryMatch = !state.categoryFilter || String(product.category_id || '') === String(state.categoryFilter);
        const textMatch = !query || [product.product_name, product.sku_barcode, product.categories?.name].join(' ').toLowerCase().includes(query);
        return statusMatch && categoryMatch && textMatch;
    });

    if (!products.length) {
        table.innerHTML = '<p class="empty-state">No products found.</p>';
        return;
    }

    table.innerHTML = `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Selling Price</th>
                        <th>SKU/Barcode</th>
                        <th>Status</th>
                        ${(canEdit || canDelete) ? '<th class="actions-col">Actions</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${products.map((product) => `
                        <tr>
                            <td><strong>${escapeHtml(product.product_name)}</strong></td>
                            <td>${escapeHtml(product.categories?.name || '-')}</td>
                            <td>${money(product.selling_price, context.settings)}</td>
                            <td>${escapeHtml(product.sku_barcode || '-')}</td>
                            <td><span class="badge ${product.is_active ? 'badge-success' : 'badge-muted'}">${product.is_active ? 'Active' : 'Inactive'}</span></td>
                            ${(canEdit || canDelete) ? `
                                <td class="row-actions">
                                    ${canEdit ? `<button class="btn btn-light btn-sm" type="button" data-edit-product="${product.id}">${icon('edit')} Edit</button>` : ''}
                                    ${canEdit ? `<button class="btn btn-light btn-sm" type="button" data-toggle-product="${product.id}" data-active="${!product.is_active}">${product.is_active ? 'Deactivate' : 'Activate'}</button>` : ''}
                                    ${canDelete ? `<button class="btn btn-danger btn-sm" type="button" data-delete-product="${product.id}">${icon('trash')} Delete</button>` : ''}
                                </td>
                            ` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderCategoryList(context, state) {
    const list = document.getElementById('categoryList');
    const canEdit = hasPermission(context, 'edit_products');
    const canDelete = hasPermission(context, 'delete_products');

    if (!list) {
        return;
    }

    if (!state.categories.length) {
        list.innerHTML = '<p class="empty-state">No categories yet.</p>';
        return;
    }

    list.innerHTML = `
        <div class="compact-list">
            ${state.categories.map((category) => `
                <div class="compact-row">
                    <span><strong>${escapeHtml(category.name)}</strong><small>${escapeHtml(category.description || 'No description')}</small></span>
                    <span class="row-actions">
                        ${canEdit ? `<button class="btn btn-light btn-sm" type="button" data-edit-category="${category.id}">Edit</button>` : ''}
                        ${canDelete ? `<button class="btn btn-danger btn-sm" type="button" data-delete-category="${category.id}">Delete</button>` : ''}
                    </span>
                </div>
            `).join('')}
        </div>
    `;
}

function productFormMarkup(context) {
    return `
        <div class="panel">
            <div class="panel-header">
                <div>
                    <p class="eyebrow">Product details</p>
                    <h2 id="productFormTitle">Add Product</h2>
                </div>
            </div>
            <form id="productForm" class="form-stack">
                <div class="field">
                    <label for="productName">Product name</label>
                    <input id="productName" name="product_name" type="text" required>
                </div>
                <div class="field">
                    <label for="productCategory">Category</label>
                    <select id="productCategory" name="category_id"></select>
                </div>
                <div class="field">
                    <label for="sellingPrice">Selling price</label>
                    <input id="sellingPrice" name="selling_price" type="number" min="0" step="0.01" required>
                </div>
                <div class="field">
                    <label for="skuBarcode">SKU/Barcode</label>
                    <input id="skuBarcode" name="sku_barcode" type="text">
                </div>
                <label class="check-row">
                    <input id="productActive" name="is_active" type="checkbox" checked>
                    <span>Active product</span>
                </label>
                <div class="form-actions">
                    <button class="btn btn-primary" type="submit">${hasPermission(context, 'edit_products') ? 'Save Product' : 'Add Product'}</button>
                    <button class="btn btn-light" type="button" data-new-product>Clear</button>
                </div>
            </form>
        </div>
    `;
}

function categoryFormMarkup() {
    return `
        <form id="categoryForm" class="form-stack compact-form">
            <div class="field">
                <label for="categoryName">Category name</label>
                <input id="categoryName" name="name" type="text" required>
            </div>
            <div class="field">
                <label for="categoryDescription">Description</label>
                <input id="categoryDescription" name="description" type="text">
            </div>
            <div class="form-actions">
                <button class="btn btn-primary" type="submit">Save Category</button>
                <button class="btn btn-light" type="button" data-clear-category>Clear</button>
            </div>
        </form>
    `;
}

function resetProductForm(state) {
    const form = document.getElementById('productForm');

    if (!form) {
        return;
    }

    const product = state.editingProduct;
    document.getElementById('productFormTitle').textContent = product ? 'Edit Product' : 'Add Product';
    form.product_name.value = product?.product_name || '';
    form.category_id.value = product?.category_id || '';
    form.selling_price.value = product?.selling_price || '';
    form.sku_barcode.value = product?.sku_barcode || '';
    form.is_active.checked = product ? Boolean(product.is_active) : true;
}

function resetCategoryForm(state) {
    const form = document.getElementById('categoryForm');

    if (!form) {
        return;
    }

    const category = state.editingCategory;
    form.name.value = category?.name || '';
    form.description.value = category?.description || '';
}

async function saveProduct(context, state, form) {
    const payload = {
        product_name: form.product_name.value.trim(),
        category_id: form.category_id.value || null,
        selling_price: Number(form.selling_price.value || 0),
        sku_barcode: form.sku_barcode.value.trim() || null,
        is_active: form.is_active.checked,
    };

    try {
        const action = state.editingProduct
            ? context.client.from('products').update(payload).eq('id', state.editingProduct.id)
            : context.client.from('products').insert(payload);
        const { error } = await action;

        if (error) {
            throw error;
        }

        setMessage('#pageMessage', 'success', state.editingProduct ? 'Product updated.' : 'Product added.');
        state.editingProduct = null;
        await loadData(context, state);
        renderAll(context, state);
        resetProductForm(state);
    } catch (error) {
        setMessage('#pageMessage', 'error', error.message);
    }
}

async function updateProductStatus(context, state, id, isActive) {
    try {
        const { error } = await context.client.from('products').update({ is_active: isActive }).eq('id', id);

        if (error) {
            throw error;
        }

        await loadData(context, state);
        renderAll(context, state);
    } catch (error) {
        setMessage('#pageMessage', 'error', error.message);
    }
}

async function deleteProduct(context, state, id) {
    if (!window.confirm('Delete this product? Old sale items will keep their saved product name and selling price.')) {
        return;
    }

    try {
        const { error } = await context.client.from('products').delete().eq('id', id);

        if (error) {
            throw error;
        }

        setMessage('#pageMessage', 'success', 'Product deleted.');
        await loadData(context, state);
        renderAll(context, state);
    } catch (error) {
        setMessage('#pageMessage', 'error', error.message);
    }
}

async function saveCategory(context, state, form) {
    const payload = {
        name: form.name.value.trim(),
        description: form.description.value.trim() || null,
    };

    try {
        const action = state.editingCategory
            ? context.client.from('categories').update(payload).eq('id', state.editingCategory.id)
            : context.client.from('categories').insert(payload);
        const { error } = await action;

        if (error) {
            throw error;
        }

        setMessage('#pageMessage', 'success', state.editingCategory ? 'Category updated.' : 'Category added.');
        state.editingCategory = null;
        await loadData(context, state);
        renderAll(context, state);
        resetCategoryForm(state);
    } catch (error) {
        setMessage('#pageMessage', 'error', error.message);
    }
}

async function deleteCategory(context, state, id) {
    if (!window.confirm('Delete this category? Products in it will remain with no category.')) {
        return;
    }

    try {
        const { error } = await context.client.from('categories').delete().eq('id', id);

        if (error) {
            throw error;
        }

        setMessage('#pageMessage', 'success', 'Category deleted.');
        await loadData(context, state);
        renderAll(context, state);
    } catch (error) {
        setMessage('#pageMessage', 'error', error.message);
    }
}
