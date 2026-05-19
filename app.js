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
let currentBucket = 'all';
let currentSort = 'score-desc';

// ========== 頁面載入初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setupEventListeners();
});

// ========== 讀取資料 ==========
async function fetchData() {
    try {
        const response = await fetch('score/sp500_leading_rs_radar_vectorized.json');
        if (!response.ok) {
            throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
        }
        
        allData = await response.json();
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
                <td colspan="11" class="loading-state" style="color: #f87171;">
                    <i data-lucide="alert-circle" style="width: 32px; height: 32px; margin: 0 auto 10px; display: block;"></i>
                    <span>讀取資料失敗，請確認 score/sp500_leading_rs_radar_vectorized.json 檔案已生成並放在正確路徑。</span>
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

// ========== 設定事件監聽 ==========
function setupEventListeners() {
    // 搜尋輸入監聽 (防抖，避免頻繁觸發)
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value.trim().toLowerCase();
            currentPage = 1;
            applyFiltersAndRender();
        }, 300);
    });

    // 板塊篩選監聽
    document.getElementById('sector-filter').addEventListener('change', (e) => {
        currentSector = e.target.value;
        currentPage = 1;
        applyFiltersAndRender();
    });

    // 排序篩選監聽
    document.getElementById('sort-select').addEventListener('change', (e) => {
        currentSort = e.target.value;
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
        currentPage = 1;
        applyFiltersAndRender();
    });

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
        
        // 決策池分級匹配
        const matchBucket = currentBucket === 'all' || item.Decision_Bucket === currentBucket;
        
        return matchSearch && matchSector && matchBucket;
    });

    // 2. 排序邏輯
    filteredData.sort((a, b) => {
        switch (currentSort) {
            case 'score-desc':
                return b.Leader_Radar_Score - a.Leader_Radar_Score;
            case 'score-asc':
                return a.Leader_Radar_Score - b.Leader_Radar_Score;
            case 'price-desc':
                return b.Price - a.Price;
            case 'price-asc':
                return a.Price - b.Price;
            case 'rsi-desc':
                return (b.RSI || 0) - (a.RSI || 0);
            case 'rsi-asc':
                return (a.RSI || 100) - (b.RSI || 100);
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
                <td class="ticker-cell">${item.Ticker}</td>
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
                <td class="dist-cell ${getDistColorClass(item.Dist_EMA21, item.Decision_Bucket === 'A3 均線回檔買點')}">${formatDist(item.Dist_EMA21)}</td>
                <td class="dist-cell ${getDistColorClass(item.Dist_EMA50, item.Decision_Bucket === 'A3 均線回檔買點')}">${formatDist(item.Dist_EMA50)}</td>
                <td><span class="rsi-badge ${getRsiClass(item.RSI)}">${item.RSI ? item.RSI.toFixed(1) : '-'}</span></td>
                <td>
                    <div class="macd-wrapper">
                        <span class="macd-line">L: ${item.MACD ? item.MACD.toFixed(2) : '-'}</span>
                        <span class="macd-hist ${item.MACD_Hist >= 0 ? 'up' : 'down'}">H: ${item.MACD_Hist ? item.MACD_Hist.toFixed(2) : '-'}</span>
                    </div>
                </td>
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
