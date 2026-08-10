const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================================================
ENV
========================================================= */

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY;
const AFA_API_KEY = process.env.AFA_API_KEY;

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_KEY
);

/* =========================================================
DATAMART API
========================================================= */

const DATAMART_BASE =
"https://api.datamartgh.shop/api/developer";

/* =========================================================
AFA REGISTRATION API

Fully automated — after payment, the webhook calls this
API directly using your API key. Your wallet on
afaregistration.com is charged your account price (₵10),
the customer pays ₵20 in the bot, keeping a ₵10 margin.
========================================================= */

const AFA_BASE =
"https://afaregistration.com/api/v1";

const AFA_PRICE = 20;

/* =========================================================
NETFLIX SUBSCRIPTION

Fully automated — after payment, the customer signs in on
Netflix themselves using the shared email below. When they
reply "GET CODE", the bot logs into that Gmail inbox via
IMAP, finds the latest Netflix email, and either:
- sends back the numeric sign-in code, or
- if Netflix sent an "approve this sign-in" link instead of
a code, the bot tries to open that link itself; if that
fails, it flags the link to the admin (233547100951) to
approve manually.
========================================================= */

const NETFLIX_EMAIL = process.env.NETFLIX_EMAIL;
const NETFLIX_EMAIL_APP_PASSWORD = process.env.NETFLIX_EMAIL_APP_PASSWORD;
const NETFLIX_PRICE = 30;

/* =========================================================
PACKAGES
========================================================= */

const PACKAGES = {
MTN: {
"1": { price: 4.50, capacity: "1", apiNetwork: "YELLO" },
"2": { price: 9.50, capacity: "2", apiNetwork: "YELLO" },
"3": { price: 13.50, capacity: "3", apiNetwork: "YELLO" },
"4": { price: 18.50, capacity: "4", apiNetwork: "YELLO" },
"5": { price: 23.50, capacity: "5", apiNetwork: "YELLO" },
"6": { price: 27.50, capacity: "6", apiNetwork: "YELLO" },
"7": { price: 35.50, capacity: "8", apiNetwork: "YELLO" },
"8": { price: 44.00, capacity: "10", apiNetwork: "YELLO" },
"9": { price: 63.50, capacity: "15", apiNetwork: "YELLO" },
"10": { price: 83.50, capacity: "20", apiNetwork: "YELLO" },
"11": { price: 103.50, capacity: "25", apiNetwork: "YELLO" },
"12": { price: 160.50, capacity: "40", apiNetwork: "YELLO" },
"13": { price: 206.50, capacity: "50", apiNetwork: "YELLO" }
},

AIRTELTIGO: {
"1": { price: 4.50, capacity: "1", apiNetwork: "YELLO" },
"2": { price: 11.00, capacity: "2", apiNetwork: "YELLO" },
"3": { price: 15.00, capacity: "3", apiNetwork: "YELLO" },
"4": { price: 18.00, capacity: "4", apiNetwork: "YELLO" },
"5": { price: 23.00, capacity: "5", apiNetwork: "YELLO" },
"6": { price: 27.00, capacity: "6", apiNetwork: "YELLO" },
"7": { price: 35.00, capacity: "8", apiNetwork: "YELLO" },
"8": { price: 44.00, capacity: "10", apiNetwork: "YELLO" },
"9": { price: 62.00, capacity: "15", apiNetwork: "YELLO" },
"10": { price: 106.00, capacity: "25", apiNetwork: "YELLO" },
"11": { price: 121.00, capacity: "30", apiNetwork: "YELLO" }
},

TELECEL: {
"1": { price: 38.50, capacity: "10", apiNetwork: "YELLO" },
"2": { price: 45.50, capacity: "12", apiNetwork: "YELLO" },
"3": { price: 56.40, capacity: "15", apiNetwork: "YELLO" },
"4": { price: 27.90, capacity: "20", apiNetwork: "YELLO" },
"5": { price: 100.50, capacity: "25", apiNetwork: "YELLO" },
"6": { price: 110.00, capacity: "30", apiNetwork: "YELLO" },
"7": { price: 133.40, capacity: "35", apiNetwork: "YELLO" },
"8": { price: 145.00, capacity: "40", apiNetwork: "YELLO" },
"9": { price: 160.80, capacity: "45", apiNetwork: "YELLO" },
"10": { price: 180.00, capacity: "50", apiNetwork: "YELLO" },
"11": { price: 400.75, capacity: "100", apiNetwork: "YELLO" }
}
};

/* =========================================================
MASHUP OFFERS (MTN)

These are fulfilled MANUALLY by dialing *567*2# on the
admin's own phone and entering the customer's paid amount
— there is no API for this, so payment just triggers an
alert to the admin instead of an automatic DataMart
purchase. The actual data+minutes mix is whatever MTN's
system offers for that amount at the time of dialing, so
the customer just picks an amount, not a specific combo.
========================================================= */

const MASHUP_MIN_AMOUNT = 1;
const MASHUP_MAX_AMOUNT = 30;

function isValidMashupAmount(value) {

if (!/^\d+(\.\d{1,2})?$/.test(String(value).trim())) {
return false;
}

const amount = parseFloat(value);

return (
amount >= MASHUP_MIN_AMOUNT &&
amount <= MASHUP_MAX_AMOUNT
);
}

/*
⚠️ EDIT ME — each price (₵1 through ₵30) has its own 5
combo options below. Replace the "label" text for any entry
once you know the real numbers. Nothing else in the code
needs to change — the bot always looks up combos by the
whole-cedi amount the customer typed.
*/

