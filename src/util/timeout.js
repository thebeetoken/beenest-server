module.exports = {
  Timeout: (defaultValue, ms = 4000) => new Promise(resolve => setTimeout(() => resolve(defaultValue), ms))
}