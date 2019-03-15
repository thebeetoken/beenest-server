module.exports = {
  /**
  * mongo id generator
  * @see https://stackoverflow.com/a/37438675/337493
  **/
  generate: (m = Math, d = Date, h = 16, s = s => m.floor(s).toString(h)) => s(d.now() / 1000) + ' '.repeat(h).replace(/./g, () => s(m.random() * h)),

  isValid: (id) => {
    const checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$");
    const results = checkForHexRegExp.exec(id);

    if (!results) {
      return false;
    }

    if (results.length !== 1) {
      return false;
    }

    return true;
  }
};
