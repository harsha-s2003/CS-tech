<?php
// =====================================================================================
// CS TECH Ai - website forms -> email (PHPMailer over SMTP, same account as the old website)
//
// Used by every form on the site (the common enquiry form, the service-page form and the
// support-ticket form). js/enquiry-form.js posts the form here and shows the result.
// Answers with the text "success" or "error" (like the old site's email-notification.php).
//
// Who receives the emails, the SMTP account and the subject line: mail/mail-config.php
// =====================================================================================
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/../PHPMailer/src/Exception.php';
require __DIR__ . '/../PHPMailer/src/PHPMailer.php';
require __DIR__ . '/../PHPMailer/src/SMTP.php';

// The settings file. A different file can be set on the server only (local tests), never by a visitor.
$config = require (getenv('CSTECH_MAIL_CONFIG') ?: __DIR__ . '/mail-config.php');

header('Content-Type: text/plain; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

define(
    'GOOGLE_SCRIPT_URL',
    'https://script.google.com/macros/s/AKfycbyPTw3gu_zHB-F9TP9DYZtuXeAeH_V3iy-ZbQWEA9K3kOmVEFThYzsEwshtsZmo09Zu/exec'
);

define(
    'GOOGLE_FORM_SECRET',
    '8303741cce66cfdc4b5c5ea4c17cc9eb007dc6dc26a659297337139c156ea95a'
);

function finish(string $text, int $status = 200): void
{
    http_response_code($status);
    echo $text;
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    finish('error', 405);
}

// Spam trap: the "website" field is hidden from people; only bots fill it in.
// Pretend it worked, so the bot does not try again, but send nothing.
if (trim((string)($_POST['website'] ?? '')) !== '') {
    finish('success');
}

// Read one field: trimmed, invisible control characters removed, length limited
function field(string $name, int $max = 300): string
{
    $value = trim((string)($_POST[$name] ?? ''));
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    return function_exists('mb_substr') ? mb_substr($value, 0, $max) : substr($value, 0, $max);
}

// Every field any form on the site can send, with the label shown in the email (in this order)
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

// Minimum needed to answer the enquiry: a valid email address and a name (or ticket subject)
$email = $data['emailAddress'] ?? '';
$name = trim(($data['fullName'] ?? '') !== '' ? $data['fullName'] : trim(($data['firstName'] ?? '') . ' ' . ($data['lastName'] ?? '')));
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || ($name === '' && !isset($data['ticketSubject']))) {
    finish('error', 400);
}
if ($name === '') {
    $name = $data['companyOrganization'] ?? $email;
}

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
    // Mail servers tried in order ("tls://host:587", then "ssl://host:465"): if a network blocks
    // one port, PHPMailer moves on to the next server by itself.
    $mail->Host        = implode(';', (array)$config['smtp_servers']);
    $mail->SMTPAuth    = (bool)$config['smtp_auth'];
    $mail->Username    = $config['smtp_username'];
    $mail->Password    = $config['smtp_password'];
    $mail->SMTPAutoTLS = false;   // encryption comes from each server's tls:// or ssl:// prefix
    $mail->Timeout     = 10;      // seconds per server, so a blocked port falls back quickly
    $mail->CharSet     = PHPMailer::CHARSET_UTF8;

    $mail->setFrom($config['from_email'], $config['from_name']);
    foreach ($config['to'] as $address => $label) {
        $mail->addAddress($address, $label);
    }
    $mail->addReplyTo($email, $name);   // "Reply" in the inbox answers the visitor

    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $body;
    $mail->AltBody = $text;

    $mail->send();
    finish('success');
} catch (Exception $ex) {
    // The reason goes to the server's PHP error log (cPanel > Errors), never to the visitor
    error_log('CS TECH website form: email not sent - ' . $mail->ErrorInfo);
    finish('error', 500);
}