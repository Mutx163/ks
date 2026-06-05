import{S as u,A as v,U as r,P as b}from"./perf-DqLayIAb.js";import{B as S}from"./bankLoader-DuUKJG19.js";import{T as y}from"./tracker-BHsEd77g.js";const E=300,A=100,$=300,T=250,_=300,Q=70,I={state:{bankId:null,bank:null,questions:[],currentIndex:0,mode:"all",answers:{},submitted:{},showExplanation:{},isFinished:!1,startTime:null,questionStartTime:null,questionTimes:{},examTimeLimit:0,examPassRate:60,examTimeRemaining:0,examTimer:null,answerMode:"normal",filterType:"all",isReviewMode:!1,_reviewDurationSaved:0,isNavigating:!1,optionOrderCache:{},_statsDirty:!1,_statsTimer:null,_lastPushAnswered:0,_lastPushCorrect:0,_lastPushDuration:0},async init(){var s,i,n;b.init("刷题页"),console.log("[Quiz] ========== 刷题页面初始化开始 ==========");const t=new URLSearchParams(window.location.search);this.state.bankId=t.get("bank"),this.state.mode=t.get("mode")||"all",this.state.filterType=t.get("type")||"all",this.state.examTimeLimit=parseInt(t.get("time"))||0,this.state.examPassRate=parseInt(t.get("pass"))||60,this.state.examCount=parseInt(t.get("count"))||0,console.log("[Quiz] 📋 URL 参数:",{bank:this.state.bankId,mode:this.state.mode,type:this.state.filterType,time:this.state.examTimeLimit,pass:this.state.examPassRate,count:this.state.examCount}),t.get("q")&&(this.state.searchKeyword=t.get("q")||"",console.log("[Quiz] 🔍 搜索关键词:",this.state.searchKeyword));const e=u.getSettings();if(this.state.answerMode=e.answerMode||"normal",console.log("[Quiz] ⚙️ 用户设置:",e),e.fontSize&&r.applyFontSize(e.fontSize),!this.state.bankId){console.error("[Quiz] ❌ 缺少题库参数"),r.showToast("缺少题库参数","error"),setTimeout(()=>window.location.href="index.html",1e3);return}if(b.mark("开始加载题库"),console.log("[Quiz] 📚 开始加载题库:",this.state.bankId),this.state.bank=u.getBank(this.state.bankId),this.state.bank?console.log("[Quiz] ⚡ 从本地缓存加载题库:",{id:this.state.bank.id,name:this.state.bank.name,version:this.state.bank.version,questionCount:(s=this.state.bank.questions)==null?void 0:s.length}):console.log("[Quiz] 📡 本地无缓存，从 JSON 文件加载..."),(!this.state.bank||!Array.isArray(this.state.bank.questions))&&(console.log("[Quiz] 📡 尝试从云端加载题库..."),await this.loadBankFromJson()),!this.state.bank||!Array.isArray(this.state.bank.questions)){console.error("[Quiz] ❌ 题库加载失败"),r.showToast("题库加载失败","error"),setTimeout(()=>window.location.href="index.html",1e3);return}if(this.state.bank.enabled===!1){console.warn("[Quiz] 🚫 题库已被管理员禁用:",this.state.bankId),r.showToast("该题库已被管理员禁用","error"),setTimeout(()=>window.location.href="index.html",1e3);return}if(b.mark("题库加载完成"),console.log("[Quiz] ✅ 题库加载成功:",{id:this.state.bank.id,name:this.state.bank.name,version:this.state.bank.version,questionCount:this.state.bank.questions.length}),b.mark("准备题目"),console.log("[Quiz] 🔄 准备题目列表..."),this.prepareQuestions(),b.mark("题目准备完成"),console.log("[Quiz] ✅ 题目准备完成:",this.state.questions.length,"题"),this.state.mode==="review"&&(console.log("[Quiz] 📖 背题模式：自动显示所有答案"),this.state.questions.forEach(a=>{this.state.submitted[a.id]=!0,this.state.showExplanation[a.id]=!0,this.state.answers[a.id]=a.answer})),this.state.mode==="wrong"&&this.state.questions.length===0){console.log("[Quiz] ✨ 没有错题"),r.showToast("没有错题，真棒！","success"),setTimeout(()=>window.location.href="index.html",1e3);return}if(this.state.mode==="spaced"&&this.state.questions.length===0){console.log("[Quiz] 📅 没有需要复习的题目"),r.showToast("没有需要复习的题目","info"),setTimeout(()=>window.location.href="index.html",1e3);return}if(this.state.mode==="bookmark"&&this.state.questions.length===0){console.log("[Quiz] ⭐ 没有收藏的题目"),r.showToast("没有收藏的题目","info"),setTimeout(()=>window.location.href="index.html",1e3);return}if(!v.isRegistered()){console.log("[Quiz] 👤 未注册用户"),r.showToast("请先在首页注册后再刷题","error"),setTimeout(()=>window.location.href="index.html",1500);return}b.mark("恢复会话"),console.log("[Quiz] 📂 恢复会话状态..."),this.restoreSession(),this.state.startTime=Date.now(),this.state.questionStartTime=Date.now(),this.state.mode==="exam"&&(console.log("[Quiz] ⏱️ 考试模式：启动计时器"),this.startExamTimer()),b.mark("开始渲染"),console.log("[Quiz] 🎨 开始渲染页面..."),this.render(),this.bindEvents(),b.mark("渲染完成"),this.autoSaveInterval=setInterval(()=>this.saveSession(),3e4),this.timerInterval=setInterval(()=>this.updateTimerDisplay(),1e3),y.startQuiz(this.state.bankId,((i=this.state.bank)==null?void 0:i.name)||"",this.state.mode,this.state.questions.length),this._beforeUnloadHandler=()=>this._flushStatsSync(),window.addEventListener("beforeunload",this._beforeUnloadHandler),console.log("[Quiz] ========== 刷题页面初始化完成 =========="),b.done({bankId:this.state.bankId,bankName:(n=this.state.bank)==null?void 0:n.name,mode:this.state.mode,questionCount:this.state.questions.length})},updateTimerDisplay(){const t=document.getElementById("question-timer");t&&(t.textContent=this.getQuestionTimeDisplay())},restoreSession(){var e;const t=u.getSession(this.state.bankId,this.state.mode);if(console.log("[Quiz] 📂 恢复会话:",{bankId:this.state.bankId,mode:this.state.mode,found:!!t,answers:t?Object.keys(t.answers||{}).length:0,submitted:t?Object.keys(t.submitted||{}).length:0}),!t){(this.state.mode==="exam"||this.state.mode==="random"||this.state.mode==="shuffle_options")&&(this.state.savedOrderIds=this.state.questions.map(s=>s.id));return}if(this.state.currentIndex=t.currentIndex||0,this.state.mode!=="review"&&(this.state.answers=t.answers||{},this.state.submitted=t.submitted||{},this.state.showExplanation=t.showExplanation||{}),this.state.questionTimes=t.questionTimes||{},this.state.optionOrderCache=t.optionOrderCache||{},this.state.savedOrderIds=t.questionOrderIds||null,this.state.savedOrderIds&&(this.state.mode==="exam"||this.state.mode==="random"||this.state.mode==="shuffle_options"))if(this.state.mode==="exam"){const s=((e=this.state.bank)==null?void 0:e.questions)||[],i=new Map(s.map(a=>[a.id,a])),n=this.state.savedOrderIds.map(a=>i.get(a)).filter(Boolean);n.length>0&&(this.state.questions=n)}else{const s=new Map(this.state.savedOrderIds.map((i,n)=>[i,n]));this.state.questions.sort((i,n)=>{const a=s.get(i.id),o=s.get(n.id);return a!==void 0&&o!==void 0?a-o:0})}this.state.mode==="exam"&&t.examTimeRemaining>0&&(this.state.examTimeRemaining=t.examTimeRemaining),this.state._lastPushAnswered=t.lastPushAnswered||0,this.state._lastPushCorrect=t.lastPushCorrect||0,this.state._lastPushDuration=t.lastPushDuration||0},saveSession(){if(this.state.isFinished)return;const t=this.state.mode==="random"||this.state.mode==="shuffle_options"||this.state.mode==="exam"?this.state.questions.map(s=>s.id):void 0,e=this.state.mode==="exam"?{examTimeRemaining:this.state.examTimeRemaining}:{};u.saveSession(this.state.bankId,this.state.mode,{currentIndex:this.state.currentIndex,filterType:this.state.filterType||"all",answerMode:this.state.answerMode,answers:this.state.answers,submitted:this.state.submitted,showExplanation:this.state.showExplanation,questionTimes:this.state.questionTimes,optionOrderCache:this.state.optionOrderCache,questionOrderIds:t,lastPushAnswered:this.state._lastPushAnswered,lastPushCorrect:this.state._lastPushCorrect,lastPushDuration:this.state._lastPushDuration,...e}),v.pushProgress(u.getProgress()),this._saveReviewDuration()},_saveReviewDuration(){if(!this.state.isReviewMode||!this.state.startTime)return;const t=Math.round((Date.now()-this.state.startTime)/1e3),e=this.state._reviewDurationSaved||0;t>e&&(u.addDuration(t-e),this.state._reviewDurationSaved=t)},async loadBankFromJson(){const t=await S.loadBankById(this.state.bankId);t?(this.state.bank=t,r.showToast(`题库 "${t.name}" 加载成功`,"success",1500)):r.showToast("题库加载失败","error",5e3)},prepareQuestions(){if(this.state.searchKeyword){const e=this.state.searchKeyword.toLowerCase(),i=[...this.state.bank.questions||[]].filter(n=>[n.question,n.explanation,n.category,...n.options||[],n.answer].join(" ").toLowerCase().includes(e));i.length===0&&r.showToast(`未找到匹配题目：「${this.state.searchKeyword}」`,"info",3e3),this.state.questions=i,this.state.isReviewMode=!0;return}let t=[...this.state.bank.questions||[]];switch(this.state.filterType&&this.state.filterType!=="all"&&(t=t.filter(e=>e.type===this.state.filterType)),this.state.mode){case"wrong":{const e=u.getWrongQuestions(this.state.bankId);t=t.filter(s=>e.includes(s.id));break}case"random":case"shuffle_options":t=r.shuffleArray(t);break;case"review":this.state.isReviewMode=!0;break;case"spaced":{t=u.getDueQuestions(this.state.bankId);break}case"bookmark":{const e=u.getBankBookmarks(this.state.bankId);t=t.filter(s=>e.includes(s.id));break}case"exam":this.state.examCount>0&&this.state.examCount<t.length&&(t=r.shuffleArray(t).slice(0,this.state.examCount));break}this.state.questions=t},render(){this.renderHeader(),this.renderQuestion(),this.renderFooter(),this.renderSidebarGrid()},renderSidebarGrid(){const t=document.getElementById("sidebar-grid");if(!t)return;const e=this.state.questions,s=document.getElementById("sidebar-count");s&&(s.textContent=e.length+" 题"),t.innerHTML=e.map((n,a)=>{let o="sidebar-grid-item";return a===this.state.currentIndex?o+=" current":this.state.submitted[n.id]&&(o+=this.checkAnswer(n)?" correct":" wrong"),`<div class="${o}" data-index="${a}">${a+1}</div>`}).join(""),t.querySelectorAll(".sidebar-grid-item").forEach(n=>{n.addEventListener("click",()=>{const a=parseInt(n.dataset.index);isNaN(a)||this.goToQuestion(a)})});const i=t.querySelector(".sidebar-grid-item.current");i&&i.scrollIntoView({block:"nearest",behavior:"smooth"})},recordQuestionTime(){const t=this.state.questions[this.state.currentIndex];if(!t||!this.state.questionStartTime)return;const e=Math.round((Date.now()-this.state.questionStartTime)/1e3);this.state.questionTimes[t.id]||(this.state.questionTimes[t.id]=0),this.state.questionTimes[t.id]+=e,this.state.questionStartTime=Date.now()},getQuestionTimeDisplay(){const t=this.state.questions[this.state.currentIndex];if(!t)return"";const e=this.state.questionTimes[t.id]||0,s=this.state.questionStartTime?Math.round((Date.now()-this.state.questionStartTime)/1e3):0,i=e+s;if(i<60)return`${i}秒`;const n=Math.floor(i/60),a=i%60;return`${n}分${a}秒`},startExamTimer(){(!this.state.examTimeRemaining||this.state.examTimeRemaining<=0)&&(this.state.examTimeRemaining=this.state.examTimeLimit),this.state.examTimer=setInterval(()=>{this.state.examTimeRemaining--,this.updateExamTimerDisplay(),this.state.examTimeRemaining<=0&&(clearInterval(this.state.examTimer),this.state.examTimer=null,r.showToast("考试时间到！","error"),this.showFinishModal(!0))},1e3)},updateExamTimerDisplay(){const t=document.getElementById("exam-timer");if(!t)return;const e=this.state.examTimeRemaining,s=Math.floor(e/60),i=e%60;t.textContent=`${String(s).padStart(2,"0")}:${String(i).padStart(2,"0")}`,e<=300&&t.classList.add("danger")},renderFooter(){const t=document.getElementById("btn-submit"),e=document.getElementById("footer-hint"),s=document.querySelector(".quiz-footer-actions"),i=this.state.questions[this.state.currentIndex],n=this.state.answerMode==="lightning",a=this.state.answerMode==="instant",o=n||a,l=o&&(i==null?void 0:i.type)==="multiple",c=i&&this.state.submitted[i.id],d=i&&this.hasAnswer(i),h=f=>{t&&(t.style.display=f?"none":""),s&&s.classList.toggle("submit-hidden",f)},p=f=>{e&&(e.textContent=f)};if(!i||this.state.isFinished){h(!0),p("");return}this.state.isReviewMode?(h(!0),p("📖 背题模式 - 直接查看答案和解析")):c?(h(!0),p(this.getSubmittedHint(i))):o&&!l&&i.type!=="fill"&&i.type!=="code"&&i.type!=="essay"?(h(!0),p(n?"闪电模式 - 点击选项直接判对错，答对自动跳题":"即时判断 - 点击选项直接判对错，不自动跳题")):(h(!1),t&&(t.disabled=!d,t.title=d?"":"请先作答"),p(l?n?"闪电模式 · 多选题请选择完整答案后提交，答对自动跳题":"即时判断 · 多选题请选择完整答案后提交，不自动跳题":"按 Enter 提交 · A-D 选答案 · Alt+←→ 切换"));const g=document.querySelector(".quiz-footer-actions .btn-secondary:nth-child(2)");g&&(this.state.currentIndex>=this.state.questions.length-1?(g.textContent="完成",g.onclick=()=>this.finish()):(g.textContent="下一题",g.onclick=()=>this.nextQuestion()))},getSubmittedHint(t){const e=this.state.answers[t.id];return(t.type==="essay"||t.type==="简答题")&&(e==null?void 0:e.selfCorrect)===void 0?"已显示参考答案，请完成自评":this.checkAnswer(t)?"回答正确，可进入下一题":"回答错误，查看解析后继续"},renderHeader(){document.getElementById("quiz-title").textContent=this.state.bank.name;const t=document.getElementById("exam-timer");t&&(t.style.display=this.state.mode==="exam"?"":"none"),this.updateProgress()},updateProgress(){const t=this.state.currentIndex+1,e=this.state.questions.length,s=document.getElementById("quiz-progress-fill");s&&(s.style.width=Math.round(t/e*100)+"%");const i=document.getElementById("quiz-progress-text");i&&(i.textContent=`${t} / ${e}`)},toggleNav(){const t=document.getElementById("nav-panel"),e=document.getElementById("nav-overlay");if(t.classList.toggle("show"),e.classList.toggle("show"),t.classList.contains("show")){this.renderQuestionNav();const s=t.querySelector(".question-nav-item.current");s&&s.scrollIntoView({block:"center",behavior:"smooth"})}},renderQuestionNav(){const t=document.getElementById("question-nav-grid"),e=this.state.questions;t.innerHTML=e.map((s,i)=>{let n="question-nav-item";return i===this.state.currentIndex?n+=" current":this.state.submitted[s.id]&&(n+=this.checkAnswer(s)?" correct":" wrong"),`<div class="${n}" data-index="${i}">${i+1}</div>`}).join(""),t.querySelectorAll(".question-nav-item").forEach(s=>{s.addEventListener("click",()=>{const i=parseInt(s.dataset.index);this.goToQuestion(i),document.getElementById("nav-panel").classList.remove("show"),document.getElementById("nav-overlay").classList.remove("show")})})},renderQuestion(){const t=this.state.questions[this.state.currentIndex];if(!t){console.warn("[Quiz] 没有题目可渲染",{currentIndex:this.state.currentIndex,questionsLength:this.state.questions.length});return}const e=document.getElementById("question-container"),s=this.state.isReviewMode,i=s||this.state.submitted[t.id],n=s?t.answer:this.state.answers[t.id],a=s?!0:i?this.checkAnswer(t):null,o=s||this.state.showExplanation[t.id];let l=`
            <div class="question-card" data-question-id="${r.escapeHtml(t.id)}">
                <div class="question-header">
                    <div class="question-meta">
                        <span class="question-number">第 ${this.state.currentIndex+1} 题</span>
                        <span class="question-type ${t.type}">${r.getTypeName(t.type)}</span>
                        <span class="question-timer" id="question-timer">${this.getQuestionTimeDisplay()}</span>
                        ${t.difficulty?`
                            <div class="question-difficulty" aria-label="难度 ${t.difficulty}/5">
                                ${Array.from({length:5},(c,d)=>`<div class="question-difficulty-dot ${d<t.difficulty?"active":""}"></div>`).join("")}
                            </div>
                        `:""}
                    </div>
                    <div class="question-actions">
                        ${t.category?`<span class="question-category">${r.escapeHtml(t.category)}</span>`:""}
                        ${i?`<button class="btn-ai" onclick="Quiz.openAIAnalysis(${t.id})" title="AI解析" aria-label="AI解析">${r.icon("sparkles")} AI</button>`:""}
                        ${s?"":`<button class="btn-bookmark ${u.isBookmarked(this.state.bankId,t.id)?"active":""}" onclick="Quiz.toggleBookmark(${t.id})" title="收藏" aria-label="收藏此题">${u.isBookmarked(this.state.bankId,t.id)?r.icon("star","filled"):r.icon("star")}</button>`}
                    </div>
                </div>

                <div class="question-body">
                    <div class="question-text">
                        ${r.parseMarkdown(t.question)}
                    </div>

                    ${t.img||t.image?`<img class="question-image" src="${r.escapeHtml(t.img||t.image)}" alt="题目图片" loading="lazy">`:""}

                    ${this.renderOptions(t,i,n)}

                    ${i&&o?this.renderExplanation(t,a):""}
                </div>
            </div>
        `;e.innerHTML=l,r.renderMath(e),r.highlightCode(e),r.initIcons(),this.bindOptionEvents(t)},renderOptions(t,e,s){switch(t.type){case"single":return this.renderSingleOptions(t,e,s);case"multiple":return this.renderMultipleOptions(t,e,s);case"judge":return this.renderJudgeOptions(t,e,s);case"fill":return this.renderFillInput(t,e,s);case"code":return this.renderCodeInput(t,e,s);case"essay":case"简答题":return this.renderEssayInput(t,e,s);default:return""}},getDisplayOptions(t){const e=t.options||[],s=e.map((i,n)=>{const a=typeof i=="string"?i:i.text||"",o=typeof i=="object"&&i.img||"";return{displayLetter:String.fromCharCode(65+n),originalLetter:String.fromCharCode(65+n),text:a,img:o}});if(this.state.mode!=="shuffle_options"&&this.state.mode!=="exam")return s;if(!this.state.optionOrderCache[t.id]){const i=e.map((n,a)=>a);this.state.optionOrderCache[t.id]=r.shuffleArray(i)}return this.state.optionOrderCache[t.id].map((i,n)=>{const a=e[i],o=typeof a=="string"?a:a.text||"",l=typeof a=="object"&&a.img||"";return{displayLetter:String.fromCharCode(65+n),originalLetter:String.fromCharCode(65+i),text:o,img:l}})},renderSingleOptions(t,e,s){return`
            <div class="options-list" role="radiogroup" aria-label="选项">
                ${this.getDisplayOptions(t).map(n=>{const a=n.displayLetter,o=n.originalLetter,l=o===t.answer,c=o===s;let d="option-item",h=`<div class="option-marker">${a}</div>`;return e?l?(d+=" correct disabled",h=`<div class="option-marker">${r.icon("check")}</div>`):c&&!l?(d+=" wrong disabled",h=`<div class="option-marker">${r.icon("x")}</div>`):d+=" disabled":c&&(d+=" selected"),`
                        <div class="${d}" data-answer="${o}" role="radio" aria-checked="${c}" tabindex="0">
                            ${h}
                            <div class="option-content">
                                ${r.parseMarkdown(n.text.replace(/^[A-Z]\.\s*/,""))}
                                ${n.img?`<img src="${r.escapeHtml(n.img)}" class="option-image" loading="lazy" alt="选项图片">`:""}
                            </div>
                        </div>
                    `}).join("")}
            </div>
        `},renderMultipleOptions(t,e,s){const i=this.getDisplayOptions(t),n=s||[],a=t.answer||[];return`
            <div class="options-list" role="group" aria-label="选项">
                ${i.map(o=>{const l=o.displayLetter,c=o.originalLetter;let d="option-item",h=`<div class="option-marker">${l}</div>`;if(e){const p=a.includes(c),g=n.includes(c);p?(d+=" correct disabled",h=`<div class="option-marker">${r.icon("check")}</div>`):g?(d+=" wrong disabled",h=`<div class="option-marker">${r.icon("x")}</div>`):d+=" disabled"}else n.includes(c)&&(d+=" selected");return`
                        <div class="${d}" data-answer="${c}" role="checkbox" aria-checked="${n.includes(c)}" tabindex="0">
                            ${h}
                            <div class="option-content">
                                ${r.parseMarkdown(o.text.replace(/^[A-Z]\.\s*/,""))}
                                ${o.img?`<img src="${r.escapeHtml(o.img)}" class="option-image" loading="lazy" alt="选项图片">`:""}
                            </div>
                        </div>
                    `}).join("")}
            </div>
            ${e?"":'<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 多选题，可选择多个选项</div>'}
        `},renderJudgeOptions(t,e,s){return`
            <div class="judge-options" role="radiogroup" aria-label="判断选项">
                <div class="judge-option ${e&&t.answer===!0?"correct":""} ${e&&s===!0&&t.answer!==!0?"wrong":""} ${!e&&s===!0?"selected":""} ${e?"disabled":""}" data-answer="true" role="radio" aria-checked="${s===!0}" tabindex="0">
                    <span class="judge-option-icon"></span>
                    <span>正确</span>
                </div>
                <div class="judge-option ${e&&t.answer===!1?"correct":""} ${e&&s===!1&&t.answer!==!1?"wrong":""} ${!e&&s===!1?"selected":""} ${e?"disabled":""}" data-answer="false" role="radio" aria-checked="${s===!1}" tabindex="0">
                    <span class="judge-option-icon"></span>
                    <span>错误</span>
                </div>
            </div>
        `},renderFillInput(t,e,s){const i=s||[];return`
            <div class="fill-inputs">
                ${(t.answer||[]).map((a,o)=>{let l="fill-input";if(e){const c=this.checkFillAnswer(i[o],a);l+=c?" correct":" wrong"}return`
                        <div class="fill-input-group">
                            <span class="fill-input-label">空${o+1}</span>
                            <input type="text" class="${l}" 
                                   data-index="${o}" 
                                   value="${i[o]||""}" 
                                   ${e?"readonly":""}
                                   placeholder="请输入答案"
                                   aria-label="填空 ${o+1}">
                        </div>
                    `}).join("")}
            </div>
            ${e?"":'<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 填空题，输入后按 Enter 跳到下一空</div>'}
        `},renderCodeInput(t,e,s){const i=(s==null?void 0:s.text)||s||"";return`
            <div style="margin-top:var(--space-4)">
                <div class="code-editor" id="code-editor" 
                     ${e?'contenteditable="false"':'contenteditable="true"'}
                     role="textbox" aria-multiline="true" aria-label="代码编辑器"
                     data-placeholder="请输入代码...">${r.escapeHtml(i)}</div>
            </div>
            ${e?"":'<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">💡 编程题，请编写代码</div>'}
        `},renderEssayInput(t,e,s){const i=((s==null?void 0:s.text)||"").trim(),n=s==null?void 0:s.selfCorrect;return this.state.isReviewMode?"":e&&n!==void 0?i?`
                <div style="margin-top:var(--space-4);padding:12px;background:var(--bg-hover);border-radius:var(--radius-sm)">
                    <strong>你的回答：</strong><br>${r.escapeHtml(i)}
                </div>
            `:"":e?`
                <div style="margin-top:var(--space-4)">
                    <div style="margin-bottom:12px">
                        <button class="btn btn-success btn-sm" onclick="Quiz.selfMarkEssay(${t.id}, true)">${r.icon("check-circle")} 我答对了</button>
                        <button class="btn btn-danger btn-sm" style="margin-left:8px" onclick="Quiz.selfMarkEssay(${t.id}, false)">${r.icon("x-circle")} 我答错了</button>
                    </div>
                </div>
            `:`
            <div style="margin-top:var(--space-4);text-align:center">
                <button class="btn btn-primary" style="padding:10px 32px;font-size:15px" onclick="Quiz.submitEssay(${t.id})">
                    📖 一键查看答案
                </button>
                <div style="margin-top:6px;font-size:12px;color:var(--text-tertiary)">点击按钮查看参考答案与解析</div>
            </div>
        `},renderExplanation(t,e){var l;const s=this.state.isReviewMode,i=t.type==="essay"||t.type==="简答题",n=!i||((l=this.state.answers[t.id])==null?void 0:l.selfCorrect)!==void 0,a=!s&&n,o=i&&t.answer?`
            <div style="margin-bottom:var(--space-4)">
                <strong>参考答案：</strong>
                <div style="margin-top:8px">${r.parseMarkdown(t.answer)}</div>
            </div>
        `:"";return`
            ${a?`
            <div class="result-banner ${e?"correct":"wrong"}">
                <span class="result-banner-icon">${e?"🎉":"😔"}</span>
                <span class="result-banner-text">${e?"回答正确！":"回答错误"}</span>
            </div>
            `:""}

            <div class="explanation">
                <div class="explanation-header">
                    <span class="explanation-icon">💡</span>
                    <span>答案解析</span>
                </div>
                <div class="explanation-content">
                    ${o}
                    ${r.parseMarkdown(t.explanation||"暂无解析")}
                </div>
                ${t.memoryAid?`
                    <div class="memory-aid">
                        <span class="memory-aid-icon">🧠</span>
                        <span class="memory-aid-text">${r.escapeHtml(t.memoryAid)}</span>
                    </div>
                `:""}
                ${t.code?`
                    <div style="margin-top:var(--space-4)">
                        <strong>参考代码：</strong>
                        <pre><code class="language-${t.codeLanguage||"c"}">${r.escapeHtml(t.code)}</code></pre>
                    </div>
                `:""}
            </div>
        `},getQuestionCard(){return document.querySelector("#question-container .question-card")},updateSelectedOptionState(t){const e=this.getQuestionCard();e&&e.querySelectorAll(".option-item, .judge-option").forEach(s=>{const i=s.dataset.answer===String(t);s.classList.toggle("selected",i),s.setAttribute("aria-checked",String(i))})},updateMultipleOptionState(t){const e=this.getQuestionCard();e&&e.querySelectorAll(".option-item").forEach(s=>{const i=t.includes(s.dataset.answer);s.classList.toggle("selected",i),s.setAttribute("aria-checked",String(i))})},bindOptionEvents(t){if(this.state.isReviewMode||this.state.submitted[t.id])return;const s=this.getQuestionCard();if(s){if(t.type==="single"&&s.querySelectorAll(".option-item").forEach(i=>{i.addEventListener("click",()=>{const n=i.dataset.answer;this.selectAnswer(t.id,n)})}),t.type==="multiple"&&s.querySelectorAll(".option-item").forEach(i=>{i.addEventListener("click",()=>{const n=i.dataset.answer;this.toggleAnswer(t.id,n)})}),t.type==="judge"&&s.querySelectorAll(".judge-option").forEach(i=>{i.addEventListener("click",()=>{const n=i.dataset.answer==="true";this.selectAnswer(t.id,n)})}),t.type==="fill"){s.querySelectorAll(".fill-input").forEach(n=>{n.addEventListener("input",r.debounce(()=>{this.updateFillAnswer(t.id)},E)),n.addEventListener("keydown",a=>{if(a.key==="Enter"){a.preventDefault();const o=[...s.querySelectorAll(".fill-input")],l=o.indexOf(n);l<o.length-1?o[l+1].focus():this.submitCurrent()}})});const i=s.querySelector(".fill-input");i&&setTimeout(()=>i.focus(),A)}if(t.type==="code"){const i=s.querySelector("#code-editor");if(i){const n=()=>i.innerText||"",a=()=>{this.state.answers[t.id]=n(),this.renderFooter()};i.addEventListener("input",a),i.addEventListener("paste",()=>{setTimeout(()=>{i.textContent=n(),a()},10)})}}}},selectAnswer(t,e){const s=this.state.answerMode==="lightning",i=this.state.answerMode==="instant";if((s||i)&&this.state.submitted[t]){this.nextQuestion();return}if(this.state.answers[t]=e,s||i){this.submitCurrent();return}this.saveSession(),this.updateSelectedOptionState(e),this.renderFooter()},toggleAnswer(t,e){const s=this.state.answerMode==="lightning",i=this.state.answerMode==="instant";if((s||i)&&this.state.submitted[t]){this.nextQuestion();return}this.state.answers[t]||(this.state.answers[t]=[]);const n=this.state.answers[t],a=n.indexOf(e);a>=0?n.splice(a,1):(n.push(e),n.sort()),this.saveSession(),this.updateMultipleOptionState(n),this.renderFooter()},updateFillAnswer(t){const e=this.getQuestionCard(),s=e?e.querySelectorAll(".fill-input"):[],i=[];s.forEach(n=>{i.push(n.value.trim())}),this.state.answers[t]=i,this.saveSession(),this.renderFooter()},submitEssay(t){this.state.questions.find(s=>s.id===t)&&(this.recordQuestionTime(),this.state.answers[t]={text:""},this.state.submitted[t]=!0,this.state.showExplanation[t]=!0,this.saveSession(),this.renderQuestion(),this.renderFooter(),window.scrollTo({top:0,behavior:"smooth"}))},selfMarkEssay(t,e){if(!this.state.questions.find(a=>a.id===t))return;const n={text:(this.state.answers[t]||{}).text||"",selfCorrect:e};this.state.answers[t]=n,this.state.submitted[t]=!0,this.state.showExplanation[t]=!0,u.updateQuestionProgress(this.state.bankId,t,e,n),this.saveSession(),this.renderQuestion(),this.renderFooter()},submitCurrent(){var a;const t=this.state.questions[this.state.currentIndex];if(!t)return;if(this.state.submitted[t.id]){this.nextQuestion();return}if(!this.hasAnswer(t)){this.state.answerMode!=="lightning"&&r.showToast("请先作答","info");return}this.recordQuestionTime(),this.state.submitted[t.id]=!0,this.state.showExplanation[t.id]=!0;const e=this.checkAnswer(t);u.updateQuestionProgress(this.state.bankId,t.id,e,this.state.answers[t.id]),this.saveSession(),y.submitAnswer(this.state.bankId,t.type,e,t.difficulty);const s=this.state.questionTimes[t.id]||0;y.questionTime(this.state.bankId,((a=this.state.bank)==null?void 0:a.name)||"",t.id,t.category,t.type,t.difficulty,s,e),this._markStatsDirty(),this.renderQuestion(),this.renderFooter();const i=this.state.answerMode==="lightning",n=this.state.answerMode==="autoNext";if(i&&e){const o=this.getQuestionCard();o&&(o.classList.add("correct-flash"),setTimeout(()=>o.classList.remove("correct-flash"),$)),setTimeout(()=>this.nextQuestion(),$);return}if(n&&e){setTimeout(()=>this.nextQuestion(),500);return}window.scrollTo({top:0,behavior:"smooth"})},hasAnswer(t){const e=this.state.answers[t.id];switch(t.type){case"single":case"judge":return e!=null;case"multiple":return Array.isArray(e)&&e.length>0;case"fill":return Array.isArray(e)&&e.some(s=>s.trim()!=="");case"code":return e&&(typeof e=="string"?e.trim()!=="":!0);case"essay":case"简答题":return e&&e.selfCorrect!==void 0;default:return!1}},checkAnswer(t){const e=this.state.answers[t.id];switch(t.type){case"single":return e===t.answer;case"multiple":{const s=new Set(e||[]),i=new Set(t.answer||[]);return s.size===i.size&&[...s].every(n=>i.has(n))}case"judge":return e===t.answer;case"fill":return(t.answer||[]).every((s,i)=>this.checkFillAnswer(e==null?void 0:e[i],s));case"code":return!0;case"essay":case"简答题":{const s=this.state.answers[t.id];return s&&s.selfCorrect===!0}default:return!1}},checkFillAnswer(t,e){return!t||!e?!1:t.trim().toLowerCase()===e.trim().toLowerCase()},nextQuestion(){this.state.isNavigating||this.state.currentIndex<this.state.questions.length-1&&(this.state.isNavigating=!0,this.recordQuestionTime(),this.state.currentIndex++,this.state.questionStartTime=Date.now(),this.saveSession(),this._markStatsDirty(),this.render(),window.scrollTo({top:0,behavior:"smooth"}),setTimeout(()=>{this.state.isNavigating=!1},T))},toggleBookmark(t){const e=u.toggleBookmark(this.state.bankId,t);r.showToast(e?"已收藏":"已取消收藏","success",1500),this.renderQuestion()},showSettings(){const t=u.getSettings(),e=t.fontSize||16,s=t.answerMode||"normal",i=t.swipeNavigation!==!1,n=t.aiEngine||"metaso",a=t.customAiEngine||"",o=`
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
                <option value="normal" ${s==="normal"?"selected":""}>普通模式 - 手动提交手动跳题</option>
                <option value="autoNext" ${s==="autoNext"?"selected":""}>自动跳题 - 手动提交答对自动跳</option>
                <option value="lightning" ${s==="lightning"?"selected":""}>闪电模式 - 点击即判答对自动跳</option>
                <option value="instant" ${s==="instant"?"selected":""}>即时判断 - 点击即判不自动跳</option>
            </select>
            <label>左右滑动</label>
            <label class="toggle-label">
                <input type="checkbox" id="setting-swipe" ${i?"checked":""}>
                <span class="toggle-slider"></span>
                <span>滑动切换题目</span>
            </label>

            <label>AI 搜索引擎</label>
            <select id="setting-ai-engine">
                <option value="metaso" ${n==="metaso"?"selected":""}>秘塔搜索 (metaso.cn)</option>
                <option value="felo" ${n==="felo"?"selected":""}>Felo AI (felo.ai)</option>
                <option value="andi" ${n==="andi"?"selected":""}>Andi Search (andisearch.com)</option>
                <option value="baidu" ${n==="baidu"?"selected":""}>百度搜索 (baidu.com)</option>
                <option value="custom" ${n==="custom"?"selected":""}>自定义引擎</option>
            </select>
            <div id="custom-engine-wrap" style="display: ${n==="custom"?"block":"none"}; margin-top: 8px;">
                <label>自定义引擎 URL</label>
                <input type="text" id="setting-custom-engine" placeholder="https://example.com/search?q={keyword}" value="${r.escapeHtml(a)}">
                <p style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">用 {keyword} 表示搜索关键词</p>
            </div>
        `;r.showModal({title:`${r.icon("settings")} 设置`,content:o,buttons:[{label:"保存",class:"btn-primary",onClick:d=>{var w;const h=parseInt(d.querySelector("#setting-font-size").value),p=d.querySelector("#setting-answer-mode").value,g=d.querySelector("#setting-ai-engine").value,f=((w=d.querySelector("#setting-custom-engine"))==null?void 0:w.value)||"";h>=12&&h<=24&&(u.updateSettings({fontSize:h}),r.applyFontSize(h));const k=d.querySelector("#setting-swipe").checked;u.updateSettings({answerMode:p,swipeNavigation:k,aiEngine:g,customAiEngine:f}),this.state.answerMode=p,v.pushSettings(u.getSettings()),r.showToast("设置已保存","success"),d.remove()}},{label:"取消",class:"btn-secondary",onClick:d=>d.remove()}],size:"sm"});const l=document.getElementById("setting-ai-engine"),c=document.getElementById("custom-engine-wrap");l&&c&&l.addEventListener("change",()=>{c.style.display=l.value==="custom"?"block":"none"})},_cleanMarkdown(t){return t.replace(/```(\w*)\n/g,"").replace(/```/g,"").replace(/`([^`]+)`/g,"$1").replace(/\$([^$]+)\$/g,"$1").replace(/[#*_~\[\]]/g,"").replace(/\s+/g," ").trim()},_buildSearchKeyword(t){let e=this._cleanMarkdown(t.question);return t.options&&t.options.length>0&&(e+=" "+t.options.join(" ")),e.length>300&&(e=e.substring(0,300)),t.code&&(e+=" "+t.code.substring(0,200)),e},_buildSearchUrl(t){const e=u.getSettings(),s=e.aiEngine||"metaso",i=e.customAiEngine||"",n=encodeURIComponent(t);console.log("[AI] 🔍 构建搜索 URL:",{aiEngine:s,customEngine:i,keyword:t});const a={felo:`https://felo.ai/search?q=${n}`,andi:`https://andisearch.com/?q=${n}`,baidu:`https://www.baidu.com/s?wd=${n}`,metaso:`https://metaso.cn/?q=${n}`};if(s!=="custom"){const l=a[s]||a.metaso;return console.log("[AI] ✅ 使用内置引擎:",s,l),l}if(!i)return console.warn("[AI] ⚠️ 自定义引擎 URL 为空，使用默认引擎"),a.metaso;let o=i;return o.includes("{keyword}")||(o+=o.includes("?")?"&":"?",o+="q={keyword}"),o=o.replace("{keyword}",n),console.log("[AI] ✅ 使用自定义引擎:",o),o},openAIAnalysis(t){const e=this.state.questions.find(n=>n.id===t);if(!e)return;const s=this._buildSearchKeyword(e),i=this._buildSearchUrl(s);window.open(i,"_blank")},prevQuestion(){this.state.isNavigating||this.state.currentIndex>0&&(this.state.isNavigating=!0,this.recordQuestionTime(),this.state.currentIndex--,this.state.questionStartTime=Date.now(),this.saveSession(),this._markStatsDirty(),this.render(),window.scrollTo({top:0,behavior:"smooth"}),setTimeout(()=>{this.state.isNavigating=!1},T))},goToQuestion(t){this.state.isNavigating||t>=0&&t<this.state.questions.length&&(this.state.isNavigating=!0,this.recordQuestionTime(),this.state.currentIndex=t,this.state.questionStartTime=Date.now(),this.saveSession(),this.render(),window.scrollTo({top:0,behavior:"smooth"}),setTimeout(()=>{this.state.isNavigating=!1},T))},showFinishModal(t=!1){const e=this.state.questions.length,s=Object.keys(this.state.submitted).length,i=e-s;let n=0;Object.keys(this.state.submitted).forEach(c=>{const d=this.state.questions.find(h=>h.id==c);d&&this.checkAnswer(d)&&n++});const o=`
            <div class="finish-modal-overlay show" id="finish-modal" onclick="if(event.target===this)Quiz.closeFinishModal()">
                <div class="finish-modal">
                    <div class="finish-modal-icon">${t?"⏰":i>0?"📝":"🎯"}</div>
                    <div class="finish-modal-title">${t?"考试时间到！":i>0?"还有题目未完成":"全部答完！"}</div>
                    <div class="finish-modal-desc">${t?"时间已耗尽，请确认结束考试":i>0?`还有 ${i} 题未答，确定要结束吗？`:"点击确认查看结果"}</div>
                    <div class="finish-modal-stats">
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value">${s}</div>
                            <div class="finish-modal-stat-label">已答</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value success">${n}</div>
                            <div class="finish-modal-stat-label">正确</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value ${s-n>0?"danger":""}">${s-n}</div>
                            <div class="finish-modal-stat-label">错误</div>
                        </div>
                        <div class="finish-modal-stat">
                            <div class="finish-modal-stat-value">${i}</div>
                            <div class="finish-modal-stat-label">未答</div>
                        </div>
                    </div>
                    <div class="finish-modal-actions">
                        ${!t&&i>0?`<button class="btn btn-primary" onclick="Quiz.closeFinishModal()">${r.icon("book-open")} 继续答题</button>`:""}
                        <button class="btn btn-primary" onclick="Quiz.confirmFinish()">${r.icon("check-circle")} 确认结束</button>
                        ${t?"":`<button class="btn btn-ghost" onclick="Quiz.saveAndQuit()">${r.icon("save")} 保存进度退出</button>`}
                        ${t?"":`<button class="btn btn-ghost" onclick="Quiz.closeFinishModal()">${r.icon("x")} 取消</button>`}
                    </div>
                </div>
            </div>
        `,l=document.createElement("div");l.innerHTML=o,document.body.appendChild(l),r.initIcons()},closeFinishModal(){const t=document.getElementById("finish-modal");t&&t.remove()},saveAndQuit(){this.closeFinishModal(),this.saveSession(),r.showToast("进度已保存","success"),setTimeout(()=>window.location.href="index.html",_)},confirmFinish(){this.closeFinishModal(),this.state.examTimer&&(clearInterval(this.state.examTimer),this.state.examTimer=null),this.autoSaveInterval&&clearInterval(this.autoSaveInterval),this.recordQuestionTime(),u.clearSession(this.state.bankId,this.state.mode),this.state.isFinished=!0,this.renderFooter(),this.renderResult()},finish(){this.showFinishModal()},renderResult(){const t=Math.round((Date.now()-this.state.startTime)/1e3),e=Math.floor(t/60),s=t%60,i=Object.keys(this.state.submitted),n=i.filter(w=>{const m=this.state.questions.find(x=>x.id==w);return m&&this.checkAnswer(m)}).length,a=i.length>0?Math.round(n/i.length*100):0,o=this.state.mode==="exam",l=o?a>=this.state.examPassRate:null,c=o?l?"🎉":"😞":"🎉",d=o?l?"考试通过！":"未通过考试":"答题完成！";this._saveReviewDuration(),u.addHistory({bankId:this.state.bankId,bankName:this.state.bank.name,mode:this.state.mode,total:this.state.questions.length,correct:n,duration:t}),o?y.finishExam(this.state.bankId,this.state.questions.length,n,a,t,!1):y.finishQuiz(this.state.bankId,this.state.bank.name,this.state.mode,this.state.questions.length,n,i.length-n,a,t);const h=i.map(w=>{const m=this.state.questions.find(x=>x.id==w);return{id:w,category:m==null?void 0:m.category,type:m==null?void 0:m.type,difficulty:m==null?void 0:m.difficulty,timeSpent:this.state.questionTimes[w]||0,isCorrect:m?this.checkAnswer(m):!1}});y.questionHeatmap(this.state.bankId,this.state.bank.name,h),this.state._statsTimer&&(clearTimeout(this.state._statsTimer),this.state._statsTimer=null),this.state._statsDirty=!1;const p=i.length-(this.state._lastPushAnswered||0),g=n-(this.state._lastPushCorrect||0),f=t-(this.state._lastPushDuration||0);(p>0||g>0||f>0)&&(this.state._lastPushAnswered=i.length,this.state._lastPushCorrect=n,this.state._lastPushDuration=t,v.pushStats({bankId:this.state.bankId,bankName:this.state.bank.name,answered:p,correct:g,duration:f}));const k=document.getElementById("question-container");k.innerHTML=`
            <div class="result-page">
                <div class="result-icon">${c}</div>
                <div class="result-title">${d}</div>
                <div class="result-subtitle">${r.escapeHtml(this.state.bank.name)}</div>
                ${o?`<div class="result-exam-info">及格线 ${this.state.examPassRate}%，正确率 ${a}%</div>`:""}

                <div class="result-stats">
                    <div class="result-stat">
                        <div class="result-stat-value success">${n}</div>
                        <div class="result-stat-label">答对</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value danger">${i.length-n}</div>
                        <div class="result-stat-label">答错</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value ${o&&!l?"danger":""}">${a}%</div>
                        <div class="result-stat-label">正确率</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-value">${e>0?e+"分":""}${s}秒</div>
                        <div class="result-stat-label">用时</div>
                    </div>
                </div>

                <div class="result-actions">
                    <button class="btn btn-secondary btn-lg" onclick="Quiz.startReview()">
                        📖 查看解析
                    </button>
                    <button class="btn btn-secondary btn-lg" onclick="Quiz.restart()">
                        🔄 重新开始
                    </button>
                    <button class="btn btn-primary btn-lg" onclick="Quiz.goHome()">
                        🏠 返回首页
                    </button>
                </div>
            </div>
        `,document.querySelector(".quiz-footer").style.display="none"},restart(){u.clearSession(this.state.bankId,this.state.mode),this.state.currentIndex=0,this.state.answers={},this.state.submitted={},this.state.showExplanation={},this.state.questionTimes={},this.state.optionOrderCache={},this.state.isFinished=!1,this.state.startTime=Date.now(),this.state.examTimeRemaining=0,(this.state.mode==="exam"||this.state.mode==="random"||this.state.mode==="shuffle_options")&&this.prepareQuestions(),this.state.mode==="exam"&&this.startExamTimer(),this.state.mode==="review"&&this.state.questions.forEach(t=>{this.state.submitted[t.id]=!0,this.state.showExplanation[t.id]=!0,this.state.answers[t.id]=t.answer}),document.querySelector(".quiz-footer").style.display="",this.render(),window.scrollTo({top:0,behavior:"smooth"})},startReview(){document.getElementById("question-container")&&(this.state.isReviewMode=!0,this.state.currentIndex=0,this.state.isFinished=!1,Object.keys(this.state.submitted).forEach(e=>{this.state.showExplanation[e]=!0}),document.querySelector(".quiz-footer").style.display="",this.render(),window.scrollTo({top:0,behavior:"smooth"}))},_markStatsDirty(){this.state._statsDirty=!0,!this.state._statsTimer&&(this.state._statsTimer=setTimeout(()=>{this._flushStatsNow()},5e3))},_flushStatsNow(){var o;if(this.state._statsTimer&&(clearTimeout(this.state._statsTimer),this.state._statsTimer=null),!this.state._statsDirty)return;this.state._statsDirty=!1;const t=Object.keys(this.state.submitted);if(t.length===0)return;const e=t.filter(l=>{const c=this.state.questions.find(d=>d.id==l);return c&&this.checkAnswer(c)}).length,s=this.state.startTime?Math.round((Date.now()-this.state.startTime)/1e3):0,i=t.length-(this.state._lastPushAnswered||0),n=e-(this.state._lastPushCorrect||0),a=s-(this.state._lastPushDuration||0);i<=0&&n<=0&&a<=0||(this.state._lastPushAnswered=t.length,this.state._lastPushCorrect=e,this.state._lastPushDuration=s,v.pushStats({bankId:this.state.bankId,bankName:((o=this.state.bank)==null?void 0:o.name)||"",answered:i,correct:n,duration:a}))},_flushStatsSync(){var o,l;if(!this.state._statsDirty)return;const t=Object.keys(this.state.submitted);if(t.length===0)return;const e=t.filter(c=>{const d=this.state.questions.find(h=>h.id==c);return d&&this.checkAnswer(d)}).length,s=this.state.startTime?Math.round((Date.now()-this.state.startTime)/1e3):0,i=t.length-(this.state._lastPushAnswered||0),n=e-(this.state._lastPushCorrect||0),a=s-(this.state._lastPushDuration||0);if(i<=0&&n<=0&&a<=0){this.state._statsDirty=!1;return}if(this.state._lastPushAnswered=t.length,this.state._lastPushCorrect=e,this.state._lastPushDuration=s,this.state._statsDirty=!1,this.state._statsTimer&&(clearTimeout(this.state._statsTimer),this.state._statsTimer=null),navigator.sendBeacon&&v.isRegistered()){const c=JSON.stringify({deviceId:v.getDeviceId(),bankId:this.state.bankId,bankName:((o=this.state.bank)==null?void 0:o.name)||"",answered:i,correct:n,duration:a});try{navigator.sendBeacon(v.BASE_URL+"/api/sync",c);return}catch(d){console.warn("[Quiz] sendBeacon 失败:",d.message)}}v.pushStats({bankId:this.state.bankId,bankName:((l=this.state.bank)==null?void 0:l.name)||"",answered:i,correct:n,duration:a})},goHome(){window.location.href="index.html"},bindEvents(){document.addEventListener("pointerup",s=>{const i=s.target.closest("button, .btn, .option-item, .judge-option");i&&i.blur()}),window.addEventListener("beforeunload",()=>this.saveSession()),document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&this.saveSession()});let t=0,e=0;document.addEventListener("touchstart",s=>{t=s.changedTouches[0].clientX,e=s.changedTouches[0].clientY},{passive:!0}),document.addEventListener("touchend",s=>{if(document.getElementById("finish-modal"))return;const i=document.getElementById("nav-panel");if(i&&i.classList.contains("show"))return;const a=s.target.closest('pre, code, .code-block, .code-wrapper, .explanation-content, [style*="overflow-x"]');if(a&&a.scrollWidth>a.clientWidth||u.getSettings().swipeNavigation===!1)return;const l=s.changedTouches[0].clientX-t,c=s.changedTouches[0].clientY-e;Math.abs(c)>Math.abs(l)||Math.abs(l)<Q||(l<0?this.nextQuestion():this.prevQuestion())},{passive:!0}),document.addEventListener("keydown",s=>{if(document.getElementById("finish-modal"))return;const i=document.activeElement;if(i&&(i.tagName==="INPUT"||i.tagName==="TEXTAREA"||i.tagName==="SELECT"))return;if(s.key==="Enter"&&!s.ctrlKey&&!s.shiftKey){const a=this.state.questions[this.state.currentIndex];a&&!this.state.submitted[a.id]?this.submitCurrent():this.nextQuestion()}s.key==="ArrowLeft"&&(s.preventDefault(),this.prevQuestion()),s.key==="ArrowRight"&&(s.preventDefault(),this.nextQuestion());const n=this.state.questions[this.state.currentIndex];if(n&&!this.state.submitted[n.id]){if(n.type==="single"||n.type==="multiple"){const a=s.key.toUpperCase(),l={1:"A",2:"B",3:"C",4:"D",5:"E",6:"F"}[s.key]||a;["A","B","C","D","E","F"].includes(l)&&(n.type==="single"?this.selectAnswer(n.id,l):this.toggleAnswer(n.id,l))}n.type==="judge"&&((s.key==="1"||s.key==="t"||s.key==="T")&&this.selectAnswer(n.id,!0),(s.key==="0"||s.key==="f"||s.key==="F")&&this.selectAnswer(n.id,!1))}})}};document.addEventListener("DOMContentLoaded",()=>{I.init()});window.Quiz=I;
