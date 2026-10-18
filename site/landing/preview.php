<?php
// Preview of the landing page in any language, not indexed: /landing/preview.php?lang=it
header('X-Robots-Tag: noindex, nofollow');
define('WJ_PREVIEW_LANG', preg_match('/^[a-z]{2}$/', $_GET['lang'] ?? '') ? $_GET['lang'] : 'en');
require __DIR__ . '/page.php';
