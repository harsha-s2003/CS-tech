/**
 * CS TECH Ai website forms -> Google Sheet "CS Tech Leads", tab "Website Enquiries".
 *
 * This file is a COPY kept with the website. The code that actually runs is in the sheet:
 * Extensions > Apps Script. After pasting a change there and saving:
 *   Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy
 * The web app URL (.../exec) stays the same. ("New deployment" would give a NEW URL,
 * which then has to go into 'sheet_url' in mail/mail-config.php.)
 *
 * It needs:
 *   - Project Settings > Script Properties: FORM_SECRET = the 'sheet_secret' in mail/mail-config.php
 *   - Deployment: Execute as "Me", Who has access "Anyone"
 *
 * mail/send-enquiry.php calls it for every form: the common enquiry form, the service-page
 * forms and the support ticket. The website has already checked the form; this script checks
 * the secret and adds one row.
 */

const SHEET_NAME = 'Website Enquiries';

// The sheet's columns, left to right: [header for row 1, form field]. Column A is the date.
// Rows are written by position: add new columns at the END only, never reorder.
const COLUMNS = [
  ['Submission Date',      null],
  ['Form Name',            'formName'],
  ['Full Name',            'fullName'],      // service-page forms send firstName (see doPost)
  ['Last Name',            'lastName'],
  ['Email Address',        'emailAddress'],
  ['Phone Number',         'phoneNumber'],
  ['Company/Organization', 'companyOrganization'],
  ['Purpose',              'purpose'],
  ['Comments',             'comments'],
  ['Consent',              'consent'],
  ['Job Title',            'jobTitle'],
  ['Country',              'country'],
  ['Ticket Type',          'ticketType'],
  ['Ticket Subject',       'ticketSubject'],
  ['Priority',             'priority'],
  ['Due Date',             'dueDate'],
  ['Problem Observed',     'problemObserved'],
  ['Page URL',             'pageUrl'],
];

function doPost(e) {
  const reply = (obj) =>
    ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);

  try {
    const data = JSON.parse(e.postData.contents);

    const secret = PropertiesService.getScriptProperties().getProperty('FORM_SECRET');
    if (!secret || data.secret !== secret) {
      return reply({ success: false, error: 'Unauthorized' });
    }

    // The website has already checked each form; an email address is the minimum for a lead
    if (!data.emailAddress) {
      return reply({ success: false, error: 'Missing required fields' });
    }

    // The service-page forms ask for "First Name": it goes in the "Full Name" column
    if (!data.fullName) {
      data.fullName = data.firstName;
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error('tab "' + SHEET_NAME + '" not found');
    }

    const row = COLUMNS.map(([, field]) => (field ? asText(data[field]) : new Date()));

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      fillEmptyHeaders(sheet);
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return reply({ success: true });
  } catch (error) {
    console.error(error);
    return reply({ success: false, error: 'Save failed: ' + error.message });
  }
}

// Every value is stored as plain text: nothing typed in a form can run as a formula
// (=, +, -, @), and a phone number like 0712... keeps its leading 0.
function asText(value) {
  const text = String(value ?? '');
  return text === '' ? '' : "'" + text;
}

// Puts a header in every EMPTY cell of row 1. Headers that are already there are never changed.
function fillEmptyHeaders(sheet) {
  const range = sheet.getRange(1, 1, 1, COLUMNS.length);
  const headers = range.getValues()[0];
  let changed = false;
  COLUMNS.forEach(([header], i) => {
    if (headers[i] === '') {
      headers[i] = header;
      changed = true;
    }
  });
  if (changed) {
    range.setValues([headers]);
  }
}
