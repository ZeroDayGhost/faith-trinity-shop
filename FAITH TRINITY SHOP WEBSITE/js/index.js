import { firstAllowedPage, getSupabaseClient, loadAuthContext, renderSetupMessage } from './app.js';

const client = getSupabaseClient();

if (!client) {
    renderSetupMessage(document.body.querySelector('main'));
} else {
    const { data } = await client.auth.getSession();

    if (!data.session) {
        window.location.href = 'login.html';
    } else {
        const context = await loadAuthContext(client, data.session);
        if (context) {
            window.location.href = firstAllowedPage(context);
        }
    }
}