const MASHUP_KNOWN_COMBOS = {

"1": [
{ id: "1", label: "25 Mins + 25MB" },
{ id: "2", label: "20 Mins + 30MB" },
{ id: "3", label: "15 Mins + 35MB" }
],

"2": [
{ id: "1", label: "50 Mins + 50MB" },
{ id: "2", label: "35 Mins + 65MB" },
{ id: "3", label: "20 Mins + 80MB" },
{ id: "4", label: "5 Mins + 95MB" },
{ id: "5", label: "100MB only" }
],

"3": [
{ id: "1", label: "75 Mins + 75MB" },
{ id: "2", label: "53 Mins + 98MB" },
{ id: "3", label: "30 Mins + 120MB" },
{ id: "4", label: "8 Mins + 143MB" },
{ id: "5", label: "150MB only" }
],

"4": [
{ id: "1", label: "100 Mins + 100MB" },
{ id: "2", label: "70 Mins + 130MB" },
{ id: "3", label: "40 Mins + 160MB" },
{ id: "4", label: "10 Mins + 190MB" },
{ id: "5", label: "200MB only" }
],

"5": [
{ id: "1", label: "125 Mins + 125MB" },
{ id: "2", label: "100 Mins + 150MB" },
{ id: "3", label: "50 Mins + 200MB" }
],

"6": [
{ id: "1", label: "150 Mins + 150MB" },
{ id: "2", label: "105 Mins + 195MB" },
{ id: "3", label: "60 Mins + 240MB" },
{ id: "4", label: "15 Mins + 285MB" },
{ id: "5", label: "300MB only" }
],

"7": [
{ id: "1", label: "175 Mins + 175MB" },
{ id: "2", label: "122 Mins + 228MB" },
{ id: "3", label: "70 Mins + 280MB" },
{ id: "4", label: "18 Mins + 333MB" },
{ id: "5", label: "350MB only" }
],

"8": [
{ id: "1", label: "200 Mins + 200MB" },
{ id: "2", label: "140 Mins + 260MB" },
{ id: "3", label: "80 Mins + 320MB" },
{ id: "4", label: "20 Mins + 380MB" },
{ id: "5", label: "400MB only" }
],

"9": [
{ id: "1", label: "225 Mins + 225MB" },
{ id: "2", label: "158 Mins + 293MB" },
{ id: "3", label: "90 Mins + 360MB" },
{ id: "4", label: "23 Mins + 428MB" },
{ id: "5", label: "450MB only" }
],

"10": [
{ id: "1", label: "250 Mins + 250MB" },
{ id: "2", label: "200 Mins + 300MB" },
{ id: "3", label: "150 Mins + 350MB" }
],

"11": [
{ id: "1", label: "275 Mins + 275MB" },
{ id: "2", label: "193 Mins + 358MB" },
{ id: "3", label: "110 Mins + 440MB" },
{ id: "4", label: "28 Mins + 523MB" },
{ id: "5", label: "550MB only" }
],

"12": [
{ id: "1", label: "300 Mins + 300MB" },
{ id: "2", label: "210 Mins + 390MB" },
{ id: "3", label: "120 Mins + 480MB" },
{ id: "4", label: "30 Mins + 570MB" },
{ id: "5", label: "600MB only" }
],

"13": [
{ id: "1", label: "325 Mins + 325MB" },
{ id: "2", label: "227 Mins + 423MB" },
{ id: "3", label: "130 Mins + 520MB" },
{ id: "4", label: "33 Mins + 618MB" },
{ id: "5", label: "650MB only" }
],

"14": [
{ id: "1", label: "350 Mins + 350MB" },
{ id: "2", label: "245 Mins + 455MB" },
{ id: "3", label: "140 Mins + 560MB" },
{ id: "4", label: "35 Mins + 665MB" },
{ id: "5", label: "700MB only" }
],

"15": [
{ id: "1", label: "375 Mins + 375MB" },
{ id: "2", label: "263 Mins + 488MB" },
{ id: "3", label: "150 Mins + 600MB" },
{ id: "4", label: "38 Mins + 713MB" },
{ id: "5", label: "750MB only" }
],

"16": [
{ id: "1", label: "400 Mins + 400MB" },
{ id: "2", label: "280 Mins + 520MB" },
{ id: "3", label: "160 Mins + 640MB" },
{ id: "4", label: "40 Mins + 760MB" },
{ id: "5", label: "800MB only" }
],

"17": [
{ id: "1", label: "425 Mins + 425MB" },
{ id: "2", label: "298 Mins + 553MB" },
{ id: "3", label: "170 Mins + 680MB" },
{ id: "4", label: "43 Mins + 808MB" },
{ id: "5", label: "850MB only" }
],

"18": [
{ id: "1", label: "450 Mins + 450MB" },
{ id: "2", label: "315 Mins + 585MB" },
{ id: "3", label: "180 Mins + 720MB" },
{ id: "4", label: "45 Mins + 855MB" },
{ id: "5", label: "900MB only" }
],

"19": [
{ id: "1", label: "475 Mins + 475MB" },
{ id: "2", label: "333 Mins + 618MB" },
{ id: "3", label: "190 Mins + 760MB" },
{ id: "4", label: "48 Mins + 903MB" },
{ id: "5", label: "950MB only" }
],

"20": [
{ id: "1", label: "500 Mins + 500MB" },
{ id: "2", label: "350 Mins + 650MB" },
{ id: "3", label: "200 Mins + 800MB" },
{ id: "4", label: "50 Mins + 950MB" },
{ id: "5", label: "1000MB only" }
],

"21": [
{ id: "1", label: "525 Mins + 525MB" },
{ id: "2", label: "368 Mins + 683MB" },
{ id: "3", label: "210 Mins + 840MB" },
{ id: "4", label: "53 Mins + 998MB" },
{ id: "5", label: "1050MB only" }
],

"22": [
{ id: "1", label: "550 Mins + 550MB" },
{ id: "2", label: "385 Mins + 715MB" },
{ id: "3", label: "220 Mins + 880MB" },
{ id: "4", label: "55 Mins + 1045MB" },
{ id: "5", label: "1100MB only" }
],

"23": [
{ id: "1", label: "575 Mins + 575MB" },
{ id: "2", label: "403 Mins + 748MB" },
{ id: "3", label: "230 Mins + 920MB" },
{ id: "4", label: "58 Mins + 1093MB" },
{ id: "5", label: "1150MB only" }
],

"24": [
{ id: "1", label: "600 Mins + 600MB" },
{ id: "2", label: "420 Mins + 780MB" },
{ id: "3", label: "240 Mins + 960MB" },
{ id: "4", label: "60 Mins + 1140MB" },
{ id: "5", label: "1200MB only" }
],

"25": [
{ id: "1", label: "625 Mins + 625MB" },
{ id: "2", label: "438 Mins + 813MB" },
{ id: "3", label: "250 Mins + 1000MB" },
{ id: "4", label: "63 Mins + 1188MB" },
{ id: "5", label: "1250MB only" }
],

"26": [
{ id: "1", label: "650 Mins + 650MB" },
{ id: "2", label: "455 Mins + 845MB" },
{ id: "3", label: "260 Mins + 1040MB" },
{ id: "4", label: "65 Mins + 1235MB" },
{ id: "5", label: "1300MB only" }
],

"27": [
{ id: "1", label: "675 Mins + 675MB" },
{ id: "2", label: "472 Mins + 878MB" },
{ id: "3", label: "270 Mins + 1080MB" },
{ id: "4", label: "68 Mins + 1283MB" },
{ id: "5", label: "1350MB only" }
],

"28": [
{ id: "1", label: "700 Mins + 700MB" },
{ id: "2", label: "490 Mins + 910MB" },
{ id: "3", label: "280 Mins + 1120MB" },
{ id: "4", label: "70 Mins + 1330MB" },
{ id: "5", label: "1400MB only" }
],

"29": [
{ id: "1", label: "725 Mins + 725MB" },
{ id: "2", label: "507 Mins + 943MB" },
{ id: "3", label: "290 Mins + 1160MB" },
{ id: "4", label: "73 Mins + 1378MB" },
{ id: "5", label: "1450MB only" }
],

"30": [
{ id: "1", label: "750 Mins + 750MB" },
{ id: "2", label: "525 Mins + 975MB" },
{ id: "3", label: "300 Mins + 1200MB" },
{ id: "4", label: "75 Mins + 1425MB" },
{ id: "5", label: "1500MB only" }
]

};

function getMashupCombos(amountText) {

const wholeAmount =
String(parseInt(amountText, 10));

return (
MASHUP_KNOWN_COMBOS[wholeAmount] ||
[]
);
}

/*
session.bundle for mashup orders is stored as "amount|comboId"
e.g. "5|3" = ₵5, combo option #3
*/

function parseMashupSelection(bundleStr) {

const [amountText, comboId] =
String(bundleStr || "").split("|");

if (!isValidMashupAmount(amountText)) {
return null;
}

const combo =
getMashupCombos(amountText).find(
c => c.id === comboId
);

if (!combo) return null;

return {
amount: parseFloat(amountText),
combo
};
}

/* =========================================================
MAIN MENU
========================================================= */

const MENU = `Welcome to Data1gh🇬🇭

1 - MTN Data
2 - AirtelTigo Data
3 - Telecel Data
4 - Track Order
5 - Netflix subscription
6 - AFA registration
7 - MashUp Bundle (MTN)

Choose an option to continue`;

/* =========================================================
BUNDLE MENUS
========================================================= */

const MENUS = {

MTN: `MTN Bundles:
1 - 1GB ₵4.50
2 - 2GB ₵9.50
3 - 3GB ₵13.50
4 - 4GB ₵18.50
5 - 5GB ₵23.50
6 - 6GB ₵27.00
7 - 8GB ₵35.50
8 - 10GB ₵44.00
9 - 15GB ₵63.50
10 - 20GB ₵83.50
11 - 25GB ₵103.50
12 - 40GB ₵160.50
13 - 50GB ₵206.50

Choose an option to continue`,

AIRTELTIGO: `AirtelTigo Bundles:
1 - 1GB ₵4.50
2 - 2GB ₵11.00
3 - 3GB ₵15.00
4 - 4GB ₵18.00
5 - 5GB ₵23.00
6 - 6GB ₵27.00
7 - 8GB ₵35.00
8 - 10GB ₵44.00
9 - 15GB ₵62.00
10 - 25GB ₵106.00
11 - 30GB ₵121.00

Choose an option to continue`,

TELECEL: `Telecel Bundles:
1 - 10GB ₵38.50
2 - 12GB ₵45.50
3 - 15GB ₵56.40
4 - 20GB ₵27.90
5 - 25GB ₵100.50
6 - 30GB ₵110.00
7 - 35GB ₵133.40
8 - 40GB ₵145.00
9 - 45GB ₵160.80
10 - 50GB ₵180.00
11 - 100GB ₵400.75

Choose an option to continue`
};

/* =========================================================
SEND WHATSAPP
========================================================= */

