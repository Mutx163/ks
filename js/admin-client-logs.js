/**
 * 管理后台 - 客户端日志模块
 * 支持：时间/级别/类型/用户/关键词筛选 + 一键复制给 AI
 */
import Utils from './utils.js';

export function initClientLogs(Admin) {

    // ===== 筛选快捷时间范围 =====
    const TIME_PRESETS = {
        '1h':  { label: '近 1 小时',  ms: 3600000 },
        '6h':  { label: '近 6 小时',  ms: 21600000 },
        '24h': { label: '近 24 小时', ms: 86400000 },
        '3d':  { label: '近 3 天',    ms: 259200000 },
        '7d':  { label: '近 7 天',    ms: 604800000 },
        'all': { label: '全部',       ms: 0 }
    };

    const LEVEL_OPTIONS = [
        { value: '',       label: '全部级别' },
        { value: 'error',  label: '❌ 错误' },
        { value: 'warn',   label: '⚠️ 警告' },
        { value: 'info',   label: 'ℹ️ 信息' },
        { value: 'debug',  label: '🔍 调试' },
        { value: 'log',    label: '📋 日志' }
    ];

    const TYPE_OPTIONS = [
        { value: '',                   label: '全部类型' },
        { value: 'console',            label: '📋 控制台' },
        { value: 'uncaught',           label: '💥 JS 运行时错误' },
        { value: 'unhandledrejection', label: '⚡ 未处理 Promise' },
        { value: 'resource',           label: '📦 资源加载失败' },
        { value: 'user_report',        label: '📝 用户反馈' }
    ];

    const LEVEL_COLORS = { error: 'danger', warn: 'warning', info: 'info', debug: '', log: '' };
    const LEVEL_LABELS = { error: '错误', warn: '警告', info: '信息', debug: '调试', log: '日志' };
    const TYPE_ICONS   = { uncaught: '💥', unhandledrejection: '⚡', resource: '📦', user_report: '📝', console: '📋' };

    // ===== 主渲染 =====
    Admin.renderClientLogs = async function () {
        const el = document.getElementById('sec-client-logs');
        if (!el) return;
        el.innerHTML = '<div class="loading">加载中...</div>';

        try {
            const f = this._clf || {};
            const page     = f.page || 1;
            const pageSize = f.pageSize || 50;

            // 构建查询参数
            const params = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) });
            if (f.level)     params.set('level', f.level);
            if (f.type)      params.set('type', f.type);
            if (f.keyword)   params.set('keyword', f.keyword);
            if (f.userName)  params.set('userName', f.userName);
            if (f.deviceId)  params.set('filterDeviceId', f.deviceId);
            if (f.timeStart) params.set('timeStart', f.timeStart);
            if (f.timeEnd)   params.set('timeEnd', f.timeEnd);

            const d = await this.get(`/api/admin/logs?${params.toString()}`);
            if (!d?.ok) {
                el.innerHTML = this.emptyState({ title: '客户端日志加载失败', desc: d?.error || '接口异常' });
                return;
            }

            const logs         = d.logs || [];
            const total        = d.total || 0;
            const errorSummary = d.errorSummary || [];
            const activeDevices = d.activeDevices || [];

            // ===== 表格行 =====
            const rows = logs.length
                ? logs.map(log => {
                    const lv = log.level || 'log';
                    const msg = (log.message || '').slice(0, 150);
                    const stackHtml = log.stack
                        ? `<details><summary style="cursor:pointer;font-size:11px;color:var(--admin-text-tertiary)">堆栈</summary><pre style="font-size:11px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-all">${Utils.escapeHtml(log.stack)}</pre></details>`
                        : '';
                    const userHtml = log.user_name
                        ? `<strong>${Utils.escapeHtml(log.user_name)}</strong>${log.sync_code ? `<br><code style="font-size:10px;color:var(--admin-text-tertiary)">${Utils.escapeHtml(log.sync_code)}</code>` : ''}`
                        : '<span style="color:var(--admin-text-tertiary)">未绑定</span>';

                    return `<tr>
                        <td style="font-size:12px;color:var(--admin-text-tertiary);white-space:nowrap">${Admin.fmtTime(log.created_at)}</td>
                        <td><span class="status-pill ${LEVEL_COLORS[lv] || ''}">${LEVEL_LABELS[lv] || lv}</span></td>
                        <td style="font-size:12px;white-space:nowrap">${TYPE_ICONS[log.type] || '📋'} ${Utils.escapeHtml(log.type || 'console')}</td>
                        <td style="font-size:12px">${userHtml}</td>
                        <td style="max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px" title="${Utils.escapeHtml(log.message || '')}">${Utils.escapeHtml(msg)}</td>
                        <td>${stackHtml}</td>
                        <td style="font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Utils.escapeHtml(log.page_url || '')}">${Utils.escapeHtml((log.page_url || '').replace(/^https?:\/\/[^/]+/, ''))}</td>
                    </tr>`;
                }).join('')
                : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--admin-text-tertiary)">暂无匹配的日志</td></tr>`;

            // ===== 高频错误摘要 =====
            const summaryHTML = errorSummary.length ? `
                <div class="card" style="margin-bottom:16px">
                    <div class="card-header"><h3>🔥 近 7 天高频错误 Top ${errorSummary.length}</h3></div>
                    <div class="table-wrap"><table>
                        <thead><tr><th>错误消息</th><th>出现次数</th></tr></thead>
                        <tbody>${errorSummary.map(s => `<tr>
                            <td style="max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px" title="${Utils.escapeHtml(s.message || '')}">${Utils.escapeHtml((s.message || '').slice(0, 120))}</td>
                            <td><span class="status-pill danger">${s.cnt}</span></td>
                        </tr>`).join('')}</tbody>
                    </table></div>
                </div>` : '';

            // ===== 活跃设备 =====
            const devicesHTML = activeDevices.length ? `
                <div class="card" style="margin-bottom:16px">
                    <div class="card-header"><h3>📱 最近活跃设备</h3></div>
                    <div class="table-wrap"><table>
                        <thead><tr><th>用户</th><th>同步码</th><th>日志数</th><th>最后活跃</th></tr></thead>
                        <tbody>${activeDevices.map(dev => `<tr style="cursor:pointer" onclick="Admin.filterClientLogsByDevice('${Utils.escapeHtml(dev.device_id)}')">
                            <td>${dev.user_name ? `<strong>${Utils.escapeHtml(dev.user_name)}</strong>` : '<span style="color:var(--admin-text-tertiary)">未绑定</span>'}</td>
                            <td><code style="font-size:11px">${dev.sync_code ? Utils.escapeHtml(dev.sync_code) : '-'}</code></td>
                            <td>${dev.log_count}</td>
                            <td style="font-size:12px">${Admin.fmtTime(dev.last_active)}</td>
                        </tr>`).join('')}</tbody>
                    </table></div>
                </div>` : '';

            // ===== 筛选栏 =====
            const filterHTML = `
                <div class="card" style="margin-bottom:16px;padding:16px">
                    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">
                        <!-- 时间快捷 -->
                        <div>
                            <label style="font-size:12px;color:var(--admin-text-tertiary);display:block;margin-bottom:4px">时间范围</label>
                            <div style="display:flex;gap:4px;flex-wrap:wrap">
                                ${Object.entries(TIME_PRESETS).map(([k, v]) =>
                                    `<button class="abtn ${(f.timePreset || '24h') === k ? '' : 'secondary'}" style="font-size:12px;padding:4px 10px" onclick="Admin.clfSetTimePreset('${k}')">${v.label}</button>`
                                ).join('')}
                            </div>
                        </div>
                        <!-- 时间自定义 -->
                        <div>
                            <label style="font-size:12px;color:var(--admin-text-tertiary);display:block;margin-bottom:4px">自定义时间</label>
                            <div style="display:flex;gap:4px;align-items:center">
                                <input type="datetime-local" class="admin-select" id="clf-time-start" value="${f.timeStart ? msToLocal(new Date(f.timeStart).getTime()) : ''}" style="font-size:12px" onchange="Admin.clfApplyCustomTime()">
                                <span style="color:var(--admin-text-tertiary)">~</span>
                                <input type="datetime-local" class="admin-select" id="clf-time-end" value="${f.timeEnd ? msToLocal(new Date(f.timeEnd).getTime()) : ''}" style="font-size:12px" onchange="Admin.clfApplyCustomTime()">
                            </div>
                        </div>
                        <!-- 级别 -->
                        <div>
                            <label style="font-size:12px;color:var(--admin-text-tertiary);display:block;margin-bottom:4px">级别</label>
                            <select class="admin-select" id="clf-level" onchange="Admin.setClientLogsFilters()">
                                ${LEVEL_OPTIONS.map(o => `<option value="${o.value}" ${f.level === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                            </select>
                        </div>
                        <!-- 类型 -->
                        <div>
                            <label style="font-size:12px;color:var(--admin-text-tertiary);display:block;margin-bottom:4px">类型</label>
                            <select class="admin-select" id="clf-type" onchange="Admin.setClientLogsFilters()">
                                ${TYPE_OPTIONS.map(o => `<option value="${o.value}" ${f.type === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                            </select>
                        </div>
                        <!-- 用户名 -->
                        <div>
                            <label style="font-size:12px;color:var(--admin-text-tertiary);display:block;margin-bottom:4px">用户名</label>
                            <input class="admin-select" id="clf-username" placeholder="搜索用户名..." value="${Utils.escapeHtml(f.userName || '')}" style="min-width:120px;font-size:12px" onchange="Admin.setClientLogsFilters()">
                        </div>
                        <!-- 关键词 -->
                        <div>
                            <label style="font-size:12px;color:var(--admin-text-tertiary);display:block;margin-bottom:4px">关键词</label>
                            <input class="admin-select" id="clf-keyword" placeholder="搜索日志内容..." value="${Utils.escapeHtml(f.keyword || '')}" style="min-width:160px;font-size:12px" onchange="Admin.setClientLogsFilters()">
                        </div>
                        <!-- 操作 -->
                        <div style="display:flex;gap:6px;align-items:flex-end">
                            <button class="abtn secondary" style="font-size:12px;padding:6px 12px" onclick="Admin.clfClearFilters()">清空筛选</button>
                            <button class="abtn" style="font-size:12px;padding:6px 12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff" onclick="Admin.clfCopyForAI()">📋 复制给 AI</button>
                        </div>
                    </div>
                    <div style="margin-top:8px;font-size:12px;color:var(--admin-text-tertiary)">
                        ${this._clfSummaryStr(f, total)}
                    </div>
                </div>`;

            // ===== 渲染 =====
            el.innerHTML = `
                ${this.pageHeader({
                    title: '客户端日志',
                    description: '查看前端自动上报的 warn/error 日志，支持筛选后一键复制给 AI 分析。',
                    crumbs: ['管理后台', '客户端日志'],
                    actions: '<button class="abtn" onclick="Admin.renderClientLogs()">刷新</button>'
                })}
                ${filterHTML}
                ${summaryHTML}
                ${devicesHTML}
                <div class="card">
                    <div class="card-header"><h3>日志列表</h3><span class="count">${total} 条 · 按时间倒序</span></div>
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>时间</th><th>级别</th><th>类型</th><th>用户</th><th>消息</th><th>堆栈</th><th>页面</th></tr></thead>
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

    // ===== 筛选条件摘要文字 =====
    Admin._clfSummaryStr = function (f, total) {
        const parts = [`共 ${total} 条`];
        if (f.timePreset && f.timePreset !== 'all') parts.push(TIME_PRESETS[f.timePreset]?.label || '');
        if (f.level)     parts.push(`级别:${LEVEL_LABELS[f.level] || f.level}`);
        if (f.type)      parts.push(`类型:${TYPE_OPTIONS.find(o => o.value === f.type)?.label || f.type}`);
        if (f.userName)  parts.push(`用户:${f.userName}`);
        if (f.keyword)   parts.push(`关键词:${f.keyword}`);
        if (f.deviceId)  parts.push(`设备:${f.deviceId.slice(0, 8)}…`);
        return parts.join(' · ');
    };

    // ===== 时间工具：本地时间 ↔ ISO =====
    /** 本地 datetime-local 值 → UTC ISO（用于发给 Worker） */
    function localToISO(localStr) {
        if (!localStr) return '';
        // datetime-local 格式："2026-06-10T20:00"，视为本地时间
        const d = new Date(localStr);
        return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 19);
    }
    /** UTC 时间戳(ms) → 本地 datetime-local 值（用于填充输入框） */
    function msToLocal(ms) {
        const d = new Date(ms);
        // 转为 YYYY-MM-DDTHH:mm 本地格式
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // ===== 时间快捷 =====
    Admin.clfSetTimePreset = function (preset) {
        const f = this._clf || (this._clf = {});
        f.timePreset = preset;
        if (preset === 'all') {
            f.timeStart = '';
            f.timeEnd = '';
        } else {
            const ms = TIME_PRESETS[preset]?.ms || 0;
            f.timeStart = ms ? new Date(Date.now() - ms).toISOString().slice(0, 19) : '';
            f.timeEnd = '';
        }
        f.page = 1;
        this.renderClientLogs();
    };

    Admin.clfApplyCustomTime = function () {
        const f = this._clf || (this._clf = {});
        const s = document.getElementById('clf-time-start')?.value || '';
        const e = document.getElementById('clf-time-end')?.value || '';
        f.timeStart = localToISO(s);
        f.timeEnd   = localToISO(e);
        f.timePreset = '';
        f.page = 1;
        this.renderClientLogs();
    };

    // ===== 通用筛选 =====
    Admin.setClientLogsFilters = function () {
        const f = this._clf || (this._clf = {});
        f.level    = document.getElementById('clf-level')?.value || '';
        f.type     = document.getElementById('clf-type')?.value || '';
        f.keyword  = document.getElementById('clf-keyword')?.value || '';
        f.userName = document.getElementById('clf-username')?.value || '';
        f.page = 1;
        this.renderClientLogs();
    };

    Admin.clfClearFilters = function () {
        this._clf = { page: 1, pageSize: 50, timePreset: '24h' };
        this.renderClientLogs();
    };

    Admin.filterClientLogsByDevice = function (deviceId) {
        const f = this._clf || (this._clf = {});
        f.deviceId = deviceId;
        f.page = 1;
        this.renderClientLogs();
    };

    Admin.setClientLogsPage = function (p) {
        (this._clf || (this._clf = {})).page = p;
        this.renderClientLogs();
    };

    Admin.setClientLogsPageSize = function (s) {
        const f = this._clf || (this._clf = {});
        f.pageSize = s;
        f.page = 1;
        this.renderClientLogs();
    };

    // ===== 一键复制给 AI =====
    Admin.clfCopyForAI = async function () {
        const f = this._clf || {};
        const pageSize = f.pageSize || 50;

        // 拉取全部匹配数据（最多 200 条）
        const params = new URLSearchParams({ limit: '200', offset: '0' });
        if (f.level)     params.set('level', f.level);
        if (f.type)      params.set('type', f.type);
        if (f.keyword)   params.set('keyword', f.keyword);
        if (f.userName)  params.set('userName', f.userName);
        if (f.deviceId)  params.set('filterDeviceId', f.deviceId);
        if (f.timeStart) params.set('timeStart', f.timeStart);
        if (f.timeEnd)   params.set('timeEnd', f.timeEnd);

        try {
            const d = await this.get(`/api/admin/logs?${params.toString()}`);
            if (!d?.ok) {
                Utils.showToast('获取日志失败', 'error');
                return;
            }

            const logs = d.logs || [];
            if (!logs.length) {
                Utils.showToast('没有可复制的日志', 'warn');
                return;
            }

            // 格式化为 AI 友好的纯文本
            let text = `# 客户端日志导出\n`;
            text += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
            text += `筛选条件: ${this._clfSummaryStr(f, d.total)}\n`;
            text += `日志条数: ${logs.length}\n\n`;
            text += `---\n\n`;

            for (const log of logs) {
                const time = Admin.fmtTime(log.created_at);
                const level = (log.level || 'log').toUpperCase();
                const type = log.type || 'console';
                const user = log.user_name ? `${log.user_name}(${log.sync_code || '?'})` : '未绑定设备';
                const page = (log.page_url || '').replace(/^https?:\/\/[^/]+/, '') || '-';

                text += `[${time}] [${level}] [${type}] 用户:${user} 页面:${page}\n`;
                text += `消息: ${log.message || '-'}\n`;
                if (log.stack) text += `堆栈:\n${log.stack}\n`;
                text += `\n`;
            }

            text += `---\n`;
            text += `请分析以上日志，找出主要错误模式和可能的原因，并给出修复建议。`;

            await navigator.clipboard.writeText(text);
            Utils.showToast(`✅ 已复制 ${logs.length} 条日志到剪贴板，可直接粘贴给 AI`, 'success', 3000);
        } catch (e) {
            Utils.showToast('复制失败: ' + e.message, 'error');
        }
    };
}
