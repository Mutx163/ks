/**
 * 管理后台 - 公告管理
 */
import Utils from './utils.js';

export function initAnnounce(Admin) {
    Admin.renderAnnounce = async function () {
        document.getElementById('sec-announce').innerHTML = `
            ${this.pageHeader({
                title: '公告管理',
                description:
                    '发布、编辑和下线首页滚动公告。建议公告内容短、明确，并在发布前核对影响范围。',
                crumbs: ['管理后台', '公告管理'],
                actions:
                    '<button class="abtn" onclick="Admin.loadAnnouncements()">刷新历史</button>'
            })}
            <div class="card">
                <div class="card-header"><h3>发布公告</h3><span class="count">前台滚动展示</span></div>
                <div class="card-body" style="padding:16px">
                    <div class="inline-notice" style="margin-bottom:12px"><span class="notice-dot"></span><div>公告发布后会影响所有访问用户。请避免过长文本，重要通知建议写明时间、范围和操作指引。</div></div>
                    <div class="announce-input"><textarea id="announce-content" placeholder="输入公告内容，例如：6月8日 22:00-22:30 将进行题库维护，期间部分题库可能短暂不可用。"></textarea></div>
                    <div class="modal-actions" style="justify-content:flex-start">
                        <button class="mp" onclick="Admin.publishAnnounce()">发布公告</button>
                    </div>
                </div>
            </div>
            <div class="card" id="announce-list-card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                    <h3>历史公告</h3>
                    <select id="announce-sort" class="admin-select" style="width:auto" onchange="Admin.loadAnnouncements()">
                        <option value="newest">最新优先</option><option value="oldest">最早优先</option>
                    </select>
                </div>
                <div class="loading">加载中...</div>
            </div>`;
        await this.loadAnnouncements();
    };

    Admin.loadAnnouncements = async function () {
        try {
            const d = await this.get('/api/admin/announcements');
            const el = document.getElementById('announce-list-card');
            const sort = document.getElementById('announce-sort')?.value || 'newest';
            const header = `<div class="card-header" style="display:flex;justify-content:space-between;align-items:center"><h3>历史公告</h3><select id="announce-sort" class="admin-select" style="width:auto" onchange="Admin.loadAnnouncements()"><option value="newest" ${sort === 'newest' ? 'selected' : ''}>最新优先</option><option value="oldest" ${sort === 'oldest' ? 'selected' : ''}>最早优先</option></select></div>`;
            if (!d || !d.ok || !d.announcements?.length) {
                el.innerHTML =
                    header +
                    this.emptyState({
                        title: '暂无公告',
                        desc: '发布公告后会在这里显示历史记录。'
                    });
                return;
            }
            const items = [...d.announcements];
            if (sort === 'oldest') items.reverse();
            el.innerHTML =
                header +
                items
                    .map(
                        (a) => `
                <div class="announcement-item">
                    <div style="flex:1;min-width:0">
                        <div class="announcement-content">${Utils.escapeHtml(a.content)}</div>
                        <div class="announcement-meta">${Admin.fmtTime(a.created_at) || ''} · ID: ${a.id}</div>
                    </div>
                    <div class="toolbar-group" style="flex-shrink:0">
                        <button class="abtn" onclick="Admin.editAnnounce(${a.id},'${Utils.jsSafe(a.content)}')">编辑</button>
                        <button class="abtn danger" onclick="Admin.deleteAnnounce(${a.id})">删除</button>
                    </div>
                </div>
            `
                    )
                    .join('');
        } catch (e) {
            console.error(e);
            const el = document.getElementById('announce-list-card');
            if (el) el.innerHTML = this.emptyState({ title: '公告加载失败', desc: e.message });
        }
    };

    Admin.publishAnnounce = async function () {
        const content = document.getElementById('announce-content').value.trim();
        if (!content) {
            Utils.showToast('请输入内容', 'error');
            return;
        }
        const ok = await this.confirmDanger({
            title: '发布公告',
            message: '公告发布后会立即展示给所有访问用户。请确认内容无误。',
            targetLabel: content.length > 60 ? content.slice(0, 60) + '...' : content,
            confirmText: '确认发布',
            danger: false
        });
        if (!ok) return;
        const r = await this.post('/api/admin/announce', { content });
        if (r?.ok) {
            Utils.showToast('已发布', 'success');
            document.getElementById('announce-content').value = '';
            await this.loadAnnouncements();
        } else Utils.showToast(r?.error || '发布失败', 'error');
    };

    Admin.deleteAnnounce = async function (id) {
        const ok = await this.confirmDanger({
            title: '删除公告',
            targetLabel: `公告 #${id}`,
            message: '删除后该公告将不再出现在历史列表中。',
            confirmText: '确认删除'
        });
        if (!ok) return;
        const r = await this.post('/api/admin/delete-announcement', { id });
        if (r?.ok) {
            Utils.showToast('已删除', 'success');
            await this.loadAnnouncements();
        } else Utils.showToast(r?.error || '删除失败', 'error');
    };

    Admin.editAnnounce = function (id, content) {
        document.getElementById('modal-root').innerHTML = `
            <div class="modal-mask" onclick="Admin.onMaskClick(event)">
                <div class="modal-box">
                    <h3>编辑公告 #${id}</h3>
                    <label>公告内容</label>
                    <textarea id="edit-announce-content" rows="5">${Utils.escapeHtml(content)}</textarea>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.saveAnnounce(${id})">保存</button></div>
                </div>
            </div>`;
    };

    Admin.saveAnnounce = async function (id) {
        const content = document.getElementById('edit-announce-content').value.trim();
        if (!content) {
            Utils.showToast('内容不能为空', 'error');
            return;
        }
        const r = await this.post('/api/admin/edit-announcement', { id, content });
        if (r?.ok) {
            Utils.showToast('已更新', 'success');
            document.querySelector('.modal-mask')?.remove();
            await this.loadAnnouncements();
        } else Utils.showToast(r?.error || '保存失败', 'error');
    };
}
