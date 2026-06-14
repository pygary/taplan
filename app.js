// app_optimized.js
// ========== 完整優化版本（2025 年版） ==========
// 改進：集中管理過濾狀態、性能優化、代碼去重、完整註釋

// ========== 全域常數定義 ==========

/** 預設過濾狀態集中管理 */
const DEFAULT_FILTERS = {
    search: '',
    sector: '',
    marketCap: '',
    rsi: '',
    ytd: '',
    phase: '',
    stage: '',
    setup: '',
    ema10: '',
    ema21: '',
    ema50: '',
    ema200: '',
    rsMom: '',
    resilience: '',
    mlDirection: '',
    bucket: 'all',
    sort: 'score-desc'
};

/** 抗跌指數等級配置（性能優化：預先定義避免重複計算） */
const RESILIENCE_TIERS = {
    'very-strong': { filled: 5, label: '極強抗跌', tooltip: '大盤下跌日時，這檔股票多數能跑贏大盤，且領先幅度明顯' },
    'strong': { filled: 4, label: '明顯抗跌', tooltip: '大盤走弱時通常比大盤穩' },
    'neutral': { filled: 3, label: '中性', tooltip: '沒有明顯防守優勢' },
    'weak': { filled: 2, label: '偏弱', tooltip: '大盤跌時常跟跌，抗壓一般' },
    'very-weak': { filled: 1, label: '弱抗跌', tooltip: '弱抗跌：大盤轉弱時通常表現比大盤更差' }
};

/** RS Momentum 徽章配置 */
const RS_MOM_BADGE_CONFIG = {
    '🚀 交叉啟動': 'crossover',
    '📈 加速中': 'accelerating',
    '⚪ 整理中': 'stable'
};

/** 決策分級徽章樣式映射 */
const BUCKET_BADGE_MAP = {
    'A1 核心領先股': 'a1',
    'A2 RS突破候選': 'a2',
    'A3 均線回檔買點': 'a3',
    'B 穩定領先股': 'b',
    'C 強勢回檔觀察': 'c'
};

/** 大盤狀態 CSS 類別映射 */
const MARKET_REGIME_CSS = {
    'Risk-On': 'risk-on',
    'Risk-Off': 'risk-off',
    'Neutral': 'risk-neutral'
};

/** 表格排序列配置 */
const TABLE_SORT_COLUMNS = {
    ticker: { label: '代號', type: 'text', defaultDir: 'asc', value: item => item.Ticker },
    price: { label: '價格', type: 'number', defaultDir: 'desc', value: item => item.Price },
    ytd: { label: 'YTD', type: 'number', defaultDir: 'desc', value: item => item.YTD },
    bucket: { label: '決策分級', type: 'number', defaultDir: 'asc', value: item => item.Priority ?? bucketSortRank(item.Decision_Bucket) },
    score: { label: '雷達分數', type: 'number', defaultDir: 'desc', value: item => item.Leader_Radar_Score },
    phase: { label: '相對強弱狀態', type: 'text', defaultDir: 'asc', value: item => item.TL_RS_Phase },
    stage: { label: 'Stage', type: 'number', defaultDir: 'asc', value: item => stageSortRank(item) },
    setup: { label: 'Setup', type: 'text', defaultDir: 'asc', value: item => item.Setup_Type },
    'rs-mom': { label: 'RS 加速', type: 'number', defaultDir: 'asc', value: item => rsMomSortRank(item.RS_Momentum) },
    resilience: { label: '抗跌強度', type: 'number', defaultDir: 'desc', value: item => item.RS_Resiliency },
    dist10: { label: 'EMA10 偏離', type: 'number', defaultDir: 'desc', value: item => item.Dist_EMA10 },
    dist21: { label: 'EMA21 偏離', type: 'number', defaultDir: 'desc', value: item => item.Dist_EMA21 },
    dist50: { label: 'EMA50 偏離', type: 'number', defaultDir: 'desc', value: item => item.Dist_EMA50 },
    dist200: { label: 'EMA200 偏離', type: 'number', defaultDir: 'desc', value: item => item.Dist_EMA200 },
    rsi: { label: 'RSI', type: 'number', defaultDir: 'desc', value: item => item.RSI },
    sector: { label: '板塊/行業', type: 'text', defaultDir: 'asc', value: item => `${item.Sector || ''} ${item.Industry || ''}`.trim() },
    marketcap: { label: '市值', type: 'number', defaultDir: 'desc', value: item => item.MarketCap }
};

// ========== 全域變數 ==========
let allData = [];
let radarMetadata = null;
let filteredData = [];
let uniqueSectors = new Set();
let uniquePhases = new Set();
let uniqueSetups = new Set();

// 分頁控制
let currentPage = 1;
const ITEMS_PER_PAGE = 30;

// 當前過濾狀態（使用集中管理）
let currentFilters = { ...DEFAULT_FILTERS };

// ========== 輔助函式：排序排名計算 ==========

function bucketSortRank(bucket) {
    const priorityMap = {
        'A1 核心領先股': 1,
        'A2 RS突破候選': 2,
        'A3 均線回檔買點': 3,
        'B 穩定領先股': 4,
        'C 強勢回檔觀察': 5,
        'E 暫不優先': 6
    };
    return priorityMap[bucket] ?? 99;
}

