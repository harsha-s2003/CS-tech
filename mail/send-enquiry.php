<?php

declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/../PHPMailer/src/Exception.php';
require __DIR__ . '/../PHPMailer/src/PHPMailer.php';
require __DIR__ . '/../PHPMailer/src/SMTP.php';

// Settings: Google Sheet URL + secret, email on/off, SMTP account (mail-config.php is not in git
// and cannot be opened in a browser - keep secrets there, not in this file)
$config = require (getenv('CSTECH_MAIL_CONFIG') ?: __DIR__ . '/mail-config.php');

header('Content-Type: text/plain; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

function finish(string $text, int $status = 200): void
{
    http_response_code($status);
    echo $text;
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    finish('error', 405);
}

if (trim((string)($_POST['website'] ?? '')) !== '') {
    finish('success');
}

function field(string $name, int $max = 300): string
{
    $value = trim((string)($_POST[$name] ?? ''));
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    return function_exists('mb_substr') ? mb_substr($value, 0, $max) : substr($value, 0, $max);
}

// Adds the submission as a row in the Google Sheet, through the sheet's Apps Script web app
// (its code: mail/google-apps-script.js). True only when the script answers {"success": true};
// otherwise the reason is written to the error log.
function save_to_sheet(string $url, string $secret, array $fields): bool
{
    if (!function_exists('curl_init')) {
        error_log('CS TECH website form: not saved to Google Sheet - the PHP curl extension is not enabled');
        return false;
    }
    $fields['secret'] = $secret;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($fields, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,   // Google answers the POST with a redirect to the script's reply
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT        => 30,
    ]);
    $body   = curl_exec($ch);
    $failed = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);

    $reply = is_string($body) ? json_decode($body, true) : null;
    if (is_array($reply) && ($reply['success'] ?? false) === true) {
        return true;
    }

    if ($failed !== '') {
        $why = $failed;                                            // e.g. the server cannot reach Google
    } elseif (is_array($reply)) {
        $why = (string)($reply['error'] ?? 'no reason given');     // the script's own answer
    } else {
        $why = 'HTTP ' . $status . ', the answer did not come from the script (Deploy > Manage deployments: Who has access must be "Anyone")';
    }
    error_log('CS TECH website form: not saved to Google Sheet - ' . $why);
    return false;
}

$labels = [
    'formName'            => 'Form',
    'fullName'            => 'Full Name',
    'firstName'           => 'First Name',
    'lastName'            => 'Last Name',
    'emailAddress'        => 'Email Address',
    'phoneNumber'         => 'Phone Number',
    'companyOrganization' => 'Company/Organization',
    'jobTitle'            => 'Job Title',
    'country'             => 'Country',
    'purpose'             => 'Purpose of Inquiry',
    'ticketType'          => 'Ticket Type',
    'ticketSubject'       => 'Ticket Subject',
    'priority'            => 'Priority',
    'dueDate'             => 'Due Date',
    'comments'            => 'How we can help',
    'problemObserved'     => 'Problem Observed',
    // 'consent'             => 'Consent',
    'pageTitle'           => 'Sent from page',
    'pageUrl'             => 'Page address',
];
$long = ['comments', 'problemObserved', 'pageUrl'];

$data = [];
foreach ($labels as $name => $label) {
    $value = field($name, in_array($name, $long, true) ? 5000 : 300);
    if ($value !== '') {
        $data[$name] = $value;
    }
}

$email = $data['emailAddress'] ?? '';
$name = trim(($data['fullName'] ?? '') !== '' ? $data['fullName'] : trim(($data['firstName'] ?? '') . ' ' . ($data['lastName'] ?? '')));
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || ($name === '' && !isset($data['ticketSubject']))) {
    finish('error', 400);
}
if ($name === '') {
    $name = $data['companyOrganization'] ?? $email;
}

// ---------- 1. Google Sheet: 'sheet_url' / 'sheet_secret' in mail-config.php ----------
$savedToSheet = false;
if (!empty($config['sheet_url'])) {
    $row = $data;
    $row['consent'] = field('consent');   // left out of the email, but kept in the sheet
    $savedToSheet = save_to_sheet((string)$config['sheet_url'], (string)($config['sheet_secret'] ?? ''), $row);
}

// ---------- 2. Email: only when 'send_email' => true in mail-config.php ----------
$emailed = false;
if (!empty($config['send_email'])) {
    // Subject line
    $isTicket = isset($data['ticketSubject']) || isset($data['ticketType']);
    $subject = $isTicket
        ? sprintf($config['subject_ticket'], $data['ticketSubject'] ?? '', $name)
        : sprintf($config['subject_enquiry'], $name);

    // Email body: a table of the fields that were filled in
    $e = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    $rows = '';
    $text = '';
    foreach ($data as $key => $value) {
        $shown = in_array($key, $long, true) ? nl2br($e($value)) : $e($value);
        $rows .= '<tr><td style="vertical-align:top"><strong>' . $e($labels[$key]) . ':</strong></td><td>' . $shown . '</td></tr>';
        $text .= $labels[$key] . ': ' . $value . "\n";
    }
    $body = '<p>Hello,</p>'
        . '<p>You have received a new ' . ($isTicket ? 'support ticket' : 'enquiry') . ' from the CS TECH Ai website. Details below:</p>'
        . '<table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;font-family:Arial,sans-serif;">' . $rows . '</table>'
        . '<p style="color:#888;font-size:12px;margin-top:20px;">This email was sent automatically from the CS TECH Ai website form.</p>';

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();

        // Each server needs tls:// (STARTTLS, port 587) or ssl:// (port 465) in front. Without one the
        // password would travel unencrypted (SMTPAutoTLS is off), so a server without a prefix gets tls://
        $servers = array_map(
            fn(string $server): string => preg_match('~^(tls|ssl)://~i', $server) ? $server : 'tls://' . $server,
            (array)$config['smtp_servers']
        );
        $mail->Host        = implode(';', $servers);
        $mail->SMTPAuth    = (bool)$config['smtp_auth'];
        $mail->Username    = $config['smtp_username'];
        $mail->Password    = $config['smtp_password'];
        $mail->SMTPAutoTLS = false;
        $mail->Timeout     = 15;      // seconds per server (an SSL connection can take ~6s); then the next one
        $mail->CharSet     = PHPMailer::CHARSET_UTF8;

        $mail->setFrom($config['from_email'], $config['from_name']);
        foreach ($config['to'] as $address => $label) {
            $mail->addAddress($address, $label);
        }
        $mail->addReplyTo($email, $name);

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $body;
        $mail->AltBody = $text;

        $mail->send();
        $emailed = true;
    } catch (Exception $ex) {
        error_log('CS TECH website form: email not sent - ' . $mail->ErrorInfo);
    }
}

// "success" (the visitor goes to the Thank You page) once the lead is in the sheet or in the inbox
if ($savedToSheet || $emailed) {
    finish('success');
}
if (empty($config['sheet_url']) && empty($config['send_email'])) {
    error_log('CS TECH website form: not saved - set sheet_url (or send_email) in mail-config.php');
}
finish('error', 500);
