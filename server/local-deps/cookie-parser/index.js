function parseCookies(cookieHeader) {
  const cookies = {};

  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies;
  }

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...rest] = cookie.split('=');
    const trimmedName = name?.trim();

    if (!trimmedName) continue;

    const value = rest.join('=').trim();

    try {
      cookies[trimmedName] = decodeURIComponent(value);
    } catch {
      cookies[trimmedName] = value;
    }
  }

  return cookies;
}

function cookieParser() {
  return function cookieParserMiddleware(req, _res, next) {
    req.cookies = parseCookies(req.headers?.cookie);
    next();
  };
}

module.exports = cookieParser;
