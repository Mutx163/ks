/**
 * 主应用模块
 * 处理主页逻辑、题库管理等
 */

const App = {
    // 当前状态
    state: {
        banks: [],
        stats: null,
        importData: null
    },

    /**
     * 初始化应用
     */
    init() {
        this.loadData();
        this.render();
        this.bindEvents();
        console.log('App initialized');
    },

    /**
     * 加载数据
     */
    loadData() {
        this.state.banks = Storage.getBanks();
        this.state.stats = Storage.getGlobalStats();
    },

    /**
     * 渲染页面
     */
    render() {
        this.renderStats();
        this.renderBankGrid();
    },

    /**
     * 渲染统计信息
     */
    renderStats() {
        const stats = this.state.stats;
        
        document.getElementById('stat-banks').textContent = stats.bankCount;
        document.getElementById('stat-questions').textContent = Utils.formatNumber(stats.totalQuestions);
        document.getElementById('stat-answered').textContent = Utils.formatNumber(stats.totalAnswered);
        document.getElementById('stat-accuracy').textContent = stats.accuracy + '%';
    },

    /**
     * 渲染题库网格
     */
    renderBankGrid() {
        const container = document.getElementById('bank-grid');
        const banks = this.state.banks;

        if (banks.length === 0) {
            container.innerHTML = `
                <div class="bank-empty">
                    <div class="bank-empty-icon">📚</div>
                    <div class="bank-empty-title">还没有题库</div>
                    <div class="bank-empty-desc">导入 JSON 格式的题库文件开始刷题</div>
                    <button class="btn btn-primary btn-lg" onclick="App.showImportModal()">
                        📥 导入题库
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        
        banks.forEach(bank => {
            const stats = Storage.getBankStats(bank.id);
            const colors = ['blue', 'green', 'orange', 'purple', 'red'];
            const color = colors[Math.abs(this.hashCode(bank.id)) % colors.length];
            
            html += `
                <div class="bank-card" data-color="${color}" data-id="${bank.id}">
                    <div class="bank-card-header">
                        <div class="bank-card-icon">${this.getBankIcon(bank)}</div>
                        <div class="bank-card-actions">
                            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); App.showBankMenu('${bank.id}')">
                                ⋯
                            </button>
                        </div>
                    </div>
                    <div class="bank-card-title">${bank.name}</div>
                    <div class="bank-card-desc">${bank.description || '暂无描述'}</div>
                    <div class="bank-card-meta">
                        ${(bank.categories || []).slice(0, 3).map(cat => 
                            `<span class="tag">${cat}</span>`
                        ).join('')}
                        ${bank.categories && bank.categories.length > 3 ? 
                            `<span class="tag">+${bank.categories.length - 3}</span>` : ''}
                    </div>
                    <div class="bank-card-progress">
                        <div class="bank-card-progress-header">
                            <span>完成进度</span>
                            <span>${stats.progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-bar-fill ${stats.progress === 100 ? 'success' : ''}" 
                                 style="width: ${stats.progress}%"></div>
                        </div>
                    </div>
                    <div class="bank-card-footer">
                        <div class="bank-card-stats">
                            <div class="bank-card-stat">
                                <span class="bank-card-stat-icon">📝</span>
                                <span>${stats.totalQuestions}题</span>
                            </div>
                            <div class="bank-card-stat">
                                <span class="bank-card-stat-icon">✅</span>
                                <span>${stats.correct}</span>
                            </div>
                            <div class="bank-card-stat">
                                <span class="bank-card-stat-icon">❌</span>
                                <span>${stats.wrong}</span>
                            </div>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); App.startQuiz('${bank.id}')">
                            开始刷题
                        </button>
                    </div>
                </div>
            `;
        });

        // 添加导入卡片
        html += `
            <div class="bank-card bank-card-import" onclick="App.showImportModal()">
                <div class="bank-card-icon">📥</div>
                <div class="bank-card-title">导入题库</div>
            </div>
        `;

        container.innerHTML = html;

        // 添加点击事件
        container.querySelectorAll('.bank-card:not(.bank-card-import)').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn')) return;
                const bankId = card.dataset.id;
                this.showBankDetail(bankId);
            });
        });
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        // 文件导入
        const fileInput = document.getElementById('import-file');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileImport(e));
        }

        // 拖拽导入
        const importZone = document.getElementById('import-zone');
        if (importZone) {
            importZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                importZone.classList.add('dragover');
            });
            importZone.addEventListener('dragleave', () => {
                importZone.classList.remove('dragover');
            });
            importZone.addEventListener('drop', (e) => {
                e.preventDefault();
                importZone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) this.processFile(file);
            });
        }

        // 快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    },

    /**
     * 显示导入弹窗
     */
    showImportModal() {
        document.getElementById('import-modal').classList.add('active');
        this.state.importData = null;
        this.renderImportPreview();
    },

    /**
     * 关闭导入弹窗
     */
    closeImportModal() {
        document.getElementById('import-modal').classList.remove('active');
        this.state.importData = null;
        document.getElementById('import-file').value = '';
    },

    /**
     * 处理文件导入
     */
    handleFileImport(e) {
        const file = e.target.files[0];
        if (file) this.processFile(file);
    },

    /**
     * 处理文件
     */
    async processFile(file) {
        if (!file.name.endsWith('.json')) {
            Utils.showToast('请选择 JSON 格式的题库文件', 'error');
            return;
        }

        try {
            const data = await Utils.readJSONFile(file);
            const validation = Utils.validateBank(data);

            if (!validation.valid) {
                Utils.showToast('题库格式错误: ' + validation.errors[0], 'error');
                return;
            }

            this.state.importData = data;
            this.renderImportPreview();
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    },

    /**
     * 渲染导入预览
     */
    renderImportPreview() {
        const preview = document.getElementById('import-preview');
        const data = this.state.importData;

        if (!data) {
            preview.style.display = 'none';
            return;
        }

        preview.style.display = 'block';
        
        const questionCount = data.questions?.length || 0;
        const categories = data.categories || [];
        const types = [...new Set(data.questions?.map(q => q.type) || [])];

        preview.innerHTML = `
            <div class="import-preview-header">
                <span class="import-preview-title">📋 题库预览</span>
                <button class="import-preview-remove" onclick="App.clearImport()">移除</button>
            </div>
            <div class="import-preview-info">
                <p><strong>名称：</strong>${data.name}</p>
                <p><strong>描述：</strong>${data.description || '无'}</p>
                <p><strong>题目数量：</strong>${questionCount} 题</p>
                <p><strong>分类：</strong>${categories.length > 0 ? categories.join('、') : '无'}</p>
                <p><strong>题型：</strong>${types.map(t => Utils.getTypeName(t)).join('、')}</p>
                ${data.author ? `<p><strong>作者：</strong>${data.author}</p>` : ''}
            </div>
        `;
    },

    /**
     * 清除导入
     */
    clearImport() {
        this.state.importData = null;
        document.getElementById('import-file').value = '';
        this.renderImportPreview();
    },

    /**
     * 确认导入
     */
    confirmImport() {
        const data = this.state.importData;
        if (!data) {
            Utils.showToast('请先选择题库文件', 'error');
            return;
        }

        // 检查是否已存在
        if (Storage.bankExists(data.id)) {
            if (!confirm(`题库 "${data.name}" 已存在，是否覆盖？`)) {
                return;
            }
        }

        // 保存题库
        Storage.addBank(data);
        
        Utils.showToast(`题库 "${data.name}" 导入成功！`, 'success');
        this.closeImportModal();
        
        // 刷新页面
        this.loadData();
        this.render();
    },

    /**
     * 开始刷题
     */
    startQuiz(bankId, mode = 'all') {
        const bank = Storage.getBank(bankId);
        if (!bank) {
            Utils.showToast('题库不存在', 'error');
            return;
        }

        // 跳转到刷题页面
        window.location.href = `quiz.html?bank=${bankId}&mode=${mode}`;
    },

    /**
     * 显示题库详情
     */
    showBankDetail(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;

        const stats = Storage.getBankStats(bankId);
        const modal = document.getElementById('bank-detail-modal');
        
        document.getElementById('detail-title').textContent = bank.name;
        document.getElementById('detail-body').innerHTML = `
            <div class="bank-detail-info">
                <p><strong>描述：</strong>${bank.description || '无'}</p>
                <p><strong>题目数量：</strong>${stats.totalQuestions} 题</p>
                <p><strong>分类：</strong>${(bank.categories || []).join('、') || '无'}</p>
                <p><strong>标签：</strong>${(bank.tags || []).join('、') || '无'}</p>
                ${bank.author ? `<p><strong>作者：</strong>${bank.author}</p>` : ''}
                ${bank.version ? `<p><strong>版本：</strong>${bank.version}</p>` : ''}
            </div>
            
            <div class="bank-detail-stats">
                <h3>📊 学习统计</h3>
                <div class="stats-grid" style="margin-top: 12px;">
                    <div class="stat-card">
                        <div class="stat-icon blue">📝</div>
                        <div class="stat-info">
                            <h3>${stats.totalQuestions}</h3>
                            <p>总题数</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">✅</div>
                        <div class="stat-info">
                            <h3>${stats.correct}</h3>
                            <p>答对</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon orange">❌</div>
                        <div class="stat-info">
                            <h3>${stats.wrong}</h3>
                            <p>答错</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon purple">🎯</div>
                        <div class="stat-info">
                            <h3>${stats.accuracy}%</h3>
                            <p>正确率</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="bank-detail-actions" style="margin-top: 24px;">
                <button class="btn btn-primary btn-lg" onclick="App.startQuiz('${bankId}')" style="width: 100%;">
                    🚀 开始刷题
                </button>
                <div style="display: flex; gap: 12px; margin-top: 12px;">
                    <button class="btn btn-secondary" onclick="App.startQuiz('${bankId}', 'wrong')" style="flex: 1;">
                        🔄 错题重做
                    </button>
                    <button class="btn btn-secondary" onclick="App.startQuiz('${bankId}', 'random')" style="flex: 1;">
                        🎲 随机刷题
                    </button>
                </div>
            </div>
        `;

        modal.classList.add('active');
    },

    /**
     * 关闭题库详情
     */
    closeBankDetail() {
        document.getElementById('bank-detail-modal').classList.remove('active');
    },

    /**
     * 显示题库菜单
     */
    showBankMenu(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;

        const action = prompt(
            `题库: ${bank.name}\n\n选择操作:\n1. 导出题库\n2. 重置进度\n3. 删除题库`,
            '1'
        );

        switch (action) {
            case '1':
                this.exportBank(bankId);
                break;
            case '2':
                this.resetBankProgress(bankId);
                break;
            case '3':
                this.deleteBank(bankId);
                break;
        }
    },

    /**
     * 导出题库
     */
    exportBank(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;

        Utils.downloadJSON(bank, `${bank.name}.json`);
        Utils.showToast('题库已导出', 'success');
    },

    /**
     * 重置题库进度
     */
    resetBankProgress(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;

        if (confirm(`确定要重置 "${bank.name}" 的所有进度吗？`)) {
            Storage.resetBankProgress(bankId);
            Utils.showToast('进度已重置', 'success');
            this.loadData();
            this.render();
            this.closeBankDetail();
        }
    },

    /**
     * 删除题库
     */
    deleteBank(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;

        if (confirm(`确定要删除题库 "${bank.name}" 吗？此操作不可恢复！`)) {
            Storage.removeBank(bankId);
            Utils.showToast('题库已删除', 'success');
            this.loadData();
            this.render();
            this.closeBankDetail();
        }
    },

    /**
     * 关闭所有弹窗
     */
    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
        });
    },

    /**
     * 获取题库图标
     */
    getBankIcon(bank) {
        // 根据题库ID或名称返回图标
        const name = (bank.name || '').toLowerCase();
        if (name.includes('c语言') || name.includes('c++')) return '💻';
        if (name.includes('java')) return '☕';
        if (name.includes('python')) return '🐍';
        if (name.includes('javascript') || name.includes('js')) return '📜';
        if (name.includes('数学') || name.includes('math')) return '📐';
        if (name.includes('英语') || name.includes('english')) return '🔤';
        if (name.includes('物理')) return '⚛️';
        if (name.includes('化学')) return '🧪';
        if (name.includes('力学')) return '⚙️';
        return '📚';
    },

    /**
     * 哈希函数
     */
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    },

    /**
     * 加载示例题库
     */
    async loadExampleBank(filename) {
        try {
            const response = await fetch(`banks/${filename}`);
            const data = await response.json();
            
            if (Storage.bankExists(data.id)) {
                Utils.showToast('该题库已存在', 'info');
                return;
            }

            Storage.addBank(data);
            Utils.showToast(`题库 "${data.name}" 加载成功！`, 'success');
            this.loadData();
            this.render();
        } catch (error) {
            Utils.showToast('加载示例题库失败', 'error');
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// 导出
window.App = App;
