/**
 * 管理后台 - 操作日志模块
 */
import Utils from './utils.js';

export function initLogs(Admin) {
    Admin.renderLogs = async function () {
        const el = document.getElementById('sec-logs');
        if (!el) return;
        el.innerHTML = '<div class="loading">加载中...</div>';

        try {
            const page = this.logsPage || 1;
            const pageSize = this.logsPageSize || 20;
            const actionFilter = this.logsActionFilter || '';
            const targetTypeFilter = this.logsTargetTypeFilter || '';
            const okFilter = this.logsOkFilter || '';

            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize)
            });
            if (actionFilter) params.set('action', actionFilter);
            if (targetTypeFilter) params.set('targetType', targetTypeFilter);
            if (okFilter) params.set('ok', okFilter);

            const d = await this.get(`/api/admin/operation-logs?${params.toString()}`);
            if (!d?.ok) {
                el.innerHTML = this.emptyState({
                    title: '操作日志加载失败',
                    desc: d?.error || '请检查 Worker 是否已部署 operation-logs 接口。'
                });
                return;
            }

            const logs = d.logs || [];
            const total = d.total || 0;
            const actionOptions = d.actions || [];

            const rows = logs.length
                ? logs
                      .map(
                          (log) => `
                    <tr>
                        <td style="font-size:12px;color:var(--admin-text-tertiary)">${Admin.fmtTime(log.created_at)}</td>
                        <td><strong>${Utils.escapeHtml(log.action)}</strong></td>
                        <td>${Utils.escapeHtml(log.target_type || '-')}</td>
                        <td><code>${Utils.escapeHtml(log.target_id || '-')}</code></td>
                        <td>${log.ok ? '<span class="status-pill enabled">成功</span>' : '<span class="status-pill disabled">失败</span>'}</td>
                        <td style="font-size:12px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Utils.escapeHtml(log.detail || '')}">${Utils.escapeHtml((log.detail || '').slice(0, 80))}</td>
                        <td style="font-size:12px">${Utils.escapeHtml(log.operator || '-')}</td>
                    </tr>
                `
                      )
                      .join('')
                : `<tr><td colspan="7">${this.emptyState({ title: '暂无操作日志' })}</td></tr>`;

            el.innerHTML = `
                ${this.pageHeader({
                    title: '操作日志',
                    description: '查看管理员在后台执行的所有操作记录，用于审计和问题排查。',
                    crumbs: ['管理后台', '操作日志'],
                    actions: '<button class="abtn" onclick="Admin.renderLogs()">刷新</button>'
                })}
                <div class="toolbar">
                    <div class="toolbar-group" style="flex:1">
                        <select class="admin-select" id="logs-action-filter" onchange="Admin.setLogsFilters()">
                            <option value="">全部操作</option>
                            ${actionOptions.map((a) => `<option value="${Utils.escapeHtml(a)}" ${actionFilter === a ? 'selected' : ''}>${Utils.escapeHtml(a)}</option>`).join('')}
                        </select>
                        <select class="admin-select" id="logs-target-filter" onchange="Admin.setLogsFilters()">
                            <option value="">全部对象</option>
                            <option value="user" ${targetTypeFilter === 'user' ? 'selected' : ''}>用户</option>
                            <option value="bank" ${targetTypeFilter === 'bank' ? 'selected' : ''}>题库</option>
                            <option value="question" ${targetTypeFilter === 'question' ? 'selected' : ''}>题目</option>
                            <option value="announcement" ${targetTypeFilter === 'announcement' ? 'selected' : ''}>公告</option>
                            <option value="system" ${targetTypeFilter === 'system' ? 'selected' : ''}>系统</option>
                        </select>
                        <select class="admin-select" id="logs-ok-filter" onchange="Admin.setLogsFilters()">
                            <option value="">全部状态</option>
                            <option value="1" ${okFilter === '1' ? 'selected' : ''}>成功</option>
                            <option value="0" ${okFilter === '0' ? 'selected' : ''}>失败</option>
                        </select>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div style="display:flex;align-items:center;gap:8px">
                            <h3>操作记录</h3>
                            <span class="status-pill info">${total} 条记录</span>
                        </div>
                        <span class="count">按时间倒序</span>
                    </div>
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>时间</th><th>操作</th><th>对象类型</th><th>对象ID</th><th>结果</th><th>详情</th><th>操作人</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                ${this.pager({ page, pageSize, total, onPage: 'Admin.setLogsPage', onPageSize: 'Admin.setLogsPageSize' })}
            `;
        } catch (e) {
            el.innerHTML = this.emptyState({ title: '操作日志加载失败', desc: e.message });
        }
    };

    Admin.setLogsPage = function (p) {
        this.logsPage = p;
        this.renderLogs();
    };

    Admin.setLogsPageSize = function (s) {
        this.logsPageSize = s;
        this.logsPage = 1;
        this.renderLogs();
    };

    Admin.setLogsFilters = function () {
        this.logsActionFilter = document.getElementById('logs-action-filter')?.value || '';
        this.logsTargetTypeFilter = document.getElementById('logs-target-filter')?.value || '';
        this.logsOkFilter = document.getElementById('logs-ok-filter')?.value || '';
        this.logsPage = 1;
        this.renderLogs();
    };
}
