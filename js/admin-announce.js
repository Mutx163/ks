/**
 * 管理后台 - 公告管理
 */
import Utils from '../utils.js';

export function initAnnounce(Admin) {

    Admin.renderAnnounce = async function() {
        document.getElementById('sec-announce').innerHTML = `
            <div class="card">
                <div class="card-header"><h3>发布公告</h3></div>
                <div class="card-body" style="padding:12px">
                    <p style="color:var(--text-tertiary);font-size:12px;margin-bottom:8px">用户打开网站时滚动显示</p>
                    <div class="announce-input"><textarea id="announce-content" placeholder="输入公告内容..."></textarea></div>
                    <button class="btn-login" style="max-width:160px;padding:8px" onclick="Admin.publishAnnounce()">发布公告</button>
                </div>
            </div>
            <div class="card" id="announce-list-card" style="margin-top:12px">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                    <h3>历史公告</h3>
                    <select id="announce-sort" onchange="Admin.loadAnnouncements()" style="font-size:11px;padding:3px 6px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text)">
                        <option value="newest">最新优先</option><option value="oldest">最早优先</option>
                    </select>
                </div>
                <div class="empty-state">加载中...</div>
            </div>`;
        await this.loadAnnouncements();
    };

    Admin.loadAnnouncements = async function() {
        try {
            const d = await this.get('/api/admin/announcements');
            const el = document.getElementById('announce-list-card');
            if (!d || !d.ok || !d.announcements?.length) {
                el.innerHTML = `<div class="card-header" style="display:flex;justify-content:space-between;align-items:center"><h3>历史公告</h3></div><div class="empty-state">暂无公告</div>`;
                return;
            }
            const sort = document.getElementById('announce-sort')?.value || 'newest';
            const items = [...d.announcements];
            if (sort === 'oldest') items.reverse();
            el.innerHTML = `<div class="card-header" style="display:flex;justify-content:space-between;align-items:center"><h3>历史公告</h3><select id="announce-sort" onchange="Admin.loadAnnouncements()" style="font-size:11px;padding:3px 6px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text)"><option value="newest" ${sort==='newest'?'selected':''}>最新优先</option><option value="oldest" ${sort==='oldest'?'selected':''}>最早优先</option></select></div>` + items.map(a => `
                <div style="display:flex;align-items:flex-start;padding:8px 12px;border-bottom:1px solid var(--border);gap:8px">
                    <div style="flex:1;min-width:0">
                        <div style="font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-all">${Utils.escapeHtml(a.content)}</div>
                        <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">${a.created_at?.slice(0,16)||''} · ID:${a.id}</div>
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        <button class="abtn primary" style="padding:2px 8px;font-size:10px" onclick="Admin.editAnnounce(${a.id},'${Utils.jsSafe(a.content)}')">编辑</button>
                        <button class="abtn danger" style="padding:2px 8px;font-size:10px" onclick="Admin.deleteAnnounce(${a.id})">删除</button>
                    </div>
                </div>
            `).join('');
        } catch (e) { console.error(e); }
    };

    Admin.publishAnnounce = async function() {
        const content = document.getElementById('announce-content').value.trim();
        if (!content) { Utils.showToast('请输入内容', 'error'); return; }
        const r = await this.post('/api/admin/announce', { content });
        if (r?.ok) { Utils.showToast('已发布', 'success'); document.getElementById('announce-content').value = ''; await this.loadAnnouncements(); }
    };

    Admin.deleteAnnounce = async function(id) {
        if (!confirm('删除这条公告？')) return;
        const r = await this.post('/api/admin/delete-announcement', { id });
        if (r?.ok) { Utils.showToast('已删除', 'success'); await this.loadAnnouncements(); }
    };

    Admin.editAnnounce = function(id, content) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box">
                    <h3>编辑公告 #${id}</h3>
                    <textarea id="edit-announce-content" rows="4" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-card);color:var(--text);font-size:13px;resize:vertical">${content}</textarea>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.saveAnnounce(${id})">保存</button></div>
                </div>
            </div>`;
    };

    Admin.saveAnnounce = async function(id) {
        const content = document.getElementById('edit-announce-content').value.trim();
        if (!content) { Utils.showToast('内容不能为空', 'error'); return; }
        const r = await this.post('/api/admin/edit-announcement', { id, content });
        if (r?.ok) { Utils.showToast('已更新', 'success'); document.querySelector('.modal-mask')?.remove(); await this.loadAnnouncements(); }
    };
}
