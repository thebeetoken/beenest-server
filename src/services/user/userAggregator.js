const NAMESPACE_SEPARATOR = '_';

class UserAggregator {
  constructor(userProviders, defaultUserProvider) {
    this.userProviders = userProviders;
    this.defaultUserProvider = defaultUserProvider;
  }

  getById(userId) {
    const namespace = typeof userId === 'string' && userId.split(NAMESPACE_SEPARATOR)[0];
    const provider = this.userProviders.hasOwnProperty(namespace) ? this.userProviders[namespace] : this.defaultUserProvider;

    return provider.getById(userId);
  }
}

module.exports = UserAggregator;