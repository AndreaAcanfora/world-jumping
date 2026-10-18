<?php
// Saves a score from the classic (2018) game. Prepared statement, validated input and a
// per-session rate limit: the old version put POST values straight into the SQL.
@session_start();
header('Content-Type: text/plain; charset=utf-8');

$now = time();
if (!isset($_SESSION['last_record_ts'])) $_SESSION['last_record_ts'] = 0;
if ($now - $_SESSION['last_record_ts'] < 5) {
    http_response_code(429);
    echo 'rate_limited';
    exit;
}

$name = isset($_POST['name']) ? trim((string) $_POST['name']) : '';
$name = preg_replace('/\s+/', ' ', strip_tags($name));
$name = function_exists('mb_substr') ? mb_substr($name, 0, 20) : substr($name, 0, 20);
if ($name === '') $name = 'Anonymous';

$record = isset($_POST['record']) ? (int) $_POST['record'] : 0;
$flag = isset($_POST['flag']) ? (int) $_POST['flag'] : 0;
$time = isset($_POST['time']) ? (int) $_POST['time'] : 0;
$lang = empty($_SESSION['lang']) ? 'en' : (string) $_SESSION['lang'];
if (!preg_match('/^[a-z]{2}$/', $lang)) $lang = 'en';

if ($record <= 0 || $record > 5000000 || $flag < 0 || $flag > 100000 || $time < 0 || $time > 86400) {
    http_response_code(400);
    echo 'invalid';
    exit;
}

mysqli_report(MYSQLI_REPORT_OFF);
$con = mysqli_connect('localhost', 'root', '', 'my_andreaaca');
if (!$con) {
    http_response_code(500);
    echo 'db_error';
    exit;
}
$stmt = mysqli_prepare($con, 'INSERT INTO `record` (`name`, `record`, `flag`, `lang`, `time`) VALUES (?, ?, ?, ?, ?)');
$ok = $stmt && mysqli_stmt_bind_param($stmt, 'siisi', $name, $record, $flag, $lang, $time) && mysqli_stmt_execute($stmt);
if ($stmt) mysqli_stmt_close($stmt);
mysqli_close($con);

if ($ok) {
    $_SESSION['last_record_ts'] = $now;
    echo 'ok';
} else {
    http_response_code(500);
    echo 'db_error';
}
