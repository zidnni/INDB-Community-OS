import {NextResponse} from "next/server";

const QR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function setQrLightCookies(response: NextResponse) {
  response.cookies.set("theme", "light", {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  response.cookies.set("entry", "qr", {
    path: "/",
    maxAge: QR_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  response.cookies.set("qr_ref", "1", {
    path: "/",
    maxAge: QR_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  response.cookies.set("NEXT_LOCALE", "ar", {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}

export async function GET() {
  const html = `<!DOCTYPE html>
<html class="light" lang="ar" dir="rtl" style="background:#f5f7fa;color-scheme:light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>
(function(){
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme="light";
  document.cookie="theme=light;path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax";
  document.cookie="entry=qr;path=/;max-age=${QR_COOKIE_MAX_AGE};samesite=lax";
  document.cookie="qr_ref=1;path=/;max-age=${QR_COOKIE_MAX_AGE};samesite=lax";
  document.cookie="NEXT_LOCALE=ar;path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax";
  try{localStorage.setItem("theme","light")}catch(e){}
  location.replace("/ar");
})();
<\/script>
</head>
<body style="margin:0;background:#f5f7fa"></body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: {"content-type": "text/html"},
  });
  setQrLightCookies(response);
  return response;
}
