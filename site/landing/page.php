<?php
// World Jumping landing page, one URL per language (see the root .htaccess).
// The root index.php includes this file; landing/preview.php shows it in any language.
// Source: github.com/AndreaAcanfora/world-jumping, folder site/.

$base = 'https://andreaaca.altervista.org';
$gameUrl = '/platform3D/';
$path = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');

if ($path === '/') {
    header('HTTP/1.1 301 Moved Permanently');
    header('Location: /world-jumping-game-online-free-best-platform');
    exit;
}

$urls = [
    'en' => '/world-jumping-game-online-free-best-platform',
    'it' => '/it/world-jumping-migliore-gioco-online-gratis-multi-piattaforme',
    'es' => '/es/world-jumping-mejor-juego-en-linea-gratis-multiplataforma',
    'fr' => '/fr/meilleur-jeu-en-ligne-gratuit-plateformes',
    'de' => '/de/bestes-online-spiel-kostenlos-plattformen',
    'pt' => '/pt/melhor-jogo-on-line-plataformas-livres',
    'ru' => '/ru/лучшие-игры-онлайн-бесплатные-платформы',
    'zh' => '/zh/最好的免费在线游戏平台',
    'ja' => '/ja/最高の無料オンラインゲームプラットフォーム',
    'hi' => '/hi/सबसे-अच्छा-मुफ्त-ऑनलाइन-गेम-प्लेटफॉर्म',
    'ar' => '/ar/أفضل-منصات-ألعاب-مجانية-على-الإنترنت',
];
$locales = ['en' => 'en_US', 'it' => 'it_IT', 'es' => 'es_ES', 'fr' => 'fr_FR', 'de' => 'de_DE', 'pt' => 'pt_PT', 'ru' => 'ru_RU', 'zh' => 'zh_CN', 'ja' => 'ja_JP', 'hi' => 'hi_IN', 'ar' => 'ar_AR'];
$names = ['en' => 'English', 'it' => 'Italiano', 'es' => 'Español', 'fr' => 'Français', 'de' => 'Deutsch', 'pt' => 'Português', 'ru' => 'Русский', 'zh' => '中文', 'ja' => '日本語', 'hi' => 'हिन्दी', 'ar' => 'العربية'];

$lang = array_search($path, $urls, true) ?: 'en';
// landing/preview.php shows any language without changing the public URLs.
if (defined('WJ_PREVIEW_LANG') && isset($urls[WJ_PREVIEW_LANG])) $lang = WJ_PREVIEW_LANG;
@session_start();
$_SESSION['lang'] = $lang;
$t = require __DIR__ . '/i18n/' . $lang . '.php';
$e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
$self = $base . $urls[$lang];
$image = $base . '/img/world-jumping-3d-platform-game.jpg';

// Hall of fame of the classic (2018) game. Names are escaped: they come from players.
$hall = [];
mysqli_report(MYSQLI_REPORT_OFF);
$con = @mysqli_connect('localhost', 'root', '', 'my_andreaaca');
if ($con) {
    $res = mysqli_query($con, 'SELECT name, record, flag FROM `record` ORDER BY record DESC LIMIT 10');
    if ($res) $hall = mysqli_fetch_all($res, MYSQLI_ASSOC);
    mysqli_close($con);
}

$game = [
    '@context' => 'https://schema.org',
    '@type' => 'VideoGame',
    'name' => 'World Jumping',
    'url' => $base . $gameUrl,
    'image' => $image,
    'description' => $t['description'],
    'genre' => ['Platform game', '3D'],
    'gamePlatform' => ['Web browser', 'PC', 'Mobile'],
    'applicationCategory' => 'Game',
    'operatingSystem' => 'Any (web browser)',
    'playMode' => 'SinglePlayer',
    'isAccessibleForFree' => true,
    'inLanguage' => ['it', 'en'],
    'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'EUR'],
    'author' => ['@type' => 'Person', 'name' => 'Andrea Acanfora'],
    'datePublished' => '2018-10-30',
    'dateModified' => '2026-10-18',
    'sameAs' => ['https://github.com/AndreaAcanfora/world-jumping'],
];
$faq = [
    '@context' => 'https://schema.org',
    '@type' => 'FAQPage',
    'mainEntity' => array_map(fn($q) => ['@type' => 'Question', 'name' => $q[0], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $q[1]]], $t['faq']),
];
$share = rawurlencode($self);
$shareText = rawurlencode($t['share_text']);
?>
<!doctype html>
<html lang="<?= $lang ?>"<?= $lang === 'ar' ? ' dir="rtl"' : '' ?>>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= $e($t['title']) ?></title>
    <meta name="description" content="<?= $e($t['description']) ?>">
    <meta name="author" content="Andrea Acanfora">
    <meta name="theme-color" content="#3d8bdc">
    <link rel="canonical" href="<?= $e($self) ?>">
