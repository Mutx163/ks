/**
 * 管理后台 - 系统状态模块
 */
import Utils from './utils.js';

export function initStatus(Admin) {
    Admin.renderStatus = async function () {
        const el = document.getElementById('sec-status');
        if (!el) return;
        el.innerHTML = '<div class="loading">加载中...</div>';

        try {
            const d = await this.get('/api/admin/system-status');
            if (!d?.ok) {
                el.innerHTML = this.emptyState({
                    title: '系统状态加载失败',
                    desc: d?.error || '请检查 Worker 是否已部署 system-status 接口。'
                });
                return;
            }

            const s = d.status;
            const checks = [
                { label: 'Worker API', ok: true, detail: '正常响应' },
                {
                    label: 'D1 数据库',
                    ok: s.d1?.ok !== false,
                    detail: s.d1?.ok !== false ? '连接正常' : '连接异常'
                },
                {
                    label: '操作日志表',
                    ok: s.logs?.ok !== false,
                    detail:
                        s.logs?.ok !== false ? `共 ${s.logs?.count || 0} 条` : '表不存在或查询失败'
                },
                { label: '用户数', ok: true, detail: `${s.userCount || 0} 人` },
                { label: '题库数', ok: true, detail: `${s.bankCount || 0} 个` },
                { label: '公告数', ok: true, detail: `${s.announcementCount || 0} 条` }
            ];

            const checkRows = checks
                .map(
                    (c) => `
                <div class="stat-card">
                    <div class="stat-icon ${c.ok ? 'green' : 'red'}">${Utils.icon(c.ok ? 'check-circle' : 'alert-triangle')}</div>
                    <div class="stat-info">
                        <div class="stat-value">${Utils.escapeHtml(c.label)}</div>
                        <div class="stat-label">${Utils.escapeHtml(c.detail)}</div>
                    </div>
                </div>
            `
                )
                .join('');

            const tableStats = (s.tables || [])
                .map(
                    (t) => `
                <tr>
                    <td><code>${Utils.escapeHtml(t.name)}</code></td>
                    <td>${t.count ?? '-'}</td>
                </tr>
            `
                )
                .join('');

            el.innerHTML = `
                ${this.pageHeader({
                    title: '系统状态',
                    description: '查看 Worker、D1 数据库、核心表和系统配置的运行状态。',
                    crumbs: ['管理后台', '系统状态'],
                    actions: '<button class="abtn" onclick="Admin.renderStatus()">刷新</button>'
                })}
                <div class="stat-grid">${checkRows}</div>
                ${
                    tableStats
                        ? `
                <div class="card">
                    <div class="card-header"><h3>数据表统计</h3><span class="count">${(s.tables || []).length} 张表</span></div>
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>表名</th><th>记录数</th></tr></thead>
                            <tbody>${tableStats}</tbody>
                        </table>
                    </div>
                </div>`
                        : ''
                }
                <div class="card">
                    <div class="card-header"><h3>环境信息</h3></div>
                    <div class="card-body" style="padding:16px">
                        <div class="d-grid">
                            <div class="d-item"><div class="dl">Worker 版本</div><div class="dv">${Utils.escapeHtml(s.workerVersion || '-')}</div></div>
                            <div class="d-item"><div class="dl">当前时间(UTC)</div><div class="dv">${Utils.escapeHtml(s.serverTime || '-')}</div></div>
                            <div class="d-item"><div class="dl">API 域名</div><div class="dv">${Utils.escapeHtml(s.apiDomain || '-')}</div></div>
                        </div>
                    </div>
                </div>`;
            Utils.initIcons?.();
        } catch (e) {
            el.innerHTML = this.emptyState({ title: '系统状态加载失败', desc: e.message });
        }
    };
}
