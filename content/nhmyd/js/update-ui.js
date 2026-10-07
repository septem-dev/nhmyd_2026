/*
 * [di9] UI Dev Team
 * update/ , sample_update/ 화면(.nds 컴포넌트)에서 공통으로 쓰는 UI 스크립트.
 *   1) .wrapper.nds 또는 .popWrap.nds 가 페이지 어딘가에 없으면, 이 파일은 사실상 아무 것도 하지 않습니다.
 *      (전역 함수 재정의도, 이벤트 바인딩도, init 호출도 전부 지연/생략됩니다.)
 *   2) nds 대상이 처음부터 없다가 나중에(팝업 등으로) 동적으로 추가되는 경우도 MutationObserver로 감지해
 *      그 시점에 한 번만 활성화합니다.
 *   3) 스크립트가 <head>에서 document.write로 주입되어 DOM이 아직 없는 시점에 실행되든,
 *      <body> 뒤쪽에서 실행되어 DOM이 이미 있는 시점이든 동일하게 동작하도록 만들었습니다.
 *   4) 컴포넌트는 처음 화면에 있던 요소뿐 아니라 나중에 추가된 요소(팝업·목록 렌더링 등)에도 자동으로 연결됩니다.
 *      직접 연결하고 싶을 때는 window.ndsUI.bind() 를 호출하면 됩니다. (이미 연결된 요소는 건너뜀)
 *
 * 파일 구성
 *   1. 공통 유틸
 *   2. 팝업·바텀시트 (높이 맞춤, 포커스 복귀, 딤 닫기, 선택 목록)
 *   3. 레거시 전역 함수 오버라이드 (popClose, calendarAlign, tooltipOpen/Close, slidePopConfirm)
 *   4. 컴포넌트 (아코디언, 약관, 탭, 칩, 자산 막대 범례, 하단 고정 영역, 거래내역 마스킹, :has() 폴백,
 *                숫자 인디케이터 캐러셀, 선택 바텀시트, 자산 히어로 카드, 필수 동의 버튼)
 *   5. 차트 (Chart.js 없이 그린 nc-* 차트)
 *   6. 실행 (init 순서, 동적 요소 연결, 활성화 게이트)
 */

