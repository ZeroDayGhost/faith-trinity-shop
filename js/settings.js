import {
    bindPasswordToggles,
    escapeHtml,
    hasPermission,
    hydrateIcons,
    initProtectedPage,
    setMessage,
} from './app.js';

const context = await initProtectedPage('settings');

if (context) {
    renderSettings(context);
}

function renderSettings(context) {
    const root = document.getElementById('pageRoot');
    root.innerHTML = `
        <div id="pageMessage"></div>
        <section class="split-grid">
            ${hasPermission(context, 'edit_settings') ? shopSettingsMarkup(context) : ''}
            <div class="panel">
                <div class="panel-header">
                    <div>
                        <p class="eyebrow">Account security</p>
                        <h2>Change Password</h2>
                    </div>
                </div>
                <form id="passwordForm" class="form-stack">
                    <div class="field input-shell">
                        <label for="newPassword">New password</label>
                        <input id="newPassword" name="password" type="password" minlength="8" required>
                        <button class="icon-button input-action" type="button" data-password-toggle aria-label="Show password"><span data-icon="eye"></span></button>
                    </div>
                    <div class="field input-shell">
                        <label for="confirmPassword">Confirm new password</label>
                        <input id="confirmPassword" name="confirm_password" type="password" minlength="8" required>
                    </div>
                    <div class="form-actions">
                        <button class="btn btn-primary" type="submit">Change Password</button>
                    </div>
                </form>
            </div>
        </section>
    `;

    hydrateIcons(root);
    bindPasswordToggles(root);

    document.getElementById('settingsForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveSettings(context, event.currentTarget);
    });

    document.getElementById('passwordForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await changePassword(context, event.currentTarget);
    });
}

function shopSettingsMarkup(context) {
    const settings = context.settings;
    return `
        <div class="panel">
            <div class="panel-header">
                <div>
                    <p class="eyebrow">Shop details</p>
                    <h2>Settings</h2>
                </div>
            </div>
            <form id="settingsForm" class="form-stack">
                <div class="field">
                    <label for="shopName">Shop Name</label>
                    <input id="shopName" name="shop_name" type="text" required value="${escapeHtml(settings.shop_name || 'Faith Trinity Shop')}">
                </div>
                <div class="field">
                    <label for="phoneNumber">Phone Number</label>
                    <input id="phoneNumber" name="phone_number" type="text" value="${escapeHtml(settings.phone_number || '')}">
                </div>
                <div class="field">
                    <label for="location">Location</label>
                    <input id="location" name="location" type="text" value="${escapeHtml(settings.location || '')}">
                </div>
                <div class="form-grid">
                    <div class="field">
                        <label for="currency">Currency</label>
                        <input id="currency" name="currency" type="text" maxlength="10" value="${escapeHtml(settings.currency || 'KES')}">
                    </div>
                    <div class="field">
                        <label for="currencySymbol">Currency Symbol</label>
                        <input id="currencySymbol" name="currency_symbol" type="text" maxlength="10" value="${escapeHtml(settings.currency_symbol || 'KSh')}">
                    </div>
                </div>
                <div class="field">
                    <label for="receiptFooter">Receipt Footer</label>
                    <input id="receiptFooter" name="receipt_footer" type="text" value="${escapeHtml(settings.receipt_footer || 'Thank you for shopping with us.')}">
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" type="submit">Save Settings</button>
                </div>
            </form>
        </div>
    `;
}

async function saveSettings(context, form) {
    const rows = ['shop_name', 'phone_number', 'location', 'currency', 'currency_symbol', 'receipt_footer'].map((key) => ({
        setting_key: key,
        setting_value: form[key].value.trim(),
    }));

    const { error } = await context.client.from('settings').upsert(rows);

    if (error) {
        setMessage('#pageMessage', 'error', error.message);
        return;
    }

    context.settings = rows.reduce((settings, row) => {
        settings[row.setting_key] = row.setting_value;
        return settings;
    }, context.settings);

    setMessage('#pageMessage', 'success', 'Settings updated.');
}

async function changePassword(context, form) {
    const password = form.password.value;
    const confirmPassword = form.confirm_password.value;

    if (password.length < 8) {
        setMessage('#pageMessage', 'error', 'Password must be at least 8 characters.');
        return;
    }

    if (password !== confirmPassword) {
        setMessage('#pageMessage', 'error', 'Password confirmation does not match.');
        return;
    }

    const { error } = await context.client.auth.updateUser({ password });

    if (error) {
        setMessage('#pageMessage', 'error', error.message);
        return;
    }

    form.reset();
    setMessage('#pageMessage', 'success', 'Password changed.');
}