async function sendWhatsApp(to, text) {

try {

await axios.post(
`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
{
messaging_product: "whatsapp",
to,
text: {
body: text
}
},
{
headers: {
Authorization: `Bearer ${ACCESS_TOKEN}`,
"Content-Type": "application/json"
}
}
);

} catch (e) {

console.error(
"WA ERROR:",
e.response?.data || e.message
);

}
}

/* =========================================================
NORMALIZE PHONE
========================================================= */

function normalizePhone(phone) {

let value = String(phone || "")
.replace(/\D/g, "");

if (
value.startsWith("233") &&
value.length === 12
) {
value = "0" + value.substring(3);
}

return value;
}

/* =========================================================
AFA FORM-DATA HELPERS

session.bundle for AFA orders holds a JSON blob of the
form fields as they're collected step by step, e.g.
{"type":"afa","full_name":"Ama Mensah","phone_number":"0240000000", ...}
This avoids needing any new Supabase columns.
========================================================= */

function getAfaData(session) {

try {

const data =
JSON.parse(session.bundle);

if (data && data.type === "afa") {
return data;
}

} catch (e) {}

return null;
}

function mergeAfaField(session, field, value) {

let data = {};

try {

const existing =
JSON.parse(session.bundle);

if (existing) data = existing;

} catch (e) {}

data.type = "afa";
data[field] = value;

return JSON.stringify(data);
}

function isValidGhanaCard(value) {

return /^GHA-\d{9}-\d$/i.test(
String(value || "").trim()
);
}

function parseAfaDob(value) {

const match =
String(value || "")
.trim()
.match(
/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
);

if (!match) return null;

const [, day, month, year] = match;

const dd = day.padStart(2, "0");
const mm = month.padStart(2, "0");

if (
Number(mm) < 1 ||
Number(mm) > 12 ||
Number(dd) < 1 ||
Number(dd) > 31
) {
return null;
}

return `${year}-${mm}-${dd}`;
}

/* =========================================================
NETFLIX HELPERS

session.bundle for Netflix orders holds a JSON blob, e.g.
{"type":"netflix"} before payment, then after payment:
{
"type": "netflix",
"paidAt": "2026-08-10T12:00:00.000Z",
"refCode": "NF47J0TV",
"used": false
}

refCode is a one-time reference the customer must reply
with to fetch their sign-in code/link. Once a fetch
succeeds (a code, an approval, or a flagged link), "used"
flips to true and that reference can never fetch again —
they'd need to pay again for a new one. This stops the
same payment being used to sign in on multiple devices.
========================================================= */

function generateNetflixRefCode() {

const chars =
"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let code = "";

for (let i = 0; i < 8; i++) {

code +=
chars[
Math.floor(
Math.random() * chars.length
)
];
}

return code;
}

function getNetflixData(session) {

try {

const data =
JSON.parse(session.bundle);

if (data && data.type === "netflix") {
return data;
}

} catch (e) {}

return null;
}

/*
Logs into the shared Netflix Gmail inbox via IMAP and looks
at the latest email from Netflix. Returns one of:
{ type: "code", value: "1234" }
{ type: "approved", link } — auto-clicked an approval link
{ type: "link_flagged", link } — link exists, needs admin to click it
{ type: "none" } — nothing found yet
{ type: "error" } — could not check email
*/

async function fetchNetflixSignIn(sinceIso) {

if (
!NETFLIX_EMAIL ||
!NETFLIX_EMAIL_APP_PASSWORD
) {

console.error(
"NETFLIX EMAIL CREDENTIALS NOT SET"
);

return { type: "error" };
}

const client = new ImapFlow({
host: "imap.gmail.com",
port: 993,
secure: true,
auth: {
user: NETFLIX_EMAIL,
pass: NETFLIX_EMAIL_APP_PASSWORD
},
logger: false
});

try {

await client.connect();

const lock =
await client.getMailboxLock("INBOX");

try {

const searchCriteria = {
from: "netflix.com"
};

if (sinceIso) {
searchCriteria.since =
new Date(sinceIso);
}

const uids =
await client.search(
searchCriteria,
{ uid: true }
);

if (!uids || uids.length === 0) {
return { type: "none" };
}

const latestUid =
uids[uids.length - 1];

const message =
await client.fetchOne(
latestUid,
{ source: true },
{ uid: true }
);

if (!message || !message.source) {
return { type: "none" };
}

const parsed =
await simpleParser(
message.source
);

const bodyText =
parsed.text || "";

const bodyHtml =
parsed.html || "";

/* 1. Look for a numeric sign-in code */

const codeMatch =
bodyText.match(
/(?:sign-?in|verification)\s+code[^\d]{0,20}(\d{4,8})/i
) ||
bodyText.match(
/\b(\d{4,8})\b/
);

if (codeMatch) {

return {
type: "code",
value: codeMatch[1]
};
}

/* 2. No code — look for an approval link instead */

const linkSource =
bodyHtml || bodyText;

const linkMatches =
linkSource.match(
/https:\/\/(www\.)?netflix\.com\/[^\s"'<>]+/gi
) || [];

const approvalLink =
linkMatches.find(link =>
/confirm|verify|approve|travel|signin|device/i.test(
link
)
) || linkMatches[0];

if (!approvalLink) {
return { type: "none" };
}

try {

await axios.get(
approvalLink,
{ timeout: 15000 }
);

return {
type: "approved",
link: approvalLink
};

} catch (e) {

console.error(
"NETFLIX AUTO-APPROVE FAILED:",
e.message
);

return {
type: "link_flagged",
link: approvalLink
};
}

} finally {

lock.release();
}

} catch (e) {

console.error(
"NETFLIX EMAIL FETCH ERROR:",
e.message
);

return { type: "error" };

} finally {

try {
await client.logout();
} catch (e) {}
}
}

/* =========================================================
MOMO PROVIDER MAPPING
========================================================= */

function momoProvider(network) {

if (network === "MTN") return "mtn";
if (network === "AIRTELTIGO") return "atl";
if (network === "TELECEL") return "vod";
if (network === "MASHUP") return "mtn";

return null;
}

/* =========================================================
FORMAT DATE
========================================================= */

function formatDateTime(dateValue) {

if (!dateValue) {
return {
date: "N/A",
time: "N/A"
};
}

const date = new Date(dateValue);

if (isNaN(date.getTime())) {
return {
date: "N/A",
time: "N/A"
};
}

return {

date: date.toLocaleDateString(
"en-GH",
{
day: "2-digit",
month: "short",
year: "numeric",
timeZone: "Africa/Accra"
}
),

time: date.toLocaleTimeString(
"en-GH",
{
hour: "2-digit",
minute: "2-digit",
hour12: true,
timeZone: "Africa/Accra"
}
)

};
}

/* =========================================================
CALCULATE DELIVERY DURATION
========================================================= */

function calculateDuration(
placedAt,
deliveredAt
) {

const placed =
new Date(placedAt);

const delivered =
new Date(deliveredAt);

if (
isNaN(placed.getTime()) ||
isNaN(delivered.getTime())
) {
return null;
}

const difference =
delivered.getTime() -
placed.getTime();

if (difference <= 0) {
return null;
}

const totalMinutes =
Math.round(
difference / 60000
);

const hours =
Math.floor(
totalMinutes / 60
);

const minutes =
totalMinutes % 60;

if (hours > 0 && minutes > 0) {

return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;

}

if (hours > 0) {

return `${hours} hour${hours === 1 ? "" : "s"}`;

}

return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/* =========================================================
GET DELIVERY TRACKER
========================================================= */

async function getDeliveryEstimate() {

try {

const response =
await axios.get(
`${DATAMART_BASE}/delivery-tracker`,
{
headers: {
"x-api-key": DATA_API_KEY
},
timeout: 15000
}
);

const data =
response.data?.data;

if (!data) {
return null;
}

const lastDelivered =
data.lastDelivered;

if (!lastDelivered) {

return {
active:
data.scanner?.active || false,

waiting:
data.scanner?.waiting || false,

estimatedTime:
null,

placedTime:
null,

deliveredTime:
null
};
}

/*
Example from DataMart:

Tracking #1557392 —
placed at Apr 03, 10:03 AM,
delivered at Apr 03, 11:51 AM
*/

const summary =
lastDelivered.summary || "";

const match =
summary.match(
/placed at (.*?), delivered at (.*)$/i
);

let placedText = null;
let deliveredText = null;
let estimatedTime = null;

if (match) {

placedText =
match[1].trim();

deliveredText =
match[2].trim();

/*
The summary does not include
the year, so use the current year.
*/

const currentYear =
new Date().getFullYear();

const placedDate =
new Date(
`${placedText} ${currentYear}`
);

const deliveredDate =
new Date(
`${deliveredText} ${currentYear}`
);

estimatedTime =
calculateDuration(
placedDate,
deliveredDate
);
}

return {

active:
data.scanner?.active || false,

waiting:
data.scanner?.waiting || false,

trackingId:
lastDelivered.trackingId ||
null,

summary,

placedTime:
placedText,

deliveredTime:
deliveredText,

estimatedTime
};

} catch (e) {

console.error(
"DELIVERY TRACKER ERROR:",
e.response?.data ||
e.message
);

return null;
}
}

/* =========================================================
BUILD DELIVERY ESTIMATE MESSAGE
========================================================= */

function buildDeliveryEstimateMessage(
tracker
) {

if (!tracker) {

return `

⏳ Delivery Estimate:
Delivery timing is currently being checked.

The latest estimate will be available through Track Order.`;

}

if (
tracker.estimatedTime &&
tracker.placedTime &&
tracker.deliveredTime
) {

return `
📊 Latest Delivery Information
━━━━━━━━━━━━━━━━
📦 Last order placed: ${tracker.placedTime}
✅ Delivered at: ${tracker.deliveredTime}
⏱️ Estimated delivery time: ${tracker.estimatedTime} `;

}

if (tracker.active) {

return `

📊 Delivery Information

🔄 DataMart delivery scanner is currently checking orders.

⏳ Estimated delivery time:
Currently being processed.

You can use 4 - Track Order to check your order status.`;

}

return `

⏳ Delivery Estimate:
Currently being checked by the delivery system.

You can use 4 - Track Order to check your order status.`;

}

/* =========================================================
GET DATAMART ORDER STATUS
========================================================= */

async function getOrderStatus(
reference
) {

try {

const response =
await axios.get(
`${DATAMART_BASE}/order-status/${encodeURIComponent(reference)}`,
{
headers: {
"x-api-key": DATA_API_KEY
},
timeout: 15000
}
);

return response.data?.data || null;

} catch (e) {

console.error(
"ORDER STATUS ERROR:",
e.response?.data ||
e.message
);

return null;
}
}

/* =========================================================
STATUS EMOJI
========================================================= */

function statusEmoji(status) {

switch (
String(status || "")
.toLowerCase()
) {

case "completed":
return "✅";

case "processing":
return "🔄";

case "waiting":
return "⏳";

case "pending":
return "🕐";

case "failed":
return "❌";

case "refunded":
return "💸";

default:
return "📦";
}
}

/* =========================================================
TRACK ORDERS
========================================================= */

async function trackOrders(
from,
phoneNumber
) {

const phone =
normalizePhone(phoneNumber);

try {

const {
data: orders,
error
} = await supabase
.from("orders")
.select("*")
.eq(
"phone_number",
phone
)
.order(
"created_at",
{
ascending: false
}
)
.limit(3);

if (error) {

console.error(
"TRACK SEARCH ERROR:",
error
);

return sendWhatsApp(
from,
`❌ We could not check your orders right now.

Please try again later.`
);
}

if (
!orders ||
orders.length === 0
) {

return sendWhatsApp(
from,
`❌ No orders found for:

📱 ${phone}

Make sure you entered the same number used when purchasing.`
);
}

let message =
`📦 YOUR LAST ${orders.length} ORDER${orders.length === 1 ? "" : "S"}

`;

for (
let i = 0;
i < orders.length;
i++
) {

const order =
orders[i];

const reference =
order.ref ||
order.reference;

let live =
null;

if (reference) {

live =
await getOrderStatus(
reference
);
}

const status =
live?.orderStatus ||
order.status ||
"pending";

const network =
live?.network ||
order.network ||
"N/A";

const capacity =
live?.capacity ??
order.capacity ??
"N/A";

const customerNumber =
live?.phoneNumber ||
order.phone_number ||
phone;

const amount =
Number(
order.amount || 0
);

const dateTime =
formatDateTime(
live?.createdAt ||
order.created_at
);

message +=
`━━━━━━━━━━━━━━━━
${i + 1}. 📦 ORDER

🆔 Reference: ${reference || "N/A"}
📶 Network: ${network}
📦 Data: ${capacity}GB
📱 Number:${customerNumber}
💰 Amount Paid: ₵${amount.toFixed(2)}
${statusEmoji(status)} Status: ${String(status).toUpperCase()}
📅 Date: ${dateTime.date}
🕐 Time: ${dateTime.time}

━━━━━━━━━━━━━━━━

`;

if (
live &&
reference
) {

await supabase
.from("orders")
.update({
status,
updated_at:
live.updatedAt ||
new Date().toISOString()
})
.eq(
"ref",
reference
);
}
}

message +=
`\nReply HI to return to the main menu.`;

return sendWhatsApp(
from,
message
);

} catch (e) {

console.error(
"TRACK ERROR:",
e.response?.data ||
e.message
);

return sendWhatsApp(
from,
`❌ Something went wrong while checking your orders.

Please try again.`
);
}
}

/* =========================================================
INITIATE DIRECT MOBILE MONEY CHARGE
Sends a PIN prompt straight to the MOMO number's phone —
no checkout URL involved. Result arrives via /paystack-webhook.
========================================================= */

async function initiateMomoCharge(
from,
session,
bundle
) {

const ref =
"REF-" + Date.now();

const provider =
momoProvider(session.network);

if (!provider) {

console.error(
"MOMO PROVIDER NOT FOUND FOR:",
session.network
);

return sendWhatsApp(
from,
"❌ We could not start payment for this network. Please contact support."
);
}

try {

const charge =
await axios.post(

"https://api.paystack.co/charge",

{
email:
`${from}@test.com`,

amount:
Math.round(
bundle.price * 100
),

currency:
"GHS",

reference:
ref,

mobile_money: {
phone:
session.momo_number,

provider
}
},

{
headers: {
Authorization:
`Bearer ${PAYSTACK_SECRET}`,

"Content-Type":
"application/json"
},

timeout: 30000
}
);

const status =
charge.data?.data?.status;

console.log(
"MOMO CHARGE STATUS:",
status
);

if (status === "send_otp") {

await supabase
.from("sessions")
.update({
ref,
step: 9
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,

`📲 An OTP has been sent to ${session.momo_number}.

Please reply with the OTP to complete your payment.`
);
}

await supabase
.from("sessions")
.update({
ref,
step: 5
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,

`📲 A payment prompt has been sent to ${session.momo_number}.

Please check that phone and enter your Mobile Money PIN to complete payment of ₵${bundle.price.toFixed(2)}.

You'll get a message here once it's confirmed.`
);

} catch (e) {

console.error(
"MOMO CHARGE ERROR:",
e.response?.data ||
e.message
);

await supabase
.from("sessions")
.update({
step: 1
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,

`❌ We could not start payment right now.

Please reply HI to try again.`
);
}
}

/* =========================================================
SUBMIT MOMO OTP
(only needed if the charge above came back "send_otp")
========================================================= */

async function submitMomoOtp(
from,
session,
otp
) {

try {

await axios.post(

"https://api.paystack.co/charge/submit_otp",

{
otp,
reference: session.ref
},

{
headers: {
Authorization:
`Bearer ${PAYSTACK_SECRET}`,

"Content-Type":
"application/json"
},

timeout: 30000
}
);

await supabase
.from("sessions")
.update({
step: 5
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"✅ OTP received. Confirming your payment now — you'll get a message here once it's done."
);

} catch (e) {

console.error(
"SUBMIT OTP ERROR:",
e.response?.data ||
e.message
);

return sendWhatsApp(
from,

`❌ That OTP did not work.

Please reply with the OTP again, or reply HI to start over.`
);
}
}

/* =========================================================
WEBHOOK VERIFY
========================================================= */

app.get(
"/webhook",
(req, res) => {

res.send(
req.query["hub.challenge"]
);

}
);

/* =========================================================
WHATSAPP WEBHOOK
========================================================= */

app.post(
"/webhook",
async (req, res) => {

res.sendStatus(200);

try {

const msg =
req.body.entry?.[0]
?.changes?.[0]
?.value?.messages?.[0];

if (!msg) return;

const from =
msg.from;

const text =
(msg.text?.body || "")
.trim();

console.log(
"📩",
from,
text
);

let {
data: session
} = await supabase
.from("sessions")
.select("*")
.eq(
"phone",
from
)
.maybeSingle();

/* =====================================================
CREATE SESSION
===================================================== */

if (!session) {

await supabase
.from("sessions")
.insert([
{
phone: from,
step: 1
}
]);

return sendWhatsApp(
from,
MENU
);
}

/* =====================================================
RESET
===================================================== */

if (
/^(hi|hello|start)$/i.test(
text
)
) {

await supabase
.from("sessions")
.update({
step: 1
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
MENU
);
}

/* =====================================================
STEP 1 - MAIN MENU
===================================================== */

if (
session.step === 1
) {

let network;

if (text === "1") {

network = "MTN";

} else if (text === "2") {

network = "AIRTELTIGO";

} else if (text === "3") {

network = "TELECEL";

}

else if (text === "4") {

await supabase
.from("sessions")
.update({
step: 6
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,

`📦 TRACK YOUR ORDER

Please enter the phone number used when you purchased your data.

Example:
0241234567`
);
}

else if (text === "5") {

await supabase
.from("sessions")
.update({
step: 50,
bundle: JSON.stringify({
type: "netflix"
}),
momo_number: null,
phone_number: null
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,

`📺 Netflix Subscription — ₵${NETFLIX_PRICE}

Select the network for the Mobile Money number you'll pay from:

1 - MTN
2 - AirtelTigo
3 - Telecel`
);
}

else if (text === "6") {

await supabase
.from("sessions")
.update({
step: 30,
bundle: null,
momo_number: null,
phone_number: null
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,

`🪪 AFA Registration — ₵${AFA_PRICE}

Select the network for the Mobile Money number you'll pay from:

1 - MTN
2 - AirtelTigo
3 - Telecel`
);
}

else if (text === "7") {

await supabase
.from("sessions")
.update({
step: 10,
network: "MASHUP"
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,

`📶 MTN MashUp Bundle

Enter the amount you want to pay (₵${MASHUP_MIN_AMOUNT} - ₵${MASHUP_MAX_AMOUNT}):

Example: 5

The data + minutes mix you get depends on what MTN offers for that amount — this will be applied to your number manually.`
);
}

else {

return sendWhatsApp(
from,
MENU
);
}

await supabase
.from("sessions")
.update({
step: 2,
network
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
MENUS[network]
);
}

/* =====================================================
STEP 2 - SELECT BUNDLE
===================================================== */

if (
session.step === 2
) {

const bundle =
PACKAGES[
session.network
]?.[text];

if (!bundle) {

return sendWhatsApp(
from,
"Invalid option ❌ Choose an option to continue"
);
}

await supabase
.from("sessions")
.update({
step: 3,
bundle: text
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"Enter phone number to receive the data on:"
);
}

/* =====================================================
STEP 3 - DELIVERY PHONE NUMBER
(the number the data bundle is delivered to)
===================================================== */

if (
session.step === 3
) {

const phone =
normalizePhone(text);

if (
phone.length !== 10 ||
!phone.startsWith("0")
) {

return sendWhatsApp(
from,
"Invalid number ❌ Enter a correct Ghana phone number to continue"
);
}

await supabase
.from("sessions")
.update({
phone_number: phone,
step: 8
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,

`📲 Enter the Mobile Money number to pay from:

(This can be the same number or a different one)`
);
}

/* =====================================================
STEP 8 - MOMO PAYMENT NUMBER
Shows the Confirm Order screen with BOTH numbers
===================================================== */

if (
session.step === 8
) {

const momoNumber =
normalizePhone(text);

if (
momoNumber.length !== 10 ||
!momoNumber.startsWith("0")
) {

return sendWhatsApp(
from,
"Invalid number ❌ Enter a correct Ghana Mobile Money number to continue"
);
}

const bundle =
PACKAGES[
session.network
][session.bundle];

const {
error: momoUpdateError
} = await supabase
.from("sessions")
.update({
momo_number: momoNumber,
step: 4
})
.eq(
"phone",
from
);

if (momoUpdateError) {

console.error(
"❌ FAILED TO SAVE MOMO NUMBER / STEP 4:",
momoUpdateError
);

return sendWhatsApp(
from,
"❌ Something went wrong saving your details. Please reply HI and try again."
);
}

const tracker =
await getDeliveryEstimate();

const estimateMessage =
buildDeliveryEstimateMessage(
tracker
);

return sendWhatsApp(
from,

`Confirm Order: Your order will be delivered ✅

📶 Network: ${session.network}
📦 Data: ${bundle.capacity}GB
💰 Amount: ₵${bundle.price.toFixed(2)}
📱 Data goes to: ${session.phone_number}
💳 Pay from (Momo): ${momoNumber}

${estimateMessage}

Reply YES to pay or NO to cancel`
);
}

/* =====================================================
STEP 4 - CONFIRM PAYMENT
YES triggers the direct momo PIN prompt (no link)
===================================================== */

if (
session.step === 4
) {

if (
/^no$/i.test(text)
) {

await supabase
.from("sessions")
.update({
step: 1
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"❌ Cancelled\n\n" +
MENU
);
}

if (
/^yes$/i.test(text)
) {

const bundle =
PACKAGES[
session.network
][session.bundle];

return initiateMomoCharge(
from,
session,
bundle
);
}

return sendWhatsApp(
from,
"Reply YES to pay or NO to cancel."
);
}

/* =====================================================
STEP 9 - AWAITING OTP
(only reached if Paystack requested one)
===================================================== */

if (
session.step === 9
) {

return submitMomoOtp(
from,
session,
text.trim()
);
}

/* =====================================================
STEP 10 - MASHUP CUSTOM AMOUNT
===================================================== */

if (
session.step === 10
) {

const amountText =
text.trim();

if (
!isValidMashupAmount(
amountText
)
) {

return sendWhatsApp(
from,
`Invalid amount ❌ Enter an amount between ₵${MASHUP_MIN_AMOUNT} and ₵${MASHUP_MAX_AMOUNT} (e.g. 5)`
);
}

await supabase
.from("sessions")
.update({
bundle: amountText,
step: 11
})
.eq(
"phone",
from
);

const combos =
getMashupCombos(amountText);

let comboMenu =
`MashUp ₵${amountText} — choose a package:\n\n`;

combos.forEach(
(c, i) => {

comboMenu +=
`${i + 1} - ${c.label}\n`;

}
);

comboMenu +=
`\nChoose an option to continue`;

return sendWhatsApp(
from,
comboMenu
);
}

/* =====================================================
STEP 11 - MASHUP COMBO SELECTION
===================================================== */

if (
session.step === 11
) {

const combos =
getMashupCombos(
session.bundle
);

const combo =
combos[
Number(text) - 1
];

if (!combo) {

return sendWhatsApp(
from,
"Invalid option ❌ Choose an option to continue"
);
}

await supabase
.from("sessions")
.update({
bundle: `${session.bundle}|${combo.id}`,
step: 12
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"Enter phone number to receive the MashUp bundle on:"
);
}

/* =====================================================
STEP 12 - MASHUP DELIVERY PHONE NUMBER
===================================================== */

if (
session.step === 12
) {

const phone =
normalizePhone(text);

if (
phone.length !== 10 ||
!phone.startsWith("0")
) {

return sendWhatsApp(
from,
"Invalid number ❌ Enter a correct Ghana phone number to continue"
);
}

await supabase
.from("sessions")
.update({
phone_number: phone,
step: 13
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,

`📲 Enter the Mobile Money number to pay from:

(This can be the same number or a different one)`
);
}

/* =====================================================
STEP 13 - MASHUP MOMO PAYMENT NUMBER
Shows the Confirm Order screen
===================================================== */

if (
session.step === 13
) {

const momoNumber =
normalizePhone(text);

if (
momoNumber.length !== 10 ||
!momoNumber.startsWith("0")
) {

return sendWhatsApp(
from,
"Invalid number ❌ Enter a correct Ghana Mobile Money number to continue"
);
}

const parsed =
parseMashupSelection(
session.bundle
);

if (!parsed) {

await supabase
.from("sessions")
.update({
step: 1
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"❌ Something went wrong with your selection. Please reply HI and try again."
);
}

const {
error: momoUpdateError
} = await supabase
.from("sessions")
.update({
momo_number: momoNumber,
step: 14
})
.eq(
"phone",
from
);

if (momoUpdateError) {

console.error(
"❌ FAILED TO SAVE MOMO NUMBER / STEP 14:",
momoUpdateError
);

return sendWhatsApp(
from,
"❌ Something went wrong saving your details. Please reply HI and try again."
);
}

return sendWhatsApp(
from,

`Confirm Order: Your MashUp will be applied manually ✅

📶 Network: MTN (MashUp)
📦 Package: ${parsed.combo.label}
💰 Amount: ₵${parsed.amount.toFixed(2)}
📱 Data goes to: ${session.phone_number}
💳 Pay from (Momo): ${momoNumber}

⏳ Note: MashUp bundles are applied manually and may take a little longer than regular data orders.

Reply YES to pay or NO to cancel`
);
}

/* =====================================================
STEP 14 - CONFIRM MASHUP PAYMENT
YES triggers the direct momo PIN prompt (no link)
===================================================== */

if (
session.step === 14
) {

if (
/^no$/i.test(text)
) {

await supabase
.from("sessions")
.update({
step: 1
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"❌ Cancelled\n\n" +
MENU
);
}

if (
/^yes$/i.test(text)
) {

const parsed =
parseMashupSelection(
session.bundle
);

if (!parsed) {

await supabase
.from("sessions")
.update({
step: 1
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"❌ Something went wrong with your selection. Please reply HI and try again."
);
}

const bundle = {
price: parsed.amount,
capacity: parsed.combo.label
};

return initiateMomoCharge(
from,
session,
bundle
);
}

return sendWhatsApp(
from,
"Reply YES to pay or NO to cancel."
);
}

/* =====================================================
STEP 30 - AFA: MOMO NETWORK SELECTION
===================================================== */

if (
session.step === 30
) {

let network = null;

if (text === "1") network = "MTN";
else if (text === "2") network = "AIRTELTIGO";
else if (text === "3") network = "TELECEL";

if (!network) {

return sendWhatsApp(
from,
"Invalid option ❌ Reply 1 for MTN, 2 for AirtelTigo, or 3 for Telecel"
);
}

await supabase
.from("sessions")
.update({
network,
step: 31
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"Enter the Full Name of the applicant:"
);
}

/* =====================================================
STEP 31 - AFA: FULL NAME
===================================================== */

if (
session.step === 31
) {

const fullName =
text.trim();

if (fullName.length < 3) {

return sendWhatsApp(
from,
"Invalid name ❌ Enter the applicant's full name (e.g. John Doe)"
);
}

await supabase
.from("sessions")
.update({
bundle:
mergeAfaField(
session,
"full_name",
fullName
),
step: 32
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"Enter the applicant's Phone Number (e.g. 0241234567):"
);
}

/* =====================================================
STEP 32 - AFA: PHONE NUMBER
===================================================== */

if (
session.step === 32
) {

const afaPhone =
normalizePhone(text);

if (
afaPhone.length !== 10 ||
!afaPhone.startsWith("0")
) {

return sendWhatsApp(
from,
"Invalid number ❌ Enter a correct Ghana phone number (e.g. 0241234567)"
);
}

await supabase
.from("sessions")
.update({
bundle:
mergeAfaField(
session,
"phone_number",
afaPhone
),
step: 33
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"Enter the applicant's Ghana Card Number (e.g. GHA-000000000-0):"
);
}

/* =====================================================
STEP 33 - AFA: GHANA CARD NUMBER
===================================================== */

if (
session.step === 33
) {

const idNumber =
text.trim().toUpperCase();

if (!isValidGhanaCard(idNumber)) {

return sendWhatsApp(
from,
"Invalid Ghana Card number ❌ Use the format GHA-000000000-0"
);
}

await supabase
.from("sessions")
.update({
bundle:
mergeAfaField(
session,
"id_number",
idNumber
),
step: 34
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"Enter the applicant's Location (e.g. Tafo, Kumasi):"
);
}

/* =====================================================
STEP 34 - AFA: LOCATION
===================================================== */

if (
session.step === 34
) {

const location =
text.trim();

if (location.length < 2) {

return sendWhatsApp(
from,
"Invalid location ❌ Enter the applicant's location (e.g. Tafo, Kumasi)"
);
}

await supabase
.from("sessions")
.update({
bundle:
mergeAfaField(
session,
"location",
location
),
step: 35
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"Enter the applicant's Date of Birth (DD/MM/YYYY, e.g. 15/06/1995):"
);
}

/* =====================================================
STEP 35 - AFA: DATE OF BIRTH
===================================================== */

if (
session.step === 35
) {

const dob =
parseAfaDob(text);

if (!dob) {

return sendWhatsApp(
from,
"Invalid date ❌ Use the format DD/MM/YYYY (e.g. 15/06/1995)"
);
}

await supabase
.from("sessions")
.update({
bundle:
mergeAfaField(
session,
"dob",
dob
),
step: 36
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"Enter the applicant's Occupation (e.g. Student, Teacher, Business Owner):"
);
}

/* =====================================================
STEP 36 - AFA: OCCUPATION
===================================================== */

if (
session.step === 36
) {

const occupation =
text.trim();

if (occupation.length < 2) {

return sendWhatsApp(
from,
"Invalid occupation ❌ Enter the applicant's occupation (e.g. Trader)"
);
}

await supabase
.from("sessions")
.update({
bundle:
mergeAfaField(
session,
"occupation",
occupation
),
step: 37
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,

`📲 Enter the Mobile Money number to pay from (${session.network}):`
);
}

/* =====================================================
STEP 37 - AFA: MOMO PAYMENT NUMBER
Shows the Confirm Order screen
===================================================== */

if (
session.step === 37
) {

const momoNumber =
normalizePhone(text);

if (
momoNumber.length !== 10 ||
!momoNumber.startsWith("0")
) {

return sendWhatsApp(
from,
"Invalid number ❌ Enter a correct Ghana Mobile Money number to continue"
);
}

const afaData =
getAfaData(session);

if (!afaData) {

await supabase
.from("sessions")
.update({
step: 1
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"❌ Something went wrong with your form. Please reply HI and try again."
);
}

const {
error: momoUpdateError
} = await supabase
.from("sessions")
.update({
momo_number: momoNumber,
step: 38
})
.eq(
"phone",
from
);

if (momoUpdateError) {

console.error(
"❌ FAILED TO SAVE MOMO NUMBER / STEP 38:",
momoUpdateError
);

return sendWhatsApp(
from,
"❌ Something went wrong saving your details. Please reply HI and try again."
);
}

return sendWhatsApp(
from,

`Confirm AFA Registration ✅

👤 Full Name: ${afaData.full_name}
📱 Phone: ${afaData.phone_number}
🪪 Ghana Card: ${afaData.id_number}
📍 Location: ${afaData.location}
🎂 DOB: ${afaData.dob}
💼 Occupation: ${afaData.occupation}

💰 Amount: ₵${AFA_PRICE.toFixed(2)}
💳 Pay from (Momo, ${session.network}): ${momoNumber}

Reply YES to pay or NO to cancel`
);
}

/* =====================================================
STEP 38 - CONFIRM AFA PAYMENT
YES triggers the direct momo PIN prompt (no link)
===================================================== */

if (
session.step === 38
) {

if (
/^no$/i.test(text)
) {

await supabase
.from("sessions")
.update({
step: 1
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"❌ Cancelled\n\n" +
MENU
);
}

if (
/^yes$/i.test(text)
) {

const afaData =
getAfaData(session);

if (!afaData) {

await supabase
.from("sessions")
.update({
step: 1
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"❌ Something went wrong with your form. Please reply HI and try again."
);
}

const bundle = {
price: AFA_PRICE,
capacity: "AFA Registration"
};

return initiateMomoCharge(
from,
session,
bundle
);
}

return sendWhatsApp(
from,
"Reply YES to pay or NO to cancel."
);
}

/* =====================================================
STEP 50 - NETFLIX: MOMO NETWORK SELECTION
===================================================== */

if (
session.step === 50
) {

let network = null;

if (text === "1") network = "MTN";
else if (text === "2") network = "AIRTELTIGO";
else if (text === "3") network = "TELECEL";

if (!network) {

return sendWhatsApp(
from,
"Invalid option ❌ Reply 1 for MTN, 2 for AirtelTigo, or 3 for Telecel"
);
}

await supabase
.from("sessions")
.update({
network,
step: 51
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"Enter the Mobile Money number to pay from:"
);
}

/* =====================================================
STEP 51 - NETFLIX: MOMO PAYMENT NUMBER
Shows the Confirm Order screen
===================================================== */

if (
session.step === 51
) {

const momoNumber =
normalizePhone(text);

if (
momoNumber.length !== 10 ||
!momoNumber.startsWith("0")
) {

return sendWhatsApp(
from,
"Invalid number ❌ Enter a correct Ghana Mobile Money number to continue"
);
}

const {
error: momoUpdateError
} = await supabase
.from("sessions")
.update({
momo_number: momoNumber,
step: 52
})
.eq(
"phone",
from
);

if (momoUpdateError) {

console.error(
"❌ FAILED TO SAVE MOMO NUMBER / STEP 52:",
momoUpdateError
);

return sendWhatsApp(
from,
"❌ Something went wrong saving your details. Please reply HI and try again."
);
}

return sendWhatsApp(
from,

`Confirm Netflix Subscription ✅

📺 Netflix Subscription
💰 Amount: ₵${NETFLIX_PRICE.toFixed(2)}
💳 Pay from (Momo, ${session.network}): ${momoNumber}

Reply YES to pay or NO to cancel`
);
}

/* =====================================================
STEP 52 - CONFIRM NETFLIX PAYMENT
YES triggers the direct momo PIN prompt (no link)
===================================================== */

if (
session.step === 52
) {

if (
/^no$/i.test(text)
) {

await supabase
.from("sessions")
.update({
step: 1
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"❌ Cancelled\n\n" +
MENU
);
}

if (
/^yes$/i.test(text)
) {

const bundle = {
price: NETFLIX_PRICE,
capacity: "Netflix Subscription"
};

return initiateMomoCharge(
from,
session,
bundle
);
}

return sendWhatsApp(
from,
"Reply YES to pay or NO to cancel."
);
}

/* =====================================================
STEP 53 - NETFLIX: AWAITING REFERENCE CODE
===================================================== */

if (
session.step === 53
) {

const netflixData =
getNetflixData(session);

if (!netflixData) {

await supabase
.from("sessions")
.update({
step: 1
})
.eq(
"phone",
from
);

return sendWhatsApp(
from,
"❌ Something went wrong with your order. Please reply HI and try again."
);
}

if (netflixData.used) {

return sendWhatsApp(
from,

`❌ This reference code has already been used to fetch a sign-in code.

Need to sign in again (e.g. a different device)? Pay again via the main menu to get a new reference code.

SEND: hi to return to the main menu.`
);
}

const enteredCode =
text.trim().toUpperCase();

if (
enteredCode !==
netflixData.refCode
) {

return sendWhatsApp(
from,

`Please reply with your reference code exactly as sent: *${netflixData.refCode}*

This confirms it's really you before we fetch your Netflix sign-in code.`
);
}

await sendWhatsApp(
from,
"🔄 Getting you the code...., one moment..."
);

const result =
await fetchNetflixSignIn(
netflixData.paidAt
);

/*
Only burn the one-time reference once we've actually
delivered something — "none"/"error" results let the
customer try the same code again.
*/

if (
result.type === "code" ||
result.type === "approved" ||
result.type === "link_flagged"
) {

await supabase
.from("sessions")
.update({
bundle: JSON.stringify({
...netflixData,
used: true
})
})
.eq(
"phone",
from
);
}

if (result.type === "code") {

return sendWhatsApp(
from,

`✅ Your Netflix sign-in code is:

*${result.value}*

Enter this on Netflix to complete sign-in.

SEND: hi to return to the main menu.`
);
}

if (result.type === "approved") {

return sendWhatsApp(
from,

`✅ Your Netflix sign-in has been approved! You should now be signed in.

SEND: hi to return to the main menu.`
);
}

if (result.type === "link_flagged") {

await sendWhatsApp(
"233547100951",

`🔔 NETFLIX APPROVAL NEEDED

Netflix sent an approval link instead of a code for a customer sign-in. Please open this link to approve:
${result.link}

Customer: ${session.phone}`
);

return sendWhatsApp(
from,
"⏳ We're finalizing your sign-in approval, this should complete shortly. If you don't see it go through, contact 0547100951 (@stony11)."
);
}

if (result.type === "error") {

return sendWhatsApp(
from,

`❌ We could not check the email right now. Please reply *${netflixData.refCode}* again in a moment, or contact 0547100951 (@stony11) for help.`
);
}

return sendWhatsApp(
from,

`❌ We couldn't find a code or sign-in request yet.

Make sure you've chosen "Sign in" on Netflix using ${NETFLIX_EMAIL}, then reply *${netflixData.refCode}* again in a moment.`
);
}

