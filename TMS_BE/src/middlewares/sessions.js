import { UAParser } from "ua-parser-js";

export const deviceInfoMiddleware = (req, res, next) => {
  const userAgent = req.headers["user-agent"];
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection.remoteAddress;
  const normalizedIp = ipAddress === "::1" ? "127.0.0.1" : ipAddress;
  const parser = new UAParser();
  const result = parser.setUA(userAgent).getResult();

  req.deviceInfo = {
    browser: result.browser.name + " " + result.browser.version,
    os: result.os.name + " " + result.os.version,
    platform: result.device.type || "desktop",
  };

  req.ipAddress = normalizedIp;
  next();
};
