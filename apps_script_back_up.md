```javascript
// ══════════════════════════════════════════════════════════
// SURABHI SUTRA — BACKUP APPS SCRIPT
// Points to the BACKUP Google Sheet.
// Paste this into the backup Apps Script editor and redeploy.
// ══════════════════════════════════════════════════════════

const SHEET_ID        = '1ZprREAddUSS5W6mRWWWwyKtWJrWjbrhr_EsiGFfg7eE'; // BACKUP sheet
const PRODUCTS_SHEET  = 'Products Sheet';
const ORDERS_SHEET    = 'Orders Sheet';
const REVIEWS_SHEET   = 'Reviews';
const ADMIN_SHEET     = 'Admin_id';
const PRODUCT_COLUMNS = 10;
const REVIEW_COLUMNS  = 5;
const ADMIN_COLUMNS   = 4;
const SCRIPT_VERSION  = '2026-05-12-backup-v2';

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'getProducts')   return getProducts();
    if (action === 'getOrders')     return getOrders();
    if (action === 'getReviews')    return getReviews(e);
    if (action === 'getAdmins')     return getAdmins();
    if (action === 'validatePromo') return validatePromo(e);
    if (action === 'getPromos')     return getPromos();

    return jsonResponse({
      success: false,
      message: 'Unknown action: ' + action
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      message: 'doGet error: ' + err.message
    });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');

    if (data.action === 'saveProduct')          return saveProduct(data);
    if (data.action === 'deleteProduct')        return deleteProduct(data);
    if (data.action === 'saveOrder')            return saveOrder(data);
    if (data.action === 'saveReview')           return saveReview(data);
    if (data.action === 'verifyAdmin')          return verifyAdmin(data);
    if (data.action === 'verifyAdminOTP')       return verifyAdminOTP(data);
    if (data.action === 'saveAdmin')            return saveAdmin(data);
    if (data.action === 'deleteAdmin')          return deleteAdmin(data);
    if (data.action === 'updateAdminPassword')  return updateAdminPassword(data);
    if (data.action === 'updateOrderStatus')    return updateOrderStatus(data);
    if (data.action === 'savePromo')            return savePromo(data);
    if (data.action === 'deletePromo')          return deletePromo(data);
    if (data.action === 'togglePromo')          return togglePromo(data);

    return jsonResponse({
      success: false,
      message: 'Unknown action: ' + data.action
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      message: 'doPost error: ' + err.message
    });
  }
}

/* ======================================================
   HELPERS
====================================================== */

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(
      JSON.stringify(
        Object.assign(
          { script_version: SCRIPT_VERSION },
          payload
        )
      )
    )
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

function normalizeRowWidth(row, width) {
  const copy = row.slice(0, width);
  while (copy.length < width) copy.push('');
  return copy;
}

function getSheetDataRows(sheet, width) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet
    .getRange(2, 1, lastRow - 1, width)
    .getValues();

  const displays = sheet
    .getRange(2, 1, lastRow - 1, width)
    .getDisplayValues();

  const output = [];

  for (let i = 0; i < rows.length; i++) {
    output.push({
      sheetRow: i + 2,
      values: normalizeRowWidth(rows[i], width),
      displays: normalizeRowWidth(displays[i], width)
    });
  }

  return output;
}

function readCellId(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return Math.trunc(value).toString();
  return String(value).trim();
}

function toBundleFlag(value) {
  const s = String(value || 'yes').trim().toLowerCase();
  if (s === 'no' || s === 'false' || s === '0') return 'no';
  return 'yes';
}

function cleanJsonText(value, fallback) {
  const txt = String(value || '').trim();
  return txt || fallback;
}

/* ======================================================
   GET PRODUCTS
====================================================== */

function getProducts() {
  try {
    const sheet = getSheet(PRODUCTS_SHEET);

    if (!sheet) {
      return jsonResponse({ success: false, message: 'Products Sheet not found' });
    }

    const rows = getSheetDataRows(sheet, PRODUCT_COLUMNS);
    const productMap = new Map();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].values;
      const id = readCellId(row[0]);
      if (!id) continue;

      productMap.set(id, {
        id: id,
        name: String(row[1] || '').trim(),
        category: String(row[2] || '').trim(),
        description: String(row[3] || '').trim(),
        price: Number(row[4]) || 0,
        image_url: String(row[5] || '').trim(),
        quantity: Number(row[6]) || 0,
        images: cleanJsonText(row[7], '[]'),
        benefits: cleanJsonText(row[8], '[]'),
        bundle_enabled: toBundleFlag(row[9])
      });
    }

    return jsonResponse({
      success: true,
      products: Array.from(productMap.values())
    });

  } catch (err) {
    return jsonResponse({ success: false, message: 'getProducts error: ' + err.message });
  }
}

/* ======================================================
   SAVE PRODUCT
====================================================== */

function saveProduct(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(PRODUCTS_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Products Sheet not found' });

    const productId = String(data.id || '').trim();
    if (!productId) return jsonResponse({ success: false, message: 'Missing product id' });

    const rows = getSheetDataRows(sheet, PRODUCT_COLUMNS);
    for (let i = rows.length - 1; i >= 0; i--) {
      const rawId     = readCellId(rows[i].values[0]);
      const displayId = String(rows[i].displays[0] || '').trim();
      if (rawId === productId || displayId === productId) sheet.deleteRow(rows[i].sheetRow);
    }
    SpreadsheetApp.flush();

    const newRow  = sheet.getLastRow() + 1;
    const rowData = [[
      productId,
      String(data.name        || '').trim(),
      String(data.category    || '').trim(),
      String(data.description || '').trim(),
      Number(data.price)      || 0,
      String(data.image_url   || '').trim(),
      Number(data.quantity)   || 0,
      cleanJsonText(data.images,   '[]'),
      cleanJsonText(data.benefits, '[]'),
      toBundleFlag(data.bundle_enabled)
    ]];

    const range = sheet.getRange(newRow, 1, 1, PRODUCT_COLUMNS);
    range.getCell(1, 1).setNumberFormat('@');
    range.setValues(rowData);
    SpreadsheetApp.flush();

    return jsonResponse({ success: true, message: 'Product saved successfully', row: newRow });

  } catch (err) {
    return jsonResponse({ success: false, message: 'saveProduct error: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ======================================================
   DELETE PRODUCT
====================================================== */

function deleteProduct(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(PRODUCTS_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Products Sheet not found' });

    const productId = String(data.id || '').trim();
    if (!productId) return jsonResponse({ success: false, message: 'Missing product id' });

    const rows = getSheetDataRows(sheet, PRODUCT_COLUMNS);
    for (let i = rows.length - 1; i >= 0; i--) {
      const rawId     = readCellId(rows[i].values[0]);
      const displayId = String(rows[i].displays[0] || '').trim();
      if (rawId === productId || displayId === productId) sheet.deleteRow(rows[i].sheetRow);
    }

    return jsonResponse({ success: true, message: 'Product deleted' });

  } catch (err) {
    return jsonResponse({ success: false, message: 'deleteProduct error: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ======================================================
   SAVE ORDER
====================================================== */

function saveOrder(data) {
  try {
    const sheet = getSheet(ORDERS_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Orders Sheet not found' });

    sheet.appendRow([
      String(data.order_id         || ''),
      String(data.customer_name    || ''),
      String(data.customer_email   || ''),
      String(data.customer_phone   || ''),
      String(data.customer_address || ''),
      String(data.items            || ''),
      Number(data.total_amount)    || 0,
      String(data.timestamp        || new Date().toISOString()),
      String(data.status           || 'pending')
    ]);

    try { sendOrderNotification(data); } catch (mailErr) { Logger.log('Order email failed: ' + mailErr.message); }

    return jsonResponse({ success: true, message: 'Order saved' });

  } catch (err) {
    return jsonResponse({ success: false, message: 'saveOrder error: ' + err.message });
  }
}

/* ======================================================
   GET ORDERS
====================================================== */

function getOrders() {
  try {
    const sheet = getSheet(ORDERS_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Orders Sheet not found' });

    const data   = sheet.getDataRange().getValues();
    const orders = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      orders.push({
        order_id:         String(row[0] || ''),
        customer_name:    String(row[1] || ''),
        customer_email:   String(row[2] || ''),
        customer_phone:   String(row[3] || ''),
        customer_address: String(row[4] || ''),
        items:            String(row[5] || ''),
        total_amount:     Number(row[6]) || 0,
        timestamp:        String(row[7] || ''),
        status:           String(row[8] || 'pending')
      });
    }

    return jsonResponse({ success: true, orders });

  } catch (err) {
    return jsonResponse({ success: false, message: 'getOrders error: ' + err.message });
  }
}

/* ======================================================
   GET REVIEWS
====================================================== */

function getReviews(e) {
  try {
    const sheet = getSheet(REVIEWS_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Reviews sheet not found' });

    const rows            = getSheetDataRows(sheet, REVIEW_COLUMNS);
    const filterProductId = String((e && e.parameter && e.parameter.product_id) || '').trim();

    const reviews = rows
      .map(r => ({
        name:       String(r.values[0] || '').trim(),
        email:      String(r.values[1] || '').trim(),
        stars:      Number(r.values[2]) || 0,
        comment:    String(r.values[3] || '').trim(),
        product_id: String(r.values[4] || '').trim()
      }))
      .filter(r => r.name)
      .filter(r => !filterProductId || r.product_id === filterProductId);

    return jsonResponse({ success: true, reviews });

  } catch (err) {
    return jsonResponse({ success: false, message: 'getReviews error: ' + err.message });
  }
}

/* ======================================================
   SAVE REVIEW
====================================================== */

function saveReview(data) {
  try {
    const sheet = getSheet(REVIEWS_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Reviews sheet not found' });

    const stars = Math.min(5, Math.max(1, Number(data.stars) || 5));
    sheet.appendRow([
      String(data.name       || '').trim(),
      String(data.email      || '').trim(),
      stars,
      String(data.comment    || '').trim(),
      String(data.product_id || '').trim()
    ]);
    SpreadsheetApp.flush();

    return jsonResponse({ success: true, message: 'Review saved' });

  } catch (err) {
    return jsonResponse({ success: false, message: 'saveReview error: ' + err.message });
  }
}

/* ======================================================
   UPDATE ORDER STATUS
====================================================== */

function updateOrderStatus(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(ORDERS_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Orders Sheet not found' });

    const orderId   = String(data.order_id || '').trim();
    const newStatus = String(data.status   || '').trim().toLowerCase();
    if (!orderId)   return jsonResponse({ success: false, message: 'order_id is required' });
    if (!newStatus) return jsonResponse({ success: false, message: 'status is required' });

    const sheetData = sheet.getDataRange().getValues();
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][0] || '').trim() === orderId) {
        sheet.getRange(i + 1, 9).setValue(newStatus);
        SpreadsheetApp.flush();
        return jsonResponse({ success: true, message: 'Order status updated' });
      }
    }

    return jsonResponse({ success: false, message: 'Order not found: ' + orderId });

  } catch (err) {
    return jsonResponse({ success: false, message: 'updateOrderStatus error: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ======================================================
   ADMIN AUTH
====================================================== */

function getAdmins() {
  try {
    const sheet = getSheet(ADMIN_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Admin_id sheet not found' });

    const rows   = getSheetDataRows(sheet, ADMIN_COLUMNS);
    const admins = rows
      .filter(r => String(r.values[0] || '').trim())
      .map(r => ({
        id:    String(r.values[0] || '').trim(),
        name:  String(r.values[1] || '').trim(),
        email: String(r.values[2] || '').trim()
      }));

    return jsonResponse({ success: true, admins });

  } catch (err) {
    return jsonResponse({ success: false, message: 'getAdmins error: ' + err.message });
  }
}

function verifyAdmin(data) {
  try {
    const sheet = getSheet(ADMIN_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Admin_id sheet not found.' });

    const email    = String(data.email    || '').trim().toLowerCase();
    const password = String(data.password || '').trim();
    if (!email || !password) return jsonResponse({ success: false, message: 'Email and password are required.' });

    const rows = getSheetDataRows(sheet, ADMIN_COLUMNS);
    let matchedAdmin = null;

    for (const row of rows) {
      const rowEmail    = String(row.values[2] || '').trim().toLowerCase();
      const rowPassword = String(row.values[3] || '').trim();
      if (rowEmail === email && rowPassword === password) {
        matchedAdmin = {
          id:    String(row.values[0] || '').trim(),
          name:  String(row.values[1] || '').trim(),
          email: String(row.values[2] || '').trim()
        };
        break;
      }
    }

    if (!matchedAdmin) return jsonResponse({ success: false, message: 'Invalid email or password.' });

    const otp    = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000;

    const props = PropertiesService.getScriptProperties();
    props.setProperty('OTP_' + email, otp);
    props.setProperty('OTP_EXP_' + email, expiry.toString());

    MailApp.sendEmail({
      to: matchedAdmin.email,
      subject: 'Surabhi Sutra Admin — Your Login OTP',
      body:
        'Hi ' + (matchedAdmin.name || 'Admin') + ',\n\n' +
        'Your one-time login code is:\n\n' +
        '    ' + otp + '\n\n' +
        'This code expires in 10 minutes.\n' +
        'Do not share this code with anyone.\n\n' +
        '— Surabhi Sutra Admin System'
    });

    return jsonResponse({ success: true });

  } catch (err) {
    return jsonResponse({ success: false, message: 'verifyAdmin error: ' + err.message });
  }
}

function verifyAdminOTP(data) {
  try {
    const email = String(data.email || '').trim().toLowerCase();
    const otp   = String(data.otp   || '').trim();
    if (!email || !otp) return jsonResponse({ success: false, message: 'Email and OTP are required.' });

    const props     = PropertiesService.getScriptProperties();
    const storedOTP = props.getProperty('OTP_' + email);
    const expiry    = parseInt(props.getProperty('OTP_EXP_' + email) || '0', 10);

    if (!storedOTP) return jsonResponse({ success: false, message: 'No OTP found. Please sign in again.' });

    if (Date.now() > expiry) {
      props.deleteProperty('OTP_' + email);
      props.deleteProperty('OTP_EXP_' + email);
      return jsonResponse({ success: false, message: 'OTP has expired. Please sign in again.' });
    }

    if (otp !== storedOTP) return jsonResponse({ success: false, message: 'Incorrect OTP. Please try again.' });

    props.deleteProperty('OTP_' + email);
    props.deleteProperty('OTP_EXP_' + email);

    const sheet = getSheet(ADMIN_SHEET);
    let admin = { id: '', name: '', email: email };

    if (sheet) {
      const rows = getSheetDataRows(sheet, ADMIN_COLUMNS);
      for (const row of rows) {
        if (String(row.values[2] || '').trim().toLowerCase() === email) {
          admin = {
            id:    String(row.values[0] || '').trim(),
            name:  String(row.values[1] || '').trim(),
            email: String(row.values[2] || '').trim()
          };
          break;
        }
      }
    }

    return jsonResponse({ success: true, admin });

  } catch (err) {
    return jsonResponse({ success: false, message: 'verifyAdminOTP error: ' + err.message });
  }
}

function saveAdmin(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(ADMIN_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Admin_id sheet not found' });

    const email = String(data.email || '').trim().toLowerCase();
    if (!email) return jsonResponse({ success: false, message: 'Email is required' });

    const rows = getSheetDataRows(sheet, ADMIN_COLUMNS);
    for (const row of rows) {
      if (String(row.values[2] || '').trim().toLowerCase() === email) {
        return jsonResponse({ success: false, message: 'An admin with this email already exists.' });
      }
    }

    const newId  = 'ADM-' + new Date().getTime();
    const newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, ADMIN_COLUMNS).setValues([[
      newId,
      String(data.name     || '').trim(),
      email,
      String(data.password || '').trim()
    ]]);
    SpreadsheetApp.flush();

    return jsonResponse({ success: true, message: 'Admin added successfully', id: newId });

  } catch (err) {
    return jsonResponse({ success: false, message: 'saveAdmin error: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function deleteAdmin(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(ADMIN_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Admin_id sheet not found' });

    const adminId = String(data.id || '').trim();
    if (!adminId) return jsonResponse({ success: false, message: 'Missing admin id' });

    const rows = getSheetDataRows(sheet, ADMIN_COLUMNS);
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i].values[0] || '').trim() === adminId) sheet.deleteRow(rows[i].sheetRow);
    }

    return jsonResponse({ success: true, message: 'Admin deleted' });

  } catch (err) {
    return jsonResponse({ success: false, message: 'deleteAdmin error: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function updateAdminPassword(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(ADMIN_SHEET);
    if (!sheet) return jsonResponse({ success: false, message: 'Admin_id sheet not found' });

    const email       = String(data.email        || '').trim().toLowerCase();
    const oldPassword = String(data.old_password || '').trim();
    const newPassword = String(data.new_password || '').trim();

    if (!email || !oldPassword || !newPassword) {
      return jsonResponse({ success: false, message: 'Email, current password, and new password are required.' });
    }
    if (newPassword.length < 6) {
      return jsonResponse({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const rows = getSheetDataRows(sheet, ADMIN_COLUMNS);
    for (const row of rows) {
      const rowEmail    = String(row.values[2] || '').trim().toLowerCase();
      const rowPassword = String(row.values[3] || '').trim();
      if (rowEmail === email) {
        if (rowPassword !== oldPassword) {
          return jsonResponse({ success: false, message: 'Current password is incorrect.' });
        }
        sheet.getRange(row.sheetRow, 4).setValue(newPassword);
        SpreadsheetApp.flush();
        return jsonResponse({ success: true, message: 'Password updated successfully.' });
      }
    }

    return jsonResponse({ success: false, message: 'Admin email not found.' });

  } catch (err) {
    return jsonResponse({ success: false, message: 'updateAdminPassword error: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ======================================================
   ORDER EMAIL NOTIFICATION
====================================================== */

function sendOrderNotification(order) {
  const sheet = getSheet(ADMIN_SHEET);
  if (!sheet) return;

  const rows = getSheetDataRows(sheet, ADMIN_COLUMNS);
  const adminEmails = rows
    .map(r => String(r.values[2] || '').trim())
    .filter(Boolean);

  if (!adminEmails.length) return;

  const items = (() => {
    try { return JSON.parse(order.items || '[]').join(', '); }
    catch { return String(order.items || ''); }
  })();

  const subject = '🛍️ New Order: ' + (order.order_id || '') + ' — ₹' + (order.total_amount || 0);
  const body =
    'New order received on Surabhi Sutra!\n\n' +
    'Order ID  : ' + (order.order_id       || '') + '\n' +
    'Customer  : ' + (order.customer_name  || '') + '\n' +
    'Phone     : ' + (order.customer_phone || '') + '\n' +
    'Email     : ' + (order.customer_email || '') + '\n' +
    'Address   : ' + (order.customer_address || '') + '\n\n' +
    'Items     : ' + items + '\n' +
    'Total     : ₹' + (order.total_amount || 0) + '\n\n' +
    'Placed at : ' + (order.timestamp || new Date().toISOString()) + '\n\n' +
    'Log in to your admin panel to manage this order.';

  for (const email of adminEmails) {
    MailApp.sendEmail({ to: email, subject, body });
  }
}

/* ======================================================
   PROMO CODES  (stored in Script Properties as JSON)
====================================================== */

function _getPromoList() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty('PROMO_CODES') || '[]');
  } catch (_) { return []; }
}

function _setPromoList(list) {
  PropertiesService.getScriptProperties().setProperty('PROMO_CODES', JSON.stringify(list));
}

function getPromos() {
  return jsonResponse({ success: true, promos: _getPromoList() });
}

function validatePromo(e) {
  try {
    const code     = String((e && e.parameter && e.parameter.code)     || '').trim().toUpperCase();
    const subtotal = Number((e && e.parameter && e.parameter.subtotal) || 0);

    if (!code) return jsonResponse({ success: false, message: 'No code provided.' });

    const promo = _getPromoList().find(p => p.code.toUpperCase() === code && p.active !== false);
    if (!promo) return jsonResponse({ success: false, message: 'Invalid or expired promo code.' });

    if (promo.minOrder && subtotal < Number(promo.minOrder)) {
      return jsonResponse({ success: false, message: 'Min order ₹' + promo.minOrder + ' required.' });
    }

    const discount = promo.type === 'percent'
      ? Math.round(subtotal * Number(promo.value) / 100)
      : Math.min(Number(promo.value), subtotal);

    return jsonResponse({ success: true, code: promo.code, discount, type: promo.type, value: promo.value });

  } catch (err) {
    return jsonResponse({ success: false, message: 'validatePromo error: ' + err.message });
  }
}

function savePromo(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const code  = String(data.code  || '').trim().toUpperCase();
    const type  = String(data.type  || 'percent').trim();
    const value = Number(data.value)    || 0;
    const min   = Number(data.minOrder) || 0;
    if (!code || !value) return jsonResponse({ success: false, message: 'Code and value are required.' });
    const list = _getPromoList();
    if (list.find(p => p.code === code)) return jsonResponse({ success: false, message: 'Code already exists.' });
    list.push({ code, type, value, minOrder: min, active: true });
    _setPromoList(list);
    return jsonResponse({ success: true, message: 'Promo code saved.' });
  } catch (err) {
    return jsonResponse({ success: false, message: 'savePromo error: ' + err.message });
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

function deletePromo(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const code = String(data.code || '').trim().toUpperCase();
    if (!code) return jsonResponse({ success: false, message: 'Code is required.' });
    _setPromoList(_getPromoList().filter(p => p.code !== code));
    return jsonResponse({ success: true, message: 'Promo deleted.' });
  } catch (err) {
    return jsonResponse({ success: false, message: 'deletePromo error: ' + err.message });
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

function togglePromo(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const code   = String(data.code || '').trim().toUpperCase();
    const active = (data.active !== false && data.active !== 'false');
    if (!code) return jsonResponse({ success: false, message: 'Code is required.' });
    const list  = _getPromoList();
    const promo = list.find(p => p.code === code);
    if (!promo) return jsonResponse({ success: false, message: 'Code not found.' });
    promo.active = active;
    _setPromoList(list);
    return jsonResponse({ success: true, message: 'Promo updated.' });
  } catch (err) {
    return jsonResponse({ success: false, message: 'togglePromo error: ' + err.message });
  } finally { try { lock.releaseLock(); } catch (_) {} }
}
```