function stageSortRank(item) {
    if (item.Stage2_Action_Zone === true) return 1;
    if (item.Stage2_Early === true) return 2;
    if (item.Stage2 === true && item.Stage2_Extended !== true) return 3;
    if (item.Stage2_Extended === true) return 4;
    return 9;
}

function rsMomSortRank(momentum) {
    const rankMap = {
        '🚀 交叉啟動': 1,
        '📈 加速中': 2,
        '⚪ 整理中': 3
    };
    return rankMap[momentum] ?? 9;
}

// ========== 格式化函式集合 ==========

/**
 * 格式化價格顯示
 * @param {number} price - 股票價格
 * @param {number} changePct - 漲跌幅百分比
 * @returns {string} HTML 格式的價格顯示
 */
function formatPrice(price, changePct) {
    if (price === undefined || price === null) return '-';
    const priceFormatted = price.toFixed(2);
    if (changePct === undefined || changePct === null) return `$${priceFormatted}`;
    
    const arrow = changePct > 0 ? '▲' : (changePct < 0 ? '▼' : '');
    const color = changePct > 0 ? '#00c853' : (changePct < 0 ? '#ff4d4d' : '#888');
    const changeAbs = Math.abs(changePct).toFixed(2);
    const sign = changePct > 0 ? '+' : '';
    return `<span style="color: ${color};">${arrow} $${priceFormatted} (${sign}${changeAbs}%)</span>`;
}

/**
 * 格式化 YTD 回報率（優化版本）
 * @param {number} ytd - YTD 百分比
 * @returns {string} 格式化後的 YTD 字符串
 */
function formatYtd(ytd) {
    if (ytd === undefined || ytd === null || Number.isNaN(Number(ytd))) return '-';
    const sign = ytd > 0 ? '+' : '';  // 只在 > 0 時加 +，0 不加
    return `${sign}${ytd.toFixed(1)}%`;
}

/**
 * 格式化 EMA 偏離值
 * @param {number} dist - 偏離百分比
 * @returns {string} 格式化後的偏離值
 */
function formatDist(dist) {
    if (dist === undefined || dist === null) return '-';
    const sign = dist >= 0 ? '+' : '';
    return `${sign}${dist.toFixed(2)}%`;
}

/**
 * 格式化市值（美元轉換為 T/B/M）
 * @param {number} cap - 市值（美元）
 * @returns {string} 格式化後的市值
 */
