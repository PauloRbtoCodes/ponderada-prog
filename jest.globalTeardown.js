module.exports = async function globalTeardown() {
  if (global.__EP__) {
    await global.__EP__.stop();
  }
};
