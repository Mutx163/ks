/**
 * 管理后台 - 用户管理（二级页面版）
 */
import API from './api.js';
import Utils from './utils.js';

export function initUsers(Admin) {

    // ==================== 用户列表页 ====================
    Admin.renderUsers = function() {
        const el = document.getElementById('sec-users');
        const q = (document.getElementById('search-input')?.value || '').toUpperCase();
        let list = this.users.filter(u => !q || u.id.includes(q) || u.initials.toUpperCase().includes(q));
        if (this.sort === 'answered') list.sort((a, b) => b.total_answered - a.total_answered);
        else if (this.sort === 'duration') list.sort((a, b) => b.total_duration - a.total_duration);
        const myId = API.getSyncCode();

        el.innerHTML = `
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
        return `<tr style="cursor:pointer" onclick="Admin.showUserDetail('${jsu}')">
            <td><span class="code">${u.id}</span></td>
            <td>${n}${u.is_admin ? ' <span class="badge b-admin">管理</span>' : ''}${u.id === myId ? ' <span class="badge b-me">我</span>' : ''}</td>
            <td>${u.device_count}</td>
            <td><b>${u.total_answered}</b></td>
            <td><div class="acc-bar"><span>${acc}%</span><div class="bar"><div class="fill" style="width:${acc}%;background:${c}"></div></div></div></td>
            <td>${this.fmtDur(u.total_duration)}</td>
            <td>${Admin.fmtDate(u.created_at) || '-'}</td>
            <td>${u.banned ? '<span class="badge b-ban">封禁</span>' : '<span style="color:#22c55e">正常</span>'}</td>
            <td style="white-space:nowrap" onclick="event.stopPropagation()">
                ${u.id!==myId?`<button class="abtn ${u.banned?'':'warn'}" onclick="Admin.banUser('${jsu}','${jsn}',${u.banned?0:1})">${u.banned?'解封':'封禁'}</button>`:''}
                ${!u.is_admin&&u.id!==myId?`<button class="abtn danger" onclick="Admin.delUser('${jsu}','${jsn}')">删除</button>`:''}
            </td>
        </tr>`;
    };

    Admin.setSort = function(s) { this.sort = s; this.renderUsers(); };

    // ==================== 用户详情页（二级页面）====================
    Admin.showUserDetail = async function(uid) {
        const el = document.getElementById('sec-users');
        el.innerHTML = '<div class="loading">加载中...</div>';
        
        try {
            const d = await this.get(`/api/admin/user-detail/${uid}`);
            if (!d?.ok) { el.innerHTML = '<div class="empty-state">加载失败</div>'; return; }
            
            const u = d.user;
            const ta = d.stats.reduce((s, x) => s + x.answered, 0);
            const tc = d.stats.reduce((s, x) => s + x.correct, 0);
            const td = d.stats.reduce((s, x) => s + x.duration, 0);
            const n = Utils.escapeHtml(u.initials);
            const jsn = Utils.jsSafe(u.initials);
            const jsu = Utils.jsSafe(u.id);
            const myId = API.getSyncCode();
            
            el.innerHTML = `
                <!-- 返回按钮 -->
                <div style="margin-bottom:16px">
                    <button class="abtn" onclick="Admin.renderUsers()" style="display:flex;align-items:center;gap:6px">
                        ← 返回用户列表
                    </button>
                </div>
                
                <!-- 用户信息卡片 -->
                <div class="card" style="margin-bottom:16px">
                    <div class="card-header">
                        <h3>${n} <span class="code">${u.id}</span>${u.is_admin?' <span class="badge b-admin">管理</span>':''}${u.banned?' <span class="badge b-ban">封禁</span>':''}</h3>
                    </div>
                    <div class="card-body" style="padding:16px">
                        <div class="d-grid">
                            <div class="d-item"><div class="dl">注册时间</div><div class="dv">${Admin.fmtTime(u.created_at)||'-'}</div></div>
                            <div class="d-item"><div class="dl">设备数量</div><div class="dv">${d.devices.length}台</div></div>
                            <div class="d-item"><div class="dl">总答题</div><div class="dv">${ta}</div></div>
                            <div class="d-item"><div class="dl">正确率</div><div class="dv">${ta>0?Math.round(tc/ta*100):0}%</div></div>
                            <div class="d-item"><div class="dl">总时长</div><div class="dv">${this.fmtDur(td)}</div></div>
                            <div class="d-item"><div class="dl">题库数</div><div class="dv">${d.stats.length}个</div></div>
                        </div>
                    </div>
                </div>
                
                <!-- 操作按钮 -->
                <div class="card" style="margin-bottom:16px">
                    <div class="card-header"><h3>操作</h3></div>
                    <div class="card-body" style="padding:16px">
                        <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <button class="abtn primary" onclick="Admin.editUser('${jsu}','${jsn}',${u.is_admin?1:0})">编辑信息</button>
                            <button class="abtn primary" onclick="Admin.changeSyncCode('${jsu}','${jsn}')">修改同步码</button>
                            <button class="abtn primary" onclick="Admin.adjustStats('${jsu}','${jsn}')">调整数据</button>
                            <button class="abtn primary" onclick="Admin.viewCloudData('${jsu}')">查看云端数据</button>
                            ${u.id!==myId?`<button class="abtn ${u.banned?'':'warn'}" onclick="Admin.banUser('${jsu}','${jsn}',${u.banned?0:1})">${u.banned?'解封':'封禁'}</button>`:''}
                            ${!u.is_admin?`<button class="abtn danger" onclick="Admin.resetStats('${jsu}','${jsn}')">重置数据</button><button class="abtn danger" onclick="Admin.delUser('${jsu}','${jsn}')">删除用户</button>`:''}
                        </div>
                    </div>
                </div>
                
                <!-- 设备列表 -->
                ${d.devices.length?`
                <div class="card" style="margin-bottom:16px">
                    <div class="card-header"><h3>设备列表</h3><span class="count">${d.devices.length}台</span></div>
                    <div class="card-body" style="padding:12px">
                        ${d.devices.map(x=>{
                            const jsd=Utils.jsSafe(x.device_id);
                            return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-hover);border-radius:8px;margin-bottom:6px;font-size:12px">
                                <code style="color:var(--text-tertiary);flex:1;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(x.device_id)}</code>
                                <span style="color:var(--text-tertiary);font-size:11px">${Admin.fmtDate(x.bound_at)||''}</span>
                                <button class="abtn danger" style="padding:2px 8px;font-size:10px" onclick="Admin.removeDevice('${jsd}','${jsu}')">解绑</button>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`:''}
                
                <!-- 题库明细 -->
                ${d.stats.length?`
                <div class="card">
                    <div class="card-header"><h3>答题统计</h3><span class="count">${d.stats.length}个题库</span></div>
                    <div class="card-body" style="overflow-x:auto">
                        <table>
                            <thead><tr><th>题库</th><th style="text-align:right">答题</th><th style="text-align:right">正确</th><th style="text-align:right">正确率</th><th style="text-align:right">时长</th></tr></thead>
                            <tbody>${d.stats.map(s=>{
                                const a=s.answered>0?Math.round(s.correct/s.answered*100):0;
                                const c2 = a >= 80 ? '#22c55e' : a >= 60 ? '#f59e0b' : '#ef4444';
                                return`<tr>
                                    <td>${Utils.escapeHtml(s.bank_name||s.bank_id)}</td>
                                    <td style="text-align:right">${s.answered}</td>
                                    <td style="text-align:right">${s.correct}</td>
                                    <td style="text-align:right"><span style="color:${c2};font-weight:600">${a}%</span></td>
                                    <td style="text-align:right">${this.fmtDur(s.duration)}</td>
                                </tr>`;
                            }).join('')}</tbody>
                        </table>
                    </div>
                </div>`:''}
            `;
        } catch (e) { 
            el.innerHTML = `
                <div style="margin-bottom:16px">
                    <button class="abtn" onclick="Admin.renderUsers()">← 返回用户列表</button>
                </div>
                <div class="empty-state">加载失败: ${e.message}</div>
            `; 
        }
    };

    // ==================== 弹窗操作 ====================
    
    Admin.editUser = function(uid, name, admin) {
        const hn = Utils.escapeHtml(name);
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:400px">
                    <h3>编辑用户</h3>
                    <label>姓名</label><input id="eu-initials" value="${hn}" maxlength="4">
                    <label>管理员</label><select id="eu-admin"><option value="0" ${!admin?'selected':''}>否</option><option value="1" ${admin?'selected':''}>是</option></select>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.saveUser('${Utils.jsSafe(uid)}')">保存</button></div>
                </div>
            </div>`;
    };

    Admin.saveUser = async function(uid) {
        const r = await this.post('/api/admin/update-user', { targetUserId: uid, initials: document.getElementById('eu-initials').value.trim(), isAdmin: parseInt(document.getElementById('eu-admin').value) });
        if (r?.ok) { Utils.showToast('已保存', 'success'); document.querySelector('.modal-mask')?.remove(); await this.loadAll(); this.showUserDetail(uid); }
        else Utils.showToast(r?.error || '失败', 'error');
    };

    Admin.changeSyncCode = function(uid, name) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:400px">
                    <h3>修改同步码</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">用户: ${Utils.escapeHtml(name)} (${uid})</p>
                    <label>新同步码</label><input id="new-sync-code" value="${uid}" maxlength="6" style="text-transform:uppercase">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doChangeSyncCode('${Utils.jsSafe(uid)}')">确认修改</button></div>
                </div>
            </div>`;
    };

    Admin.doChangeSyncCode = async function(oldUid) {
        const newCode = document.getElementById('new-sync-code').value.trim().toUpperCase();
        if (!newCode || newCode.length < 4) { Utils.showToast('请输入有效同步码', 'error'); return; }
        const r = await this.post('/api/admin/change-sync-code', { oldUserId: oldUid, newUserId: newCode });
        if (r?.ok) { Utils.showToast('已修改', 'success'); document.querySelector('.modal-mask')?.remove(); await this.loadAll(); this.renderUsers(); }
        else Utils.showToast(r?.error || '失败', 'error');
    };

    Admin.adjustStats = function(uid, name) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:400px">
                    <h3>调整数据</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">用户: ${Utils.escapeHtml(name)} (${uid})</p>
                    <label>题库ID</label><input id="adj-bank-id" placeholder="题库ID">
                    <label>题库名称</label><input id="adj-bank-name" placeholder="题库名称（可选）">
                    <label>添加答题数</label><input id="adj-answered" type="number" value="0">
                    <label>添加正确数</label><input id="adj-correct" type="number" value="0">
                    <label>添加时长(秒)</label><input id="adj-duration" type="number" value="0">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doAdjustStats('${Utils.jsSafe(uid)}')">确认</button></div>
                </div>
            </div>`;
    };

    Admin.doAdjustStats = async function(uid) {
        const r = await this.post('/api/admin/adjust-stats', {
            targetUserId: uid,
            bankId: document.getElementById('adj-bank-id').value.trim(),
            bankName: document.getElementById('adj-bank-name').value.trim(),
            answered: parseInt(document.getElementById('adj-answered').value) || 0,
            correct: parseInt(document.getElementById('adj-correct').value) || 0,
            duration: parseInt(document.getElementById('adj-duration').value) || 0
        });
        if (r?.ok) { Utils.showToast('已调整', 'success'); document.querySelector('.modal-mask')?.remove(); await this.loadAll(); this.showUserDetail(uid); }
        else Utils.showToast(r?.error || '失败', 'error');
    };

    Admin.viewCloudData = async function(uid) {
        const d = await this.get(`/api/admin/user-cloud-data/${uid}`);
        if (!d?.ok) { Utils.showToast('获取失败', 'error'); return; }
        const data = d.data;
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:500px;max-height:80vh;overflow-y:auto">
                    <h3>云端数据</h3>
                    <pre style="background:var(--bg-hover);padding:12px;border-radius:8px;font-size:11px;overflow-x:auto">${Utils.escapeHtml(JSON.stringify(data, null, 2))}</pre>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">关闭</button></div>
                </div>
            </div>`;
    };

    Admin.banUser = async function(uid, name, ban) {
        if (!confirm(`${ban?'封禁':'解封'} ${name}？`)) return;
        const r = await this.post('/api/admin/ban-user', { targetUserId: uid, banned: !!ban });
        if (!r?.ok) { Utils.showToast(r?.error || '操作失败', 'error'); return; }
        Utils.showToast(ban?'已封禁':'已解封', 'success');
        await this.loadAll(); this.showUserDetail(uid);
    };

    Admin.resetStats = async function(uid, name) {
        if (!confirm(`重置 ${name} 的答题数据？`)) return;
        const r = await this.post('/api/admin/reset-stats', { targetUserId: uid });
        if (r?.ok) { Utils.showToast('已重置', 'success'); await this.loadAll(); this.showUserDetail(uid); }
    };

    Admin.delUser = async function(uid, name) {
        if (!confirm(`永久删除 ${name}？`)) return;
        const r = await this.post('/api/admin/delete-user', { targetUserId: uid });
        if (r?.ok) { Utils.showToast('已删除', 'success'); await this.loadAll(); this.renderUsers(); }
    };

    Admin.removeDevice = async function(deviceId, uid) {
        if (!confirm('解绑此设备？')) return;
        const r = await this.post('/api/admin/remove-device', { deviceId });
        if (r?.ok) { Utils.showToast('已解绑', 'success'); this.showUserDetail(uid); }
    };

    // 工具函数
    Admin.fmtDate = function(d) { if (!d) return ''; try { return new Date(d).toLocaleDateString('zh-CN'); } catch { return ''; } };
    Admin.fmtTime = function(d) { if (!d) return ''; try { return new Date(d).toLocaleString('zh-CN'); } catch { return ''; } };
    Admin.fmtDur = function(s) { if (!s) return '0分'; const h=Math.floor(s/3600),m=Math.floor(s%3600/60); return h?`${h}时${m}分`:`${m}分`; };
}
