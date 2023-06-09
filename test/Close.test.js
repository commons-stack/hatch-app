const {
  HATCH_MAX_GOAL,
  HATCH_STATE,
  PERCENT_FUNDING_FOR_BENEFICIARY,
  PERCENT_SUPPLY_OFFERED,
  PPM,
} = require('./helpers/constants')
const { prepareDefaultSetup, defaultDeployParams, initializeHatch } = require('./common/deploy')
const { getEvent, now } = require('./common/utils')
const { assertRevert } = require('@1hive/contract-helpers-test/src/asserts')

const CONTRIBUTOR_BALANCE = 2 * HATCH_MAX_GOAL

contract('Hatch, close() functionality', ([anyone, appManager, contributor1]) => {
  const itAllowsTheHatchToBeClosed = startDate => {
    describe('When enough contributions have been made to close the hatch', () => {
      before(async () => {
        await prepareDefaultSetup(this, appManager)
        await initializeHatch(this, { ...defaultDeployParams(this, appManager), startDate })

        await this.contributionToken.generateTokens(contributor1, CONTRIBUTOR_BALANCE)
        await this.contributionToken.approve(this.hatch.address, CONTRIBUTOR_BALANCE, { from: contributor1 })

        if (startDate == 0) {
          startDate = now()
          await this.hatch.open({ from: appManager })
        }
        this.hatch.mockSetTimestamp(startDate + 1)

        // Make a single contribution that reaches the max funding goal
        await this.hatch.contribute(HATCH_MAX_GOAL, {from: contributor1})
      })

      it('Hatch state is still GoalReached', async () => {
        assert.equal((await this.hatch.state()).toNumber(), HATCH_STATE.GOAL_REACHED)
      })

      it('Hatch state is GoalReached', async () => {
        assert.equal((await this.hatch.state()).toNumber(), HATCH_STATE.GOAL_REACHED)
      })

      describe('When the hatch is closed', () => {
        let closeReceipt

        before(async () => {
          closeReceipt = await this.hatch.close()
        })

        it('Hatch state is Closed', async () => {
          assert.equal((await this.hatch.state()).toNumber(), HATCH_STATE.CLOSED)
        })

        it('Raised funds are transferred to the fundraising reserve and the beneficiary address', async () => {
          assert.equal((await this.contributionToken.balanceOf(this.hatch.address)).toNumber(), 0)

          const totalRaised = (await this.hatch.totalRaised()).toNumber()
          const tokensForBeneficiary = Math.floor((totalRaised * PERCENT_FUNDING_FOR_BENEFICIARY) / PPM)
          const tokensForReserve = totalRaised - tokensForBeneficiary
          const reserve = await this.hatch.reserve()
          assert.equal((await this.contributionToken.balanceOf(appManager)).toNumber(), tokensForBeneficiary)
          assert.equal((await this.contributionToken.balanceOf(reserve)).toNumber(), tokensForReserve)
        })

        it('Tokens are minted to the beneficiary address', async () => {
          const supply = await this.projectToken.totalSupply()
          const balanceOfBeneficiary = await this.projectToken.balanceOf(appManager)

          assert.equal(parseInt(balanceOfBeneficiary.toNumber()), parseInt(Math.floor(supply.toNumber() * (1 - PERCENT_SUPPLY_OFFERED / PPM))))
        })

        it('Hatch cannot be closed again', async () => {
          await assertRevert(this.hatch.close(), 'HATCH_INVALID_STATE')
        })

        it('Emitted a Close event', async () => {
          assert.isTrue(!!getEvent(closeReceipt, 'Close'))
        })
      })
    })
  }

  describe('When no startDate is specified upon initialization', () => {
    itAllowsTheHatchToBeClosed(0)
  })

  describe('When a startDate is specified upon initialization', () => {
    itAllowsTheHatchToBeClosed(now() + 3600)
  })
})
