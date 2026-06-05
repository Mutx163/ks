import{U as m,A as i,P as n}from"./perf-DqLayIAb.js";/* empty css             */const b={currentSort:"answered",async init(){if(n.init("排行榜"),n.mark("开始同步"),await i.autoSync(),n.mark("同步完成"),!i.isRegistered()){n.done({registered:!1}),document.getElementById("lb-list").innerHTML=`
                <div class="lb-empty">
                    <div class="lb-empty-icon">🏆</div>
                    <div class="lb-empty-title">注册后即可参与排行</div>
                    <p style="margin-bottom:var(--space-4);color:var(--text-secondary);">与全站同学一起比拼学习数据</p>
                    <button class="btn btn-primary" onclick="LB.promptRegister()">立即注册加入</button>
                </div>
            `;return}n.mark("加载排行榜"),await this.loadLeaderboard(),n.mark("排行榜加载完成"),n.done({registered:!0})},async promptRegister(){await i.showRegisterModal()&&location.reload()},async switchTab(t){this.currentSort=t,document.querySelectorAll(".lb-tab").forEach(a=>{a.classList.toggle("active",a.dataset.sort===t)}),await this.loadLeaderboard()},async loadLeaderboard(){const t=document.getElementById("lb-list");t.innerHTML=`
            <div class="lb-loading">
                <div class="lb-loading-spinner"></div>
                <div>加载中...</div>
            </div>
        `;const a=await i.getLeaderboard(this.currentSort,50);if(!a||!a.ok){t.innerHTML=`
                <div class="lb-empty">
                    <div class="lb-empty-icon">📡</div>
                    <div class="lb-empty-title">加载失败</div>
                    <p style="color:var(--text-secondary);">请检查网络后重试</p>
                    <button class="btn btn-secondary" style="margin-top:var(--space-3);" onclick="LB.loadLeaderboard()">重新加载</button>
                </div>
            `;return}this.renderCurrentUser(a.currentUser);const e=a.leaderboard||[];if(e.length===0){t.innerHTML=`
                <div class="lb-empty">
                    <div class="lb-empty-icon">📭</div>
                    <div class="lb-empty-title">暂无数据</div>
                    <p style="color:var(--text-secondary);">成为第一个上榜的人吧！</p>
                </div>
            `;return}const l={answered:"按总答题数排名",accuracy:"按正确率排名（答题数≥10）",duration:"按累计学习时长排名"};document.getElementById("lb-desc").textContent=l[this.currentSort]||"";const s=i.getSyncCode();this.renderList(e,s)},renderCurrentUser(t){const a=document.getElementById("lb-me");if(!t||!a){a&&(a.style.display="none");return}const e=t.rank<=3?["🥇","🥈","🥉"][t.rank-1]:`#${t.rank}`;a.style.display="flex",a.innerHTML=`
            <div class="lb-me-rank">${e}</div>
            <div class="lb-me-info">
                <div class="lb-me-name">
                    ${m.escapeHtml(t.initials)}
                    <span class="lb-me-badge">我的排名</span>
                </div>
                <div class="lb-me-stats">
                    <span class="lb-me-stat">📊 ${t.answered} 题</span>
                    <span class="lb-me-stat">🎯 ${t.accuracy}% 正确率</span>
                    <span class="lb-me-stat">⏱ ${this.formatDuration(t.duration)}</span>
                </div>
            </div>
        `},renderList(t,a){const e=document.getElementById("lb-list");if(t.length===0){e.innerHTML="";return}const l=this.getRawValue(t[0]);e.innerHTML=t.map((s,v)=>{var o,u;const d=s.syncCode===a,r=s.rank,p=this.getRawValue(s),y=l>0?Math.round(p/l*100):0;let c="";r<=3?c=`top-${r}`:r<=10&&(c=`rank-${r}`);const h=r<=3?["🥇","🥈","🥉"][r-1]:"";return`
                <div class="lb-row ${r<=3?`top-${r}`:""} ${d?"is-me":""}" style="animation: rowSlideIn 0.3s ease both; animation-delay: ${Math.min(v*.03,.5)}s;">
                    <div class="lb-rank ${c}">
                        ${h||`<span class="lb-rank-num">${r}</span>`}
                    </div>
                    <div class="lb-avatar">${((u=(o=s.initials)==null?void 0:o.charAt(0))==null?void 0:u.toUpperCase())||"?"}</div>
                    <div class="lb-name">
                        ${m.escapeHtml(s.initials)}
                        ${d?'<span class="lb-name-tag">← 我</span>':""}
                    </div>
                    <div class="lb-value-wrap">
                        <div class="lb-value">${this.formatValue(s)}</div>
                        <div class="lb-sub">${this.formatSub(s)}</div>
                    </div>
                    <div class="lb-row-bar" style="width:${y}%;"></div>
                </div>
            `}).join("")},getRawValue(t){switch(this.currentSort){case"answered":return t.answered||0;case"accuracy":return t.accuracy||0;case"duration":return t.duration||0;default:return 0}},formatValue(t){switch(this.currentSort){case"answered":return(t.answered||0)+" 题";case"accuracy":return(t.accuracy||0)+"%";case"duration":return this.formatDuration(t.duration);default:return""}},formatSub(t){switch(this.currentSort){case"answered":return`正确率 ${t.accuracy||0}%`;case"accuracy":return`${t.answered||0} 题`;case"duration":return`${t.answered||0} 题`;default:return""}},formatDuration(t){if(!t||t<60)return(t||0)+"秒";if(t<3600)return Math.floor(t/60)+"分钟";const a=Math.floor(t/3600),e=Math.floor(t%3600/60);return e>0?`${a}时${e}分`:`${a}小时`}};window.LB=b;document.addEventListener("DOMContentLoaded",()=>b.init());
