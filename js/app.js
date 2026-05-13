/**
 * 主应用模块
 * 内置题库、多种刷题模式
 */

const App = {
    // 内置题库列表
    builtinBanks: [
        'c-language.json',
        'engineering-mechanics.json'
    ],

    // 状态
    state: {
        banks: [],
        stats: null
    },

    /**
     * 初始化应用
     */
    async init() {
        await this.loadBuiltinBanks();
        this.loadData();
        this.render();
        console.log('App initialized');
    },

    /**
     * 加载内置题库
     */
    async loadBuiltinBanks() {
        for (const filename of this.builtinBanks) {
            try {
                const response = await fetch(`banks/${filename}`);
                if (response.ok) {
                    const bank = await response.json();
                    // 如果本地没有该题库或版本更新，则添加
                    const localBank = Storage.getBank(bank.id);
                    if (!localBank || localBank.version !== bank.version) {
                        Storage.addBank(bank);
                    }
                }
            } catch (e) {
                console.error(`Failed to load ${filename}:`, e);
            }
        }
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
                    <div class="bank-empty-title">加载题库中...</div>
                </div>
            `;
            return;
        }

        const colors = ['blue', 'green', 'orange', 'purple', 'red'];
        
        let html = banks.map((bank, index) => {
            const stats = Storage.getBankStats(bank.id);
            const color = colors[index % colors.length];
            const wrongCount = Storage.getWrongQuestions(bank.id).length;
            
            return `
                <div class="bank-card" data-color="${color}" data-id="${bank.id}">
                    <div class="bank-card-header">
                        <div class="bank-card-icon">${this.getBankIcon(bank)}</div>
                        <div class="bank-card-info">
                            <div class="bank-card-title">${bank.name}</div>
                            <div class="bank-card-desc">${bank.description || ''}</div>
                        </div>
                    </div>
                    
                    <div class="bank-card-meta">
                        ${(bank.categories || []).slice(0, 4).map(cat => 
                            `<span class="tag">${cat}</span>`
                        ).join('')}
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
                    
                    <div class="bank-card-modes">
                        <button class="btn btn-primary" onclick="App.startQuiz('${bank.id}', 'all')">
                            🚀 顺序刷题
                        </button>
                        <button class="btn btn-secondary" onclick="App.startQuiz('${bank.id}', 'random')">
                            🎲 随机刷题
                        </button>
                        <button class="btn btn-secondary" onclick="App.startQuiz('${bank.id}', 'wrong')" ${wrongCount === 0 ? 'disabled' : ''}>
                            🔄 错题重做 (${wrongCount})
                        </button>
                        <button class="btn btn-secondary" onclick="App.startQuiz('${bank.id}', 'review')">
                            📖 背题模式
                        </button>
                    </div>
                    
                    <div class="bank-card-footer">
                        <button class="btn btn-ghost btn-sm" onclick="App.resetProgress('${bank.id}')">
                            重置进度
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="App.exportBank('${bank.id}')">
                            导出题库
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    /**
     * 开始刷题
     */
    startQuiz(bankId, mode) {
        window.location.href = `quiz.html?bank=${bankId}&mode=${mode}`;
    },

    /**
     * 重置进度
     */
    resetProgress(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;
        
        if (confirm(`确定要重置 "${bank.name}" 的所有进度吗？`)) {
            Storage.resetBankProgress(bankId);
            Utils.showToast('进度已重置', 'success');
            this.loadData();
            this.render();
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
     * 获取题库图标
     */
    getBankIcon(bank) {
        const name = (bank.name || '').toLowerCase();
        if (name.includes('c语言') || name.includes('c++')) return '💻';
        if (name.includes('java')) return '☕';
        if (name.includes('python')) return '🐍';
        if (name.includes('数学') || name.includes('math')) return '📐';
        if (name.includes('力学')) return '⚙️';
        if (name.includes('英语')) return '🔤';
        if (name.includes('物理')) return '⚛️';
        if (name.includes('化学')) return '🧪';
        return '📚';
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;
