import {
    bindPasswordToggles,
    firstAllowedPage,
    getSupabaseClient,
    hydrateIcons,
    loadAuthContext,
    renderSetupMessage,
    setMessage,
} from './app.js';

hydrateIcons();
bindPasswordToggles();

const form = document.getElementById('loginForm');
const message = document.getElementById('loginMessage');
const client = getSupabaseClient();

if (!client) {
    renderSetupMessage(message);
    form?.querySelectorAll('input, button').forEach((input) => {
        input.disabled = true;
    });
} else {
    const existing = await client.auth.getSession();
    if (existing.data.session) {
        const context = await loadAuthContext(client, existing.data.session);
        if (context) {
            window.location.href = firstAllowedPage(context);
        }
    }

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage(message, '', '');

        const submit = form.querySelector('button[type="submit"]');
        const identifier = form.identifier.value.trim();
        const password = form.password.value;
        submit.disabled = true;

        try {
            const email = await resolveIdentifier(identifier);
            const { data, error } = await client.auth.signInWithPassword({ email, password });

            if (error) {
                throw error;
            }

            const context = await loadAuthContext(client, data.session);
            if (context) {
                window.location.href = firstAllowedPage(context);
            }
        } catch (error) {
            setMessage(message, 'error', error.message || 'Login failed. Check your details and try again.');
        } finally {
            submit.disabled = false;
        }
    });
}

async function resolveIdentifier(identifier) {
    if (identifier.includes('@')) {
        return identifier;
    }

    const { data, error } = await client.rpc('resolve_login_email', {
        p_identifier: identifier,
    });

    if (error || !data) {
        throw new Error('Username was not found or is inactive.');
    }

    return data;
}
