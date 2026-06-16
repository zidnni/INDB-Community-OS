export async function GET() {
  const html = `<!DOCTYPE html>
<html style="background:#f5f7fa;color-scheme:light">
<head>
<meta charset="utf-8">
<script>
(function(){
  document.cookie="qr_ref=1;path=/;max-age=86400;samesite=lax";
  try{localStorage.setItem("theme","light")}catch(e){}
  document.documentElement.style.colorScheme="light";
  location.replace("/ar");
})();
<\/script>
</head>
<body></body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {"content-type": "text/html"},
  });
}
