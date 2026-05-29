/**
 * 管理后台模块（高密度版）
 */
import API from './api.js';
import Utils from './utils.js';

const Admin = {
    users: [],
    password: (() => {
        const saved = localStorage.getItem('admin_pwd');
        if (!saved) return sessionStorage.getItem('admin_pwd') || '';
        try {
            const { pwd, ts } = JSON.parse(saved);
            if (Date.now() - ts > 3600000) { localStorage.removeItem('admin_pwd'); return ''; }
            return pwd;
        } catch { localStorage.removeItem('admin_pwd'); return ''; }
    })(),
    sort: 'time',
    tab: 'overview',

    async init() {
        document.getElementById('btn-login').addEventListener('click', () => this.login());
        document.getElementById('admin-password').addEventListener('keydown', e => {
            if (e.key === 'Enter') this.login();
        });
        if (this.password) await this.loadAll();
    },

    // ==================== 登录 ====================

    async login() {
        const pwd = document.getElementById('admin-password').value.trim();
        if (!pwd) return;
        const err = document.getElementById('login-error');
        err.style.display = 'none';
        try {
            const d = await this.getWithAuth('/api/admin/users', pwd);
            if (d && d.ok) {
                localStorage.setItem('admin_pwd', JSON.stringify({ pwd, ts: Date.now() }));
                sessionStorage.setItem('admin_pwd', pwd);
                this.password = pwd;
                this.users = d.users;
                this.showApp();
            } else {
                err.textContent = (d && d.error) || '密码错误';
                err.style.display = 'block';
            }
        } catch (e) {
            err.textContent = '网络错误: ' + e.message;
            err.style.display = 'block';
        }
    },

    logout() { localStorage.removeItem('admin_pwd'); sessionStorage.removeItem('admin_pwd'); location.reload(); },

    async loadAll() {
        try {
            const d = await this.get('/api/admin/users');
            if (!d?.ok) {
                localStorage.removeItem('admin_pwd');
                sessionStorage.removeItem('admin_pwd');
                return;
            }
            this.users = d.users;
            this.showApp();
        } catch {
            localStorage.removeItem('admin_pwd');
            sessionStorage.removeItem('admin_pwd');
        }
    },

    showApp() {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('admin-app').style.display = '';
        this.renderTab();
    },

    switchTab(t) {
        this.tab = t;
        document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === t));
        document.querySelectorAll('.section').forEach(el => el.classList.toggle('active', el.id === 'sec-' + t));
        this.renderTab();
    },

    async renderTab() {
        const map = { overview: 'renderOverview', users: 'renderUsers', banks: 'renderBanks', activity: 'renderActivity', announce: 'renderAnnounce' };
        if (map[this.tab]) await this[map[this.tab]]();
    },

    // ==================== 总览 ====================

    async renderOverview() {
        const el = document.getElementById('sec-overview');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const d = await this.get('/api/admin/overview');
            if (!d?.ok) { el.innerHTML = '<div class="empty-state">加载失败</div>'; return; }

            const o = d.overview;
            const total = this.users.reduce((s, u) => s + u.total_answered, 0);
            const dur = this.users.reduce((s, u) => s + u.total_duration, 0);
            const acc = total > 0 ? Math.round(this.users.reduce((s, u) => s + u.total_correct, 0) / total * 100) : 0;
            const maxCnt = Math.max(...o.weekTrend.map(w => w.cnt), 1);

            el.innerHTML = `
                <div class="stat-grid">
                    <div class="stat-card"><div class="stat-icon purple">${Utils.icon('users')}</div><div class="stat-info"><div class="stat-value">${this.users.length}</div><div class="stat-label">注册用户</div></div></div>
                    <div class="stat-card"><div class="stat-icon blue">${Utils.icon('check-circle')}</div><div class="stat-info"><div class="stat-value">${this.fmtN(total)}</div><div class="stat-label">总答题数</div></div></div>
                    <div class="stat-card"><div class="stat-icon green">${Utils.icon('target')}</div><div class="stat-info"><div class="stat-value">${acc}%</div><div class="stat-label">平均正确率</div></div></div>
                    <div class="stat-card"><div class="stat-icon orange">${Utils.icon('clock')}</div><div class="stat-info"><div class="stat-value">${this.fmtDur(dur)}</div><div class="stat-label">总学习时长</div></div></div>
                </div>
                <div class="stat-grid">
                    <div class="stat-card"><div class="stat-icon blue">${Utils.icon('user-plus')}</div><div class="stat-info"><div class="stat-value">${o.todayReg}</div><div class="stat-label">今日注册</div></div></div>
                    <div class="stat-card"><div class="stat-icon green">${Utils.icon('activity')}</div><div class="stat-info"><div class="stat-value">${o.todayActive}</div><div class="stat-label">今日活跃</div></div></div>
                    <div class="stat-card"><div class="stat-icon purple">${Utils.icon('book-open')}</div><div class="stat-info"><div class="stat-value">${o.bankCount}</div><div class="stat-label">题库总数</div></div></div>
                    <div class="stat-card"><div class="stat-icon red">${Utils.icon('shield-off')}</div><div class="stat-info"><div class="stat-value">${o.bannedCount}</div><div class="stat-label">封禁用户</div></div></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>近7天注册趋势</h3></div>
                    <div class="trend-chart">${o.weekTrend.map(w =>
                        `<div class="trend-bar" style="height:${Math.max(w.cnt / maxCnt * 60, 3)}px"><span class="trend-value">${w.cnt}</span><span class="trend-label">${w.day.slice(5)}</span></div>`
                    ).join('') || '<div class="empty-state">暂无数据</div>'}</div>
                </div>
            `;
            Utils.initIcons?.();
        } catch (e) { el.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`; }
    },

    // ==================== 用户 ====================

    renderUsers() {
        const el = document.getElementById('sec-users');
        const q = (document.getElementById('search-input')?.value || '').toUpperCase();
        let list = this.users.filter(u => !q || u.id.includes(q) || u.initials.toUpperCase().includes(q));
        if (this.sort === 'answered') list.sort((a, b) => b.total_answered - a.total_answered);
        else if (this.sort === 'duration') list.sort((a, b) => b.total_duration - a.total_duration);
        const myId = API.getSyncCode();

        el.innerHTML = `
            <div class="detail" id="detail-panel"></div>
            <div class="search-row">
                <div class="search-box"><span class="ic">${Utils.icon('search')}</span><input type="text" id="search-input" placeholder="搜索同步码或姓名..." value="${q || ''}"></div>
                <button class="fbtn ${this.sort === 'time' ? 'active' : ''}" onclick="Admin.setSort('time')">注册时间</button>
                <button class="fbtn ${this.sort === 'answered' ? 'active' : ''}" onclick="Admin.setSort('answered')">答题数</button>
                <button class="fbtn ${this.sort === 'duration' ? 'active' : ''}" onclick="Admin.setSort('duration')">时长</button>
            </div>
            <div class="card">
                <div class="card-header"><h3>用户列表</h3><span class="count">${list.length}/${this.users.length}</span><button class="abtn primary" style="padding:3px 10px;font-size:11px" onclick="Admin.exportCSV()">导出CSV</button></div>
                <div class="card-body" style="overflow-x:auto">
                    <table>
                        <thead><tr><th>同步码</th><th>姓名</th><th>设备</th><th>答题</th><th>正确率</th><th>时长</th><th>注册</th><th>状态</th><th>操作</th></tr></thead>
                        <tbody>${list.map(u => this._userRow(u, myId)).join('')}</tbody>
                    </table>
                </div>
            </div>
        `;
        document.getElementById('search-input')?.addEventListener('input', () => this.renderUsers());
        Utils.initIcons?.();
    },

    _userRow(u, myId) {
        const acc = u.total_answered > 0 ? Math.round(u.total_correct / u.total_answered * 100) : 0;
        const c = acc >= 80 ? '#22c55e' : acc >= 60 ? '#f59e0b' : '#ef4444';
        const n = Utils.escapeHtml(u.initials);
        const jsn = Utils.jsSafe(u.initials);
        const jsu = Utils.jsSafe(u.id);
        return `<tr>
            <td><span class="code">${u.id}</span></td>
            <td>${n}${u.is_admin ? ' <span class="badge b-admin">管理</span>' : ''}${u.id === myId ? ' <span class="badge b-me">我</span>' : ''}</td>
            <td>${u.device_count}</td>
            <td><b>${u.total_answered}</b></td>
            <td><div class="acc-bar"><span>${acc}%</span><div class="bar"><div class="fill" style="width:${acc}%;background:${c}"></div></div></div></td>
            <td>${this.fmtDur(u.total_duration)}</td>
            <td>${u.created_at?.slice(0, 10) || '-'}</td>
            <td>${u.banned ? '<span class="badge b-ban">封禁</span>' : '<span style="color:#22c55e">正常</span>'}</td>
            <td style="white-space:nowrap">
                <button class="abtn primary" onclick="Admin.detail('${jsu}')">详情</button>
                <button class="abtn" onclick="Admin.editUser('${jsu}','${jsn}',${u.is_admin?1:0})">编辑</button>
                ${u.id!==myId?`<button class="abtn ${u.banned?'':'warn'}" onclick="Admin.banUser('${jsu}','${jsn}',${u.banned?0:1})">${u.banned?'解封':'封禁'}</button>`:''}
                ${!u.is_admin&&u.id!==myId?`<button class="abtn danger" onclick="Admin.resetStats('${jsu}','${jsn}')">重置</button><button class="abtn danger" onclick="Admin.delUser('${jsu}','${jsn}')">删除</button>`:''}
            </td>
        </tr>`;
    },

    setSort(s) { this.sort = s; this.renderUsers(); },

    // ==================== 详情 ====================

    async detail(uid) {
        const p = document.getElementById('detail-panel');
        try {
            const d = await this.get(`/api/admin/user-detail/${uid}`);
            if (!d?.ok) return;
            const u = d.user, ta = d.stats.reduce((s, x) => s + x.answered, 0), tc = d.stats.reduce((s, x) => s + x.correct, 0), td = d.stats.reduce((s, x) => s + x.duration, 0);
            const n = Utils.escapeHtml(u.initials);
            const jsn = Utils.jsSafe(u.initials);
            const jsu = Utils.jsSafe(u.id);
            p.classList.add('show');
            p.innerHTML = `
                <div class="dh"><h3>${n} <span class="code">${u.id}</span>${u.is_admin?' <span class="badge b-admin">管理</span>':''}${u.banned?' <span class="badge b-ban">封禁</span>':''}</h3><button class="close-btn" onclick="this.closest('.detail').classList.remove('show')">✕</button></div>
                <div class="d-grid">
                    <div class="d-item"><div class="dl">注册</div><div class="dv">${u.created_at?.slice(0,16)||'-'}</div></div>
                    <div class="d-item"><div class="dl">设备</div><div class="dv">${d.devices.length}台</div></div>
                    <div class="d-item"><div class="dl">答题</div><div class="dv">${ta}</div></div>
                    <div class="d-item"><div class="dl">正确率</div><div class="dv">${ta>0?Math.round(tc/ta*100):0}%</div></div>
                    <div class="d-item"><div class="dl">时长</div><div class="dv">${this.fmtDur(td)}</div></div>
                    <div class="d-item"><div class="dl">题库</div><div class="dv">${d.stats.length}个</div></div>
                </div>
                ${d.devices.length?`<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;display:flex;justify-content:space-between;align-items:center">设备列表</div>${d.devices.map(x=>{const jsd=Utils.jsSafe(x.device_id);return `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:var(--bg-hover);border-radius:4px;margin-bottom:3px;font-size:11px"><code style="color:var(--text-tertiary);flex:1;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(x.device_id)}</code><span style="color:var(--text-tertiary)">${x.bound_at?.slice(0,10)||''}</span><button class="abtn danger" style="padding:1px 6px;font-size:10px" onclick="Admin.removeDevice('${jsd}','${jsu}')">解绑</button></div>`;}).join('')}`:''}
                ${d.stats.length?`<div style="font-size:11px;color:var(--text-tertiary);margin:8px 0 4px">题库明细</div><table style="font-size:11px"><thead><tr><th style="text-align:left;padding:4px 6px">题库</th><th style="text-align:right;padding:4px 6px">答题</th><th style="text-align:right;padding:4px 6px">正确</th><th style="text-align:right;padding:4px 6px">正确率</th><th style="text-align:right;padding:4px 6px">时长</th></tr></thead><tbody>${d.stats.map(s=>{const a=s.answered>0?Math.round(s.correct/s.answered*100):0;return`<tr><td style="padding:4px 6px">${Utils.escapeHtml(s.bank_name||s.bank_id)}</td><td style="text-align:right;padding:4px 6px">${s.answered}</td><td style="text-align:right;padding:4px 6px">${s.correct}</td><td style="text-align:right;padding:4px 6px">${a}%</td><td style="text-align:right;padding:4px 6px">${this.fmtDur(s.duration)}</td></tr>`}).join('')}</tbody></table>`:''}
                <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
                    <button class="abtn primary" onclick="Admin.editUser('${jsu}','${jsn}',${u.is_admin?1:0})">编辑信息</button>
                    <button class="abtn primary" onclick="Admin.changeSyncCode('${jsu}','${jsn}')">修改同步码</button>
                    <button class="abtn primary" onclick="Admin.adjustStats('${jsu}','${jsn}')">调整数据</button>
                    <button class="abtn primary" onclick="Admin.viewCloudData('${jsu}')">查看云端数据</button>
                    ${u.id!==API.getSyncCode()?`<button class="abtn ${u.banned?'':'warn'}" onclick="Admin.banUser('${jsu}','${jsn}',${u.banned?0:1})">${u.banned?'解封':'封禁'}</button>`:''}
                    ${!u.is_admin?`<button class="abtn danger" onclick="Admin.resetStats('${jsu}','${jsn}')">重置数据</button><button class="abtn danger" onclick="Admin.delUser('${jsu}','${jsn}')">删除用户</button>`:''}
                </div>
            `;
        } catch (e) { p.classList.add('show'); p.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`; }
    },

    // ==================== 编辑 ====================

    editUser(uid, name, admin) {
        const hn = Utils.escapeHtml(name);
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box">
                    <h3>编辑 ${hn}</h3>
                    <label>姓名首字母</label><input id="eu-initials" value="${hn}" maxlength="4" style="text-transform:uppercase">
                    <label>管理员</label><select id="eu-admin"><option value="0" ${!admin?'selected':''}>否</option><option value="1" ${admin?'selected':''}>是</option></select>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.saveEdit('${uid}')">保存</button></div>
                </div>
            </div>`;
    },

    async saveEdit(uid) {
        const r = await this.post('/api/admin/update-user', { targetUserId: uid, initials: document.getElementById('eu-initials').value.trim(), isAdmin: parseInt(document.getElementById('eu-admin').value) });
        if (!r?.ok) { Utils.showToast(r?.error || '更新失败', 'error'); return; }
        document.querySelector('.modal-mask')?.remove();
        Utils.showToast('已更新', 'success');
        await this.loadAll(); this.renderUsers();
    },

    // ==================== 修改同步码 ====================

    changeSyncCode(uid, name) {
        const hn = Utils.escapeHtml(name);
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box">
                    <h3>修改同步码 - ${hn}</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">当前同步码: <span class="code">${uid}</span></p>
                    <label>新同步码（4-8位）</label><input id="new-sync-code" maxlength="8" style="text-transform:uppercase" placeholder="如: ABCD1234">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.saveSyncCode('${uid}')">确认修改</button></div>
                </div>
            </div>`;
    },

    async saveSyncCode(oldUid) {
        const code = document.getElementById('new-sync-code').value.trim().toUpperCase();
        if (code.length < 4 || code.length > 8) { Utils.showToast('同步码需4-8位', 'error'); return; }
        if (!confirm(`确认将同步码从 ${oldUid} 改为 ${code}？用户需要在所有设备重新绑定。`)) return;
        const r = await this.post('/api/admin/change-sync-code', { targetUserId: oldUid, newSyncCode: code });
        if (r?.ok) {
            document.querySelector('.modal-mask')?.remove();
            Utils.showToast('同步码已修改为 ' + r.newCode, 'success', 5000);
            await this.loadAll(); this.renderUsers();
            document.getElementById('detail-panel').classList.remove('show');
        } else {
            Utils.showToast(r?.error || '修改失败', 'error');
        }
    },

    // ==================== 调整数据 ====================

    adjustStats(uid, name) {
        const hn = Utils.escapeHtml(name);
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box">
                    <h3>调整数据 - ${hn}</h3>
                    <label>题库ID</label><input id="adj-bank-id" placeholder="题库ID">
                    <label>题库名称</label><input id="adj-bank-name" placeholder="题库名称（可选）">
                    <label>增加答题数（负数为减少）</label><input id="adj-answered" type="number" value="0">
                    <label>增加正确数</label><input id="adj-correct" type="number" value="0">
                    <label>增加时长（秒）</label><input id="adj-duration" type="number" value="0">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.saveAdjust('${uid}')">确认调整</button></div>
                </div>
            </div>`;
    },

    async saveAdjust(uid) {
        const r = await this.post('/api/admin/adjust-stats', {
            targetUserId: uid,
            bankId: document.getElementById('adj-bank-id').value.trim(),
            bankName: document.getElementById('adj-bank-name').value.trim(),
            answered: parseInt(document.getElementById('adj-answered').value) || 0,
            correct: parseInt(document.getElementById('adj-correct').value) || 0,
            duration: parseInt(document.getElementById('adj-duration').value) || 0
        });
        if (r?.ok) {
            document.querySelector('.modal-mask')?.remove();
            Utils.showToast('数据已调整', 'success');
            await this.loadAll(); this.detail(uid);
        } else {
            Utils.showToast(r?.error || '调整失败', 'error');
        }
    },

    // ==================== 解绑设备 ====================

    async removeDevice(deviceId, uid) {
        if (!confirm(`解绑设备 ${deviceId.slice(0, 12)}...？`)) return;
        const r = await this.post('/api/admin/remove-device', { targetDeviceId: deviceId });
        if (r?.ok) {
            Utils.showToast('设备已解绑', 'success');
            this.detail(uid);
        }
    },

    // ==================== 查看云端数据 ====================

    async viewCloudData(uid) {
        const d = await this.get(`/api/admin/user-cloud-data/${uid}`);
        if (!d?.ok) { Utils.showToast('获取失败', 'error'); return; }

        const settingsStr = Object.keys(d.settings).length ? JSON.stringify(d.settings, null, 2) : '无';
        const progressStr = Object.keys(d.progress).length ? JSON.stringify(d.progress, null, 2) : '无';

        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:600px;max-height:80vh;overflow-y:auto">
                    <h3>云端数据 - ${Utils.escapeHtml(d.user.initials)} (${d.user.id})</h3>
                    <p style="font-size:11px;color:var(--text-tertiary)">最后同步: ${d.user.lastSyncAt || '无'}</p>
                    <label style="margin-top:12px">设置 (Settings)</label>
                    <pre style="background:var(--bg-hover);padding:8px;border-radius:var(--radius);font-size:11px;overflow-x:auto;max-height:200px;overflow-y:auto">${Utils.escapeHtml(settingsStr)}</pre>
                    <label style="margin-top:8px">进度 (Progress)</label>
                    <pre style="background:var(--bg-hover);padding:8px;border-radius:var(--radius);font-size:11px;overflow-x:auto;max-height:200px;overflow-y:auto">${Utils.escapeHtml(progressStr)}</pre>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">关闭</button></div>
                </div>
            </div>`;
    },

    // ==================== 操作 ====================

    async banUser(uid, name, ban) {
        if (!confirm(`${ban?'封禁':'解封'} ${name}？`)) return;
        const r = await this.post('/api/admin/ban-user', { targetUserId: uid, banned: !!ban });
        if (!r?.ok) { Utils.showToast(r?.error || '操作失败', 'error'); return; }
        Utils.showToast(ban?'已封禁':'已解封', 'success');
        await this.loadAll(); this.renderUsers();
    },

    async resetStats(uid, name) {
        if (!confirm(`重置 ${name} 的答题数据？`)) return;
        const r = await this.post('/api/admin/reset-stats', { targetUserId: uid });
        if (r?.ok) { Utils.showToast('已重置', 'success'); await this.loadAll(); this.renderUsers(); }
    },

    async delUser(uid, name) {
        if (!confirm(`永久删除 ${name}？`)) return;
        const r = await this.post('/api/admin/delete-user', { targetUserId: uid });
        if (r?.ok) { Utils.showToast('已删除', 'success'); await this.loadAll(); this.renderUsers(); }
    },

    // ==================== 题库 ====================

    async renderBanks() {
        const el = document.getElementById('sec-banks');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const d = await this.get('/api/banks');
            if (!d?.ok) { el.innerHTML = '<div class="empty-state">加载失败</div>'; return; }
            el.innerHTML = `
                <div id="bank-detail-panel"></div>
                <div class="card">
                    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                        <h3>题库列表</h3>
                        <div style="display:flex;gap:6px">
                            <button class="abtn primary" style="padding:4px 12px" onclick="Admin.uploadBank()">上传题库</button>
                            <button class="abtn primary" style="padding:4px 12px" onclick="Admin.createBank()">新建题库</button>
                        </div>
                    </div>
                    <div class="card-body" style="overflow-x:auto"><table>
                        <thead><tr><th>题库</th><th>题数</th><th>分类</th><th>版本</th><th>更新时间</th><th>操作</th></tr></thead>
                        <tbody>${d.banks.map(b => `
                            <tr>
                                <td><b>${Utils.escapeHtml(b.name)}</b><br><span style="font-size:10px;color:var(--text-tertiary)">${b.id}</span></td>
                                <td>${b.question_count}</td>
                                <td>${Utils.escapeHtml(b.category||'-')}</td>
                                <td>v${b.version}</td>
                                <td style="font-size:11px">${b.updated_at?.slice(0,16)||'-'}</td>
                                <td>
                                    <button class="abtn primary" style="padding:2px 8px;font-size:10px" onclick="Admin.viewBank('${b.id}')">管理</button>
                                    <button class="abtn primary" style="padding:2px 8px;font-size:10px" onclick="Admin.uploadBank('${b.id}')">替换</button>
                                </td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>
                </div>`;
        } catch (e) { el.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`; }
    },

    // 查看/编辑题库详情
    async viewBank(bankId) {
        const p = document.getElementById('bank-detail-panel');
        p.innerHTML = '<div class="loading">加载中...</div>';
        p.scrollIntoView({ behavior: 'smooth' });
        try {
            const d = await this.get(`/api/admin/bank/${bankId}`);
            if (!d?.ok) { p.innerHTML = '<div class="empty-state">加载失败</div>'; return; }
            const b = d.bank;
            const qs = b.questions || [];
            p.innerHTML = `
                <div class="card" style="margin-bottom:12px">
                    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                        <h3>${Utils.escapeHtml(b.name)} <span style="font-size:11px;color:var(--text-tertiary)">${qs.length}题 · v${b.version}</span></h3>
                        <div style="display:flex;gap:6px">
                            <button class="abtn primary" style="padding:4px 12px" onclick="Admin.addQuestion('${bankId}')">添加题目</button>
                            <button class="abtn" style="padding:4px 12px" onclick="Admin.viewBankHistory('${bankId}')">修改历史</button>
                            <button class="abtn" style="padding:4px 12px" onclick="document.getElementById('bank-detail-panel').innerHTML=''">收起</button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div style="margin-bottom:8px;display:flex;gap:6px;align-items:center">
                            <input type="text" id="bank-search" placeholder="搜索题目..." style="flex:1;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:12px;background:var(--bg-card);color:var(--text)" oninput="Admin.filterBankQuestions('${bankId}')">
                            <select id="bank-type-filter" style="padding:4px;border:1px solid var(--border);border-radius:var(--radius);font-size:11px;background:var(--bg-card);color:var(--text)" onchange="Admin.filterBankQuestions('${bankId}')">
                                <option value="">全部题型</option>
                                <option value="single">单选</option>
                                <option value="multi">多选</option>
                                <option value="judge">判断</option>
                                <option value="essay">简答</option>
                            </select>
                        </div>
                        <div id="bank-questions-list" style="max-height:500px;overflow-y:auto">
                            ${this._renderQuestionList(bankId, qs)}
                        </div>
                    </div>
                </div>`;
        } catch (e) { p.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`; }
    },

    _renderQuestionList(bankId, qs) {
        return qs.map((q, i) => `
            <div class="q-item" data-id="${q.id}" data-type="${q.type||''}" style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px;cursor:pointer" onclick="Admin.editQuestion('${bankId}',${q.id})">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                    <div style="flex:1;min-width:0">
                        <span style="color:var(--text-tertiary);font-size:10px">#${q.id}</span>
                        <span style="background:var(--bg-hover);padding:1px 6px;border-radius:10px;font-size:10px;margin-left:4px">${q.type==='single'?'单选':q.type==='multi'?'多选':q.type==='judge'?'判断':q.type==='essay'?'简答':q.type||'?'}</span>
                        <span style="margin-left:4px">${Utils.escapeHtml((q.question||'').slice(0,80))}${(q.question||'').length>80?'...':''}</span>
                    </div>
                    <button class="abtn danger" style="padding:1px 6px;font-size:10px;flex-shrink:0" onclick="event.stopPropagation();Admin.deleteQuestion('${bankId}',${q.id})">删除</button>
                </div>
            </div>
        `).join('');
    },

    async filterBankQuestions(bankId) {
        const search = (document.getElementById('bank-search')?.value || '').toLowerCase();
        const type = document.getElementById('bank-type-filter')?.value || '';
        const d = await this.get(`/api/admin/bank/${bankId}`);
        if (!d?.ok) return;
        let qs = d.bank.questions || [];
        if (type) qs = qs.filter(q => q.type === type);
        if (search) qs = qs.filter(q => (q.question||'').toLowerCase().includes(search));
        document.getElementById('bank-questions-list').innerHTML = this._renderQuestionList(bankId, qs);
    },

    // ==================== 题目编辑器 ====================

    _editorHTML(bankId, q, isNew) {
        const type = q?.type || 'single';
        const answer = q?.answer || '';
        const opts = (q?.options || []).join('\n');
        const diff = q?.difficulty || 1;

        return `
        <div class="qe-tabs">
            <button class="qe-tab active" onclick="Admin._switchEditorTab('edit')" id="qe-tab-edit">编辑</button>
            <button class="qe-tab" onclick="Admin._switchEditorTab('preview')" id="qe-tab-preview">预览</button>
        </div>
        <div class="qe-body">
            <!-- 编辑区 -->
            <div class="qe-panel active" id="qe-panel-edit">
                <div class="qe-row">
                    <div class="qe-field">
                        <label>题型</label>
                        <select id="eq-type" onchange="Admin._onTypeChange()">
                            <option value="single" ${type==='single'?'selected':''}>单选题</option>
                            <option value="multi" ${type==='multi'?'selected':''}>多选题</option>
                            <option value="judge" ${type==='judge'?'selected':''}>判断题</option>
                            <option value="essay" ${type==='essay'?'selected':''}>简答题</option>
                        </select>
                    </div>
                    <div class="qe-field">
                        <label>难度</label>
                        <div class="qe-stars" id="eq-diff-stars">
                            ${[1,2,3].map(i => `<span class="qe-star ${i<=diff?'on':''}" onclick="Admin._setDiff(${i})">★</span>`).join('')}
                        </div>
                        <input type="hidden" id="eq-difficulty" value="${diff}">
                    </div>
                </div>

                <div class="qe-field">
                    <label>分类</label>
                    <input id="eq-category" value="${Utils.escapeHtml(q?.category||'')}" placeholder="如: 编程指令、坐标系">
                </div>

                <div class="qe-field">
                    <label>题目内容</label>
                    <textarea id="eq-question" rows="3" placeholder="输入题目内容..." oninput="Admin._preview()">${Utils.escapeHtml(q?.question||'')}</textarea>
                </div>

                <div class="qe-field" id="eq-options-wrap" ${type==='judge'||type==='essay'?'style=display:none':''}>
                    <label>选项 <span class="qe-hint">每行一个，自动编号</span></label>
                    <textarea id="eq-options" rows="5" placeholder="A. 选项1\nB. 选项2\nC. 选项3\nD. 选项4" oninput="Admin._preview()">${Utils.escapeHtml(opts)}</textarea>
                </div>

                <div class="qe-field" id="eq-answer-section">
                    <label>答案</label>
                    <div class="qe-answer-btns" id="eq-answer-btns" ${type==='judge'||type==='essay'?'style=display:none':''}>
                        ${'ABCDEFGH'.split('').map(l => `<button type="button" class="qe-ans-btn ${(answer+'').includes(l)?'active':''}" onclick="Admin._toggleAnswer('${l}')" id="eq-ans-${l}">${l}</button>`).join('')}
                    </div>
                    <div class="qe-judge-btns" id="eq-judge-wrap" ${type==='judge'?'':'style=display:none'}>
                        <button type="button" class="qe-judge-btn ${answer===true?'active':''}" onclick="Admin._setJudge(true)" id="eq-judge-true">✓ 正确</button>
                        <button type="button" class="qe-judge-btn ${answer===false?'active':''}" onclick="Admin._setJudge(false)" id="eq-judge-false">✗ 错误</button>
                    </div>
                    <input type="hidden" id="eq-answer" value="${Utils.escapeHtml(String(answer))}">
                </div>

                <div class="qe-field">
                    <label>解析 <span class="qe-hint">可选</span></label>
                    <textarea id="eq-explanation" rows="3" placeholder="答案解析..." oninput="Admin._preview()">${Utils.escapeHtml(q?.explanation||'')}</textarea>
                </div>
            </div>

            <!-- 预览区 -->
            <div class="qe-panel" id="qe-panel-preview">
                <div id="eq-preview"></div>
            </div>
        </div>
        <div class="qe-footer">
            <span class="qe-info">${isNew ? '新题目' : 'ID: ' + q.id}</span>
            <div class="qe-actions">
                <button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button>
                <button class="mp" onclick="${isNew ? `Admin.saveNewQuestion('${bankId}')` : `Admin.saveEditQuestion('${bankId}',${q.id})`}">${isNew ? '添加' : '保存'}</button>
            </div>
        </div>`;
    },

    addQuestion(bankId) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="qe-modal">
                    <div class="qe-header">
                        <h3>添加题目</h3>
                        <button class="close-btn" onclick="this.closest('.modal-mask').remove()">✕</button>
                    </div>
                    ${this._editorHTML(bankId, null, true)}
                </div>
            </div>`;
        this._preview();
    },


    async saveNewQuestion(bankId) {
        const question = this._collectQuestion();
        if (!question) return;

        const r = await this.post(`/api/admin/bank/${bankId}/question`, { question });
        if (r?.ok) {
            Utils.showToast('已添加', 'success');
            document.querySelector('.modal-mask')?.remove();
            this.viewBank(bankId);
        } else {
            Utils.showToast(r?.error || '添加失败', 'error');
        }
    },

    async saveEditQuestion(bankId, qid) {
        const question = this._collectQuestion();
        if (!question) return;

        const r = await this.put(`/api/admin/bank/${bankId}/question/${qid}`, { question });
        if (r?.ok) {
            Utils.showToast('已保存', 'success');
            document.querySelector('.modal-mask')?.remove();
            this.viewBank(bankId);
        } else {
            Utils.showToast(r?.error || '保存失败', 'error');
        }
    },

    _collectQuestion() {
        const type = document.getElementById('eq-type').value;
        const optionsRaw = document.getElementById('eq-options').value.trim();
        const options = optionsRaw ? optionsRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];
        let answer = document.getElementById('eq-answer').value;
        if (type === 'judge') answer = answer === 'true' || answer === true;

        const question = {
            type,
            category: document.getElementById('eq-category').value.trim(),
            difficulty: parseInt(document.getElementById('eq-difficulty').value) || 1,
            question: document.getElementById('eq-question').value.trim(),
            options,
            answer,
            explanation: document.getElementById('eq-explanation').value.trim()
        };

        if (!question.question) { Utils.showToast('题目内容不能为空', 'error'); return null; }
        return question;
    },

    _setDiff(n) {
        document.getElementById('eq-difficulty').value = n;
        document.querySelectorAll('#eq-diff-stars .qe-star').forEach((s, i) => {
            s.className = i < n ? 'qe-star on' : 'qe-star';
        });
        this._preview();
    },

    _onTypeChange() {
        const type = document.getElementById('eq-type').value;
        document.getElementById('eq-options-wrap').style.display = type === 'judge' || type === 'essay' ? 'none' : '';
        document.getElementById('eq-answer-btns').style.display = type === 'judge' || type === 'essay' ? 'none' : '';
        document.getElementById('eq-judge-wrap').style.display = type === 'judge' ? 'flex' : 'none';
        this._preview();
    },

    _toggleAnswer(letter) {
        const type = document.getElementById('eq-type').value;
        const ansEl = document.getElementById('eq-answer');
        let ans = ansEl.value;
        if (type === 'single') {
            ans = letter;
        } else {
            ans = ans.includes(letter) ? ans.replace(letter, '') : (ans + letter);
        }
        ansEl.value = ans;
        'ABCDEFGH'.split('').forEach(l => {
            const btn = document.getElementById('eq-ans-' + l);
            if (btn) btn.className = ans.includes(l) ? 'qe-ans-btn active' : 'qe-ans-btn';
        });
        this._preview();
    },

    _setJudge(val) {
        document.getElementById('eq-answer').value = val;
        document.getElementById('eq-judge-true').className = val === true ? 'qe-judge-btn active' : 'qe-judge-btn';
        document.getElementById('eq-judge-false').className = val === false ? 'qe-judge-btn active' : 'qe-judge-btn';
        this._preview();
    },

    _preview() {
        const el = document.getElementById('eq-preview');
        if (!el) return;
        const type = document.getElementById('eq-type').value;
        const question = document.getElementById('eq-question').value;
        const options = document.getElementById('eq-options').value.split('\n').filter(Boolean);
        const answer = document.getElementById('eq-answer').value;
        const explanation = document.getElementById('eq-explanation').value;
        const difficulty = parseInt(document.getElementById('eq-difficulty').value) || 1;
        const category = document.getElementById('eq-category').value;
        const typeLabel = {single:'单选',multi:'多选',judge:'判断',essay:'简答'}[type] || type;

        let html = '<div class="qe-preview-card">';
        html += '<div class="qe-preview-meta">';
        if (category) html += `<span class="qe-preview-tag">${Utils.escapeHtml(category)}</span>`;
        html += `<span class="qe-preview-tag type">${typeLabel}</span>`;
        html += `<span class="qe-preview-tag">${'★'.repeat(difficulty)}${'☆'.repeat(3-difficulty)}</span>`;
        html += '</div>';
        html += `<div class="qe-preview-question">${Utils.escapeHtml(question) || '<span style="color:var(--text-tertiary)">题目内容...</span>'}</div>`;

        if (type === 'judge') {
            html += '<div style="display:flex;gap:8px;margin-bottom:8px">';
            html += `<div class="qe-preview-opt ${answer===true?'selected':''}">✓ 正确</div>`;
            html += `<div class="qe-preview-opt ${answer===false?'selected':''}">✗ 错误</div>`;
            html += '</div>';
        } else if (type !== 'essay') {
            options.forEach((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                const sel = (answer||'').includes(letter);
                html += `<div class="qe-preview-opt ${sel?'selected':''}">${Utils.escapeHtml(opt)}</div>`;
            });
        }

        if (answer && type !== 'judge') {
            html += `<div class="qe-preview-answer">答案: <b>${Utils.escapeHtml(String(answer))}</b></div>`;
        }

        if (explanation) {
            html += '<div class="qe-preview-explain">';
            html += '<div class="qe-preview-explain-label">解析</div>';
            html += `<div class="qe-preview-explain-text">${Utils.escapeHtml(explanation)}</div>`;
            html += '</div>';
        }

        html += '</div>';
        el.innerHTML = html;
    }
};