/* =====================================================
STEP 6 - TRACKING PHONE
===================================================== */

if (
session.step === 6
) {

const trackingPhone =
normalizePhone(text);

if (
trackingPhone.length !== 10 ||
!trackingPhone.startsWith("0")
) {

return sendWhatsApp(
from,

`❌ Invalid phone number.

Please enter a valid Ghana phone number.

Example:
0241234567`
);
}

return trackOrders(
from,
trackingPhone
);
}

} catch (e) {

console.error(
"BOT ERROR:",
e.response?.data ||
e.message
);

}
}
);

/* =========================================================
PAYSTACK WEBHOOK
========================================================= */

app.post(
"/paystack-webhook",
async (req, res) => {

res.sendStatus(200);

try {

console.log(
"🔥 PAYSTACK WEBHOOK HIT"
);

const event =
req.body;

if (
event.event !==
"charge.success"
) {
return;
}

const ref =
event.data.reference;

const paidAmount =
Number(
event.data.amount
) / 100;

console.log(
"💰 ACTUAL AMOUNT PAID:",
paidAmount
);

const {
data: session
} = await supabase
.from("sessions")
.select("*")
.eq(
"ref",
ref
)
.maybeSingle();

if (!session) {

console.error(
"❌ SESSION NOT FOUND:",
ref
);

return;
}

/* =====================================================
MASHUP ORDERS — fulfilled MANUALLY, no DataMart call
===================================================== */

if (session.network === "MASHUP") {

const parsed =
parseMashupSelection(
session.bundle
);

if (!parsed) {

console.error(
"❌ MASHUP SELECTION NOT FOUND FOR SESSION:",
session.phone,
session.bundle
);

return;
}

const mashupRef =
"MASHUP-" + ref;

const {
error: orderError
} = await supabase
.from("orders")
.insert([

{
whatsapp_phone:
session.phone,

phone_number:
normalizePhone(
session.phone_number
),

momo_number:
normalizePhone(
session.momo_number ||
session.phone_number
),

ref:
mashupRef,

network:
"MASHUP",

bundle:
session.bundle,

capacity:
parsed.combo.label,

amount:
paidAmount,

status:
"pending_manual",

created_at:
new Date().toISOString(),

updated_at:
new Date().toISOString()
}

]);

if (orderError) {

console.error(
"❌ MASHUP ORDER SAVE ERROR:",
orderError
);

} else {

console.log(
"✅ MASHUP ORDER SAVED:",
mashupRef
);

}

/*
Alert the admin to go dial *567*2# and
apply this manually.
*/

await sendWhatsApp(
"233547100951",

`🔔 NEW MASHUP ORDER — MANUAL ACTION NEEDED

💰 Amount: ₵${parsed.amount.toFixed(2)}
📦 Option selected: ${parsed.combo.label}
📱 Deliver to: ${session.phone_number}
💳 Paid via momo: ${session.momo_number}
💵 Confirmed paid: ₵${paidAmount.toFixed(2)}

Dial *567*2#, select MashUp Offers, enter ₵${parsed.amount.toFixed(2)}, pick the option matching "${parsed.combo.label}", and apply it to the number above.`
);

await sendWhatsApp(
session.phone,

`✅ PAYMENT RECEIVED! 🎉

📦 Package: ${parsed.combo.label}
💰 Amount Paid: ₵${paidAmount.toFixed(2)}
📱 Number: ${session.phone_number}

This MashUp bundle is being applied to your number manually and should land shortly.

For assistance: Whatsapp 0547100951 (@stony11)

SEND: hi / hello / start To buy again.`
);

console.log(
"✅ MASHUP CUSTOMER NOTIFIED"
);

return;
}

/* =====================================================
AFA REGISTRATION ORDERS — fully automated via API
===================================================== */

const afaData =
getAfaData(session);

if (afaData) {

const afaExternalId =
"WA-" + ref;

try {

const afaResponse =
await axios.post(

`${AFA_BASE}/registrations`,

{
external_order_id:
afaExternalId,

full_name:
afaData.full_name,

phone_number:
afaData.phone_number,

id_type:
"Ghana Card",

id_number:
afaData.id_number,

location:
afaData.location,

dob:
afaData.dob,

occupation:
afaData.occupation
},

{
headers: {
"X-API-Key":
AFA_API_KEY,

"Content-Type":
"application/json",

"Idempotency-Key":
afaExternalId
},

timeout:
30000
}
);

console.log(
"AFA API RESPONSE:",
afaResponse.data
);

const afaOrder =
afaResponse.data?.data ||
afaResponse.data ||
{};

const afaStatus =
afaOrder.status ||
"pending";

const afaOrderId =
afaOrder.id ||
afaOrder.order_id ||
null;

const {
error: afaOrderError
} = await supabase
.from("orders")
.insert([

{
whatsapp_phone:
session.phone,

phone_number:
normalizePhone(
afaData.phone_number
),

momo_number:
normalizePhone(
session.momo_number
),

ref:
afaExternalId,

network:
"AFA",

bundle:
afaData.full_name,

capacity:
"AFA Registration",

amount:
paidAmount,

status:
afaStatus,

created_at:
new Date().toISOString(),

updated_at:
new Date().toISOString()
}

]);

if (afaOrderError) {

console.error(
"❌ AFA ORDER SAVE ERROR:",
afaOrderError
);

} else {

console.log(
"✅ AFA ORDER SAVED:",
afaExternalId,
"| AFA order id:",
afaOrderId
);

}

await sendWhatsApp(
session.phone,

`✅ PAYMENT RECEIVED! 🎉

🪪 AFA Registration submitted for: ${afaData.full_name}
📱 Phone: ${afaData.phone_number}
💰 Amount Paid: ₵${paidAmount.toFixed(2)}
📌 Status: ${afaStatus}

You'll be notified once it's approved.

For assistance: Whatsapp 0547100951 (@stony11)

SEND: hi / hello / start To buy again.`
);

console.log(
"✅ AFA CUSTOMER NOTIFIED"
);

} catch (afaError) {

console.error(
"❌ AFA API ERROR:",
afaError.response?.data ||
afaError.message
);

await supabase
.from("orders")
.insert([

{
whatsapp_phone:
session.phone,

phone_number:
normalizePhone(
afaData.phone_number
),

momo_number:
normalizePhone(
session.momo_number
),

ref:
afaExternalId,

network:
"AFA",

bundle:
afaData.full_name,

capacity:
"AFA Registration",

amount:
paidAmount,

status:
"pending_manual",

created_at:
new Date().toISOString(),

updated_at:
new Date().toISOString()
}

]);

await sendWhatsApp(
"233547100951",

`🔔 AFA REGISTRATION FAILED — MANUAL ACTION NEEDED

The AFA API call failed after payment was confirmed.

👤 Full Name: ${afaData.full_name}
📱 Phone: ${afaData.phone_number}
🪪 Ghana Card: ${afaData.id_number}
📍 Location: ${afaData.location}
🎂 DOB: ${afaData.dob}
💼 Occupation: ${afaData.occupation}
💵 Confirmed paid: ₵${paidAmount.toFixed(2)}

Check the afaregistration.com dashboard (wallet balance, API status) or submit this manually, then update the order.`
);

await sendWhatsApp(
session.phone,

`✅ Payment received! Your AFA registration for ${afaData.full_name} is being processed and may take a little longer than usual.

For assistance: Whatsapp 0547100951 (@stony11)

SEND: hi / hello / start To buy again.`
);

}

return;
}

/* =====================================================
NETFLIX ORDERS — customer signs in themselves,
bot fetches the code/link from Gmail on request
===================================================== */

const netflixData =
getNetflixData(session);

if (netflixData) {

const netflixRef =
"NETFLIX-" + ref;

const paidAt =
new Date().toISOString();

const refCode =
generateNetflixRefCode();

await supabase
.from("sessions")
.update({
step: 53,
bundle: JSON.stringify({
type: "netflix",
paidAt,
refCode,
used: false
})
})
.eq(
"phone",
session.phone
);

const {
error: netflixOrderError
} = await supabase
.from("orders")
.insert([

{
whatsapp_phone:
session.phone,

phone_number:
normalizePhone(
session.phone
),

momo_number:
normalizePhone(
session.momo_number
),

ref:
netflixRef,

network:
"NETFLIX",

bundle:
refCode,

capacity:
"Netflix Subscription",

amount:
paidAmount,

status:
"pending_code_request",

created_at:
new Date().toISOString(),

updated_at:
new Date().toISOString()
}

]);

if (netflixOrderError) {

console.error(
"❌ NETFLIX ORDER SAVE ERROR:",
netflixOrderError
);

} else {

console.log(
"✅ NETFLIX ORDER SAVED:",
netflixRef,
"| REF CODE:",
refCode
);

}

await sendWhatsApp(
session.phone,

`✅ PAYMENT RECEIVED! 🎉

📺 Netflix Subscription — ₵${paidAmount.toFixed(2)}

YOUR REFERENCE CODE: *${refCode}*
⚠️ Save this. It can be used only ONCE to fetch a sign-in code. If you need to sign in again later (e.g. a different device), you'll need to pay again.

STEP 1
Sign in to Netflix with this email:
${NETFLIX_EMAIL}

• Open Netflix on your phone, TV, or laptop
• Choose "Sign in" and enter the email above
• Netflix will send a sign-in code to that email

STEP 2
Once you've done that, reply here with your reference code above (${refCode}) to get your Netflix sign-in code.

For assistance: Whatsapp 0547100951 (@stony11)`
);

console.log(
"✅ NETFLIX CUSTOMER NOTIFIED"
);

return;
}

const bundle =
PACKAGES[
session.network
]?.[session.bundle];

if (!bundle) {

console.error(
"❌ BUNDLE NOT FOUND"
);

return;
}

/* =====================================================
SEND PURCHASE TO DATAMART
(always uses the DELIVERY number, not the momo number)
===================================================== */

const delivery =
await axios.post(

`${DATAMART_BASE}/purchase`,

{
phoneNumber:
session.phone_number,

network:
bundle.apiNetwork,

capacity:
bundle.capacity,

gateway:
"wallet"
},

{
headers: {
"x-api-key":
DATA_API_KEY,

"Content-Type":
"application/json"
},

timeout:
30000
}
);

console.log(
"DELIVERY:",
delivery.data
);

const datamartData =
delivery.data?.data ||
delivery.data ||
{};

const datamartReference =
datamartData.reference ||
datamartData.orderReference ||
datamartData.order_reference;

const datamartOrderId =
datamartData.orderId ||
datamartData.order_id ||
null;

const datamartStatus =
datamartData.orderStatus ||
datamartData.status ||
"pending";

if (datamartReference) {

const {
error: orderError
} = await supabase
.from("orders")
.insert([

{
whatsapp_phone:
session.phone,

phone_number:
normalizePhone(
session.phone_number
),

momo_number:
normalizePhone(
session.momo_number ||
session.phone_number
),

ref:
datamartReference,

network:
session.network,

bundle:
session.bundle,

capacity:
bundle.capacity,

amount:
paidAmount,

status:
datamartStatus,

created_at:
datamartData.createdAt ||
new Date().toISOString(),

updated_at:
datamartData.updatedAt ||
new Date().toISOString()
}

]);

if (orderError) {

console.error(
"❌ ORDER SAVE ERROR:",
orderError
);

} else {

console.log(
"✅ ORDER HISTORY SAVED:",
datamartReference
);

}

}

const tracker =
await getDeliveryEstimate();

const estimateMessage =
buildDeliveryEstimateMessage(
tracker
);

let successMessage =
`✅ ORDER PLACED SUCCESSFULLY! 🎉

🆔 Order Reference: ${datamartReference || ref}
📦 Data: ${bundle.capacity}GB
📶 Network: ${session.network}
📱 Number: ${session.phone_number}
💰 Amount Paid: ₵${paidAmount.toFixed(2)}

${estimateMessage}

📦 You can track your order anytime:
For assistance: Whatsapp 0547100951 (@stony11)

SEND: hi / hello / start To buy again.`;

await sendWhatsApp(
session.phone,
successMessage
);

console.log(
"✅ CUSTOMER NOTIFIED"
);

console.log(
"DATAMART ORDER ID:",
datamartOrderId
);

console.log(
"DATAMART REFERENCE:",
datamartReference
);

} catch (e) {

console.error(
"WEBHOOK ERROR:",
e.response?.data ||
e.message
);

}
}
);

/* =========================================================
ADMIN PAGE
========================================================= */

app.get(
"/admin",
(req, res) => {

res.sendFile(
__dirname +
"/admin.html"
);

}
);

/* =========================================================
ADMIN DATA
========================================================= */

app.get(
"/admin-data",
async (req, res) => {

try {

const {
data
} = await supabase
.from("sessions")
.select("*");

const sessions =
data || [];

let revenue = 0;

sessions.forEach(
x => {

if (
x.step === 5
) {

const bundle =
PACKAGES[
x.network
]?.[x.bundle];

if (bundle) {

revenue +=
bundle.price;

}

}

}
);

res.json({

total:
sessions.length,

delivered:
sessions.filter(
x =>
x.step === 5
).length,

pending:
sessions.filter(
x =>
x.step < 5
).length,

revenue,

orders:
sessions
.slice(-10)
.reverse()

});

} catch (e) {

res.json({
error:
e.message
});

}
}
);

/* =========================================================
START SERVER
========================================================= */

app.listen(
PORT,
() => {

console.log(
"🚀 RUNNING ON",
PORT
);

}
);
