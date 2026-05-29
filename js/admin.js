/**
 * 管理后台模块
 */
import API from './api.js';
import Utils from './utils.js';

const Admin = {
    users: [],
    password: sessionStorage.getItem('admin_pwd') || '',
    sort: 'time',
    tab: 'overview',

    // ==================== 初始化 ====================

    async init() {
        document.getElementById('btn-login').addEventListener('click', () => this.login());
        document.getElementById('admin-password').addEventListener('keydown', e => {
            if (e.key === 'Enter') this.login();
        });
        if (this.password) await this.loadAll();
    },

    // ==================== 登录/退出 ====================

    async login() {
        const pwd = document.getElementById('admin-password').value.trim();
        if (!pwd) return;
        const err = document.getElementById('login-error');
        err.style.display = 'none';

        try {
            const r = await fetch(`${API.BASE_URL}/api/admin/users?deviceId=${API.getDeviceId()}&password=${encodeURIComponent(pwd)}`);
            const d = await r.json();
            if (d.ok) {
                sessionStorage.setItem('admin_pwd', pwd);
                this.password = pwd;
                this.users = d.users;
                this.showApp();
                await this.loadAll();
            } else {
                err.textContent = d.error || '密码错误';
                err.style.display = 'block';
            }
        } catch (e) {
            err.textContent = '网络错误: ' + e.message;
            err.style.display = 'block';
        }
    },

    logout() {
        sessionStorage.removeItem('admin_pwd');
        location.reload();
    },

    // ==================== 数据加载 ====================

    async loadAll() {
        try {
            const r = await fetch(`${API.BASE_URL}/api/admin/users?deviceId=${API.getDeviceId()}&password=${encodeURIComponent(this.password)}`);
            const d = await r.json();
            if (!d.ok) { sessionStorage.removeItem('admin_pwd'); location.reload(); return; }
            this.users = d.users;
            this.showApp();
        } catch {
            sessionStorage.removeItem('admin_pwd');
            location.reload();
        }
    },

    showApp() {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('admin-app').style.display = '';
        this.renderTab();
    },

    // ==================== Tab 切换 ====================

    switchTab(t) {
        this.tab = t;
        document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === t));
        this.renderTab();
    },

    async renderTab() {
        const handlers = {
            overview: () => this.renderOverview(),
            users: () => this.renderUsers(),
            banks: () => this.renderBanks(),
            activity: () => this.renderActivity(),
            announce: () => this.renderAnnounce()
        };
        if (handlers[this.tab]) await handlers[this.tab]();
    },

    // ==================== 总览 ====================

    async renderOverview() {
        const el = document.getElementById('sec-overview');
        el.innerHTML = '<div class="loading">加载中...</div>';

        try {
            const r = await fetch(`${API.BASE_URL}/api/admin/overview?deviceId=${API.getDeviceId()}&password=${encodeURIComponent(this.password)}`);
            const d = await r.json();
            if (!d.ok) { el.innerHTML = '<div class="empty-state"><div class="ei">⚠️</div>加载失败</div>'; return; }

            const o = d.overview;
            const total = this.users.reduce((s, u) => s + u.total_answered, 0);
            const dur = this.users.reduce((s, u) => s + u.total_duration, 0);
            const acc = total > 0 ? Math.round(this.users.reduce((s, u) => s + u.total_correct, 0) / total * 100) : 0;

            const maxCnt = Math.max(...o.weekTrend.map(w => w.cnt), 1);
            const trendHtml = o.weekTrend.map(w =>
                `<div class="trend-bar" style="height:${Math.max(w.cnt / maxCnt * 80, 4)}px">
                    <span class="trend-value">${w.cnt}</span>
                    <span class="trend-label">${w.day.slice(5)}</span>
                </div>`
            ).join('');

            el.innerHTML = `
                <div class="stat-grid">
                    <div class="stat-card"><div class="si purple">👥</div><div class="sv">${this.users.length}</div><div class="sl">注册用户</div></div>
                    <div class="stat-card"><div class="si blue">📊</div><div class="sv">${this.fmtN(total)}</div><div class="sl">总答题数</div></div>
                    <div class="stat-card"><div class="si green">🎯</div><div class="sv">${acc}%</div><div class="sl">平均正确率</div></div>
                    <div class="stat-card"><div class="si orange">⏱</div><div class="sv">${this.fmtDur(dur)}</div><div class="sl">总学习时长</div></div>
                </div>
                <div class="stat-grid">
                    <div class="stat-card"><div class="si blue">📅</div><div class="sv">${o.todayReg}</div><div class="sl">今日注册</div></div>
                    <div class="stat-card"><div class="si green">🔥</div><div class="sv">${o.todayActive}</div><div class="sl">今日活跃</div></div>
                    <div class="stat-card"><div class="si purple">📚</div><div class="sv">${o.bankCount}</div><div class="sl">题库总数</div></div>
                    <div class="stat-card"><div class="si red">🚫</div><div class="sv">${o.bannedCount}</div><div class="sl">封禁用户</div></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>📈 近7天注册趋势</h3></div>
                    <div class="trend-chart">${trendHtml || '<div style="padding:20px;color:#aaa;text-align:center">暂无数据</div>'}</div>
                </div>
            `;
        } catch (e) {
            el.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`;
        }
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
                <div class="search-box">
                    <span class="ic">🔍</span>
                    <input type="text" id="search-input" placeholder="搜索同步码或姓名..." value="${q || ''}">
                </div>
                <button class="fbtn ${this.sort === 'time' ? 'active' : ''}" onclick="Admin.setSort('time')">注册时间</button>
                <button class="fbtn ${this.sort === 'answered' ? 'active' : ''}" onclick="Admin.setSort('answered')">答题数</button>
                <button class="fbtn ${this.sort === 'duration' ? 'active' : ''}" onclick="Admin.setSort('duration')">时长</button>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3>用户列表</h3>
                    <span style="color:#888;font-size:13px">${list.length}/${this.users.length}人</span>
                </div>
                <div class="card-body" style="overflow-x:auto">
                    <table>
                        <thead><tr>
                            <th>同步码</th><th>姓名</th><th>设备</th><th>答题</th>
                            <th>正确率</th><th>时长</th><th>注册</th><th>状态</th><th>操作</th>
                        </tr></thead>
                        <tbody>${list.map(u => this._userRow(u, myId)).join('')}</tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('search-input')?.addEventListener('input', () => this.renderUsers());
    },

    _userRow(u, myId) {
        const acc = u.total_answered > 0 ? Math.round(u.total_correct / u.total_answered * 100) : 0;
        const c = acc >= 80 ? '#22c55e' : acc >= 60 ? '#f59e0b' : '#ef4444';
        const name = Utils.escapeHtml(u.initials);

        return `<tr>
            <td><span class="code">${u.id}</span></td>
            <td>${name} ${u.is_admin ? '<span class="badge b-admin">管理员</span>' : ''} ${u.id === myId ? '<span class="badge b-me">我</span>' : ''}</td>
            <td>${u.device_count}</td>
            <td><b>${u.total_answered}</b></td>
            <td><div class="acc-bar"><span>${acc}%</span><div class="bar"><div class="fill" style="width:${acc}%;background:${c}"></div></div></div></td>
            <td>${this.fmtDur(u.total_duration)}</td>
            <td>${u.created_at?.slice(0, 10) || '-'}</td>
            <td>${u.banned ? '<span class="badge b-ban">封禁</span>' : '<span style="color:#22c55e;font-size:12px">正常</span>'}</td>
            <td style="white-space:nowrap">
                <button class="abtn primary" onclick="Admin.detail('${u.id}')">详情</button>
                <button class="abtn" onclick="Admin.editUser('${u.id}','${name}',${u.is_admin ? 1 : 0})">编辑</button>
                ${u.id !== myId ? `<button class="abtn ${u.banned ? '' : 'warn'}" onclick="Admin.banUser('${u.id}','${name}',${u.banned ? 0 : 1})">${u.banned ? '解封' : '封禁'}</button>` : ''}
                ${!u.is_admin && u.id !== myId ? `<button class="abtn danger" onclick="Admin.resetStats('${u.id}','${name}')">重置</button><button class="abtn danger" onclick="Admin.delUser('${u.id}','${name}')">删除</button>` : ''}
            </td>
        </tr>`;
    },

    setSort(s) { this.sort = s; this.renderUsers(); },

    // ==================== 用户详情 ====================

    async detail(uid) {
        const p = document.getElementById('detail-panel');
        try {
            const r = await fetch(`${API.BASE_URL}/api/admin/user-detail/${uid}?deviceId=${API.getDeviceId()}&password=${encodeURIComponent(this.password)}`);
            const d = await r.json();
            if (!d?.ok) return;

            const u = d.user;
            const ta = d.stats.reduce((s, x) => s + x.answered, 0);
            const tc = d.stats.reduce((s, x) => s + x.correct, 0);
            const td = d.stats.reduce((s, x) => s + x.duration, 0);

            p.classList.add('show');
            p.innerHTML = `
                <div class="dh">
                    <h3>${Utils.escapeHtml(u.initials)} <span class="code">${u.id}</span>
                        ${u.is_admin ? '<span class="badge b-admin">管理员</span>' : ''}
                        ${u.banned ? '<span class="badge b-ban">已封禁</span>' : ''}
                    </h3>
                    <button class="close-btn" onclick="this.closest('.detail').classList.remove('show')">✕</button>
                </div>
                <div class="d-grid">
                    <div class="d-item"><div class="dl">注册时间</div><div class="dv">${u.created_at?.slice(0, 16) || '-'}</div></div>
                    <div class="d-item"><div class="dl">绑定设备</div><div class="dv">${d.devices.length} 台</div></div>
                    <div class="d-item"><div class="dl">总答题</div><div class="dv">${ta} 题</div></div>
                    <div class="d-item"><div class="dl">正确率</div><div class="dv">${ta > 0 ? Math.round(tc / ta * 100) : 0}%</div></div>
                    <div class="d-item"><div class="dl">总时长</div><div class="dv">${this.fmtDur(td)}</div></div>
                    <div class="d-item"><div class="dl">题库数</div><div class="dv">${d.stats.length}</div></div>
                </div>
                ${d.devices.length ? `
                    <h4 style="font-size:13px;color:#888;margin:12px 0 6px">📱 设备</h4>
                    ${d.devices.map(x => `<div style="display:flex;gap:8px;padding:6px 10px;background:#f9fafb;border-radius:8px;margin-bottom:4px;font-size:12px">
                        <code style="color:#888">${x.device_id}</code>
                        <span style="color:#aaa">${x.bound_at?.slice(0, 10) || ''}</span>
                    </div>`).join('')}
                ` : ''}
                ${d.stats.length ? `
                    <h4 style="font-size:13px;color:#888;margin:12px 0 6px">📊 题库明细</h4>
                    <table style="font-size:12px">
                        <thead><tr><th style="text-align:left;padding:6px">题库</th><th style="text-align:right;padding:6px">答题</th><th style="text-align:right;padding:6px">正确</th><th style="text-align:right;padding:6px">正确率</th><th style="text-align:right;padding:6px">时长</th></tr></thead>
                        <tbody>${d.stats.map(s => {
                            const a = s.answered > 0 ? Math.round(s.correct / s.answered * 100) : 0;
                            return `<tr>
                                <td style="padding:6px">${Utils.escapeHtml(s.bank_name || s.bank_id)}</td>
                                <td style="text-align:right;padding:6px">${s.answered}</td>
                                <td style="text-align:right;padding:6px">${s.correct}</td>
                                <td style="text-align:right;padding:6px">${a}%</td>
                                <td style="text-align:right;padding:6px">${this.fmtDur(s.duration)}</td>
                            </tr>`;
                        }).join('')}</tbody>
                    </table>
                ` : ''}
            `;
        } catch (e) {
            p.classList.add('show');
            p.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`;
        }
    },

    // ==================== 用户编辑 ====================

    editUser(uid, name, admin) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box">
                    <h3>编辑用户 ${name}</h3>
                    <label>姓名首字母</label>
                    <input id="eu-initials" value="${name}" maxlength="4" style="text-transform:uppercase">
                    <label>管理员</label>
                    <select id="eu-admin">
                        <option value="0" ${!admin ? 'selected' : ''}>否</option>
                        <option value="1" ${admin ? 'selected' : ''}>是</option>
                    </select>
                    <div class="modal-actions">
                        <button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button>
                        <button class="mp" onclick="Admin.saveEdit('${uid}')">保存</button>
                    </div>
                </div>
            </div>
        `;
    },

    async saveEdit(uid) {
        const initials = document.getElementById('eu-initials').value.trim();
        const isAdmin = parseInt(document.getElementById('eu-admin').value);
        await this.post('/api/admin/update-user', { targetUserId: uid, initials, isAdmin });
        document.querySelector('.modal-mask')?.remove();
        Utils.showToast('已更新', 'success');
        await this.loadAll();
        this.renderUsers();
    },

    // ==================== 封禁/重置/删除 ====================

    async banUser(uid, name, ban) {
        if (!confirm(`确定${ban ? '封禁' : '解封'} ${name}？`)) return;
        await this.post('/api/admin/ban-user', { targetUserId: uid, banned: !!ban });
        Utils.showToast(ban ? '已封禁' : '已解封', 'success');
        await this.loadAll();
        this.renderUsers();
    },

    async resetStats(uid, name) {
        if (!confirm(`确定重置 ${name} 的答题数据？`)) return;
        const r = await this.post('/api/admin/reset-stats', { targetUserId: uid });
        if (r?.ok) { Utils.showToast('已重置', 'success'); await this.loadAll(); this.renderUsers(); }
    },

    async delUser(uid, name) {
        if (!confirm(`确定永久删除 ${name}？不可恢复！`)) return;
        const r = await this.post('/api/admin/delete-user', { targetUserId: uid });
        if (r?.ok) { Utils.showToast('已删除', 'success'); await this.loadAll(); this.renderUsers(); }
    },

    // ==================== 题库统计 ====================

    async renderBanks() {
        const el = document.getElementById('sec-banks');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const r = await fetch(`${API.BASE_URL}/api/admin/banks?deviceId=${API.getDeviceId()}&password=${encodeURIComponent(this.password)}`);
            const d = await r.json();
            if (!d.ok) { el.innerHTML = '<div class="empty-state">加载失败</div>'; return; }

            el.innerHTML = d.banks.length === 0
                ? '<div class="empty-state"><div class="ei">📚</div>暂无题库数据</div>'
                : `<div class="card">
                    <div class="card-header"><h3>题库统计</h3><span style="color:#888;font-size:13px">${d.banks.length} 个题库</span></div>
                    <div class="card-body" style="overflow-x:auto">
                        <table>
                            <thead><tr><th>题库</th><th>使用人数</th><th>总答题</th><th>正确率</th><th>总时长</th></tr></thead>
                            <tbody>${d.banks.map(b => {
                                const acc = b.total_answered > 0 ? Math.round(b.total_correct / b.total_answered * 100) : 0;
                                return `<tr>
                                    <td><b>${Utils.escapeHtml(b.bank_name || b.bank_id)}</b></td>
                                    <td>${b.user_count}</td>
                                    <td>${b.total_answered}</td>
                                    <td>${acc}%</td>
                                    <td>${this.fmtDur(b.total_duration)}</td>
                                </tr>`;
                            }).join('')}</tbody>
                        </table>
                    </div>
                </div>`;
        } catch (e) {
            el.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`;
        }
    },

    // ==================== 活跃记录 ====================

    async renderActivity() {
        const el = document.getElementById('sec-activity');
        el.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const r = await fetch(`${API.BASE_URL}/api/admin/activity?deviceId=${API.getDeviceId()}&password=${encodeURIComponent(this.password)}`);
            const d = await r.json();
            if (!d.ok) { el.innerHTML = '<div class="empty-state">加载失败</div>'; return; }

            el.innerHTML = d.activity.length === 0
                ? '<div class="empty-state"><div class="ei">⚡</div>暂无活跃记录</div>'
                : `<div class="card">
                    <div class="card-header"><h3>最近活跃</h3><span style="color:#888;font-size:13px">最近50条</span></div>
                    <div class="timeline">${d.activity.map(a => `
                        <div class="tl-item">
                            <div class="tl-dot"></div>
                            <div class="tl-body">
                                <div class="tl-title"><b>${Utils.escapeHtml(a.initials)}</b> (${a.bank_name || '未知题库'}) · 答题${a.answered}道 · 正确${a.correct}道</div>
                                <div class="tl-sub">${this.fmtDur(a.duration)} · ${a.updated_at?.slice(0, 16) || '-'}</div>
                            </div>
                        </div>
                    `).join('')}</div>
                </div>`;
        } catch (e) {
            el.innerHTML = `<div class="empty-state">加载失败: ${e.message}</div>`;
        }
    },

    // ==================== 公告 ====================

    renderAnnounce() {
        document.getElementById('sec-announce').innerHTML = `
            <div class="card">
                <div class="card-header"><h3>发布公告</h3></div>
                <div class="card-body padded">
                    <p style="color:#888;font-size:13px;margin-bottom:12px">公告会在用户打开网站时弹出显示（每次登录显示一次）</p>
                    <div class="announce-input">
                        <textarea id="announce-content" placeholder="输入公告内容..."></textarea>
                    </div>
                    <button class="btn-login" style="max-width:200px" onclick="Admin.publishAnnounce()">📢 发布公告</button>
                </div>
            </div>
        `;
    },

    async publishAnnounce() {
        const content = document.getElementById('announce-content').value.trim();
        if (!content) { Utils.showToast('请输入公告内容', 'error'); return; }
        const r = await this.post('/api/admin/announce', { content });
        if (r?.ok) {
            Utils.showToast('公告已发布', 'success');
            document.getElementById('announce-content').value = '';
        }
    },

    // ==================== 导出 ====================

    exportCSV() {
        const csv = ['同步码,姓名,设备数,答题数,正确数,正确率,时长(秒),注册时间,状态'];
        this.users.forEach(u => {
            const acc = u.total_answered > 0 ? Math.round(u.total_correct / u.total_answered * 100) : 0;
            csv.push(`${u.id},${u.initials},${u.device_count},${u.total_answered},${u.total_correct},${acc}%,${u.total_duration},${u.created_at?.slice(0, 10) || ''},${u.banned ? '封禁' : '正常'}`);
        });
        const blob = new Blob(['\ufeff' + csv.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `城科卷王_数据_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    },

    // ==================== 工具函数 ====================

    async post(path, body) {
        try {
            const r = await fetch(API.BASE_URL + path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: API.getDeviceId(), password: this.password, ...body })
            });
            return await r.json();
        } catch { return null; }
    },

    fmtN(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n; },
    fmtDur(s) {
        if (!s || s < 60) return (s || 0) + '秒';
        if (s < 3600) return Math.floor(s / 60) + '分';
        return Math.floor(s / 3600) + '时' + Math.floor((s % 3600) / 60) + '分';
    }
};

window.Admin = Admin;
Admin.init();
