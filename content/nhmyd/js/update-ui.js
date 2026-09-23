/* 2026-07-28 */
/*
 * [di9] UI Dev Team
 * update/ , sample_update/ 화면(.nds 컴포넌트)에서 공통으로 쓰는 UI 스크립트.
 * head-mb-update.js가 <head>에서 document.write로 주입하므로,
 * DOM 참조는 반드시 DOMContentLoaded 이후에 실행합니다.
 */

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
window.syncSlidePopConfirmHeight = syncSlidePopConfirmHeight;

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
    if (!isNdsScope()) return;
    syncSlidePopConfirmHeight(false);
    if ($(".fullLayerPop:visible").length > 0 && typeof window.fullLayerHeight === "function") {
        window.fullLayerHeight();
    }
});

window.renderBottomsheetList = function (options) {
    options = options || {};
    var container = typeof options.container === "string" ? document.getElementById(options.container) : options.container;
    if (!container) return;

    var items = options.items || [];
    var selectedIndex = typeof options.selectedIndex === "number" ? options.selectedIndex : -1;
    var getLabel =
        options.getLabel ||
        function (item) {
            return item.label;
        };
    var onSelect = options.onSelect;

    container.innerHTML = "";
    items.forEach(function (item, i) {
        var selected = i === selectedIndex;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bottomsheet-list__item" + (selected ? " is-selected" : "");
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", selected ? "true" : "false");

        var label = document.createElement("span");
        label.textContent = getLabel(item);
        btn.appendChild(label);

        var check = document.createElement("span");
        check.className = "bottomsheet-list__check";
        check.setAttribute("aria-hidden", "true");
        btn.appendChild(check);

        btn.addEventListener("click", function () {
            if (typeof onSelect === "function") onSelect(i, item);
        });

        container.appendChild(btn);
    });
};

