const validation = {
  doesParamExist: (param) => {
    return !!param;
  },

  isAmountParamValid: (amount) => {
    return (amount || amount === 0) && amount > 0;
  }
}

module.exports = validation;