const { HATCH_PERIOD, HATCH_MAX_GOAL, HATCH_STATE, HATCH_MIN_GOAL } = require('./helpers/constants')
const { prepareDefaultSetup, defaultDeployParams, initializeHatch } = require('./common/deploy')
const { now } = require('./common/utils')

const getState = async test => {
  return (await test.hatch.state()).toNumber()
}

contract('Hatch, states validation', ([anyone, appManager, buyer]) => {
  const itManagesStateCorrectly = startDate => {
    describe('When a sale is deployed', () => {
      before(async () => {
        await prepareDefaultSetup(this, appManager)
        await initializeHatch(this, { ...defaultDeployParams(this, appManager), startDate })

        await this.contributionToken.generateTokens(buyer, HATCH_MAX_GOAL)
        await this.contributionToken.approve(this.hatch.address, HATCH_MAX_GOAL, { from: buyer })
      })

      it('Initial state is Pending', async () => {
        assert.equal(await getState(this), HATCH_STATE.PENDING)
      })

      describe('When the sale is started', () => {
        before(async () => {
          if (startDate == 0) {
            startDate = now()
            await this.hatch.open({ from: appManager })
          }
          this.hatch.mockSetTimestamp(startDate + 1)
        })

        it('The state is Funding', async () => {
          assert.equal(await getState(this), HATCH_STATE.FUNDING)
        })

        describe('When the funding period is still running', () => {
          before(async () => {
            this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD / 2)
          })

          it('The state is still Funding', async () => {
            assert.equal(await getState(this), HATCH_STATE.FUNDING)
          })

          describe('When purchases are made, not reaching the min funding goal', () => {
            before(async () => {
              await this.hatch.contribute(buyer, HATCH_MIN_GOAL / 2, { from: buyer })
            })

            it('The state is still Funding', async () => {
              assert.equal(await getState(this), HATCH_STATE.FUNDING)
            })

            describe('When the funding period elapses without having reached the funding goal', () => {
              before(async () => {
                this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD)
              })

              it('The state is Refunding', async () => {
                assert.equal(await getState(this), HATCH_STATE.REFUNDING)
              })
            })
          })

          describe('When purchases are made, reaching the min funding goal before the funding period elapsed', () => {
            before(async () => {
              this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD / 2)
              await this.hatch.contribute(buyer, HATCH_MIN_GOAL / 2, { from: buyer })
            })

            it('The state is Funding', async () => {
              assert.equal(await getState(this), HATCH_STATE.FUNDING)
            })

            describe('When the funding period elapses having reached the min funding goal', () => {
              before(async () => {
                this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD)
              })

              it('The state is GoalReached', async () => {
                assert.equal(await getState(this), HATCH_STATE.GOAL_REACHED)
              })
            })

            describe('When within the funding period and having reached the max funding goal', () => {
              before(async () => {
                this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD / 2)
                await this.hatch.contribute(buyer, HATCH_MAX_GOAL, { from: buyer })
              })

              it('The state is GoalReached', async () => {
                assert.equal(await getState(this), HATCH_STATE.GOAL_REACHED)
              })
            })

            describe('When the funding period elapses having reached the max funding goal', () => {
              before(async () => {
                this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD)
              })
  
              it('The state is still GoalReached', async () => {
                assert.equal(await getState(this), HATCH_STATE.GOAL_REACHED)
              })
            })

            describe('When the sale owner closes the sale', () => {
              before(async () => {
                await this.hatch.close()
              })

              it('The state is Closed', async () => {
                assert.equal(await getState(this), HATCH_STATE.CLOSED)
              })
            })
          })
        })
      })
    })
  }

  describe('When no startDate is specified upon initialization', () => {
    itManagesStateCorrectly(0)
  })

  describe('When a startDate is specified upon initialization', () => {
    itManagesStateCorrectly(now() + 3600)
  })
})
