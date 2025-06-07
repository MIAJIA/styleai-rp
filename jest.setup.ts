const fetch = require('node-fetch')
const FormData = require('form-data')

if (!global.fetch) {
  global.fetch = fetch
  global.Request = fetch.Request
  global.Response = fetch.Response
  global.Headers = fetch.Headers
  global.FormData = FormData
}