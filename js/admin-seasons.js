/**
 * 管理后台 - 赛季管理模块（按需加载）
 *
 * 后端端点（worker/src/index.js）：
 *   GET  /api/admin/seasons            列表 + activeSeason
 *   POST /api/admin/seasons            创建 { name, id?, startDate?, endDate? }
 *   POST /api/admin/seasons/activate   激活 { seasonId }
 *
 * 约定：赛季 id 由服务端校验/建议，前端不自己造规则、不传自算的 id。
 * 视觉全部沿用后台现有组件：pageHeader / card / table-wrap / toolbar / abtn / status-pill。
 */
import Utils from './utils.js';

export function initSeasons(Admin) {
    Admin.renderSeasons = async function () {
        const el = document.getElementById('sec-seasons');
        if (!el) return;
        el.innerHTML = '<div class="loading">加载中...</div>';

        try {
            const d = await this.get('/api/admin/seasons');
            if (!d?.ok) {
                el.innerHTML = this.emptyState({
                    title: '赛季数据加载失败',
                    desc: d?.error || '请确认 Worker 已部署赛季接口（0006 迁移 + 新版本）'
                });
                return;
            }

            const seasons = d.seasons || [];
            const active = d.activeSeason || null;

            const rows = seasons.length
                ? seasons
                      .map(
                          (s) => `
                    <tr>
                        <td><code>${Utils.escapeHtml(s.id)}</code></td>
                        <td><strong>${Utils.escapeHtml(s.name || '-')}</strong></td>
                        <td>${
                            s.is_active
                                ? '<span class="status-pill enabled">当前赛季</span>'
                                : '<span class="status-pill">历史 · 只读</span>'
                        }</td>
                        <td style="font-size:12px">${Number(s.total_answered || 0).toLocaleString()}</td>
                        <td style="font-size:12px">${Number(s.stat_rows || 0).toLocaleString()}</td>
                        <td style="font-size:12px;color:var(--admin-text-tertiary)">${Utils.escapeHtml(s.created_at || '-')}</td>
                        <td>${
                            s.is_active
                                ? '<span style="font-size:12px;color:var(--admin-text-tertiary)">正在使用</span>'
                                : `<button class="abtn" onclick="Admin.activateSeason('${Utils.jsSafe(s.id)}')">设为当前赛季</button>`
                        }</td>
                    </tr>
                `
                      )
                      .join('')
                : `<tr><td colspan="7">${this.emptyState({ title: '还没有赛季', desc: '点右上角「刷新」或新建一个赛季' })}</td></tr>`;

            el.innerHTML = `
                ${this.pageHeader({
                    title: '赛季管理',
                    description:
                        '一个赛季对应一个学期。切换赛季只影响排行榜与统计；学生本地刷题进度、错题本、收藏不会重置。历史赛季只读。',
                    crumbs: ['管理后台', '赛季管理'],
                    actions: '<button class="abtn" onclick="Admin.renderSeasons()">刷新</button>'
                })}
                <div class="card">
                    <div class="card-header">
                        <div style="display:flex;align-items:center;gap:8px">
                            <h3>新建赛季</h3>
                            <span class="status-pill info">ID 由服务端生成</span>
                        </div>
                        <span class="count">名称为必填</span>
                    </div>
                    <div class="toolbar" style="border-top:none">
                        <div class="toolbar-group" style="flex:1">
                            <input id="season-name" maxlength="40" placeholder="如：2027 春季学期" style="min-width:200px">
                            <input id="season-start" type="date" aria-label="开始日期（可选）">
                            <input id="season-end" type="date" aria-label="结束日期（可选）">
                            <button class="abtn primary" onclick="Admin.createSeason()">创建赛季</button>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div style="display:flex;align-items:center;gap:8px">
                            <h3>全部赛季</h3>
                            <span class="status-pill info">${seasons.length} 个</span>
                        </div>
                        <span class="count">当前：${active ? Utils.escapeHtml(active.name || active.id) : '未设置'}</span>
                    </div>
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>赛季 ID</th><th>名称</th><th>状态</th><th>累计答题</th><th>统计行数</th><th>创建时间</th><th>操作</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            `;
            Utils.initIcons();
        } catch (e) {
            el.innerHTML = this.emptyState({ title: '赛季数据加载异常', desc: e.message });
        }
    };

    Admin.createSeason = async function () {
        const name = (document.getElementById('season-name')?.value || '').trim();
        const startDate = document.getElementById('season-start')?.value || '';
        const endDate = document.getElementById('season-end')?.value || '';
        if (!name) {
            Utils.showToast('请填写赛季名称', 'error');
            return;
        }
        // 不传 id：交给服务端按名称建议（服务端是唯一真相）
        const body = { name };
        if (startDate) body.startDate = startDate;
        if (endDate) body.endDate = endDate;

        const d = await this.post('/api/admin/seasons', body);
        if (d?.ok) {
            Utils.showToast(`赛季已创建：${d.season?.name || name}`, 'success');
            await this.renderSeasons();
        } else {
            Utils.showToast(d?.error || '创建失败', 'error');
        }
    };

    Admin.activateSeason = async function (seasonId) {
        const ok = await this.confirmDanger({
            title: '切换当前赛季',
            message: `把「${seasonId}」设为当前赛季？切换后新产生的答题数据会计入该赛季，原赛季数据保留可查。`,
            targetLabel: seasonId,
            confirmText: '切换'
        });
        if (!ok) return;
        const d = await this.post('/api/admin/seasons/activate', { seasonId });
        if (d?.ok) {
            Utils.showToast('已切换当前赛季', 'success');
            await this.renderSeasons();
        } else {
            Utils.showToast(d?.error || '切换失败', 'error');
        }
    };
}
