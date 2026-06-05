import{S as o,U as r,P as l,A as u}from"./perf-DqLayIAb.js";import{B as h}from"./bankLoader-DuUKJG19.js";const g={state:{page:"",banks:[],stats:null,history:[],questionActivity:[]},async init(){l.init("数据洞察"),this.state.page=document.body.dataset.page||"trend",this.applySettings(),l.mark("加载题库"),await this.loadBuiltinBanks(),l.mark("题库加载完成"),l.mark("云同步"),await u.autoSync(),l.mark("云同步完成"),l.mark("加载数据"),this.loadData(),l.mark("数据加载完成"),l.mark("渲染页面"),this.state.page==="analysis"?this.renderAnalysisPage():this.renderTrendPage(),l.mark("渲染完成"),l.done({page:this.state.page,bankCount:this.state.banks.length})},applySettings(){const e=o.getSettings();e.fontSize&&r.applyFontSize(e.fontSize),e.theme&&e.theme!=="auto"&&document.documentElement.setAttribute("data-theme",e.theme)},async loadBuiltinBanks(){await h.loadAllBuiltinBanks()},loadData(){this.state.banks=o.getBanks(),this.state.stats=o.getGlobalStats(),this.state.history=o.getHistory(),this.state.questionActivity=this.getQuestionActivity()},renderTrendPage(){this.renderTrendSummary(),this.renderDailyTrend(),this.renderBankTrend(),this.renderRecentHistory()},renderAnalysisPage(){this.renderAnalysisSummary(),this.renderWeakCategories(),this.renderTypeAnalysis(),this.renderBankAnalysis()},renderTrendSummary(){const e=document.getElementById("trend-summary");if(!e)return;const s=this.state.stats,t=this.getDailySeries(1)[0],a=this.getStudyStreak(),i=this.state.history.reduce((n,c)=>n+(c.duration||0),0);e.innerHTML=`
            ${this.renderStatCard("总答题",r.formatNumber(s.totalAnswered),`${s.bankCount} 个题库`,"primary")}
            ${this.renderStatCard("正确率",`${s.accuracy}%`,`${r.formatNumber(s.totalCorrect)} / ${r.formatNumber(s.totalAnswered||0)}`,this.getAccuracyTone(s.accuracy))}
            ${this.renderStatCard("今日答题",r.formatNumber(t.total),t.total>0?`${t.accuracy}% 正确率`:"暂无记录",t.total>0?"success":"")}
            ${this.renderStatCard("连续天数",`${a} 天`,`累计 ${this.formatDuration(i)}`,a>0?"warning":"")}
        `},renderDailyTrend(){const e=document.getElementById("daily-trend"),s=document.getElementById("trend-range");if(!e)return;const t=this.getDailySeries(14),a=t.filter(n=>n.total>0);if(s&&t.length>0&&(s.textContent=`${t[0].label} - ${t[t.length-1].label}`),a.length===0){e.innerHTML=this.renderEmpty("暂无答题记录");return}const i=Math.max(1,...t.map(n=>n.total));e.innerHTML=`
            <div class="daily-chart">
                ${t.map(n=>{const c=n.total>0?Math.max(8,Math.round(n.total/i*100)):0,d=n.total===0?"empty":this.getAccuracyTone(n.accuracy);return`
                        <div class="daily-item" title="${n.fullLabel} ${n.total}题 ${n.accuracy}%">
                            <div class="daily-value">${n.total>0?n.accuracy+"%":""}</div>
                            <div class="daily-track">
                                <div class="daily-fill ${d}" style="height:${c}%"></div>
                            </div>
                            <div class="daily-label">${n.shortLabel}</div>
                        </div>
                    `}).join("")}
            </div>
        `},renderBankTrend(){const e=document.getElementById("bank-trend");if(!e)return;const s=this.state.banks.map(t=>{const a=o.getBankStats(t.id),i=this.getHistoryForBank(t.id);return{bank:t,stats:a,historyCount:i.length}}).sort((t,a)=>a.stats.answered-t.stats.answered);if(s.length===0){e.innerHTML=this.renderEmpty("暂无题库");return}e.innerHTML=`
            <div class="insight-list">
                ${s.map(t=>`
                    <div class="insight-row">
                        <div class="insight-row-main">
                            <div class="insight-row-title">${r.escapeHtml(t.bank.name)}</div>
                            <div class="insight-row-meta">${t.stats.answered}/${t.stats.totalQuestions} 已答 · ${t.historyCount} 次练习</div>
                            <div class="mini-progress">
                                <div class="mini-progress-fill ${this.getAccuracyTone(t.stats.accuracy)}" style="width:${t.stats.progress}%"></div>
                            </div>
                        </div>
                        <div class="insight-row-value">${t.stats.accuracy}%</div>
                    </div>
                `).join("")}
            </div>
        `},renderRecentHistory(){const e=document.getElementById("recent-history");if(!e)return;const s=this.state.history.slice(0,8);if(s.length===0){e.innerHTML=this.renderEmpty("暂无历史记录");return}e.innerHTML=`
            <div class="insight-list">
                ${s.map(t=>{const a=t.total>0?Math.round((t.correct||0)/t.total*100):0;return`
                        <div class="history-line">
                            <div>
                                <div class="history-title">${r.escapeHtml(t.bankName||"未知题库")}</div>
                                <div class="history-meta">${this.getModeLabel(t.mode)} · ${this.formatDateTime(t.timestamp)} · ${this.formatDuration(t.duration||0)}</div>
                            </div>
                            <div class="history-score">${a}%</div>
                        </div>
                    `}).join("")}
            </div>
        `},renderAnalysisSummary(){const e=document.getElementById("analysis-summary");if(!e)return;const s=this.state.stats,t=o.getGlobalWrongStats(),a=o.getTodayDueCount(),i=this.getAllCategoryRows().filter(n=>n.answered>0&&n.accuracy<70).length;e.innerHTML=`
            ${this.renderStatCard("待复习",r.formatNumber(a),"今日到期",a>0?"warning":"success")}
            ${this.renderStatCard("错题",r.formatNumber(t.totalWrong),`${t.details.length} 个题库`,t.totalWrong>0?"danger":"success")}
            ${this.renderStatCard("薄弱点",r.formatNumber(i),"正确率低于 70%",i>0?"warning":"success")}
            ${this.renderStatCard("整体正确率",`${s.accuracy}%`,`${r.formatNumber(s.totalCorrect)} / ${r.formatNumber(s.totalAnswered||0)}`,this.getAccuracyTone(s.accuracy))}
        `},renderWeakCategories(){const e=document.getElementById("weak-categories");if(!e)return;const s=this.getAllCategoryRows().filter(t=>t.answered>0).sort((t,a)=>t.accuracy-a.accuracy||a.answered-t.answered).slice(0,12);if(s.length===0){e.innerHTML=this.renderEmpty("暂无可分析记录");return}e.innerHTML=`
            <div class="insight-list">
                ${s.map(t=>`
                    <div class="insight-row">
                        <div class="insight-row-main">
                            <div class="insight-row-title">${r.escapeHtml(t.name)}</div>
                            <div class="insight-row-meta">${r.escapeHtml(t.bankName)} · ${t.correct}/${t.answered} 正确</div>
                            <div class="mini-progress">
                                <div class="mini-progress-fill ${this.getAccuracyTone(t.accuracy)}" style="width:${t.accuracy}%"></div>
                            </div>
                        </div>
                        <div class="insight-row-value">${t.accuracy}%</div>
                    </div>
                `).join("")}
            </div>
        `},renderTypeAnalysis(){const e=document.getElementById("type-analysis");if(!e)return;const s=this.getTypeRows();if(s.length===0){e.innerHTML=this.renderEmpty("暂无题型数据");return}e.innerHTML=`
            <div class="insight-list">
                ${s.map(t=>{const a=t.answered>0?Math.round(t.correct/t.answered*100):0,i=t.total>0?Math.round(t.answered/t.total*100):0;return`
                        <div class="insight-row">
                            <div class="insight-row-main">
                                <div class="insight-row-title">${this.getTypeLabel(t.type)}</div>
                                <div class="insight-row-meta">${t.answered}/${t.total} 已答 · ${t.correct} 正确</div>
                                <div class="mini-progress">
                                    <div class="mini-progress-fill ${this.getAccuracyTone(a)}" style="width:${i}%"></div>
                                </div>
                            </div>
                            <div class="insight-row-value">${t.answered>0?a+"%":"-"}</div>
                        </div>
                    `}).join("")}
            </div>
        `},renderBankAnalysis(){const e=document.getElementById("bank-analysis");if(e){if(this.state.banks.length===0){e.innerHTML=this.renderEmpty("暂无题库");return}e.innerHTML=`
            <div class="bank-analysis-grid">
                ${this.state.banks.map(s=>{const t=o.getBankStats(s.id),a=o.getWrongQuestions(s.id).length,i=o.getDueQuestions(s.id).length,n=Object.entries(o.getCategoryStats(s.id)).filter(([c,d])=>d.answered>0).sort((c,d)=>c[1].accuracy-d[1].accuracy).slice(0,4);return`
                        <div class="bank-analysis-card">
                            <div class="bank-analysis-head">
                                <div>
                                    <div class="bank-analysis-title">${r.escapeHtml(s.name)}</div>
                                    <div class="bank-analysis-desc">${t.answered}/${t.totalQuestions} 已答 · ${t.accuracy}% 正确率</div>
                                </div>
                                <span class="tag ${t.progress===100?"tag-success":"tag-primary"}">${t.progress}%</span>
                            </div>
                            <div class="mini-progress">
                                <div class="mini-progress-fill ${this.getAccuracyTone(t.accuracy)}" style="width:${t.progress}%"></div>
                            </div>
                            <div class="category-stack">
                                ${n.length>0?n.map(([c,d])=>`
                                    <div class="category-line">
                                        <div class="category-name">${r.escapeHtml(c)}</div>
                                        <div class="category-accuracy">${d.accuracy}%</div>
                                    </div>
                                `).join(""):'<div class="insight-subtle">暂无分类记录</div>'}
                            </div>
                            <div class="bank-analysis-actions">
                                <a class="btn btn-primary btn-sm" href="quiz.html?bank=${encodeURIComponent(s.id)}&mode=all">顺序刷题</a>
                                ${a>0?`<a class="btn btn-secondary btn-sm" href="quiz.html?bank=${encodeURIComponent(s.id)}&mode=wrong">错题 ${a}</a>`:""}
                                ${i>0?`<a class="btn btn-secondary btn-sm" href="quiz.html?bank=${encodeURIComponent(s.id)}&mode=spaced">复习 ${i}</a>`:""}
                            </div>
                        </div>
                    `}).join("")}
            </div>
        `}},renderStatCard(e,s,t,a=""){return`
            <div class="insight-stat">
                <div class="insight-stat-label">${e}</div>
                <div class="insight-stat-value ${a}">${s}</div>
                <div class="insight-stat-meta">${t}</div>
            </div>
        `},renderEmpty(e){return`<div class="empty-state">${r.escapeHtml(e)}</div>`},getDailySeries(e){const s=new Map,t=new Date;for(let a=e-1;a>=0;a--){const i=new Date(t);i.setHours(0,0,0,0),i.setDate(i.getDate()-a);const n=this.getDateKey(i);s.set(n,{key:n,date:i,label:`${i.getMonth()+1}/${i.getDate()}`,shortLabel:e>7?`${i.getDate()}`:`${i.getMonth()+1}/${i.getDate()}`,fullLabel:`${i.getFullYear()}-${i.getMonth()+1}-${i.getDate()}`,total:0,correct:0,accuracy:0})}return this.state.questionActivity.forEach(a=>{const i=this.getDateKey(new Date(a.timestamp)),n=s.get(i);n&&(n.total++,a.correct&&n.correct++)}),[...s.values()].map(a=>({...a,accuracy:a.total>0?Math.round(a.correct/a.total*100):0}))},getStudyStreak(){const e=new Set(this.state.questionActivity.map(a=>this.getDateKey(new Date(a.timestamp))));let s=0;const t=new Date;for(t.setHours(0,0,0,0);e.has(this.getDateKey(t));)s++,t.setDate(t.getDate()-1);return s},getDateKey(e){const s=e.getFullYear(),t=String(e.getMonth()+1).padStart(2,"0"),a=String(e.getDate()).padStart(2,"0");return`${s}-${t}-${a}`},getHistoryForBank(e){return this.state.history.filter(s=>s.bankId===e)},getQuestionActivity(){const e=[];return this.state.banks.forEach(s=>{const t=o.getBankProgress(s.id);Object.entries(t.questions||{}).forEach(([a,i])=>{i.answeredAt&&e.push({bankId:s.id,bankName:s.name,questionId:a,timestamp:i.answeredAt,correct:i.correct===!0})})}),e.sort((s,t)=>new Date(t.timestamp)-new Date(s.timestamp))},getAllCategoryRows(){const e=[];return this.state.banks.forEach(s=>{const t=o.getCategoryStats(s.id);Object.entries(t).forEach(([a,i])=>{e.push({bankId:s.id,bankName:s.name,name:a,...i})})}),e},getTypeRows(){const e=new Map;return this.state.banks.forEach(s=>{const t=o.getBankProgress(s.id);(s.questions||[]).forEach(a=>{const i=a.type||"unknown";e.has(i)||e.set(i,{type:i,total:0,answered:0,correct:0});const n=e.get(i);n.total++;const c=t.questions[a.id];c&&(n.answered++,c.correct&&n.correct++)})}),[...e.values()].sort((s,t)=>t.total-s.total)},getAccuracyTone(e){return e>=85?"success":e>=60?"warning":e>0?"danger":""},getModeLabel(e){return{all:"顺序",random:"随机",shuffle_options:"选项乱序",wrong:"错题",review:"背题",spaced:"复习",bookmark:"收藏",exam:"考试",search:"搜索"}[e]||e||"练习"},getTypeLabel(e){return{single:"单选题",multiple:"多选题",judge:"判断题",fill:"填空题",code:"编程题",essay:"简答题"}[e]||e},formatDuration(e){const s=Math.max(0,Number(e)||0),t=Math.floor(s/60),a=s%60;if(t>=60){const i=Math.floor(t/60),n=t%60;return n>0?`${i}小时${n}分`:`${i}小时`}return t>0?`${t}分${a}秒`:`${a}秒`},formatDateTime(e){if(!e)return"";const s=new Date(e);return`${s.getMonth()+1}/${s.getDate()} ${String(s.getHours()).padStart(2,"0")}:${String(s.getMinutes()).padStart(2,"0")}`}};document.addEventListener("DOMContentLoaded",()=>{g.init()});window.Insights=g;