<?php foreach ($urls as $ln => $u) { ?>
    <link rel="alternate" hreflang="<?= $ln ?>" href="<?= $e($base . $u) ?>">
<?php } ?>
    <link rel="alternate" hreflang="x-default" href="<?= $e($base . $urls['en']) ?>">
    <link rel="icon" href="/platform3D/icon.svg" type="image/svg+xml">

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="World Jumping">
    <meta property="og:locale" content="<?= $locales[$lang] ?>">
    <meta property="og:url" content="<?= $e($self) ?>">
    <meta property="og:title" content="<?= $e($t['title']) ?>">
    <meta property="og:description" content="<?= $e($t['description']) ?>">
    <meta property="og:image" content="<?= $e($image) ?>">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?= $e($t['title']) ?>">
    <meta name="twitter:description" content="<?= $e($t['description']) ?>">
    <meta name="twitter:image" content="<?= $e($image) ?>">

    <script type="application/ld+json"><?= json_encode($game, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
    <script type="application/ld+json"><?= json_encode($faq, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Rubik:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/landing/landing.css?v=2">

    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-M5J3BH');</script>
</head>
<body>
    <header class="top">
        <a class="brand" href="<?= $e($urls[$lang]) ?>">World Jumping</a>
        <details class="langs">
            <summary><?= $e($names[$lang]) ?></summary>
            <ul>
<?php foreach ($urls as $ln => $u) { ?>
                <li><a href="<?= $e($u) ?>" hreflang="<?= $ln ?>" lang="<?= $ln ?>"<?= $ln === $lang ? ' aria-current="page"' : '' ?>><?= $e($names[$ln]) ?></a></li>
<?php } ?>
            </ul>
        </details>
    </header>

    <main>
        <section class="hero">
            <div class="hero-text">
                <h1><span class="logo">World <span>Jumping</span></span><span class="h1-sub"><?= $e($t['h1']) ?></span></h1>
                <p class="lead"><?= $e($t['lead']) ?></p>
                <a class="play" href="<?= $gameUrl ?>"><?= $e($t['play']) ?></a>
                <p class="note"><?= $e($t['play_note']) ?></p>
            </div>
            <a class="shot" href="<?= $gameUrl ?>" aria-label="<?= $e($t['play']) ?>">
                <img src="/img/world-jumping-gameplay.jpg" width="1200" height="630" fetchpriority="high" alt="<?= $e($t['image_alt']) ?>">
            </a>
        </section>

        <section class="features" aria-labelledby="features">
            <h2 id="features"><?= $e($t['features_title']) ?></h2>
            <ul>
<?php foreach ($t['features'] as $f) { ?>
                <li><h3><?= $e($f[0]) ?></h3><p><?= $e($f[1]) ?></p></li>
<?php } ?>
            </ul>
        </section>

        <section class="how" aria-labelledby="how">
            <h2 id="how"><?= $e($t['how_title']) ?></h2>
            <p><?= $e($t['how_text']) ?></p>
            <table>
                <thead><tr><th scope="col"></th><th scope="col"><?= $e($t['keyboard']) ?></th><th scope="col"><?= $e($t['phone']) ?></th></tr></thead>
                <tbody>
<?php foreach ($t['controls'] as $c) { ?>
                    <tr><th scope="row"><?= $e($c[0]) ?></th><td><?= $e($c[1]) ?></td><td><?= $e($c[2]) ?></td></tr>
<?php } ?>
                </tbody>
            </table>
        </section>

        <section class="faq" aria-labelledby="faq">
            <h2 id="faq"><?= $e($t['faq_title']) ?></h2>
<?php foreach ($t['faq'] as $q) { ?>
            <details><summary><?= $e($q[0]) ?></summary><p><?= $e($q[1]) ?></p></details>
<?php } ?>
        </section>

        <section class="cta">
            <h2><?= $e($t['cta_title']) ?></h2>
            <a class="play" href="<?= $gameUrl ?>"><?= $e($t['play']) ?></a>
            <p class="share"><?= $e($t['share']) ?>:
                <a href="https://wa.me/?text=<?= $shareText ?>%20<?= $share ?>" target="_blank" rel="noopener">WhatsApp</a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=<?= $share ?>" target="_blank" rel="noopener">Facebook</a>
                <a href="https://x.com/intent/post?url=<?= $share ?>&amp;text=<?= $shareText ?>" target="_blank" rel="noopener">X</a>
                <a href="https://t.me/share/url?url=<?= $share ?>&amp;text=<?= $shareText ?>" target="_blank" rel="noopener">Telegram</a>
                <a href="https://www.reddit.com/submit?url=<?= $share ?>&amp;title=<?= $shareText ?>" target="_blank" rel="noopener">Reddit</a>
            </p>
        </section>

        <section class="support" aria-labelledby="support">
            <h2 id="support"><?= $e($t['support_title']) ?></h2>
            <p><?= $e($t['support_text']) ?></p>
            <p class="support-links">
                <a class="donate" href="https://www.paypal.me/AndreaAca" target="_blank" rel="noopener"><?= $e($t['donate']) ?></a>
                <a href="https://github.com/AndreaAcanfora/world-jumping" target="_blank" rel="noopener"><?= $e($t['source']) ?></a>
            </p>
        </section>

<?php if ($hall) { ?>
        <section class="hall" aria-labelledby="hall">
            <h2 id="hall"><?= $e($t['hall_title']) ?></h2>
            <p><?= $e($t['hall_text']) ?> <a href="/platform3D-classic/"><?= $e($t['classic']) ?></a></p>
            <table>
                <thead><tr><th scope="col">#</th><th scope="col"><?= $e($t['name']) ?></th><th scope="col"><?= $e($t['flags']) ?></th><th scope="col"><?= $e($t['score']) ?></th></tr></thead>
                <tbody>
<?php foreach ($hall as $i => $r) { ?>
                    <tr><td><?= $i + 1 ?></td><td><?= $e($r['name']) ?></td><td><?= (int) $r['flag'] ?></td><td><?= (int) $r['record'] ?></td></tr>
<?php } ?>
                </tbody>
            </table>
        </section>
<?php } ?>
    </main>

    <footer>
        <p><?= $e($t['made_by']) ?></p>
        <p><a href="https://www.instagram.com/andreaacanf/" rel="noopener">Instagram @andreaacanf</a> <a href="mailto:acanfora.andrea@gmail.com">acanfora.andrea@gmail.com</a></p>
        <p><a href="/platform3D-classic/"><?= $e($t['classic']) ?></a></p>
    </footer>
</body>
</html>