function formatMarketCap(cap) {
    if (cap === undefined || cap === null || cap === 0) return '-';
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(1)}M`;
    return `$${cap.toLocaleString()}`;
}

// ========== 分類函式集合 ==========

/**
 * 根據偏離值判斷顏色樣式
 * @param {number} dist - 偏離百分比
 * @param {boolean} isPullback - 是否為回檔買點
 * @returns {string} CSS 類別名稱
 */
function getDistColorClass(dist, isPullback) {
    if (dist === undefined || dist === null) return '';
    if (isPullback && dist >= -1.0 && dist <= 3.0) return 'pullback';
    return dist >= 0 ? 'positive' : 'negative';
}

/**
 * 根據 RSI 判斷徽章樣式
 * @param {number} rsi - RSI 值
 * @returns {string} CSS 類別名稱
 */
function getRsiClass(rsi) {
    if (rsi === undefined || rsi === null) return 'normal';
    if (rsi >= 70) return 'overbought';
    if (rsi <= 30) return 'oversold';
    return 'normal';
}

/**
 * 根據 YTD 值判斷顏色樣式
 * @param {number} ytd - YTD 值
 * @returns {string} CSS 類別名稱
 */
function getYtdColorClass(ytd) {
    if (ytd === undefined || ytd === null) return '';
    return ytd > 0 ? 'positive' : (ytd < 0 ? 'negative' : '');
}

/**
 * 取得決策池徽章顏色 CSS 類別
 * @param {string} bucket - 決策分級字符串
 * @returns {string} CSS 類別名稱
 */
function getBucketBadgeClass(bucket) {
    return BUCKET_BADGE_MAP[bucket] || '';
}

// ========== 徽章渲染函式集合 ==========

/**
 * 渲染 RS Momentum 徽章（性能優化版）
 * @param {string} mom - RS Momentum 狀態
 * @returns {string} HTML 字符串
 */
function renderRsMomBadge(mom) {
    if (!mom) return '-';
    const className = RS_MOM_BADGE_CONFIG[mom] || 'stable';
    return `<span class="rs-mom-badge ${className}">${mom}</span>`;
}

/**
 * 渲染抗跌指數徽章（性能優化版）
 * @param {number} resil - 抗跌指數值
 * @returns {string} HTML 字符串
 */
function renderResilBadge(resil) {
    if (resil === undefined || resil === null || Number.isNaN(Number(resil))) return '-';

    const value = Number(resil);
    let tier = 'very-weak';
    
    // 確定等級
    if (value >= 85) tier = 'very-strong';
    else if (value >= 70) tier = 'strong';
    else if (value >= 55) tier = 'neutral';
    else if (value >= 40) tier = 'weak';

    const config = RESILIENCE_TIERS[tier];
    
    // 預先生成 lights HTML
    const lights = Array.from({ length: 5 }, (_, i) => 
        `<span class="resil-light ${i < config.filled ? 'active' : ''}"></span>`
    ).join('');

    return `<span class="resil-badge ${tier}" title="${config.tooltip}">
        <span class="resil-lights">${lights}</span>
        <span class="resil-label">${config.label}</span>
        <span class="resil-score">${Math.round(value)}</span>
    </span>`;
}

/**
 * 渲染 Setup 型態徽章
 * @param {string} setup - Setup 型態名稱
 * @returns {string} HTML 字符串
 */
function renderSetupBadge(setup) {
    if (!setup) return '-';
    const className = setup.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `<span class="setup-badge ${className}">${setup}</span>`;
}

// ========== 排序邏輯 ==========

/**
 * 解析表頭排序參數
 * @param {string} sortValue - 排序字符串
 * @returns {object|null} 包含列和方向的對象
 */
function parseHeaderSort(sortValue = currentFilters.sort) {
    const match = String(sortValue).match(/^header:([^:]+):(asc|desc)$/);
    if (match && TABLE_SORT_COLUMNS[match[1]]) {
        return { col: match[1], dir: match[2] };
    }

    // Legacy 排序映射
    const legacyMap = {
        'score-desc': { col: 'score', dir: 'desc' },
        'score-asc': { col: 'score', dir: 'asc' },
        'resilience-desc': { col: 'resilience', dir: 'desc' },
        'ytd-desc': { col: 'ytd', dir: 'desc' },
        'ytd-asc': { col: 'ytd', dir: 'asc' }
    };
    return legacyMap[sortValue] || null;
}

/**
 * 比較排序值（通用比較函式）
 * @param {*} aValue - 值 A
 * @param {*} bValue - 值 B
 * @param {string} type - 數據類型
 * @param {string} direction - 排序方向
 * @returns {number} 比較結果
 */
function compareSortValues(aValue, bValue, type, direction) {
    const dir = direction === 'desc' ? -1 : 1;
    const aEmpty = aValue === undefined || aValue === null || aValue === '' || Number.isNaN(aValue);
    const bEmpty = bValue === undefined || bValue === null || bValue === '' || Number.isNaN(bValue);

    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    if (type === 'number') {
        const aNum = Number(aValue);
        const bNum = Number(bValue);
        const aInvalid = !Number.isFinite(aNum);
        const bInvalid = !Number.isFinite(bNum);
        if (aInvalid && bInvalid) return 0;
        if (aInvalid) return 1;
        if (bInvalid) return -1;
        return (aNum - bNum) * dir;
    }

    return String(aValue).localeCompare(String(bValue), 'zh-Hant', { numeric: true, sensitivity: 'base' }) * dir;
}

/**
 * 根據表頭排序列進行比較
 * @param {object} a - 數據項 A
 * @param {object} b - 數據項 B
 * @param {string} col - 列名
 * @param {string} direction - 排序方向
 * @returns {number} 比較結果
 */
function compareByHeaderSort(a, b, col, direction) {
    const config = TABLE_SORT_COLUMNS[col];
    if (!config) return 0;
    const result = compareSortValues(config.value(a), config.value(b), config.type, direction);
    if (result !== 0) return result;
    return String(a.Ticker || '').localeCompare(String(b.Ticker || ''), 'en', { numeric: true, sensitivity: 'base' });
}

/**
 * 根據當前排序設定進行比較
 * @param {object} a - 數據項 A
 * @param {object} b - 數據項 B
 * @returns {number} 比較結果
 */
function compareByCurrentSort(a, b) {
    const headerSort = parseHeaderSort(currentFilters.sort);
    if (String(currentFilters.sort).startsWith('header:') && headerSort) {
        return compareByHeaderSort(a, b, headerSort.col, headerSort.dir);
    }

    // Legacy 排序邏輯
    switch (currentFilters.sort) {
        case 'score-desc':
            return compareByHeaderSort(a, b, 'score', 'desc');
        case 'score-asc':
            return compareByHeaderSort(a, b, 'score', 'asc');
        case 'resilience-desc':
            return compareByHeaderSort(a, b, 'resilience', 'desc');
        case 'ytd-desc':
            return compareByHeaderSort(a, b, 'ytd', 'desc');
        case 'ytd-asc':
            return compareByHeaderSort(a, b, 'ytd', 'asc');
        case 'dist10-asc':
            return Math.abs(a.Dist_EMA10 ?? 999) - Math.abs(b.Dist_EMA10 ?? 999);
        case 'dist21-asc':
            return Math.abs(a.Dist_EMA21 ?? 999) - Math.abs(b.Dist_EMA21 ?? 999);
        case 'dist50-asc':
            return Math.abs(a.Dist_EMA50 ?? 999) - Math.abs(b.Dist_EMA50 ?? 999);
        case 'dist200-asc':
            return Math.abs(a.Dist_EMA200 ?? 999) - Math.abs(b.Dist_EMA200 ?? 999);
        default:
            return 0;
    }
}

/**
 * 更新排序選擇下拉選單為當前排序狀態
 */
function updateSortSelectForCurrentSort() {
    const sortSelect = document.getElementById('sort-select');
    if (!sortSelect) return;

    const headerSort = String(currentFilters.sort).startsWith('header:') ? parseHeaderSort(currentFilters.sort) : null;
    const headerOptionValue = '__header-sort__';
    let headerOption = sortSelect.querySelector(`option[value="${headerOptionValue}"]`);

    if (headerSort) {
        if (!headerOption) {
            headerOption = document.createElement('option');
            headerOption.value = headerOptionValue;
            headerOption.disabled = true;
            sortSelect.prepend(headerOption);
        }
        const directionLabel = headerSort.dir === 'asc' ? '低到高 / A→Z' : '高到低 / Z→A';
        headerOption.textContent = `表頭排序：${TABLE_SORT_COLUMNS[headerSort.col].label}（${directionLabel}）`;
        sortSelect.value = headerOptionValue;
    } else {
        if (headerOption) headerOption.remove();
        sortSelect.value = currentFilters.sort;
    }
}

/**
 * 更新表頭排序視覺指示器
 */
function updateSortHeaderIndicators() {
    updateSortSelectForCurrentSort();
    const headerSort = parseHeaderSort(currentFilters.sort);
    document.querySelectorAll('#sort-header-row .sortable-th').forEach(th => {
        const isActive = headerSort && th.dataset.col === headerSort.col;
        th.classList.toggle('sorted-asc', Boolean(isActive && headerSort.dir === 'asc'));
        th.classList.toggle('sorted-desc', Boolean(isActive && headerSort.dir === 'desc'));
        th.setAttribute('aria-sort', isActive ? (headerSort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
        th.setAttribute('tabindex', '0');
        th.setAttribute('title', '點擊切換升序 / 降序排序');
    });
}

/**
 * 根據表頭排序
 * @param {HTMLElement} th - 表頭元素
 */
function sortByTableHeader(th) {
    const col = th?.dataset?.col;
    const config = TABLE_SORT_COLUMNS[col];
    if (!config) return;

    const activeSort = parseHeaderSort(currentFilters.sort);
    const nextDir = activeSort && activeSort.col === col
        ? (activeSort.dir === 'asc' ? 'desc' : 'asc')
        : config.defaultDir;

    currentFilters.sort = `header:${col}:${nextDir}`;
    clearPresetActiveStyles();
    currentPage = 1;
    applyFiltersAndRender();
}

// ========== 資料載入與初始化 ==========

/**
 * 頁面載入時初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setupEventListeners();
});

/**
 * 非同步載入資料
 */
async function fetchData() {
    try {
        // 優先讀取全域變數（本地模式）
        if (window.radarData && Array.isArray(window.radarData) && window.radarData.length > 0) {
            allData = window.radarData;
        } else {
            // Fallback：從伺服器載入
            const response = await fetch('score/sp500_leading_rs_radar_vectorized.json');
            if (!response.ok) {
                throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
            }
            allData = await response.json();
        }

        radarMetadata = await loadMetadata();

        // 提取所有不重複的維度
        allData.forEach(item => {
            if (item.Sector && item.Sector !== '其他') uniqueSectors.add(item.Sector);
            if (item.TL_RS_Phase) uniquePhases.add(item.TL_RS_Phase);
            if (item.Setup_Type) uniqueSetups.add(item.Setup_Type);
        });

        // 初始化 UI
        populateSectorDropdown();
        populatePhaseDropdown();
        populateSetupDropdown();
        updateStats();
        applyFiltersAndRender();
        updateMetadataDisplay();

    } catch (error) {
        console.error('❌ 讀取資料失敗:', error);
        document.getElementById('table-body').innerHTML = `
            <tr>
                <td colspan="17" class="loading-state" style="color: #f87171;">
                    <i data-lucide="alert-circle" style="width: 32px; height: 32px; margin: 0 auto 12px;"></i>
                    無法讀取資料檔案，請確認 scorev5_02a_ytd_fixed.py 已執行並產生 JSON。
                </td>
            </tr>
        `;
        lucide.createIcons();
    }
}

/**
 * 異步載入 Metadata
 */
async function loadMetadata() {
    if (window.radarMetadata && typeof window.radarMetadata === 'object') {
        return window.radarMetadata;
    }

    try {
        const response = await fetch('score/sp500_leading_rs_radar_metadata.json');
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

/**
 * 格式化 Metadata 日期
 */
function formatMetadataDate(dateText) {
    if (!dateText) return '-';
    return String(dateText).slice(0, 10);
}

/**
 * 更新 Metadata 顯示（優化版本）
 */
function updateMetadataDisplay() {
    const updateTimeEl = document.getElementById('update-time');
    const statDataDate = document.getElementById('stat-data-date');
    const statScanCount = document.getElementById('stat-scan-count');
    const statMarketRegime = document.getElementById('stat-market-regime');
    const statMarketDetail = document.getElementById('stat-market-detail');
    const marketCard = document.getElementById('market-regime-card');

    if (!radarMetadata) {
        if (updateTimeEl) updateTimeEl.innerText = `最後更新: ${new Date().toLocaleTimeString()}（未含metadata）`;
        if (statDataDate) statDataDate.textContent = '-';
        if (statScanCount) statScanCount.textContent = `候選 ${allData.length} 檔`;
        if (statMarketRegime) statMarketRegime.textContent = '-';
        if (statMarketDetail) statMarketDetail.textContent = '請重新執行 scorev5_02a_ytd_fixed.py 產生 metadata';
        return;
    }

    const lastDataDate = formatMetadataDate(radarMetadata.last_data_date);
    const generatedAt = radarMetadata.generated_at || '';
    const market = radarMetadata.market_regime || {};

    if (updateTimeEl) {
        updateTimeEl.innerText = `資料日期: ${lastDataDate}${generatedAt ? `｜產生: ${generatedAt}` : ''}`;
    }
    if (statDataDate) statDataDate.textContent = lastDataDate;
    if (statScanCount) {
        const total = radarMetadata.total_universe_count ?? '-';
        const valid = radarMetadata.valid_scanned_count ?? '-';
        const exported = radarMetadata.exported_candidate_count ?? allData.length;
        statScanCount.textContent = `Universe ${total}｜有效 ${valid}｜候選 ${exported}`;
    }
    if (statMarketRegime) statMarketRegime.textContent = market.label || market.status || '-';
    if (statMarketDetail) {
        const parts = [];
        if (market.benchmark_price !== undefined) parts.push(`${radarMetadata.benchmark_ticker || 'SPY'} ${market.benchmark_price}`);
        if (market.benchmark_20d_return_pct !== undefined && market.benchmark_20d_return_pct !== null) parts.push(`20D ${market.benchmark_20d_return_pct}%`);
        if (market.benchmark_50d_return_pct !== undefined && market.benchmark_50d_return_pct !== null) parts.push(`50D ${market.benchmark_50d_return_pct}%`);
        statMarketDetail.textContent = parts.length ? parts.join('｜') : (market.description || '-');
        if (market.description) statMarketDetail.title = market.description;
    }
    
    // 優化版本：直接使用 CSS class 映射（避免多層判斷）
    if (marketCard) {
        marketCard.classList.remove('risk-on', 'risk-off', 'risk-neutral');
        const cssClass = MARKET_REGIME_CSS[market.status];
        if (cssClass) marketCard.classList.add(cssClass);
    }
}

// ========== 統計更新 ==========

/**
 * 更新統計數字
 */
function updateStats() {
    document.getElementById('stat-total').textContent = allData.length;
    
    const a1Count = allData.filter(item => item.Decision_Bucket === 'A1 核心領先股').length;
    document.getElementById('stat-a1').textContent = a1Count;

    const pullbackCount = allData.filter(item => item.Decision_Bucket === 'A3 均線回檔買點').length;
    document.getElementById('stat-pullback').textContent = pullbackCount;

    const resonanceCount = allData.filter(item => item.Industry_RS_PR >= 90).length;
    document.getElementById('stat-resonance').textContent = resonanceCount;
}

// ========== 下拉選單填充 ==========

/**
 * 填充板塊下拉選單
 */
function populateSectorDropdown() {
    const dropdown = document.getElementById('sector-filter');
    dropdown.innerHTML = '<option value="">所有板塊 (All Sectors)</option>';
    Array.from(uniqueSectors).sort().forEach(sector => {
        const option = document.createElement('option');
        option.value = sector;
        option.textContent = sector;
        dropdown.appendChild(option);
    });
}

/**
 * 填充相對強弱狀態下拉選單
 */
function populatePhaseDropdown() {
    const dropdown = document.getElementById('phase-filter');
    if (!dropdown) return;

    const previousValue = currentFilters.phase;
    dropdown.innerHTML = '<option value="">所有強弱狀態 (All Phases)</option>';

    Array.from(uniquePhases)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'zh-Hant'))
        .forEach(phase => {
            const option = document.createElement('option');
            option.value = phase;
            option.textContent = phase;
            dropdown.appendChild(option);
        });

    if (previousValue && uniquePhases.has(previousValue)) {
        dropdown.value = previousValue;
    }
}

/**
 * 填充 Setup 型態下拉選單
 */
function populateSetupDropdown() {
    const dropdown = document.getElementById('setup-filter');
    if (!dropdown) return;

    const previousValue = currentFilters.setup;
    dropdown.innerHTML = '<option value="">所有型態 / VCP (All Setups)</option>';

    Array.from(uniqueSetups)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'zh-Hant'))
        .forEach(setup => {
            const option = document.createElement('option');
            option.value = setup;
            option.textContent = setup;
            dropdown.appendChild(option);
        });

    if (previousValue && uniqueSetups.has(previousValue)) {
        dropdown.value = previousValue;
    }
}

// ========== 過濾狀態管理 ==========

/**
 * 清除所有快捷策略按鈕的 active 樣式
 */
function clearPresetActiveStyles() {
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
}

/**
 * 同步當前過濾狀態到 DOM 下拉選單
 */
function syncDropdownsToState() {
    // 搜尋欄
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = currentFilters.search;

    // 各下拉選單
    const filterElementsMap = {
        'sector-filter': 'sector',
        'marketcap-filter': 'marketCap',
        'rsi-filter': 'rsi',
        'ytd-filter': 'ytd',
        'phase-filter': 'phase',
        'stage-filter': 'stage',
        'setup-filter': 'setup',
        'ema10-filter': 'ema10',
        'ema21-filter': 'ema21',
        'ema50-filter': 'ema50',
        'ema200-filter': 'ema200',
        'rs-mom-filter': 'rsMom',
        'resilience-filter': 'resilience',
        'sort-select': 'sort'
    };

    for (const [elementId, filterKey] of Object.entries(filterElementsMap)) {
        const element = document.getElementById(elementId);
        if (element) element.value = currentFilters[filterKey];
    }

    // 更新排序指示器
    updateSortHeaderIndicators();

    // 更新決策分級分頁
    const tabContainer = document.getElementById('bucket-filters');
    if (tabContainer) {
        tabContainer.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.bucket === currentFilters.bucket) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

/**
 * 重置所有過濾與排序狀態到預設
 * @param {boolean} shouldRender - 是否渲染
 */
function resetAllFilterStates(shouldRender = true) {
    currentFilters = { ...DEFAULT_FILTERS };

    if (shouldRender) {
        clearPresetActiveStyles();
        syncDropdownsToState();
        currentPage = 1;
        applyFiltersAndRender();
    }
}

/**
 * 套用指定快捷交易策略（優化版本）
 * @param {string} strategyId - 策略 ID
 */
function applyStrategyPreset(strategyId) {
    clearPresetActiveStyles();
    const clickedBtn = document.querySelector(`.preset-btn[data-strategy="${strategyId}"]`);
    if (clickedBtn) clickedBtn.classList.add('active');

    resetAllFilterStates(false);

    // 策略預設配置
    const strategyConfigs = {
        '1': {  // 📈 強勢領先突破流
            phase: '🏆 領先突破(RSNHBP)',
            ema21: 'above',
            ema50: 'above',
            ema200: 'above',
            sort: 'score-desc'
        },
        '2': {  // 📥 極致黃金回檔流
            bucket: 'A3 均線回檔買點',
            phase: '🎯 均線量縮回檔',
            ema21: 'above',
            ema50: 'above',
            ema200: 'above',
            sort: 'dist21-asc'
        },
        '3': {  // 🏛️ 巨頭機構抱團流
            bucket: 'A1 核心領先股',
            marketCap: 'mega',
            ema10: 'above',
            ema21: 'above',
            ema50: 'above',
            ema200: 'above',
            sort: 'score-desc'
        },
        '4': {  // 🛡️ 強勢股「錯殺超跌」反彈流
            rsi: 'oversold',
            ema10: 'below',
            ema21: 'below',
            sort: 'score-desc'
        },
        '5': {  // 📉 空頭避險 / 放空流
            phase: '⚪ 中性',
            ema10: 'below',
            ema21: 'below',
            ema50: 'below',
            ema200: 'below',
            rsi: 'weak',
            sort: 'score-asc'
        }
    };

    const config = strategyConfigs[strategyId];
    if (config) {
        Object.assign(currentFilters, config);
    }

    syncDropdownsToState();
    currentPage = 1;
    applyFiltersAndRender();
}

// ========== 事件監聽設置 ==========

/**
 * 設置所有事件監聽器
 */
function setupEventListeners() {
    // 搜尋輸入（防抖）
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentFilters.search = e.target.value.trim().toLowerCase();
            clearPresetActiveStyles();
            currentPage = 1;
            applyFiltersAndRender();
        }, 300);
    });

    // 各過濾選擇監聽（統一處理）
    const filterHandlers = {
        'sector-filter': 'sector',
        'marketcap-filter': 'marketCap',
        'rsi-filter': 'rsi',
        'ytd-filter': 'ytd',
        'phase-filter': 'phase',
        'stage-filter': 'stage',
        'setup-filter': 'setup',
        'ema10-filter': 'ema10',
        'ema21-filter': 'ema21',
        'ema50-filter': 'ema50',
        'ema200-filter': 'ema200',
        'rs-mom-filter': 'rsMom',
        'resilience-filter': 'resilience',
        'sort-select': 'sort'
    };

    for (const [elementId, filterKey] of Object.entries(filterHandlers)) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('change', (e) => {
                currentFilters[filterKey] = e.target.value;
                clearPresetActiveStyles();
                currentPage = 1;
                applyFiltersAndRender();
            });
        }
    }

    // 表頭排序監聽
    const sortHeaderRow = document.getElementById('sort-header-row');
    if (sortHeaderRow) {
        sortHeaderRow.addEventListener('click', (e) => {
            const th = e.target.closest('.sortable-th');
            if (th) sortByTableHeader(th);
        });

        sortHeaderRow.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const th = e.target.closest('.sortable-th');
            if (th) {
                e.preventDefault();
                sortByTableHeader(th);
            }
        });
    }

    // 決策分級分頁 Tab 監聽
    const tabContainer = document.getElementById('bucket-filters');
    if (tabContainer) {
        tabContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;

            tabContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentFilters.bucket = btn.dataset.bucket;
            clearPresetActiveStyles();
            currentPage = 1;
            applyFiltersAndRender();
        });
    }

    // 快捷策略與重置按鈕監聽
    const strategyContainer = document.getElementById('strategy-presets');
    if (strategyContainer) {
        strategyContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.preset-btn');
            if (!btn) return;

            if (btn.classList.contains('reset-btn')) {
                resetAllFilterStates(true);
            } else {
                const strategyId = btn.dataset.strategy;
                if (strategyId) applyStrategyPreset(strategyId);
            }
        });
    }

    // 分頁按鈕監聽
    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderData();
        }
    });

    document.getElementById('next-btn').addEventListener('click', () => {
        const maxPage = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
        if (currentPage < maxPage) {
            currentPage++;
            renderData();
        }
    });

    // Modal 控制
    const guideModal = document.getElementById('guide-modal');
    const openGuideBtn = document.getElementById('open-guide-btn');
    const closeGuideBtn = document.getElementById('close-guide-btn');

    if (openGuideBtn && guideModal && closeGuideBtn) {
        openGuideBtn.addEventListener('click', () => guideModal.classList.remove('hidden'));
        closeGuideBtn.addEventListener('click', () => guideModal.classList.add('hidden'));

        guideModal.addEventListener('click', (e) => {
            if (e.target === guideModal) guideModal.classList.add('hidden');
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !guideModal.classList.contains('hidden')) {
                guideModal.classList.add('hidden');
            }
        });
    }
}

// ========== 過濾與渲染邏輯 ==========

/**
 * 應用所有過濾條件（優化版本 - 減少迴圈次數）
 */
function applyFiltersAndRender() {
    // 1. 過濾邏輯
    filteredData = allData.filter(item => {
        // 搜尋
        const matchSearch = !currentFilters.search ||
            item.Ticker.toLowerCase().includes(currentFilters.search) ||
            (item.Industry && item.Industry.toLowerCase().includes(currentFilters.search)) ||
            (item.Sector && item.Sector.toLowerCase().includes(currentFilters.search));

        // 板塊
        const matchSector = !currentFilters.sector || item.Sector === currentFilters.sector;

        // 市值
        let matchMarketCap = true;
        if (currentFilters.marketCap) {
            const cap = item.MarketCap;
            const capFilters = {
                'mega': cap >= 200e9,
                'large': cap >= 10e9 && cap < 200e9,
                'mid': cap >= 2e9 && cap < 10e9,
                'small': cap < 2e9 && cap !== null && cap !== undefined
            };
            matchMarketCap = capFilters[currentFilters.marketCap] || false;
        }

        // RSI
        let matchRsi = true;
        if (currentFilters.rsi) {
            const rsi = item.RSI;
            const rsiFilters = {
                'overbought': rsi >= 70,
                'strong': rsi >= 50 && rsi < 70,
                'weak': rsi >= 30 && rsi < 50,
                'oversold': rsi <= 30
            };
            matchRsi = rsi !== null && rsi !== undefined && (rsiFilters[currentFilters.rsi] || false);
        }

        // YTD
        let matchYtd = true;
        if (currentFilters.ytd) {
            const ytd = item.YTD;
            const ytdFilters = {
                'very-strong': ytd >= 30,
                'strong': ytd >= 15 && ytd < 30,
                'moderate': ytd >= 0 && ytd < 15,
                'negative': ytd < 0
            };
            matchYtd = ytd !== null && ytd !== undefined && (ytdFilters[currentFilters.ytd] || false);
        }

        // 相對強弱狀態
        const matchPhase = !currentFilters.phase || item.TL_RS_Phase === currentFilters.phase;

        // Stage
        let matchStage = true;
        if (currentFilters.stage) {
            const stageFilters = {
                'stage2-action': item.Stage2_Action_Zone === true,
                'stage2-early': item.Stage2_Early === true,
                'stage2': item.Stage2 === true,
                'stage2-extended': item.Stage2_Extended === true,
                'non-stage2': item.Stage2 !== true
            };
            matchStage = stageFilters[currentFilters.stage] || false;
        }

        // Setup
        const matchSetup = !currentFilters.setup || item.Setup_Type === currentFilters.setup;

        // EMA 偏離
        const matchEma10 = !currentFilters.ema10 || 
            (currentFilters.ema10 === 'above' ? item.Dist_EMA10 > 0 : item.Dist_EMA10 < 0);
        const matchEma21 = !currentFilters.ema21 || 
            (currentFilters.ema21 === 'above' ? item.Dist_EMA21 > 0 : item.Dist_EMA21 < 0);
        const matchEma50 = !currentFilters.ema50 || 
            (currentFilters.ema50 === 'above' ? item.Dist_EMA50 > 0 : item.Dist_EMA50 < 0);
        const matchEma200 = !currentFilters.ema200 || 
            (currentFilters.ema200 === 'above' ? item.Dist_EMA200 > 0 : item.Dist_EMA200 < 0);

        // RS Momentum
        const matchRsMom = !currentFilters.rsMom || item.RS_Momentum === currentFilters.rsMom;

        // 抗跌指數
        let matchResilience = true;
        if (currentFilters.resilience) {
            const res = item.RS_Resiliency;
            const resilFilters = {
                'very-strong': res >= 85,
                'strong': res >= 70 && res < 85,
                'neutral': res >= 55 && res < 70,
                'weak': res >= 40 && res < 55,
                'very-weak': res < 40
            };
            matchResilience = res !== null && res !== undefined && (resilFilters[currentFilters.resilience] || false);
        }

        // 決策分級
        const matchBucket = currentFilters.bucket === 'all' || item.Decision_Bucket === currentFilters.bucket;

        return matchSearch && matchSector && matchMarketCap && matchRsi && matchYtd && 
               matchPhase && matchStage && matchEma10 && matchEma21 && matchEma50 && 
               matchEma200 && matchBucket && matchRsMom && matchResilience && matchSetup;
    });

    // 2. 排序
    filteredData.sort(compareByCurrentSort);

    renderData();
}

// ========== 表格渲染 ==========

/**
 * 渲染表格數據（主渲染函式）
 */
function renderData() {
    const tableBody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');

    if (filteredData.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        document.getElementById('start-idx').textContent = '0';
        document.getElementById('end-idx').textContent = '0';
        document.getElementById('total-count').textContent = '0';
        document.getElementById('prev-btn').disabled = true;
        document.getElementById('next-btn').disabled = true;
        updateSortHeaderIndicators();
        return;
    }

    emptyState.classList.add('hidden');

    // 分頁計算
    const totalCount = filteredData.length;
    const maxPage = Math.ceil(totalCount / ITEMS_PER_PAGE);
    if (currentPage > maxPage) currentPage = maxPage;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, totalCount);
    const pageItems = filteredData.slice(startIdx, endIdx);

    // 生成行 HTML
    let rowsHtml = '';
    pageItems.forEach(item => {
        const ytdColorClass = getYtdColorClass(item.YTD);
        const distColorClass10 = getDistColorClass(item.Dist_EMA10, false);
        const distColorClass21 = getDistColorClass(item.Dist_EMA21, item.Decision_Bucket === 'A3 均線回檔買點');
        const distColorClass50 = getDistColorClass(item.Dist_EMA50, item.Decision_Bucket === 'A3 均線回檔買點');
        const distColorClass200 = getDistColorClass(item.Dist_EMA200, false);

        rowsHtml += `
            <tr>
                <td class="ticker-cell"><a href="https://finance.yahoo.com/quote/${item.Ticker}/" target="_blank" class="ticker-link">${item.Ticker}</a></td>
                <td class="price-cell">${formatPrice(item.Price, item.Daily_Change_Pct)}</td>
                <td class="ytd-cell ${ytdColorClass}">${formatYtd(item.YTD)}</td>
                <td><span class="bucket-badge ${getBucketBadgeClass(item.Decision_Bucket)}">${item.Decision_Bucket}</span></td>
                <td>
                    <div class="score-wrapper">
                        <span class="score-num">${item.Leader_Radar_Score.toFixed(1)}</span>
                        <div class="score-bar-bg">
                            <div class="score-bar-fill" style="width: ${item.Leader_Radar_Score}%"></div>
                        </div>
                    </div>
                </td>
                <td><span class="phase-badge">${item.TL_RS_Phase}</span></td>
                <td><span class="phase-badge">${item.Market_Stage || (item.Stage2 ? '✅ Stage 2 上升趨勢' : '⚪ 非 Stage 2')}</span></td>
                <td>${renderSetupBadge(item.Setup_Type)}</td>
                <td>${renderRsMomBadge(item.RS_Momentum)}</td>
                <td>${renderResilBadge(item.RS_Resiliency)}</td>
                <td class="dist-cell ${distColorClass10}">${formatDist(item.Dist_EMA10)}</td>
                <td class="dist-cell ${distColorClass21}">${formatDist(item.Dist_EMA21)}</td>
                <td class="dist-cell ${distColorClass50}">${formatDist(item.Dist_EMA50)}</td>
                <td class="dist-cell ${distColorClass200}">${formatDist(item.Dist_EMA200)}</td>
                <td><span class="rsi-badge ${getRsiClass(item.RSI)}">${item.RSI ? item.RSI.toFixed(1) : '-'}</span></td>
                <td class="sector-cell">
                    <span>${item.Sector || '其他'}</span>
                    ${item.Industry || ''}
                </td>
                <td class="market-cap">${formatMarketCap(item.MarketCap)}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = rowsHtml;

    // 更新分頁信息
    document.getElementById('start-idx').textContent = startIdx + 1;
    document.getElementById('end-idx').textContent = endIdx;
    document.getElementById('total-count').textContent = totalCount;
    document.getElementById('page-num').textContent = `第 ${currentPage} / ${maxPage} 頁`;
    document.getElementById('prev-btn').disabled = currentPage === 1;
    document.getElementById('next-btn').disabled = currentPage === maxPage;

    updateSortHeaderIndicators();

    // 延遲渲染 Lucide 圖示以避免阻塞
    lucide.createIcons();
}
