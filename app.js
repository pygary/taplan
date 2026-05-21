// app.js

// ========== 全域變數定義 ==========
let allData = [];
let filteredData = [];
let uniqueSectors = new Set();

// 分頁控制
let currentPage = 1;
const itemsPerPage = 30;

// 當前篩選條件
let currentSearch = '';
let currentSector = '';
let currentMarketCap = '';
let currentRsi = '';
let currentPhase = '';
let currentEma10 = '';
let currentEma21 = '';
let currentEma50 = '';
let currentRsMom = '';
let currentResilience = '';
let currentBucket = 'all';
let currentSort = 'score-desc';

// ========== 頁面載入初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setupEventListeners();
    initMessageBoard();
});

// ========== 讀取資料 ==========
async function fetchData() {
    try {
        // 優先讀取全域變數 (雙擊 index.html 免伺服器情況)
        if (window.radarData && Array.isArray(window.radarData) && window.radarData.length > 0) {
            allData = window.radarData;
        } else {
            // 否則 fallback 用 fetch 讀取伺服器上的 json 檔案
            const response = await fetch('score/sp500_leading_rs_radar_vectorized.json');
            if (!response.ok) {
                throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
            }
            allData = await response.json();
        }

        filteredData = [...allData];

        // 提取所有不重複的板塊 (Sector)
        allData.forEach(item => {
            if (item.Sector && item.Sector !== '其他') {
                uniqueSectors.add(item.Sector);
            }
        });

        // 初始化面板
        populateSectorDropdown();
        updateStats();
        renderData();

        // 更新狀態時間為目前時間或檔案最後更新
        document.getElementById('update-time').innerText = `最後更新: ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        console.error('❌ 讀取資料失敗:', error);
        document.getElementById('table-body').innerHTML = `
            <tr>
                <td colspan="13" class="loading-state" style="color: #f87171;">
                    <i data-lucide="alert-circle" style="width: 32px; height: 32px; margin: 0 auto 10px; display: block;"></i>
                    <span>讀取資料失敗，請確認 score/sp500_leading_rs_radar_vectorized.js 或 .json 檔案已生成並放在正確路徑。</span>
                </td>
            </tr>
        `;
        lucide.createIcons();
    }
}

// ========== 建立過濾板塊下拉選單 ==========
function populateSectorDropdown() {
    const dropdown = document.getElementById('sector-filter');

    // 清空現有選項 (保留預設)
    dropdown.innerHTML = '<option value="">所有板塊 (All Sectors)</option>';

    // 依字母排序加入
    Array.from(uniqueSectors).sort().forEach(sector => {
        const option = document.createElement('option');
        option.value = sector;
        option.textContent = sector;
        dropdown.appendChild(option);
    });
}

// ========== 計算與更新統計數字 ==========
function updateStats() {
    // 1. 總掃描數
    document.getElementById('stat-total').textContent = allData.length;

    // 2. A1 核心領先股數量
    const a1Count = allData.filter(item => item.Decision_Bucket === 'A1 核心領先股').length;
    document.getElementById('stat-a1').textContent = a1Count;

    // 3. A3 均線回檔買點數量
    const pullbackCount = allData.filter(item => item.Decision_Bucket === 'A3 均線回檔買點').length;
    document.getElementById('stat-pullback').textContent = pullbackCount;

    // 4. 板塊強勢共振大於等於 90 分的個股數
    const resonanceCount = allData.filter(item => item.Industry_RS_PR >= 90).length;
    document.getElementById('stat-resonance').textContent = resonanceCount;
}

// ========== 快捷策略與重置輔助函式 ==========

// 清除所有快捷策略按鈕的高亮 active 樣式
function clearPresetActiveStyles() {
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
}

// 同步當前過濾變數狀態到 DOM 下拉選單與頁籤上
function syncDropdownsToState() {
    // 1. 同步搜尋欄與下拉選單
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = currentSearch;

    const sectorFilter = document.getElementById('sector-filter');
    if (sectorFilter) sectorFilter.value = currentSector;

    const marketcapFilter = document.getElementById('marketcap-filter');
    if (marketcapFilter) marketcapFilter.value = currentMarketCap;

    const rsiFilter = document.getElementById('rsi-filter');
    if (rsiFilter) rsiFilter.value = currentRsi;

    const phaseFilter = document.getElementById('phase-filter');
    if (phaseFilter) phaseFilter.value = currentPhase;

    const ema10Filter = document.getElementById('ema10-filter');
    if (ema10Filter) ema10Filter.value = currentEma10;

    const ema21Filter = document.getElementById('ema21-filter');
    if (ema21Filter) ema21Filter.value = currentEma21;

    const ema50Filter = document.getElementById('ema50-filter');
    if (ema50Filter) ema50Filter.value = currentEma50;

    const rsMomFilter = document.getElementById('rs-mom-filter');
    if (rsMomFilter) rsMomFilter.value = currentRsMom;

    const resilienceFilter = document.getElementById('resilience-filter');
    if (resilienceFilter) resilienceFilter.value = currentResilience;

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) sortSelect.value = currentSort;

    // 2. 同步決策池分頁 Tab 狀態
    const tabContainer = document.getElementById('bucket-filters');
    if (tabContainer) {
        tabContainer.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.bucket === currentBucket) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

// 重置所有過濾與排序狀態到預設
function resetAllFilterStates(shouldRender = true) {
    currentSearch = '';
    currentSector = '';
    currentMarketCap = '';
    currentRsi = '';
    currentPhase = '';
    currentEma10 = '';
    currentEma21 = '';
    currentEma50 = '';
    currentRsMom = '';
    currentResilience = '';
    currentBucket = 'all';
    currentSort = 'score-desc';

    if (shouldRender) {
        clearPresetActiveStyles();
        syncDropdownsToState();
        currentPage = 1;
        applyFiltersAndRender();
    }
}

// 套用指定快捷交易策略
function applyStrategyPreset(strategyId) {
    // 1. 先清除所有策略按鈕高亮
    clearPresetActiveStyles();

    // 2. 高亮當前被點擊的策略按鈕
    const clickedBtn = document.querySelector(`.preset-btn[data-strategy="${strategyId}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }

    // 3. 重置所有過濾變數 (不渲染，等設定完統一渲染)
    resetAllFilterStates(false);

    // 4. 根據策略 ID 覆寫篩選條件與排序
    switch (strategyId) {
        case '1': // 📈 策略 1: 強勢領先突破流 (Breakout Buyer)
            currentPhase = '🏆 領先突破(RSNHBP)';
            currentEma21 = 'above';
            currentEma50 = 'above';
            currentRsi = ''; // 允許超買及強勢 (RSI >= 50)，故保持 All 不限，由領先突破狀態與 EMA 保證強度
            currentSort = 'score-desc';
            break;

        case '2': // 📥 策略 2: 極致黃金回檔流 (Buy the Dip)
            currentBucket = 'A3 均線回檔買點';
            currentPhase = '🎯 均線量縮回檔';
            currentEma21 = 'above';
            currentEma50 = 'above';
            currentSort = 'dist21-asc'; // 預設使用 EMA21 距離 (近到遠)
            break;

        case '3': // 🏛️ 策略 3: 巨頭機構抱團流 (Trend Following)
            currentBucket = 'A1 核心領先股';
            currentMarketCap = 'mega'; // 超大型股 Mega
            currentEma10 = 'above';
            currentEma21 = 'above';
            currentEma50 = 'above';
            currentSort = 'score-desc';
            break;

        case '4': // 🛡️ 策略 4: 強勢股「錯殺超跌」反彈流 (Mean Reversion)
            currentRsi = 'oversold'; // 超賣 (RSI <= 30)
            currentEma10 = 'below';
            currentEma21 = 'below';
            currentSort = 'score-desc'; // 依雷達分數由高到低以確保原本品質良好
            break;

        case '5': // 📉 策略 5: 空頭避險 / 放空流 (Short / Hedging)
            currentPhase = '⚪ 中性';
            currentEma10 = 'below';
            currentEma21 = 'below';
            currentEma50 = 'below';
            currentRsi = 'weak'; // 預設篩選 RSI 弱勢 (30 - 50) 的標的
            currentSort = 'score-asc'; // 雷達分數由低到高 (最弱的優先)
            break;

        default:
            break;
    }

    // 5. 同步所有變數至 DOM 顯示，並重新渲染表格與分頁
    syncDropdownsToState();
    currentPage = 1;
    applyFiltersAndRender();
}

// ========== 設定事件監聽 ==========
function setupEventListeners() {
    // 搜尋輸入監聽 (防抖，避免頻繁觸發)
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value.trim().toLowerCase();
            clearPresetActiveStyles(); // 自訂修改後清除策略高亮
            currentPage = 1;
            applyFiltersAndRender();
        }, 300);
    });

    // 板塊篩選監聽
    document.getElementById('sector-filter').addEventListener('change', (e) => {
        currentSector = e.target.value;
        clearPresetActiveStyles(); // 自訂修改後清除策略高亮
        currentPage = 1;
        applyFiltersAndRender();
    });

    // 市值篩選監聽
    document.getElementById('marketcap-filter').addEventListener('change', (e) => {
        currentMarketCap = e.target.value;
        clearPresetActiveStyles(); // 自訂修改後清除策略高亮
        currentPage = 1;
        applyFiltersAndRender();
    });

    // RSI 篩選監聽
    document.getElementById('rsi-filter').addEventListener('change', (e) => {
        currentRsi = e.target.value;
        clearPresetActiveStyles(); // 自訂修改後清除策略高亮
        currentPage = 1;
        applyFiltersAndRender();
    });

    // 相對強弱狀態篩選監聽
    document.getElementById('phase-filter').addEventListener('change', (e) => {
        currentPhase = e.target.value;
        clearPresetActiveStyles(); // 自訂修改後清除策略高亮
        currentPage = 1;
        applyFiltersAndRender();
    });

    // 趨勢篩選監聽
    document.getElementById('ema10-filter').addEventListener('change', (e) => {
        currentEma10 = e.target.value;
        clearPresetActiveStyles(); // 自訂修改後清除策略高亮
        currentPage = 1;
        applyFiltersAndRender();
    });

    document.getElementById('ema21-filter').addEventListener('change', (e) => {
        currentEma21 = e.target.value;
        clearPresetActiveStyles(); // 自訂修改後清除策略高亮
        currentPage = 1;
        applyFiltersAndRender();
    });

    document.getElementById('ema50-filter').addEventListener('change', (e) => {
        currentEma50 = e.target.value;
        clearPresetActiveStyles(); // 自訂修改後清除策略高亮
        currentPage = 1;
        applyFiltersAndRender();
    });

    // RS Momentum 篩選監聽
    document.getElementById('rs-mom-filter').addEventListener('change', (e) => {
        currentRsMom = e.target.value;
        clearPresetActiveStyles();
        currentPage = 1;
        applyFiltersAndRender();
    });

    // 抗跌指數篩選監聽
    document.getElementById('resilience-filter').addEventListener('change', (e) => {
        currentResilience = e.target.value;
        clearPresetActiveStyles();
        currentPage = 1;
        applyFiltersAndRender();
    });

    // 排序篩選監聽
    document.getElementById('sort-select').addEventListener('change', (e) => {
        currentSort = e.target.value;
        clearPresetActiveStyles(); // 自訂修改後清除策略高亮
        currentPage = 1;
        applyFiltersAndRender();
    });

    // 決策分級分頁 Tab 點擊監聽
    const tabContainer = document.getElementById('bucket-filters');
    tabContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;

        // 更新按鈕 active 樣式
        tabContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentBucket = btn.dataset.bucket;
        clearPresetActiveStyles(); // 自訂修改後清除策略高亮
        currentPage = 1;
        applyFiltersAndRender();
    });

    // 快捷策略預設按鈕與重置監聽
    const strategyContainer = document.getElementById('strategy-presets');
    if (strategyContainer) {
        strategyContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.preset-btn');
            if (!btn) return;

            if (btn.classList.contains('reset-btn')) {
                resetAllFilterStates(true);
            } else {
                const strategyId = btn.dataset.strategy;
                if (strategyId) {
                    applyStrategyPreset(strategyId);
                }
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
        const maxPage = Math.ceil(filteredData.length / itemsPerPage);
        if (currentPage < maxPage) {
            currentPage++;
            renderData();
        }
    });

    // 交易策略選股指南 Modal 控制
    const guideModal = document.getElementById('guide-modal');
    const openGuideBtn = document.getElementById('open-guide-btn');
    const closeGuideBtn = document.getElementById('close-guide-btn');

    if (openGuideBtn && guideModal && closeGuideBtn) {
        openGuideBtn.addEventListener('click', () => {
            guideModal.classList.remove('hidden');
        });

        closeGuideBtn.addEventListener('click', () => {
            guideModal.classList.add('hidden');
        });

        // 點擊 Modal 外部區域關閉彈窗
        guideModal.addEventListener('click', (e) => {
            if (e.target === guideModal) {
                guideModal.classList.add('hidden');
            }
        });

        // 按 ESC 鍵關閉彈窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !guideModal.classList.contains('hidden')) {
                guideModal.classList.add('hidden');
            }
        });
    }
}

