/**
 * Head include
 * ------------------
 * css & script 공통 include
 */

(function () {
    var str =
        "" +
        '<meta http-equiv="Content-Script-Type" content="text/javascript">' +
        '<meta http-equiv="Content-Style-Type" content="text/css">' +
        '<meta http-equiv="X-UA-Compatible" content="IE=edge">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">' +
        '<meta name="apple-mobile-web-app-title" content="NH마이데이터">' +
        '<meta http-equiv="imagetoolbar" content="no">' +
        '<meta name="robots" content="no-index,follow">' +
        '<meta name="title" content="">' +
        '<meta name="author" content="">' +
        '<meta name="content" content="">' +
        '<meta name="keywords" content="NH마이데이터">' +
        '<meta name="description" content="NH마이데이터">' +
        '<meta http-equiv="Pragma" content="no-cache">' +
        '<meta http-equiv="Expires" content="-1">' +
        // title은 공통 include에 넣지 않음 — 각 html 파일에서 <title>로 직접 지정
        '<link type="text/css" rel="stylesheet" href="../../css/swiper.min.css">' +
        '<link type="text/css" rel="stylesheet" href="../../css/nh_base.css">' +
        '<link rel="stylesheet" type="text/css" href="../../css/nh_layout.css">' +
        '<link rel="stylesheet" type="text/css" href="../../css/nh_comm.css">' +
        '<link rel="stylesheet" type="text/css" href="../../css/nhasset_logos.css">' +
        '<link rel="stylesheet" type="text/css" href="../../css/nhasset_com.css" id="changeCom">' +
        '<link rel="stylesheet" type="text/css" href="../../css/nhasset_cont.css" id="changeCont">' +
        '<link rel="stylesheet" type="text/css" href="../../css/nhasset_myd.css">' + //2023 마이데이터 고도화
        '<link type="text/css" rel="stylesheet" href="../../css/ms_allone.css">' +
        '<link type="text/css" rel="stylesheet" href="../../css/ms_pay.css">' + //NH-Pay
        '<link rel="stylesheet" type="text/css" href="../../css/nhasset_myd_mb.css?20250912">' + //2025 NH농협은행 비대면 마이데이터 고객여정 개선
        //'<link rel="stylesheet" type="text/css" href="../../css/update.css">' + //2026 NH농협은행 nds 적용
        // OF는 실 단말 하이브리드 웹뷰에서만 주입되는 네이티브 브릿지 전역객체라, pub 폴더를 브라우저로 단독
        // 열람하는 이 환경에는 존재하지 않음. nhasset-ui.js의 popOpenRun()이 OF.exeStatus를 가드 없이
        // 참조하고 있어서(레거시 원본 소스는 수정하지 않음) 여기서 빈 객체로 미리 정의해 ReferenceError를
        // 막는다. 실제 단말에서는 OF가 먼저 주입되어 있으므로 이 줄은 아무 영향을 주지 않는다.
        "<script>window.OF = window.OF || {};</script>" +
        '<script src="../../js/jquery-1.9.1.min.js"></script>' +
        '<script src="../../js/jquery-ui.min.js"></script>' +
        '<script src="../../js/jquery.ui.touch-punch.min.js"></script>' +
        '<script src="../../js/swiper.7.4.1.min.js"></script>' +
        '<script src="../../js/common_ui.js"></script>' +
        '<script src="../../js/nhasset-ui.js"></script>' +
        '<script src="../../js/nhasset-ui-myd.js"></script>' + //2023 마이데이터 고도화
        '<script src="../../js/nhasset-ui-myd-mb.js"></script>' + //2025 NH농협은행 비대면 마이데이터 고객여정 개선
        '<script src="../../js/update-ui.js"></script>'; //2026 NH농협은행 nds 적용 화면 UI 스크립트
    //    '<link rel="stylesheet" type="text/css" href="../update/nochart.css">' + //2026 Chart.js 없이 그린 차트 스타일
    //    '<script src="../update/nochart.js"></script>'; //2026 Chart.js 없이 그린 차트 스크립트(애니메이션·툴팁)
    //    '<link type="text/css" rel="stylesheet" href="../pub-assets/css/guide.css">'; //가이드용 css 실제 서비스에는 불필요
    // +'<script src="../pub-assets/js/guide.js"></script>'// 가이드용 js 실제 서비스에는 불필요
    // +'<script src="../pub-assets/js/guide-mb.js"></script>'// 가이드용 js 실제 서비스에는 불필요 //2025 NH농협은행 비대면 마이데이터 고객여정 개선
    document.write(str);
})();
