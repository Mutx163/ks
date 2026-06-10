/**
 * 管理后台 - 客户端日志模块
 * 前端自动上报的 warn/error 日志查看
 */
import Utils from './utils.js';

export function initClientLogs(Admin) {
    Admin.renderClientLogs = async function () {
        const el = document.getElementById('sec-client-logs');
        if (!el) return;
        el.innerHTML = '<div class="loading">加载中...</div>';

        try {
            const page = this.clientLogsPage || 1;
            const pageSize = this.clientLogsPageSize || 50;
            const levelFilter = this.clientLogsLevelFilter || '';
            const deviceFilter = this.clientLogsDeviceFilter || '';

            const params = new URLSearchParams({
                limit: String(pageSize),
                offset: String((page - 1) * pageSize)
            });
            if (levelFilter) params.set('level', levelFilter);
            if (deviceFilter) params.set('filterDeviceId', deviceFilter);

            const d = await this.get(`/api/admin/logs?${params.toString()}`);
            if (!d?.ok) {
                el.innerHTML = this.emptyState({
                    title: '客户端日志加载失败',
                    desc: d?.error || '请检查 Worker 是否已部署 /api/admin/logs 接口。'
                });
                return;
            }

            const logs = d.logs || [];
            const total = d.total || 0;
            const errorSummary = d.errorSummary || [];
            const activeDevices = d.activeDevices || [];

            const levelColors = {
                error: 'danger',
                warn: 'warning',
                info: 'info',
                debug: '',
                log: ''
            };

            const levelLabels = {
                error: '错误',
                warn: '警告',
                info: '信息',
                debug: '调试',
                log: '日志'
            };

            const rows = logs.length
                ? logs.map((log) => {
                    const level = log.level || 'log';
                    const color = levelColors[level] || '';
                    const truncatedMsg = (log.message || '').slice(0, 120);
                    const hasStack = log.stack && log.stack.length > 0;
                    const stackPreview = hasStack
                        ? `<details><summary style="cursor:pointer;font-size:11px;color:var(--admin-text-tertiary)">堆栈</summary><pre style="font-size:11px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-all">${Utils.escapeHtml(log.stack)}</pre></details>`
                        : '';
                    const deviceShort = (log.device_id || '').slice(0, 8);
                    const typeIcon = log.type === 'uncaught' ? '💥' : log.type === 'unhandledrejection' ? '⚡' : log.type === 'resource' ? '📦' : log.type === 'user_report' ? '📝' : '📋';

                    return `
                        <tr>
                            <td style="font-size:12px;color:var(--admin-text-tertiary)">${Admin.fmtTime(log.created_at)}</td>
                            <td><span class="status-pill ${color}">${levelLabels[level] || level}</span></td>
                            <td style="font-size:12px">${typeIcon} ${Utils.escapeHtml(log.type || 'console')}</td>
                            <td><code style="font-size:11px">${Utils.escapeHtml(deviceShort)}</code></td>
                            <td style="max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px" title="${Utils.escapeHtml(log.message || '')}">${Utils.escapeHtml(truncatedMsg)}</td>
                            <td>${stackPreview}</td>
                            <td style="font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Utils.escapeHtml(log.page_url || '')}">${Utils.escapeHtml((log.page_url || '').replace(/^https?:\/\/[^/]+/, ''))}</td>
                        </tr>
                    `;
                }).join('')
                : `<tr><td colspan="7">${this.emptyState({ title: '暂无客户端日志' })}</td></tr>`;

            // 高频错误摘要
            const summaryHTML = errorSummary.length
                ? `
                    <div class="card" style="margin-bottom:16px">
                        <div class="card-header"><h3>🔥 近 7 天高频错误 Top ${errorSummary.length}</h3></div>
                        <div class="table-wrap">
                            <table>
                                <thead><tr><th>错误消息</th><th>出现次数</th></tr></thead>
                                <tbody>
                                    ${errorSummary.map(s => `
                                        <tr>
                                            <td style="max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px" title="${Utils.escapeHtml(s.message || '')}">${Utils.escapeHtml((s.message || '').slice(0, 100))}</td>
                                            <td><span class="status-pill danger">${s.cnt}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `
                : '';

            // 活跃设备
            const devicesHTML = activeDevices.length
                ? `
                    <div class="card" style="margin-bottom:16px">
                        <div class="card-header"><h3>📱 最近活跃设备</h3></div>
                        <div class="table-wrap">
                            <table>
                                <thead><tr><th>设备 ID</th><th>日志数</th><th>最后活跃</th></tr></thead>
                                <tbody>
                                    ${activeDevices.map(dev => `
                                        <tr style="cursor:pointer" onclick="Admin.filterClientLogsByDevice('${Utils.escapeHtml(dev.device_id)}')">
                                            <td><code style="font-size:11px">${Utils.escapeHtml((dev.device_id || '').slice(0, 12))}…</code></td>
                                            <td>${dev.log_count}</td>
                                            <td style="font-size:12px">${Admin.fmtTime(dev.last_active)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `
                : '';

            el.innerHTML = `
                ${this.pageHeader({
                    title: '客户端日志',
                    description: '查看前端自动上报的 warn/error 日志，用于排查用户端问题。',
                    crumbs: ['管理后台', '客户端日志'],
                    actions: '<button class="abtn" onclick="Admin.renderClientLogs()">刷新</button>'
                })}
                ${summaryHTML}
                ${devicesHTML}
                <div class="toolbar">
                    <div class="toolbar-group" style="flex:1">
                        <select class="admin-select" id="client-logs-level-filter" onchange="Admin.setClientLogsFilters()">
                            <option value="">全部级别</option>
                            <option value="error" ${levelFilter === 'error' ? 'selected' : ''}>错误</option>
                            <option value="warn" ${levelFilter === 'warn' ? 'selected' : ''}>警告</option>
                            <option value="info" ${levelFilter === 'info' ? 'selected' : ''}>信息</option>
                            <option value="debug" ${levelFilter === 'debug' ? 'selected' : ''}>调试</option>
                            <option value="log" ${levelFilter === 'log' ? 'selected' : ''}>日志</option>
                        </select>
                        <input class="admin-select" id="client-logs-device-filter" placeholder="设备 ID 筛选..." value="${Utils.escapeHtml(deviceFilter)}" style="min-width:200px" onchange="Admin.setClientLogsFilters()">
                    </div>
                    <div class="toolbar-group">
                        <span class="status-pill info">${total} 条记录</span>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>日志列表</h3><span class="count">按时间倒序</span></div>
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>时间</th><th>级别</th><th>类型</th><th>设备</th><th>消息</th><th>堆栈</th><th>页面</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                ${this.pager({ page, pageSize, total, onPage: 'Admin.setClientLogsPage', onPageSize: 'Admin.setClientLogsPageSize' })}
            `;
        } catch (e) {
            el.innerHTML = this.emptyState({ title: '客户端日志加载失败', desc: e.message });
        }
    };

    Admin.setClientLogsPage = function (p) {
        this.clientLogsPage = p;
        this.renderClientLogs();
    };

    Admin.setClientLogsPageSize = function (s) {
        this.clientLogsPageSize = s;
        this.clientLogsPage = 1;
        this.renderClientLogs();
    };

    Admin.setClientLogsFilters = function () {
        this.clientLogsLevelFilter = document.getElementById('client-logs-level-filter')?.value || '';
        this.clientLogsDeviceFilter = document.getElementById('client-logs-device-filter')?.value || '';
        this.clientLogsPage = 1;
        this.renderClientLogs();
    };

    Admin.filterClientLogsByDevice = function (deviceId) {
        this.clientLogsDeviceFilter = deviceId;
        this.clientLogsPage = 1;
        this.renderClientLogs();
    };
}
