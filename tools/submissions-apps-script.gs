/**
 * Event Crawler – event submissions
 *
 * Adds each "Submit my event" form entry to the "Event submissions" tab of the
 * Event Crawler Google Sheet. Paste this into Extensions > Apps Script in that
 * sheet, then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 */
var TAB = 'Event submissions';
var TZ = 'America/Chicago';

function doPost(e) {
  var p = (e && e.parameter) || {};
  var clean = function (v, max) {
    v = String(v || '').trim().slice(0, max);
    return /^[=+\-@]/.test(v) ? "'" + v : v; // stop spreadsheet formulas
  };
  var name = clean(p.name, 120);
  var email = clean(p.email, 200);
  var link = clean(p.link, 1000);

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^https?:\/\//i.test(link) || p.website) {
    return ContentService.createTextOutput('ignored');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var now = new Date();
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB).appendRow([
      Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
      Utilities.formatDate(now, TZ, 'h:mm a'),
      name,
      email,
      link
    ]);
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput('ok');
}