(function () {
    "use strict";

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

            function activate(tab, moveFocus) {
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
                    activate(tab, false);
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
                    activate(tabs[targetIndex], true);
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

    /* ---- Lottie : data-lottie-json 으로 JSON 을 불러와 재생 ----
       레거시 nhasset-ui-myd.js 가 data-lottie 를 이미 쓰고 있어(js/lottie/*.js 를 절대경로로 로드)
       속성 이름을 data-lottie-json 으로 분리했습니다. lottie 라이브러리는 nhasset-ui-myd.js 에
       번들되어 있어 별도 로드가 필요 없습니다.

       <div class="lottie-anim" data-lottie-json="Sunny"></div>

       data-lottie-json 값은 이름 또는 경로를 씁니다.
         "Sunny"                   : 이름만 → 기본 폴더 + Sunny.json
         "ai/loading"              : 하위 폴더 → 기본 폴더 + ai/loading.json
         "ai/loading.json"         : 확장자를 적어도 같습니다
         "../../images/etc/a.json" : ./ ../ / http(s):// 로 시작하면 쓴 그대로 사용

       data-lottie-loop="false"     : 1회만 재생(기본 true)
       data-lottie-autoplay="false" : 자동재생 끄기(기본 true)
       data-lottie-base="경로/"     : 기본 폴더 변경(기본 ../../images/update/json/)
       data-lottie-ratio="false"    : 비율 자동 적용 끄기(CSS 로 직접 잡을 때)

       비율은 JSON 의 w / h 를 읽어 aspect-ratio 로 넣습니다(정사각 고정 아님).
       폭은 CSS 변수 --lottie-size 로 잡습니다.

       window.initLottie(scope)     : 나중에 추가된 영역만 다시 초기화
       el.lottieAnim                : lottie 인스턴스(play/pause/stop/goToAndPlay 사용) */
    var LOTTIE_BASE = "../../images/update/json/";

    function lottieSrc(value, base) {
        if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value) || /^[./]/.test(value)) return value;
        var parts = value.split("/");
        for (var i = 0; i < parts.length; i++) {
            parts[i] = encodeURIComponent(parts[i]);
        }
        var path = parts.join("/");
        return base + (/\.json$/i.test(path) ? path : path + ".json");
    }

    function lottieRatio(el, anim) {
        if (el.getAttribute("data-lottie-ratio") === "false") return;
        var data = anim.animationData;
        if (!data || !data.w || !data.h) return;
        el.style.aspectRatio = data.w + " / " + data.h;
    }

    function initLottie(scope) {
        if (typeof lottie === "undefined") return;
        var root = scope || document;
        var nodes = root.querySelectorAll ? root.querySelectorAll("[data-lottie-json]") : [];
        Array.prototype.forEach.call(nodes, function (el) {
            if (el.lottieAnim) return;
            var value = el.getAttribute("data-lottie-json");
            if (!value) return;
            var base = el.getAttribute("data-lottie-base") || LOTTIE_BASE;
            var anim = lottie.loadAnimation({
                container: el,
                renderer: "svg",
                loop: el.getAttribute("data-lottie-loop") !== "false",
                autoplay: el.getAttribute("data-lottie-autoplay") !== "false",
                path: lottieSrc(value, base),
            });
            el.lottieAnim = anim;
            anim.addEventListener("data_ready", function () {
                lottieRatio(el, anim);
            });
            anim.addEventListener("DOMLoaded", function () {
                lottieRatio(el, anim);
            });
            anim.addEventListener("data_failed", function () {
                el.classList.add("is-failed");
            });
        });
    }
    window.initLottie = initLottie;

    /*
     * html 엘리먼트에 nds 클래스를 동기화한다.
     * - .wrapper.nds 뿐 아니라 .popWrap.nds(팝업 단독 화면)만 있어도 반영한다.
     * - querySelector(".wrapper")는 문서상 첫 번째 요소만 잡기 때문에, 공통 헤더/푸터 include 등에서
     *   nds가 없는 다른 .wrapper가 먼저 나오면 조용히 실패할 수 있다. .wrapper.nds 처럼 클래스를
     *   합쳐서 조회하면 순서와 무관하게 nds가 붙은 요소를 바로 찾을 수 있어 이 문제를 피한다.
     * - DOMContentLoaded 시점에는 nds 대상이 전혀 없다가(레거시 화면에서 nds 팝업이 나중에 동적으로
     *   열리는 경우 등) 이후 DOM에 추가되는 경우까지 MutationObserver로 잡아서 그때 다시 반영한다.
     */
    function syncNdsClassToHtml() {
        var observer = null;

        function hasNdsRoot() {
            return !!(document.querySelector(".wrapper.nds") || document.querySelector(".popWrap.nds"));
        }

        function stopWatching() {
            if (observer) {
                observer.disconnect();
                observer = null;
            }
        }

        function applyIfNeeded() {
            if (document.documentElement.classList.contains("nds")) {
                stopWatching();
                return;
            }
            if (hasNdsRoot()) {
                document.documentElement.classList.add("nds");
                stopWatching();
            }
        }

        applyIfNeeded();

        if (!document.documentElement.classList.contains("nds") && window.MutationObserver) {
            observer = new MutationObserver(applyIfNeeded);
            observer.observe(document.documentElement, { childList: true, subtree: true });
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        // nds 대상이 처음부터 없는 순수 레거시 화면에서도, 이후 nds 팝업이 동적으로 열릴 수 있으므로
        // isNdsScope() 게이트보다 먼저, 조건 없이 호출한다. 내부적으로 nds 대상이 없으면 아무 것도 하지 않는다.
        syncNdsClassToHtml();

        if (!isNdsScope()) return;
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
        initLottie();
        observeSlidePopConfirmContent();

        if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
            document.fonts.ready.then(function () {
                if ($(".slidePopConfirm.nds:visible").length > 0) syncSlidePopConfirmHeight(false);
            });
        }
    });
})();
