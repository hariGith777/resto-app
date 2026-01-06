export const ok = (data) => ({
  statusCode: 200,
  body: JSON.stringify(data)
});

export const created = (data) => ({
  statusCode: 201,
  body: JSON.stringify(data)
});

export const text = (s, code = 200) => ({ statusCode: code, body: String(s) });
