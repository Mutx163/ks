/**
 * 管理后台 - 用户管理（二级页面版）
 */
import API from './api.js';
import Utils from './utils.js';

export function initUsers(Admin) {
    // ==================== 分页/批量状态 ====================
    Admin.userPage = 1;
    Admin.userPageSize = 20;
    Admin.selectedUsers = new Set();

    // ==================== 用户列表页 ====================
    Admin.renderUsers = function () {
        const el = document.getElementById('sec-users');
        const q = (document.getElementById('search-input')?.value || '').toUpperCase();
        const status =
            document.getElementById('user-status-filter')?.value || this.userStatusFilter || 'all';
        this.userStatusFilter = status;

        let list = this.users.filter(
            (u) => !q || u.id.includes(q) || u.initials.toUpperCase().includes(q)
        );
        if (status === 'normal') list = list.filter((u) => !u.banned && !u.is_admin);
        else if (status === 'banned') list = list.filter((u) => u.banned);
        else if (status === 'admin') list = list.filter((u) => u.is_admin);

        if (this.sort === 'answered') list.sort((a, b) => b.total_answered - a.total_answered);
        else if (this.sort === 'duration') list.sort((a, b) => b.total_duration - a.total_duration);
        else list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        // 分页
        const totalFiltered = list.length;
        const pSize = this.userPageSize || 20;
        const totalPages = Math.max(1, Math.ceil(totalFiltered / pSize));
        if (this.userPage > totalPages) this.userPage = totalPages;
        if (this.userPage < 1) this.userPage = 1;
        const pageStart = (this.userPage - 1) * pSize;
        const pageList = list.slice(pageStart, pageStart + pSize);
        const selectedOnPage = pageList.filter((u) => this.selectedUsers.has(u.id));
        const allOnPageSelected = pageList.length > 0 && selectedOnPage.length === pageList.length;

        const myId = API.getSyncCode();

        el.innerHTML = `
            ${this.pageHeader({
                title: '用户管理',
                description: '管理同步码、设备绑定、学习数据、封禁状态与管理员权限。',
                crumbs: ['管理后台', '用户管理'],
                actions:
                    '<button class="abtn primary" onclick="Admin.exportCSV()">导出 CSV</button><button class="abtn" onclick="Admin.loadAll().then(()=>Admin.renderUsers())">刷新</button>'
            })}
            <div class="toolbar">
                <div class="toolbar-group" style="flex:1">
                    <div class="search-box"><span class="ic">${Utils.icon('search')}</span><input type="text" id="search-input" placeholder="搜索同步码或姓名..." value="${Utils.escapeHtml(q || '')}"></div>
                    <select id="user-status-filter" class="admin-select" style="width:auto" onchange="Admin.setUserStatus(this.value)">
                        <option value="all" ${status === 'all' ? 'selected' : ''}>全部状态</option>
                        <option value="normal" ${status === 'normal' ? 'selected' : ''}>正常用户</option>
                        <option value="banned" ${status === 'banned' ? 'selected' : ''}>封禁用户</option>
                        <option value="admin" ${status === 'admin' ? 'selected' : ''}>管理员</option>
                    </select>
                </div>
                <div class="toolbar-group">
                    <button class="fbtn ${this.sort === 'time' ? 'active' : ''}" onclick="Admin.setSort('time')">注册时间</button>
                    <button class="fbtn ${this.sort === 'answered' ? 'active' : ''}" onclick="Admin.setSort('answered')">答题数</button>
                    <button class="fbtn ${this.sort === 'duration' ? 'active' : ''}" onclick="Admin.setSort('duration')">学习时长</button>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <div style="display:flex;align-items:center;gap:8px">
                        <h3>用户列表</h3>
                        <span class="status-pill info">${list.length}/${this.users.length} 用户</span>
                    </div>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead><tr>
<th><input type="checkbox" ${allOnPageSelected ? 'checked' : ''} onchange="Admin.toggleUsersOnPage(this.checked)" title="全选/取消本页"></th>
<th>同步码</th><th>姓名</th><th>角色</th><th>设备</th><th>答题</th><th>正确率</th><th>时长</th><th>注册</th><th>状态</th><th>操作</th>
</tr></thead>
                        <tbody>${pageList.length ? pageList.map((u) => this._userRow(u, myId, this.selectedUsers.has(u.id))).join('') : `<tr><td colspan="11">${this.emptyState({ title: '没有匹配用户', desc: '请调整搜索词或筛选条件。' })}</td></tr>`}</tbody>
                    </table>
                </div>
            </div>
            ${
                this.selectedUsers.size > 0
                    ? `
            <div class="toolbar" style="margin-top:8px;background:var(--admin-primary-weak);border:1px solid var(--admin-primary-border);border-radius:8px;padding:10px 14px">
                <div class="toolbar-group" style="flex:1">
                    <span class="status-pill info">已选 ${this.selectedUsers.size} 人</span>
                </div>
                <div class="toolbar-group">
                    <button class="abtn warn" onclick="Admin.bulkBanUsers(true)">批量封禁</button>
                    <button class="abtn success" onclick="Admin.bulkBanUsers(false)">批量解封</button>
                    <button class="abtn" onclick="Admin.clearUserSelection()">清空选择</button>
                </div>
            </div>`
                    : ''
            }
            ${this.pager({ page: this.userPage, pageSize: this.userPageSize, total: totalFiltered, onPage: 'Admin.setUserPage', onPageSize: 'Admin.setUserPageSize' })}
        `;
        document
            .getElementById('search-input')
            ?.addEventListener('input', () => this.renderUsers());
        Utils.initIcons?.();
    };

    Admin._userRow = function (u, myId, selected = false) {
        const acc =
            u.total_answered > 0 ? Math.round((u.total_correct / u.total_answered) * 100) : 0;
        const c = acc >= 80 ? '#15803d' : acc >= 60 ? '#b45309' : '#b91c1c';
        const n = Utils.escapeHtml(u.initials);
        const jsn = Utils.jsSafe(u.initials);
        const jsu = Utils.jsSafe(u.id);
        const role = `${u.is_admin ? '<span class="badge b-admin">管理员</span>' : '<span class="badge">普通用户</span>'}${u.id === myId ? ' <span class="badge b-me">当前设备</span>' : ''}`;
        const checked = selected ? 'checked' : '';
        return `<tr style="cursor:pointer" onclick="Admin.showUserDetail('${jsu}')">
            <td onclick="event.stopPropagation()"><input type="checkbox" ${checked} onchange="Admin.toggleUserSelection('${jsu}')"></td>
            <td><span class="code">${u.id}</span></td>
            <td><strong>${n}</strong></td>
            <td>${role}</td>
            <td>${u.device_count}</td>
            <td><b>${u.total_answered}</b></td>
            <td><div class="acc-bar"><span>${acc}%</span><div class="bar"><div class="fill" style="width:${acc}%;background:${c}"></div></div></div></td>
            <td>${this.fmtDur(u.total_duration)}</td>
            <td>${Admin.fmtDate(u.created_at) || '-'}</td>
            <td>${this.statusPill(!u.banned, { enabled: '正常', disabled: '封禁' })}</td>
            <td style="white-space:nowrap" onclick="event.stopPropagation()">
                ${u.id !== myId ? `<button class="abtn ${u.banned ? '' : 'warn'}" onclick="Admin.banUser('${jsu}','${jsn}',${u.banned ? 0 : 1})">${u.banned ? '解封' : '封禁'}</button>` : ''}
                ${!u.is_admin && u.id !== myId ? `<button class="abtn danger" onclick="Admin.delUser('${jsu}','${jsn}')">删除</button>` : ''}
            </td>
        </tr>`;
    };

    Admin.setSort = function (s) {
        this.sort = s;
        this.userPage = 1;
        this.renderUsers();
    };
    Admin.setUserStatus = function (s) {
        this.userStatusFilter = s;
        this.userPage = 1;
        this.renderUsers();
    };

    Admin.setUserPage = function (p) {
        this.userPage = p;
        this.renderUsers();
    };

    Admin.setUserPageSize = function (s) {
        this.userPageSize = s;
        this.userPage = 1;
        this.renderUsers();
    };

    Admin.toggleUserSelection = function (uid) {
        if (this.selectedUsers.has(uid)) this.selectedUsers.delete(uid);
        else this.selectedUsers.add(uid);
        this.renderUsers();
    };

    Admin.toggleUsersOnPage = function (checked) {
        const q = (document.getElementById('search-input')?.value || '').toUpperCase();
        const status =
            document.getElementById('user-status-filter')?.value || this.userStatusFilter || 'all';
        let list = this.users.filter(
            (u) => !q || u.id.includes(q) || u.initials.toUpperCase().includes(q)
        );
        if (status === 'normal') list = list.filter((u) => !u.banned && !u.is_admin);
        else if (status === 'banned') list = list.filter((u) => u.banned);
        else if (status === 'admin') list = list.filter((u) => u.is_admin);
        if (this.sort === 'answered') list.sort((a, b) => b.total_answered - a.total_answered);
        else if (this.sort === 'duration') list.sort((a, b) => b.total_duration - a.total_duration);
        else list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        const pageStart = (this.userPage - 1) * this.userPageSize;
        list.slice(pageStart, pageStart + this.userPageSize).forEach((u) => {
            if (checked) this.selectedUsers.add(u.id);
            else this.selectedUsers.delete(u.id);
        });
        this.renderUsers();
    };

    Admin.clearUserSelection = function () {
        this.selectedUsers.clear();
        this.renderUsers();
    };

    Admin.bulkBanUsers = async function (ban) {
        const ids = [...this.selectedUsers];
        if (!ids.length) return;
        
        this.logAction('批量操作开始', {
            operation: ban ? '批量封禁' : '批量解封',
            userCount: ids.length,
            userIds: ids.slice(0, 5).join(', ') + (ids.length > 5 ? '...' : '')
        });
        
        const ok = await this.confirmDanger({
            title: ban ? '批量封禁' : '批量解封',
            message: `将${ban ? '封禁' : '解封'} ${ids.length} 个用户`,
            confirmText: ban ? '批量封禁' : '批量解封',
            danger: ban
        });
        
        if (!ok) {
            this.logAction('批量操作取消', { operation: ban ? '批量封禁' : '批量解封', userCount: ids.length });
            return;
        }
        
        const r = await this.post('/api/admin/batch-ban', { userIds: ids, ban: ban ? 1 : 0 });
        if (r?.ok) {
            this.logAction('批量操作成功', {
                operation: ban ? '批量封禁' : '批量解封',
                affectedCount: r.affected,
                totalCount: ids.length,
                response: r
            });
            Utils.showToast(`已${ban ? '封禁' : '解封'} ${r.affected} 人`, 'success');
        } else {
            this.logAction('批量操作失败', {
                operation: ban ? '批量封禁' : '批量解封',
                error: r?.error || '未知错误'
            }, 'error');
            Utils.showToast(r?.error || '操作失败', 'error');
        }
        this.selectedUsers.clear();
        await this.loadAll();
        this.renderUsers();
    };

    // ==================== 用户详情页（二级页面）====================
    Admin.showUserDetail = async function (uid, { pushHash = true } = {}) {
        if (pushHash) {
            const targetHash = `#/users/${uid}`;
            if (location.hash !== targetHash) {
                this.navigate(targetHash);
                return;
            }
        }
        const el = document.getElementById('sec-users');
        el.innerHTML = '<div class="loading">加载中...</div>';

        try {
            const d = await this.get(`/api/admin/user-detail/${uid}`);
            if (!d?.ok) {
                el.innerHTML = this.emptyState({
                    title: '加载失败',
                    desc: d?.error || '无法获取用户详情。'
                });
                return;
            }

            const u = d.user;
            const ta = d.stats.reduce((s, x) => s + x.answered, 0);
            const tc = d.stats.reduce((s, x) => s + x.correct, 0);
            const td = d.stats.reduce((s, x) => s + x.duration, 0);
            const n = Utils.escapeHtml(u.initials);
            const jsn = Utils.jsSafe(u.initials);
            const jsu = Utils.jsSafe(u.id);
            const myId = API.getSyncCode();

            el.innerHTML = `
                <div id="user-detail-root">
                ${this.pageHeader({
                    title: `${u.initials} 的用户详情`,
                    description: `同步码 ${u.id} · ${u.banned ? '当前已封禁' : '当前状态正常'}`,
                    crumbs: ['管理后台', '用户管理', u.initials || uid],
                    actions:
                        '<button class="abtn" onclick="Admin.switchTab(&quot;users&quot;)">返回用户列表</button>'
                })}
                <div class="card">
                    <div class="card-header">
                        <h3>${n} <span class="code">${u.id}</span></h3>
                        <div class="page-actions">${u.is_admin ? ' <span class="badge b-admin">管理员</span>' : ''}${u.banned ? this.statusPill(false, { disabled: '已封禁' }) : this.statusPill(true, { enabled: '正常' })}</div>
                    </div>
                    <div class="card-body" style="padding:16px">
                        <div class="d-grid">
                            <div class="d-item"><div class="dl">注册时间</div><div class="dv">${Admin.fmtTime(u.created_at) || '-'}</div></div>
                            <div class="d-item"><div class="dl">设备数量</div><div class="dv">${d.devices.length} 台</div></div>
                            <div class="d-item"><div class="dl">总答题</div><div class="dv">${ta}</div></div>
                            <div class="d-item"><div class="dl">正确率</div><div class="dv">${ta > 0 ? Math.round((tc / ta) * 100) : 0}%</div></div>
                            <div class="d-item"><div class="dl">总时长</div><div class="dv">${this.fmtDur(td)}</div></div>
                            <div class="d-item"><div class="dl">题库数</div><div class="dv">${d.stats.length} 个</div></div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>常用操作</h3><span class="count">用户资料与数据维护</span></div>
                    <div class="card-body" style="padding:16px">
                        <div class="toolbar-group">
                            <button class="abtn primary" onclick="Admin.editUser('${jsu}','${jsn}',${u.is_admin ? 1 : 0})">编辑信息</button>
                            <button class="abtn primary" onclick="Admin.changeSyncCode('${jsu}','${jsn}')">修改同步码</button>
                            <button class="abtn primary" onclick="Admin.adjustStats('${jsu}','${jsn}')">调整数据</button>
                            <button class="abtn" onclick="Admin.viewCloudData('${jsu}')">查看云端数据</button>
                            ${u.id !== myId ? `<button class="abtn ${u.banned ? '' : 'warn'}" onclick="Admin.banUser('${jsu}','${jsn}',${u.banned ? 0 : 1})">${u.banned ? '解封用户' : '封禁用户'}</button>` : ''}
                        </div>
                    </div>
                </div>
                ${
                    d.devices.length
                        ? `
                <div class="card">
                    <div class="card-header"><h3>设备列表</h3><span class="count">${d.devices.length} 台</span></div>
                    <div class="card-body" style="padding:12px">
                        ${d.devices
                            .map((x) => {
                                const jsd = Utils.jsSafe(x.device_id);
                                return `<div class="management-row" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;cursor:default">
                                <code class="code" style="flex:1;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(x.device_id)}</code>
                                <span style="color:var(--admin-text-tertiary);font-size:12px">${Admin.fmtDate(x.bound_at) || ''}</span>
                                <button class="abtn danger" onclick="Admin.removeDevice('${jsd}','${jsu}')">解绑</button>
                            </div>`;
                            })
                            .join('')}
                    </div>
                </div>`
                        : ''
                }
                ${
                    d.stats.length
                        ? `
                <div class="card">
                    <div class="card-header"><h3>答题统计</h3><span class="count">${d.stats.length} 个题库</span></div>
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>题库</th><th style="text-align:right">答题</th><th style="text-align:right">正确</th><th style="text-align:right">正确率</th><th style="text-align:right">时长</th></tr></thead>
                            <tbody>${d.stats
                                .map((s) => {
                                    const a =
                                        s.answered > 0
                                            ? Math.round((s.correct / s.answered) * 100)
                                            : 0;
                                    const c2 =
                                        a >= 80 ? '#15803d' : a >= 60 ? '#b45309' : '#b91c1c';
                                    return `<tr>
                                    <td><strong>${Utils.escapeHtml(s.bank_name || s.bank_id)}</strong></td>
                                    <td style="text-align:right">${s.answered}</td>
                                    <td style="text-align:right">${s.correct}</td>
                                    <td style="text-align:right"><span style="color:${c2};font-weight:800">${a}%</span></td>
                                    <td style="text-align:right">${this.fmtDur(s.duration)}</td>
                                </tr>`;
                                })
                                .join('')}</tbody>
                        </table>
                    </div>
                </div>`
                        : ''
                }
                ${
                    !u.is_admin
                        ? `
                <div class="danger-zone">
                    <h3>危险操作</h3>
                    <p>这些操作会影响用户数据或账号可用性，请确认对象无误后再执行。</p>
                    <div class="toolbar-group" style="margin-top:12px">
                        <button class="abtn danger" onclick="Admin.resetStats('${jsu}','${jsn}')">重置答题数据</button>
                        <button class="abtn danger" onclick="Admin.delUser('${jsu}','${jsn}')">删除用户</button>
                    </div>
                </div>`
                        : ''
                }
                </div>
            `;
        } catch (e) {
            el.innerHTML = `
                ${this.pageHeader({ title: '用户详情', description: '用户详情加载失败。', crumbs: ['管理后台', '用户管理'], actions: '<button class="abtn" onclick="Admin.switchTab(&quot;users&quot;)">返回用户列表</button>' })}
                ${this.emptyState({ title: '加载失败', desc: e.message })}
            `;
        }
    };

    // ==================== 弹窗操作 ====================

    Admin.editUser = function (uid, name, admin) {
        const hn = Utils.escapeHtml(name);
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="Admin.onMaskClick(event)">
                <div class="modal-box" style="max-width:400px">
                    <h3>编辑用户</h3>
                    <label>姓名</label><input id="eu-initials" value="${hn}" maxlength="4">
                    <label>管理员</label><select id="eu-admin"><option value="0" ${!admin ? 'selected' : ''}>否</option><option value="1" ${admin ? 'selected' : ''}>是</option></select>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.saveUser('${Utils.jsSafe(uid)}')">保存</button></div>
                </div>
            </div>`;
    };

    Admin.saveUser = async function (uid) {
        const newInitials = document.getElementById('eu-initials').value.trim();
        const newIsAdmin = parseInt(document.getElementById('eu-admin').value);
        
        this.logAction('保存用户信息开始', {
            userId: uid,
            newInitials,
            newIsAdmin: !!newIsAdmin
        });
        
        const r = await this.post('/api/admin/update-user', {
            targetUserId: uid,
            initials: newInitials,
            isAdmin: newIsAdmin
        });
        if (r?.ok) {
            this.logAction('保存用户信息成功', {
                userId: uid,
                updatedFields: { initials: newInitials, isAdmin: !!newIsAdmin },
                response: r
            });
            Utils.showToast('已保存', 'success');
            document.querySelector('.modal-mask')?.remove();
            await this.loadAll();
            this.showUserDetail(uid);
        } else {
            this.logAction('保存用户信息失败', {
                userId: uid,
                error: r?.error || '未知错误'
            }, 'error');
            Utils.showToast(r?.error || '失败', 'error');
        }
    };

    Admin.changeSyncCode = function (uid, name) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="Admin.onMaskClick(event)">
                <div class="modal-box" style="max-width:400px">
                    <h3>修改同步码</h3>
                    <p style="font-size:13px;color:var(--admin-text-secondary);margin-bottom:12px">用户：${Utils.escapeHtml(name)} (${uid})</p>
                    <label>新同步码</label><input id="new-sync-code" value="${uid}" maxlength="6" style="text-transform:uppercase">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doChangeSyncCode('${Utils.jsSafe(uid)}')">确认修改</button></div>
                </div>
            </div>`;
    };

    Admin.doChangeSyncCode = async function (oldUid) {
        const newCode = document.getElementById('new-sync-code').value.trim().toUpperCase();
        if (!newCode || newCode.length < 4) {
            this.logAction('修改同步码失败', { reason: '同步码无效', oldUid, newCode: newCode.slice(0, 2) + '***' });
            Utils.showToast('请输入有效同步码', 'error');
            return;
        }
        
        this.logAction('修改同步码开始', {
            oldUserId: oldUid,
            newUserId: newCode.slice(0, 2) + '***'
        });
        
        const r = await this.post('/api/admin/change-sync-code', {
            oldUserId: oldUid,
            newUserId: newCode
        });
        if (r?.ok) {
            this.logAction('修改同步码成功', {
                oldUserId: oldUid,
                newUserId: newCode.slice(0, 2) + '***',
                response: r
            });
            Utils.showToast('已修改', 'success');
            document.querySelector('.modal-mask')?.remove();
            await this.loadAll();
            this.renderUsers();
        } else {
            this.logAction('修改同步码失败', {
                oldUserId: oldUid,
                error: r?.error || '未知错误'
            }, 'error');
            Utils.showToast(r?.error || '失败', 'error');
        }
    };

    Admin.adjustStats = function (uid, name) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="Admin.onMaskClick(event)">
                <div class="modal-box" style="max-width:400px">
                    <h3>调整数据</h3>
                    <p style="font-size:13px;color:var(--admin-text-secondary);margin-bottom:12px">用户：${Utils.escapeHtml(name)} (${uid})</p>
                    <label>题库 ID</label><input id="adj-bank-id" placeholder="题库ID">
                    <label>题库名称</label><input id="adj-bank-name" placeholder="题库名称（可选）">
                    <label>添加答题数</label><input id="adj-answered" type="number" value="0">
                    <label>添加正确数</label><input id="adj-correct" type="number" value="0">
                    <label>添加时长（秒）</label><input id="adj-duration" type="number" value="0">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doAdjustStats('${Utils.jsSafe(uid)}')">确认</button></div>
                </div>
            </div>`;
    };

    Admin.doAdjustStats = async function (uid) {
        const bankId = document.getElementById('adj-bank-id').value.trim();
        const bankName = document.getElementById('adj-bank-name').value.trim();
        const answered = parseInt(document.getElementById('adj-answered').value) || 0;
        const correct = parseInt(document.getElementById('adj-correct').value) || 0;
        const duration = parseInt(document.getElementById('adj-duration').value) || 0;
        
        this.logAction('调整用户数据开始', {
            userId: uid,
            bankId,
            bankName,
            adjustment: { answered, correct, duration }
        });
        
        const r = await this.post('/api/admin/adjust-stats', {
            targetUserId: uid,
            bankId,
            bankName,
            answered,
            correct,
            duration
        });
        if (r?.ok) {
            this.logAction('调整用户数据成功', {
                userId: uid,
                bankId,
                adjustment: { answered, correct, duration },
                response: r
            });
            Utils.showToast('已调整', 'success');
            document.querySelector('.modal-mask')?.remove();
            await this.loadAll();
            this.showUserDetail(uid);
        } else {
            this.logAction('调整用户数据失败', {
                userId: uid,
                error: r?.error || '未知错误'
            }, 'error');
            Utils.showToast(r?.error || '失败', 'error');
        }
    };

    Admin.viewCloudData = async function (uid) {
        const d = await this.get(`/api/admin/user-cloud-data/${uid}`);
        if (!d?.ok) {
            Utils.showToast('获取失败', 'error');
            return;
        }
        const preStyle =
            'background:#f8fafc;padding:10px;border-radius:10px;font-size:11px;overflow-x:auto;margin-top:6px;color:#102033;border:1px solid #d9e2ec';
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="Admin.onMaskClick(event)">
                <div class="modal-box" style="max-width:560px;max-height:80vh;overflow-y:auto">
                    <h3>云端数据 - ${Utils.escapeHtml(d.user?.initials || uid)}</h3>
                    <p style="font-size:12px;color:var(--admin-text-tertiary);margin-bottom:8px">最后同步：${Admin.fmtTime(d.user?.lastSyncAt) || '无'}</p>
                    <div style="margin-bottom:10px">
                        <strong style="font-size:12px">设置</strong>
                        <pre style="${preStyle}">${Utils.escapeHtml(JSON.stringify(d.settings || {}, null, 2))}</pre>
                    </div>
                    <div>
                        <strong style="font-size:12px">进度</strong>
                        <pre style="${preStyle}">${Utils.escapeHtml(JSON.stringify(d.progress || {}, null, 2))}</pre>
                    </div>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">关闭</button></div>
                </div>
            </div>`;
    };

    Admin.banUser = async function (uid, name, ban) {
        this.logAction('用户状态切换开始', {
            userId: uid,
            userName: name,
            targetState: ban ? '封禁' : '解封'
        });
        
        const ok = await this.confirmDanger({
            title: ban ? '封禁用户' : '解封用户',
            targetLabel: `${name} (${uid})`,
            message: ban ? '封禁后该用户将无法继续同步数据。' : '解封后该用户将恢复正常使用。',
            confirmText: ban ? '确认封禁' : '确认解封',
            danger: !!ban
        });
        
        if (!ok) {
            this.logAction('用户状态切换取消', { userId: uid, targetState: ban ? '封禁' : '解封' });
            return;
        }
        
        const r = await this.post('/api/admin/ban-user', { targetUserId: uid, banned: !!ban });
        if (!r?.ok) {
            this.logAction('用户状态切换失败', {
                userId: uid,
                userName: name,
                targetState: ban ? '封禁' : '解封',
                error: r?.error || '未知错误'
            }, 'error');
            Utils.showToast(r?.error || '操作失败', 'error');
            return;
        }
        
        this.logAction('用户状态切换成功', {
            userId: uid,
            userName: name,
            newState: ban ? '已封禁' : '已解封',
            response: r
        });
        Utils.showToast(ban ? '已封禁' : '已解封', 'success');
        await this.loadAll();
        if (document.getElementById('user-detail-root')) this.showUserDetail(uid);
        else this.renderUsers();
    };

    Admin.resetStats = async function (uid, name) {
        this.logAction('重置用户数据开始', {
            userId: uid,
            userName: name,
            warning: '此操作不可撤销'
        });
        
        const ok = await this.confirmDanger({
            title: '重置答题数据',
            targetLabel: `${name} (${uid})`,
            message: '此操作会清空该用户的答题统计，无法撤销。',
            requiredText: 'RESET',
            confirmText: '确认重置'
        });
        
        if (!ok) {
            this.logAction('重置用户数据取消', { userId: uid });
            return;
        }
        
        const r = await this.post('/api/admin/reset-stats', { targetUserId: uid });
        if (r?.ok) {
            this.logAction('重置用户数据成功', {
                userId: uid,
                userName: name,
                response: r
            });
            Utils.showToast('已重置', 'success');
            await this.loadAll();
            this.showUserDetail(uid);
        } else {
            this.logAction('重置用户数据失败', {
                userId: uid,
                error: r?.error || '未知错误'
            }, 'error');
        }
    };

    Admin.delUser = async function (uid, name) {
        this.logAction('删除用户开始', {
            userId: uid,
            userName: name,
            warning: '此操作不可恢复'
        });
        
        const ok = await this.confirmDanger({
            title: '永久删除用户',
            targetLabel: `${name} (${uid})`,
            message: '用户、设备绑定和相关云端数据将被删除。此操作不可恢复。',
            requiredText: uid,
            confirmText: '永久删除'
        });
        
        if (!ok) {
            this.logAction('删除用户取消', { userId: uid });
            return;
        }
        
        const r = await this.post('/api/admin/delete-user', { targetUserId: uid });
        if (r?.ok) {
            this.logAction('删除成功', {
                userId: uid,
                userName: name,
                response: r
            });
            Utils.showToast('已删除', 'success');
            await this.loadAll();
            this.renderUsers();
        } else {
            this.logAction('删除用户失败', {
                userId: uid,
                error: r?.error || '未知错误'
            }, 'error');
        }
    };

    Admin.removeDevice = async function (deviceId, uid) {
        this.logAction('解绑设备开始', {
            deviceId,
            userId: uid
        });
        
        const ok = await this.confirmDanger({
            title: '解绑设备',
            targetLabel: deviceId,
            message: '解绑后该设备需要重新绑定同步码才能继续同步。',
            confirmText: '确认解绑'
        });
        
        if (!ok) {
            this.logAction('解绑设备取消', { deviceId, userId: uid });
            return;
        }
        
        const r = await this.post('/api/admin/remove-device', { deviceId });
        if (r?.ok) {
            this.logAction('解绑设备成功', {
                deviceId,
                userId: uid,
                response: r
            });
            Utils.showToast('已解绑', 'success');
            this.showUserDetail(uid);
        } else {
            this.logAction('解绑设备失败', {
                deviceId,
                userId: uid,
                error: r?.error || '未知错误'
            }, 'error');
        }
    };

    // 工具函数
    Admin.fmtDate = function (d) {
        if (!d) return '';
        try {
            return new Date(d).toLocaleDateString('zh-CN');
        } catch {
            return '';
        }
    };
    Admin.fmtTime = function (d) {
        if (!d) return '';
        try {
            return new Date(d).toLocaleString('zh-CN');
        } catch {
            return '';
        }
    };
    Admin.fmtDur = function (s) {
        if (!s) return '0分';
        const h = Math.floor(s / 3600),
            m = Math.floor((s % 3600) / 60);
        return h ? `${h}时${m}分` : `${m}分`;
    };
}
