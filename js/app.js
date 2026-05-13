/**
 * 主应用模块
 */

const App = {
    builtinBanks: ['c-language.json', 'engineering-mechanics.json'],

    state: {
        banks: [],
        stats: null
    },

    async init() {
        await this.loadBuiltinBanks();
        this.loadData();
        this.render();
    },

    async loadBuiltinBanks() {
        for (const filename of this.builtinBanks) {
            try {
                const response = await fetch(`banks/${filename}`);
                if (response.ok) {
                    const bank = await response.json();
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

    loadData() {
        this.state.banks = Storage.getBanks();
        this.state.stats = Storage.getGlobalStats();
    },

    render() {
        this.renderStats();
        this.renderBankGrid();
    },

    renderStats() {
        const stats = this.state.stats;
        document.getElementById('stat-banks').textContent = stats.bankCount;
        document.getElementById('stat-questions').textContent = Utils.formatNumber(stats.totalQuestions);
        document.getElementById('stat-answered').textContent = Utils.formatNumber(stats.totalAnswered);
        document.getElementById('stat-accuracy').textContent = stats.accuracy + '%';
    },

    renderBankGrid() {
        const container = document.getElementById('bank-grid');
        const banks = this.state.banks;

        if (banks.length === 0) {
            container.innerHTML = `
                <div class="bank-empty">
                    <div class="bank-empty-title">加载题库中...</div>
                </div>
            `;
            return;
        }

        container.innerHTML = banks.map(bank => {
            const stats = Storage.getBankStats(bank.id);
            const wrongCount = Storage.getWrongQuestions(bank.id).length;
            const iconClass = bank.id.includes('c-language') ? 'c-lang' : 
                             bank.id.includes('mechanics') ? 'mechanics' : 'default';
            const iconText = bank.id.includes('c-language') ? 'C' : 
                            bank.id.includes('mechanics') ? 'M' : 'Q';
            
            return `
                <div class="bank-card" data-id="${bank.id}">
                    <div class="bank-card-header">
                        <div class="bank-card-icon ${iconClass}">${iconText}</div>
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
                            共 <span class="bank-card-stat-num">${stats.totalQuestions}</span> 题
                        </div>
                        <div class="bank-card-stat">
                            已答 <span class="bank-card-stat-num">${stats.answered}</span>
                        </div>
                        <div class="bank-card-stat">
                            正确 <span class="bank-card-stat-num">${stats.correct}</span>
                        </div>
                        <div class="bank-card-stat">
                            错误 <span class="bank-card-stat-num">${stats.wrong}</span>
                        </div>
                    </div>
                    
                    <div class="bank-card-actions">
                        <button class="btn btn-primary btn-sm" onclick="App.startQuiz('${bank.id}', 'all')">
                            顺序刷题
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'random')">
                            随机刷题
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'wrong')" ${wrongCount === 0 ? 'disabled' : ''}>
                            错题重做 ${wrongCount > 0 ? '(' + wrongCount + ')' : ''}
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="App.startQuiz('${bank.id}', 'review')">
                            背题模式
                        </button>
                    </div>
                    
                    <div class="bank-card-footer">
                        <button class="btn btn-ghost btn-sm" onclick="App.resetProgress('${bank.id}')">
                            重置进度
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    startQuiz(bankId, mode) {
        window.location.href = `quiz.html?bank=${bankId}&mode=${mode}`;
    },

    resetProgress(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;
        
        if (confirm(`确定要重置 "${bank.name}" 的所有进度吗？`)) {
            Storage.resetBankProgress(bankId);
            Utils.showToast('进度已重置', 'success');
            this.loadData();
            this.render();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;
