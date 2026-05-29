/**
 * 管理后台 - 用户管理
 */
import API from '../api.js';
import Utils from '../utils.js';

export function initUsers(Admin) {

    Admin.renderUsers = function() {
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
    };

    Admin._userRow = function(u, myId) {
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
    };

    Admin.setSort = function(s) { this.sort = s; this.renderUsers(); };

    Admin.detail = async function(uid) {
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
                ${d.devices.length?`<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px">设备列表</div>${d.devices.map(x=>{const jsd=Utils.jsSafe(x.device_id);return `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:var(--bg-hover);border-radius:4px;margin-bottom:3px;font-size:11px"><code style="color:var(--text-tertiary);flex:1;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(x.device_id)}</code><span style="color:var(--text-tertiary)">${x.bound_at?.slice(0,10)||''}</span><button class="abtn danger" style="padding:1px 6px;font-size:10px" onclick="Admin.removeDevice('${jsd}','${jsu}')">解绑</button></div>`;}).join('')}`:''}
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
    };

    Admin.editUser = function(uid, name, admin) {
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
    };

    Admin.saveEdit = async function(uid) {
        const r = await this.post('/api/admin/update-user', { targetUserId: uid, initials: document.getElementById('eu-initials').value.trim(), isAdmin: parseInt(document.getElementById('eu-admin').value) });
        if (!r?.ok) { Utils.showToast(r?.error || '更新失败', 'error'); return; }
        document.querySelector('.modal-mask')?.remove();
        Utils.showToast('已更新', 'success');
        await this.loadAll(); this.renderUsers();
    };

    Admin.changeSyncCode = function(uid, name) {
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
    };

    Admin.saveSyncCode = async function(oldUid) {
        const code = document.getElementById('new-sync-code').value.trim().toUpperCase();
        if (code.length < 4 || code.length > 8) { Utils.showToast('同步码需4-8位', 'error'); return; }
        if (!confirm(`确认将同步码从 ${oldUid} 改为 ${code}？`)) return;
        const r = await this.post('/api/admin/change-sync-code', { targetUserId: oldUid, newSyncCode: code });
        if (r?.ok) {
            document.querySelector('.modal-mask')?.remove();
            Utils.showToast('同步码已修改为 ' + r.newCode, 'success', 5000);
            await this.loadAll(); this.renderUsers();
            document.getElementById('detail-panel').classList.remove('show');
        } else { Utils.showToast(r?.error || '修改失败', 'error'); }
    };

    Admin.adjustStats = function(uid, name) {
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
    };

    Admin.saveAdjust = async function(uid) {
        const r = await this.post('/api/admin/adjust-stats', {
            targetUserId: uid,
            bankId: document.getElementById('adj-bank-id').value.trim(),
            bankName: document.getElementById('adj-bank-name').value.trim(),
            answered: parseInt(document.getElementById('adj-answered').value) || 0,
            correct: parseInt(document.getElementById('adj-correct').value) || 0,
            duration: parseInt(document.getElementById('adj-duration').value) || 0
        });
        if (r?.ok) { document.querySelector('.modal-mask')?.remove(); Utils.showToast('数据已调整', 'success'); await this.loadAll(); this.detail(uid); }
        else { Utils.showToast(r?.error || '调整失败', 'error'); }
    };

    Admin.removeDevice = async function(deviceId, uid) {
        if (!confirm(`解绑设备 ${deviceId.slice(0, 12)}...？`)) return;
        const r = await this.post('/api/admin/remove-device', { targetDeviceId: deviceId });
        if (r?.ok) { Utils.showToast('设备已解绑', 'success'); this.detail(uid); }
    };

    Admin.viewCloudData = async function(uid) {
        const d = await this.get(`/api/admin/user-cloud-data/${uid}`);
        if (!d?.ok) { Utils.showToast('获取失败', 'error'); return; }
        const ss = Object.keys(d.settings).length ? JSON.stringify(d.settings, null, 2) : '无';
        const ps = Object.keys(d.progress).length ? JSON.stringify(d.progress, null, 2) : '无';
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:600px;max-height:80vh;overflow-y:auto">
                    <h3>云端数据 - ${Utils.escapeHtml(d.user.initials)} (${d.user.id})</h3>
                    <p style="font-size:11px;color:var(--text-tertiary)">最后同步: ${d.user.lastSyncAt || '无'}</p>
                    <label style="margin-top:12px">设置</label>
                    <pre style="background:var(--bg-hover);padding:8px;border-radius:var(--radius);font-size:11px;overflow-x:auto;max-height:200px;overflow-y:auto">${Utils.escapeHtml(ss)}</pre>
                    <label style="margin-top:8px">进度</label>
                    <pre style="background:var(--bg-hover);padding:8px;border-radius:var(--radius);font-size:11px;overflow-x:auto;max-height:200px;overflow-y:auto">${Utils.escapeHtml(ps)}</pre>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">关闭</button></div>
                </div>
            </div>`;
    };

    Admin.banUser = async function(uid, name, ban) {
        if (!confirm(`${ban?'封禁':'解封'} ${name}？`)) return;
        const r = await this.post('/api/admin/ban-user', { targetUserId: uid, banned: !!ban });
        if (!r?.ok) { Utils.showToast(r?.error || '操作失败', 'error'); return; }
        Utils.showToast(ban?'已封禁':'已解封', 'success');
        await this.loadAll(); this.renderUsers();
    };

    Admin.resetStats = async function(uid, name) {
        if (!confirm(`重置 ${name} 的答题数据？`)) return;
        const r = await this.post('/api/admin/reset-stats', { targetUserId: uid });
        if (r?.ok) { Utils.showToast('已重置', 'success'); await this.loadAll(); this.renderUsers(); }
    };

    Admin.delUser = async function(uid, name) {
        if (!confirm(`永久删除 ${name}？`)) return;
        const r = await this.post('/api/admin/delete-user', { targetUserId: uid });
        if (r?.ok) { Utils.showToast('已删除', 'success'); await this.loadAll(); this.renderUsers(); }
    };

    Admin.exportCSV = function() {
        const rows = [['同步码', '姓名', '管理员', '注册时间', '设备数', '答题数', '正确数', '正确率', '学习时长(秒)']];
        this.users.forEach(u => {
            const acc = u.total_answered > 0 ? Math.round(u.total_correct / u.total_answered * 100) : 0;
            rows.push([u.id, u.initials, u.is_admin ? '是' : '否', u.created_at?.slice(0,10) || '', u.device_count, u.total_answered, u.total_correct, acc + '%', u.total_duration]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `用户数据_${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
        Utils.showToast('已导出', 'success');
    };
}
