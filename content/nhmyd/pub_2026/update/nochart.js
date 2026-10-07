/* nochart.js — 보관용 사본 (실제 적용은 js/update-ui.js의 'Chart 스크립트' 구간, 내용 동일하게 유지)
   단독으로 쓸 때도 .nds 화면에서만 동작하도록 같은 조건을 둠 */
(function () {
	/* Chart 스크립트 start  ===================================================
	   Chart.js 없이 그린 차트(nc-*) 전용. 계산 로직 없음: 누적 막대 애니메이션 재생, 비교 막대 툴팁, 등장 애니메이션 대기만 담당
	   .nds 화면에서만 동작
	     - registerChartGlobals() : activate() 시점 (페이지 스크립트보다 먼저 전역 함수가 있어야 함)
	     - initChart()            : runFeatureInit() 시점 (DOM 준비 후, 차트가 없는 화면은 아무것도 등록하지 않음)
	*/

    // 누적 막대 애니메이션 재생 (기존 window.replayHeroBarChart와 같은 이름 유지 → 페이지 스크립트 수정 불필요)
    // Chart.js 화면(*_chart.html)은 페이지 스크립트가 같은 이름으로 다시 정의해 덮어씀
    function registerChartGlobals() {
        window.replayHeroBarChart = function (key) {
            var els = document.querySelectorAll('.nc-stack[data-chart-canvas="' + key + '"]');
            Array.prototype.forEach.call(els, function (el) {
                el.classList.remove('is-play');
                void el.offsetWidth;
                el.classList.add('is-play');
            });
        };
    }

    function hideChartTooltips(except) {
        var tips = document.querySelectorAll('.nc-cmp-tooltip');
        Array.prototype.forEach.call(tips, function (t) {
            if (t !== except) {
                t.style.opacity = 0;
                t.innerHTML = '';
            }
        });
    }

    // 툴팁은 처음부터 만들어 두고 role="status"로 지정 → 내용이 바뀔 때 화면 낭독기가 읽어줌
    function getChartTooltip(wrap) {
        var tip = wrap.querySelector('.nc-cmp-tooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'chartjs-tooltip nc-cmp-tooltip';
            tip.setAttribute('role', 'status');
            tip.setAttribute('aria-live', 'polite');
            wrap.appendChild(tip);
        }
        return tip;
    }

    // 비교 막대 툴팁: 행(data-diff)에 미리 넣어둔 증감 금액을 표시. 위치·화면 가장자리 보정은 기존 Chart.js 툴팁과 동일
    function onChartClick(e) {
        // 왼쪽 라벨을 눌러도 같은 줄의 막대를 선택한 것으로 처리 (터치 영역 확대)
        var labelEl = e.target.closest && e.target.closest('.nc-cmp__labels span');
        if (labelEl) {
            var idx = Array.prototype.indexOf.call(labelEl.parentNode.children, labelEl);
            var target = labelEl.closest('.nc-cmp').querySelectorAll('.nc-cmp__row')[idx];
            if (target) target.click();
            return;
        }
        var row = e.target.closest && e.target.closest('.nc-cmp__row');
        if (!row) {
            hideChartTooltips(null);
            return;
        }
        var wrap = row.closest('.nc-cmp').parentNode;
        var tip = getChartTooltip(wrap);
        var bar = (e.target.closest && e.target.closest('.nc-cmp__bar')) || row.querySelector('.nc-cmp__bar.is-now');
        // 화면 낭독기에는 '항목명 증감액 +금액'으로 읽힘 (화면에는 금액만 표시)
        tip.innerHTML = '<div class="chartjs-tooltip__row"><span class="nc-sr">' + row.getAttribute('data-label') + ' 증감액 </span>' + row.getAttribute('data-diff') + '</div>';

        var wr = wrap.getBoundingClientRect();
        var br = bar.getBoundingClientRect();
        var x = (bar.classList.contains('is-prev') ? br.left : br.right) - wr.left;
        var y = br.top + br.height / 2 - wr.top;
        tip.style.opacity = 1;
        tip.style.left = x + 'px';
        tip.style.top = y - 10 + 'px';
        tip.style.transform = 'translate(-50%, -100%)';
        tip.style.removeProperty('--tt-arrow-left');

        var edge = 8;
        var rect = tip.getBoundingClientRect();
        var shift = 0;
        if (rect.left < edge) shift = edge - rect.left;
        else if (rect.right > window.innerWidth - edge) shift = window.innerWidth - edge - rect.right;
        if (shift !== 0) {
            tip.style.transform = 'translate(calc(-50% + ' + shift + 'px), -100%)';
            tip.style.setProperty('--tt-arrow-left', 'calc(50% - ' + shift + 'px)');
        }
        hideChartTooltips(tip);
    }

    // 화면 낭독기에서 숨겨진(aria-hidden) 슬라이드·카드 면 안의 버튼은 Tab으로 이동하지 않도록 처리
    function syncChartRowFocus() {
        var rows = document.querySelectorAll('.nc-cmp__row');
        Array.prototype.forEach.call(rows, function (row) {
            row.tabIndex = row.closest('[aria-hidden="true"]') ? -1 : 0;
        });
    }

    function initChart() {
        if (!document.querySelector('.nc-stack, .nc-donut, .nc-line, .nc-cmp')) return;

        // 비교 막대: 툴팁 준비, 클릭·Esc, 숨겨진 버튼 포커스 제외
        if (document.querySelector('.nc-cmp')) {
            Array.prototype.forEach.call(document.querySelectorAll('.nc-cmp'), function (chart) {
                getChartTooltip(chart.parentNode);
            });
            document.addEventListener('click', onChartClick);
            // Esc 키로 툴팁 닫기
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' || e.key === 'Esc') hideChartTooltips(null);
            });
            syncChartRowFocus();
            if ('MutationObserver' in window) {
                new MutationObserver(syncChartRowFocus).observe(document.body, { attributes: true, attributeFilter: ['aria-hidden'], subtree: true });
            }
        }

        // 등장 애니메이션은 차트가 화면에 보일 때 시작 (스크롤해야 보이는 차트가 화면 밖에서 애니메이션을 끝내지 않도록)
        var targets = document.querySelectorAll('.nc-donut, .nc-plot, .predict-chart__box .nc-line, .nc-cmp');
        if (!targets.length || !('IntersectionObserver' in window)) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.remove('nc-wait');
                io.unobserve(entry.target);
            });
        }, { threshold: 0.3 });
        Array.prototype.forEach.call(targets, function (el) {
            el.classList.add('nc-wait');
            io.observe(el);
        });
    }

	/* /// Chart 스크립트 end ================================================== */

    function start() {
        if (!(document.querySelector('.wrapper.nds') || document.querySelector('.popWrap.nds'))) return;
        registerChartGlobals();
        initChart();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
