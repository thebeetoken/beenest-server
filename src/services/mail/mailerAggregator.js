const METHODS = [
  'contact',
  'confirm',
  'accept',
  'reject',
  'rescind', // TODO: Reconcile naming; this means "cancelled by host"
  'cancel',
  'reportMetrics',
  'reportOnboarding',
  'reportContractEventMismatch'
];

module.exports = providers => METHODS.reduce(
  (aggregator, method) => ({
    ...aggregator,
    [method]: (...args) => Promise.all(providers.filter(
      provider => !!provider[method]
    ).map(
      provider => provider[method](...args)
    ))
  }),
  {}
);
