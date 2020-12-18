const {
  HATCH_MAX_GOAL,
  HATCH_MIN_GOAL,
  PERCENT_SUPPLY_OFFERED,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  HATCH_STATE,
  HATCH_PERIOD,
  ZERO_ADDRESS,
  PERCENT_FUNDING_FOR_BENEFICIARY,
} = require('./helpers/constants')
const { prepareDefaultSetup, initializeHatch, defaultDeployParams } = require('./common/deploy')
const { tokenExchangeRate, now } = require('./common/utils')
const { assertRevert, assertBn } = require('@aragon/contract-helpers-test/src/asserts')
const { bn } = require('@aragon/contract-helpers-test/src/numbers')

contract('Hatch, setup', ([anyone, appManager, someEOA]) => {
  describe('When deploying the app with valid parameters', () => {
    const itSetupsTheAppCorrectly = startDate => {
      let hatchInitializationTx

      before(async () => {
        await prepareDefaultSetup(this, appManager)
        hatchInitializationTx = await initializeHatch(this, { ...defaultDeployParams(this, appManager), startDate })
      })

      it('App gets deployed', async () => {
        assert.isTrue(web3.utils.isAddress(this.hatch.address))
      })

      it('Gas used is ~3.38e6', async () => {
        const gasUsed = hatchInitializationTx.receipt.gasUsed
        assert.isTrue(gasUsed < 3.38e6)
      })

      it('Deploys fundraising related apps', async () => {
        assert.isTrue(web3.utils.isAddress(this.reserve.address))
      })

      it('startDate is set correctly', async () => {
        assert.equal((await this.hatch.openDate()).toNumber(), startDate)
      })

      it('Funding goals and percentage offered are set', async () => {
        assert.equal((await this.hatch.maxGoal()).toNumber(), Number(HATCH_MAX_GOAL))
        assert.equal((await this.hatch.minGoal()).toNumber(), Number(HATCH_MIN_GOAL))
        assert.equal((await this.hatch.supplyOfferedPct()).toNumber(), PERCENT_SUPPLY_OFFERED)
      })

      it('Dates and time periods are set', async () => {
        assert.equal((await this.hatch.vestingCliffPeriod()).toNumber(), VESTING_CLIFF_PERIOD)
        assert.equal((await this.hatch.vestingCompletePeriod()).toNumber(), VESTING_COMPLETE_PERIOD)
        assert.equal((await this.hatch.period()).toNumber(), HATCH_PERIOD)
      })

      it('Initial state is Pending', async () => {
        assert.equal((await this.hatch.state()).toNumber(), HATCH_STATE.PENDING)
      })

      it('Project token is deployed and set in the app', async () => {
        assert.equal(web3.utils.isAddress(this.projectToken.address), true)
        assert.equal(await this.hatch.token(), this.projectToken.address)
      })

      it('Contribution token is deployed and set in the app', async () => {
        assert.equal(web3.utils.isAddress(this.contributionToken.address), true)
        assert.equal(await this.hatch.contributionToken(), this.contributionToken.address)
      })

      it('TokenManager is deployed, set in the app, and controls the project token', async () => {
        assert.equal(web3.utils.isAddress(this.tokenManager.address), true)
        assert.equal(await this.hatch.tokenManager(), this.tokenManager.address)
      })

      it('Exchange rate is calculated to the expected value', async () => {
        const receivedValue = await this.hatch.exchangeRate()
        const expectedValue = tokenExchangeRate()
        assertBn(receivedValue, expectedValue)
      })

      it('Beneficiary address is set', async () => {
        assert.equal(await this.hatch.beneficiary(), appManager)
      })

      it('Percent funding for beneficiary is set', async () => {
        assert.equal((await this.hatch.fundingForBeneficiaryPct()).toNumber(), PERCENT_FUNDING_FOR_BENEFICIARY)
      })
    }

    describe('When no startDate is specified upon initialization', () => {
      itSetupsTheAppCorrectly(0)
    })

    describe('When a startDate is specified upon initialization', () => {
      itSetupsTheAppCorrectly(now() + 3600)
    })
  })

  describe('When deploying the app with invalid parameters', () => {
    let defaultParams

    before(async () => {
      await prepareDefaultSetup(this, appManager)
      defaultParams = defaultDeployParams(this, appManager)
    })

    it('Reverts when setting an invalid contribution token', async () => {
      await assertRevert(initializeHatch(this, { ...defaultParams, contributionToken: someEOA }), 'HATCH_INVALID_CONTRIBUTE_TOKEN')
    })

    it('Reverts when setting an invalid reserve', async () => {
      await assertRevert(initializeHatch(this, { ...defaultParams, reserve: someEOA }), 'HATCH_CONTRACT_IS_EOA')
    })

    it('Reverts when setting invalid dates', async () => {
      await assertRevert(initializeHatch(this, { ...defaultParams, startDate: Math.floor(new Date().getTime() / 1000) - 1 }), 'HATCH_INVALID_TIME_PERIOD')
      await assertRevert(initializeHatch(this, { ...defaultParams, hatchPeriod: 0 }), 'HATCH_INVALID_TIME_PERIOD')
      await assertRevert(initializeHatch(this, { ...defaultParams, vestingCliffPeriod: defaultParams.hatchPeriod - 1 }), 'HATCH_INVALID_TIME_PERIOD')
      await assertRevert(
        initializeHatch(this, { ...defaultParams, vestingCompletePeriod: defaultParams.vestingCliffPeriod - 1 }),
        'HATCH_INVALID_TIME_PERIOD'
      )
    })
    
    it('Reverts when setting an invalid min funding goal', async () => {
      await assertRevert(initializeHatch(this, { ...defaultParams, hatchMinGoal: 0 }), 'HATCH_INVALID_MIN_GOAL')
    })

    it('Reverts when setting an invalid max funding goal', async () => {
      await assertRevert(initializeHatch(this, { ...defaultParams, hatchMaxGoal: HATCH_MIN_GOAL.sub(bn(1)) }), 'HATCH_INVALID_MAX_GOAL')
    })

    it('Reverts when setting an invalid percent supply offered', async () => {
      await assertRevert(initializeHatch(this, { ...defaultParams, percentSupplyOffered: 0 }), 'HATCH_INVALID_PCT')
      await assertRevert(initializeHatch(this, { ...defaultParams, percentSupplyOffered: 1e6 + 1 }), 'HATCH_INVALID_PCT')
    })

    it('Reverts when setting an invalid percent funding for beneficiary', async () => {
      await assertRevert(initializeHatch(this, { ...defaultParams, percentFundingForBeneficiary: 1e6 + 1 }), 'HATCH_INVALID_PCT')
    })

    it('Reverts when setting an invalid beneficiary address', async () => {
      await assertRevert(initializeHatch(this, { ...defaultParams, beneficiary: ZERO_ADDRESS }), 'HATCH_INVALID_BENEFICIARY')
    })
  })
})
