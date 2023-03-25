const { HATCH_PERIOD, HATCH_STATE, HATCH_MAX_GOAL, HATCH_MIN_GOAL } = require('./helpers/constants')
const { contributionToProjectTokens, getEvent, now } = require('./common/utils')
const { prepareDefaultSetup, defaultDeployParams, initializeHatch } = require('./common/deploy')
const { assertRevert, assertBn } = require('@1hive/contract-helpers-test/src/asserts')
const { bn } = require('@1hive/contract-helpers-test/src/numbers')

const CONTRIBUTOR_BALANCE = 1000

contract('Hatch, refund() functionality', ([anyone, appManager, contributor1, contributor2, contributor3, contributor4, contributor5, contributor6]) => {
  const itAllowsContributorsToGetRefunded = startDate => {
    before(async () => {
      await prepareDefaultSetup(this, appManager)
      await initializeHatch(this, { ...defaultDeployParams(this, appManager), startDate })

      await this.contributionToken.generateTokens(contributor1, CONTRIBUTOR_BALANCE)
      await this.contributionToken.generateTokens(contributor2, CONTRIBUTOR_BALANCE)
      await this.contributionToken.generateTokens(contributor3, CONTRIBUTOR_BALANCE)
      await this.contributionToken.generateTokens(contributor5, CONTRIBUTOR_BALANCE)
      await this.contributionToken.generateTokens(contributor6, CONTRIBUTOR_BALANCE)

      await this.contributionToken.approve(this.hatch.address, CONTRIBUTOR_BALANCE, { from: contributor1 })
      await this.contributionToken.approve(this.hatch.address, CONTRIBUTOR_BALANCE, { from: contributor2 })
      await this.contributionToken.approve(this.hatch.address, CONTRIBUTOR_BALANCE, { from: contributor3 })
      await this.contributionToken.approve(this.hatch.address, CONTRIBUTOR_BALANCE, { from: contributor5 })
      await this.contributionToken.approve(this.hatch.address, CONTRIBUTOR_BALANCE, { from: contributor6 })

      if (startDate == 0) {
        startDate = now()
        await this.hatch.open({ from: appManager })
      }
      this.hatch.mockSetTimestamp(startDate + 1)
    })

    describe('When contributions have been made and the hatch is Refunding', () => {
      before(async () => {
        // Make a few contributions, careful not to reach the funding goal.
        await this.hatch.contribute(CONTRIBUTOR_BALANCE, { from: contributor1 }) // Spends everything in one contribution
        await this.hatch.contribute(CONTRIBUTOR_BALANCE / 2, { from: contributor2 })
        await this.hatch.contribute(CONTRIBUTOR_BALANCE / 2, { from: contributor2 }) // Spends everything in two contributions
        await this.hatch.contribute(CONTRIBUTOR_BALANCE / 2, { from: contributor3 }) // Spends half
        await this.hatch.contribute(1, { from: contributor5 }) // Spends a miserable amount xD
        await this.hatch.contribute(1, { from: contributor5 }) // And again
        await this.hatch.contribute(1, { from: contributor6 })

        this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD + 1)
      })

      it('Hatch state is Refunding', async () => {
        assert.equal((await this.hatch.state()).toNumber(), HATCH_STATE.REFUNDING)
      })

      it('Contributors obtained project tokens for their contribution tokens', async () => {
        assertBn(await this.contributionToken.balanceOf(contributor1), bn(0))
        assertBn(await this.contributionToken.balanceOf(contributor2), bn(0))
        assertBn(await this.contributionToken.balanceOf(contributor3), bn(CONTRIBUTOR_BALANCE / 2))

        assertBn(await this.projectToken.balanceOf(contributor1), contributionToProjectTokens(bn(CONTRIBUTOR_BALANCE)))
        assertBn(await this.projectToken.balanceOf(contributor2), contributionToProjectTokens(bn(CONTRIBUTOR_BALANCE)))
        assertBn(await this.projectToken.balanceOf(contributor3), contributionToProjectTokens(bn(CONTRIBUTOR_BALANCE / 2)))
      })

      it('Allows a contributor who made a single contribution to get refunded', async () => {
        await this.hatch.refund(contributor1)
        assertBn(await this.contributionToken.balanceOf(contributor1), bn(CONTRIBUTOR_BALANCE))
        assertBn(await this.projectToken.balanceOf(contributor1), bn(0))
      })

      it('Allows a contributor who made multiple contributions to get refunded', async () => {
        await this.hatch.refund(contributor2)
        assertBn(await this.contributionToken.balanceOf(contributor2), bn(CONTRIBUTOR_BALANCE))
      })

      it('A Refund event is emitted', async () => {
        const refundTx = await this.hatch.refund(contributor5)
        const expectedAmount = contributionToProjectTokens(bn(2))
        const event = getEvent(refundTx, 'Refund')
        assert.equal(event.args.contributor, contributor5)
        assert.equal(event.args.value.toNumber(), bn(2))
        assertBn(event.args.amount, expectedAmount)
      })

      it('Project tokens are burnt once refunded', async () => {
        const expectedAmount = contributionToProjectTokens(bn(1))
        const initialProjectTokenSupply = bn(await this.projectToken.totalSupply())
        await this.hatch.refund(contributor6)
        assertBn(await this.projectToken.totalSupply(), initialProjectTokenSupply.sub(expectedAmount))
      })

      it("Should deny anyone to get a refund for a contribution that wasn't made", async () => {
        await assertRevert(this.hatch.refund(anyone), 'HATCH_NOTHING_TO_REFUND')
      })

      it("Should deny a contributor to get a refund for a contribution that wasn't made", async () => {
        await assertRevert(this.hatch.refund(contributor2), 'HATCH_NOTHING_TO_REFUND')
      })
    })

    describe('When contributions have been made and the hatch is Funding', () => {
      before(async () => {
        this.hatch.mockSetTimestamp(startDate)
      })

      it('Hatch state is Funding', async () => {
        assert.equal((await this.hatch.state()).toNumber(), HATCH_STATE.FUNDING)
      })

      it('Should revert if a contributor attempts to get a refund', async () => {
        await assertRevert(this.hatch.refund(contributor1), 'HATCH_INVALID_STATE')
      })
    })

    describe('When contributions have been made and the hatch is ready to be closed', () => {
      before(async () => {
        this.hatch.mockSetTimestamp(startDate)
        await this.contributionToken.generateTokens(contributor4, HATCH_MAX_GOAL)
        await this.contributionToken.approve(this.hatch.address, HATCH_MAX_GOAL, { from: contributor4 })

        const leftToMinGoal = bn(HATCH_MIN_GOAL).sub(bn(await this.hatch.totalRaised()))
        await this.hatch.contribute(leftToMinGoal, { from: contributor4 })
      })

      it('Hatch state is Funding if period has not ended', async () => {
        assert.equal((await this.hatch.state()).toNumber(), HATCH_STATE.FUNDING)
      })

      it('Should revert if a contributor attempts to get a refund', async () => {
        await assertRevert(this.hatch.refund(contributor4), 'HATCH_INVALID_STATE')
      })

      describe('When min goal is reached and period has ended', async () => {
        before(async () => {
          this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD + 1)
        })
  
        it('Hatch state is GoalReached', async () => {
          assert.equal((await this.hatch.state()).toNumber(), HATCH_STATE.GOAL_REACHED)
        })
  
        it('Should revert if a contributor attempts to get a refund', async () => {
          await assertRevert(this.hatch.refund(contributor4), 'HATCH_INVALID_STATE')
        })
      })
    })
  }

  describe('When no startDate is specified upon initialization', () => {
    itAllowsContributorsToGetRefunded(0)
  })

  describe('When a startDate is specified upon initialization', () => {
    itAllowsContributorsToGetRefunded(now() + 3600)
  })
})
