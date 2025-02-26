//createError.js

export function createError(code, message) {
  const err = new Error();
  err.status = code;
  err.message = message;
  console.log('running createError');
  return err;
}
