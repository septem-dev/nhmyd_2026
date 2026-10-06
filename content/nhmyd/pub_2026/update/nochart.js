/* nochart.js — Chart.js 없이 그린 차트(기본 화면용, Chart.js 버전은 *_chart.html) 스크립트
   계산 로직 없음: 누적 막대 애니메이션 재생, 비교 막대 툴팁 표시만 담당
   확정 시 update-ui.js로 옮길 것 */
(function () {
    // 누적 막대 애니메이션 재생 (기존 window.replayHeroBarChart와 같은 이름 유지 → 페이지 스크립트 수정 불필요)
    window.replayHeroBarChart = function (key) {
        var els = document.querySelectorAll('.nc-stack[data-chart-canvas="' + key + '"]');
        Array.prototype.forEach.call(els, function (el) {
            el.classList.remove('is-play');
            void el.offsetWidth;
            el.classList.add('is-play');
        });
    };

    function hideTooltips(except) {
        var tips = document.querySelectorAll('.nc-cmp-tooltip');
        Array.prototype.forEach.call(tips, function (t) {
            if (t !== except) {
                t.style.opacity = 0;
                t.innerHTML = '';
            }
        });
    }

    // 툴팁은 처음부터 만들어 두고 role="status"로 지정 → 내용이 바뀔 때 화면 낭독기가 읽어줌
    function getTooltip(wrap) {
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
    document.addEventListener('click', function (e) {
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
            hideTooltips(null);
            return;
        }
        var wrap = row.closest('.nc-cmp').parentNode;
        var tip = getTooltip(wrap);
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
        hideTooltips(tip);
    });
    // Esc 키로 툴팁 닫기
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') hideTooltips(null);
    });

    // 화면 낭독기에서 숨겨진(aria-hidden) 슬라이드·카드 면 안의 버튼은 Tab으로 이동하지 않도록 처리
    function syncRowFocus() {
        var rows = document.querySelectorAll('.nc-cmp__row');
        Array.prototype.forEach.call(rows, function (row) {
            row.tabIndex = row.closest('[aria-hidden="true"]') ? -1 : 0;
        });
    }

    // 등장 애니메이션은 차트가 화면에 보일 때 시작 (스크롤해야 보이는 차트가 화면 밖에서 애니메이션을 끝내지 않도록)
    document.addEventListener('DOMContentLoaded', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.nc-cmp'), function (chart) {
            getTooltip(chart.parentNode);
        });
        syncRowFocus();
        if ('MutationObserver' in window) {
            new MutationObserver(syncRowFocus).observe(document.body, { attributes: true, attributeFilter: ['aria-hidden'], subtree: true });
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
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
    });
})();
