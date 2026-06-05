import{A as b,U as o,P as T}from"./perf-DqLayIAb.js";function E(i){i.renderUsers=function(){var n,l,d,p;const a=document.getElementById("sec-users"),e=(((n=document.getElementById("search-input"))==null?void 0:n.value)||"").toUpperCase();let t=this.users.filter(c=>!e||c.id.includes(e)||c.initials.toUpperCase().includes(e));this.sort==="answered"?t.sort((c,r)=>r.total_answered-c.total_answered):this.sort==="duration"&&t.sort((c,r)=>r.total_duration-c.total_duration);const s=b.getSyncCode();a.innerHTML=`
            <div class="search-row">
                <div class="search-box"><span class="ic">${o.icon("search")}</span><input type="text" id="search-input" placeholder="搜索同步码或姓名..." value="${e||""}"></div>
                <button class="fbtn ${this.sort==="time"?"active":""}" onclick="Admin.setSort('time')">注册时间</button>
                <button class="fbtn ${this.sort==="answered"?"active":""}" onclick="Admin.setSort('answered')">答题数</button>
                <button class="fbtn ${this.sort==="duration"?"active":""}" onclick="Admin.setSort('duration')">时长</button>
            </div>
            <div class="card">
                <div class="card-header"><h3>用户列表</h3><span class="count">${t.length}/${this.users.length}</span><button class="abtn primary" style="padding:3px 10px;font-size:11px" onclick="Admin.exportCSV()">导出CSV</button></div>
                <div class="card-body" style="overflow-x:auto">
                    <table>
                        <thead><tr><th>同步码</th><th>姓名</th><th>设备</th><th>答题</th><th>正确率</th><th>时长</th><th>注册</th><th>状态</th><th>操作</th></tr></thead>
                        <tbody>${t.map(c=>this._userRow(c,s)).join("")}</tbody>
                    </table>
                </div>
            </div>
        `,(l=document.getElementById("search-input"))==null||l.addEventListener("input",()=>this.renderUsers()),(p=(d=o).initIcons)==null||p.call(d)},i._userRow=function(a,e){const t=a.total_answered>0?Math.round(a.total_correct/a.total_answered*100):0,s=t>=80?"#22c55e":t>=60?"#f59e0b":"#ef4444",n=o.escapeHtml(a.initials),l=o.jsSafe(a.initials),d=o.jsSafe(a.id);return`<tr style="cursor:pointer" onclick="Admin.showUserDetail('${d}')">
            <td><span class="code">${a.id}</span></td>
            <td>${n}${a.is_admin?' <span class="badge b-admin">管理</span>':""}${a.id===e?' <span class="badge b-me">我</span>':""}</td>
            <td>${a.device_count}</td>
            <td><b>${a.total_answered}</b></td>
            <td><div class="acc-bar"><span>${t}%</span><div class="bar"><div class="fill" style="width:${t}%;background:${s}"></div></div></div></td>
            <td>${this.fmtDur(a.total_duration)}</td>
            <td>${i.fmtDate(a.created_at)||"-"}</td>
            <td>${a.banned?'<span class="badge b-ban">封禁</span>':'<span style="color:#22c55e">正常</span>'}</td>
            <td style="white-space:nowrap" onclick="event.stopPropagation()">
                ${a.id!==e?`<button class="abtn ${a.banned?"":"warn"}" onclick="Admin.banUser('${d}','${l}',${a.banned?0:1})">${a.banned?"解封":"封禁"}</button>`:""}
                ${!a.is_admin&&a.id!==e?`<button class="abtn danger" onclick="Admin.delUser('${d}','${l}')">删除</button>`:""}
            </td>
        </tr>`},i.setSort=function(a){this.sort=a,this.renderUsers()},i.showUserDetail=async function(a){const e=document.getElementById("sec-users");e.innerHTML='<div class="loading">加载中...</div>';try{const t=await this.get(`/api/admin/user-detail/${a}`);if(!(t!=null&&t.ok)){e.innerHTML='<div class="empty-state">加载失败</div>';return}const s=t.user,n=t.stats.reduce((u,y)=>u+y.answered,0),l=t.stats.reduce((u,y)=>u+y.correct,0),d=t.stats.reduce((u,y)=>u+y.duration,0),p=o.escapeHtml(s.initials),c=o.jsSafe(s.initials),r=o.jsSafe(s.id),m=b.getSyncCode();e.innerHTML=`
                <!-- 返回按钮 -->
                <div style="margin-bottom:16px">
                    <button class="abtn" onclick="Admin.renderUsers()" style="display:flex;align-items:center;gap:6px">
                        ← 返回用户列表
                    </button>
                </div>
                
                <!-- 用户信息卡片 -->
                <div class="card" style="margin-bottom:16px">
                    <div class="card-header">
                        <h3>${p} <span class="code">${s.id}</span>${s.is_admin?' <span class="badge b-admin">管理</span>':""}${s.banned?' <span class="badge b-ban">封禁</span>':""}</h3>
                    </div>
                    <div class="card-body" style="padding:16px">
                        <div class="d-grid">
                            <div class="d-item"><div class="dl">注册时间</div><div class="dv">${i.fmtTime(s.created_at)||"-"}</div></div>
                            <div class="d-item"><div class="dl">设备数量</div><div class="dv">${t.devices.length}台</div></div>
                            <div class="d-item"><div class="dl">总答题</div><div class="dv">${n}</div></div>
                            <div class="d-item"><div class="dl">正确率</div><div class="dv">${n>0?Math.round(l/n*100):0}%</div></div>
                            <div class="d-item"><div class="dl">总时长</div><div class="dv">${this.fmtDur(d)}</div></div>
                            <div class="d-item"><div class="dl">题库数</div><div class="dv">${t.stats.length}个</div></div>
                        </div>
                    </div>
                </div>
                
                <!-- 操作按钮 -->
                <div class="card" style="margin-bottom:16px">
                    <div class="card-header"><h3>操作</h3></div>
                    <div class="card-body" style="padding:16px">
                        <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <button class="abtn primary" onclick="Admin.editUser('${r}','${c}',${s.is_admin?1:0})">编辑信息</button>
                            <button class="abtn primary" onclick="Admin.changeSyncCode('${r}','${c}')">修改同步码</button>
                            <button class="abtn primary" onclick="Admin.adjustStats('${r}','${c}')">调整数据</button>
                            <button class="abtn primary" onclick="Admin.viewCloudData('${r}')">查看云端数据</button>
                            ${s.id!==m?`<button class="abtn ${s.banned?"":"warn"}" onclick="Admin.banUser('${r}','${c}',${s.banned?0:1})">${s.banned?"解封":"封禁"}</button>`:""}
                            ${s.is_admin?"":`<button class="abtn danger" onclick="Admin.resetStats('${r}','${c}')">重置数据</button><button class="abtn danger" onclick="Admin.delUser('${r}','${c}')">删除用户</button>`}
                        </div>
                    </div>
                </div>
                
                <!-- 设备列表 -->
                ${t.devices.length?`
                <div class="card" style="margin-bottom:16px">
                    <div class="card-header"><h3>设备列表</h3><span class="count">${t.devices.length}台</span></div>
                    <div class="card-body" style="padding:12px">
                        ${t.devices.map(u=>{const y=o.jsSafe(u.device_id);return`<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-hover);border-radius:8px;margin-bottom:6px;font-size:12px">
                                <code style="color:var(--text-tertiary);flex:1;overflow:hidden;text-overflow:ellipsis">${o.escapeHtml(u.device_id)}</code>
                                <span style="color:var(--text-tertiary);font-size:11px">${i.fmtDate(u.bound_at)||""}</span>
                                <button class="abtn danger" style="padding:2px 8px;font-size:10px" onclick="Admin.removeDevice('${y}','${r}')">解绑</button>
                            </div>`}).join("")}
                    </div>
                </div>`:""}
                
                <!-- 题库明细 -->
                ${t.stats.length?`
                <div class="card">
                    <div class="card-header"><h3>答题统计</h3><span class="count">${t.stats.length}个题库</span></div>
                    <div class="card-body" style="overflow-x:auto">
                        <table>
                            <thead><tr><th>题库</th><th style="text-align:right">答题</th><th style="text-align:right">正确</th><th style="text-align:right">正确率</th><th style="text-align:right">时长</th></tr></thead>
                            <tbody>${t.stats.map(u=>{const y=u.answered>0?Math.round(u.correct/u.answered*100):0,v=y>=80?"#22c55e":y>=60?"#f59e0b":"#ef4444";return`<tr>
                                    <td>${o.escapeHtml(u.bank_name||u.bank_id)}</td>
                                    <td style="text-align:right">${u.answered}</td>
                                    <td style="text-align:right">${u.correct}</td>
                                    <td style="text-align:right"><span style="color:${v};font-weight:600">${y}%</span></td>
                                    <td style="text-align:right">${this.fmtDur(u.duration)}</td>
                                </tr>`}).join("")}</tbody>
                        </table>
                    </div>
                </div>`:""}
            `}catch(t){e.innerHTML=`
                <div style="margin-bottom:16px">
                    <button class="abtn" onclick="Admin.renderUsers()">← 返回用户列表</button>
                </div>
                <div class="empty-state">加载失败: ${t.message}</div>
            `}},i.editUser=function(a,e,t){const s=o.escapeHtml(e);document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:400px">
                    <h3>编辑用户</h3>
                    <label>姓名</label><input id="eu-initials" value="${s}" maxlength="4">
                    <label>管理员</label><select id="eu-admin"><option value="0" ${t?"":"selected"}>否</option><option value="1" ${t?"selected":""}>是</option></select>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.saveUser('${o.jsSafe(a)}')">保存</button></div>
                </div>
            </div>`},i.saveUser=async function(a){var t;const e=await this.post("/api/admin/update-user",{targetUserId:a,initials:document.getElementById("eu-initials").value.trim(),isAdmin:parseInt(document.getElementById("eu-admin").value)});e!=null&&e.ok?(o.showToast("已保存","success"),(t=document.querySelector(".modal-mask"))==null||t.remove(),await this.loadAll(),this.showUserDetail(a)):o.showToast((e==null?void 0:e.error)||"失败","error")},i.changeSyncCode=function(a,e){document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:400px">
                    <h3>修改同步码</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">用户: ${o.escapeHtml(e)} (${a})</p>
                    <label>新同步码</label><input id="new-sync-code" value="${a}" maxlength="6" style="text-transform:uppercase">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doChangeSyncCode('${o.jsSafe(a)}')">确认修改</button></div>
                </div>
            </div>`},i.doChangeSyncCode=async function(a){var s;const e=document.getElementById("new-sync-code").value.trim().toUpperCase();if(!e||e.length<4){o.showToast("请输入有效同步码","error");return}const t=await this.post("/api/admin/change-sync-code",{oldUserId:a,newUserId:e});t!=null&&t.ok?(o.showToast("已修改","success"),(s=document.querySelector(".modal-mask"))==null||s.remove(),await this.loadAll(),this.renderUsers()):o.showToast((t==null?void 0:t.error)||"失败","error")},i.adjustStats=function(a,e){document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:400px">
                    <h3>调整数据</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">用户: ${o.escapeHtml(e)} (${a})</p>
                    <label>题库ID</label><input id="adj-bank-id" placeholder="题库ID">
                    <label>题库名称</label><input id="adj-bank-name" placeholder="题库名称（可选）">
                    <label>添加答题数</label><input id="adj-answered" type="number" value="0">
                    <label>添加正确数</label><input id="adj-correct" type="number" value="0">
                    <label>添加时长(秒)</label><input id="adj-duration" type="number" value="0">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doAdjustStats('${o.jsSafe(a)}')">确认</button></div>
                </div>
            </div>`},i.doAdjustStats=async function(a){var t;const e=await this.post("/api/admin/adjust-stats",{targetUserId:a,bankId:document.getElementById("adj-bank-id").value.trim(),bankName:document.getElementById("adj-bank-name").value.trim(),answered:parseInt(document.getElementById("adj-answered").value)||0,correct:parseInt(document.getElementById("adj-correct").value)||0,duration:parseInt(document.getElementById("adj-duration").value)||0});e!=null&&e.ok?(o.showToast("已调整","success"),(t=document.querySelector(".modal-mask"))==null||t.remove(),await this.loadAll(),this.showUserDetail(a)):o.showToast((e==null?void 0:e.error)||"失败","error")},i.viewCloudData=async function(a){var s,n;const e=await this.get(`/api/admin/user-cloud-data/${a}`);if(!(e!=null&&e.ok)){o.showToast("获取失败","error");return}const t="background:#f9fafb;padding:8px;border-radius:6px;font-size:11px;overflow-x:auto;margin-top:4px;color:#1f2937";document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:500px;max-height:80vh;overflow-y:auto">
                    <h3>云端数据 - ${o.escapeHtml(((s=e.user)==null?void 0:s.initials)||a)}</h3>
                    <p style="font-size:11px;color:var(--text-tertiary);margin-bottom:8px">最后同步: ${i.fmtTime((n=e.user)==null?void 0:n.lastSyncAt)||"无"}</p>
                    <div style="margin-bottom:8px">
                        <strong style="font-size:12px">设置:</strong>
                        <pre style="${t}">${o.escapeHtml(JSON.stringify(e.settings||{},null,2))}</pre>
                    </div>
                    <div>
                        <strong style="font-size:12px">进度:</strong>
                        <pre style="${t}">${o.escapeHtml(JSON.stringify(e.progress||{},null,2))}</pre>
                    </div>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">关闭</button></div>
                </div>
            </div>`},i.banUser=async function(a,e,t){if(!confirm(`${t?"封禁":"解封"} ${e}？`))return;const s=await this.post("/api/admin/ban-user",{targetUserId:a,banned:!!t});if(!(s!=null&&s.ok)){o.showToast((s==null?void 0:s.error)||"操作失败","error");return}o.showToast(t?"已封禁":"已解封","success"),await this.loadAll(),this.showUserDetail(a)},i.resetStats=async function(a,e){if(!confirm(`重置 ${e} 的答题数据？`))return;const t=await this.post("/api/admin/reset-stats",{targetUserId:a});t!=null&&t.ok&&(o.showToast("已重置","success"),await this.loadAll(),this.showUserDetail(a))},i.delUser=async function(a,e){if(!confirm(`永久删除 ${e}？`))return;const t=await this.post("/api/admin/delete-user",{targetUserId:a});t!=null&&t.ok&&(o.showToast("已删除","success"),await this.loadAll(),this.renderUsers())},i.removeDevice=async function(a,e){if(!confirm("解绑此设备？"))return;const t=await this.post("/api/admin/remove-device",{deviceId:a});t!=null&&t.ok&&(o.showToast("已解绑","success"),this.showUserDetail(e))},i.fmtDate=function(a){if(!a)return"";try{return new Date(a).toLocaleDateString("zh-CN")}catch{return""}},i.fmtTime=function(a){if(!a)return"";try{return new Date(a).toLocaleString("zh-CN")}catch{return""}},i.fmtDur=function(a){if(!a)return"0分";const e=Math.floor(a/3600),t=Math.floor(a%3600/60);return e?`${e}时${t}分`:`${t}分`}}function I(i){i.renderBanks=async function(){const e=document.getElementById("sec-banks");e.innerHTML='<div class="loading">加载中...</div>';try{const t=await this.get("/api/banks");if(!(t!=null&&t.ok)){e.innerHTML='<div class="empty-state">加载失败</div>';return}e.innerHTML=`
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 style="font-size:16px;font-weight:700">题库管理</h3>
                    <div style="display:flex;gap:8px">
                        <button class="abtn" onclick="Admin.clearLocalCache()">清除本地缓存</button>
                        <button class="abtn primary" onclick="Admin.uploadBank()">上传题库</button>
                        <button class="abtn primary" onclick="Admin.createBank()">新建题库</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
                    ${t.banks.map(s=>`
                        <div class="card" style="cursor:pointer;transition:all 0.2s;${s.enabled===!1?"opacity:0.6;":""}" onclick="Admin.showBankDetail('${o.jsSafe(s.id)}')">
                            <div class="card-body" style="padding:16px">
                                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                                    <div>
                                        <h4 style="font-size:15px;font-weight:600;margin-bottom:4px">${o.escapeHtml(s.name)}</h4>
                                        <p style="font-size:11px;color:var(--text-tertiary)">${s.id}</p>
                                    </div>
                                    <span class="badge ${s.enabled!==!1?"b-admin":"b-ban"}">${s.enabled!==!1?"启用":"禁用"}</span>
                                </div>
                                <div style="display:flex;gap:16px;font-size:13px;color:var(--text-secondary)">
                                    <span>📝 ${s.question_count}题</span>
                                    <span>📂 ${o.escapeHtml(s.category||"未分类")}</span>
                                    <span>🔄 v${s.version}</span>
                                </div>
                                <div style="font-size:11px;color:var(--text-tertiary);margin-top:8px">
                                    更新: ${i.fmtTime(s.updated_at)||"-"}
                                </div>
                            </div>
                        </div>
                    `).join("")}
                </div>`}catch(t){e.innerHTML=`<div class="empty-state">加载失败: ${t.message}</div>`}};const a=[{key:"all",label:"顺序刷题",icon:"list"},{key:"random",label:"随机",icon:"shuffle"},{key:"shuffle_options",label:"选项乱序",icon:"refresh-cw"},{key:"wrong",label:"错题",icon:"alert-circle"},{key:"review",label:"背题",icon:"book-open"},{key:"spaced",label:"复习",icon:"brain"},{key:"bookmark",label:"收藏",icon:"star"},{key:"exam",label:"考试",icon:"file-text"}];i.showBankDetail=async function(e){const t=document.getElementById("sec-banks");t.innerHTML='<div class="loading">加载中...</div>';try{const s=await this.get(`/api/admin/bank/${e}`);if(!(s!=null&&s.ok)){t.innerHTML='<div class="empty-state">加载失败</div>';return}const n=s.bank,l=n.questions||[],d=n.allowed_modes,p=a.map(m=>{const u=!d||d.includes(m.key);return`<label style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px;${u?"background:var(--primary-light);border-color:var(--primary);":""}">
                    <input type="checkbox" data-mode="${m.key}" ${u?"checked":""} style="margin:0">
                    ${m.label}
                </label>`}).join(" "),c={};l.forEach(m=>{const u=m.type||"unknown";c[u]=(c[u]||0)+1});const r={single:"单选",multiple:"多选",judge:"判断",fill:"填空",essay:"简答",multi:"多选"};t.innerHTML=`
                <!-- 返回按钮 -->
                <div style="margin-bottom:16px">
                    <button class="abtn" onclick="Admin.renderBanks()">← 返回题库列表</button>
                </div>
                
                <!-- 题库信息 -->
                <div class="card" style="margin-bottom:12px">
                    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                        <h3>${o.escapeHtml(n.name)} <span style="font-size:11px;color:var(--text-tertiary)">${n.id}</span></h3>
                        <div style="display:flex;gap:8px;align-items:center">
                            <button class="abtn" onclick="Admin.editBankInfo('${o.jsSafe(e)}')" style="font-size:11px;padding:3px 10px">✏️ 编辑信息</button>
                            <span class="badge ${n.enabled!==!1?"b-admin":"b-ban"}">${n.enabled!==!1?"已启用":"已禁用"}</span>
                        </div>
                    </div>
                    <div class="card-body" style="padding:12px">
                        ${n.description?`<div style="margin-bottom:12px;padding:8px 12px;background:var(--bg-hover);border-radius:var(--radius);font-size:13px;color:var(--text-secondary)">${o.escapeHtml(n.description)}</div>`:""}
                        <div class="d-grid">
                            <div class="d-item"><div class="dl">题目数</div><div class="dv">${l.length}</div></div>
                            <div class="d-item"><div class="dl">版本</div><div class="dv">v${n.version}</div></div>
                            <div class="d-item"><div class="dl">分类</div><div class="dv">${o.escapeHtml(n.category||"未分类")}</div></div>
                            <div class="d-item"><div class="dl">更新时间</div><div class="dv">${i.fmtTime(n.updated_at)||"-"}</div></div>
                        </div>
                    </div>
                </div>
                
                <!-- 题型分布 -->
                <div class="card" style="margin-bottom:12px">
                    <div class="card-header"><h3>题型分布</h3></div>
                    <div class="card-body" style="padding:12px">
                        <div style="display:flex;gap:8px;flex-wrap:wrap">
                            ${Object.entries(c).map(([m,u])=>`
                                <div style="flex:1;min-width:80px;padding:8px;background:var(--bg-hover);border-radius:var(--radius);text-align:center">
                                    <div style="font-size:16px;font-weight:700;color:var(--primary)">${u}</div>
                                    <div style="font-size:11px;color:var(--text-tertiary)">${r[m]||m}</div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                </div>
                
                <!-- 操作 -->
                <div class="card" style="margin-bottom:12px">
                    <div class="card-header"><h3>题目操作</h3></div>
                    <div class="card-body" style="padding:12px">
                        <div style="display:flex;gap:6px;flex-wrap:wrap">
                            <button class="abtn primary" onclick="Admin.showQuestionList('${o.jsSafe(e)}', '${o.jsSafe(n.name)}')">管理题目 (${l.length})</button>
                            <button class="abtn primary" onclick="Admin.addQuestion('${o.jsSafe(e)}')">添加题目</button>
                            <button class="abtn primary" onclick="Admin.importQuestions('${o.jsSafe(e)}')">批量导入</button>
                            <button class="abtn" onclick="Admin.viewBankHistory('${o.jsSafe(e)}')">修改历史</button>
                        </div>
                    </div>
                </div>
                
                <!-- 做题模式设置 -->
                <div class="card" style="margin-bottom:12px">
                    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                        <h3>允许的做题模式</h3>
                        <div style="display:flex;gap:8px;align-items:center">
                            <label style="font-size:12px;color:var(--text-tertiary);cursor:pointer"><input type="checkbox" id="modes-select-all" onchange="Admin.toggleAllModes(this.checked)" ${d?"":"checked"}> 全选</label>
                            <button class="abtn primary" style="padding:3px 10px;font-size:11px" onclick="Admin.saveBankModes('${o.jsSafe(e)}')">保存</button>
                        </div>
                    </div>
                    <div class="card-body" style="padding:12px">
                        <div id="bank-modes-list" style="display:flex;flex-wrap:wrap;gap:6px">${p}</div>
                    </div>
                </div>
                
                <!-- 底部操作 -->
                <div style="display:flex;gap:6px;justify-content:flex-end">
                    <button class="abtn ${n.enabled!==!1?"success":""}" onclick="Admin.toggleBank('${o.jsSafe(e)}', ${n.enabled===!1})">${n.enabled!==!1?"已启用":"已禁用"}</button>
                    <button class="abtn" onclick="Admin.uploadBank('${o.jsSafe(e)}')">替换题库</button>
                    <button class="abtn danger" onclick="Admin.confirmDeleteBank('${o.jsSafe(e)}', '${o.jsSafe(n.name)}')">删除题库</button>
                </div>
            `}catch(s){t.innerHTML=`
                <div style="margin-bottom:16px">
                    <button class="abtn" onclick="Admin.renderBanks()">← 返回题库列表</button>
                </div>
                <div class="empty-state">加载失败: ${s.message}</div>
            `}},i.showQuestionList=async function(e,t){const s=document.getElementById("sec-banks");s.innerHTML='<div class="loading">加载中...</div>';try{const n=await this.get(`/api/admin/bank/${e}`);if(!(n!=null&&n.ok)){s.innerHTML='<div class="empty-state">加载失败</div>';return}const l=n.bank.questions||[];s.innerHTML=`
                <!-- 返回按钮 -->
                <div style="margin-bottom:16px">
                    <button class="abtn" onclick="Admin.showBankDetail('${o.jsSafe(e)}')" style="display:flex;align-items:center;gap:6px">
                        ← 返回题库详情
                    </button>
                </div>
                
                <div class="card">
                    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                        <h3>${o.escapeHtml(t||e)} - 题目列表</h3>
                        <div style="display:flex;gap:6px;align-items:center">
                            <span class="count">${l.length}题</span>
                            <button class="abtn primary" style="padding:3px 10px;font-size:11px" onclick="Admin.addQuestion('${o.jsSafe(e)}')">添加题目</button>
                        </div>
                    </div>
                    <div class="card-body" style="padding:12px">
                        <div style="display:flex;gap:8px;margin-bottom:12px">
                            <input type="text" id="bank-search" placeholder="搜索题目..." style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg-card);color:var(--text)" oninput="Admin.filterBankQuestions('${o.jsSafe(e)}')">
                            <select id="bank-type-filter" style="padding:8px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg-card);color:var(--text)" onchange="Admin.filterBankQuestions('${o.jsSafe(e)}')">
                                <option value="">全部题型</option><option value="single">单选</option><option value="multiple">多选</option><option value="judge">判断</option><option value="fill">填空</option><option value="essay">简答</option>
                            </select>
                        </div>
                        <div id="bank-questions-list">${this._renderQuestionList(e,l)}</div>
                    </div>
                </div>
            `}catch(n){s.innerHTML=`
                <div style="margin-bottom:16px">
                    <button class="abtn" onclick="Admin.showBankDetail('${o.jsSafe(e)}')">← 返回题库详情</button>
                </div>
                <div class="empty-state">加载失败: ${n.message}</div>
            `}},i.toggleAllModes=function(e){document.querySelectorAll("#bank-modes-list input[type=checkbox]").forEach(t=>{t.checked=e,t.closest("label").style.background=e?"var(--primary-light)":"",t.closest("label").style.borderColor=e?"var(--primary)":""})},i.saveBankModes=async function(e){const t=document.querySelectorAll("#bank-modes-list input[type=checkbox]"),s=Array.from(t).filter(l=>l.checked).map(l=>l.dataset.mode),n=await this.post(`/api/admin/bank/${e}/modes`,{allowedModes:s.length===a.length?null:s});n!=null&&n.ok?o.showToast("已保存","success"):o.showToast((n==null?void 0:n.error)||"失败","error")},i._renderQuestionList=function(e,t){const s={single:"单选",multiple:"多选",judge:"判断",fill:"填空",essay:"简答",multi:"多选"};return t.map(n=>`
            <div class="question-item" data-qid="${n.id}" style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;transition:all 0.2s" onclick="Admin.editQuestion('${o.jsSafe(e)}',${n.id})">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                    <div style="flex:1;min-width:0">
                        <span style="color:var(--text-tertiary);font-size:11px">#${n.id}</span>
                        <span class="question-type" style="background:var(--bg-hover);padding:2px 8px;border-radius:10px;font-size:10px;margin-left:6px">${s[n.type]||n.type||"?"}</span>
                        ${n.category?`<span class="question-category" style="background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:10px;font-size:10px;margin-left:4px">${o.escapeHtml(n.category)}</span>`:""}
                        <span class="question-preview" style="margin-left:6px;font-size:13px">${o.escapeHtml((n.question||"").slice(0,80))}${(n.question||"").length>80?"...":""}</span>
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        <button class="abtn" style="padding:3px 10px;font-size:11px" onclick="event.stopPropagation();Admin.editQuestion('${o.jsSafe(e)}',${n.id})">编辑</button>
                        <button class="abtn danger" style="padding:3px 10px;font-size:11px" onclick="event.stopPropagation();Admin.deleteQuestion('${o.jsSafe(e)}',${n.id})">删除</button>
                    </div>
                </div>
            </div>
        `).join("")},i.filterBankQuestions=async function(e){var d,p;const t=(((d=document.getElementById("bank-search"))==null?void 0:d.value)||"").toLowerCase(),s=((p=document.getElementById("bank-type-filter"))==null?void 0:p.value)||"",n=await this.get(`/api/admin/bank/${e}`);if(!(n!=null&&n.ok))return;let l=n.bank.questions||[];s&&(l=l.filter(c=>c.type===s)),t&&(l=l.filter(c=>(c.question||"").toLowerCase().includes(t))),document.getElementById("bank-questions-list").innerHTML=this._renderQuestionList(e,l)},i.uploadBank=function(e){document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:500px">
                    <h3>${e?"替换题库 "+e:"上传题库"}</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">JSON格式，含 id, name, questions 字段</p>
                    <input type="file" id="upload-bank-file" accept=".json" style="margin:12px 0">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doUploadBank('${e||""}')">上传</button></div>
                </div>
            </div>`},i.doUploadBank=async function(e){var s;const t=document.getElementById("upload-bank-file").files[0];if(!t){o.showToast("请选择文件","error");return}try{const n=await t.text(),l=JSON.parse(n),d=await this.post("/api/admin/upload-bank",{bank:l,existingId:e||null});d!=null&&d.ok?(o.showToast("上传成功","success"),(s=document.querySelector(".modal-mask"))==null||s.remove(),this.renderBanks()):o.showToast((d==null?void 0:d.error)||"失败","error")}catch{o.showToast("JSON格式错误","error")}},i.createBank=function(){document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:400px">
                    <h3>新建题库</h3>
                    <label>题库ID</label><input id="new-bank-id" placeholder="英文，如 math-101">
                    <label>题库名称</label><input id="new-bank-name" placeholder="如 高等数学">
                    <label>分类</label><input id="new-bank-category" placeholder="如 数学">
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doCreateBank()">创建</button></div>
                </div>
            </div>`},i.doCreateBank=async function(){var l;const e=document.getElementById("new-bank-id").value.trim(),t=document.getElementById("new-bank-name").value.trim(),s=document.getElementById("new-bank-category").value.trim();if(!e||!t){o.showToast("请填写ID和名称","error");return}const n=await this.post("/api/admin/create-bank",{id:e,name:t,category:s});n!=null&&n.ok?(o.showToast("创建成功","success"),(l=document.querySelector(".modal-mask"))==null||l.remove(),this.renderBanks()):o.showToast((n==null?void 0:n.error)||"失败","error")},i.toggleBank=async function(e,t){const s=await this.put(`/api/admin/bank/${e}/toggle`,{enabled:t});s!=null&&s.ok?(o.showToast(t?"已启用":"已禁用","success"),this.renderBanks()):o.showToast((s==null?void 0:s.error)||"失败","error")},i.confirmDeleteBank=function(e,t){document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:400px">
                    <h3>确认删除题库？</h3>
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">题库: ${o.escapeHtml(t)} (${e})</p>
                    <p style="font-size:12px;color:var(--danger)">⚠️ 此操作不可恢复，所有题目数据将被删除！</p>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="abtn danger" onclick="Admin.doDeleteBank('${o.jsSafe(e)}')">确认删除</button></div>
                </div>
            </div>`},i.doDeleteBank=async function(e){var s;const t=await this.delete(`/api/admin/bank/${e}`);t!=null&&t.ok?(o.showToast("已删除","success"),(s=document.querySelector(".modal-mask"))==null||s.remove(),this.renderBanks()):o.showToast((t==null?void 0:t.error)||"失败","error")},i.clearLocalCache=function(){document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:400px">
                    <h3>清除本地数据</h3>
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">清除浏览器中的所有本地数据（进度、设置、历史、收藏）。</p>
                    <p style="font-size:12px;color:var(--danger);margin-bottom:16px">⚠️ 此操作不可恢复！所有本地进度和设置将丢失！</p>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="abtn danger" onclick="Admin.doClearLocalCache()">确认清除</button></div>
                </div>
            </div>`},i.doClearLocalCache=function(){var e;try{Storage.clearAll(),console.log("[Admin] ✅ 本地数据已清除"),o.showToast("本地数据已清除，2秒后刷新页面","success"),(e=document.querySelector(".modal-mask"))==null||e.remove(),setTimeout(()=>location.reload(),2e3)}catch(t){console.error("[Admin] 清除数据失败:",t),o.showToast("清除失败: "+t.message,"error")}},i.editBankInfo=async function(e){const t=await this.get(`/api/admin/bank/${e}`);if(!(t!=null&&t.ok)){o.showToast("获取题库信息失败","error");return}const s=t.bank;document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:450px">
                    <h3>编辑题库信息</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px">ID: ${o.escapeHtml(s.id)}</p>
                    
                    <label style="font-size:12px;font-weight:600;margin-bottom:4px;display:block">题库名称 *</label>
                    <input id="edit-bank-name" value="${o.escapeHtml(s.name)}" placeholder="题库名称" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg-card);color:var(--text);margin-bottom:12px">
                    
                    <label style="font-size:12px;font-weight:600;margin-bottom:4px;display:block">题库描述</label>
                    <textarea id="edit-bank-desc" rows="3" placeholder="题库描述（可选）" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg-card);color:var(--text);margin-bottom:12px;resize:vertical">${o.escapeHtml(s.description||"")}</textarea>
                    
                    <label style="font-size:12px;font-weight:600;margin-bottom:4px;display:block">分类</label>
                    <input id="edit-bank-category" value="${o.escapeHtml(s.category||"")}" placeholder="如：数学、编程、英语" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg-card);color:var(--text);margin-bottom:16px">
                    
                    <div class="modal-actions">
                        <button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button>
                        <button class="mp" onclick="Admin.doEditBankInfo('${o.jsSafe(e)}')">保存</button>
                    </div>
                </div>
            </div>`},i.doEditBankInfo=async function(e){var d;const t=document.getElementById("edit-bank-name").value.trim(),s=document.getElementById("edit-bank-desc").value.trim(),n=document.getElementById("edit-bank-category").value.trim();if(!t){o.showToast("题库名称不能为空","error");return}const l=await this.put(`/api/admin/bank/${e}/settings`,{name:t,description:s,category:n});l!=null&&l.ok?(o.showToast("题库信息已更新","success"),(d=document.querySelector(".modal-mask"))==null||d.remove(),this.showBankDetail(e)):o.showToast((l==null?void 0:l.error)||"更新失败","error")},i.viewBankHistory=async function(e){const t=await this.get(`/api/admin/bank/${e}/history`);if(!(t!=null&&t.ok)){o.showToast("获取失败","error");return}const s={};this.users&&this.users.forEach(l=>{s[l.id]=l.initials});const n={add_question:"添加题目",edit_question:"编辑题目",delete_question:"删除题目",batch_import:"批量导入",toggle:"状态变更",update_settings:"更新设置",create:"创建题库",replace:"替换题库"};document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:500px;max-height:80vh;overflow-y:auto">
                    <h3>修改历史</h3>
                    <div style="margin-top:12px">${t.history.length?t.history.map(l=>{const d=s[l.operator]||l.operator||"未知";return`
                        <div style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px">
                            <div style="display:flex;justify-content:space-between;align-items:center">
                                <span style="font-weight:600;color:var(--text-secondary)">${n[l.action]||l.action}</span>
                                <span style="color:var(--text-tertiary);font-size:11px">${i.fmtTime(l.created_at)}</span>
                            </div>
                            <div style="margin-top:4px;color:var(--text-secondary)">${o.escapeHtml(l.detail)}</div>
                            <div style="margin-top:2px;color:var(--text-tertiary);font-size:11px">操作人: ${o.escapeHtml(d)} (${l.operator})</div>
                        </div>`}).join(""):'<div class="empty-state">暂无历史</div>'}</div>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">关闭</button></div>
                </div>
            </div>`},i.importQuestions=function(e){document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box" style="max-width:500px">
                    <h3>批量导入题目</h3>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">JSON数组格式，每题含 question, options, answer 等字段</p>
                    <textarea id="import-questions-json" rows="10" placeholder='[{"question":"题目","options":["A.","B."],"answer":"A"}]' style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:monospace"></textarea>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.doImportQuestions('${o.jsSafe(e)}')">导入</button></div>
                </div>
            </div>`},i.doImportQuestions=async function(e){var t;try{const s=JSON.parse(document.getElementById("import-questions-json").value);if(!Array.isArray(s))throw new Error("需要数组格式");const n=await this.post(`/api/admin/bank/${e}/import`,{questions:s});n!=null&&n.ok?(o.showToast(`已导入 ${n.added} 题`,"success"),(t=document.querySelector(".modal-mask"))==null||t.remove(),this.showBankDetail(e)):o.showToast((n==null?void 0:n.error)||"失败","error")}catch(s){o.showToast("JSON格式错误: "+s.message,"error")}},i.fmtTime=function(e){if(!e)return"";try{return new Date(e).toLocaleString("zh-CN")}catch{return""}}}const $={PROVIDERS:{wwpic:{name:"WwoPic",upload:(i,a)=>new Promise((e,t)=>{const s=new XMLHttpRequest,n=new FormData;n.append("file",i),n.append("storage_id","3"),s.upload.addEventListener("progress",l=>{l.lengthComputable&&a&&a(Math.round(l.loaded/l.total*100))}),s.addEventListener("load",()=>{var l;try{const d=JSON.parse(s.responseText);d.status==="success"&&((l=d.data)!=null&&l.public_url)?e({success:!0,url:d.data.public_url}):e({success:!1,error:d.message||"上传失败"})}catch{e({success:!1,error:"解析响应失败"})}}),s.addEventListener("error",()=>e({success:!1,error:"网络错误"})),s.open("POST","https://img.wwoyun.cn/api/v2/upload"),s.setRequestHeader("Authorization","Bearer 171|ZDEnLUKTwjfvXblPTp7mPsJnB71HZZOcB8fHeiyj401e1955"),s.send(n)})}},getProvider(){return"wwpic"},async upload(i,a){if(!i)return{success:!1,error:"请选择文件"};if(!["image/jpeg","image/png","image/gif","image/webp","image/bmp"].includes(i.type))return{success:!1,error:"仅支持 JPG/PNG/GIF/WebP/BMP 格式"};if(i.size>10*1024*1024)return{success:!1,error:"文件大小不能超过 10MB"};const t=this.getProvider(),s=this.PROVIDERS[t];if(!s)return{success:!1,error:"未知图床"};try{console.log(`[ImageUploader] 📤 上传到 ${s.name}...`);const n=await s.upload(i,a);return n.success&&console.log("[ImageUploader] ✅ 上传成功:",n.url),n}catch(n){return console.error("[ImageUploader] ❌ 上传异常:",n),{success:!1,error:"网络错误: "+n.message}}},showDialog(i){this.getProvider();const a=document.createElement("div");a.className="modal-mask",a.innerHTML=`
            <div class="modal-box" style="max-width: 400px;">
                <h3>📤 上传图片</h3>
                <div id="upload-area" style="border: 2px dashed var(--border); border-radius: var(--radius); padding: 30px; text-align: center; cursor: pointer; transition: all 0.2s;">
                    <div style="font-size: 36px; margin-bottom: 8px;">📁</div>
                    <div style="color: var(--text-secondary);">点击选择图片或拖拽到此处</div>
                    <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">支持 JPG/PNG/GIF/WebP，最大 10MB</div>
                    <input type="file" id="upload-file" accept="image/*" style="display: none;">
                </div>
                <div id="upload-preview" style="display: none; margin-top: 12px;">
                    <img id="preview-img" style="max-width: 100%; max-height: 200px; border-radius: var(--radius);">
                </div>
                <div id="upload-status" style="margin-top: 8px; font-size: 12px; color: var(--text-tertiary);"></div>
                <div class="modal-actions" style="margin-top: 16px;">
                    <button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button>
                    <button class="mp" id="btn-upload" disabled>上传</button>
                </div>
            </div>
        `,document.body.appendChild(a);const e=a.querySelector("#upload-area"),t=a.querySelector("#upload-file"),s=a.querySelector("#upload-preview"),n=a.querySelector("#preview-img"),l=a.querySelector("#upload-status"),d=a.querySelector("#btn-upload");let p=null;e.addEventListener("click",()=>t.click()),e.addEventListener("dragover",r=>{r.preventDefault(),e.style.borderColor="var(--primary)",e.style.background="var(--primary-light)"}),e.addEventListener("dragleave",()=>{e.style.borderColor="var(--border)",e.style.background=""}),e.addEventListener("drop",r=>{r.preventDefault(),e.style.borderColor="var(--border)",e.style.background="",r.dataTransfer.files.length>0&&c(r.dataTransfer.files[0])}),t.addEventListener("change",r=>{r.target.files.length>0&&c(r.target.files[0])});function c(r){p=r,s.style.display="block",n.src=URL.createObjectURL(r),l.textContent=`已选择: ${r.name} (${(r.size/1024).toFixed(1)}KB)`,d.disabled=!1}d.addEventListener("click",async()=>{if(!p)return;d.disabled=!0,d.textContent="上传中...",l.style.color="var(--text-tertiary)",l.innerHTML=`
                <div style="margin-top:8px">
                    <div style="background:var(--bg-hover);border-radius:4px;height:6px;overflow:hidden">
                        <div id="upload-progress-bar" style="background:var(--primary);height:100%;width:0%;transition:width 0.2s"></div>
                    </div>
                    <div id="upload-progress-text" style="font-size:11px;margin-top:4px;text-align:center">准备上传...</div>
                </div>
            `;const r=a.querySelector("#upload-progress-bar"),m=a.querySelector("#upload-progress-text"),u=await $.upload(p,y=>{r.style.width=y+"%",m.textContent=`上传中... ${y}%`});u.success?(r.style.width="100%",r.style.background="var(--success)",m.textContent="✅ 上传成功！",m.style.color="var(--success)",setTimeout(()=>{a.remove(),i&&i(u.url)},500)):(r.style.background="var(--danger)",m.textContent="❌ "+u.error,m.style.color="var(--danger)",d.disabled=!1,d.textContent="重试")}),a.addEventListener("click",r=>{r.target===a&&a.remove()})}};window.ImageUploader=$;function S(i){i.addQuestion=function(a){document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="qe-modal">
                    <div class="qe-header"><h3>添加题目</h3><button class="close-btn" onclick="this.closest('.modal-mask').remove()">✕</button></div>
                    ${this._editorHTML(a,null,!0)}
                </div>
            </div>`,this._preview()},i.editQuestion=async function(a,e){const t=await this.get(`/api/admin/bank/${a}`);if(!(t!=null&&t.ok))return;const s=(t.bank.questions||[]).find(n=>n.id===e);if(!s){o.showToast("题目不存在","error");return}document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="qe-modal">
                    <div class="qe-header"><h3>编辑题目 #${e}</h3><button class="close-btn" onclick="this.closest('.modal-mask').remove()">✕</button></div>
                    ${this._editorHTML(a,s,!1)}
                </div>
            </div>`,this._preview()},i._editorHTML=function(a,e,t){const s=(e==null?void 0:e.type)||"single",n=e==null?void 0:e.answer,l=(e==null?void 0:e.options)||[],d=(e==null?void 0:e.difficulty)||1,p=s==="single"||s==="multiple"||s==="multi",c=s==="judge",r=s==="essay"||s==="fill";let m="";s==="judge"?m=n===!0?"true":n===!1?"false":"":Array.isArray(n)?m=n.join(""):m=String(n||"");let u="";if(p){const v="ABCDEFGH",h=l.map(g=>typeof g=="string"?{text:g,img:""}:{text:g.text||"",img:g.img||""});for(;h.length<4;)h.push({text:"",img:""});u=h.map((g,f)=>{const x=v[f],k=m.includes(x),q=g.img?`<img src="${o.escapeHtml(g.img)}" style="max-width:60px;max-height:40px;border-radius:4px;margin-left:4px;vertical-align:middle;border:1px solid var(--border)">`:"",B=g.img?'<button type="button" class="abtn danger" style="padding:1px 4px;font-size:10px" onclick="event.stopPropagation();Admin._removeOptionImage(this)" title="删除选项图片">🗑️</button>':"";return`<div class="qe-opt-item ${k?"selected":""}" data-letter="${x}" onclick="Admin._selectOption('${x}')">
                    <span class="qe-opt-indicator ${s==="multiple"||s==="multi"?"checkbox":"radio"}">${k?s==="multiple"||s==="multi"?"☑":"●":s==="multiple"||s==="multi"?"☐":"○"}</span>
                    <span class="qe-opt-letter">${x}.</span>
                    <input class="qe-opt-input" value="${o.escapeHtml(g.text)}" placeholder="输入选项内容..." oninput="Admin._preview()" onclick="event.stopPropagation()">
                    <input type="hidden" class="qe-opt-img" value="${o.escapeHtml(g.img)}">
                    ${q}
                    <button type="button" class="abtn" style="padding:1px 4px;font-size:10px" onclick="event.stopPropagation();Admin._uploadOptionImage(this)" title="添加选项图片">📷</button>
                    ${B}
                    <button class="qe-opt-del" onclick="event.stopPropagation();Admin._removeOption(this)" title="删除选项">✕</button>
                </div>`}).join("")}let y="";return r&&(y=`<div class="qe-fill-wrap">
                <textarea id="eq-fill-answer" rows="3" placeholder="输入参考答案..." oninput="Admin._preview()">${o.escapeHtml(m)}</textarea>
            </div>`),`
        <div class="qe-tabs">
            <button class="qe-tab active" onclick="Admin._switchEditorTab('edit')" id="qe-tab-edit">编辑</button>
            <button class="qe-tab" onclick="Admin._switchEditorTab('preview')" id="qe-tab-preview">预览</button>
        </div>
        <div class="qe-body">
            <div class="qe-panel active" id="qe-panel-edit">
                <div class="qe-row">
                    <div class="qe-field">
                        <label>题型</label>
                        <select id="eq-type" onchange="Admin._onTypeChange()">
                            <option value="single" ${s==="single"?"selected":""}>单选题</option>
                            <option value="multiple" ${s==="multiple"||s==="multi"?"selected":""}>多选题</option>
                            <option value="judge" ${s==="judge"?"selected":""}>判断题</option>
                            <option value="fill" ${s==="fill"?"selected":""}>填空题</option>
                            <option value="essay" ${s==="essay"?"selected":""}>简答题</option>
                        </select>
                    </div>
                    <div class="qe-field">
                        <label>难度</label>
                        <div class="qe-stars" id="eq-diff-stars">
                            ${[1,2,3].map(v=>`<span class="qe-star ${v<=d?"on":""}" onclick="Admin._setDiff(${v})">★</span>`).join("")}
                        </div>
                        <input type="hidden" id="eq-difficulty" value="${d}">
                    </div>
                </div>
                <div class="qe-field">
                    <label>分类</label>
                    <input id="eq-category" value="${o.escapeHtml((e==null?void 0:e.category)||"")}" placeholder="如: 编程指令">
                </div>
                <div class="qe-field">
                    <label>题目内容</label>
                    <textarea id="eq-question" rows="3" placeholder="输入题目内容..." oninput="Admin._preview()">${o.escapeHtml((e==null?void 0:e.question)||"")}</textarea>
                    <div style="display:flex;gap:8px;margin-top:6px;align-items:center">
                        <button type="button" class="abtn primary" style="padding:4px 10px;font-size:11px" onclick="Admin._uploadQuestionImage()">📷 添加题目图片</button>
                        <input type="text" id="eq-img" value="${o.escapeHtml((e==null?void 0:e.img)||(e==null?void 0:e.image)||"")}" placeholder="或直接输入图片URL" style="flex:1;padding:4px 8px;font-size:11px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-card);color:var(--text)">
                    </div>
                    <div id="eq-img-preview" style="${e!=null&&e.img||e!=null&&e.image?"":"display:none"};margin-top:6px">
                        <img id="eq-img-thumb" src="${o.escapeHtml((e==null?void 0:e.img)||(e==null?void 0:e.image)||"")}" style="max-width:200px;max-height:100px;border-radius:var(--radius);border:1px solid var(--border)">
                        <button type="button" class="abtn danger" style="padding:2px 6px;font-size:10px;margin-left:4px" onclick="Admin._removeQuestionImage()">删除</button>
                    </div>
                </div>
                <div class="qe-field" id="eq-options-wrap" style="${p?"":"display:none"}">
                    <label>选项 <span class="qe-hint">点击选项设为答案 | 支持选项图片</span></label>
                    <div class="qe-opt-list" id="eq-options-list">${u}</div>
                    <button type="button" class="qe-add-opt" onclick="Admin._addOption()">+ 添加选项</button>
                </div>
                <div class="qe-field" id="eq-judge-wrap" style="${c?"":"display:none"}">
                    <label>答案</label>
                    <div class="qe-judge-btns">
                        <button type="button" class="qe-judge-btn ${m==="true"?"active":""}" onclick="Admin._setJudge(true)" id="eq-judge-true">正确</button>
                        <button type="button" class="qe-judge-btn ${m==="false"?"active":""}" onclick="Admin._setJudge(false)" id="eq-judge-false">错误</button>
                    </div>
                </div>
                <div class="qe-field" id="eq-fill-wrap" style="${r?"":"display:none"}">
                    <label>参考答案</label>
                    ${y}
                </div>
                <input type="hidden" id="eq-answer" value="${o.escapeHtml(m)}">
                <div class="qe-field">
                    <label>解析 <span class="qe-hint">可选</span></label>
                    <textarea id="eq-explanation" rows="3" placeholder="答案解析..." oninput="Admin._preview()">${o.escapeHtml((e==null?void 0:e.explanation)||"")}</textarea>
                </div>
            </div>
            <div class="qe-panel" id="qe-panel-preview"><div id="eq-preview"></div></div>
        </div>
        <div class="qe-footer">
            <span class="qe-info">${t?"新题目":"ID: "+e.id}</span>
            <div class="qe-actions">
                <button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button>
                <button class="mp" onclick="${t?`Admin.saveNewQuestion('${a}')`:`Admin.saveEditQuestion('${a}',${e.id})`}">${t?"添加":"保存"}</button>
            </div>
        </div>`},i._selectOption=function(a){const e=document.getElementById("eq-type").value,t=document.getElementById("eq-answer");let s=t.value;e==="single"?s=s===a?"":a:s=s.includes(a)?s.replace(a,""):s+a,s=s.split("").sort().join(""),t.value=s,document.querySelectorAll("#eq-options-list .qe-opt-item").forEach(n=>{const l=n.dataset.letter,d=s.includes(l);n.className=`qe-opt-item ${d?"selected":""}`;const p=n.querySelector(".qe-opt-indicator");e==="multiple"||e==="multi"?p.textContent=d?"☑":"☐":p.textContent=d?"●":"○"}),this._preview()},i._addOption=function(){const a=document.getElementById("eq-options-list"),t="ABCDEFGH"[a.children.length]||"?",s=document.getElementById("eq-type").value,n=s==="multiple"||s==="multi",l=document.createElement("div");l.className="qe-opt-item",l.dataset.letter=t,l.onclick=()=>i._selectOption(t),l.innerHTML=`<span class="qe-opt-indicator ${n?"checkbox":"radio"}">${n?"☐":"○"}</span>
            <span class="qe-opt-letter">${t}.</span>
            <input class="qe-opt-input" value="" placeholder="输入选项内容..." oninput="Admin._preview()" onclick="event.stopPropagation()">
            <input type="hidden" class="qe-opt-img" value="">
            <button type="button" class="abtn" style="padding:1px 4px;font-size:10px" onclick="event.stopPropagation();Admin._uploadOptionImage(this)" title="添加选项图片">📷</button>
            <button class="qe-opt-del" onclick="event.stopPropagation();Admin._removeOption(this)" title="删除选项">✕</button>`,a.appendChild(l),this._preview()},i._removeOption=function(a){const e=document.getElementById("eq-options-list");if(e.children.length<=2){o.showToast("至少保留2个选项","error");return}a.closest(".qe-opt-item").remove();const t="ABCDEFGH";Array.from(e.children).forEach((d,p)=>{d.dataset.letter=t[p],d.querySelector(".qe-opt-letter").textContent=t[p]+".",d.onclick=()=>i._selectOption(t[p]),d.querySelector(".qe-opt-del").onclick=c=>{c.stopPropagation(),i._removeOption(d.querySelector(".qe-opt-del"))}});const s=document.getElementById("eq-answer"),n=t[e.children.length-1];let l=s.value.split("").filter(d=>d<=n).join("");s.value=l,this._preview()},i._switchEditorTab=function(a){document.getElementById("qe-tab-edit").className=a==="edit"?"qe-tab active":"qe-tab",document.getElementById("qe-tab-preview").className=a==="preview"?"qe-tab active":"qe-tab",document.getElementById("qe-panel-edit").className=a==="edit"?"qe-panel active":"qe-panel",document.getElementById("qe-panel-preview").className=a==="preview"?"qe-panel active":"qe-panel",a==="preview"&&this._preview()},i._setDiff=function(a){document.getElementById("eq-difficulty").value=a,document.querySelectorAll("#eq-diff-stars .qe-star").forEach((e,t)=>{e.className=t<a?"qe-star on":"qe-star"}),this._preview()},i._onTypeChange=function(){const a=document.getElementById("eq-type").value,e=a==="single"||a==="multiple"||a==="multi",t=a==="judge",s=a==="essay"||a==="fill";if(document.getElementById("eq-options-wrap").style.display=e?"":"none",document.getElementById("eq-judge-wrap").style.display=t?"":"none",document.getElementById("eq-fill-wrap").style.display=s?"":"none",document.getElementById("eq-answer").value="",s&&(document.getElementById("eq-fill-answer").value=""),e){const n=document.getElementById("eq-options-list"),l=[];n.querySelectorAll(".qe-opt-input").forEach(c=>{c.value.trim()&&l.push(c.value.trim())});const d="ABCDEFGH",p=a==="multiple"||a==="multi";for(n.innerHTML=l.map((c,r)=>`
                <div class="qe-opt-item" data-letter="${d[r]}" onclick="Admin._selectOption('${d[r]}')">
                    <span class="qe-opt-indicator ${p?"checkbox":"radio"}">${p?"☐":"○"}</span>
                    <span class="qe-opt-letter">${d[r]}.</span>
                    <input class="qe-opt-input" value="${o.escapeHtml(c)}" placeholder="输入选项内容..." oninput="Admin._preview()" onclick="event.stopPropagation()">
                    <button class="qe-opt-del" onclick="event.stopPropagation();Admin._removeOption(this)" title="删除选项">✕</button>
                </div>
            `).join("");n.children.length<4;)this._addOption()}this._preview()},i._setJudge=function(a){const e=a===!0||a==="true";document.getElementById("eq-answer").value=e?"true":"false",document.getElementById("eq-judge-true").className=e?"qe-judge-btn active":"qe-judge-btn",document.getElementById("eq-judge-false").className=e?"qe-judge-btn":"qe-judge-btn active",this._preview()},i._collectQuestion=function(){var c,r,m,u;const a=document.getElementById("eq-type").value,e=a==="single"||a==="multiple"||a==="multi",t=a==="judge",s=a==="essay"||a==="fill";let n=[];e&&document.querySelectorAll("#eq-options-list .qe-opt-item").forEach(y=>{var g,f;const v=y.querySelector(".qe-opt-input").value.trim(),h=((f=(g=y.querySelector(".qe-opt-img"))==null?void 0:g.value)==null?void 0:f.trim())||"";(v||h)&&n.push({text:v,img:h||""})});let l="";t?l=document.getElementById("eq-answer").value==="true":s?l=((r=(c=document.getElementById("eq-fill-answer"))==null?void 0:c.value)==null?void 0:r.trim())||"":l=document.getElementById("eq-answer").value;const d=((u=(m=document.getElementById("eq-img"))==null?void 0:m.value)==null?void 0:u.trim())||"",p={type:a,category:document.getElementById("eq-category").value.trim(),difficulty:parseInt(document.getElementById("eq-difficulty").value)||1,question:document.getElementById("eq-question").value.trim(),img:d||"",options:n,answer:l,explanation:document.getElementById("eq-explanation").value.trim()};return p.question?p:(o.showToast("题目内容不能为空","error"),null)},i._uploadQuestionImage=function(){$.showDialog(a=>{document.getElementById("eq-img").value=a;const e=document.getElementById("eq-img-preview"),t=document.getElementById("eq-img-thumb");t.src=a,e.style.display="block",this._preview()})},i._removeQuestionImage=function(){document.getElementById("eq-img").value="",document.getElementById("eq-img-preview").style.display="none",this._preview()},i._uploadOptionImage=function(a){$.showDialog(e=>{const t=a.closest(".qe-opt-item"),s=t.querySelector(".qe-opt-img");s.value=e;let n=t.querySelector("img");n||(n=document.createElement("img"),n.style.cssText="max-width:60px;max-height:40px;border-radius:4px;margin-left:4px;vertical-align:middle;border:1px solid var(--border)",a.parentNode.insertBefore(n,a)),n.src=e;let l=t.querySelector(".opt-img-delete");l||(l=document.createElement("button"),l.type="button",l.className="abtn danger opt-img-delete",l.style.cssText="padding:1px 4px;font-size:10px",l.textContent="🗑️",l.title="删除选项图片",l.onclick=d=>{d.stopPropagation(),i._removeOptionImage(l)},a.parentNode.insertBefore(l,a.nextSibling)),this._preview()})},i._removeOptionImage=function(a){const e=a.closest(".qe-opt-item"),t=e.querySelector(".qe-opt-img");t.value="";const s=e.querySelector("img");s&&s.remove(),a.remove(),this._preview()},i.saveNewQuestion=async function(a){var n;const e=this._collectQuestion();if(!e)return;const t=document.querySelector(".qe-footer .abtn.primary");t&&(t.disabled=!0,t.textContent="保存中...");const s=await this.post(`/api/admin/bank/${a}/question`,{question:e});s!=null&&s.ok?(o.showToast("已添加","success"),(n=document.querySelector(".modal-mask"))==null||n.remove(),this.viewBank(a)):(o.showToast((s==null?void 0:s.error)||"添加失败","error"),t&&(t.disabled=!1,t.textContent="保存"))},i.saveEditQuestion=async function(a,e){var l;const t=this._collectQuestion();if(!t)return;const s=document.querySelector(".qe-footer .abtn.primary");s&&(s.disabled=!0,s.textContent="保存中...");const n=await this.put(`/api/admin/bank/${a}/question/${e}`,{question:t});n!=null&&n.ok?(o.showToast("已保存","success"),(l=document.querySelector(".modal-mask"))==null||l.remove(),this._updateQuestionInList(a,e,t)):(o.showToast((n==null?void 0:n.error)||"保存失败","error"),s&&(s.disabled=!1,s.textContent="保存"))},i._updateQuestionInList=function(a,e,t){const s=document.querySelector(`.question-item[data-qid="${e}"]`);if(!s)return;const n=s.querySelector(".question-preview");if(n){const p=t.question||"";n.textContent=p.length>60?p.substring(0,60)+"...":p}const l=s.querySelector(".question-type");if(l){const p={single:"单选",multiple:"多选",multi:"多选",judge:"判断",fill:"填空",essay:"简答"};l.textContent=p[t.type]||t.type}const d=s.querySelector(".question-category");d&&t.category&&(d.textContent=t.category),s.style.background="var(--success-light)",setTimeout(()=>{s.style.background=""},1500)},i.deleteQuestion=async function(a,e){if(!confirm(`确定删除题目 #${e}？`))return;const t=await this.post(`/api/admin/bank/${a}/question/${e}`,{});if(t!=null&&t.ok){o.showToast("已删除","success");const s=document.querySelector(`.question-item[data-qid="${e}"]`);s?(s.style.opacity="0",s.style.transform="translateX(20px)",setTimeout(()=>s.remove(),300)):this.viewBank(a)}},i._preview=function(){var h;const a=document.getElementById("eq-preview");if(!a)return;const e=document.getElementById("eq-type").value,t=document.getElementById("eq-question").value,s=document.getElementById("eq-answer").value,n=document.getElementById("eq-explanation").value,l=parseInt(document.getElementById("eq-difficulty").value)||1,d=document.getElementById("eq-category").value,p={single:"单选",multiple:"多选",multi:"多选",judge:"判断",fill:"填空",essay:"简答"}[e]||e,c=e==="single"||e==="multiple"||e==="multi",r=e==="judge",m=e==="essay"||e==="fill";let u=[];c&&document.querySelectorAll("#eq-options-list .qe-opt-input").forEach(g=>{const f=g.value.trim();f&&u.push(f)});let y="";m&&(y=((h=document.getElementById("eq-fill-answer"))==null?void 0:h.value)||"");let v='<div class="qe-preview-card">';v+='<div class="qe-preview-meta">',d&&(v+=`<span class="qe-preview-tag">${o.escapeHtml(d)}</span>`),v+=`<span class="qe-preview-tag type">${p}</span>`,v+=`<span class="qe-preview-tag">${"★".repeat(l)}${"☆".repeat(3-l)}</span>`,v+="</div>",v+=`<div class="qe-preview-question">${o.escapeHtml(t)||'<span style="color:var(--text-tertiary)">题目内容...</span>'}</div>`,r?(v+='<div class="qe-preview-opts">',v+=`<div class="qe-preview-opt ${s==="true"?"selected":""}">正确</div>`,v+=`<div class="qe-preview-opt ${s==="false"?"selected":""}">错误</div>`,v+="</div>"):c?(v+='<div class="qe-preview-opts">',u.forEach((g,f)=>{const x=String.fromCharCode(65+f),k=(s||"").includes(x);v+=`<div class="qe-preview-opt ${k?"selected":""}"><b>${x}.</b> ${o.escapeHtml(g)}</div>`}),v+="</div>"):m&&y&&(v+=`<div class="qe-preview-answer"><b>参考答案：</b>${o.escapeHtml(y)}</div>`),s&&!r&&!m&&(v+=`<div class="qe-preview-answer">答案: <b>${o.escapeHtml(String(s))}</b></div>`),n&&(v+=`<div class="qe-preview-explain"><div class="qe-preview-explain-label">解析</div><div class="qe-preview-explain-text">${o.escapeHtml(n)}</div></div>`),v+="</div>",a.innerHTML=v}}function _(i){i.renderAnnounce=async function(){document.getElementById("sec-announce").innerHTML=`
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
            </div>`,await this.loadAnnouncements()},i.loadAnnouncements=async function(){var a,e;try{const t=await this.get("/api/admin/announcements"),s=document.getElementById("announce-list-card");if(!t||!t.ok||!((a=t.announcements)!=null&&a.length)){s.innerHTML='<div class="card-header" style="display:flex;justify-content:space-between;align-items:center"><h3>历史公告</h3></div><div class="empty-state">暂无公告</div>';return}const n=((e=document.getElementById("announce-sort"))==null?void 0:e.value)||"newest",l=[...t.announcements];n==="oldest"&&l.reverse(),s.innerHTML=`<div class="card-header" style="display:flex;justify-content:space-between;align-items:center"><h3>历史公告</h3><select id="announce-sort" onchange="Admin.loadAnnouncements()" style="font-size:11px;padding:3px 6px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);color:var(--text)"><option value="newest" ${n==="newest"?"selected":""}>最新优先</option><option value="oldest" ${n==="oldest"?"selected":""}>最早优先</option></select></div>`+l.map(d=>`
                <div style="display:flex;align-items:flex-start;padding:8px 12px;border-bottom:1px solid var(--border);gap:8px">
                    <div style="flex:1;min-width:0">
                        <div style="font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-all">${o.escapeHtml(d.content)}</div>
                        <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">${i.fmtTime(d.created_at)||""} · ID:${d.id}</div>
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        <button class="abtn primary" style="padding:2px 8px;font-size:10px" onclick="Admin.editAnnounce(${d.id},'${o.jsSafe(d.content)}')">编辑</button>
                        <button class="abtn danger" style="padding:2px 8px;font-size:10px" onclick="Admin.deleteAnnounce(${d.id})">删除</button>
                    </div>
                </div>
            `).join("")}catch(t){console.error(t)}},i.publishAnnounce=async function(){const a=document.getElementById("announce-content").value.trim();if(!a){o.showToast("请输入内容","error");return}const e=await this.post("/api/admin/announce",{content:a});e!=null&&e.ok&&(o.showToast("已发布","success"),document.getElementById("announce-content").value="",await this.loadAnnouncements())},i.deleteAnnounce=async function(a){if(!confirm("删除这条公告？"))return;const e=await this.post("/api/admin/delete-announcement",{id:a});e!=null&&e.ok&&(o.showToast("已删除","success"),await this.loadAnnouncements())},i.editAnnounce=function(a,e){document.getElementById("modal-root").innerHTML=`
            <div class="modal-mask" onclick="if(event.target===this)this.remove()">
                <div class="modal-box">
                    <h3>编辑公告 #${a}</h3>
                    <textarea id="edit-announce-content" rows="4" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-card);color:var(--text);font-size:13px;resize:vertical">${e}</textarea>
                    <div class="modal-actions"><button class="ms" onclick="this.closest('.modal-mask').remove()">取消</button><button class="mp" onclick="Admin.saveAnnounce(${a})">保存</button></div>
                </div>
            </div>`},i.saveAnnounce=async function(a){var s;const e=document.getElementById("edit-announce-content").value.trim();if(!e){o.showToast("内容不能为空","error");return}const t=await this.post("/api/admin/edit-announcement",{id:a,content:e});t!=null&&t.ok&&(o.showToast("已更新","success"),(s=document.querySelector(".modal-mask"))==null||s.remove(),await this.loadAnnouncements())}}const w={users:[],password:(()=>{const i=localStorage.getItem("admin_pwd");if(!i)return sessionStorage.getItem("admin_pwd")||"";try{const{pwd:a,ts:e,remember:t}=JSON.parse(i),s=t?168*36e5:24*36e5;return Date.now()-e>s?(localStorage.removeItem("admin_pwd"),""):a}catch{return localStorage.removeItem("admin_pwd"),""}})(),sort:"time",tab:"overview",_loginVerified:!1,async init(){T.init("管理后台"),document.getElementById("btn-login").addEventListener("click",()=>this.login()),document.getElementById("admin-password").addEventListener("keydown",i=>{i.key==="Enter"&&this.login()}),this.password&&(console.log("[Admin] ⚡ 快速进入模式"),this.showApp(),this.loadAllInBackground())},async loadAllInBackground(){try{const i=await this.get("/api/admin/users");i!=null&&i.ok?(console.log("[Admin] ✅ 后台验证成功"),this.users=i.users,this._loginVerified=!0,this.renderTab()):(console.warn("[Admin] ⚠️ 密码已过期，需要重新登录"),this.logout())}catch(i){console.warn("[Admin] ⚠️ 验证失败，保留本地数据:",i.message)}},async login(){var t;const i=document.getElementById("admin-password").value.trim();if(!i)return;const a=((t=document.getElementById("remember-me"))==null?void 0:t.checked)||!1,e=document.getElementById("login-error");e.style.display="none";try{const s=await this.getWithAuth("/api/admin/users",i);s&&s.ok?(localStorage.setItem("admin_pwd",JSON.stringify({pwd:i,ts:Date.now(),remember:a})),sessionStorage.setItem("admin_pwd",i),this.password=i,this.users=s.users,this._loginVerified=!0,this.showApp()):(e.textContent=s&&s.error||"密码错误",e.style.display="block")}catch(s){e.textContent="网络错误: "+s.message,e.style.display="block"}},logout(){localStorage.removeItem("admin_pwd"),sessionStorage.removeItem("admin_pwd"),this._loginVerified=!1,location.reload()},async loadAll(){console.log("[Admin] 🔐 验证登录状态...");try{const i=await this.get("/api/admin/users");if(!(i!=null&&i.ok)){console.warn("[Admin] ❌ 登录验证失败"),localStorage.removeItem("admin_pwd"),sessionStorage.removeItem("admin_pwd");return}console.log("[Admin] ✅ 登录验证成功"),this.users=i.users,this._loginVerified=!0}catch(i){console.error("[Admin] ❌ 登录验证异常:",i.message)}},showApp(){document.getElementById("login-page").style.display="none",document.getElementById("admin-app").style.display="";const i=localStorage.getItem("admin_tab")||"overview";this.switchTab(i)},switchTab(i){this.tab=i,localStorage.setItem("admin_tab",i),document.querySelectorAll(".tab").forEach(a=>a.classList.toggle("active",a.dataset.tab===i)),document.querySelectorAll(".section").forEach(a=>a.classList.toggle("active",a.id==="sec-"+i)),this.renderTab()},async renderTab(){const i={overview:"renderOverview",users:"renderUsers",banks:"renderBanks",activity:"renderActivity",announce:"renderAnnounce"};i[this.tab]&&await this[i[this.tab]]()},async renderOverview(){var a,e;const i=document.getElementById("sec-overview");i.innerHTML='<div class="loading">加载中...</div>';try{const t=await this.get("/api/admin/overview");if(!(t!=null&&t.ok)){i.innerHTML='<div class="empty-state">加载失败</div>';return}const s=t.overview,n=this.users.reduce((c,r)=>c+r.total_answered,0),l=this.users.reduce((c,r)=>c+r.total_duration,0),d=n>0?Math.round(this.users.reduce((c,r)=>c+r.total_correct,0)/n*100):0,p=Math.max(...s.weekTrend.map(c=>c.cnt),1);i.innerHTML=`
                <div class="stat-grid">
                    <div class="stat-card"><div class="stat-icon purple">${o.icon("users")}</div><div class="stat-info"><div class="stat-value">${this.users.length}</div><div class="stat-label">注册用户</div></div></div>
                    <div class="stat-card"><div class="stat-icon blue">${o.icon("check-circle")}</div><div class="stat-info"><div class="stat-value">${this.fmtN(n)}</div><div class="stat-label">总答题数</div></div></div>
                    <div class="stat-card"><div class="stat-icon green">${o.icon("target")}</div><div class="stat-info"><div class="stat-value">${d}%</div><div class="stat-label">平均正确率</div></div></div>
                    <div class="stat-card"><div class="stat-icon orange">${o.icon("clock")}</div><div class="stat-info"><div class="stat-value">${this.fmtDur(l)}</div><div class="stat-label">总学习时长</div></div></div>
                </div>
                <div class="stat-grid">
                    <div class="stat-card"><div class="stat-icon blue">${o.icon("user-plus")}</div><div class="stat-info"><div class="stat-value">${s.todayReg}</div><div class="stat-label">今日注册</div></div></div>
                    <div class="stat-card"><div class="stat-icon green">${o.icon("activity")}</div><div class="stat-info"><div class="stat-value">${s.todayActive}</div><div class="stat-label">今日活跃</div></div></div>
                    <div class="stat-card"><div class="stat-icon purple">${o.icon("book-open")}</div><div class="stat-info"><div class="stat-value">${s.bankCount}</div><div class="stat-label">题库总数</div></div></div>
                    <div class="stat-card"><div class="stat-icon red">${o.icon("shield-off")}</div><div class="stat-info"><div class="stat-value">${s.bannedCount}</div><div class="stat-label">封禁用户</div></div></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>近7天注册趋势</h3></div>
                    <div class="trend-chart">${s.weekTrend.map(c=>`<div class="trend-bar" style="height:${Math.max(c.cnt/p*60,3)}px"><span class="trend-value">${c.cnt}</span><span class="trend-label">${(this.fmtDate(c.day)||"").slice(5)}</span></div>`).join("")||'<div class="empty-state">暂无数据</div>'}</div>
                </div>`,(e=(a=o).initIcons)==null||e.call(a)}catch(t){i.innerHTML=`<div class="empty-state">加载失败: ${t.message}</div>`}},async renderActivity(){const i=document.getElementById("sec-activity");i.innerHTML='<div class="loading">加载中...</div>';try{const a=await this.get("/api/admin/activity");if(!(a!=null&&a.ok)){i.innerHTML='<div class="empty-state">加载失败</div>';return}i.innerHTML=a.activity.length===0?'<div class="empty-state">暂无记录</div>':`
                <div class="card">
                    <div class="card-header"><h3>最近活跃</h3><span class="count">50条</span></div>
                    <div class="timeline">${a.activity.map(e=>`
                        <div class="tl-item"><div class="tl-dot"></div><div class="tl-body">
                            <div class="tl-title"><b>${o.escapeHtml(e.initials)}</b> ${o.escapeHtml(e.bank_name||"")} · ${e.answered}题 · 正确${e.correct}</div>
                            <div class="tl-sub">${this.fmtDur(e.duration)} · ${this.fmtTime(e.updated_at)}</div>
                        </div></div>
                    `).join("")}</div>
                </div>`}catch(a){i.innerHTML=`<div class="empty-state">加载失败: ${a.message}</div>`}},async post(i,a){try{const e=await fetch(b.BASE_URL+i,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deviceId:b.getDeviceId(),password:this.password,...a})});return e.ok?await e.json():{ok:!1,error:`HTTP ${e.status}`}}catch(e){return{ok:!1,error:e.message}}},async put(i,a){try{const e=await fetch(b.BASE_URL+i,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({deviceId:b.getDeviceId(),password:this.password,...a})});return e.ok?await e.json():{ok:!1,error:`HTTP ${e.status}`}}catch(e){return{ok:!1,error:e.message}}},async delete(i,a={}){try{const e=await fetch(b.BASE_URL+i,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({deviceId:b.getDeviceId(),password:this.password,...a})});return e.ok?await e.json():{ok:!1,error:`HTTP ${e.status}`}}catch(e){return{ok:!1,error:e.message}}},async get(i){return this.getWithAuth(i,this.password)},async getWithAuth(i,a){try{const e=b.BASE_URL+i,t=await fetch(e,{headers:{"X-Admin-Password":a,"X-Admin-Device-Id":b.getDeviceId()}});return t.ok?await t.json():{ok:!1,error:`HTTP ${t.status}`}}catch(e){return{ok:!1,error:e.message}}},fmtN(i){return i>=1e3?(i/1e3).toFixed(1)+"k":i},fmtDur(i){return!i||i<60?(i||0)+"秒":i<3600?Math.floor(i/60)+"分":(i/3600).toFixed(1)+"时"},fmtTime(i){if(!i)return"";try{const a=new Date(i);return isNaN(a.getTime())?i:new Date(a.getTime()+8*36e5).toISOString().replace("T"," ").slice(0,16)}catch{return i}},fmtDate(i){if(!i)return"";try{const a=new Date(i);return isNaN(a.getTime())?i:new Date(a.getTime()+8*36e5).toISOString().slice(0,10)}catch{return i}}};E(w);I(w);S(w);_(w);window.Admin=w;w.init();
