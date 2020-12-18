const { HATCH_EXCHANGE_RATE, PPM } = require('../helpers/constants')
const { bn } = require('@aragon/contract-helpers-test/src/numbers')

const utils = {
  getEvent: (tx, eventName) => tx.logs.filter(log => log.event.includes(eventName))[0],

  contributionToProjectTokens: value => 
    value
      .mul(bn(HATCH_EXCHANGE_RATE))
      .div(bn(PPM))
  ,

  now: () => {
    return Math.floor(new Date().getTime() / 1000)
  },

  tokenExchangeRate: () => {
    return bn(HATCH_EXCHANGE_RATE)
  },

  sendTransaction: data => {
    return new Promise((resolve, reject) => {
      web3.eth.sendTransaction(data, (err, txHash) => {
        if (err) reject(err)
        else resolve(txHash)
      })
    })
  },
}

module.exports = utils
