import { createDetachedSupabaseClient } from './supabase.js';
import {
    PERMISSION_GROUPS,
    ROLE_PRESETS,
    allPermissionKeys,
    displayDate,
    displayRole,
    escapeHtml,
    hasPermission,
    icon,
    initProtectedPage,
    normalizeRole,
    permissionLabel,
    setMessage,
} from './app.js';

const context = await initProtectedPage('users');

if (context) {
    await renderUsers(context);
}

async function renderUsers(context) {
    const root = document.getElementById('pageRoot');
    const state = {
        profiles: [],
        permissionsByUser: new Map(),
        mode: new URLSearchParams(window.location.search).get('mode') || 'list',
        selectedId: new URLSearchParams(window.location.search).get('id') || '',
    };

    root.innerHTML = '<div id="pageMessage"></div><div id="usersContent"></div>';
    await loadUsers(context, state);
    renderMode(context, state);
}

async function loadUsers(context, state) {
    const [profileResponse, permissionResponse] = await Promise.all([
        context.client.from('profiles').select('*').order('created_at', { ascending: false }),
        context.client.from('user_permissions').select('user_id, permission_key'),
    ]);

    if (profileResponse.error) {
        throw profileResponse.error;
    }

    if (permissionResponse.error) {
        throw permissionResponse.error;
    }

    state.profiles = profileResponse.data || [];
    state.permissionsByUser = new Map();

    for (const row of permissionResponse.data || []) {
        const list = state.permissionsByUser.get(row.user_id) || [];
        list.push(row.permission_key);
        state.permissionsByUser.set(row.user_id, list);
    }
}

function renderMode(context, state) {
    const content = document.getElementById('usersContent');
    const profile = state.profiles.find((item) => item.id === state.selectedId);

    if (state.mode === 'add' && hasPermission(context, 'add_users') && hasPermission(context, 'manage_permissions')) {
        content.innerHTML = userFormMarkup(context, null, ROLE_PRESETS.cashier, 'Add User', 'Create User', 'New account');
        bindUserForm(context, state, null);
        return;
    }

    if (state.mode === 'edit' && profile && hasPermission(context, 'edit_users') && hasPermission(context, 'manage_permissions')) {
        content.innerHTML = userFormMarkup(context, profile, permissionsForProfile(context, state, profile), 'Edit User', 'Update User', 'Account update');
        bindUserForm(context, state, profile);
        return;
    }

    if (state.mode === 'clone' && profile && hasPermission(context, 'clone_users') && hasPermission(context, 'manage_permissions')) {
        const cloneValues = {
            ...profile,
            id: '',
            full_name: '',
            username: '',
            email: '',
        };
        content.innerHTML = userFormMarkup(context, cloneValues, permissionsForProfile(context, state, profile), 'Clone User', 'Create Cloned User', `Copying ${escapeHtml(profile.full_name || profile.username)}`);
        bindUserForm(context, state, null);
        return;
    }

    if (state.mode === 'view' && profile) {
        content.innerHTML = viewUserMarkup(context, state, profile);
        return;
    }

    state.mode = 'list';
    content.innerHTML = listUsersMarkup(context, state);
    bindUserList(context, state);
}