// ========== 應用所有過濾與排序，然後渲染 ==========
function applyFiltersAndRender() {
    // 1. 過濾邏輯
    filteredData = allData.filter(item => {
        // 搜尋欄位匹配 (Ticker, Industry, Sector)
        const matchSearch = !currentSearch ||
            item.Ticker.toLowerCase().includes(currentSearch) ||
            (item.Industry && item.Industry.toLowerCase().includes(currentSearch)) ||
            (item.Sector && item.Sector.toLowerCase().includes(currentSearch));

        // 板塊匹配
        const matchSector = !currentSector || item.Sector === currentSector;

        // 市值篩選匹配
        let matchMarketCap = true;
        if (currentMarketCap) {
            const cap = item.MarketCap;
            if (currentMarketCap === 'mega') {
                matchMarketCap = cap >= 200e9; // Mega Cap: >= $200B
            } else if (currentMarketCap === 'large') {
                matchMarketCap = cap >= 10e9 && cap < 200e9; // Large Cap: $10B - $200B
            } else if (currentMarketCap === 'mid') {
                matchMarketCap = cap >= 2e9 && cap < 10e9; // Mid Cap: $2B - $10B
            } else if (currentMarketCap === 'small') {
                matchMarketCap = cap < 2e9 && cap !== null && cap !== undefined; // Small Cap: < $2B
            }
        }

        // RSI 篩選匹配
        let matchRsi = true;
        if (currentRsi) {
            const rsi = item.RSI;
            if (rsi === null || rsi === undefined) {
                matchRsi = false;
            } else {
                if (currentRsi === 'overbought') {
                    matchRsi = rsi >= 70;
                } else if (currentRsi === 'strong') {
                    matchRsi = rsi >= 50 && rsi < 70;
                } else if (currentRsi === 'weak') {
                    matchRsi = rsi >= 30 && rsi < 50;
                } else if (currentRsi === 'oversold') {
                    matchRsi = rsi <= 30;
                }
            }
        }

        // EMA10 篩選匹配
        let matchEma10 = true;
        if (currentEma10) {
            const d10 = item.Dist_EMA10;
            if (d10 === null || d10 === undefined) {
                matchEma10 = false;
            } else {
                if (currentEma10 === 'above') {
                    matchEma10 = d10 > 0;
                } else if (currentEma10 === 'below') {
                    matchEma10 = d10 < 0;
                }
            }
        }

        // EMA21 篩選匹配
        let matchEma21 = true;
        if (currentEma21) {
            const d21 = item.Dist_EMA21;
            if (d21 === null || d21 === undefined) {
                matchEma21 = false;
            } else {
                if (currentEma21 === 'above') {
                    matchEma21 = d21 > 0;
                } else if (currentEma21 === 'below') {
                    matchEma21 = d21 < 0;
                }
            }
        }

        // EMA50 篩選匹配
        let matchEma50 = true;
        if (currentEma50) {
            const d50 = item.Dist_EMA50;
            if (d50 === null || d50 === undefined) {
                matchEma50 = false;
            } else {
                if (currentEma50 === 'above') {
                    matchEma50 = d50 > 0;
                } else if (currentEma50 === 'below') {
                    matchEma50 = d50 < 0;
                }
            }
        }

        // 決策池分級匹配
        const matchBucket = currentBucket === 'all' || item.Decision_Bucket === currentBucket;

        // 相對強弱狀態篩選匹配
        const matchPhase = !currentPhase || item.TL_RS_Phase === currentPhase;

        // RS Momentum 篩選匹配
        const matchRsMom = !currentRsMom || item.RS_Momentum === currentRsMom;

        // 抗跌指數篩選匹配
        let matchResilience = true;
        if (currentResilience) {
            const res = item.Beta_Resiliency;
            if (res === null || res === undefined) {
                matchResilience = false;
            } else {
                if (currentResilience === 'high') {
                    matchResilience = res >= 70;
                } else if (currentResilience === 'med') {
                    matchResilience = res >= 50 && res < 70;
                } else if (currentResilience === 'low') {
                    matchResilience = res < 50;
                }
            }
        }

        return matchSearch && matchSector && matchMarketCap && matchRsi && matchPhase && matchEma10 && matchEma21 && matchEma50 && matchBucket && matchRsMom && matchResilience;
    });

    // 2. 排序邏輯
    filteredData.sort((a, b) => {
        switch (currentSort) {
            case 'score-desc':
                return b.Leader_Radar_Score - a.Leader_Radar_Score;
            case 'score-asc':
                return a.Leader_Radar_Score - b.Leader_Radar_Score;
            case 'resilience-desc':
                return b.Beta_Resiliency - a.Beta_Resiliency;
            case 'dist10-asc':
                return Math.abs(a.Dist_EMA10 || 999) - Math.abs(b.Dist_EMA10 || 999);
            case 'dist21-asc':
                return Math.abs(a.Dist_EMA21 || 999) - Math.abs(b.Dist_EMA21 || 999);
            case 'dist50-asc':
                return Math.abs(a.Dist_EMA50 || 999) - Math.abs(b.Dist_EMA50 || 999);
            default:
                return 0;
        }
    });

    renderData();
}

