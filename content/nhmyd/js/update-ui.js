/*
 * [di9] UI Dev Team
 * update/ , sample_update/ 화면(.nds 컴포넌트)에서 공통으로 쓰는 UI 스크립트.
 *   1) .wrapper.nds 또는 .popWrap.nds 가 페이지 어딘가에 없으면, 이 파일은 사실상 아무 것도 하지 않습니다.
 *      (전역 함수 재정의도, 이벤트 바인딩도, init 호출도 전부 지연/생략됩니다.)
 *   2) nds 대상이 처음부터 없다가 나중에(팝업 등으로) 동적으로 추가되는 경우도 MutationObserver로 감지해
 *      그 시점에 한 번만 활성화합니다.
 *   3) 스크립트가 <head>에서 document.write로 주입되어 DOM이 아직 없는 시점에 실행되든,
 *      <body> 뒤쪽에서 실행되어 DOM이 이미 있는 시점이든 동일하게 동작하도록 만들었습니다.
 *      (document.write 전제를 더 이상 하지 않습니다.)
 */

(function () {
    // ---------------------------------------------------------------
    // 활성화 여부 판단
    // ---------------------------------------------------------------
    function isNdsScope($target) {
        if ($target && $target.length) {
            var $popWrap = $target.hasClass("popWrap") ? $target : $target.closest(".popWrap");
            if ($popWrap.length && $popWrap.hasClass("nds")) return true;
        }
        if ($(".wrapper").hasClass("nds")) return true;
        if ($(".popWrap.nds").length > 0) return true;
        return false;
    }

    function supportsHasSelector() {
        try {
            return !!(window.CSS && CSS.supports && CSS.supports("selector(:has(a))"));
        } catch (e) {
            return false;
        }
    }

    function hasNdsRoot() {
        return !!(document.querySelector(".wrapper.nds") || document.querySelector(".popWrap.nds"));
    }

    var activated = false;

    // ---------------------------------------------------------------
    // 레거시 전역 함수 오버라이드 (activate() 이후에만 설치)
    // ---------------------------------------------------------------

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

    function syncSlidePopConfirmHeight(animate) {
        $(".slidePopConfirm:visible").each(function () {
            var $pop = $(this);
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
            if (naturalContH <= maxContH) {
                return;
            }

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

    var slidePopContentObserver = null;
    var slidePopSyncScheduled = false;

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

    function registerLegacyOverrides() {
        var legacyPopClose = window.popClose;

        window.popClose = function (e) {
            var $popWrap = $(e).closest(".popWrap");
            if (!isNdsScope($popWrap)) {
                if (typeof legacyPopClose === "function") legacyPopClose(e);
                return;
            }

            scrollPosY = $("body").css("top");
            var $slidePopInner = $popWrap.find(".popInner");
            var isSlidePop = $popWrap.hasClass("slidePopOption") || $popWrap.hasClass("slidePopConfirm") || $popWrap.hasClass("bankSetWrap");

            $popWrap.find(".dim").fadeOut(100);

            if (isSlidePop) {
                $slidePopInner.animate({ height: 0 }, 150, function () {
                    $popWrap.hide();
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

        var legacyCalendarAlign = window.calendarAlign;

        window.calendarAlign = function () {
            if (!isNdsScope()) {
                if (typeof legacyCalendarAlign === "function") legacyCalendarAlign();
                return;
            }

            $(".yearSet").each(function () {
                if ($(this).hasClass("noneAction")) {
                    $(this).attr("aria-hidden", "true");
                } else {
                    $(this).attr("aria-hidden", "false");
                }
            });

            $(".yearSet > ol").each(function () {
                var $ol = $(this);
                var rowH = $ol.children("li").first().outerHeight();
                if (!rowH) {
                    return;
                }
                var viewH = $ol.outerHeight();
                var padY = Math.max(0, (viewH - rowH) / 2);

                this.style.setProperty("padding", padY + "px 0", "important");
                $ol.data("rowH", rowH);

                var $listIndex = $ol.find("a.active,button.active").attr("title", "선택됨").parent("li").index();
                $ol.scrollTop($listIndex * rowH);
            });

            $(".yearSet ol a,.yearSet ol button").click(function () {
                if ($(".yearSet").hasClass("noneAction")) {
                    return;
                }
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

        var legacyTooltipOpen = window.tooltipOpen;

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

        var legacyTooltipClose = window.tooltipClose;

        window.tooltipClose = function ($obj) {
            $obj.closest(".tooltipCont").removeClass("is-top");
            if (typeof legacyTooltipClose === "function") legacyTooltipClose($obj);
        };

        window.syncSlidePopConfirmHeight = syncSlidePopConfirmHeight;
        window.observeSlidePopConfirmContent = observeSlidePopConfirmContent;

        window.slidePopConfirm = function () {
            scrollLock();
            $(".slidePopConfirm").show();
            setTimeout(function () {
                syncSlidePopConfirmHeight(true);
                observeSlidePopConfirmContent();
            }, 100);
        };

        $(window).on("resize orientationchange", function () {
            syncSlidePopConfirmHeight(false);
            if ($(".fullLayerPop:visible").length > 0 && typeof window.fullLayerHeight === "function") {
                window.fullLayerHeight();
            }
        });

    }

    // ---------------------------------------------------------------
    // .nds 컴포넌트 init 함수들 (activate() 이후, DOM 준비 시 1회 실행)
    // ---------------------------------------------------------------

    var autoIdSeq = 0;
    function ensureId(el, prefix) {
        if (!el.id) {
            autoIdSeq += 1;
            el.id = prefix + "-" + autoIdSeq;
        }
        return el.id;
    }

    function initAccordion() {
        document.querySelectorAll("[data-acc-toggle]").forEach(function (btn) {
            var body = btn.parentElement.querySelector('[class$="__body"], [class$="__list"]');
            if (!body) return;

            btn.setAttribute("aria-controls", ensureId(body, "acc-body"));

            if (body.hasAttribute("hidden")) {
                body.removeAttribute("hidden");
                body.style.display = "none";
            }

            btn.addEventListener("click", function () {
                var open = btn.getAttribute("aria-expanded") === "true";
                btn.setAttribute("aria-expanded", open ? "false" : "true");

                if (window.jQuery) {
                    jQuery(body).stop(true, true)[open ? "slideUp" : "slideDown"]("fast");
                } else {
                    body.style.display = open ? "none" : "block";
                }
            });
        });
    }

    function initTermsToggle() {
        document.querySelectorAll("[data-terms-toggle]").forEach(function (btn) {
            var card = btn.closest(".terms-card");
            if (!card) return;
            var divider = card.querySelector(".terms-card__divider");
            var body = card.querySelector(".terms-card__body");
            if (!divider || !body) return;

            btn.setAttribute("aria-controls", ensureId(body, "terms-body"));

            [divider, body].forEach(function (el) {
                if (el.hasAttribute("hidden")) {
                    el.removeAttribute("hidden");
                    el.style.display = "none";
                }
            });

            btn.addEventListener("click", function () {
                var open = btn.getAttribute("aria-expanded") === "true";
                btn.setAttribute("aria-expanded", open ? "false" : "true");
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

    function initTermsSelectAll() {
        document.querySelectorAll(".terms-card").forEach(function (card) {
            var master = card.querySelector(".terms-card__header .check-basic__input");
            var list = card.querySelector(".terms-card__list");
            if (!master || !list) return;
            var children = list.querySelectorAll(".check-basic__input");
            if (!children.length) return;

            function syncMasterFromChildren() {
                var checkedCount = 0;
                children.forEach(function (c) {
                    if (c.checked) checkedCount++;
                });
                var indeterminate = checkedCount > 0 && checkedCount < children.length;
                master.checked = checkedCount === children.length;
                master.indeterminate = indeterminate;
                master.classList.toggle("is-indeterminate", indeterminate);
            }

            master.addEventListener("change", function () {
                master.indeterminate = false;
                master.classList.remove("is-indeterminate");
                children.forEach(function (c) {
                    c.checked = master.checked;
                });
            });

            children.forEach(function (c) {
                c.addEventListener("change", syncMasterFromChildren);
            });

            syncMasterFromChildren();
        });
    }

    function initTermsAccordionCheck() {
        document.querySelectorAll(".terms-link").forEach(function (link) {
            var panel = link.nextElementSibling;
            if (!panel || !panel.classList.contains("terms-accordion")) return;
            var input = link.querySelector(".terms-link__check .check-basic__input");
            if (!input) return;

            input.setAttribute("aria-controls", ensureId(panel, "terms-accordion"));

            if (panel.hasAttribute("hidden")) {
                panel.removeAttribute("hidden");
                panel.style.display = "none";
            }

            function sync(animate) {
                var open = input.checked;
                input.setAttribute("aria-expanded", open ? "true" : "false");
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

    function initTabs() {
        document.querySelectorAll('[role="tablist"]').forEach(function (tablist) {
            var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
            if (!tabs.length) return;

            if (typeof window.changeTabs === "function") {
                tabs.forEach(function (t) {
                    t.removeEventListener("click", window.changeTabs);
                });
            }

            // 2026-09 is-active 클래스 컨벤션으로 통일 (tab-line/tab-chip/tab-bar/tab-text 공통)
            var activeClass = "is-active";

            function panelOf(tab) {
                var id = tab.getAttribute("aria-controls");
                return id ? document.getElementById(id) : null;
            }

            function activateTab(tab, moveFocus) {
                tabs.forEach(function (t) {
                    var selected = t === tab;
                    t.setAttribute("aria-selected", selected ? "true" : "false");
                    t.setAttribute("tabindex", selected ? "0" : "-1");
                    if (activeClass) t.classList.toggle(activeClass, selected);
                    var panel = panelOf(t);
                    if (panel) panel.hidden = !selected;
                });
                if (moveFocus) tab.focus();
            }

            tabs.forEach(function (tab, i) {
                tab.addEventListener("click", function () {
                    activateTab(tab, false);
                });
                tab.addEventListener("keydown", function (e) {
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
        });
    }

    function initLegacyAriaSelectedFix() {
        function restoreActiveAriaSelected() {
            document.querySelectorAll("[role='tab'][class*='--active']").forEach(function (tab) {
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

    function initStickyFooter() {
        document.querySelectorAll(".sticky-footer").forEach(function (footer) {
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

            footer.querySelectorAll("[data-acc-toggle]").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    setTimeout(sync, 250);
                });
            });
        });
    }

    /*
     * :has() 미지원 브라우저(iOS 15.0~15.3 등) 대응.
     * 네이티브 :has()가 있으면 CSS가 이미 처리하므로 아무 것도 하지 않고,
     * 없을 때만 동일한 조건을 jQuery로 재현해 대체 클래스를 붙인다.
     */
    function initFixedCtaSpacingFallback() {
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

    /*
     * 거래내역 미리보기 블러(.txn-preview) 마스킹.
     * 기존에는 .nds .txn-preview:has(.switch__input:not(:checked)) 로만 처리되어
     * :has() 미지원 브라우저에서는 스위치를 꺼도 금액이 그대로 노출되는 문제가 있었음.
     * 스위치 상태를 JS로 직접 반영해 모든 브라우저에서 동일하게 동작하도록 보강.
     */
    function initTxnPreviewMask() {
        $(".txn-preview").each(function () {
            var $wrap = $(this);
            var $input = $wrap.find(".txn-preview__switch .switch__input").first();
            if (!$input.length) return;

            function sync() {
                $wrap.toggleClass("is-masked", !$input.is(":checked"));
            }
            sync();
            $input.on("change", sync);
        });
    }

    function initChipAccordion() {
        document.querySelectorAll(".chip-accordion__toggle").forEach(function (btn) {
            var wrap = btn.closest(".chip-accordion");
            if (!wrap) return;

            var chips = wrap.querySelector(".chip-accordion__chips");
            if (chips) btn.setAttribute("aria-controls", ensureId(chips, "chip-list"));

            btn.addEventListener("click", function () {
                var open = wrap.classList.toggle("is-open");
                btn.setAttribute("aria-expanded", open ? "true" : "false");
                btn.setAttribute("aria-label", open ? "접기" : "펼치기");
            });
        });
    }

    function initChipSingle() {
        var seenParents = [];
        document.querySelectorAll(".chip-single").forEach(function (chip) {
            var parent = chip.parentElement;
            if (!parent || seenParents.indexOf(parent) !== -1) return;
            seenParents.push(parent);

            var group = Array.prototype.filter.call(parent.children, function (el) {
                return el.classList.contains("chip-single");
            });

            group.forEach(function (btn) {
                btn.addEventListener("click", function () {
                    group.forEach(function (c) {
                        var active = c === btn;
                        c.classList.toggle("is-active", active);
                        c.setAttribute("aria-pressed", active ? "true" : "false");
                    });
                });
            });
        });
    }

    function initBottomsheetList() {
        document.querySelectorAll(".bottomsheet-list").forEach(function (list) {
            var items = Array.prototype.filter.call(list.children, function (el) {
                return el.hasAttribute("aria-pressed");
            });
            if (!items.length) return;

            items.forEach(function (btn) {
                btn.addEventListener("click", function () {
                    items.forEach(function (b) {
                        var active = b === btn;
                        b.classList.toggle("is-selected", active);
                        b.setAttribute("aria-pressed", active ? "true" : "false");
                    });
                });
            });
        });
    }

    function initAssetBarLegend() {
        document.querySelectorAll(".asset-bar-wrap").forEach(function (wrap) {
            var trigger = wrap.querySelector(".asset-bar-trigger");
            var legend = wrap.querySelector(".asset-bar-legend");
            var closeBtn = legend ? legend.querySelector(".asset-bar-legend__close") : null;
            if (!trigger || !legend) return;

            function close(moveFocus) {
                legend.hidden = true;
                trigger.setAttribute("aria-expanded", "false");
                if (moveFocus) trigger.focus();
            }

            function open() {
                document.querySelectorAll(".asset-bar-legend").forEach(function (other) {
                    if (other !== legend) other.hidden = true;
                });
                document.querySelectorAll(".asset-bar-trigger").forEach(function (other) {
                    if (other !== trigger) other.setAttribute("aria-expanded", "false");
                });
                legend.hidden = false;
                trigger.setAttribute("aria-expanded", "true");
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
                if (legend.hidden) return;
                if (wrap.contains(e.target)) return;
                close(false);
            });

            legend.addEventListener("keydown", function (e) {
                if (e.key === "Escape") close(true);
            });
        });
    }

    function initChipAnchorScroll() {
        document.querySelectorAll(".chips.is-sticky").forEach(function (chipsEl) {
            var chips = Array.prototype.slice.call(chipsEl.querySelectorAll(".chip-single"));
            var scope = chipsEl.parentElement;
            if (!scope) return;
            var groups = Array.prototype.slice.call(scope.querySelectorAll(".inst-list__group"));
            if (!chips.length || !groups.length || chips.length !== groups.length) return;

            function headerOffset() {
                var header = document.querySelector(".header");
                var headerH = header ? header.getBoundingClientRect().height : 0;
                return headerH + chipsEl.getBoundingClientRect().height;
            }

            function setActive(index) {
                chips.forEach(function (c, i) {
                    var active = i === index;
                    c.classList.toggle("is-active", active);
                    c.setAttribute("aria-pressed", active ? "true" : "false");
                });
            }

            chips.forEach(function (chip, i) {
                chip.addEventListener("click", function () {
                    var target = groups[i];
                    var top = target.getBoundingClientRect().top + window.pageYOffset - headerOffset() - 8;
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
                    if (g.getBoundingClientRect().top - threshold <= 0) {
                        current = i;
                    }
                });
                if (current !== lastActive) {
                    lastActive = current;
                    setActive(current);
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

    function runFeatureInit() {
        initAccordion();
        initTermsToggle();
        initTermsSelectAll();
        initTermsAccordionCheck();
        initTabs();
        initLegacyAriaSelectedFix();
        initChipAccordion();
        initChipSingle();
        initBottomsheetList();
        initAssetBarLegend();
        initChipAnchorScroll();
        initStickyFooter();
        initFixedCtaSpacingFallback();
        initTxnPreviewMask();
        observeSlidePopConfirmContent();
        initChart();

        if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
            document.fonts.ready.then(function () {
                if ($(".slidePopConfirm.nds:visible").length > 0) syncSlidePopConfirmHeight(false);
            });
        }
    }

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



    // ---------------------------------------------------------------
    // 활성화 게이트: .wrapper.nds / .popWrap.nds 가 있을 때만, 딱 한 번
    // ---------------------------------------------------------------
    function activate() {
        if (activated) return;
        activated = true;

        document.documentElement.classList.add("nds");
        registerLegacyOverrides();
        registerChartGlobals();

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