(function () {
    // ===============================================================
    // 1. 공통 유틸
    // ===============================================================

    var activated = false;

    function isNdsScope($target) {
        if ($target && $target.length) {
            var $popWrap = $target.hasClass("popWrap") ? $target : $target.closest(".popWrap");
            if ($popWrap.length && $popWrap.hasClass("nds")) return true;
        }
        if ($(".wrapper").hasClass("nds")) return true;
        if ($(".popWrap.nds").length > 0) return true;
        return false;
    }

    function hasNdsRoot() {
        return !!(document.querySelector(".wrapper.nds") || document.querySelector(".popWrap.nds"));
    }

    function supportsHasSelector() {
        try {
            return !!(window.CSS && CSS.supports && CSS.supports("selector(:has(a))"));
        } catch (e) {
            return false;
        }
    }

    function toArray(list) {
        return Array.prototype.slice.call(list);
    }

    // id가 없으면 자동으로 만들어 붙임 (aria-controls 연결용)
    var autoIdSeq = 0;
    function ensureId(el, prefix) {
        if (!el.id) {
            autoIdSeq += 1;
            el.id = prefix + "-" + autoIdSeq;
        }
        return el.id;
    }

    // hidden 속성으로 숨긴 영역을 jQuery 슬라이드 애니메이션이 가능한 display:none 으로 바꿈
    function hiddenToDisplayNone(el) {
        if (el.hasAttribute("hidden")) {
            el.removeAttribute("hidden");
            el.style.display = "none";
        }
    }

    function isExpanded(btn) {
        return btn.getAttribute("aria-expanded") === "true";
    }

    function setExpanded(btn, open) {
        btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    // 그룹 안에서 하나만 선택 상태로 (칩·선택 목록 공통)
    function selectOne(items, selected, className, ariaAttr) {
        items.forEach(function (item) {
            var active = item === selected;
            item.classList.toggle(className, active);
            item.setAttribute(ariaAttr, active ? "true" : "false");
        });
    }

    // 아직 연결되지 않은 요소에만 fn 실행 (같은 요소에 이벤트가 두 번 걸리지 않도록 표시)
    function eachUnbound(selector, key, fn) {
        var flag = "__nds_" + key;
        toArray(document.querySelectorAll(selector)).forEach(function (el) {
            if (el[flag]) return;
            el[flag] = true;
            fn(el);
        });
    }

    // ===============================================================
    // 2. 팝업·바텀시트
    // ===============================================================

    // ---------------------------------------------------------------
    // 2-1. 바텀시트(.slidePopConfirm) 높이 맞춤
    //   - 내용 높이에 맞추되 화면 높이의 80%를 넘지 않게, 넘치면 목록·탭 패널·본문 순으로 스크롤 영역 지정
    //   - 내용 크기가 바뀌면(ResizeObserver) 다시 맞춤
    // ---------------------------------------------------------------
    var slidePopContentObserver = null;
    var slidePopSyncScheduled = false;

    function syncSlidePopConfirmHeight(animate) {
        $(".slidePopConfirm:visible").each(function () {
            var $pop = $(this);
            if ($pop.data("ndsClosing")) return; // 닫히는 중인 시트는 높이를 다시 맞추지 않음
            var $popInner = $pop.find(".popInner");
            var $popCont = $pop.find(".popCont");
            var $tabPanels = $pop.find(".tab-panel");
            var $bottomsheetLists = $pop.find(".bottomsheet-list");
            var confirmTit = $pop.find(".popInner h1").length > 0 ? $pop.find(".popInner h1").outerHeight() : $pop.find(".popInner h2").outerHeight();
            var confirmBtnAra = $pop.find(".popBtnWrap .popBtn").length > 0 ? $pop.find(".popBtnWrap").outerHeight() : 0;

            $popCont.css({ maxHeight: "none", overflowY: "visible" });
            $tabPanels.css({ maxHeight: "none", overflowY: "visible" });
            $bottomsheetLists.css({ maxHeight: "none", overflowY: "visible" });
            var naturalContH = $popCont.outerHeight();
            var naturalTotal = naturalContH + confirmBtnAra + confirmTit;

            var maxPopInnerH = $(window).height() * 0.8;
            var targetPopInnerH = Math.min(naturalTotal, maxPopInnerH);
            $popInner.stop(true);
            if (animate) {
                $popInner.animate({ height: targetPopInnerH }, 100);
            } else {
                $popInner.css({ height: targetPopInnerH });
            }

            var maxContH = targetPopInnerH - confirmTit - confirmBtnAra;
            if (naturalContH <= maxContH) return;

            var $scrollTarget = $bottomsheetLists.filter(":visible");
            if ($scrollTarget.length === 0) $scrollTarget = $tabPanels.not("[hidden]");

            if ($scrollTarget.length > 0) {
                var otherH = naturalContH - $scrollTarget.outerHeight();
                var maxScrollTargetH = Math.max(maxContH - otherH, 0);
                $scrollTarget.css({ maxHeight: maxScrollTargetH, overflowY: "auto" });
            } else {
                $popCont.css({ maxHeight: maxContH, overflowY: "auto" });
            }
        });
    }

    function scheduleSlidePopConfirmSync() {
        if (slidePopSyncScheduled) return;
        slidePopSyncScheduled = true;
        window.requestAnimationFrame(function () {
            slidePopSyncScheduled = false;
            syncSlidePopConfirmHeight(false);
        });
    }

    function observeSlidePopConfirmContent() {
        if (typeof ResizeObserver !== "function") return;
        if (!slidePopContentObserver) slidePopContentObserver = new ResizeObserver(scheduleSlidePopConfirmSync);
        slidePopContentObserver.disconnect();

        $(".slidePopConfirm.nds .popCont").each(function () {
            var inner = this.querySelector(".popCont__inner");
            if (inner) {
                slidePopContentObserver.observe(inner);
                return;
            }
            for (var i = 0; i < this.children.length; i++) slidePopContentObserver.observe(this.children[i]);
        });
    }

    // ---------------------------------------------------------------
    // 2-2. 바텀시트 포커스 이동·복귀
    //   - 열 때: 시트 제목(h1/h2)으로 포커스 이동
    //   - 시트를 연 요소(버튼 등)를 기억해 두었다가, 어떤 방식(X·딤·항목 선택 후 popClose)으로 닫히든 그 요소로 포커스를 돌려줌
    //   - 연 요소에 aria-expanded가 있으면 열 때 true, 닫을 때 false로 맞춤
    //   - iOS Safari처럼 클릭해도 버튼에 포커스가 가지 않는 환경을 위해, 직전에 누른 요소도 함께 기억
    // ---------------------------------------------------------------
    var lastPopActivator = null;
    var lastPopActivatorTime = 0;

    function trackPopActivator() {
        document.addEventListener(
            "click",
            function (e) {
                var el = e.target.closest && e.target.closest('button, a[href], [role="button"], [tabindex]:not([tabindex="-1"])');
                if (!el || el.closest(".popWrap")) return;
                lastPopActivator = el;
                lastPopActivatorTime = Date.now();
            },
            true,
        );
    }

    // 방금(1초 안) 누른 요소를 먼저 씀 → 클릭해도 포커스가 옮겨지지 않는 환경에서 이전에 포커스된 다른 버튼을 잘못 기억하지 않도록
    function getPopOpener() {
        if (lastPopActivator && Date.now() - lastPopActivatorTime < 1000 && document.documentElement.contains(lastPopActivator)) return lastPopActivator;
        var active = document.activeElement;
        if (active && active !== document.body && active !== document.documentElement && !active.closest(".popWrap")) return active;
        return null;
    }

    function rememberPopOpener($pops, opener) {
        if (!opener) return;
        $pops.data("ndsOpener", opener);
        if (opener.hasAttribute("aria-expanded")) setExpanded(opener, true);
    }

    // 시트가 열리면 제목(h1, 없으면 h2)으로 포커스 이동 → 화면 낭독기가 시트 제목부터 읽고, Tab이 시트 안에서 시작됨
    // (닫을 때는 restorePopOpener가 연 버튼으로 되돌림)
    function focusPopHeading($pop) {
        if (!$pop || !$pop.length) return;
        var heading = $pop.find(".popInner h1")[0] || $pop.find(".popInner h2")[0];
        if (!heading) return;
        if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
        try {
            heading.focus({ preventScroll: true });
        } catch (e) {
            heading.focus();
        }
    }

    function restorePopOpener($popWrap) {
        var opener = $popWrap.data("ndsOpener");
        $popWrap.removeData("ndsOpener");
        if (!opener) return;
        if (opener.hasAttribute("aria-expanded")) setExpanded(opener, false);
        if (document.documentElement.contains(opener) && opener.getClientRects().length) opener.focus();
    }

    // ---------------------------------------------------------------
    // 2-3. 딤(어두운 배경)을 눌러 바텀시트 닫기 (공통 규칙)
    //   - 기본: .nds 바텀시트(slidePopConfirm·slidePopOption·bankSetWrap) 안에 X 버튼(.popClose)이 있으면 딤으로 닫힘
    //   - 예외로 끄기: data-dim-close="false" (X가 있어도 딤으로 닫히면 안 되는 시트)
    //   - 예외로 켜기: data-dim-close (X가 없는 시트나 바텀시트가 아닌 .nds 팝업도 딤으로 닫고 싶을 때)
    //   - 기능 전체를 빼려면: runFeatureInit()의 initDimClose(); 한 줄 삭제
    // ---------------------------------------------------------------
    function isBottomSheet($popWrap) {
        return $popWrap.hasClass("slidePopConfirm") || $popWrap.hasClass("slidePopOption") || $popWrap.hasClass("bankSetWrap");
    }

    function isDimClosable($popWrap) {
        var attr = $popWrap.attr("data-dim-close");
        if (attr === "false") return false;
        if (typeof attr !== "undefined") return true;
        return isBottomSheet($popWrap) && $popWrap.find(".popClose").length > 0;
    }

    function initDimClose() {
        document.addEventListener("click", function (e) {
            var dim = e.target.closest && e.target.closest(".popWrap.nds > .dim");
            if (!dim || typeof window.popClose !== "function") return;
            if (!isDimClosable($(dim).closest(".popWrap"))) return;
            window.popClose(dim);
        });
    }

    // ---------------------------------------------------------------
    // 2-4. 바텀시트 선택 목록: aria-pressed 항목 중 하나만 선택 (.is-selected)
    // ---------------------------------------------------------------
    function bindBottomsheetList() {
        eachUnbound(".bottomsheet-list > [aria-pressed]", "bsList", function (btn) {
            btn.addEventListener("click", function () {
                var list = btn.parentElement;
                if (!list) return;
                var items = toArray(list.children).filter(function (el) {
                    return el.hasAttribute("aria-pressed");
                });
                selectOne(items, btn, "is-selected", "aria-pressed");
            });
        });
    }

    // ===============================================================
    // 3. 레거시 전역 함수 오버라이드 (activate() 이후에만 설치)
    //    .nds 범위가 아니면 원래 함수를 그대로 호출
    // ===============================================================

    /* 툴팁이 들어갈 수 있는 위/아래 한계.
       화면 높이뿐 아니라 잘라내는(overflow) 조상까지 따집니다.
       히어로 카드처럼 overflow:hidden 안에 있으면 그 박스가 한계가 됩니다. */
    function tooltipBounds(el) {
        var bounds = { top: 0, bottom: $(window).height() };
        while (el && el !== document.body && el.nodeType === 1) {
            var overflow = window.getComputedStyle(el).overflowY;
            if (overflow !== "visible") {
                var rect = el.getBoundingClientRect();
                bounds.top = Math.max(bounds.top, rect.top);
                bounds.bottom = Math.min(bounds.bottom, rect.bottom);
            }
            el = el.parentElement;
        }
        return bounds;
    }

    function overridePopClose() {
        var legacyPopClose = window.popClose;

        window.popClose = function (e) {
            var $popWrap = $(e).closest(".popWrap");
            if (!isNdsScope($popWrap)) {
                if (typeof legacyPopClose === "function") legacyPopClose(e);
                return;
            }

            scrollPosY = $("body").css("top");
            var $slidePopInner = $popWrap.find(".popInner");

            restorePopOpener($popWrap); // 시트를 연 요소로 포커스 복귀·aria-expanded 정리

            $popWrap.find(".dim").fadeOut(100);

            if (isBottomSheet($popWrap)) {
                // 닫히는 동안 표시: 이 사이 내용 크기 변화(선택 표시 등)로 높이 맞춤이 다시 실행돼 닫기 애니메이션이 멈추지 않도록
                $popWrap.data("ndsClosing", true);
                $slidePopInner.animate({ height: 0 }, 150, function () {
                    $popWrap.hide();
                    $popWrap.removeData("ndsClosing");
                });
            } else {
                $popWrap.hide();
            }

            if ($(".popWrap:visible").not($popWrap).length === 0) {
                scrollUnlock(scrollPosY);
            }

            $("#popupLayer_div").children(".fullLayerPop").children(".fullLayerPop").attr("aria-hidden", false).removeAttr("inert");
            $("#popupLayer_div").children(".fullLayerPop").attr("aria-hidden", false).removeAttr("inert");
        };
    }

    function overrideCalendarAlign() {
        var legacyCalendarAlign = window.calendarAlign;

        window.calendarAlign = function () {
            if (!isNdsScope()) {
                if (typeof legacyCalendarAlign === "function") legacyCalendarAlign();
                return;
            }

            $(".yearSet").each(function () {
                $(this).attr("aria-hidden", $(this).hasClass("noneAction") ? "true" : "false");
            });

            $(".yearSet > ol").each(function () {
                var $ol = $(this);
                var rowH = $ol.children("li").first().outerHeight();
                if (!rowH) return;
                var viewH = $ol.outerHeight();
                var padY = Math.max(0, (viewH - rowH) / 2);

                this.style.setProperty("padding", padY + "px 0", "important");
                $ol.data("rowH", rowH);

                var $listIndex = $ol.find("a.active,button.active").attr("title", "선택됨").parent("li").index();
                $ol.scrollTop($listIndex * rowH);
            });

            $(".yearSet ol a,.yearSet ol button").click(function () {
                if ($(".yearSet").hasClass("noneAction")) return;
                var $this = $(this);
                var $ol = $this.parents("ol");
                var rowH = $ol.data("rowH") || $ol.children("li").first().outerHeight();
                var $thisParent = $ol.find("a,button");
                $thisParent.removeClass("active").attr("title", "");
                $this.addClass("active").attr("title", "선택됨");
                var $listIndex = $this.parent("li").index();
                $ol.stop().animate({ scrollTop: $listIndex * rowH }, 300);
            });

            var scrollEndEvntTimerId;
            function visibleEvnt() {
                var $el = $(this);
                var rowH = $el.data("rowH") || $el.children("li").first().outerHeight();
                var items = $el.find("li");
                var idx = Math.round($el.scrollTop() / rowH);
                items.eq(idx).addClass("on").children().addClass("active").parent().siblings().removeClass("on").children().removeClass("active");

                clearTimeout(scrollEndEvntTimerId);
                scrollEndEvntTimerId = setTimeout(function () {
                    $(".yearSet > ol").off("scroll", visibleEvnt);
                    $el.stop().animate(
                        { scrollTop: idx * rowH },
                        {
                            duration: 40,
                            step: function (now, fx) {
                                if (fx.pos == 1) {
                                    $(this).scrollTop(idx * rowH - rowH);
                                    setTimeout(function () {
                                        $(".yearSet > ol").on("scroll", visibleEvnt);
                                    }, 100);
                                }
                            },
                        },
                    );
                }, 100);
            }

            setTimeout(function () {
                $(".yearSet > ol").on("scroll", visibleEvnt);
            }, 500);
        };
    }

    function overrideTooltip() {
        var legacyTooltipOpen = window.tooltipOpen;
        var legacyTooltipClose = window.tooltipClose;

        window.tooltipOpen = function ($obj) {
            if (!isNdsScope($obj)) {
                if (typeof legacyTooltipOpen === "function") legacyTooltipOpen($obj);
                return;
            }

            var $tooltipCont = $obj.closest(".tooltipWrap").find(".tooltipCont");
            $(".tooltipCont").removeClass("is-top").hide();
            $tooltipCont.css({ width: $(window).width() - 32 });
            $tooltipCont.show();

            var contRect = $tooltipCont[0].getBoundingClientRect();
            var btnRect = $obj[0].getBoundingClientRect();
            var bounds = tooltipBounds($obj[0].parentElement);
            var $ctaWrap = $obj.closest(".popWrap").find(".popBtnWrap");
            if ($ctaWrap.length) bounds.bottom = Math.min(bounds.bottom, $ctaWrap[0].getBoundingClientRect().top);

            if (contRect.bottom > bounds.bottom && btnRect.top - bounds.top > bounds.bottom - btnRect.bottom) {
                $tooltipCont.addClass("is-top");
            }
        };

        window.tooltipClose = function ($obj) {
            $obj.closest(".tooltipCont").removeClass("is-top");
            if (typeof legacyTooltipClose === "function") legacyTooltipClose($obj);
        };
    }

    // slidePopConfirm()        : 페이지의 .slidePopConfirm 시트를 모두 엶 (레거시와 같은 동작)
    // slidePopConfirm("시트id") : 그 시트만 엶 (요소·jQuery 객체도 가능) — 한 화면에 시트가 여러 개일 때
    function overrideSlidePopConfirm() {
        window.slidePopConfirm = function (target) {
            scrollLock();
            var opener = getPopOpener();
            var $pops = $(".slidePopConfirm");
            if (target) {
                var $target = typeof target === "string" && document.getElementById(target) ? $(document.getElementById(target)) : $(target);
                if ($target.filter(".slidePopConfirm").length) {
                    $pops.not($target).hide();
                    $pops = $target.filter(".slidePopConfirm");
                }
            }
            $pops.removeData("ndsClosing").show();
            rememberPopOpener($pops.filter(".nds"), opener);
            setTimeout(function () {
                syncSlidePopConfirmHeight(true);
                observeSlidePopConfirmContent();
                focusPopHeading($pops.filter(".nds:visible").first());
            }, 100);
        };
    }

    function registerLegacyOverrides() {
        overridePopClose();
        overrideCalendarAlign();
        overrideTooltip();
        overrideSlidePopConfirm();

        window.syncSlidePopConfirmHeight = syncSlidePopConfirmHeight;
        window.observeSlidePopConfirmContent = observeSlidePopConfirmContent;

        $(window).on("resize orientationchange", function () {
            syncSlidePopConfirmHeight(false);
            if ($(".fullLayerPop:visible").length > 0 && typeof window.fullLayerHeight === "function") {
                window.fullLayerHeight();
            }
        });
    }

    // ===============================================================
    // 4. 컴포넌트
    //    bind* 함수: 아직 연결되지 않은 요소에만 이벤트를 연결 (처음 1회 + 요소가 추가될 때마다 다시 호출됨)
    //    init* 함수: 문서 전체에 한 번만 설치
    // ===============================================================

    // ---------------------------------------------------------------
    // 4-1. 아코디언: [data-acc-toggle] 버튼 → 형제 영역(*__body 또는 *__list) 펼치기/접기
    // ---------------------------------------------------------------
    function bindAccordion() {
        eachUnbound("[data-acc-toggle]", "acc", function (btn) {
            var body = btn.parentElement.querySelector('[class$="__body"], [class$="__list"]');
            if (!body) return;

            btn.setAttribute("aria-controls", ensureId(body, "acc-body"));
            hiddenToDisplayNone(body);

            btn.addEventListener("click", function () {
                var open = isExpanded(btn);
                setExpanded(btn, !open);

                if (window.jQuery) {
                    jQuery(body).stop(true, true)[open ? "slideUp" : "slideDown"]("fast");
                } else {
                    body.style.display = open ? "none" : "block";
                }
            });
        });
    }

    // ---------------------------------------------------------------
    // 4-2. 약관
    //   - 카드 펼치기: [data-terms-toggle] → .terms-card__divider + .terms-card__body
    //   - 전체 동의: .terms-card__header 체크박스 ↔ .terms-card__list 체크박스들
    //   - 약관 링크 체크 시 바로 아래 .terms-accordion 펼치기
    // ---------------------------------------------------------------
    function bindTermsToggle() {
        eachUnbound("[data-terms-toggle]", "termsToggle", function (btn) {
            var card = btn.closest(".terms-card");
            if (!card) return;
            var divider = card.querySelector(".terms-card__divider");
            var body = card.querySelector(".terms-card__body");
            if (!divider || !body) return;

            btn.setAttribute("aria-controls", ensureId(body, "terms-body"));
            hiddenToDisplayNone(divider);
            hiddenToDisplayNone(body);

            btn.addEventListener("click", function () {
                var open = isExpanded(btn);
                setExpanded(btn, !open);
                btn.classList.toggle("is-open", !open);
                btn.setAttribute("aria-label", open ? "펼치기" : "접기");

                if (window.jQuery) {
                    jQuery([divider, body]).stop(true, true).animate({ height: "toggle", marginTop: "toggle", opacity: "toggle" }, { duration: 250, easing: "swing" });
                } else {
                    divider.style.display = open ? "none" : "";
                    body.style.display = open ? "none" : "";
                }
            });
        });
    }

    function getTermsMaster(card) {
        return card.querySelector(".terms-card__header .check-basic__input");
    }

    function getTermsChildren(card) {
        return toArray(card.querySelectorAll(".terms-card__list .check-basic__input"));
    }

    function syncTermsMaster(card) {
        var master = getTermsMaster(card);
        var children = getTermsChildren(card);
        if (!master || !children.length) return;
        var checkedCount = children.filter(function (c) {
            return c.checked;
        }).length;
        var indeterminate = checkedCount > 0 && checkedCount < children.length;
        master.checked = checkedCount === children.length;
        master.indeterminate = indeterminate;
        master.classList.toggle("is-indeterminate", indeterminate);
    }

    function bindTermsSelectAll() {
        eachUnbound(".terms-card", "termsAll", function (card) {
            var master = getTermsMaster(card);
            if (!master || !card.querySelector(".terms-card__list")) return;
            if (!getTermsChildren(card).length) return;

            master.addEventListener("change", function () {
                master.indeterminate = false;
                master.classList.remove("is-indeterminate");
                getTermsChildren(card).forEach(function (c) {
                    c.checked = master.checked;
                });
            });

            syncTermsMaster(card);
        });

        // 하위 체크박스는 따로 연결 (나중에 추가된 항목도 전체 동의 상태에 반영)
        eachUnbound(".terms-card__list .check-basic__input", "termsChild", function (input) {
            var card = input.closest(".terms-card");
            if (!card || !getTermsMaster(card)) return;
            input.addEventListener("change", function () {
                syncTermsMaster(card);
            });
        });
    }

    function bindTermsAccordionCheck() {
        eachUnbound(".terms-link", "termsLink", function (link) {
            var panel = link.nextElementSibling;
            if (!panel || !panel.classList.contains("terms-accordion")) return;
            var input = link.querySelector(".terms-link__check .check-basic__input");
            if (!input) return;

            input.setAttribute("aria-controls", ensureId(panel, "terms-accordion"));
            hiddenToDisplayNone(panel);

            function sync(animate) {
                var open = input.checked;
                setExpanded(input, open);
                if (animate && window.jQuery) {
                    jQuery(panel).stop(true, true)[open ? "slideDown" : "slideUp"]("fast");
                } else {
                    panel.style.display = open ? "" : "none";
                }
            }

            input.addEventListener("change", function () {
                sync(true);
            });

            sync(false);
        });
    }

    // ---------------------------------------------------------------
    // 4-3. 탭: [role="tablist"] 안의 [role="tab"] (클릭·방향키·Home/End, aria-controls 패널 표시)
    //   - 2026-09 is-active 클래스 컨벤션으로 통일 (tab-line/tab-chip/tab-bar/tab-text 공통)
    // ---------------------------------------------------------------
    var TAB_ACTIVE_CLASS = "is-active";

    function getTabs(tab) {
        var tablist = tab.closest('[role="tablist"]');
        return tablist ? toArray(tablist.querySelectorAll('[role="tab"]')) : [tab];
    }

    function activateTab(tab, moveFocus) {
        getTabs(tab).forEach(function (t) {
            var selected = t === tab;
            t.setAttribute("aria-selected", selected ? "true" : "false");
            t.setAttribute("tabindex", selected ? "0" : "-1");
            t.classList.toggle(TAB_ACTIVE_CLASS, selected);
            var panelId = t.getAttribute("aria-controls");
            var panel = panelId ? document.getElementById(panelId) : null;
            if (panel) panel.hidden = !selected;
        });
        if (moveFocus) tab.focus();
    }

    function bindTabs() {
        // data-tabs="custom" 탭 목록은 화면 컴포넌트(예: 4-11 자산 히어로)가 직접 처리하므로 건너뜀
        eachUnbound('[role="tablist"]:not([data-tabs="custom"]) [role="tab"]', "tab", function (tab) {
            // 레거시(nhasset-ui-myd-mb.js) 탭 핸들러 제거
            if (typeof window.changeTabs === "function") tab.removeEventListener("click", window.changeTabs);

            tab.addEventListener("click", function () {
                activateTab(tab, false);
            });

            tab.addEventListener("keydown", function (e) {
                var tabs = getTabs(tab);
                var i = tabs.indexOf(tab);
                var targetIndex = null;
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    targetIndex = (i + 1) % tabs.length;
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    targetIndex = (i - 1 + tabs.length) % tabs.length;
                } else if (e.key === "Home") {
                    targetIndex = 0;
                } else if (e.key === "End") {
                    targetIndex = tabs.length - 1;
                } else {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                activateTab(tabs[targetIndex], true);
            });
        });
    }

    // 레거시 탭 스크립트가 약 1초 뒤 aria-selected를 지우는 문제 보정 (*--active 클래스가 있는 탭은 선택 상태로 되돌림)
    function initLegacyAriaSelectedFix() {
        function restoreActiveAriaSelected() {
            toArray(document.querySelectorAll("[role='tab'][class*='--active']")).forEach(function (tab) {
                tab.setAttribute("aria-selected", "true");
            });
        }

        window.setTimeout(restoreActiveAriaSelected, 1050);

        document.addEventListener(
            "click",
            function (e) {
                var tab = e.target.closest && e.target.closest("[role='tab']");
                if (tab) window.setTimeout(restoreActiveAriaSelected, 1050);
            },
            true,
        );
    }

    // ---------------------------------------------------------------
    // 4-4. 칩
    //   - 칩 아코디언: .chip-accordion__toggle → .chip-accordion.is-open
    //   - 단일 선택 칩: 같은 부모 안의 .chip-single 중 하나만 .is-active
    //   - 고정 칩 앵커: .chips.is-sticky 칩 ↔ .inst-list__group 스크롤 이동·현재 위치 표시
    // ---------------------------------------------------------------
    function bindChipAccordion() {
        eachUnbound(".chip-accordion__toggle", "chipAcc", function (btn) {
            var wrap = btn.closest(".chip-accordion");
            if (!wrap) return;

            var chips = wrap.querySelector(".chip-accordion__chips");
            if (chips) btn.setAttribute("aria-controls", ensureId(chips, "chip-list"));

            btn.addEventListener("click", function () {
                var open = wrap.classList.toggle("is-open");
                setExpanded(btn, open);
                btn.setAttribute("aria-label", open ? "접기" : "펼치기");
            });
        });
    }

    function bindChipSingle() {
        eachUnbound(".chip-single", "chipSingle", function (chip) {
            chip.addEventListener("click", function () {
                var parent = chip.parentElement;
                if (!parent) return;
                var group = toArray(parent.children).filter(function (el) {
                    return el.classList.contains("chip-single");
                });
                selectOne(group, chip, "is-active", "aria-pressed");
            });
        });
    }

    function bindChipAnchorScroll() {
        eachUnbound(".chips.is-sticky", "chipAnchor", function (chipsEl) {
            var chips = toArray(chipsEl.querySelectorAll(".chip-single"));
            var scope = chipsEl.parentElement;
            if (!scope) return;
            var groups = toArray(scope.querySelectorAll(".inst-list__group"));
            if (!chips.length || !groups.length || chips.length !== groups.length) return;

            function headerOffset() {
                var header = document.querySelector(".header");
                var headerH = header ? header.getBoundingClientRect().height : 0;
                return headerH + chipsEl.getBoundingClientRect().height;
            }

            chips.forEach(function (chip, i) {
                chip.addEventListener("click", function () {
                    var top = groups[i].getBoundingClientRect().top + window.pageYOffset - headerOffset() - 8;
                    window.scrollTo({ top: top, behavior: "smooth" });
                    chip.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
                });
            });

            var lastActive = 0;
            var ticking = false;
            function updateActiveByScroll() {
                ticking = false;
                var threshold = headerOffset() + 16;
                var current = 0;
                groups.forEach(function (g, i) {
                    if (g.getBoundingClientRect().top - threshold <= 0) current = i;
                });
                if (current !== lastActive) {
                    lastActive = current;
                    selectOne(chips, chips[current], "is-active", "aria-pressed");
                    chips[current].scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
                }
            }
            window.addEventListener(
                "scroll",
                function () {
                    if (ticking) return;
                    ticking = true;
                    window.requestAnimationFrame(updateActiveByScroll);
                },
                { passive: true },
            );
        });
    }

    // ---------------------------------------------------------------
    // 4-5. 자산 막대 범례: .asset-bar-trigger ↔ .asset-bar-legend (한 번에 하나만, 바깥 클릭·Esc로 닫기)
    // ---------------------------------------------------------------
    function bindAssetBarLegend() {
        eachUnbound(".asset-bar-wrap", "assetBar", function (wrap) {
            var trigger = wrap.querySelector(".asset-bar-trigger");
            var legend = wrap.querySelector(".asset-bar-legend");
            var closeBtn = legend ? legend.querySelector(".asset-bar-legend__close") : null;
            if (!trigger || !legend) return;

            function close(moveFocus) {
                legend.hidden = true;
                setExpanded(trigger, false);
                if (moveFocus) trigger.focus();
            }

            function open() {
                toArray(document.querySelectorAll(".asset-bar-legend")).forEach(function (other) {
                    if (other !== legend) other.hidden = true;
                });
                toArray(document.querySelectorAll(".asset-bar-trigger")).forEach(function (other) {
                    if (other !== trigger) setExpanded(other, false);
                });
                legend.hidden = false;
                setExpanded(trigger, true);
            }

            trigger.addEventListener("click", function () {
                if (legend.hidden) open();
                else close(false);
            });

            if (closeBtn) {
                closeBtn.addEventListener("click", function () {
                    close(true);
                });
            }

            document.addEventListener("click", function (e) {
                if (legend.hidden || wrap.contains(e.target)) return;
                close(false);
            });

            legend.addEventListener("keydown", function (e) {
                if (e.key === "Escape") close(true);
            });
        });
    }

    // ---------------------------------------------------------------
    // 4-6. 하단 고정 영역(.sticky-footer) 높이만큼 본문 아래 여백 확보 (--sticky-footer-pad)
    // ---------------------------------------------------------------
    function bindStickyFooter() {
        eachUnbound(".sticky-footer", "stickyFooter", function (footer) {
            var pop = footer.closest(".popWrap");
            var container = pop ? pop.querySelector(".popCont") : document.querySelector(".container");
            if (!container) return;

            container.classList.add("js-has-sticky-footer");

            function sync() {
                container.style.setProperty("--sticky-footer-pad", footer.offsetHeight + "px");
            }
            sync();

            if (window.ResizeObserver) {
                new ResizeObserver(sync).observe(footer);
            } else {
                window.addEventListener("resize", sync);
            }

            toArray(footer.querySelectorAll("[data-acc-toggle]")).forEach(function (btn) {
                btn.addEventListener("click", function () {
                    setTimeout(sync, 250);
                });
            });
        });
    }

    // ---------------------------------------------------------------
    // 4-7. 거래내역 미리보기 블러(.txn-preview) 마스킹
    //   기존에는 .nds .txn-preview:has(.switch__input:not(:checked)) 로만 처리되어
    //   :has() 미지원 브라우저에서는 스위치를 꺼도 금액이 그대로 노출되는 문제가 있었음.
    //   스위치 상태를 JS로 직접 반영해 모든 브라우저에서 동일하게 동작하도록 보강.
    // ---------------------------------------------------------------
    function bindTxnPreviewMask() {
        eachUnbound(".txn-preview", "txnPreview", function (wrap) {
            var input = wrap.querySelector(".txn-preview__switch .switch__input");
            if (!input) return;

            function sync() {
                wrap.classList.toggle("is-masked", !input.checked);
            }
            sync();
            input.addEventListener("change", sync);
        });
    }

    // ---------------------------------------------------------------
    // 4-8. :has() 미지원 브라우저(iOS 15.0~15.3 등) 대응
    //   네이티브 :has()가 있으면 CSS가 이미 처리하므로 아무 것도 하지 않고,
    //   없을 때만 동일한 조건을 jQuery로 재현해 대체 클래스를 붙인다. (요소가 추가될 때마다 다시 계산)
    // ---------------------------------------------------------------
    function syncFixedCtaSpacingFallback() {
        if (supportsHasSelector()) return;

        $(".container").each(function () {
            var $c = $(this);
            var hasCta = $c.find(".areaBtnDefault").length > 0 || $c.next(".areaBtnDefault").length > 0;
            $c.toggleClass("js-no-fixed-cta", !hasCta);
            $c.toggleClass("js-has-onboard", $c.children(".onboard").length > 0);
        });

        $(".accordion-notice").each(function () {
            var $notice = $(this);
            var hasCtaAfter = $notice.nextAll(".areaBtnDefault").length > 0 || $notice.nextAll(".btn-cta.is-fixed").length > 0;
            $notice.toggleClass("js-has-cta-after", hasCtaAfter);
        });

        $(".popWrap.fullLayerPop .popInner").each(function () {
            var $inner = $(this);
            $inner.toggleClass("js-has-areaBtnDefault", $inner.find(".popBtnWrap .areaBtnDefault").length > 0);
            $inner.toggleClass("js-has-bgcolor-inner", $inner.find(".popCont__inner.bgcolor").length > 0);
        });

        $(".popCont").each(function () {
            var $cont = $(this);
            $cont.toggleClass("js-has-accordion-notice", $cont.find(".accordion-notice").length > 0);
        });
    }

    // ---------------------------------------------------------------
    // 4-9. 숫자 인디케이터 캐러셀: [data-number-carousel="loop" | "rewind"]
    //   - Swiper 컨테이너에 붙임. 안쪽 .indicator-number 의 현재 번호·이전·다음·일시정지/재생을 연결
    //   - loop  : 무한 루프 (끝에서 처음으로 이어짐)
    //   - rewind: 루프 없이 끝에서 처음으로 되감기. 숨겨진 탭 안에 있어도 탭이 열릴 때 크기를 다시 계산
    //   - 4초마다 자동 넘김
    //   - 현재 번호는 Swiper activeIndex 대신 .swiper-slide-active 의 data-swiper-slide-index 로 계산
    //     (루프 모드에서도 원본 순서가 그대로 보존되어 가장 정확함)
    // ---------------------------------------------------------------
    function bindNumberCarousel() {
        if (typeof Swiper === "undefined") return;
        eachUnbound("[data-number-carousel]", "numberCarousel", function (track) {
            var indicatorEl = track.querySelector(".indicator-number");
            var currentEl = indicatorEl ? indicatorEl.querySelector(".indicator-number__current") : null;
            var prevBtn = indicatorEl ? indicatorEl.querySelector('.indicator-number__arrow[aria-label="이전"]') : null;
            var nextBtn = indicatorEl ? indicatorEl.querySelector('.indicator-number__arrow[aria-label="다음"]') : null;
            var pauseBtn = indicatorEl ? indicatorEl.querySelector(".indicator-number__control") : null;

            function syncIndicator() {
                if (!currentEl) return;
                var activeSlide = track.querySelector(".swiper-slide-active");
                if (!activeSlide) return;
                var dataIdx = activeSlide.getAttribute("data-swiper-slide-index");
                var idx = dataIdx !== null ? parseInt(dataIdx, 10) : -1;
                if (isNaN(idx) || idx < 0) {
                    idx = toArray(track.querySelectorAll(".swiper-wrapper > .swiper-slide:not(.swiper-slide-duplicate)")).indexOf(activeSlide);
                }
                if (idx > -1) currentEl.textContent = idx + 1;
            }

            var options = {
                slidesPerView: 1,
                spaceBetween: 0,
                a11y: false,
                autoplay: { delay: 4000, disableOnInteraction: false },
                on: {
                    init: syncIndicator,
                    slideChange: syncIndicator,
                    slideChangeTransitionEnd: syncIndicator,
                },
            };
            if (track.getAttribute("data-number-carousel") === "loop") {
                options.loop = true;
            } else {
                options.loop = false;
                options.rewind = true;
                options.observer = true;
                options.observeParents = true;
            }

            var swiper = new Swiper(track, options);

            // 클릭 직후 바로 한 번 더 동기화 (slideChange는 전환 애니메이션에 묶여 있어 빠르게 여러 번 누르면 번호가 늦게 따라옴)
            if (prevBtn) {
                prevBtn.addEventListener("click", function () {
                    swiper.slidePrev();
                    syncIndicator();
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener("click", function () {
                    swiper.slideNext();
                    syncIndicator();
                });
            }
            if (pauseBtn) {
                pauseBtn.addEventListener("click", function () {
                    if (pauseBtn.getAttribute("aria-label") === "재생") {
                        swiper.autoplay.start();
                        pauseBtn.setAttribute("aria-label", "일시정지");
                    } else {
                        swiper.autoplay.stop();
                        pauseBtn.setAttribute("aria-label", "재생");
                    }
                });
            }
        });
    }

    // ---------------------------------------------------------------
    // 4-10. 선택 바텀시트: 버튼을 누르면 바텀시트 목록이 열리고, 항목을 고르면 버튼 글자를 바꾸고 닫힘
    //   - 버튼: data-select-sheet="시트 id"  (aria-haspopup="dialog" aria-expanded="false" 권장)
    //   - 버튼 안 글자 영역: data-select-sheet-text
    //   - 시트: .popWrap.slidePopConfirm (id 지정), 목록은 .bottomsheet-list > .bottomsheet-list__item
    //   - 한 화면에 시트가 여러 개여도 지정한 시트만 열림
    //   - 선택 표시(is-selected·aria-pressed)는 2-4, 닫을 때 포커스 복귀·딤 닫기는 2-2·2-3에서 처리
    // ---------------------------------------------------------------
    function initSelectSheet() {
        document.addEventListener("click", function (e) {
            if (!e.target.closest) return;

            var trigger = e.target.closest("[data-select-sheet]");
            if (trigger) {
                if (typeof window.slidePopConfirm === "function") window.slidePopConfirm(trigger.getAttribute("data-select-sheet"));
                return;
            }

            var item = e.target.closest(".bottomsheet-list__item");
            var sheet = item && item.closest(".popWrap[id]");
            if (!sheet) return;
            var triggers = toArray(document.querySelectorAll('[data-select-sheet="' + sheet.id + '"]'));
            if (!triggers.length) return;

            var label = item.textContent.trim();
            triggers.forEach(function (btn) {
                var textEl = btn.querySelector("[data-select-sheet-text]");
                if (textEl) textEl.textContent = label;
            });
            var closeBtn = sheet.querySelector(".popClose");
            if (closeBtn && typeof window.popClose === "function") window.popClose(closeBtn);
        });
    }

    // ---------------------------------------------------------------
    // 4-11. 자산 히어로 카드 (NH_MD_01~04 상단 카드 캐러셀)
    //   - Swiper 컨테이너에 붙임
    //       data-asset-hero="liquidity,invest,pension,loan"  (탭 순서대로 카테고리 키 → 아래 .asset-tab-panel[data-tab-panel] 표시, 차트 재생)
    //       data-asset-hero-tabs="탭 목록 id"                (role="tablist", 공통 탭(4-3)이 건너뛰도록 data-tabs="custom" 지정)
    //       data-asset-hero-announce="안내 문구 id"          (aria-live 영역, 카테고리 이동 시 읽어줌)
    //   - 탭 ↔ 슬라이드 연동, 보이지 않는 슬라이드 aria-hidden, 카드 높이 맞춤
    //   - 카드 뒤집기: .hero__flip 안의 [data-flip-toggle]
    //   - 날짜 새로고침: [data-refresh-date] (아이콘 회전 + 누적 막대 재생)
    // ---------------------------------------------------------------
    function bindHeroFlip(container) {
        var turningFlips = [];

        function setFaceState(flipEl, flipped) {
            var front = flipEl.querySelector(".hero__face.is-front");
            var back = flipEl.querySelector(".hero__face.is-back");
            flipEl.classList.toggle("is-flipped", flipped);
            front.setAttribute("aria-hidden", flipped ? "true" : "false");
            back.setAttribute("aria-hidden", flipped ? "false" : "true");
            toArray(flipEl.querySelectorAll("[data-flip-toggle]")).forEach(function (btn) {
                var onVisibleFace = flipped ? back.contains(btn) : front.contains(btn);
                btn.setAttribute("aria-pressed", flipped ? "true" : "false");
                btn.tabIndex = onVisibleFace ? 0 : -1;
            });
        }

        // 같은 카테고리의 복제 슬라이드도 같은 면으로 맞춤
        function syncSiblingSlides(flipEl, flipped) {
            var slideEl = flipEl.closest(".swiper-slide");
            if (!slideEl) return;
            var label = slideEl.getAttribute("data-category-label");
            if (!label) return;
            toArray(container.querySelectorAll('.swiper-slide[data-category-label="' + label + '"]')).forEach(function (otherSlideEl) {
                if (otherSlideEl === slideEl) return;
                var otherFlip = otherSlideEl.querySelector(".hero__flip");
                if (otherFlip) setFaceState(otherFlip, flipped);
            });
        }

        function setFlipped(flipEl, flipped) {
            var front = flipEl.querySelector(".hero__face.is-front");
            var back = flipEl.querySelector(".hero__face.is-back");
            var hidingEl = flipped ? front : back;
            var showingEl = flipped ? back : front;
            var focusWasInsideHidingEl = hidingEl.contains(document.activeElement);
            if (focusWasInsideHidingEl) document.activeElement.blur();
            setFaceState(flipEl, flipped);
            if (focusWasInsideHidingEl) {
                var newToggle = showingEl.querySelector("[data-flip-toggle]");
                if (newToggle) newToggle.focus();
            }
            syncSiblingSlides(flipEl, flipped);
        }

        function playFlip(flipEl) {
            if (turningFlips.indexOf(flipEl) !== -1) return;
            turningFlips.push(flipEl);

            var nextFlipped = !flipEl.classList.contains("is-flipped");
            flipEl.classList.add("is-turning");
            window.setTimeout(function () {
                setFlipped(flipEl, nextFlipped);
                flipEl.classList.remove("is-turning");
                window.setTimeout(function () {
                    turningFlips.splice(turningFlips.indexOf(flipEl), 1);
                }, 220);
            }, 220);
        }

        container.addEventListener("click", function (e) {
            if (!e.target.closest) return;

            var toggleBtn = e.target.closest("[data-flip-toggle]");
            var flipEl = toggleBtn && toggleBtn.closest(".hero__flip");
            if (flipEl) {
                playFlip(flipEl);
                return;
            }

            var refreshBtn = e.target.closest("[data-refresh-date]");
            if (!refreshBtn) return;
            var heroFlip = refreshBtn.closest(".hero__flip");
            var canvas = heroFlip && heroFlip.querySelector("[data-chart-canvas]");
            var categoryKey = canvas && canvas.getAttribute("data-chart-canvas");
            if (categoryKey && typeof window.replayHeroBarChart === "function") window.replayHeroBarChart(categoryKey);

            refreshBtn.classList.remove("is-refreshing");
            void refreshBtn.offsetWidth;
            refreshBtn.classList.add("is-refreshing");
        });

        container.addEventListener("animationend", function (e) {
            if (e.target && e.target.classList && e.target.classList.contains("hc-date__icon")) {
                e.target.classList.remove("is-refreshing");
            }
        });
    }

    // 카드 앞·뒷면 중 더 높은 면에 맞춰 캐러셀 높이와 옆 카드 축소 비율(--hero-peek-scale-y)을 계산
    function syncHeroCardHeight(swiperEl, swiper) {
        var realSlides = toArray(swiperEl.querySelectorAll(".swiper-slide:not(.swiper-slide-duplicate)"));
        if (!realSlides.length) return;
        swiperEl.style.height = "auto";
        var maxHeight = 0;
        realSlides.forEach(function (slideEl) {
            var heroEl = slideEl.querySelector(".hero");
            var flipEl = slideEl.querySelector(".hero__flip");
            var slideH = slideEl.scrollHeight;
            if (heroEl && flipEl) {
                var faces = flipEl.querySelectorAll(".hero__face");
                var flipPrevH = flipEl.style.height;
                flipEl.style.height = "auto";
                var need = 0;
                for (var i = 0; i < faces.length; i++) {
                    var saved = [];
                    for (var j = 0; j < faces.length; j++) {
                        saved.push(faces[j].style.display);
                        if (j !== i) faces[j].style.display = "none";
                    }
                    need = Math.max(need, faces[i].offsetHeight);
                    for (var k = 0; k < faces.length; k++) faces[k].style.display = saved[k];
                }
                flipEl.style.height = flipPrevH;
                var heroCS = window.getComputedStyle(heroEl);
                slideH = need + (parseFloat(heroCS.marginTop) || 0) + (parseFloat(heroCS.marginBottom) || 0);
            }
            maxHeight = Math.max(maxHeight, slideH);
        });
        if (maxHeight) {
            swiperEl.style.height = maxHeight + "px";
            var peekShrinkPx = 84;
            var cardHeight = maxHeight - 24;
            var peekScaleY = cardHeight > peekShrinkPx ? (cardHeight - peekShrinkPx) / cardHeight : 0.8;
            swiperEl.style.setProperty("--hero-peek-scale-y", peekScaleY.toFixed(4));
        }
        if (swiper && !swiper.destroyed && typeof swiper.update === "function") swiper.update();
    }

    function bindAssetHero() {
        eachUnbound("[data-asset-hero]", "assetHero", function (swiperEl) {
            bindHeroFlip(swiperEl);

            var tablist = document.getElementById(swiperEl.getAttribute("data-asset-hero-tabs"));
            var announceEl = document.getElementById(swiperEl.getAttribute("data-asset-hero-announce"));
            if (!tablist || typeof Swiper === "undefined") return;

            var tabs = toArray(tablist.querySelectorAll('[role="tab"]'));
            if (!tabs.length) return;

            var categoryKeys = swiperEl.getAttribute("data-asset-hero").split(",");
            var assetPanels = toArray(document.querySelectorAll(".asset-tab-panel"));
            var lastReplayedRealIndex = null;
            var swiper = null;

            var initialTabIndex = 0;
            tabs.forEach(function (t, i) {
                if (t.classList.contains("is-active") || t.getAttribute("aria-selected") === "true") initialTabIndex = i;
            });

            function updateAssetTabPanels(categoryKey) {
                var target = categoryKey || "generic";
                assetPanels.forEach(function (panel) {
                    panel.hidden = panel.getAttribute("data-tab-panel") !== target;
                });
            }

            function setActiveTab(index) {
                tabs.forEach(function (t, i) {
                    var selected = i === index;
                    t.setAttribute("aria-selected", selected ? "true" : "false");
                    t.setAttribute("tabindex", selected ? "0" : "-1");
                    t.classList.toggle(TAB_ACTIVE_CLASS, selected);
                });
                updateAssetTabPanels(categoryKeys[index]);
            }

            function syncSlideVisibility(sw) {
                sw.slides.forEach(function (slideEl) {
                    var isActive = slideEl.classList.contains("swiper-slide-active");
                    if (!isActive && slideEl.contains(document.activeElement)) document.activeElement.blur();
                    slideEl.setAttribute("aria-hidden", isActive ? "false" : "true");
                });
            }

            function syncCardHeight() {
                syncHeroCardHeight(swiperEl, swiper);
            }

            tabs.forEach(function (tab, i) {
                // 레거시(nhasset-ui-myd-mb.js) 탭 핸들러 제거 (.mbTabs 밖이라 그대로 두면 클릭 시 에러)
                if (typeof window.changeTabs === "function") tab.removeEventListener("click", window.changeTabs);

                tab.addEventListener("click", function () {
                    if (swiper) swiper.slideToLoop(i);
                });
                tab.addEventListener("keydown", function (e) {
                    var targetIndex = null;
                    if (e.key === "ArrowRight") targetIndex = Math.min(i + 1, tabs.length - 1);
                    else if (e.key === "ArrowLeft") targetIndex = Math.max(i - 1, 0);
                    else if (e.key === "Home") targetIndex = 0;
                    else if (e.key === "End") targetIndex = tabs.length - 1;
                    else return;
                    e.preventDefault();
                    e.stopPropagation(); // 레거시 tablist 방향키 처리(포커스 순환)가 같이 실행되지 않도록
                    if (swiper) swiper.slideToLoop(targetIndex);
                    tabs[targetIndex].focus();
                });
            });

            swiper = new Swiper(swiperEl, {
                slidesPerView: 1.08,
                spaceBetween: 12,
                centeredSlides: true,
                initialSlide: initialTabIndex,
                loop: false,
                a11y: false,
                on: {
                    // init은 new Swiper() 안에서 실행됨 → 이 시점의 swiper 변수는 아직 비어 있음 (카드 높이 계산 후 swiper.update() 생략)
                    init: function () {
                        setActiveTab(this.realIndex);
                        syncSlideVisibility(this);
                        syncCardHeight();
                    },
                    slideChange: function () {
                        setActiveTab(this.realIndex);
                        syncSlideVisibility(this);
                        syncCardHeight();
                        if (announceEl) {
                            var current = this.slides[this.activeIndex];
                            var label = current ? current.getAttribute("data-category-label") : "";
                            if (label) announceEl.textContent = label + " 카테고리로 이동했습니다.";
                        }
                        if (this.realIndex !== lastReplayedRealIndex) {
                            lastReplayedRealIndex = this.realIndex;
                            if (typeof window.replayHeroBarChart === "function") window.replayHeroBarChart(categoryKeys[this.realIndex]);
                        }
                    },
                },
            });

            var slideClassObserver = new MutationObserver(function () {
                syncSlideVisibility(swiper);
            });
            toArray(swiperEl.querySelectorAll(".swiper-slide")).forEach(function (slideEl) {
                slideClassObserver.observe(slideEl, { attributes: true, attributeFilter: ["class"] });
            });

            if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
                document.fonts.ready.then(syncCardHeight);
            }
            var resizeSyncTimer = null;
            window.addEventListener("resize", function () {
                window.clearTimeout(resizeSyncTimer);
                resizeSyncTimer = window.setTimeout(syncCardHeight, 150);
            });
            window.addEventListener("load", syncCardHeight);
        });
    }

    // ---------------------------------------------------------------
    // 4-12. 필수 동의 → 버튼 활성화
    //   - 필수 체크박스: data-agree-required="그룹명"
    //   - 버튼: data-agree-button="그룹명"  (같은 그룹의 필수 체크박스가 모두 체크돼야 활성화)
    //   - a 태그는 disabled 속성이 없으므로 .disabled 클래스 + aria-disabled 로 상태를 표시하고, 비활성 상태에서는 클릭 동작을 막음
    //   - 전체 동의(4-2)로 한꺼번에 바뀐 경우도 반영 (문서에서 change를 받아 전체 동의 처리 뒤에 계산)
    // ---------------------------------------------------------------
    function syncAgreeButtons() {
        toArray(document.querySelectorAll("[data-agree-button]")).forEach(function (btn) {
            var group = btn.getAttribute("data-agree-button");
            var required = toArray(document.querySelectorAll('[data-agree-required="' + group + '"]'));
            var enabled =
                required.length > 0 &&
                required.every(function (c) {
                    return c.checked;
                });
            btn.classList.toggle("disabled", !enabled);
            if (enabled) btn.removeAttribute("aria-disabled");
            else btn.setAttribute("aria-disabled", "true");
        });
    }

    function initAgreeButtons() {
        document.addEventListener("change", function (e) {
            if (e.target && e.target.type === "checkbox" && document.querySelector("[data-agree-button]")) syncAgreeButtons();
        });
        document.addEventListener("click", function (e) {
            var btn = e.target.closest && e.target.closest("[data-agree-button]");
            if (btn && btn.classList.contains("disabled")) e.preventDefault();
        });
    }

    function bindAgreeButtons() {
        var hasNew = false;
        eachUnbound("[data-agree-button]", "agreeButton", function () {
            hasNew = true;
        });
        if (hasNew) syncAgreeButtons();
    }

    // ===============================================================
    // 5. 차트 (Chart.js 없이 그린 nc-* 차트)
    //    계산 로직 없음: 누적 막대 애니메이션 재생, 비교 막대 툴팁, 등장 애니메이션 대기만 담당
    //    .nds 화면에서만 동작
    //      - registerChartGlobals() : activate() 시점 (페이지 스크립트보다 먼저 전역 함수가 있어야 함)
    //      - initChart()            : runFeatureInit() 시점 (DOM 준비 후, 차트가 없는 화면은 아무것도 등록하지 않음)
    //    ※ update/nochart.js 보관본과 같은 내용으로 유지
    // ===============================================================

    /* Chart 스크립트 start */

    // 누적 막대 애니메이션 재생 (기존 window.replayHeroBarChart와 같은 이름 유지 → 페이지 스크립트 수정 불필요)
    // Chart.js 화면(*_chart.html)은 페이지 스크립트가 같은 이름으로 다시 정의해 덮어씀
    function registerChartGlobals() {
        window.replayHeroBarChart = function (key) {
            toArray(document.querySelectorAll('.nc-stack[data-chart-canvas="' + key + '"]')).forEach(function (el) {
                el.classList.remove("is-play");
                void el.offsetWidth;
                el.classList.add("is-play");
            });
        };
    }

    function hideChartTooltips(except) {
        toArray(document.querySelectorAll(".nc-cmp-tooltip")).forEach(function (t) {
            if (t !== except) {
                t.style.opacity = 0;
                t.innerHTML = "";
            }
        });
    }

    // 툴팁은 처음부터 만들어 두고 role="status"로 지정 → 내용이 바뀔 때 화면 낭독기가 읽어줌
    function getChartTooltip(wrap) {
        var tip = wrap.querySelector(".nc-cmp-tooltip");
        if (!tip) {
            tip = document.createElement("div");
            tip.className = "chartjs-tooltip nc-cmp-tooltip";
            tip.setAttribute("role", "status");
            tip.setAttribute("aria-live", "polite");
            wrap.appendChild(tip);
        }
        return tip;
    }

    // 비교 막대 툴팁: 행(data-diff)에 미리 넣어둔 증감 금액을 표시. 위치·화면 가장자리 보정은 기존 Chart.js 툴팁과 동일
    function onChartClick(e) {
        // 왼쪽 라벨을 눌러도 같은 줄의 막대를 선택한 것으로 처리 (터치 영역 확대)
        var labelEl = e.target.closest && e.target.closest(".nc-cmp__labels span");
        if (labelEl) {
            var idx = Array.prototype.indexOf.call(labelEl.parentNode.children, labelEl);
            var target = labelEl.closest(".nc-cmp").querySelectorAll(".nc-cmp__row")[idx];
            if (target) target.click();
            return;
        }
        var row = e.target.closest && e.target.closest(".nc-cmp__row");
        if (!row) {
            hideChartTooltips(null);
            return;
        }
        var wrap = row.closest(".nc-cmp").parentNode;
        var tip = getChartTooltip(wrap);
        var bar = (e.target.closest && e.target.closest(".nc-cmp__bar")) || row.querySelector(".nc-cmp__bar.is-now");
        // 화면 낭독기에는 '항목명 증감액 +금액'으로 읽힘 (화면에는 금액만 표시)
        tip.innerHTML = '<div class="chartjs-tooltip__row"><span class="nc-sr">' + row.getAttribute("data-label") + " 증감액 </span>" + row.getAttribute("data-diff") + "</div>";

        var wr = wrap.getBoundingClientRect();
        var br = bar.getBoundingClientRect();
        var x = (bar.classList.contains("is-prev") ? br.left : br.right) - wr.left;
        var y = br.top + br.height / 2 - wr.top;
        tip.style.opacity = 1;
        tip.style.left = x + "px";
        tip.style.top = y - 10 + "px";
        tip.style.transform = "translate(-50%, -100%)";
        tip.style.removeProperty("--tt-arrow-left");

        var edge = 8;
        var rect = tip.getBoundingClientRect();
        var shift = 0;
        if (rect.left < edge) shift = edge - rect.left;
        else if (rect.right > window.innerWidth - edge) shift = window.innerWidth - edge - rect.right;
        if (shift !== 0) {
            tip.style.transform = "translate(calc(-50% + " + shift + "px), -100%)";
            tip.style.setProperty("--tt-arrow-left", "calc(50% - " + shift + "px)");
        }
        hideChartTooltips(tip);
    }

    // 화면 낭독기에서 숨겨진(aria-hidden) 슬라이드·카드 면 안의 버튼은 Tab으로 이동하지 않도록 처리
    function syncChartRowFocus() {
        toArray(document.querySelectorAll(".nc-cmp__row")).forEach(function (row) {
            row.tabIndex = row.closest('[aria-hidden="true"]') ? -1 : 0;
        });
    }

    function initChart() {
        if (!document.querySelector(".nc-stack, .nc-donut, .nc-line, .nc-cmp")) return;

        // 비교 막대: 툴팁 준비, 클릭·Esc, 숨겨진 버튼 포커스 제외
        if (document.querySelector(".nc-cmp")) {
            toArray(document.querySelectorAll(".nc-cmp")).forEach(function (chart) {
                getChartTooltip(chart.parentNode);
            });
            document.addEventListener("click", onChartClick);
            // Esc 키로 툴팁 닫기
            document.addEventListener("keydown", function (e) {
                if (e.key === "Escape" || e.key === "Esc") hideChartTooltips(null);
            });
            syncChartRowFocus();
            if ("MutationObserver" in window) {
                new MutationObserver(syncChartRowFocus).observe(document.body, { attributes: true, attributeFilter: ["aria-hidden"], subtree: true });
            }
        }

        // 등장 애니메이션은 차트가 화면에 보일 때 시작 (스크롤해야 보이는 차트가 화면 밖에서 애니메이션을 끝내지 않도록)
        var targets = document.querySelectorAll(".nc-donut, .nc-plot, .predict-chart__box .nc-line, .nc-cmp");
        if (!targets.length || !("IntersectionObserver" in window)) return;
        var io = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.remove("nc-wait");
                    io.unobserve(entry.target);
                });
            },
            { threshold: 0.3 },
        );
        toArray(targets).forEach(function (el) {
            el.classList.add("nc-wait");
            io.observe(el);
        });
    }

    /* Chart 스크립트 end */

    // ===============================================================
    // 6. 실행
    // ===============================================================

    // 요소 단위 연결 (처음 1회 + 요소가 추가될 때마다). 이미 연결된 요소는 건너뜀
    function bindComponents() {
        bindAccordion();
        bindTermsToggle();
        bindTermsSelectAll();
        bindTermsAccordionCheck();
        bindTabs();
        bindChipAccordion();
        bindChipSingle();
        bindBottomsheetList();
        bindAssetBarLegend();
        bindChipAnchorScroll();
        bindStickyFooter();
        syncFixedCtaSpacingFallback();
        bindTxnPreviewMask();
        bindNumberCarousel();
        bindAssetHero();
        bindAgreeButtons();
    }

    // 나중에 추가되는 요소(팝업 HTML 삽입, 목록 렌더링 등)도 자동으로 연결
    function watchAddedElements() {
        if (!window.MutationObserver || !document.body) return;
        var scheduled = false;
        var sheetChanged = false;

        new MutationObserver(function (mutations) {
            var added = false;
            for (var i = 0; i < mutations.length; i++) {
                var nodes = mutations[i].addedNodes;
                for (var j = 0; j < nodes.length; j++) {
                    if (nodes[j].nodeType !== 1) continue;
                    added = true;
                    if (nodes[j].closest(".slidePopConfirm") || (nodes[j].querySelector && nodes[j].querySelector(".slidePopConfirm"))) sheetChanged = true;
                }
            }
            if (!added || scheduled) return;
            scheduled = true;
            // 같은 순간에 여러 요소가 추가돼도 한 번만 연결 (페이지 스크립트가 추가 직후 거는 이벤트보다 뒤에 실행)
            setTimeout(function () {
                scheduled = false;
                bindComponents();
                if (sheetChanged) {
                    sheetChanged = false;
                    observeSlidePopConfirmContent();
                }
            }, 0);
        }).observe(document.body, { childList: true, subtree: true });
    }

    // activate() 이후 DOM 준비 시 1회
    function runFeatureInit() {
        bindComponents();
        initLegacyAriaSelectedFix();
        initDimClose();
        initSelectSheet();
        initAgreeButtons();
        observeSlidePopConfirmContent();
        initChart();
        watchAddedElements();

        if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
            document.fonts.ready.then(function () {
                if ($(".slidePopConfirm.nds:visible").length > 0) syncSlidePopConfirmHeight(false);
            });
        }
    }

    // 활성화 게이트: .wrapper.nds / .popWrap.nds 가 있을 때만, 딱 한 번
    function activate() {
        if (activated) return;
        activated = true;

        document.documentElement.classList.add("nds");
        registerLegacyOverrides();
        registerChartGlobals();
        trackPopActivator();
        window.ndsUI = { bind: bindComponents };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", runFeatureInit, { once: true });
        } else {
            runFeatureInit();
        }
    }

    function watchForNds() {
        if (hasNdsRoot()) {
            activate();
            return;
        }

        if (!window.MutationObserver) {
            // 구형 브라우저 폴백: DOMContentLoaded 시점에 한 번 더 확인
            document.addEventListener(
                "DOMContentLoaded",
                function () {
                    if (hasNdsRoot()) activate();
                },
                { once: true },
            );
            return;
        }

        var observer = new MutationObserver(function () {
            if (hasNdsRoot()) {
                observer.disconnect();
                activate();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    watchForNds();
})();