// ========== 渲染表格數據 ==========
function renderData() {
    const tableBody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');

    // 如果沒有資料，顯示空狀態
    if (filteredData.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        document.getElementById('start-idx').textContent = '0';
        document.getElementById('end-idx').textContent = '0';
        document.getElementById('total-count').textContent = '0';
        document.getElementById('prev-btn').disabled = true;
        document.getElementById('next-btn').disabled = true;
        return;
    }

    emptyState.classList.add('hidden');

    // 分頁索引計算
    const totalCount = filteredData.length;
    const maxPage = Math.ceil(totalCount / itemsPerPage);

    // 安全保護以防 currentPage 超越邊界
    if (currentPage > maxPage) currentPage = maxPage;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalCount);

    const pageItems = filteredData.slice(startIdx, endIdx);

    // 生成 HTML 內容
    let rowsHtml = '';
    pageItems.forEach(item => {
        rowsHtml += `
            <tr>
                <td class="ticker-cell"><a href="https://finance.yahoo.com/quote/${item.Ticker}/" target="_blank" class="ticker-link">${item.Ticker}</a></td>
                <td class="price-cell">$${formatPrice(item.Price)}</td>
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
                <td>${renderRsMomBadge(item.RS_Momentum)}</td>
                <td>${renderResilBadge(item.Beta_Resiliency)}</td>
                <td class="dist-cell ${getDistColorClass(item.Dist_EMA10, false)}">${formatDist(item.Dist_EMA10)}</td>
                <td class="dist-cell ${getDistColorClass(item.Dist_EMA21, item.Decision_Bucket === 'A3 均線回檔買點')}">${formatDist(item.Dist_EMA21)}</td>
                <td class="dist-cell ${getDistColorClass(item.Dist_EMA50, item.Decision_Bucket === 'A3 均線回檔買點')}">${formatDist(item.Dist_EMA50)}</td>
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

    // 更新分頁腳部資訊與狀態
    document.getElementById('start-idx').textContent = startIdx + 1;
    document.getElementById('end-idx').textContent = endIdx;
    document.getElementById('total-count').textContent = totalCount;
    document.getElementById('page-num').textContent = `第 ${currentPage} / ${maxPage} 頁`;

    document.getElementById('prev-btn').disabled = currentPage === 1;
    document.getElementById('next-btn').disabled = currentPage === maxPage;

    // 渲染 Lucide 圖示
    lucide.createIcons();
}

// ========== 輔助與格式化函式 ==========

// 格式化價格
function formatPrice(price) {
    if (price === undefined || price === null) return '-';
    return price.toFixed(2);
}

// 格式化偏離比率
function formatDist(dist) {
    if (dist === undefined || dist === null) return '-';
    const sign = dist >= 0 ? '+' : '';
    return `${sign}${dist.toFixed(2)}%`;
}

// 根據偏離比率和分級返回紅綠偏色樣式
function getDistColorClass(dist, isPullback) {
    if (dist === undefined || dist === null) return '';
    if (isPullback && dist >= -1.0 && dist <= 3.0) return 'pullback'; // 買點區間高亮
    return dist >= 0 ? 'positive' : 'negative';
}

// 根據 RSI 分段返回樣式
function getRsiClass(rsi) {
    if (rsi === undefined || rsi === null) return 'normal';
    if (rsi >= 70) return 'overbought';
    if (rsi <= 30) return 'oversold';
    return 'normal';
}

// 取得決策池徽章顏色 class
function getBucketBadgeClass(bucket) {
    switch (bucket) {
        case 'A1 核心領先股': return 'a1';
        case 'A2 RS突破候選': return 'a2';
        case 'A3 均線回檔買點': return 'a3';
        case 'B 穩定領先股': return 'b';
        case 'C 強勢回檔觀察': return 'c';
        default: return '';
    }
}

// 渲染 RS Momentum 徽章
function renderRsMomBadge(mom) {
    if (!mom) return '-';
    let className = 'stable';
    if (mom === '🚀 交叉啟動') className = 'crossover';
    else if (mom === '📈 加速中') className = 'accelerating';
    return `<span class="rs-mom-badge ${className}">${mom}</span>`;
}

// 渲染抗跌指數徽章
function renderResilBadge(resil) {
    if (resil === undefined || resil === null) return '-';
    let className = 'low';
    if (resil >= 70) className = 'high';
    else if (resil >= 50) className = 'med';
    return `<span class="resil-badge ${className}">${resil.toFixed(1)}%</span>`;
}

// 將巨大市值格式化為千億/百億(B)或百萬(M)美元
function formatMarketCap(cap) {
    if (!cap || isNaN(cap)) return '-';
    if (cap >= 1e12) {
        return `$${(cap / 1e12).toFixed(2)} T`;
    } else if (cap >= 1e9) {
        return `$${(cap / 1e9).toFixed(2)} B`;
    } else if (cap >= 1e6) {
        return `$${(cap / 1e6).toFixed(2)} M`;
    }
    return `$${cap.toLocaleString()}`;
}

// ========== 交易與研究討論區留言板邏輯 ==========
let isServerOnline = false;
let messagesList = [];

// 初始化留言板
async function initMessageBoard() {
    const form = document.getElementById('message-form');
    if (!form) return;

    form.addEventListener('submit', handleMessageSubmit);

    const exportBtn = document.getElementById('export-msg-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportMessagesToFile);
    }

    // 偵測伺服器連線狀態與讀取資料
    try {
        const response = await fetch('api/messages');
        if (response.ok) {
            messagesList = await response.json();
            isServerOnline = true;
            updateConnectionStatus(true);
        } else {
            throw new Error('Not connected');
        }
    } catch (e) {
        isServerOnline = false;
        updateConnectionStatus(false);
        // Fallback: 讀取 localStorage 留言
        const saved = localStorage.getItem('radar_discussion_messages');
        if (saved) {
            try {
                messagesList = JSON.parse(saved);
            } catch (err) {
                messagesList = [];
            }
        } else {
            messagesList = [];
        }
        // 顯示手動下載按鈕
        if (exportBtn) {
            exportBtn.classList.remove('hidden');
        }
    }
}

// 更新連線狀態顯示
function updateConnectionStatus(online) {
    const statusDiv = document.getElementById('connection-status');
    const statusText = document.getElementById('connection-text');
    if (!statusDiv || !statusText) return;

    if (online) {
        statusDiv.className = 'status-indicator online';
        statusText.textContent = '伺服器已連線 (動態寫入 msg.txt)';
    } else {
        statusDiv.className = 'status-indicator offline';
        statusText.textContent = '靜態網頁模式 (本機儲存，請下載導出)';
    }
}

// 送出留言
async function handleMessageSubmit(e) {
    e.preventDefault();

    const nameInput = document.getElementById('msg-username');
    const textInput = document.getElementById('msg-text');
    if (!textInput) return;

    const name = nameInput.value.trim() || '路人甲';
    const text = textInput.value.trim();

    if (!text) return;

    // 取得當前時間
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    if (isServerOnline) {
        // 伺服器線上模式：透過 API 寫入硬碟
        try {
            const response = await fetch('api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, text })
            });
            if (response.ok) {
                messagesList = await response.json();
                textInput.value = '';
                showSubmitNotification();
            } else {
                throw new Error('POST failed');
            }
        } catch (err) {
            console.error('API 留言送出失敗，嘗試切換至本機暫存模式:', err);
            isServerOnline = false;
            updateConnectionStatus(false);
            const exportBtn = document.getElementById('export-msg-btn');
            if (exportBtn) exportBtn.classList.remove('hidden');
            saveMessageLocally(name, text, timestamp);
            textInput.value = '';
            showSubmitNotification();
        }
    } else {
        // 離線 / 靜態網頁模式：儲存至 localStorage
        saveMessageLocally(name, text, timestamp);
        textInput.value = '';
        showSubmitNotification();
    }
}

// 本機儲存留言 (localStorage)
function saveMessageLocally(name, text, timestamp) {
    const newMsg = {
        name: name,
        text: text,
        time: timestamp
    };

    messagesList.push(newMsg);
    localStorage.setItem('radar_discussion_messages', JSON.stringify(messagesList));
}

// 導出 / 下載留言檔案
function exportMessagesToFile() {
    if (messagesList.length === 0) {
        alert('目前尚無留言可以導出。');
        return;
    }

    let fileContent = '';
    messagesList.forEach(msg => {
        fileContent += `[${msg.time}] ${msg.name}: ${msg.text}\n`;
    });

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'msg.txt';
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 提示留言成功儲存
function showSubmitNotification() {
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.background = 'rgba(16, 185, 129, 0.95)';
    notification.style.color = '#ffffff';
    notification.style.padding = '12px 24px';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    notification.style.zIndex = '9999';
    notification.style.fontSize = '0.9rem';
    notification.style.fontWeight = '600';
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    notification.style.gap = '8px';
    notification.style.animation = 'msg-appear 0.3s ease-out';

    notification.innerHTML = `<i data-lucide="check-circle" style="width: 18px; height: 18px;"></i> 留言已成功！`;
    document.body.appendChild(notification);

    lucide.createIcons();

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 2500);
}