function listUsersMarkup(context, state) {
    const canAdd = hasPermission(context, 'add_users') && hasPermission(context, 'manage_permissions');
    const canEdit = hasPermission(context, 'edit_users') && hasPermission(context, 'manage_permissions');
    const canClone = hasPermission(context, 'clone_users') && hasPermission(context, 'manage_permissions');
    const canDelete = hasPermission(context, 'delete_users');

    return `
        <section class="panel">
            <div class="panel-header">
                <div>
                    <p class="eyebrow">Administrator area</p>
                    <h2>Users</h2>
                </div>
                ${canAdd ? `<a class="btn btn-primary" href="users.html?mode=add">${icon('plus')} Add User</a>` : ''}
            </div>
            ${state.profiles.length ? `
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Permissions</th>
                                <th class="actions-col">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${state.profiles.map((profile) => `
                                <tr>
                                    <td><strong>${escapeHtml(profile.full_name || '-')}</strong></td>
                                    <td>${escapeHtml(profile.username || '-')}</td>
                                    <td>${escapeHtml(profile.email || '-')}</td>
                                    <td><span class="badge">${displayRole(profile.role)}</span></td>
                                    <td><span class="badge ${profile.is_active ? 'badge-success' : 'badge-muted'}">${profile.is_active ? 'Active' : 'Inactive'}</span></td>
                                    <td>${permissionsForProfile(context, state, profile).length} / ${allPermissionKeys().length}</td>
                                    <td class="row-actions">
                                        <a class="btn btn-light btn-sm" href="users.html?mode=view&id=${profile.id}">View</a>
                                        ${canEdit ? `<a class="btn btn-light btn-sm" href="users.html?mode=edit&id=${profile.id}">${icon('edit')} Edit</a>` : ''}
                                        ${canClone ? `<a class="btn btn-light btn-sm" href="users.html?mode=clone&id=${profile.id}">${icon('copy')} Clone</a>` : ''}
                                        ${canEdit && profile.id !== context.profile.id ? `<button class="btn btn-light btn-sm" type="button" data-toggle-user="${profile.id}" data-active="${!profile.is_active}">${profile.is_active ? 'Deactivate' : 'Activate'}</button>` : ''}
                                        ${canDelete && profile.id !== context.profile.id && profile.username !== 'admin' ? `<button class="btn btn-danger btn-sm" type="button" data-delete-user="${profile.id}">${icon('trash')} Delete</button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="empty-state">No users found.</p>'}
        </section>
    `;
}

function viewUserMarkup(context, state, profile) {
    const permissionSet = new Set(permissionsForProfile(context, state, profile));

    return `
        <section class="split-grid">
            <div class="panel">
                <div class="panel-header">
                    <div>
                        <p class="eyebrow">User account</p>
                        <h2>${escapeHtml(profile.full_name || profile.username)}</h2>
                    </div>
                    <div class="row-actions">
                        ${hasPermission(context, 'edit_users') && hasPermission(context, 'manage_permissions') ? `<a class="btn btn-light" href="users.html?mode=edit&id=${profile.id}">Edit</a>` : ''}
                        ${hasPermission(context, 'clone_users') && hasPermission(context, 'manage_permissions') ? `<a class="btn btn-primary" href="users.html?mode=clone&id=${profile.id}">Clone</a>` : ''}
                    </div>
                </div>
                <div class="detail-grid">
                    <div><span>Username</span><strong>${escapeHtml(profile.username || '-')}</strong></div>
                    <div><span>Email</span><strong>${escapeHtml(profile.email || '-')}</strong></div>
                    <div><span>Role</span><strong>${displayRole(profile.role)}</strong></div>
                    <div><span>Status</span><strong>${profile.is_active ? 'Active' : 'Inactive'}</strong></div>
                    <div><span>Created</span><strong>${displayDate(profile.created_at?.slice(0, 10))}</strong></div>
                    <div><span>Updated</span><strong>${displayDate(profile.updated_at?.slice(0, 10))}</strong></div>
                </div>
            </div>
            <div class="panel">
                <div class="panel-header">
                    <div>
                        <p class="eyebrow">Permissions</p>
                        <h2>Assigned Access</h2>
                    </div>
                </div>
                ${permissionGroupsMarkup(permissionSet, true)}
            </div>
        </section>
    `;
}

function userFormMarkup(context, profile, selectedPermissions, title, buttonText, eyebrow) {
    const permissionSet = new Set(selectedPermissions);
    const role = normalizeRole(profile?.role || 'cashier');
    const isEdit = Boolean(profile?.id);

    return `
        <section class="panel user-form-panel">
            <div class="panel-header">
                <div>
                    <p class="eyebrow">${eyebrow}</p>
                    <h2>${title}</h2>
                </div>
            </div>
            <form id="userForm" class="form-stack">
                <div class="form-grid">
                    <div class="field">
                        <label for="fullName">Full Name</label>
                        <input id="fullName" name="full_name" type="text" required value="${escapeHtml(profile?.full_name || '')}">
                    </div>
                    <div class="field">
                        <label for="username">Username</label>
                        <input id="username" name="username" type="text" required value="${escapeHtml(profile?.username || '')}">
                    </div>
                </div>
                <div class="field">
                    <label for="email">Email</label>
                    <input id="email" name="email" type="email" required ${isEdit ? 'readonly' : ''} value="${escapeHtml(profile?.email || '')}">
                </div>
                <div class="form-grid">
                    <div class="field">
                        <label for="password">${isEdit ? 'New Password' : 'Password'}</label>
                        <input id="password" name="password" type="password" minlength="8" ${isEdit ? '' : 'required'}>
                    </div>
                    <div class="field">
                        <label for="role">Role</label>
                        <select id="role" name="role">
                            ${['administrator', 'manager', 'cashier', 'staff'].map((item) => `<option value="${item}" ${role === item ? 'selected' : ''}>${displayRole(item)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="field">
                    <label for="isActive">Account Status</label>
                    <select id="isActive" name="is_active">
                        <option value="true" ${profile?.is_active !== false ? 'selected' : ''}>Active</option>
                        <option value="false" ${profile?.is_active === false ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
                <div class="permission-editor">
                    <div class="permission-editor-head">
                        <div>
                            <p class="eyebrow">Permissions</p>
                            <h3>Access Control</h3>
                        </div>
                        <button class="btn btn-light" type="button" id="applyRolePreset">Apply Role Preset</button>
                    </div>
                    ${permissionGroupsMarkup(permissionSet, false)}
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" type="submit">${buttonText}</button>
                    <a class="btn btn-light" href="users.html">Cancel</a>
                </div>
            </form>
        </section>
    `;
}

function permissionGroupsMarkup(permissionSet, readonly) {
    return `
        <div class="permission-grid ${readonly ? 'readonly-permissions' : ''}">
            ${Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => `
                <fieldset class="permission-group">
                    <legend>${escapeHtml(groupName)}</legend>
                    ${Object.entries(permissions).map(([permission, label]) => {
                        const checked = permissionSet.has(permission);
                        if (readonly) {
                            return `<div class="permission-check ${checked ? 'permission-on' : 'permission-off'}"><span>${escapeHtml(label)}</span><strong>${checked ? 'Allowed' : 'Blocked'}</strong></div>`;
                        }

                        return `
                            <label class="permission-check">
                                <input type="checkbox" name="permissions" value="${permission}" ${checked ? 'checked' : ''}>
                                <span>${escapeHtml(label)}</span>
                            </label>
                        `;
                    }).join('')}
                </fieldset>
            `).join('')}
        </div>
    `;
}

function bindUserList(context, state) {
    document.getElementById('usersContent')?.addEventListener('click', async (event) => {
        const toggle = event.target.closest('[data-toggle-user]');
        const remove = event.target.closest('[data-delete-user]');

        if (toggle) {
            await updateUserStatus(context, state, toggle.dataset.toggleUser, toggle.dataset.active === 'true');
        }

        if (remove) {
            await deleteUser(context, state, remove.dataset.deleteUser);
        }
    });
}

function bindUserForm(context, state, profile) {
    const form = document.getElementById('userForm');

    document.getElementById('applyRolePreset')?.addEventListener('click', () => {
        const role = normalizeRole(form.role.value);
        const preset = new Set(ROLE_PRESETS[role] || ROLE_PRESETS.staff);
        form.querySelectorAll('[name="permissions"]').forEach((checkbox) => {
            checkbox.checked = preset.has(checkbox.value);
        });
    });

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveUser(context, state, profile, form);
    });
}

async function saveUser(context, state, profile, form) {
    const selectedPermissions = [...form.querySelectorAll('[name="permissions"]:checked')].map((input) => input.value);
    const payload = {
        full_name: form.full_name.value.trim(),
        username: form.username.value.trim().toLowerCase(),
        email: form.email.value.trim().toLowerCase(),
        role: normalizeRole(form.role.value),
        is_active: form.is_active.value === 'true',
    };

    try {
        if (profile?.id) {
            await updateExistingUser(context, profile, payload, selectedPermissions, form.password.value);
            setMessage('#pageMessage', 'success', 'User updated.');
        } else {
            await createUser(context, payload, selectedPermissions, form.password.value);
            setMessage('#pageMessage', 'success', 'User created.');
        }

        await loadUsers(context, state);
        state.mode = 'list';
        state.selectedId = '';
        history.replaceState(null, '', 'users.html');
        renderMode(context, state);
    } catch (error) {
        setMessage('#pageMessage', 'error', error.message);
    }
}

async function createUser(context, payload, selectedPermissions, password) {
    const signupClient = createDetachedSupabaseClient();

    if (!signupClient) {
        throw new Error('Supabase is not configured.');
    }

    const { data, error } = await signupClient.auth.signUp({
        email: payload.email,
        password,
        options: {
            data: {
                full_name: payload.full_name,
                username: payload.username,
                role: payload.role,
            },
        },
    });

    if (error) {
        throw error;
    }

    if (!data.user?.id) {
        throw new Error('Supabase did not return the new user id. Check Auth email confirmation settings.');
    }

    await upsertProfileAndPermissions(context, data.user.id, payload, selectedPermissions);
}

async function updateExistingUser(context, profile, payload, selectedPermissions, password) {
    await upsertProfileAndPermissions(context, profile.id, payload, selectedPermissions);

    if (password.trim() !== '') {
        if (profile.id !== context.profile.id) {
            throw new Error('Password resets for other users require Supabase dashboard or an Edge Function with a service role key. No secret key is used in this frontend.');
        }

        const { error } = await context.client.auth.updateUser({ password });
        if (error) {
            throw error;
        }
    }
}

async function upsertProfileAndPermissions(context, id, payload, selectedPermissions) {
    const { error } = await context.client.from('profiles').upsert({ id, ...payload });

    if (error) {
        throw error;
    }

    const deleteResult = await context.client.from('user_permissions').delete().eq('user_id', id);
    if (deleteResult.error) {
        throw deleteResult.error;
    }

    if (selectedPermissions.length) {
        const rows = selectedPermissions.map((permission_key) => ({ user_id: id, permission_key }));
        const insertResult = await context.client.from('user_permissions').insert(rows);
        if (insertResult.error) {
            throw insertResult.error;
        }
    }
}

async function updateUserStatus(context, state, id, isActive) {
    if (id === context.profile.id && !isActive) {
        setMessage('#pageMessage', 'error', 'You cannot deactivate your own active account.');
        return;
    }

    const { error } = await context.client.from('profiles').update({ is_active: isActive }).eq('id', id);

    if (error) {
        setMessage('#pageMessage', 'error', error.message);
        return;
    }

    await loadUsers(context, state);
    renderMode(context, state);
}

async function deleteUser(context, state, id) {
    if (!window.confirm('Delete this app user? Historical sales will remain available.')) {
        return;
    }

    const profile = state.profiles.find((item) => item.id === id);

    if (profile?.username === 'admin' || id === context.profile.id) {
        setMessage('#pageMessage', 'error', 'The main administrator and your own active account cannot be deleted here.');
        return;
    }

    const { error } = await context.client.from('profiles').delete().eq('id', id);

    if (error) {
        setMessage('#pageMessage', 'error', error.message);
        return;
    }

    await loadUsers(context, state);
    renderMode(context, state);
}

function permissionsForProfile(context, state, profile) {
    if (profile.username === 'admin') {
        return allPermissionKeys();
    }

    return state.permissionsByUser.get(profile.id) || ROLE_PRESETS[normalizeRole(profile.role)] || [];
}
