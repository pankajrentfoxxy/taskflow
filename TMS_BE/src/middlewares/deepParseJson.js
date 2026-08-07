function deepParseJSON(input) {
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return deepParseJSON(parsed);
    } catch {
      return input;
    }
  }

  if (Array.isArray(input)) {
    return input.map(deepParseJSON);
  }

  if (typeof input === "object" && input !== null) {
    for (const key in input) {
      input[key] = deepParseJSON(input[key]);
    }
    return input;
  }

  return input;
}

const deepJSONParser = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = deepParseJSON(req.body);
  }
  next();
};

export default deepJSONParser;
