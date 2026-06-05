import{A as h,S as l,U as o,P as g}from"./perf-DqLayIAb.js";/* empty css             */import{B as A}from"./bankLoader-DuUKJG19.js";import{T as v}from"./tracker-BHsEd77g.js";const S={state:{banks:[],stats:null,lightningMode:!1,selectedTypes:{}},async init(){g.init("首页"),console.log("[App] ========== 首页初始化开始 =========="),window._pageStartTime=window._pageStartTime||Date.now(),g.mark("开始加载题库"),console.log("[App] 📚 开始加载题库...");try{await Promise.race([A.loadAllBuiltinBanks(),new Promise((i,c)=>setTimeout(()=>c(new Error("timeout")),3e4))]),g.mark("题库加载完成"),console.log("[App] ✅ 题库加载完成")}catch(i){g.mark("题库加载失败"),console.warn("[App] ⚠️ 题库加载超时或失败:",i.message)}g.mark("开始云同步"),console.log("[App] ☁️ 开始云同步（异步）..."),h.autoSync().then(()=>{console.log("[App] ✅ 云同步完成（后台）"),this.state.stats=l.getGlobalStats()}).catch(i=>{console.warn("[App] ⚠️ 云同步失败（后台）:",i.message)}),g.mark("云同步已启动"),g.mark("加载本地数据"),console.log("[App] 📦 加载本地数据..."),this.loadData();const t=document.getElementById("loading-skeleton"),e=document.getElementById("section-banks"),n=()=>{t&&t.classList.add("hidden"),e&&(e.style.display="")},s=Date.now()-window._pageStartTime;s<500?setTimeout(n,500-s):n(),g.mark("开始渲染"),console.log("[App] 🎨 开始渲染页面..."),this.render(),this.bindEvents(),g.mark("渲染完成"),h.isRegistered()||(console.log("[App] 👤 首次访问，提示注册"),setTimeout(()=>h.showRegisterModal(),1500)),g.mark("加载公告"),console.log("[App] 📢 加载公告..."),this.loadAnnouncement();const a=Date.now()-window._pageStartTime;console.log(`[App] ========== 首页初始化完成 (${a}ms) ==========`),g.done({bankCount:this.state.banks.length,isRegistered:h.isRegistered()})},loadData(){console.log("[App] 📦 开始加载本地数据...");const t=l.getBanks(),e=t.filter(a=>a.enabled!==!1),n=t.length-e.length;console.log(`[App] 📊 题库统计: 总计 ${t.length} 个, 启用 ${e.length} 个, 禁用 ${n} 个`),n>0&&console.log("[App] 🚫 已禁用的题库:",t.filter(a=>a.enabled===!1).map(a=>a.name||a.id)),this.state.banks=e,this.state.stats=l.getGlobalStats(),console.log("[App] 📊 统计数据:",this.state.stats),this.state.bankSort=localStorage.getItem("quiz_bank_sort")||"recent";const s=document.getElementById("bank-sort");s&&(s.value=this.state.bankSort),console.log("[App] ✅ 本地数据加载完成")},render(){this.renderSmartBanner(),this.renderWrongBook(),this.renderStatsOverview(),this.renderBankGrid()},renderWrongBook(){const t=document.getElementById("wrong-book");if(!t)return;const e=l.getGlobalWrongStats();if(e.totalWrong===0){t.style.display="none";return}t.innerHTML=`
            <div class="wrong-book">
                <div class="wrong-book-header">
                    <span class="wrong-book-icon">${o.icon("x-circle")}</span>
                    <span class="wrong-book-title">错题本</span>
                    <span class="wrong-book-count">${e.totalWrong} 题</span>
                </div>
                <div class="wrong-book-body">
                    ${e.details.map(n=>`
                        <div class="wrong-book-bank">
                            <span class="wrong-book-bank-name">${o.escapeHtml(n.bankName)}</span>
                            <span class="wrong-book-bank-count">${n.count} 题</span>
                        </div>
                    `).join("")}
                </div>
                <div class="wrong-book-actions">
                    <button class="btn btn-secondary btn-sm" onclick="App.clearAllWrong()">${o.icon("trash-2")} 清空错题本</button>
                    <button class="btn btn-primary btn-sm" onclick="App.startWrongPractice()">${o.icon("repeat")} 错题重做</button>
                </div>
            </div>
        `,t.style.display="",o.initIcons()},clearAllWrong(){o.showModal({title:`${o.icon("alert-triangle")} 清空错题本`,content:"<p>确定清空全部错题本？此操作不可恢复。</p>",buttons:[{label:"确定清空",class:"btn-danger",onClick:t=>{t.remove();const e=l.getGlobalWrongStats().totalWrong;l.clearAllWrong(),v.clearWrongBook(e),o.showToast("错题本已清空","success"),this.loadData(),this.render()}},{label:"取消",class:"btn-secondary",onClick:t=>t.remove()}],size:"sm"})},startWrongPractice(){const t=l.getGlobalWrongStats();if(t.totalWrong===0)return;const e=t.details[0];this.startQuiz(e.bankId,"wrong")},renderSmartBanner(){},async loadAnnouncement(){var a;const t=document.getElementById("smart-banner");if(!t)return;const e="ks_cached_announce";let n=!1;const s=(()=>{try{return localStorage.getItem(e)}catch{return null}})();s&&(this._renderAnnounceWrap(t,s),n=!0);try{console.log("[公告] 请求中...");const i=await h.request("/api/announce");if(console.log("[公告] 响应:",JSON.stringify(i)),i!=null&&i.ok&&((a=i.announce)!=null&&a.content)){const c=o.escapeHtml(i.announce.content.replace(/\n/g," "));try{localStorage.setItem(e,c)}catch{}this._renderAnnounceWrap(t,c);return}else{try{localStorage.removeItem(e)}catch{}n||(t.style.display="none");return}}catch{}n||(t.style.display="none")},_renderAnnounceWrap(t,e){t.innerHTML=`
            <div class="announce-banner">
                <div class="announce-badge">公告</div>
                <div class="announce-scroll-wrap" id="announce-scroll-wrap">
                    <div class="announce-scroll-text" id="announce-scroll-text">${e}</div>
                </div>
            </div>
        `,t.style.display="",requestAnimationFrame(()=>{const n=document.getElementById("announce-scroll-wrap"),s=document.getElementById("announce-scroll-text");n&&s&&s.scrollWidth>n.clientWidth&&n.classList.add("overflow")})},scrollToBankGrid(){const t=document.getElementById("bank-grid");t&&t.scrollIntoView({behavior:"smooth",block:"start"})},renderStatsOverview(){const t=this.state.stats,e=document.getElementById("tab-overview");if(!e)return;const n=t.accuracy||0,s=2*Math.PI*34,a=s-n/100*s,i=c=>{if(c<60)return`${c}秒`;if(c<3600)return`${Math.floor(c/60)}分钟`;const r=Math.floor(c/3600),d=Math.floor(c%3600/60);return d>0?`${r}小时${d}分钟`:`${r}小时`};e.innerHTML=`
            <div class="stats-grid">
                <div class="stat-card stat-card-compact">
                    <div class="stat-label">题库数量</div>
                    <div class="stat-value primary">${t.bankCount}</div>
                </div>
                <div class="stat-card stat-card-compact">
                    <div class="stat-label">总题目数</div>
                    <div class="stat-value">${o.formatNumber(t.totalQuestions)}</div>
                </div>
                <div class="stat-card stat-card-compact">
                    <div class="stat-label">已答题数</div>
                    <div class="stat-value success">${o.formatNumber(t.totalAnswered)}</div>
                </div>
                <div class="stat-card stat-card-compact">
                    <div class="stat-label">学习时长</div>
                    <div class="stat-value">${i(t.totalDuration||0)}</div>
                </div>
                <div class="stat-card stat-card-accuracy">
                    <div class="stat-label">正确率</div>
                    <div class="stat-ring">
                        <div class="stat-ring-chart">
                            <svg class="stat-ring-svg" width="80" height="80" viewBox="0 0 80 80">
                                <circle class="stat-ring-bg" cx="40" cy="40" r="34"/>
                                <circle class="stat-ring-fill" cx="40" cy="40" r="34" 
                                        stroke-dasharray="${s}" 
                                        stroke-dashoffset="${a}"/>
                            </svg>
                            <div class="stat-ring-center">${n}%</div>
                        </div>
                        <div class="stat-ring-labels">
                            <div class="stat-ring-label">${o.icon("check-circle","text-success")} 正确 <span>${o.formatNumber(t.totalCorrect)}</span></div>
                            <div class="stat-ring-label">${o.icon("x-circle","text-danger")} 错误 <span>${o.formatNumber(t.totalWrong)}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `,o.initIcons()},getBankTypes(t){if(!t||!t.questions)return[];const e=new Set;return t.questions.forEach(n=>{n.type&&e.add(n.type)}),["all",...e].filter(Boolean)},getTypeLabel(t){return{all:"全部题型",single:"单选",multiple:"多选",judge:"判断",fill:"填空",code:"编程",essay:"简答"}[t]||t},_isModeAllowed(t,e){return!t||!Array.isArray(t)||t.length===0?!0:t.includes(e)},_renderModeButtons(t,e,n,s,a){const i=[];return this._isModeAllowed(e,"all")&&i.push(`<button class="btn btn-primary btn-sm" onclick="App.startQuiz('${t}', 'all')">${o.icon("list")} 顺序刷题</button>`),this._isModeAllowed(e,"random")&&i.push(`<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${t}', 'random')">${o.icon("shuffle")} 随机</button>`),this._isModeAllowed(e,"shuffle_options")&&i.push(`<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${t}', 'shuffle_options')">${o.icon("refresh-cw")} 选项乱序</button>`),this._isModeAllowed(e,"wrong")&&i.push(`<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${t}', 'wrong')" ${n===0?"disabled":""}>${o.icon("alert-circle")} 错题${n>0?"("+n+")":""}</button>`),this._isModeAllowed(e,"review")&&i.push(`<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${t}', 'review')">${o.icon("book-open")} 背题</button>`),this._isModeAllowed(e,"spaced")&&s>0&&i.push(`<button class="btn btn-accent btn-sm" onclick="App.startQuiz('${t}', 'spaced')">${o.icon("brain")} 复习(${s})</button>`),this._isModeAllowed(e,"bookmark")&&a>0&&i.push(`<button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${t}', 'bookmark')">${o.icon("star")} 收藏(${a})</button>`),this._isModeAllowed(e,"exam")&&i.push(`<button class="btn btn-secondary btn-sm" onclick="App.startExam('${t}')">${o.icon("file-text")} 考试</button>`),i.length===0&&i.push('<span style="font-size:12px;color:var(--text-tertiary)">暂无可用模式</span>'),i.join(`
`)},sortBanks(t){this.state.bankSort=t,localStorage.setItem("quiz_bank_sort",t),this.renderBankGrid()},getSortedBanks(){const t=[...this.state.banks];switch(this.state.bankSort||localStorage.getItem("quiz_bank_sort")||"recent"){case"recent":{const n=l.getRecentBanks();if(n.length===0)return t;const s=new Set(n),a=t.filter(c=>s.has(c.id)),i=t.filter(c=>!s.has(c.id));return a.sort((c,r)=>n.indexOf(c.id)-n.indexOf(r.id)),[...a,...i]}case"name":return t.sort((n,s)=>(n.name||"").localeCompare(s.name||""));case"count":return t.sort((n,s)=>{var a,i;return(((a=s.questions)==null?void 0:a.length)||0)-(((i=n.questions)==null?void 0:i.length)||0)});case"progress":{const n=new Map(t.map(s=>[s.id,l.getBankStats(s.id).progress||0]));return t.sort((s,a)=>n.get(a.id)-n.get(s.id))}default:return t}},renderBankGrid(){const t=document.getElementById("bank-grid"),e=this.getSortedBanks();if(e.length===0){t.innerHTML=`
                <div class="bank-empty">
                    <div class="bank-empty-icon">${o.icon("book-open","icon-xl")}</div>
                    <div class="bank-empty-title">加载题库中...</div>
                    <div class="bank-empty-desc">请稍候，题库正在加载</div>
                </div>
            `;return}const n=document.getElementById("bank-count");n&&(n.textContent=e.length+" 个题库"),t.innerHTML=e.map(s=>{const a=l.getBankStats(s.id),i=l.getWrongQuestions(s.id).length,c=l.getDueQuestions(s.id).length,r=l.getBookmarkCount(s.id),d=s.questions||[],u=this.getBankTypes(s),b=s.id.includes("c-language")?"c-lang":"default",m=s.id.includes("c-language")?"C":"Q";return`
                <div class="bank-card" data-id="${s.id}">
                    <div class="bank-card-header">
                        <div class="bank-card-icon ${b}">${m}</div>
                        <div class="bank-card-info">
                            <div class="bank-card-title">${o.escapeHtml(s.name)}</div>
                            <div class="bank-card-desc">${o.escapeHtml(s.description||"")}</div>
                        </div>
                    </div>

                    <div class="bank-card-meta">
                        ${(s.categories||[]).slice(0,3).map(p=>`<span class="tag">${o.escapeHtml(p)}</span>`).join("")}
                        ${c>0?`<span class="tag tag-warning">${o.icon("brain")} ${c} 待复习</span>`:""}
                        <span class="tag">${u.filter(p=>p!=="all").map(p=>this.getTypeLabel(p)).join(" · ")}</span>
                    </div>

                    <div class="bank-card-progress">
                        <div class="bank-card-progress-header">
                            <span>完成进度</span>
                            <span>${a.progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-bar-fill ${a.progress===100?"success":a.progress>0?"warning":""}" 
                                 style="width: ${a.progress}%"></div>
                        </div>
                    </div>

                    <div class="bank-card-stats">
                        <div class="bank-card-stat">
                            共 <span class="bank-card-stat-num">${d.length}</span> 题
                        </div>
                        <div class="bank-card-stat">
                            已答 <span class="bank-card-stat-num">${a.answered}</span>
                        </div>
                        <div class="bank-card-stat">
                            正确 <span class="bank-card-stat-num">${a.correct}</span>
                        </div>
                    </div>

                    <!-- 题型筛选行（选择题型后，刷题按钮自动使用所选题型） -->
                    <div class="bank-card-types">
                        ${u.map(p=>`<button class="bank-type-btn ${(this.state.selectedTypes[s.id]||"all")===p?"active":""}" onclick="App.selectType('${s.id}', '${p}')">
                                ${p==="all"?o.icon("layers")+" 全部":this.getTypeLabel(p)}
                            </button>`).join("")}
                    </div>

                    <!-- 刷题模式按钮网格 -->
                    <div class="bank-card-modes">
                        ${this._renderModeButtons(s.id,s.allowed_modes,i,c,r)}
                    </div>

                    <div class="bank-card-footer">
                        <button class="btn btn-ghost btn-sm" onclick="App.resetProgress('${s.id}')" title="重置进度">
                            <span>${o.icon("rotate-ccw")} 重置</span>
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="App.exportBank('${s.id}')" title="导出题库">
                            <span>${o.icon("download")} 导出</span>
                        </button>
                    </div>
                </div>
            `}).join(""),o.initIcons()},searchQuestions(){const t=document.getElementById("search-input"),e=t?t.value.trim():"";if(!e)return;const n=[],s=this.state.banks;for(const r of s){if(!r.questions)continue;const d=r.questions.filter(u=>[u.question,u.explanation,u.category,...u.options||[],u.answer].join(" ").toLowerCase().includes(e.toLowerCase()));d.length>0&&n.push({bank:r,matched:d,count:d.length})}if(n.length===0){o.showToast("未找到包含「"+e+"」的题目","info",3e3);return}const a={keyword:e,banks:n.map(r=>({bankId:r.bank.id,questionIds:r.matched.map(d=>d.id),count:r.count}))};sessionStorage.setItem("quiz_search_results",JSON.stringify(a));const i=n[0].bank,c=n.reduce((r,d)=>r+d.count,0);v.searchQuestions(e,c),o.showToast("找到 "+c+" 道匹配题目","success",2e3),setTimeout(()=>{window.location.href="quiz.html?bank="+i.id+"&mode=review&q="+encodeURIComponent(e)},300)},clearSearch(){const t=document.getElementById("search-input");t&&(t.value="");const e=document.getElementById("search-clear");e&&(e.style.display="none"),sessionStorage.removeItem("quiz_search_results")},selectType(t,e){this.state.selectedTypes[t]=e,v.selectType(t,e),this.renderBankGrid()},startQuiz(t,e){l.recordBankUsage(t);const n=this.state.selectedTypes[t]||"all",s=n!=="all"?`&type=${n}`:"";window.location.href=`quiz.html?bank=${t}&mode=${e}${s}`},startExam(t){var i;const e=l.getBank(t);if(!e)return;const n=((i=e.questions)==null?void 0:i.length)||0,s=Math.min(n,20),a=`
            <p style="margin-bottom: var(--space-3); color: var(--text-secondary);">题库：${o.escapeHtml(e.name)}（${n}题）</p>
            <label>抽取题数（最多 ${n} 题，0 表示全部）</label>
            <input type="number" id="exam-count" value="${s}" min="0" max="${n}">
            <label>考试限时（分钟，0表示不限时）</label>
            <input type="number" id="exam-time" value="60" min="0" max="300">
            <label>及格线（百分比）</label>
            <input type="number" id="exam-pass" value="60" min="0" max="100">
        `;o.showModal({title:"📝 模拟考试设置",content:a,buttons:[{label:"开始考试",class:"btn-primary",onClick:c=>{const r=parseInt(c.querySelector("#exam-count").value)||0,d=parseInt(c.querySelector("#exam-time").value)||0,u=parseInt(c.querySelector("#exam-pass").value)||60,b=r>0?`&count=${r}`:"",m=d>0?`&time=${d*60}`:"";window.location.href=`quiz.html?bank=${t}&mode=exam${b}${m}&pass=${u}`}},{label:"取消",class:"btn-secondary",onClick:c=>c.remove()}],size:"sm"})},startSmartReview(){const t=this.state.banks;for(const e of t)if(l.getDueQuestions(e.id).length>0){this.startQuiz(e.id,"spaced");return}o.showToast("没有需要复习的题目","info")},resetProgress(t){const e=l.getBank(t);e&&o.showModal({title:`${o.icon("alert-triangle")} 重置进度`,content:`<p>确定要重置「${o.escapeHtml(e.name)}」的所有进度吗？</p>`,buttons:[{label:"确定重置",class:"btn-danger",onClick:n=>{n.remove(),l.resetBankProgress(t),v.resetProgress(t,e.name),o.showToast("进度已重置","success"),this.loadData(),this.render()}},{label:"取消",class:"btn-secondary",onClick:n=>n.remove()}],size:"sm"})},exportBank(t){const e=l.getBank(t);e&&(v.exportBank(t,e.name),o.downloadJSON(e,`${e.name}.json`),o.showToast("题库已导出","success"))},async importBank(){var t;try{const e=await o.pickFile(".json");if(!e)return;const n=await o.readJSONFile(e),s=o.validateBank(n);if(!s.valid){o.showToast("题库格式错误："+s.errors[0],"error",5e3);return}if(l.bankExists(n.id)&&!await new Promise(i=>{o.showModal({title:`${o.icon("alert-triangle")} 覆盖题库`,content:`<p>题库「${o.escapeHtml(n.name)}」已存在，是否覆盖？</p>`,buttons:[{label:"确定覆盖",class:"btn-danger",onClick:c=>{c.remove(),i(!0)}},{label:"取消",class:"btn-secondary",onClick:c=>{c.remove(),i(!1)}}],size:"sm",onClose:()=>i(!1)})}))return;l.setBank(n),v.importBank(n.name,((t=n.questions)==null?void 0:t.length)||0),o.showToast(`题库 "${n.name}" 导入成功！`,"success"),this.loadData(),this.render()}catch(e){o.showToast("导入失败："+e.message,"error",5e3)}},cycleTheme(){const t=document.documentElement.getAttribute("data-theme")||"auto",e=["auto","light","dark"],n=(e.indexOf(t)+1)%e.length,s=e[n];s==="auto"?document.documentElement.removeAttribute("data-theme"):document.documentElement.setAttribute("data-theme",s),l.updateSettings({theme:s});const a={auto:"跟随系统",light:"浅色模式",dark:"深色模式"},i={auto:"monitor",light:"sun",dark:"moon"};o.showToast(`${o.icon(i[s]||"monitor")} 主题：${a[s]}`,"success",1500)},showThemePicker(){const t=document.documentElement.getAttribute("data-theme")||"auto",e={auto:"跟随系统",light:"浅色模式",dark:"深色模式"},s=[{value:"auto",icon:"monitor",label:"跟随系统"},{value:"light",icon:"sun",label:"浅色模式"},{value:"dark",icon:"moon",label:"深色模式"}].map(a=>`
            <label style="display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) 0; cursor: pointer;">
                <input type="radio" name="theme" value="${a.value}" ${a.value===t?"checked":""}>
                <span>${o.icon(a.icon)} ${a.label}</span>
            </label>
        `).join("");o.showModal({title:`${o.icon("palette")} 选择主题`,content:s,buttons:[{label:"确定",class:"btn-primary",onClick:a=>{const i=a.querySelector('input[name="theme"]:checked');if(!i)return;const c=i.value;c==="auto"?document.documentElement.removeAttribute("data-theme"):document.documentElement.setAttribute("data-theme",c),l.updateSettings({theme:c}),o.showToast(`已切换为 ${e[c]}`,"success"),a.remove()}},{label:"取消",class:"btn-secondary",onClick:a=>a.remove()}],size:"sm"})},showSettings(){const t=l.getSettings(),e=t.fontSize||16,n=t.answerMode||"normal",s=t.swipeNavigation!==!1,a=t.aiEngine||"metaso",i=t.customAiEngine||"",r=!!localStorage.getItem("admin_pwd")||localStorage.getItem("ks_is_admin")==="1",d=`
            <label>字体大小</label>
            <select id="setting-font-size">
                <option value="14" ${e===14?"selected":""}>14px - 较小</option>
                <option value="16" ${e===16?"selected":""}>16px - 标准</option>
                <option value="18" ${e===18?"selected":""}>18px - 较大</option>
                <option value="20" ${e===20?"selected":""}>20px - 大</option>
                <option value="24" ${e===24?"selected":""}>24px - 超大</option>
            </select>
            <label>答题模式</label>
            <select id="setting-answer-mode">
                <option value="normal" ${n==="normal"?"selected":""}>普通模式 - 手动提交手动跳题</option>
                <option value="autoNext" ${n==="autoNext"?"selected":""}>自动跳题 - 手动提交答对自动跳</option>
                <option value="lightning" ${n==="lightning"?"selected":""}>闪电模式 - 点击即判答对自动跳</option>
                <option value="instant" ${n==="instant"?"selected":""}>即时判断 - 点击即判不自动跳</option>
            </select>
            <label>左右滑动</label>
            <label class="toggle-label">
                <input type="checkbox" id="setting-swipe" ${s?"checked":""}>
                <span class="toggle-slider"></span>
                <span>滑动切换题目</span>
            </label>

            <label>AI 搜索引擎</label>
            <select id="setting-ai-engine">
                <option value="metaso" ${a==="metaso"?"selected":""}>秘塔搜索 (metaso.cn)</option>
                <option value="felo" ${a==="felo"?"selected":""}>Felo AI (felo.ai)</option>
                <option value="andi" ${a==="andi"?"selected":""}>Andi Search (andisearch.com)</option>
                <option value="baidu" ${a==="baidu"?"selected":""}>百度搜索 (baidu.com)</option>
                <option value="custom" ${a==="custom"?"selected":""}>自定义引擎</option>
            </select>
            <div id="custom-engine-wrap" style="display: ${a==="custom"?"block":"none"}; margin-top: 8px;">
                <label>自定义引擎 URL</label>
                <input type="text" id="setting-custom-engine" placeholder="https://example.com/search?q={keyword}" value="${o.escapeHtml(i)}">
                <p style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">用 {keyword} 表示搜索关键词</p>
            </div>
            
            ${r?`
            <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border);">
                <button onclick="window.open('admin.html', '_blank'); this.closest('.modal').remove();" style="
                    width: 100%; padding: 12px; 
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: #fff; border: none; border-radius: 10px;
                    font-size: 14px; font-weight: 600; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                ">
                    👑 进入管理后台
                </button>
            </div>
            `:""}
        `;o.showModal({title:`${o.icon("settings")} 设置`,content:d,buttons:[{label:"保存",class:"btn-primary",onClick:m=>{var $;const p=parseInt(m.querySelector("#setting-font-size").value),k=m.querySelector("#setting-answer-mode").value,f=m.querySelector("#setting-ai-engine").value,y=(($=m.querySelector("#setting-custom-engine"))==null?void 0:$.value)||"";p>=12&&p<=24&&(l.updateSettings({fontSize:p}),o.applyFontSize(p));const w=m.querySelector("#setting-swipe").checked;console.log("[Settings] 💾 保存设置:",{answerMode:k,swipeNavigation:w,aiEngine:f,customAiEngine:y}),l.updateSettings({answerMode:k,swipeNavigation:w,aiEngine:f,customAiEngine:y}),h.pushSettings(l.getSettings()),o.showToast("设置已保存","success"),m.remove()}},{label:"取消",class:"btn-secondary",onClick:m=>m.remove()}],size:"sm"});const u=document.getElementById("setting-ai-engine"),b=document.getElementById("custom-engine-wrap");u&&b&&u.addEventListener("change",()=>{b.style.display=u.value==="custom"?"block":"none"})},showShortcuts(){localStorage.getItem("quiz_shortcuts_shown"),o.showToast("快捷键：Enter 提交 · A-D 选答案 · Alt+←→ 切换 · 1/0 判断","info",5e3),localStorage.setItem("quiz_shortcuts_shown","1")},bindEvents(){document.addEventListener("pointerup",d=>{const u=d.target.closest("button, .btn, .bank-card, .bank-type-btn");u&&u.blur()});const t=document.getElementById("btn-import");t&&t.addEventListener("click",()=>this.importBank());const e=document.getElementById("search-input");e&&e.addEventListener("input",()=>{const d=document.getElementById("search-clear");d&&(d.style.display=e.value?"":"none")});const n=document.getElementById("btn-theme");n&&n.addEventListener("click",()=>this.cycleTheme());const s=document.getElementById("btn-settings");s&&s.addEventListener("click",()=>this.showSettings());const a=document.getElementById("btn-history");a&&a.addEventListener("click",()=>{window.location.href="trend.html#recent-history"});const i=document.getElementById("btn-sync");i&&i.addEventListener("click",()=>{h.isRegistered()?h.showAccountPanel():h.showRegisterModal()});const c=document.getElementById("btn-shortcuts");c&&c.addEventListener("click",()=>this.showShortcuts());const r=l.getSettings();r.fontSize&&o.applyFontSize(r.fontSize),r.theme&&r.theme!=="auto"&&document.documentElement.setAttribute("data-theme",r.theme),localStorage.getItem("quiz_shortcuts_shown")||setTimeout(()=>{o.showToast(`${o.icon("lightbulb")} 按 Enter 提交 · Alt+←→ 切换 · A-D 选答案`,"info",4e3),localStorage.setItem("quiz_shortcuts_shown","1")},2e3),!localStorage.getItem("quiz_welcome_shown")&&this.state.banks.length>0&&(localStorage.setItem("quiz_welcome_shown","1"),setTimeout(()=>{o.showToast("👋 点击题库卡片上的「开始刷题」按钮即可学习","info",5e3)},4e3))}};document.addEventListener("DOMContentLoaded",()=>{S.init()});window.App=S;
